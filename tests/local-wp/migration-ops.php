<?php
/**
 * Yerel göç provası yazma işlemleri. Uzak eval-file için KULLANILMAZ.
 *
 *   php tests/local-wp/eval-file.php tests/local-wp/migration-ops.php <cmd> [args]
 *
 * cmd: activate | seed | import | migrate | probe
 */
if (!function_exists('get_option')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}

$wdp_args = isset($wdp_eval_args) && is_array($wdp_eval_args) ? $wdp_eval_args : (isset($args) && is_array($args) ? $args : array_slice($argv, 2));
$cmd      = isset($wdp_args[0]) ? (string) $wdp_args[0] : '';
$arg1     = isset($wdp_args[1]) ? (string) $wdp_args[1] : '';

require_once ABSPATH . 'wp-admin/includes/plugin.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/upgrade.php';

const WDP_MIG_MARK = 'migration-2a';

/**
 * @param string $slug_file plugin basename
 * @return array{ok:bool,plugin:string,error:string}
 */
function wdp_mig_activate($slug_file) {
	$slug_file = ltrim(str_replace('\\', '/', $slug_file), '/');
	if ($slug_file === '') {
		return array( 'ok' => false, 'plugin' => '', 'error' => 'slug boş' );
	}
	if (!function_exists('activate_plugin')) {
		return array( 'ok' => false, 'plugin' => $slug_file, 'error' => 'activate_plugin yok' );
	}
	$r = activate_plugin($slug_file, '', false, false);
	if (is_wp_error($r)) {
		return array( 'ok' => false, 'plugin' => $slug_file, 'error' => $r->get_error_message() );
	}
	return array( 'ok' => true, 'plugin' => $slug_file, 'error' => '', 'active' => is_plugin_active($slug_file) );
}

/**
 * @return array<string,mixed>
 */
function wdp_mig_seed() {
	$button = get_option('wdp_button_settings', array());
	if (!is_array($button)) {
		$button = array();
	}
	$button['button_primary_color'] = '#c0ffee';
	$button['popup_button_text']    = 'MIG-REHEARSE-CTA';
	update_option('wdp_button_settings', $button, false);

	$type = post_type_exists('product') ? 'product' : 'post';
	$existing = get_posts(
		array(
			'post_type'              => $type,
			'post_status'            => 'any',
			'numberposts'            => 1,
			'meta_key'               => '_wdp_e2e_test',
			'meta_value'             => WDP_MIG_MARK,
			'suppress_filters'       => true,
		)
	);
	$id = $existing ? (int) $existing[0]->ID : 0;
	if ($id <= 0) {
		$id = (int) wp_insert_post(
			array(
				'post_type'   => $type,
				'post_status' => 'publish',
				'post_title'  => 'WDP MIG Rehearse',
			)
		);
	}
	if ($id > 0) {
		update_post_meta($id, '_wdp_e2e_test', WDP_MIG_MARK);
		update_post_meta($id, '_allow_custom_price', 'yes');
		update_post_meta($id, '_min_custom_price', '42');
		update_post_meta($id, '_amount_presets', '42,84');
		update_post_meta($id, '_wdp_donation_product', 'yes');
	}

	return array(
		'option_seeded' => true,
		'product_id'    => $id,
		'post_type'     => $type,
	);
}

/**
 * @param mixed $value
 * @param array<int,int> $map
 * @param string $key
 * @return mixed
 */
function wdp_mig_rewrite_ids($value, $map, $key = '') {
	if (is_array($value)) {
		$out = array();
		foreach ($value as $k => $v) {
			$out[ $k ] = wdp_mig_rewrite_ids($v, $map, (string) $k);
		}
		return $out;
	}
	if ((is_int($value) || (is_string($value) && $value !== '' && ctype_digit((string) $value))) && preg_match('/(_id|product_id|page_id)$/i', $key)) {
		$old = (int) $value;
		return isset($map[ $old ]) ? $map[ $old ] : $value;
	}
	return $value;
}

/**
 * @param string $json_path
 * @return array<string,mixed>
 */
function wdp_mig_import($json_path) {
	if ($json_path === '' || !is_readable($json_path)) {
		return array( 'ok' => false, 'error' => 'json yok' );
	}
	$data = json_decode((string) file_get_contents($json_path), true);
	if (!is_array($data)) {
		return array( 'ok' => false, 'error' => 'json bozuk' );
	}
	$map  = array();
	$type = post_type_exists('product') ? 'product' : 'post';
	$imported_products = 0;
	foreach (isset($data['products']) && is_array($data['products']) ? $data['products'] : array() as $row) {
		$old_id = isset($row['id']) ? absint($row['id']) : 0;
		$status = isset($row['status']) && is_string($row['status']) ? $row['status'] : 'publish';
		$ptype  = isset($row['type']) && $row['type'] === 'product_variation' ? (post_type_exists('product_variation') ? 'product_variation' : $type) : $type;
		$new_id = (int) wp_insert_post(
			array(
				'post_type'   => $ptype,
				'post_status' => $status ? $status : 'publish',
				'post_title'  => 'WDP MIG src-' . $old_id,
			)
		);
		if ($new_id <= 0) {
			continue;
		}
		if ($old_id > 0) {
			$map[ $old_id ] = $new_id;
			update_post_meta($new_id, '_wdp_mig_source_id', $old_id);
		}
		update_post_meta($new_id, '_wdp_e2e_test', WDP_MIG_MARK);
		$meta = isset($row['meta']) && is_array($row['meta']) ? $row['meta'] : array();
		foreach ($meta as $mk => $entry) {
			$val = (is_array($entry) && array_key_exists('value', $entry)) ? $entry['value'] : $entry;
			update_post_meta($new_id, (string) $mk, $val);
		}
		$imported_products++;
	}

	$imported_options = 0;
	$options = isset($data['options']) && is_array($data['options']) ? $data['options'] : array();
	foreach ($options as $name => $entry) {
		$name = (string) $name;
		if ($name === '') {
			continue;
		}
		$val = (is_array($entry) && array_key_exists('value', $entry)) ? $entry['value'] : $entry;
		$val = wdp_mig_rewrite_ids($val, $map, $name);
		update_option($name, $val, false);
		$imported_options++;
	}

	return array(
		'ok'                => true,
		'imported_products' => $imported_products,
		'imported_options'  => $imported_options,
		'id_map'            => $map,
		'post_type'         => $type,
	);
}

/**
 * @param bool $force_run needs_run yok say
 * @return array<string,mixed>
 */
function wdp_mig_run($force_run = false) {
	$out = array(
		'class'            => class_exists('WDP_Migrations'),
		'needs_run'        => null,
		'is_fresh_install' => null,
		'ran'              => false,
		'ok'               => false,
	);
	if (!class_exists('WDP_Migrations')) {
		$out['error'] = 'WDP_Migrations yok';
		return $out;
	}
	$out['needs_run']        = WDP_Migrations::needs_run();
	$out['is_fresh_install'] = WDP_Migrations::is_fresh_install();
	$basename = defined('WDP_PLUGIN_FILE') ? plugin_basename(WDP_PLUGIN_FILE) : 'woo-donation-popup/woo-donation-popup.php';
	if (method_exists('WDP_Migrations', 'on_upgrader_complete')) {
		WDP_Migrations::on_upgrader_complete(
			null,
			array(
				'action'  => 'update',
				'type'    => 'plugin',
				'plugins' => array( $basename ),
			)
		);
		$out['upgrader_fired'] = true;
	}
	if ($force_run || WDP_Migrations::needs_run()) {
		$out['ok']  = (bool) WDP_Migrations::run();
		$out['ran'] = true;
	} else {
		$out['ok'] = true;
	}
	$out['db_version_present'] = get_option('wdp_db_version', null) !== null;
	$out['needs_run_after']    = WDP_Migrations::needs_run();
	$out['is_fresh_after']     = WDP_Migrations::is_fresh_install();
	return $out;
}

$result = array( 'cmd' => $cmd );

if ($cmd === 'activate') {
	$plugin = $arg1 !== '' ? $arg1 : 'woo-donation-popup/woo-donation-popup.php';
	$result = array_merge($result, wdp_mig_activate($plugin));
} elseif ($cmd === 'seed') {
	$result = array_merge($result, wdp_mig_seed());
} elseif ($cmd === 'import') {
	$result = array_merge($result, wdp_mig_import($arg1));
} elseif ($cmd === 'migrate') {
	$force  = $arg1 === 'force';
	$result = array_merge($result, wdp_mig_run($force));
} elseif ($cmd === 'probe') {
	$result['wdp_version']         = get_option('wdp_version', null);
	$result['wdp_db_version']      = get_option('wdp_db_version', null);
	$result['migrations']          = class_exists('WDP_Migrations');
	$result['is_fresh_install']    = class_exists('WDP_Migrations') ? WDP_Migrations::is_fresh_install() : null;
	$result['needs_run']           = class_exists('WDP_Migrations') ? WDP_Migrations::needs_run() : null;
	$result['plugin_active']       = function_exists('is_plugin_active') && is_plugin_active('woo-donation-popup/woo-donation-popup.php');
	$result['wc_active']           = function_exists('is_plugin_active') && is_plugin_active('woocommerce/woocommerce.php');
	$result['product_post_type']   = post_type_exists('product');
} else {
	$result['ok']    = false;
	$result['error'] = 'bilinmeyen cmd';
}

echo wp_json_encode($result, JSON_UNESCAPED_UNICODE);
echo "\n";

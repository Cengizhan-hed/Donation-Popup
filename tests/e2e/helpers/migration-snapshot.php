<?php
/**
 * Salt okunur eklenti ayar / ürün meta anlık görüntüsü.
 *
 *   wp eval-file tests/e2e/helpers/migration-snapshot.php
 *
 * Anahtar kümesi: WDP_MIG_KEYS_FILE (JSON) veya WDP_MIG_KEYSET_JSON sabiti.
 * Çıktı yalnız stdout JSON. Konsola özet yazılmaz (sarmalayıcı özetler).
 */
if (!function_exists('get_option') || !function_exists('get_post_meta')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}

/**
 * @param mixed $value
 * @return mixed
 */
function wdp_mig_sort_deep($value) {
	if ($value === null) {
		return null;
	}
	if (is_object($value)) {
		$value = get_object_vars($value);
	}
	if (is_array($value)) {
		$is_list = function_exists('array_is_list') ? array_is_list($value) : (array_keys($value) === range(0, count($value) - 1));
		if ($is_list) {
			$out = array();
			foreach ($value as $item) {
				$out[] = wdp_mig_sort_deep($item);
			}
			return $out;
		}
		ksort($value);
		$out = array();
		foreach ($value as $k => $item) {
			$out[ (string) $k ] = wdp_mig_sort_deep($item);
		}
		return $out;
	}
	return $value;
}

/**
 * @param mixed $value
 * @return string
 */
function wdp_mig_canonical($value) {
	$json = wp_json_encode(wdp_mig_sort_deep($value), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
	return is_string($json) ? $json : 'null';
}

/**
 * @param mixed $value
 * @return string
 */
function wdp_mig_type($value) {
	if ($value === null || $value === '') {
		return 'boş';
	}
	if (is_bool($value)) {
		return 'bool';
	}
	if (is_int($value) || is_float($value)) {
		return 'sayı';
	}
	if (is_array($value)) {
		return $value === array() ? 'boş' : 'array';
	}
	return 'string';
}

/**
 * @param mixed $value
 * @return array{type:string,hash:string,value:mixed}
 */
function wdp_mig_entry($value) {
	if (is_object($value)) {
		$value = get_object_vars($value);
	}
	$canonical = wdp_mig_canonical($value);
	return array(
		'type'  => wdp_mig_type($value),
		'hash'  => substr(hash('sha256', $canonical), 0, 12),
		'value' => $value,
	);
}

/**
 * @return array<string,mixed>
 */
function wdp_mig_load_keyset() {
	$file = getenv('WDP_MIG_KEYS_FILE');
	if (is_string($file) && $file !== '' && is_readable($file)) {
		$decoded = json_decode((string) file_get_contents($file), true);
		if (is_array($decoded)) {
			return $decoded;
		}
	}
	if (defined('WDP_MIG_KEYSET_JSON')) {
		$decoded = json_decode((string) WDP_MIG_KEYSET_JSON, true);
		if (is_array($decoded)) {
			return $decoded;
		}
	}
	return array(
		'options'         => array(),
		'meta'            => array(),
		'optionPrefixes'  => array( 'wdp_' ),
		'metaPrefixes'    => array( 'wdp_', '_wdp_' ),
	);
}

/**
 * @param wpdb   $wpdb
 * @param string $prefix
 * @return string[]
 */
function wdp_mig_option_names_like($wpdb, $prefix) {
	$like = $wpdb->esc_like($prefix) . '%';
	$names = $wpdb->get_col($wpdb->prepare("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s", $like));
	return is_array($names) ? array_map('strval', $names) : array();
}

$keyset          = wdp_mig_load_keyset();
$known_options   = array_values(array_filter(array_map('strval', isset($keyset['options']) ? (array) $keyset['options'] : array())));
$known_meta      = array_values(array_filter(array_map('strval', isset($keyset['meta']) ? (array) $keyset['meta'] : array())));
$option_prefixes = array_values(array_filter(array_map('strval', isset($keyset['optionPrefixes']) ? (array) $keyset['optionPrefixes'] : array( 'wdp_' ))));
$meta_prefixes   = array_values(array_filter(array_map('strval', isset($keyset['metaPrefixes']) ? (array) $keyset['metaPrefixes'] : array( 'wdp_', '_wdp_' ))));

global $wpdb;
$option_names = $known_options;
if (isset($wpdb) && is_object($wpdb) && isset($wpdb->options)) {
	foreach ($option_prefixes as $prefix) {
		if ($prefix === '') {
			continue;
		}
		$option_names = array_merge($option_names, wdp_mig_option_names_like($wpdb, $prefix));
	}
}
$option_names = array_values(array_unique($option_names));
sort($option_names);

$options = array();
foreach ($option_names as $name) {
	if ($name === '' || $name === 'cron') {
		continue;
	}
	$missing = '__wdp_mig_missing__';
	$val     = get_option($name, $missing);
	if ($val === $missing) {
		continue;
	}
	$options[ $name ] = wdp_mig_entry($val);
}

$wc_keys = array(
	'woocommerce_currency',
	'woocommerce_price_num_decimals',
	'woocommerce_price_thousand_sep',
	'woocommerce_price_decimal_sep',
	'woocommerce_currency_pos',
	'woocommerce_default_country',
	'woocommerce_store_address',
	'woocommerce_store_address_2',
	'woocommerce_store_city',
	'woocommerce_store_postcode',
	'woocommerce_allowed_countries',
	'woocommerce_ship_to_countries',
	'woocommerce_calc_taxes',
	'woocommerce_prices_include_tax',
	'woocommerce_tax_based_on',
);
$woocommerce = array();
foreach ($wc_keys as $name) {
	$missing = '__wdp_mig_missing__';
	$val     = get_option($name, $missing);
	if ($val === $missing) {
		continue;
	}
	$woocommerce[ $name ] = wdp_mig_entry($val);
}

$product_ids = array();
if (isset($wpdb) && is_object($wpdb) && isset($wpdb->posts)) {
	$cols = $wpdb->get_col("SELECT ID FROM {$wpdb->posts} WHERE post_type IN ('product','product_variation') ORDER BY ID ASC");
	$product_ids = is_array($cols) ? array_map('intval', $cols) : array();
}

$products = array();
foreach ($product_ids as $pid) {
	if ($pid <= 0) {
		continue;
	}
	$post = get_post($pid);
	if (!$post) {
		continue;
	}
	$all_meta = get_post_meta($pid);
	$meta_out = array();
	if (is_array($all_meta)) {
		foreach ($all_meta as $mk => $mv) {
			$mk = (string) $mk;
			$keep = in_array($mk, $known_meta, true);
			if (!$keep) {
				foreach ($meta_prefixes as $prefix) {
					if ($prefix !== '' && strpos($mk, $prefix) === 0) {
						$keep = true;
						break;
					}
				}
			}
			if (!$keep) {
				continue;
			}
			$raw = is_array($mv) && array_key_exists(0, $mv) ? maybe_unserialize($mv[0]) : $mv;
			$meta_out[ $mk ] = wdp_mig_entry($raw);
		}
	}
	$products[] = array(
		'id'        => $pid,
		'type'      => (string) $post->post_type,
		'status'    => (string) $post->post_status,
		'source_id' => (int) get_post_meta($pid, '_wdp_mig_source_id', true),
		'mark'      => (string) get_post_meta($pid, '_wdp_e2e_test', true),
		'meta'      => $meta_out,
	);
}

$probe = array(
	'wdp_db_version_present' => get_option('wdp_db_version', null) !== null,
	'wdp_version_present'    => get_option('wdp_version', null) !== null,
	'is_fresh_install'       => null,
);
if (class_exists('WDP_Migrations') && method_exists('WDP_Migrations', 'is_fresh_install')) {
	$probe['is_fresh_install'] = (bool) WDP_Migrations::is_fresh_install();
}

$out = array(
	'schema'       => 1,
	'generated_at' => gmdate('c'),
	'siteurl'      => (string) get_option('siteurl', ''),
	'probe'        => $probe,
	'keyset'       => array(
		'option_count' => count($known_options),
		'meta_count'   => count($known_meta),
		'prefixes'     => $option_prefixes,
	),
	'woocommerce'  => $woocommerce,
	'options'      => $options,
	'products'     => $products,
);

$json = wp_json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if (!is_string($json)) {
	fwrite(STDERR, "json encode failed\n");
	exit(1);
}
echo $json;

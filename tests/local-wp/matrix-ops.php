<?php
/**
 * Yerel tema/Woo uyum matrisi yazma işlemleri. Uzak eval-file için KULLANILMAZ.
 *
 *   php tests/local-wp/eval-file.php tests/local-wp/matrix-ops.php <cmd> [json-path|args]
 *
 * cmd: base | apply | probe | read-order | plugin | checkpoint
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
require_once ABSPATH . 'wp-admin/includes/theme.php';

const WDP_MATRIX_MARK = 'matrix-4a';

/**
 * @param string $slug_file
 * @return array{ok:bool,plugin:string,error:string,active?:bool}
 */
function wdp_matrix_activate($slug_file) {
	$slug_file = ltrim(str_replace('\\', '/', $slug_file), '/');
	if ($slug_file === '') {
		return array( 'ok' => false, 'plugin' => '', 'error' => 'slug boş' );
	}
	$r = activate_plugin($slug_file, '', false, false);
	if (is_wp_error($r)) {
		return array( 'ok' => false, 'plugin' => $slug_file, 'error' => $r->get_error_message() );
	}
	return array(
		'ok'     => true,
		'plugin' => $slug_file,
		'error'  => '',
		'active' => is_plugin_active($slug_file),
	);
}

/**
 * @param string $path
 * @return array<string,mixed>
 */
function wdp_matrix_read_json($path) {
	if ($path === '' || !is_readable($path)) {
		return array();
	}
	$data = json_decode((string) file_get_contents($path), true);
	return is_array($data) ? $data : array();
}

function wdp_matrix_checkpoint() {
	global $wpdb;
	if (isset($wpdb) && method_exists($wpdb, 'query')) {
		$wpdb->query('PRAGMA wal_checkpoint(TRUNCATE)');
	}
	return array( 'ok' => true );
}

function wdp_matrix_coming_soon_off() {
	update_option('woocommerce_coming_soon', 'no', false);
	update_option('woocommerce_store_pages_only', 'no', false);
	delete_transient('woocommerce_coming_soon');
}

function wdp_matrix_guest_checkout() {
	update_option('woocommerce_enable_guest_checkout', 'yes', false);
	update_option('woocommerce_enable_checkout_login_reminder', 'no', false);
	update_option('woocommerce_enable_signup_and_login_from_checkout', 'no', false);
	update_option('woocommerce_calc_shipping', 'no', false);
	update_option('woocommerce_ship_to_countries', 'disabled', false);
	update_option('woocommerce_calc_taxes', 'no', false);
	update_option('woocommerce_cart_redirect_after_add', 'no', false);
	update_option('woocommerce_enable_coupons', 'no', false);
	update_option('woocommerce_terms_page_id', 0, false);
	update_option('blog_public', '1', false);
}

function wdp_matrix_permalinks() {
	update_option('permalink_structure', '/%postname%/', false);
	if (function_exists('flush_rewrite_rules')) {
		flush_rewrite_rules(false);
	}
}

/**
 * @param bool $on
 */
function wdp_matrix_set_hpos($on) {
	$val = $on ? 'yes' : 'no';
	update_option('woocommerce_custom_orders_table_enabled', $val, false);
	update_option('woocommerce_feature_custom_order_tables_enabled', $val, false);
	update_option('woocommerce_custom_orders_table_data_sync_enabled', 'yes', false);
	if (function_exists('wc_get_container')) {
		try {
			$features = wc_get_container()->get(\Automattic\WooCommerce\Internal\Features\FeaturesController::class);
			if ($features && method_exists($features, 'change_feature_enabled')) {
				$features->change_feature_enabled('custom_order_tables', (bool) $on);
			}
		} catch (Throwable $e) {
			// konteyner yoksa option yeter
		}
	}
}

function wdp_matrix_enable_cheque() {
	$settings = get_option('woocommerce_cheque_settings', array());
	if (!is_array($settings)) {
		$settings = array();
	}
	$settings['enabled']      = 'yes';
	$settings['title']        = isset($settings['title']) && $settings['title'] !== '' ? $settings['title'] : 'Check payments';
	$settings['instructions'] = isset($settings['instructions']) ? $settings['instructions'] : '';
	update_option('woocommerce_cheque_settings', $settings, false);
	$gateways   = get_option('woocommerce_gateway_order', array());
	if (!is_array($gateways)) {
		$gateways = array();
	}
	$gateways['cheque'] = 0;
	update_option('woocommerce_gateway_order', $gateways, false);
	if (function_exists('WC') && WC() && isset(WC()->payment_gateways)) {
		$gws = WC()->payment_gateways();
		if ($gws && method_exists($gws, 'init')) {
			$gws->init();
		}
	}
}

/**
 * @param string $kind blocks|classic
 */
function wdp_matrix_set_checkout($kind) {
	if (!function_exists('wc_get_page_id')) {
		return array( 'ok' => false, 'error' => 'wc_get_page_id yok' );
	}
	$checkout_id = (int) wc_get_page_id('checkout');
	$cart_id     = (int) wc_get_page_id('cart');
	if ($kind === 'classic') {
		$checkout_html = '[woocommerce_checkout]';
		$cart_html     = '[woocommerce_cart]';
	} else {
		$checkout_html = "<!-- wp:woocommerce/checkout -->\n<div class=\"wp-block-woocommerce-checkout is-loading\"></div>\n<!-- /wp:woocommerce/checkout -->";
		$cart_html     = "<!-- wp:woocommerce/cart -->\n<div class=\"wp-block-woocommerce-cart is-loading\"></div>\n<!-- /wp:woocommerce/cart -->";
	}
	$updated = array();
	if ($checkout_id > 0) {
		wp_update_post(
			array(
				'ID'           => $checkout_id,
				'post_status'  => 'publish',
				'post_content' => $checkout_html,
			)
		);
		$updated['checkout'] = $checkout_id;
	}
	if ($cart_id > 0) {
		wp_update_post(
			array(
				'ID'           => $cart_id,
				'post_status'  => 'publish',
				'post_content' => $cart_html,
			)
		);
		$updated['cart'] = $cart_id;
	}
	return array( 'ok' => true, 'pages' => $updated, 'kind' => $kind );
}

/**
 * @param array<string,mixed> $store
 */
function wdp_matrix_set_store($store) {
	$currency = isset($store['currency']) ? (string) $store['currency'] : 'TRY';
	$decimals = isset($store['decimals']) ? (int) $store['decimals'] : 2;
	$thousand = array_key_exists('thousandSeparator', $store) ? (string) $store['thousandSeparator'] : ',';
	$decimal  = array_key_exists('decimalSeparator', $store) ? (string) $store['decimalSeparator'] : '.';
	$pos      = isset($store['symbolPosition']) ? (string) $store['symbolPosition'] : 'left';
	$country  = isset($store['country']) ? (string) $store['country'] : 'TR';
	$state    = isset($store['state']) ? (string) $store['state'] : '';
	$city     = isset($store['city']) ? (string) $store['city'] : 'Istanbul';
	$postcode = isset($store['postcode']) ? (string) $store['postcode'] : '34000';
	$address  = isset($store['address']) ? (string) $store['address'] : 'Test Cad. 1';
	$default  = $state !== '' ? ($country . ':' . $state) : $country;

	update_option('woocommerce_currency', $currency, false);
	update_option('woocommerce_price_num_decimals', (string) $decimals, false);
	update_option('woocommerce_price_thousand_sep', $thousand, false);
	update_option('woocommerce_price_decimal_sep', $decimal, false);
	update_option('woocommerce_currency_pos', $pos, false);
	update_option('woocommerce_default_country', $default, false);
	update_option('woocommerce_store_address', $address, false);
	update_option('woocommerce_store_city', $city, false);
	update_option('woocommerce_store_postcode', $postcode, false);
	if (function_exists('WC') && WC() && isset(WC()->countries) && method_exists(WC()->countries, 'get_base_country')) {
		WC()->countries->countries; // yükle
	}
	if (class_exists('WC_Cache_Helper') && method_exists('WC_Cache_Helper', 'invalidate_cache_group')) {
		WC_Cache_Helper::invalidate_cache_group('options');
	}
	return array(
		'currency' => $currency,
		'decimals' => $decimals,
		'pos'      => $pos,
		'country'  => $default,
	);
}

/**
 * @param string $slug
 */
function wdp_matrix_set_theme($slug) {
	$slug = sanitize_key($slug);
	if ($slug === '') {
		return array( 'ok' => false, 'error' => 'tema boş' );
	}
	$theme = wp_get_theme($slug);
	if (!$theme->exists()) {
		return array( 'ok' => false, 'error' => 'tema yok: ' . $slug );
	}
	switch_theme($slug);
	return array(
		'ok'     => true,
		'theme'  => $slug,
		'active' => get_stylesheet(),
	);
}

function wdp_matrix_wdp_settings() {
	$button = get_option('wdp_button_settings', array());
	if (!is_array($button)) {
		$button = array();
	}
	$button['enable_donor_email'] = '1';
	$button['enable_dedication']  = '1';
	update_option('wdp_button_settings', $button, false);

	$place = get_option('wdp_placement_settings', array());
	if (!is_array($place)) {
		$place = array();
	}
	$place['auto_place'] = 'yes';
	$place['display']    = 'inline';
	$place['position']   = 'replace_cart';
	update_option('wdp_placement_settings', $place, false);
}

/**
 * @return array<string,array<string,mixed>>
 */
function wdp_matrix_catalog() {
	return array(
		'custom' => array(
			'WDP E2E Custom',
			array(
				'_allow_custom_price'   => 'yes',
				'_min_custom_price'     => '10',
				'_amount_presets'       => '10,25,50,1234',
				'_wdp_donation_product' => 'yes',
				'_enable_email'         => 'yes',
				'_enable_dedication'    => 'yes',
				'_regular_price'        => '',
				'_price'                => '',
			),
		),
		'fixed'  => array(
			'WDP E2E Fixed',
			array(
				'_wdp_donation_product' => 'yes',
				'_regular_price'        => '100',
				'_price'                => '100',
			),
		),
	);
}

/**
 * @param string $title
 * @return int
 */
function wdp_matrix_find_marked($title) {
	$found = get_posts(
		array(
			'post_type'        => array( 'product', 'page', 'post' ),
			'post_status'      => 'any',
			'title'            => $title,
			'numberposts'      => 1,
			'meta_key'         => '_wdp_e2e_test',
			'meta_value'       => WDP_MATRIX_MARK,
			'suppress_filters' => true,
		)
	);
	return $found ? (int) $found[0]->ID : 0;
}

/**
 * @return array<string,mixed>
 */
function wdp_matrix_bootstrap_products() {
	$roles   = array();
	$created = array();
	foreach (wdp_matrix_catalog() as $role => $row) {
		$title = $row[0];
		$id    = wdp_matrix_find_marked($title);
		if (!$id) {
			$id = (int) wp_insert_post(
				array(
					'post_title'  => $title,
					'post_status' => 'publish',
					'post_type'   => post_type_exists('product') ? 'product' : 'post',
					'post_name'   => sanitize_title($title),
				),
				true
			);
			if (!$id || is_wp_error($id)) {
				throw new RuntimeException('ürün oluşturulamadı: ' . $role);
			}
			$created[] = $role;
		}
		update_post_meta($id, '_wdp_e2e_test', WDP_MATRIX_MARK);
		update_post_meta($id, '_visibility', 'visible');
		foreach ($row[1] as $k => $v) {
			update_post_meta($id, $k, $v);
		}
		if (function_exists('wc_get_product')) {
			$p = wc_get_product($id);
			if ($p) {
				$p->set_catalog_visibility('visible');
				$p->set_status('publish');
				$p->set_virtual(true);
				$p->set_sold_individually(false);
				$p->set_stock_status('instock');
				if (isset($row[1]['_regular_price']) && $row[1]['_regular_price'] !== '') {
					$p->set_regular_price($row[1]['_regular_price']);
					$p->set_price($row[1]['_price']);
				}
				$p->save();
			}
		}
		$permalink = get_permalink($id);
		$path      = '';
		if ($permalink) {
			$u    = wp_parse_url($permalink);
			$path = isset($u['path']) ? $u['path'] : '';
		}
		$roles[ $role ] = array(
			'id'   => (int) $id,
			'name' => $title,
			'slug' => get_post_field('post_name', $id),
			'path' => $path,
			'url'  => $permalink,
		);
	}
	return array( 'roles' => $roles, 'created' => $created );
}

/**
 * @param int $custom_id
 * @return array<string,mixed>
 */
function wdp_matrix_list_page($custom_id) {
	$title   = 'WDP E2E List';
	$page_id = wdp_matrix_find_marked($title);
	$ids     = $custom_id > 0 ? (string) $custom_id : '';
	$content = '[wdp_donations button="popup" ids="' . esc_attr($ids) . '" limit="12" tabs="no"]';
	if (!$page_id) {
		$page_id = (int) wp_insert_post(
			array(
				'post_title'   => $title,
				'post_status'  => 'publish',
				'post_type'    => 'page',
				'post_name'    => 'wdp-e2e-list',
				'post_content' => $content,
			),
			true
		);
		if (!$page_id || is_wp_error($page_id)) {
			throw new RuntimeException('liste sayfası oluşturulamadı');
		}
	} else {
		wp_update_post(
			array(
				'ID'           => $page_id,
				'post_status'  => 'publish',
				'post_content' => $content,
			)
		);
	}
	update_post_meta($page_id, '_wdp_e2e_test', WDP_MATRIX_MARK);
	$permalink = get_permalink($page_id);
	$path      = '';
	if ($permalink) {
		$u    = wp_parse_url($permalink);
		$path = isset($u['path']) ? $u['path'] : '';
	}
	return array(
		'id'   => $page_id,
		'path' => $path,
		'url'  => $permalink,
	);
}

/**
 * @return array<string,mixed>
 */
function wdp_matrix_probe() {
	$hpos = false;
	if (class_exists('\Automattic\WooCommerce\Utilities\OrderUtil') && method_exists('\Automattic\WooCommerce\Utilities\OrderUtil', 'custom_orders_table_usage_is_enabled')) {
		$hpos = (bool) \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
	} else {
		$hpos = get_option('woocommerce_custom_orders_table_enabled') === 'yes';
	}
	$checkout = function_exists('wc_get_checkout_url') ? wc_get_checkout_url() : '';
	$cart     = function_exists('wc_get_cart_url') ? wc_get_cart_url() : '';
	$checkout_id = function_exists('wc_get_page_id') ? (int) wc_get_page_id('checkout') : 0;
	$checkout_html = $checkout_id ? (string) get_post_field('post_content', $checkout_id) : '';
	$is_blocks     = strpos($checkout_html, 'wp:woocommerce/checkout') !== false;
	$products      = array();
	foreach (array( 'custom' => 'WDP E2E Custom', 'fixed' => 'WDP E2E Fixed' ) as $role => $title) {
		$id = wdp_matrix_find_marked($title);
		if (!$id) {
			continue;
		}
		$permalink = get_permalink($id);
		$u         = $permalink ? wp_parse_url($permalink) : array();
		$products[ $role ] = array(
			'id'   => $id,
			'slug' => get_post_field('post_name', $id),
			'path' => isset($u['path']) ? $u['path'] : '',
		);
	}
	$list = wdp_matrix_find_marked('WDP E2E List');
	$list_path = '';
	if ($list) {
		$lu        = wp_parse_url((string) get_permalink($list));
		$list_path = isset($lu['path']) ? $lu['path'] : '';
	}
	return array(
		'ok'            => true,
		'theme'         => get_stylesheet(),
		'hpos'          => $hpos,
		'checkoutUrl'   => $checkout,
		'cartUrl'       => $cart,
		'checkoutBlocks'=> $is_blocks,
		'currency'      => get_option('woocommerce_currency'),
		'decimals'      => get_option('woocommerce_price_num_decimals'),
		'thousand'      => get_option('woocommerce_price_thousand_sep'),
		'decimal'       => get_option('woocommerce_price_decimal_sep'),
		'pos'           => get_option('woocommerce_currency_pos'),
		'products'      => $products,
		'listPath'      => $list_path,
		'wdpActive'     => function_exists('is_plugin_active') && is_plugin_active('woo-donation-popup/woo-donation-popup.php'),
		'wcActive'      => function_exists('is_plugin_active') && is_plugin_active('woocommerce/woocommerce.php'),
	);
}

/**
 * @param int $order_id
 * @return array<string,mixed>
 */
function wdp_matrix_read_order($order_id) {
	$order_id = (int) $order_id;
	if ($order_id <= 0 || !function_exists('wc_get_order')) {
		return array( 'ok' => false, 'error' => 'sipariş yok' );
	}
	$order = wc_get_order($order_id);
	if (!$order) {
		return array( 'ok' => false, 'error' => 'wc_get_order boş', 'id' => $order_id );
	}
	$hpos = false;
	if (class_exists('\Automattic\WooCommerce\Utilities\OrderUtil') && method_exists('\Automattic\WooCommerce\Utilities\OrderUtil', 'custom_orders_table_usage_is_enabled')) {
		$hpos = (bool) \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
	}
	$items = array();
	foreach ($order->get_items() as $item) {
		$meta = array();
		foreach (array( 'wdp_donor_name', 'wdp_donor_phone', 'wdp_donor_email', 'wdp_dedication', 'wdp_donation_note' ) as $key) {
			$meta[ $key ] = (string) $item->get_meta($key);
		}
		$items[] = array(
			'name'  => $item->get_name(),
			'total' => (string) $item->get_total(),
			'meta'  => $meta,
		);
	}
	return array(
		'ok'           => true,
		'id'           => $order->get_id(),
		'total'        => (string) $order->get_total(),
		'currency'     => $order->get_currency(),
		'billingName'  => trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()),
		'billingEmail' => (string) $order->get_billing_email(),
		'billingPhone' => (string) $order->get_billing_phone(),
		'hpos'         => $hpos,
		'items'        => $items,
	);
}

/**
 * @param string $state on|off
 */
function wdp_matrix_plugin($state) {
	$file = 'woo-donation-popup/woo-donation-popup.php';
	if ($state === 'off') {
		deactivate_plugins($file, true);
	} else {
		wdp_matrix_activate($file);
	}
	return array(
		'ok'     => true,
		'active' => is_plugin_active($file),
		'state'  => $state,
	);
}

function wdp_matrix_base() {
	$wc = wdp_matrix_activate('woocommerce/woocommerce.php');
	if (!$wc['ok'] && empty($wc['active'])) {
		return array( 'ok' => false, 'error' => 'WooCommerce etkin değil: ' . ($wc['error'] ?? '') );
	}
	if (class_exists('WC_Install') && method_exists('WC_Install', 'install')) {
		WC_Install::install();
	}
	if (class_exists('WC_Install') && method_exists('WC_Install', 'create_pages')) {
		WC_Install::create_pages();
	}
	$wdp = wdp_matrix_activate('woo-donation-popup/woo-donation-popup.php');
	wdp_matrix_coming_soon_off();
	wdp_matrix_guest_checkout();
	wdp_matrix_permalinks();
	wdp_matrix_enable_cheque();
	wdp_matrix_wdp_settings();
	if (class_exists('WDP_Migrations') && method_exists('WDP_Migrations', 'needs_run') && WDP_Migrations::needs_run()) {
		WDP_Migrations::run();
	}
	wdp_matrix_checkpoint();
	return array(
		'ok'      => true,
		'wc'      => $wc,
		'wdp'     => $wdp,
		'cart'    => function_exists('wc_get_page_id') ? wc_get_page_id('cart') : 0,
		'checkout'=> function_exists('wc_get_page_id') ? wc_get_page_id('checkout') : 0,
	);
}

/**
 * @param array<string,mixed> $spec
 */
function wdp_matrix_apply($spec) {
	$theme    = isset($spec['themeSlug']) ? (string) $spec['themeSlug'] : '';
	$store    = isset($spec['store']) && is_array($spec['store']) ? $spec['store'] : array();
	$checkout = isset($spec['checkout']) ? (string) $spec['checkout'] : 'classic';
	$hpos     = !empty($spec['hpos']);

	if (!is_plugin_active('woocommerce/woocommerce.php')) {
		wdp_matrix_activate('woocommerce/woocommerce.php');
	}
	if (!is_plugin_active('woo-donation-popup/woo-donation-popup.php')) {
		wdp_matrix_activate('woo-donation-popup/woo-donation-popup.php');
	}
	wdp_matrix_coming_soon_off();
	wdp_matrix_guest_checkout();
	$theme_r = wdp_matrix_set_theme($theme);
	$store_r = wdp_matrix_set_store($store);
	wdp_matrix_set_hpos($hpos);
	$chk     = wdp_matrix_set_checkout($checkout);
	wdp_matrix_enable_cheque();
	wdp_matrix_wdp_settings();
	$boot    = wdp_matrix_bootstrap_products();
	$custom  = isset($boot['roles']['custom']['id']) ? (int) $boot['roles']['custom']['id'] : 0;
	$list    = wdp_matrix_list_page($custom);
	wdp_matrix_permalinks();
	wdp_matrix_checkpoint();
	$probe = wdp_matrix_probe();
	return array(
		'ok'     => !empty($theme_r['ok']) && !empty($chk['ok']),
		'theme'  => $theme_r,
		'store'  => $store_r,
		'checkout'=> $chk,
		'hpos'   => $hpos,
		'boot'   => $boot,
		'list'   => $list,
		'probe'  => $probe,
	);
}

$result = array( 'cmd' => $cmd, 'ok' => false );

try {
	if ($cmd === 'base') {
		$result = array_merge($result, wdp_matrix_base());
	} elseif ($cmd === 'apply') {
		$spec   = wdp_matrix_read_json($arg1);
		$result = array_merge($result, wdp_matrix_apply($spec));
	} elseif ($cmd === 'probe') {
		$result = array_merge($result, wdp_matrix_probe());
	} elseif ($cmd === 'read-order') {
		$result = array_merge($result, wdp_matrix_read_order((int) $arg1));
	} elseif ($cmd === 'plugin') {
		$result = array_merge($result, wdp_matrix_plugin($arg1 === 'off' ? 'off' : 'on'));
	} elseif ($cmd === 'checkpoint') {
		$result = array_merge($result, wdp_matrix_checkpoint());
	} else {
		$result['error'] = 'bilinmeyen cmd';
	}
} catch (Throwable $e) {
	$result['ok']    = false;
	$result['error'] = $e->getMessage();
}

echo wp_json_encode($result, JSON_UNESCAPED_UNICODE);
echo "\n";

<?php
/**
 * Yerel WP (yalnız yerel): eklenti aç/kapa + sahte üçüncü taraf eklentiyi etkinleştir. Uzak için KULLANILMAZ.
 *
 *   php tests/local-wp/eval-file.php tests/local-wp/plugin-toggle.php on|off|seed
 */
if (!function_exists('get_option')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}
require_once ABSPATH . 'wp-admin/includes/plugin.php';
$wdp_args = isset($wdp_eval_args) && is_array($wdp_eval_args) ? $wdp_eval_args : (isset($args) && is_array($args) ? $args : array());
$mode     = isset($wdp_args[0]) ? (string) $wdp_args[0] : '';
$ours     = 'woo-donation-popup/woo-donation-popup.php';
$third    = 'wdp-fake-third/wdp-fake-third.php';
$woo = 'woocommerce/woocommerce.php';
if (file_exists(WP_PLUGIN_DIR . '/' . $woo) && !is_plugin_active($woo)) {
	activate_plugin($woo);
}
if (file_exists(WP_PLUGIN_DIR . '/' . $third) && !is_plugin_active($third)) {
	activate_plugin($third);
}
if ($mode === 'seed') {
	// Yalnız geçici yerel WP: Woo sayfaları, HPOS, örnek ürün, bağış sayfası. Eklenti etkin DEĞİL (kısa kodlar ham kalır).
	$paths = array();
	if (class_exists('WC_Install') && function_exists('wc_get_page_id')) {
		if (wc_get_page_id('cart') < 1 || wc_get_page_id('checkout') < 1) {
			WC_Install::create_pages();
		}
		update_option('woocommerce_custom_orders_table_enabled', 'yes');
		$rel = static function ($url) {
			$p = (string) wp_parse_url((string) $url, PHP_URL_PATH);
			$q = (string) wp_parse_url((string) $url, PHP_URL_QUERY);
			return ($p === '' ? '/' : $p) . ($q !== '' ? '?' . $q : '');
		};
		$paths['cart']     = $rel(wc_get_cart_url());
		$paths['checkout'] = $rel(wc_get_checkout_url());
		if (class_exists('WC_Product_Simple')) {
			$product = new WC_Product_Simple();
			$product->set_name('Onoff Test Product');
			$product->set_regular_price('10');
			$product->set_status('publish');
			$pid = $product->save();
			$paths['product'] = $rel(get_permalink($pid));
		}
	}
	$page_id = wp_insert_post(
		array(
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_title'   => 'Onoff Donations',
			'post_content' => '[wdp_donations][wdp_donation_form][wdp_donation_button]',
		)
	);
	if ($page_id && !is_wp_error($page_id)) {
		$paths['donations'] = '/?page_id=' . (int) $page_id;
	}
	echo wp_json_encode(array('mode' => 'seed', 'paths' => $paths));
	exit(0);
}
if ($mode === 'on') {
	$res = activate_plugin($ours);
	if (is_wp_error($res)) {
		fwrite(STDERR, 'activate: ' . $res->get_error_message() . "\n");
		exit(1);
	}
} elseif ($mode === 'off') {
	deactivate_plugins($ours);
} else {
	fwrite(STDERR, "mode on|off|seed\n");
	exit(1);
}
echo wp_json_encode(array('mode' => $mode, 'active' => is_plugin_active($ours) ? 1 : 0));

<?php
/**
 * Ship sağlık URL’leri (genel): ana sayfa, mağaza, ilk gerçek ürün, kısa kod/blok sayfası, wp-admin.
 * Yazma yok. Siteye özel slug yok.
 */
if (!defined('ABSPATH')) {
	fwrite(STDERR, "ship-url-probe: WP yok\n");
	exit(1);
}

/**
 * @param int $id
 * @return string
 */
function wdp_ship_permalink($id) {
	if ($id <= 0) {
		return '';
	}
	$url = get_permalink($id);
	return is_string($url) ? $url : '';
}

$home    = function_exists('home_url') ? home_url('/') : '';
$shop_id = (int) get_option('woocommerce_shop_page_id');
$shop    = $shop_id > 0 ? wdp_ship_permalink($shop_id) : '';

$product_id = 0;
$product    = '';
$found      = get_posts(
	array(
		'post_type'   => 'product',
		'post_status' => 'publish',
		'numberposts' => 1,
		'fields'      => 'ids',
		'meta_query'  => array(
			array(
				'key'     => '_wdp_e2e_test',
				'compare' => 'NOT EXISTS',
			),
		),
	)
);
if ($found) {
	$product_id = (int) $found[0];
	$product    = wdp_ship_permalink($product_id);
}

global $wpdb;
$needles = array('[wdp_', 'wp:wdp', 'woo-donation', 'wdp-donation-form', 'wdp-donations', 'widgetType":"wdp-');
$likes   = array();
foreach ($needles as $n) {
	$likes[] = $wpdb->prepare('post_content LIKE %s', '%' . $wpdb->esc_like($n) . '%');
}
$plugin_id = (int) $wpdb->get_var(
	"SELECT ID FROM {$wpdb->posts} WHERE post_status = 'publish' AND post_type IN ('page','post') AND (" . implode(' OR ', $likes) . ') ORDER BY ID ASC LIMIT 1'
);
$plugin_page = $plugin_id > 0 ? wdp_ship_permalink($plugin_id) : '';
$admin       = function_exists('admin_url') ? admin_url('/') : '';

echo wp_json_encode(
	array(
		'home'           => $home,
		'shop'           => $shop,
		'shop_id'        => $shop_id,
		'product'        => $product,
		'product_id'     => $product_id,
		'plugin_page'    => $plugin_page,
		'plugin_page_id' => $plugin_id,
		'admin'          => $admin,
		'plugin_skipped' => $plugin_id > 0 ? 0 : 1,
	)
);

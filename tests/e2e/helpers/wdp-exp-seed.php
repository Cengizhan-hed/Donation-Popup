<?php
/**
 * Yalnız yerel e2e (E2C): "WDP E2E Addon" test ürününe işlem ücreti + ek bağış tanımlar, kimliğini yazar.
 * Ek bağış satırı ürünü: sabit tutarlı test ürünü (argüman 1). Başka ürüne dokunmaz.
 *
 *   php tests/local-wp/eval-file.php tests/e2e/helpers/wdp-exp-seed.php <fixedProductId>
 */
if (!function_exists('get_posts')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}
$args     = isset($wdp_eval_args) && is_array($wdp_eval_args) ? $wdp_eval_args : array_slice($argv, 2);
$fixed_id = isset($args[0]) ? absint($args[0]) : 0;
$found    = get_posts(
	array(
		'post_type'      => 'product',
		'post_status'    => 'any',
		'title'          => 'WDP E2E Addon',
		'meta_key'       => '_wdp_e2e_test',
		'posts_per_page' => 1,
		'fields'         => 'ids',
	)
);
$host     = $found ? (int) $found[0] : 0;
if ($host < 1 && $fixed_id > 0 && class_exists('WC_Product_Simple')) {
	// Test ürünü yoksa işaretli, gizli bir test ürünü oluşturulur (yalnız yerel e2e WP kopyası).
	$product = new WC_Product_Simple();
	$product->set_name('WDP E2E Addon');
	$product->set_status('publish');
	$product->set_catalog_visibility('hidden');
	$host = (int) $product->save();
	update_post_meta($host, '_wdp_e2e_test', '1');
	update_post_meta($host, '_wdp_donation_product', 'yes');
}
if ($host < 1 || $fixed_id < 1) {
	echo wp_json_encode(array( 'ok' => false, 'error' => 'ürün yok' ));
	exit(0);
}
$meta = array(
	'_enable_cover_fee'       => 'yes',
	'_cover_fee_percent'      => '5',
	'_enable_addon_donation'  => 'yes',
	'_addon_wc_product_id'    => (string) $fixed_id,
	'_addon_min_price'        => '20',
	'_addon_toggle_label'     => 'Sadaka ekle',
	'_addon_donation_message' => 'Ek bağış ayrı satır olarak eklenir.',
	'_allow_custom_price'     => 'yes',
	'_min_custom_price'       => '10',
);
foreach ($meta as $key => $value) {
	update_post_meta($host, $key, $value);
}
if (function_exists('wc_delete_product_transients')) {
	wc_delete_product_transients($host);
}
if (class_exists('WDP_Utils') && method_exists('WDP_Utils', 'invalidate_product_donation_caches')) {
	\DonationPanel\Domain\Campaign_Totals::invalidate_product_donation_caches($host);
}
echo wp_json_encode(array( 'ok' => true, 'id' => $host ));

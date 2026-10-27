<?php
/**
 * Yalnız yerel e2e WP kopyası: Liste tasarım ekranı için test ürünlerine kategori, ad ve kampanya verisi verir.
 *
 *   php tests/local-wp/eval-file.php tests/e2e/helpers/wdp-list-seed.php <campaignId> <sharesId> <customId> <fixedId>
 */
if (!function_exists('wc_get_product')) {
	fwrite(STDERR, "woocommerce missing\n");
	exit(1);
}
$args = isset($wdp_eval_args) && is_array($wdp_eval_args) ? $wdp_eval_args : array_slice($argv, 2);
$ids  = array(
	'campaign' => isset($args[0]) ? absint($args[0]) : 0,
	'shares'   => isset($args[1]) ? absint($args[1]) : 0,
	'custom'   => isset($args[2]) ? absint($args[2]) : 0,
	'fixed'    => isset($args[3]) ? absint($args[3]) : 0,
);
$terms = array(
	'campaign' => 'Su Kuyusu',
	'shares'   => 'Kurban',
	'custom'   => 'Eğitim',
	'fixed'    => 'Kurban',
);
$titles = array(
	'campaign' => 'Su Kuyusu Kampanyası',
	'shares'   => 'Adak Kurbanı',
	'custom'   => 'Genel Bağış',
	'fixed'    => 'Akika Kurbanı',
);
$out = array();
foreach ($ids as $kind => $id) {
	$product = $id > 0 ? wc_get_product($id) : null;
	if (!$product) {
		continue;
	}
	$product->set_name($titles[$kind]);
	$product->set_catalog_visibility('visible');
	$product->set_menu_order(array('campaign' => 1, 'shares' => 2, 'custom' => 3, 'fixed' => 4)[ $kind ]);
	$product->set_stock_status('instock');
	$product->set_status('publish');
	if ('campaign' === $kind) {
		$product->set_short_description('');
	} elseif ('shares' === $kind) {
		$product->set_short_description('Hisse başı · 24 saatte video');
	} elseif ('custom' === $kind) {
		$product->set_short_description('İhtiyacın en çok olduğu yere');
	}
	$product->save();
	$term = term_exists($terms[$kind], 'product_cat');
	if (!$term) {
		$term = wp_insert_term($terms[$kind], 'product_cat');
	}
	if (!is_wp_error($term)) {
		wp_set_object_terms($id, array((int) (is_array($term) ? $term['term_id'] : $term)), 'product_cat');
	}
	if ('campaign' === $kind) {
		update_post_meta($id, '_progress_bar_limit', '300000');
		update_post_meta($id, '_wdp_total_donation_amount', '184500');
		update_post_meta($id, '_wdp_donor_count', '412');
		update_post_meta($id, '_wdp_campaign_ends_at', gmdate('Y-m-d', time() + 17 * DAY_IN_SECONDS));
	}
	$out[ $kind ] = $id;
}
do_action('woocommerce_update_product', 0);
echo wp_json_encode(array('ok' => true, 'seeded' => $out));

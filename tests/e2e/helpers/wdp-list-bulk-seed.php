<?php
/**
 * Yalnız yerel e2e/ölçüm WP kopyası (tek kullanımlık işçi): gömülü kart formu bütçesi için liste tohumundaki dört bağış
 * ürününü (kampanya / hisse / serbest / sabit) çoğaltıp toplam N bağış ürünü yapar; adlar, fiyatlar ve kısa açıklama
 * ürün başına farklıdır (gerçekçi fark). Kategori: "Toplu Liste" (kısa kodda `category="toplu-liste"`).
 *
 *   php tests/local-wp/eval-file.php tests/e2e/helpers/wdp-list-bulk-seed.php <N> <campaignId> <sharesId> <customId> <fixedId>
 */
if (!function_exists('wc_get_product')) {
	fwrite(STDERR, "woocommerce missing\n");
	exit(1);
}
$args   = isset($wdp_eval_args) && is_array($wdp_eval_args) ? $wdp_eval_args : array_slice($argv, 2);
$target = isset($args[0]) ? max(1, min(200, absint($args[0]))) : 12;
$src    = array_values(array_filter(array_map('absint', array_slice($args, 1, 4))));
if (empty($src)) {
	echo wp_json_encode(array('ok' => false, 'error' => 'kaynak ürün yok'));
	exit(0);
}
$term = term_exists('Toplu Liste', 'product_cat');
if (!$term) {
	$term = wp_insert_term('Toplu Liste', 'product_cat', array('slug' => 'toplu-liste'));
}
$term_id = is_wp_error($term) ? 0 : (int) (is_array($term) ? $term['term_id'] : $term);
$existing = get_posts(
	array(
		'post_type'      => 'product',
		'post_status'    => 'publish',
		'posts_per_page' => -1,
		'fields'         => 'ids',
		'tax_query'      => array(array('taxonomy' => 'product_cat', 'field' => 'term_id', 'terms' => array($term_id))), // phpcs:ignore
	)
);
$made = count($existing);
$duplicator = class_exists('WC_Admin_Duplicate_Product') ? new WC_Admin_Duplicate_Product() : null;
if (null === $duplicator && is_file(WC_ABSPATH . 'includes/admin/class-wc-admin-duplicate-product.php')) {
	require_once WC_ABSPATH . 'includes/admin/class-wc-admin-duplicate-product.php';
	$duplicator = new WC_Admin_Duplicate_Product();
}
$names = array('Su Kuyusu', 'Yetim Destek', 'Gıda Kolisi', 'Eğitim Bursu', 'Kurban Hissesi', 'Sağlık Yardımı', 'Kışlık Yakacak', 'Çeşme', 'Kitap Bağışı', 'Acil Yardım');
for ($i = $made; $i < $target; $i++) {
	$base = wc_get_product($src[ $i % count($src) ]);
	if (!$base || null === $duplicator) {
		break;
	}
	$copy = $duplicator->product_duplicate($base);
	$copy->set_name($names[ $i % count($names) ] . ' ' . ($i + 1));
	$copy->set_status('publish');
	$copy->set_catalog_visibility('visible');
	$copy->set_menu_order(100 + $i);
	$copy->set_short_description('Toplu liste kartı ' . ($i + 1) . ' · ' . $names[ ($i + 3) % count($names) ]);
	if ((float) $base->get_regular_price() > 0) {
		$copy->set_regular_price((string) (25 * (1 + ($i % 17))));
	}
	$copy->save();
	wp_set_object_terms($copy->get_id(), array($term_id), 'product_cat');
	++$made;
}
do_action('woocommerce_update_product', 0);
echo wp_json_encode(array('ok' => true, 'count' => $made, 'term' => $term_id));

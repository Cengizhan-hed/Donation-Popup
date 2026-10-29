<?php
/**
 * Yalnız yerel e2e: yükleme kapsamı ölçümü için içerik tohumlar (mu-plugin, tek kullanımlık işçi veritabanı).
 * Blog yazısı, bağış listesi sayfası, bağış kapsamı dışı ürün. Tema/sayfa oluşturucu adı yok.
 * Çıktı: wp-content/wdp-scope-sim-urls.json
 */
add_action(
	'wp_loaded',
	static function () {
		$file = WP_CONTENT_DIR . '/wdp-scope-sim-urls.json';
		if (file_exists($file) || !function_exists('wc_get_product') || !function_exists('wc_get_page_permalink')) {
			return;
		}
		$path = static function ($url) {
			$p = wp_parse_url((string) $url);
			return (isset($p['path']) ? $p['path'] : '/') . (isset($p['query']) ? '?' . $p['query'] : '');
		};
		$post = wp_insert_post(array('post_title' => 'Scope blog', 'post_content' => 'Plain text.', 'post_status' => 'publish', 'post_type' => 'post'));
		$list = wp_insert_post(array('post_title' => 'Scope list', 'post_content' => '[wdp_donations]', 'post_status' => 'publish', 'post_type' => 'page'));
		$page = wp_insert_post(array('post_title' => 'Scope plain page', 'post_content' => 'Plain page.', 'post_status' => 'publish', 'post_type' => 'page'));
		// Compact kart sayfası (serbest tutarlı test bağış ürünü; yoksa ilk yayımlanmış ürün).
		$donation = get_posts(array('post_type' => 'product', 'post_status' => 'publish', 'title' => 'WDP E2E Custom', 'numberposts' => 1, 'fields' => 'ids'));
		if (!$donation) {
			$donation = get_posts(array('post_type' => 'product', 'post_status' => 'publish', 'numberposts' => 1, 'fields' => 'ids'));
		}
		$compact = wp_insert_post(array('post_title' => 'Scope compact card', 'post_content' => '[wdp_donation_form id="' . (int) ($donation ? $donation[0] : 0) . '" layout="compact"]', 'post_status' => 'publish', 'post_type' => 'page'));
		$full    = wp_insert_post(array('post_title' => 'Scope full form', 'post_content' => '[wdp_donation_form id="' . (int) ($donation ? $donation[0] : 0) . '"]', 'post_status' => 'publish', 'post_type' => 'page'));
		$prod = new WC_Product_Simple();
		$prod->set_name('Scope non donation');
		$prod->set_regular_price('10');
		$prod->set_status('publish');
		$prod->set_catalog_visibility('visible');
		$prod->save();
		update_post_meta($prod->get_id(), '_wdp_donation_product', 'no');
		file_put_contents(
			$file,
			wp_json_encode(
				array(
					'home'      => '/',
					'blog'      => $path(get_permalink($post)),
					'page'      => $path(get_permalink($page)),
					'list'      => $path(get_permalink($list)),
					'compact'   => $path(get_permalink($compact)),
					'fullform'  => $path(get_permalink($full)),
					'plainprod' => $path(get_permalink($prod->get_id())),
					'shop'      => $path(wc_get_page_permalink('shop')),
					'cart'      => $path(wc_get_page_permalink('cart')),
					'checkout'  => $path(wc_get_page_permalink('checkout')),
					'account'   => $path(wc_get_page_permalink('myaccount')),
					'plainprod_id' => $prod->get_id(),
				)
			)
		);
	},
	99
);

// Durum: wp-content/wdp-scope-sim.json {"none_donation":1} → hiçbir ürün bağış kapsamında değil (genel kanca).
$wdp_scope_state = json_decode((string) @file_get_contents(WP_CONTENT_DIR . '/wdp-scope-sim.json'), true);
if (is_array($wdp_scope_state) && !empty($wdp_scope_state['none_donation'])) {
	add_filter('wdp_is_donation_product', '__return_false', 99);
}

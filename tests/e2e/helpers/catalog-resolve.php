<?php
/**
 * Salt okunur E2E katalog: mağaza / sepet / ödeme / liste + bağış ürünleri.
 * Siteye özel slug yok. Yazma yok. WP-CLI eval-file veya yerel eval-file.php.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!function_exists('wdp_e2e_catalog_plugin_needles')) {
	/**
	 * @return string[]
	 */
	function wdp_e2e_catalog_plugin_needles() {
		return array('[wdp_', 'wp:wdp', 'woo-donation', 'wdp-donation-form', 'wdp-donations', 'widgetType":"wdp-');
	}

	/**
	 * @param mixed $text Content or builder JSON.
	 * @return bool
	 */
	function wdp_e2e_catalog_has_plugin_marker($text) {
		if (!is_string($text) || $text === '') {
			return false;
		}
		foreach (wdp_e2e_catalog_plugin_needles() as $n) {
			if (strpos($text, $n) !== false) {
				return true;
			}
		}
		return false;
	}

	/**
	 * WDP_Donation_Type::infer_from_meta ile aynı kural (sınıf yoksa yedek).
	 *
	 * @param array<string,string> $meta Meta map.
	 * @return string
	 */
	function wdp_e2e_catalog_infer_type(array $meta) {
		if (class_exists('WDP_Donation_Type')) {
			return WDP_Donation_Type::infer_from_meta($meta);
		}
		$yes = static function ($key) use ($meta) {
			return isset($meta[ $key ]) && $meta[ $key ] === 'yes';
		};
		if ($yes('_allow_multiple_shares')) {
			return 'shares';
		}
		if ($yes('_enable_progress_bar')) {
			return 'campaign';
		}
		if ($yes('_allow_custom_price')) {
			return 'custom';
		}
		return 'fixed';
	}

	/**
	 * @param mixed $url Permalink.
	 * @return string
	 */
	function wdp_e2e_catalog_path_from_url($url) {
		$url = is_string($url) ? trim($url) : '';
		if ($url === '') {
			return '';
		}
		if ($url[0] === '/') {
			return $url;
		}
		$path = function_exists('wp_parse_url')
			? wp_parse_url($url, PHP_URL_PATH)
			: parse_url($url, PHP_URL_PATH);
		return is_string($path) && $path !== '' ? $path : '';
	}
}

if (!function_exists('wdp_e2e_catalog_page_entry')) {
	/**
	 * @param int    $id  Post ID.
	 * @param string $url Permalink.
	 * @return array{id:int,url:string,path:string}
	 */
	function wdp_e2e_catalog_page_entry($id, $url) {
		$id  = (int) $id;
		$url = is_string($url) ? $url : '';
		return array(
			'id'   => $id,
			'url'  => $url,
			'path' => wdp_e2e_catalog_path_from_url($url),
		);
	}
}

if (!function_exists('wdp_e2e_catalog_resolve')) {
	/**
	 * @return array<string,mixed>
	 */
	function wdp_e2e_catalog_resolve() {
		$empty = array('id' => 0, 'url' => '', 'path' => '');
		$shop  = $empty;
		if (function_exists('wc_get_page_permalink')) {
			$url  = wc_get_page_permalink('shop');
			$id   = function_exists('get_option') ? (int) get_option('woocommerce_shop_page_id') : 0;
			$shop = wdp_e2e_catalog_page_entry($id, is_string($url) ? $url : '');
		}
		$cart = $empty;
		if (function_exists('wc_get_cart_url')) {
			$url  = wc_get_cart_url();
			$id   = function_exists('get_option') ? (int) get_option('woocommerce_cart_page_id') : 0;
			$cart = wdp_e2e_catalog_page_entry($id, is_string($url) ? $url : '');
		}
		$checkout = $empty;
		if (function_exists('wc_get_checkout_url')) {
			$url      = wc_get_checkout_url();
			$id       = function_exists('get_option') ? (int) get_option('woocommerce_checkout_page_id') : 0;
			$checkout = wdp_e2e_catalog_page_entry($id, is_string($url) ? $url : '');
		}

		$list = null;
		if (isset($GLOBALS['wpdb']) && is_object($GLOBALS['wpdb'])) {
			global $wpdb;
			$likes = array();
			foreach (wdp_e2e_catalog_plugin_needles() as $n) {
				$likes[] = $wpdb->prepare('p.post_content LIKE %s', '%' . $wpdb->esc_like($n) . '%');
				$likes[] = $wpdb->prepare('pm.meta_value LIKE %s', '%' . $wpdb->esc_like($n) . '%');
			}
			$sql     = "SELECT p.ID FROM {$wpdb->posts} p LEFT JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID WHERE p.post_status = 'publish' AND p.post_type IN ('page','post') AND (" . implode(' OR ', $likes) . ') GROUP BY p.ID ORDER BY p.ID ASC LIMIT 1';
			$list_id = (int) $wpdb->get_var($sql);
			if ($list_id > 0 && function_exists('get_permalink')) {
				$url  = get_permalink($list_id);
				$list = wdp_e2e_catalog_page_entry($list_id, is_string($url) ? $url : '');
			}
		}

		$products = array();
		if (function_exists('wc_get_products') && function_exists('wc_get_product')) {
			$ids = wc_get_products(
				array(
					'status'             => 'publish',
					'limit'              => -1,
					'return'             => 'ids',
					'orderby'            => 'ID',
					'order'              => 'ASC',
					'catalog_visibility' => array('visible', 'catalog'),
				)
			);
			if (!is_array($ids)) {
				$ids = array();
			}
			foreach ($ids as $id) {
				$id = (int) $id;
				if ($id <= 0) {
					continue;
				}
				if (function_exists('get_post_meta') && get_post_meta($id, '_wdp_e2e_test', true)) {
					continue;
				}
				$product = wc_get_product($id);
				if (!$product) {
					continue;
				}
				$vis = method_exists($product, 'get_catalog_visibility') ? (string) $product->get_catalog_visibility() : 'visible';
				if ($vis !== 'visible' && $vis !== 'catalog') {
					continue;
				}
				$is_donation = true;
				if (class_exists('WDP_Donation_Scope')) {
					$is_donation = WDP_Donation_Scope::is_donation_product($product);
				} elseif (method_exists($product, 'get_meta')) {
					$is_donation = $product->get_meta('_wdp_donation_product') === 'yes';
				}
				if (!$is_donation) {
					continue;
				}
				$meta = array(
					'_allow_custom_price'    => method_exists($product, 'get_meta') ? (string) $product->get_meta('_allow_custom_price') : '',
					'_allow_multiple_shares' => method_exists($product, 'get_meta') ? (string) $product->get_meta('_allow_multiple_shares') : '',
					'_enable_progress_bar'   => method_exists($product, 'get_meta') ? (string) $product->get_meta('_enable_progress_bar') : '',
				);
				$type = class_exists('WDP_Donation_Type')
					? WDP_Donation_Type::for_product($id)
					: wdp_e2e_catalog_infer_type($meta);
				$url  = function_exists('get_permalink') ? get_permalink($id) : '';
				$products[] = array(
					'id'         => $id,
					'slug'       => method_exists($product, 'get_slug') ? (string) $product->get_slug() : '',
					'title'      => method_exists($product, 'get_name') ? (string) $product->get_name() : '',
					'url'        => is_string($url) ? $url : '',
					'path'       => wdp_e2e_catalog_path_from_url(is_string($url) ? $url : ''),
					'type'       => $type,
					'visibility' => $vis,
					'status'     => 'publish',
					'fixture'    => false,
					'meta'       => $meta,
				);
			}
		}

		return array(
			'shop'     => $shop,
			'cart'     => $cart,
			'checkout' => $checkout,
			'list'     => $list,
			'products' => $products,
		);
	}
}

$wdp_e2e_catalog_should_emit = ((defined('WP_CLI') && WP_CLI) || !empty($GLOBALS['wdp_eval_target']))
	&& !defined('PHPUNIT_COMPOSER_INSTALL');
if ($wdp_e2e_catalog_should_emit && function_exists('wp_json_encode') && function_exists('get_option')) {
	echo wp_json_encode(wdp_e2e_catalog_resolve());
}

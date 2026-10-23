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
	 * WP-CLI eval-file `--explain` komut parametresi sanır (unknown --explain).
	 * Konumsal `explain` veya `WDP_E2E_CATALOG_EXPLAIN=1`. `--explain` yedek (yerel argv).
	 *
	 * @param mixed $args CLI args.
	 * @return bool
	 */
	function wdp_e2e_catalog_wants_explain($args = null) {
		$list = null;
		if (is_array($args)) {
			$list = $args;
		} elseif (isset($GLOBALS['wdp_eval_args']) && is_array($GLOBALS['wdp_eval_args'])) {
			$list = $GLOBALS['wdp_eval_args'];
		} elseif (isset($GLOBALS['argv']) && is_array($GLOBALS['argv'])) {
			$list = $GLOBALS['argv'];
		}
		if (is_array($list)) {
			foreach ($list as $a) {
				if (!is_scalar($a)) {
					continue;
				}
				$s = strtolower(trim((string) $a));
				if ($s === '--explain' || $s === 'explain') {
					return true;
				}
			}
		}
		return function_exists('getenv') && getenv('WDP_E2E_CATALOG_EXPLAIN') === '1';
	}

	/**
	 * Eklenti sıkı `yes` kuralı: açık/kapalı (ham değer yazılmaz).
	 *
	 * @param mixed $raw Meta.
	 * @return string
	 */
	function wdp_e2e_catalog_flag_state($raw) {
		return (is_string($raw) && $raw === 'yes') ? 'açık' : 'kapalı';
	}

	/**
	 * WDP_Donation_Type::infer_from_meta — sınıf yoksa aynı öncelik yedek.
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
	 * Tip: eklenti `for_product` (göç etmiş meta dahil); kopya yok.
	 *
	 * @param int                  $product_id Product ID.
	 * @param array<string,string> $meta       Flag map.
	 * @return string
	 */
	function wdp_e2e_catalog_detect_type($product_id, array $meta) {
		$id = (int) $product_id;
		if ($id > 0 && class_exists('WDP_Donation_Type') && method_exists('WDP_Donation_Type', 'for_product')) {
			return WDP_Donation_Type::for_product($id);
		}
		return wdp_e2e_catalog_infer_type($meta);
	}

	/**
	 * @param array<string,string> $meta Flag map (yes/other).
	 * @return array<string,string>
	 */
	function wdp_e2e_catalog_flag_states(array $meta) {
		$keys = array('_allow_multiple_shares', '_enable_progress_bar', '_allow_custom_price');
		$out  = array();
		foreach ($keys as $k) {
			$out[ $k ] = wdp_e2e_catalog_flag_state(isset($meta[ $k ]) ? $meta[ $k ] : '');
		}
		return $out;
	}

	/**
	 * @param string               $type     Role.
	 * @param array<string,string> $states   açık/kapalı.
	 * @param string               $resolver Class::method.
	 * @return string
	 */
	function wdp_e2e_catalog_type_why($type, array $states, $resolver) {
		$parts = array();
		foreach ($states as $k => $v) {
			$parts[] = $k . '=' . $v;
		}
		return (string) $resolver . '; öncelik shares→campaign→custom→fixed; ' . implode(', ', $parts) . '; sonuç=' . (string) $type;
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

	/**
	 * Ürün gezintisi: sorgu dizesi korunur (private permalink `?p=`).
	 *
	 * @param mixed $url Permalink.
	 * @return string
	 */
	function wdp_e2e_catalog_nav_target_from_url($url) {
		$url = is_string($url) ? trim($url) : '';
		if ($url === '') {
			return '';
		}
		if (isset($url[0]) && ($url[0] === '/' || $url[0] === '?')) {
			return $url[0] === '?' ? '/' . $url : $url;
		}
		$parts = function_exists('wp_parse_url') ? wp_parse_url($url) : parse_url($url);
		if (!is_array($parts)) {
			return '';
		}
		$path  = isset($parts['path']) && is_string($parts['path']) && $parts['path'] !== '' ? $parts['path'] : '/';
		$query = isset($parts['query']) && is_string($parts['query']) && $parts['query'] !== '' ? '?' . $parts['query'] : '';
		if (($path === '/' || $path === '') && $query === '') {
			return '/';
		}
		return $path . $query;
	}
}

if (!function_exists('wdp_e2e_catalog_type_meta')) {
	/**
	 * @param object $product WC_Product.
	 * @return array<string,string>
	 */
	function wdp_e2e_catalog_type_meta($product) {
		$keys = array('_allow_custom_price', '_allow_multiple_shares', '_enable_progress_bar');
		$meta = array();
		foreach ($keys as $k) {
			$meta[ $k ] = method_exists($product, 'get_meta') ? (string) $product->get_meta($k) : '';
		}
		return $meta;
	}

	/**
	 * @param object $product WC_Product.
	 * @return bool
	 */
	function wdp_e2e_catalog_is_donation($product) {
		if (class_exists('WDP_Donation_Scope')) {
			return (bool) WDP_Donation_Scope::is_donation_product($product);
		}
		return method_exists($product, 'get_meta') && $product->get_meta('_wdp_donation_product') === 'yes';
	}

	/**
	 * Woo related + upsell ID (salt okunur; müşteri/sipariş yok).
	 *
	 * @param object $product WC_Product.
	 * @return array{related_ids:int[],upsell_ids:int[]}
	 */
	function wdp_e2e_catalog_related_ids($product) {
		$id = (method_exists($product, 'get_id')) ? (int) $product->get_id() : 0;
		$related = array();
		if ($id > 0 && function_exists('wc_get_related_products')) {
			$raw = wc_get_related_products($id, 12);
			$related = is_array($raw) ? array_map('intval', $raw) : array();
		} elseif (method_exists($product, 'get_related')) {
			$raw     = $product->get_related(12);
			$related = is_array($raw) ? array_map('intval', $raw) : array();
		}
		$upsell = array();
		if (method_exists($product, 'get_upsell_ids')) {
			$raw    = $product->get_upsell_ids();
			$upsell = is_array($raw) ? array_map('intval', $raw) : array();
		}
		$keep = static function ($n) use ($id) {
			$n = (int) $n;
			return $n > 0 && $n !== $id;
		};
		return array(
			'related_ids' => array_values(array_unique(array_filter($related, $keep))),
			'upsell_ids'  => array_values(array_unique(array_filter($upsell, $keep))),
		);
	}

	/**
	 * Ürün sayfası görünümü: eklenti çözümleyicisi (kısa kod / auto_place + placement).
	 *
	 * @param object $product WC_Product.
	 * @return string inline|button_popup|button_panel|''
	 */
	function wdp_e2e_catalog_product_display($product) {
		if (class_exists('WDP_Product_Page_Integration') && method_exists('WDP_Product_Page_Integration', 'resolve_product_page_display')) {
			return (string) WDP_Product_Page_Integration::resolve_product_page_display($product);
		}
		if (class_exists('WDP_Placement_Settings')) {
			return (string) WDP_Placement_Settings::value('display', 'button_panel');
		}
		return '';
	}

	/**
	 * Yayımlanmış ürünler (görünürlük süzgeci yok — explain + katalog kaynağı).
	 *
	 * @return array<int,array<string,mixed>>
	 */
	function wdp_e2e_catalog_published_products() {
		static $cached = null;
		if (is_array($cached)) {
			return $cached;
		}
		$out = array();
		if (!function_exists('wc_get_products') || !function_exists('wc_get_product')) {
			$cached = $out;
			return $out;
		}
		$ids = wc_get_products(
			array(
				'status'  => 'publish',
				'limit'   => -1,
				'return'  => 'ids',
				'orderby' => 'ID',
				'order'   => 'ASC',
			)
		);
		if (!is_array($ids)) {
			$ids = array();
		}
		// İşaretli private fixture (salt okunur related/upsell; rol seçimine girmez).
		if (function_exists('get_posts')) {
			$fx = get_posts(
				array(
					'post_type'              => 'product',
					'post_status'            => 'private',
					'meta_key'               => '_wdp_e2e_test',
					'meta_compare'           => 'EXISTS',
					'fields'                 => 'ids',
					'posts_per_page'         => 40,
					'orderby'                => 'ID',
					'order'                  => 'ASC',
					'no_found_rows'          => true,
					'update_post_meta_cache' => false,
					'update_post_term_cache' => false,
				)
			);
			if (is_array($fx)) {
				$ids = array_values(array_unique(array_merge(array_map('intval', $ids), array_map('intval', $fx))));
			}
		}
		if (!$ids) {
			$cached = $out;
			return $out;
		}
		$resolver = class_exists('WDP_Donation_Type') ? 'WDP_Donation_Type::for_product' : 'yedek infer_from_meta';
		foreach ($ids as $id) {
			$id = (int) $id;
			if ($id <= 0) {
				continue;
			}
			$product = wc_get_product($id);
			if (!$product) {
				continue;
			}
			$meta   = wdp_e2e_catalog_type_meta($product);
			$type   = wdp_e2e_catalog_detect_type($id, $meta);
			$states = wdp_e2e_catalog_flag_states($meta);
			$url     = function_exists('get_permalink') ? get_permalink($id) : '';
			$url     = is_string($url) ? $url : '';
			$related = wdp_e2e_catalog_related_ids($product);
			$out[]   = array(
				'id'          => $id,
				'slug'        => method_exists($product, 'get_slug') ? (string) $product->get_slug() : '',
				'title'       => method_exists($product, 'get_name') ? (string) $product->get_name() : '',
				'url'         => $url,
				'path'        => wdp_e2e_catalog_path_from_url($url),
				'type'        => $type,
				'visibility'  => method_exists($product, 'get_catalog_visibility') ? (string) $product->get_catalog_visibility() : '',
				'status'      => method_exists($product, 'get_status') ? (string) $product->get_status() : 'publish',
				'purchasable' => method_exists($product, 'is_purchasable') ? (bool) $product->is_purchasable() : false,
				'wc_type'     => method_exists($product, 'get_type') ? (string) $product->get_type() : '',
				'donation'    => wdp_e2e_catalog_is_donation($product),
				'display'     => wdp_e2e_catalog_product_display($product),
				'related_ids' => $related['related_ids'],
				'upsell_ids'  => $related['upsell_ids'],
				'fixture'     => function_exists('get_post_meta') && (bool) get_post_meta($id, '_wdp_e2e_test', true),
				'resolver'    => $resolver,
				'flags'       => $states,
				'why'         => wdp_e2e_catalog_type_why($type, $states, $resolver),
				'meta'        => $meta,
			);
		}
		$cached = $out;
		return $out;
	}

	/**
	 * --explain: tüm yayımlanmış ürünler (müşteri/sipariş yok; meta değer yok).
	 *
	 * @return array<string,mixed>
	 */
	function wdp_e2e_catalog_explain() {
		$catalog = wdp_e2e_catalog_resolve();
		$rows    = array();
		foreach (wdp_e2e_catalog_published_products() as $row) {
			unset($row['meta'], $row['url']);
			$rows[] = $row;
		}
		$picked = array();
		foreach ($catalog['products'] as $p) {
			unset($p['meta'], $p['url']);
			$picked[] = $p;
		}
		return array(
			'explain'        => true,
			'resolver'       => class_exists('WDP_Donation_Type') ? 'WDP_Donation_Type::for_product' : 'yedek infer_from_meta',
			'plugin_loaded'  => class_exists('WDP_Donation_Type'),
			'shop'           => $catalog['shop'],
			'cart'           => $catalog['cart'],
			'checkout'       => $catalog['checkout'],
			'list'           => $catalog['list'],
			'picked'         => $picked,
			'published'      => $rows,
			'publishedCount' => count($rows),
			'pickedCount'    => count($picked),
		);
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

		$products         = array();
		$fixture_related  = array();
		foreach (wdp_e2e_catalog_published_products() as $row) {
			if (!empty($row['fixture'])) {
				$fid = (int) $row['id'];
				if ($fid > 0) {
					$fixture_related[ (string) $fid ] = array(
						'related_ids' => isset($row['related_ids']) && is_array($row['related_ids']) ? $row['related_ids'] : array(),
						'upsell_ids'  => isset($row['upsell_ids']) && is_array($row['upsell_ids']) ? $row['upsell_ids'] : array(),
					);
				}
				continue;
			}
			if (empty($row['donation'])) {
				continue;
			}
			$vis = (string) $row['visibility'];
			if ($vis !== 'visible' && $vis !== 'catalog') {
				continue;
			}
			$products[] = array(
				'id'          => $row['id'],
				'slug'        => $row['slug'],
				'title'       => $row['title'],
				'url'         => $row['url'],
				'path'        => $row['path'],
				'type'        => $row['type'],
				'visibility'  => $vis,
				'status'      => $row['status'],
				'purchasable' => !empty($row['purchasable']),
				'display'     => isset($row['display']) ? (string) $row['display'] : '',
				'related_ids' => isset($row['related_ids']) && is_array($row['related_ids']) ? $row['related_ids'] : array(),
				'upsell_ids'  => isset($row['upsell_ids']) && is_array($row['upsell_ids']) ? $row['upsell_ids'] : array(),
				'fixture'     => false,
				'meta'        => $row['meta'],
			);
		}

		return array(
			'shop'             => $shop,
			'cart'             => $cart,
			'checkout'         => $checkout,
			'list'             => $list,
			'products'         => $products,
			'fixture_related'  => $fixture_related,
		);
	}
}

$wdp_e2e_catalog_cli_args = array();
if (isset($args) && is_array($args)) {
	$wdp_e2e_catalog_cli_args = $args;
} elseif (!empty($GLOBALS['wdp_eval_args']) && is_array($GLOBALS['wdp_eval_args'])) {
	$wdp_e2e_catalog_cli_args = $GLOBALS['wdp_eval_args'];
}

$wdp_e2e_catalog_should_emit = ((defined('WP_CLI') && WP_CLI) || !empty($GLOBALS['wdp_eval_target']))
	&& !defined('PHPUNIT_COMPOSER_INSTALL');
if ($wdp_e2e_catalog_should_emit && function_exists('wp_json_encode') && function_exists('get_option')) {
	$payload = wdp_e2e_catalog_wants_explain($wdp_e2e_catalog_cli_args)
		? wdp_e2e_catalog_explain()
		: wdp_e2e_catalog_resolve();
	echo wp_json_encode($payload);
}

<?php
/**
 * Yerel WP ürün meta / fiyat / sepet (SSH yok).
 *
 *   php tests/local-wp/eval-file.php tests/local-wp/product-meta.php <cmd> ...
 *
 * cmd: get | set | prices-get | prices-set | cart-info | related-ids | bump-list | invalidate
 */
if (!function_exists('get_post_meta')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}

$args = isset($wdp_eval_args) && is_array($wdp_eval_args) ? $wdp_eval_args : array_slice($argv, 2);
$cmd  = isset($args[0]) ? (string) $args[0] : '';

function wdp_local_meta_key($raw) {
	$key = (string) $raw;
	if (!preg_match('/^[a-zA-Z0-9_]+$/', $key)) {
		throw new InvalidArgumentException('meta key geçersiz');
	}
	return $key;
}

function wdp_local_product_id($raw) {
	$id = absint($raw);
	if ($id <= 0) {
		throw new InvalidArgumentException('product id geçersiz');
	}
	return $id;
}

function wdp_local_invalidate($id) {
	if (class_exists('WDP_Utils') && method_exists('WDP_Utils', 'invalidate_product_donation_caches')) {
		WDP_Utils::invalidate_product_donation_caches($id);
	}
	if (function_exists('wc_delete_product_transients')) {
		wc_delete_product_transients($id);
	}
	if (function_exists('clean_post_cache')) {
		clean_post_cache($id);
	}
	if (function_exists('wp_cache_delete')) {
		wp_cache_delete('wdp_donor_count_' . $id, 'wdp_donations');
		wp_cache_delete('wdp_total_donation_' . $id, 'wdp_donations');
	}
}

$result = array( 'ok' => false, 'cmd' => $cmd );

try {
	if ($cmd === 'get') {
		$id  = wdp_local_product_id(isset($args[1]) ? $args[1] : 0);
		$key = wdp_local_meta_key(isset($args[2]) ? $args[2] : '');
		$result = array(
			'ok'    => true,
			'id'    => $id,
			'key'   => $key,
			'value' => (string) get_post_meta($id, $key, true),
		);
	} elseif ($cmd === 'set') {
		$id  = wdp_local_product_id(isset($args[1]) ? $args[1] : 0);
		$key = wdp_local_meta_key(isset($args[2]) ? $args[2] : '');
		$raw = isset($args[3]) ? (string) $args[3] : '""';
		$decoded = json_decode($raw, true);
		if ($raw !== '' && $raw !== 'null' && json_last_error() !== JSON_ERROR_NONE) {
			$value = $raw;
		} else {
			$value = $decoded;
		}
		if ($value === '' || $value === null) {
			delete_post_meta($id, $key);
		} else {
			update_post_meta($id, $key, is_scalar($value) ? (string) $value : $value);
		}
		wdp_local_invalidate($id);
		$result = array(
			'ok'    => true,
			'id'    => $id,
			'key'   => $key,
			'value' => (string) get_post_meta($id, $key, true),
		);
	} elseif ($cmd === 'prices-get') {
		$id = wdp_local_product_id(isset($args[1]) ? $args[1] : 0);
		if (!function_exists('wc_get_product')) {
			throw new RuntimeException('WooCommerce yok');
		}
		$p = wc_get_product($id);
		if (!$p) {
			throw new RuntimeException('ürün yok');
		}
		$result = array(
			'ok'      => true,
			'id'      => $id,
			'price'   => (string) $p->get_price(),
			'regular' => (string) $p->get_regular_price(),
			'sale'    => (string) $p->get_sale_price(),
		);
	} elseif ($cmd === 'prices-set') {
		$id = wdp_local_product_id(isset($args[1]) ? $args[1] : 0);
		$raw = isset($args[2]) ? (string) $args[2] : '{}';
		$amounts = json_decode($raw, true);
		if (!is_array($amounts)) {
			throw new RuntimeException('prices JSON yok');
		}
		if (!function_exists('wc_get_product')) {
			throw new RuntimeException('WooCommerce yok');
		}
		$p = wc_get_product($id);
		if (!$p) {
			throw new RuntimeException('ürün yok');
		}
		$price   = isset($amounts['price']) ? (string) $amounts['price'] : '';
		$regular = isset($amounts['regular']) ? (string) $amounts['regular'] : $price;
		$sale    = isset($amounts['sale']) ? (string) $amounts['sale'] : '';
		$p->set_regular_price($regular);
		$p->set_sale_price($sale);
		$p->set_price($price);
		$p->save();
		wdp_local_invalidate($id);
		$result = array(
			'ok'      => true,
			'id'      => $id,
			'price'   => (string) $p->get_price(),
			'regular' => (string) $p->get_regular_price(),
			'sale'    => (string) $p->get_sale_price(),
		);
	} elseif ($cmd === 'cart-info') {
		$id  = function_exists('wc_get_page_id') ? (int) wc_get_page_id('cart') : 0;
		$url = function_exists('wc_get_cart_url') ? (string) wc_get_cart_url() : '';
		$result = array(
			'ok'        => true,
			'id'        => $id,
			'url'       => $url,
			'status'    => $id ? (string) get_post_status($id) : '',
			'permalink' => $id ? (string) get_permalink($id) : '',
		);
	} elseif ($cmd === 'pages-info') {
		$cart_id     = function_exists('wc_get_page_id') ? (int) wc_get_page_id('cart') : 0;
		$checkout_id = function_exists('wc_get_page_id') ? (int) wc_get_page_id('checkout') : 0;
		$shop_id     = function_exists('wc_get_page_id') ? (int) wc_get_page_id('shop') : 0;
		$result      = array(
			'ok'       => true,
			'cart'     => array(
				'id'     => $cart_id,
				'url'    => function_exists('wc_get_cart_url') ? (string) wc_get_cart_url() : '',
				'status' => $cart_id ? (string) get_post_status($cart_id) : '',
			),
			'checkout' => array(
				'id'     => $checkout_id,
				'url'    => function_exists('wc_get_checkout_url') ? (string) wc_get_checkout_url() : '',
				'status' => $checkout_id ? (string) get_post_status($checkout_id) : '',
			),
			'shop'     => array(
				'id'     => $shop_id,
				'url'    => function_exists('wc_get_page_permalink') ? (string) wc_get_page_permalink('shop') : '',
				'status' => $shop_id ? (string) get_post_status($shop_id) : '',
			),
		);
	} elseif ($cmd === 'related-ids') {
		$id = wdp_local_product_id(isset($args[1]) ? $args[1] : 0);
		if (!function_exists('wc_get_product')) {
			throw new RuntimeException('WooCommerce yok');
		}
		$p = wc_get_product($id);
		if (!$p) {
			throw new RuntimeException('ürün yok');
		}
		$related = function_exists('wc_get_related_products')
			? array_map('intval', wc_get_related_products($id, 12))
			: array();
		$upsell = method_exists($p, 'get_upsell_ids') ? array_map('intval', $p->get_upsell_ids()) : array();
		$result = array(
			'ok'      => true,
			'id'      => $id,
			'related' => array_values(array_filter($related)),
			'upsell'  => array_values(array_filter($upsell)),
		);
	} elseif ($cmd === 'bump-list') {
		if (class_exists('WDP_Donations_List')) {
			if (method_exists('WDP_Donations_List', 'reset_bump_guard')) {
				WDP_Donations_List::reset_bump_guard();
			}
			if (method_exists('WDP_Donations_List', 'bump_cache')) {
				WDP_Donations_List::bump_cache();
			}
		}
		$result = array( 'ok' => true );
	} elseif ($cmd === 'invalidate') {
		$id = wdp_local_product_id(isset($args[1]) ? $args[1] : 0);
		wdp_local_invalidate($id);
		$result = array( 'ok' => true, 'id' => $id );
	} else {
		$result['error'] = 'bilinmeyen cmd';
	}
} catch (Throwable $e) {
	$result['ok']    = false;
	$result['error'] = $e->getMessage();
}

echo wp_json_encode($result, JSON_UNESCAPED_UNICODE);
echo "\n";

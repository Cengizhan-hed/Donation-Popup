<?php
/**
 * Salt okunur alt bağış (sadaka) yapılandırması. Tarayıcı yok.
 * Arg 0: ürün ID. Müşteri/sipariş yok; meta değerleri yalnız sayı/bayrak.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!function_exists('get_post_meta')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}

$args       = isset($wdp_eval_args) && is_array($wdp_eval_args) ? $wdp_eval_args : (isset($args) && is_array($args) ? $args : array_slice($argv, 2));
$product_id = absint(isset($args[0]) ? $args[0] : 0);

$enabled      = false;
$product_wc   = 0;
$global_wc    = 0;
$resolved_wc  = 0;

if (class_exists('WDP_Utils')) {
	$global_wc = (int) WDP_Utils::get_default_sadaka_wc_product_id();
	if ($product_id > 0) {
		$product_wc = (int) WDP_Utils::get_configured_sadaka_wc_product_id($product_id);
		if ($product_wc === $global_wc) {
			$per = 0;
			$p   = function_exists('wc_get_product') ? wc_get_product($product_id) : null;
			if ($p && method_exists($p, 'get_meta')) {
				$per = absint($p->get_meta('_sadaka_wc_product_id'));
			}
			$product_wc = $per;
		}
	}
} else {
	$settings  = function_exists('get_option') ? get_option('wdp_success_settings', array()) : array();
	$global_wc = is_array($settings) && !empty($settings['sadaka_wc_product_id'])
		? absint($settings['sadaka_wc_product_id'])
		: 0;
	if ($product_id > 0) {
		$product_wc = absint(get_post_meta($product_id, '_sadaka_wc_product_id', true));
	}
}

if ($product_id > 0) {
	$flag    = strtolower((string) get_post_meta($product_id, '_enable_sadaka_donation', true));
	$enabled = ($flag === 'yes' || $flag === '1');
}

$resolved_wc = $product_wc > 0 ? $product_wc : $global_wc;

$reason = '';
$status = 'beklenir';
if (!$enabled) {
	$status = 'atlandı';
	$reason = 'setting-off';
} elseif ($resolved_wc <= 0) {
	$status = 'atlandı';
	$reason = 'no-wc-product-id';
} else {
	$reason = 'beklenir';
}

$payload = array(
	'ok'           => true,
	'enabled'      => $enabled,
	'productWcId'  => $product_wc,
	'globalWcId'   => $global_wc,
	'resolvedWcId' => $resolved_wc,
	'expected'     => $status === 'beklenir',
	'status'       => $status,
	'reason'       => $reason,
	'evidence'     => $status === 'atlandı' ? 'wp-data' : '',
	'detail'       => 'enable=' . ($enabled ? '1' : '0') . ' ürün_id=' . $product_wc . ' genel_id=' . $global_wc,
);

if (function_exists('wp_json_encode')) {
	echo wp_json_encode($payload);
} else {
	echo json_encode($payload);
}
echo "\n";

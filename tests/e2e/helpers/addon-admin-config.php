<?php
/**
 * Salt okunur alt bağış (addon) yapılandırması. Tarayıcı yok.
 * Arg 0: ürün ID. Müşteri/sipariş yok; meta değerleri yalnız sayı/bayrak.
 *
 * @package DonationPanel
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
	$global_wc = (int) \DonationPanel\Domain\Addon_Settings::get_default_addon_wc_product_id();
	if ($product_id > 0) {
		$product_wc = (int) \DonationPanel\Domain\Addon_Settings::get_configured_addon_wc_product_id($product_id);
		if ($product_wc === $global_wc) {
			$per = 0;
			$p   = function_exists('wc_get_product') ? wc_get_product($product_id) : null;
			if ($p && method_exists($p, 'get_meta')) {
				$per = absint(\DonationPanel\Domain\Addon_Product_Visibility::get_meta($p, '_addon_wc_product_id'));
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
		$product_wc = absint(\DonationPanel\Domain\Addon_Product_Visibility::get_meta($product_id, '_addon_wc_product_id'));
	}
}

if ($product_id > 0) {
	$flag    = strtolower((string) \DonationPanel\Domain\Addon_Product_Visibility::get_meta($product_id, '_enable_addon_donation'));
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

<?php
/**
 * Yalnız yerel e2e (12.4 email4): verilen siparişin fatura e-postası ve bağışçı kalemi e-postası (yalnız yerel test verisi).
 *
 *   php tests/local-wp/eval-file.php tests/e2e/helpers/wdp-order-email.php '<sipariş kimliği>'
 */
if (!function_exists('wc_get_order')) {
	fwrite(STDERR, "woocommerce missing\n");
	exit(1);
}
$args  = isset($wdp_eval_args) && is_array($wdp_eval_args) ? $wdp_eval_args : array_slice($argv, 2);
$order = wc_get_order((int) ( isset($args[0]) ? $args[0] : 0 ));
if (!$order) {
	echo wp_json_encode(array( 'ok' => false ));
	echo "\n";
	return;
}
$item_email = '';
foreach ($order->get_items() as $item) {
	$item_email = (string) $item->get_meta('wdp_donor_email');
}
echo wp_json_encode(
	array(
		'ok'      => true,
		'billing' => (string) $order->get_billing_email(),
		'item'    => $item_email,
	)
);
echo "\n";

<?php
/**
 * Yalnız _wdp_e2e_test=1 işaretli siparişler ve @wdp-e2e.test e-postalı müşteriler.
 * HPOS uyumlu. Gerçek kayıtlara dokunmaz. Hata → exit 1.
 *
 * Kullanım: wp eval-file tests/e2e/helpers/cleanup-e2e.php
 * Ortam: WDP_E2E_GUARD_ORDER_ID (silinmemesi gereken örnek sipariş, isteğe bağlı)
 */
if (!function_exists('wc_get_orders')) {
	fwrite(STDERR, "woocommerce missing\n");
	exit(1);
}

const META_KEY = '_wdp_e2e_test';
const EMAIL_NEEDLE = '@wdp-e2e.test';

$guard_id = absint(getenv('WDP_E2E_GUARD_ORDER_ID'));

$orders = wc_get_orders(
	array(
		'limit'        => -1,
		'status'       => array_keys(wc_get_order_statuses()),
		'meta_key'     => META_KEY,
		'meta_value'   => '1',
		'return'       => 'ids',
	)
);
if (!is_array($orders)) {
	$orders = array();
}

$deleted_orders = array();
$failed = array();
foreach ($orders as $oid) {
	$oid = absint($oid);
	if ($oid <= 0) {
		continue;
	}
	if ($guard_id && $oid === $guard_id) {
		$failed[] = "guard order matched e2e meta: {$oid}";
		continue;
	}
	$order = wc_get_order($oid);
	if (!$order) {
		$failed[] = "missing order {$oid}";
		continue;
	}
	$email = strtolower((string) $order->get_billing_email());
	if ($EMAIL_NEEDLE && strpos($email, $EMAIL_NEEDLE) === false) {
		$failed[] = "order {$oid} has e2e meta but email is not tagged; skipped";
		continue;
	}
	$ok = $order->delete(true);
	if ($ok === false) {
		$failed[] = "delete failed {$oid}";
		continue;
	}
	$deleted_orders[] = $oid;
}

$users = get_users(
	array(
		'search'         => '*' . $EMAIL_NEEDLE,
		'search_columns' => array('user_email'),
		'fields'         => array('ID', 'user_email'),
		'number'         => 200,
	)
);
$deleted_customers = array();
foreach ($users as $u) {
	$email = strtolower((string) $u->user_email);
	if (strpos($email, $EMAIL_NEEDLE) === false) {
		continue;
	}
	$res = wp_delete_user((int) $u->ID);
	if (!$res) {
		$failed[] = "customer delete failed {$u->ID}";
		continue;
	}
	$deleted_customers[] = (int) $u->ID;
}

$guard_ok = true;
if ($guard_id) {
	$still = wc_get_order($guard_id);
	$guard_ok = (bool) $still;
	if (!$guard_ok) {
		$failed[] = "guard order {$guard_id} missing after cleanup";
	}
}

$out = array(
	'orders_deleted'     => count($deleted_orders),
	'customers_deleted'  => count($deleted_customers),
	'guard_ok'           => $guard_ok,
	'failed'             => $failed,
);
echo wp_json_encode($out);
if (!empty($failed)) {
	exit(1);
}

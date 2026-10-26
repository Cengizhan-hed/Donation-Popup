<?php
/**
 * Yalnız yerel e2e (12-d): işaretli test müşterisi oluşturur/günceller ve oturum çerezlerini yazar.
 *
 *   php tests/local-wp/eval-file.php tests/e2e/helpers/wdp-checkout-prefill-user.php '<json: first,last,phone,email>'
 */
if (!function_exists('get_user_by') || !class_exists('WC_Customer')) {
	fwrite(STDERR, "wordpress/woocommerce missing\n");
	exit(1);
}
$args   = isset($wdp_eval_args) && is_array($wdp_eval_args) ? $wdp_eval_args : array_slice($argv, 2);
$wanted = isset($args[0]) ? json_decode((string) $args[0], true) : array();
$wanted = is_array($wanted) ? $wanted : array();
$login  = 'wdp_e2e_prefill';
$user   = get_user_by('login', $login);
if (!$user) {
	$id = wp_insert_user(
		array(
			'user_login' => $login,
			'user_pass'  => wp_generate_password(24),
			'user_email' => 'wdp-e2e-prefill@wdp-e2e.test',
			'role'       => 'customer',
		)
	);
	if (is_wp_error($id)) {
		echo wp_json_encode(array( 'ok' => false, 'error' => 'kullanıcı oluşturulamadı' ));
		return;
	}
	update_user_meta($id, '_wdp_e2e_test', '1');
	$user = get_user_by('id', $id);
}
$uid      = (int) $user->ID;
$customer = new WC_Customer($uid);
foreach (array( 'first_name', 'last_name', 'phone', 'email' ) as $key) {
	$customer->{'set_billing_' . $key}(isset($wanted[ $key ]) ? (string) $wanted[ $key ] : '');
}
$customer->save();
$exp = time() + DAY_IN_SECONDS;
echo wp_json_encode(
	array(
		'ok'             => true,
		'logged_in_name' => LOGGED_IN_COOKIE,
		'logged_in'      => wp_generate_auth_cookie($uid, $exp, 'logged_in'),
		'auth_name'      => AUTH_COOKIE,
		'auth'           => wp_generate_auth_cookie($uid, $exp, 'auth'),
	)
);
echo "\n";

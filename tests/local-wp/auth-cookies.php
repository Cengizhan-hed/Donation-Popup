<?php
/**
 * Yerel WP yönetici oturum çerezleri (şifre yok). Değerler çağıran JSON okur; loglanmaz.
 */
$user = get_user_by('login', 'admin');
if (!$user) {
	echo wp_json_encode(array( 'ok' => false, 'error' => 'admin yok' ));
	return;
}
$id  = (int) $user->ID;
$exp = time() + WEEK_IN_SECONDS;
echo wp_json_encode(
	array(
		'ok'               => true,
		'logged_in_name'   => LOGGED_IN_COOKIE,
		'logged_in'        => wp_generate_auth_cookie($id, $exp, 'logged_in'),
		'auth_name'        => AUTH_COOKIE,
		'auth'             => wp_generate_auth_cookie($id, $exp, 'auth'),
		'secure_auth_name' => SECURE_AUTH_COOKIE,
		'secure_auth'      => wp_generate_auth_cookie($id, $exp, 'secure_auth'),
	)
);
echo "\n";

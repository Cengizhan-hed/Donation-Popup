<?php
/**
 * wpCliAuth çerezi (yalnız HTTP sağlık). Değer konsola/rapora yazılmaz — çağıran yutar.
 * Yazma yok.
 */
if (!defined('ABSPATH')) {
	fwrite(STDERR, "ship-auth: WP yok\n");
	exit(1);
}
$users = get_users(
	array(
		'role'   => 'administrator',
		'number' => 1,
		'fields' => 'ID',
	)
);
$id = $users ? (int) $users[0] : 0;
if ($id <= 0 || !function_exists('wp_generate_auth_cookie')) {
	echo wp_json_encode(array('ok' => 0));
	return;
}
$exp = time() + WEEK_IN_SECONDS;
echo wp_json_encode(
	array(
		'ok'             => 1,
		'logged_in_name' => LOGGED_IN_COOKIE,
		'logged_in'      => wp_generate_auth_cookie($id, $exp, 'logged_in'),
		'auth_name'      => AUTH_COOKIE,
		'auth'           => wp_generate_auth_cookie($id, $exp, 'auth'),
	)
);

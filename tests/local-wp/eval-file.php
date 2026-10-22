<?php
/**
 * Yerel WP: wp-load + eval-file. Uzak bağlantı yok.
 *
 *   php tests/local-wp/eval-file.php tests/e2e/helpers/cleanup-e2e.php
 */
$root = dirname(__DIR__, 2);
$env_dir = getenv('WDP_LOCAL_WP_DIR');
$wp_dir  = ($env_dir && is_file(rtrim($env_dir, '/') . '/wp-load.php'))
	? rtrim($env_dir, '/')
	: $root . '/build/local-wp/wordpress';
if (!is_file($wp_dir . '/wp-load.php')) {
	fwrite(STDERR, "yerel WordPress yok; npm run local-wp:ensure\n");
	exit(2);
}
$target = isset($argv[1]) ? $argv[1] : '';
if ($target === '' || !is_file($root . '/' . $target) && !is_file($target)) {
	fwrite(STDERR, "eval-file hedefi yok\n");
	exit(1);
}
// WP 7.1 pages.php foreach ($file) sızıntısı — çağıran kapsamı ezmesin.
// Tek köprü: $wdp_eval_target / $wdp_eval_args (wp-load öncesi). $args yedek.
$wdp_eval_target = is_file($target) ? $target : $root . '/' . $target;
$wdp_eval_args   = array_slice($argv, 2);
if (empty($_SERVER['HTTP_HOST'])) {
	$_SERVER['HTTP_HOST']   = '127.0.0.1';
	$_SERVER['SERVER_NAME'] = '127.0.0.1';
	$_SERVER['REQUEST_URI'] = '/';
}
require $wp_dir . '/wp-load.php';
$args = $wdp_eval_args;
require $wdp_eval_target;

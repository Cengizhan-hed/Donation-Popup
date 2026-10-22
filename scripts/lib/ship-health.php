<?php
/**
 * Ship sağlık (a): PHP fatal yok, eklenti aktif, sürüm, needs_run.
 * Yazma yok.
 */
if (!defined('ABSPATH')) {
	fwrite(STDERR, "ship-health: WP yok\n");
	exit(1);
}
if (!function_exists('is_plugin_active')) {
	require_once ABSPATH . 'wp-admin/includes/plugin.php';
}
$active = is_plugin_active('woo-donation-popup/woo-donation-popup.php') ? 1 : 0;
$ver    = defined('WDP_VERSION') ? (string) WDP_VERSION : '';
$needs  = 1;
if (class_exists('WDP_Migrations') && method_exists('WDP_Migrations', 'needs_run')) {
	$needs = WDP_Migrations::needs_run() ? 1 : 0;
} elseif (!$active) {
	$needs = 1;
}
echo wp_json_encode(
	array(
		'php_ok'     => 1,
		'active'     => $active,
		'version'    => $ver,
		'needs_run'  => $needs,
	)
);

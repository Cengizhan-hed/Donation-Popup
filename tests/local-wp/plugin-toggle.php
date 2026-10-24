<?php
/**
 * Yerel WP (yalnız yerel): eklenti aç/kapa + sahte üçüncü taraf eklentiyi etkinleştir. Uzak için KULLANILMAZ.
 *
 *   php tests/local-wp/eval-file.php tests/local-wp/plugin-toggle.php on|off
 */
if (!function_exists('get_option')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}
require_once ABSPATH . 'wp-admin/includes/plugin.php';
$wdp_args = isset($wdp_eval_args) && is_array($wdp_eval_args) ? $wdp_eval_args : (isset($args) && is_array($args) ? $args : array());
$mode     = isset($wdp_args[0]) ? (string) $wdp_args[0] : '';
$ours     = 'woo-donation-popup/woo-donation-popup.php';
$third    = 'wdp-fake-third/wdp-fake-third.php';
$woo = 'woocommerce/woocommerce.php';
if (file_exists(WP_PLUGIN_DIR . '/' . $woo) && !is_plugin_active($woo)) {
	activate_plugin($woo);
}
if (file_exists(WP_PLUGIN_DIR . '/' . $third) && !is_plugin_active($third)) {
	activate_plugin($third);
}
if ($mode === 'on') {
	$res = activate_plugin($ours);
	if (is_wp_error($res)) {
		fwrite(STDERR, 'activate: ' . $res->get_error_message() . "\n");
		exit(1);
	}
} elseif ($mode === 'off') {
	deactivate_plugins($ours);
} else {
	fwrite(STDERR, "mode on|off\n");
	exit(1);
}
echo wp_json_encode(array('mode' => $mode, 'active' => is_plugin_active($ours) ? 1 : 0));

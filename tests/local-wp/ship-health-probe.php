<?php
/**
 * Yerel WP (yalnız yerel): ship sağlık/göç araçları için hazırlık.
 *
 *   php tests/local-wp/eval-file.php tests/local-wp/ship-health-probe.php ensure|reset
 *
 * ensure: Woo + eklentiyi etkinleştirir. reset: göç durumunu "göç öncesi" yapar
 * (wdp_db_version ve donation_panel_migrations seçeneklerini siler). Uzak için KULLANILMAZ.
 */
if (!function_exists('get_option')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}
require_once ABSPATH . 'wp-admin/includes/plugin.php';
$wdp_args = isset($wdp_eval_args) && is_array($wdp_eval_args) ? $wdp_eval_args : array();
$mode     = isset($wdp_args[0]) ? (string) $wdp_args[0] : '';

if ('ensure' === $mode) {
	foreach (array('woocommerce/woocommerce.php', 'woo-donation-popup/woo-donation-popup.php') as $p) {
		if (file_exists(WP_PLUGIN_DIR . '/' . $p) && !is_plugin_active($p)) {
			activate_plugin($p);
		}
	}
	echo wp_json_encode(array('active' => is_plugin_active('woo-donation-popup/woo-donation-popup.php')));
	exit(0);
}
if ('reset' === $mode) {
	delete_option('wdp_db_version');
	delete_option('donation_panel_migrations');
	delete_option('donation_panel_migrations_lock');
	delete_transient('wdp_migration_lock');
	echo wp_json_encode(array('reset' => true));
	exit(0);
}
fwrite(STDERR, "mode?\n");
exit(1);

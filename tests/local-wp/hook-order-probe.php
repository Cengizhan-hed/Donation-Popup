<?php
/**
 * Yerel WP (yalnız yerel): kanca sırası sözleşmesi. Uzak için KULLANILMAZ.
 *
 *   php tests/local-wp/eval-file.php tests/local-wp/hook-order-probe.php ensure|report
 *
 * ensure: Woo + eklentiyi etkinleştirir. report: mu-plugin (hook-order-mu.php) plugins_loaded 10 ve 25'te
 * topladığı $GLOBALS['wdp_e2x_probe'] verisini + yükleme sonrası çıktıyı JSON basar.
 */
if (!function_exists('get_option')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}
require_once ABSPATH . 'wp-admin/includes/plugin.php';
$wdp_args = isset($wdp_eval_args) && is_array($wdp_eval_args) ? $wdp_eval_args : array();
$mode     = isset($wdp_args[0]) ? (string) $wdp_args[0] : '';
$ours     = 'woo-donation-popup/woo-donation-popup.php';
$woo      = 'woocommerce/woocommerce.php';

if ($mode === 'ensure') {
	foreach (array($woo, $ours) as $p) {
		if (file_exists(WP_PLUGIN_DIR . '/' . $p) && !is_plugin_active($p)) {
			activate_plugin($p);
		}
	}
	echo json_encode(array('active' => array(is_plugin_active($woo), is_plugin_active($ours))));
	exit(0);
}

$probe = isset($GLOBALS['wdp_e2x_probe']) && is_array($GLOBALS['wdp_e2x_probe']) ? $GLOBALS['wdp_e2x_probe'] : array();
$tags  = array('wdp_donation_button', 'wdp_donation_button_panel', 'wdp_donation_form', 'wdp_donations');
$late_registered = array();
foreach ($tags as $t) {
	$late_registered[$t] = shortcode_exists($t);
}
$out = '';
$pid = 0;
$created = false;
if (class_exists('WC_Product_Simple')) {
	$ids = wc_get_products(array('limit' => 1, 'return' => 'ids', 'status' => 'publish'));
	if (!empty($ids)) {
		$pid = (int) $ids[0];
	} else {
		$product = new WC_Product_Simple();
		$product->set_name('E2X Probe Product');
		$product->set_regular_price('10');
		$product->set_status('publish');
		$pid     = (int) $product->save();
		$created = true;
	}
	ob_start();
	$out = do_shortcode('[wdp_donation_button_panel id="' . $pid . '"]');
	ob_end_clean();
	if ($created) {
		wp_delete_post($pid, true);
	}
}
echo json_encode(array(
	'early'           => isset($probe['early']) ? $probe['early'] : null,
	'mid'             => isset($probe['mid']) ? $probe['mid'] : null,
	'late_mu'         => isset($probe['late']) ? $probe['late'] : null,
	'registered_after' => $late_registered,
	'after_output_is_literal' => trim((string) $out) === '[wdp_donation_button_panel id="' . $pid . '"]',
	'after_output_len' => strlen((string) $out),
	'plugin_class'    => class_exists('DonationPanel\\Core\\Bootstrap'),
	'launched'        => did_action('donation_panel_modules_booted') > 0,
));

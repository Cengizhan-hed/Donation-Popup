<?php
/**
 * Geçici mu-plugin (test yazar, test siler): snippet benzeri kod plugins_loaded 10'da eklenti API'sini çağırır.
 */
$GLOBALS['wdp_e2x_probe'] = array();
$wdp_e2x_collect = static function () {
	$r = array('fatal' => false, 'errors' => array());
	set_error_handler(static function ($no, $str) use (&$r) {
		$r['errors'][] = $str;
		return true;
	});
	try {
		ob_start();
		$r['shortcodes'] = array();
		foreach (array('wdp_donation_button_panel', 'wdp_donation_button', 'wdp_donation_form', 'wdp_donations') as $tag) {
			$r['shortcodes'][ $tag ] = do_shortcode('[' . $tag . ' id="1"]');
		}
		$r['filters'] = array(
			'wdp_min_donation_amount' => apply_filters('wdp_min_donation_amount', 5, 1),
			'wdp_convert_amount'      => apply_filters('wdp_convert_amount', 100, 'USD'),
			'module_enabled'          => apply_filters('donation_panel_module_enabled', true, 'entry_points'),
		);
		$r['classes'] = array(
			'plugin' => class_exists('DonationPanel\\Core\\Plugin'),
			'legacy' => class_exists('DonationPanel\\Core\\Bootstrap'),
		);
		// 12.0.0: "başladı" = modüller başlatıldı (`donation_panel_modules_booted`, plugins_loaded 20).
		$r['legacy_launched'] = did_action('donation_panel_modules_booted') > 0;
		$r['stray_output']    = ob_get_clean();
	} catch (\Throwable $e) {
		$r['fatal'] = get_class($e) . ': ' . $e->getMessage();
		while (ob_get_level() > 1) {
			ob_end_clean();
		}
	}
	restore_error_handler();
	return $r;
};
add_action('plugins_loaded', static function () use ($wdp_e2x_collect) {
	$GLOBALS['wdp_e2x_probe']['early'] = $wdp_e2x_collect();
}, 10);
// Öncelik 15: 10 ile 20 arası (WC 10'da yüklenir; eski çekirdek 10'da başlıyordu).
add_action('plugins_loaded', static function () use ($wdp_e2x_collect) {
	$GLOBALS['wdp_e2x_probe']['mid'] = $wdp_e2x_collect();
}, 15);
// 20 sonrası: init 99 (WooCommerce/WP başlatma bitti).
add_action('init', static function () use ($wdp_e2x_collect) {
	$GLOBALS['wdp_e2x_probe']['late'] = $wdp_e2x_collect();
}, 99);

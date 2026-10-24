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

/**
 * PHP günlüğü son satırları (son 256 KB; yalnız okur). Koşu başlangıcından sonrası süzmesi ve
 * kaynak sınıflaması Node tarafında (health-attribution.mjs: zaman damgası ile). Satır sayısı <= 200.
 */
$wdp_log_lines = array();
$wdp_candidates = array();
$wdp_ini_log    = (string) ini_get('error_log');
if ($wdp_ini_log !== '') {
	$wdp_candidates[] = $wdp_ini_log;
}
if (defined('WP_CONTENT_DIR')) {
	$wdp_candidates[] = WP_CONTENT_DIR . '/debug.log';
}
$wdp_candidates[] = ABSPATH . 'php_errorlog';
$wdp_candidates[] = dirname(ABSPATH) . '/php_errorlog';
foreach ($wdp_candidates as $wdp_log_path) {
	if (!is_string($wdp_log_path) || $wdp_log_path === '' || !is_readable($wdp_log_path) || !is_file($wdp_log_path)) {
		continue;
	}
	$wdp_size = (int) filesize($wdp_log_path);
	$wdp_fh   = fopen($wdp_log_path, 'rb');
	if (!$wdp_fh) {
		continue;
	}
	if ($wdp_size > 262144) {
		fseek($wdp_fh, $wdp_size - 262144);
	}
	$wdp_chunk = (string) stream_get_contents($wdp_fh);
	fclose($wdp_fh);
	foreach (preg_split('/\r?\n/', $wdp_chunk) as $wdp_l) {
		if ($wdp_l !== '') {
			// Kişisel veri: e-posta maskele, uzunluk kes.
			$wdp_l = preg_replace('/[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/', '<e-posta>', $wdp_l);
			$wdp_log_lines[] = substr($wdp_l, 0, 300);
		}
	}
	break;
}
$wdp_log_lines = array_slice($wdp_log_lines, -200);

echo wp_json_encode(
	array(
		'log_lines'  => $wdp_log_lines,
		'php_ok'     => 1,
		'active'     => $active,
		'version'    => $ver,
		'needs_run'  => $needs,
	)
);

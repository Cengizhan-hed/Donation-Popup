<?php
/**
 * Minify admin-style.css in place (used by npm run pack on the ZIP copy only).
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

$root = dirname(__DIR__);
$cssPath = $root . '/assets/css/admin-style.css';

if ($argc >= 2 && is_string($argv[1]) && $argv[1] !== '') {
	$cssPath = $argv[1];
}

if (!is_file($cssPath)) {
	fwrite(STDERR, "admin css not found: {$cssPath}\n");
	exit(1);
}

$css = file_get_contents($cssPath);
if (!is_string($css) || $css === '') {
	fwrite(STDERR, "empty admin css\n");
	exit(1);
}

$esbuild = $root . '/node_modules/.bin/esbuild';
if (!is_file($esbuild)) {
	$esbuild = 'npx --yes esbuild';
} else {
	$esbuild = escapeshellarg($esbuild);
}

$tmpDir = sys_get_temp_dir();
$tmpIn = $tmpDir . '/wdp_admin_' . uniqid('', true) . '.css';
$tmpOut = $tmpDir . '/wdp_admin_' . uniqid('', true) . '.min.css';

if (file_put_contents($tmpIn, $css) === false) {
	fwrite(STDERR, "temp write failed\n");
	exit(1);
}

$cmd = $esbuild . ' ' . escapeshellarg($tmpIn) . ' --minify --legal-comments=none --outfile=' . escapeshellarg($tmpOut) . ' 2>/dev/null';
$cwd = getcwd();
@chdir($root);
$exit = 1;
@exec($cmd, $unused, $exit);
if ($cwd !== false) {
	@chdir($cwd);
}

$min = ($exit === 0 && is_file($tmpOut)) ? file_get_contents($tmpOut) : false;
@unlink($tmpIn);
@unlink($tmpOut);

if (!is_string($min) || trim($min) === '') {
	// Lightweight PHP fallback (comments + whitespace).
	$min = preg_replace('!/\*[^*]*\*+(?:[^/*][^*]*\*+)*/!', '', $css);
	$min = preg_replace('/\s+/', ' ', (string) $min);
	$min = str_replace(array(' {', '{ ', ' }', '} ', ': ', ' :', ' ;', '; ', ', '), array('{', '{', '}', '}', ':', ':', ';', ';', ','), (string) $min);
	$min = trim((string) $min);
}

if ($min === '') {
	fwrite(STDERR, "minify failed; keeping original\n");
	exit(0);
}

foreach (array('wdp-admin-wrap', 'wdp-admin-live-preview', 'wdp-product-card', 'nav-tab') as $sel) {
	if (strpos($css, $sel) !== false && strpos($min, $sel) === false) {
		fwrite(STDERR, "minify dropped selector {$sel}; keeping original\n");
		exit(0);
	}
}

file_put_contents($cssPath, $min);
echo 'Minified admin CSS: ' . strlen($css) . ' → ' . strlen($min) . ' bytes (' . round(100 * strlen($min) / max(1, strlen($css))) . "%)\n";

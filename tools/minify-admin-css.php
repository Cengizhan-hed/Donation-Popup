<?php
/**
 * Yönetim CSS dosyalarını (admin-style.css ve admin/products.css) yerinde küçültür; yalnızca npm run pack ZIP kopyasında kullanılır.
 *
 * Usage: php tools/minify-admin-css.php [file.css ...]
 * Without arguments the source files under assets/css are minified.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

$root = dirname(__DIR__);

$paths = array_values(array_filter(array_slice($argv, 1), static function ($arg) {
	return is_string($arg) && $arg !== '';
}));
if ($paths === array()) {
	$paths = array(
		$root . '/assets/css/admin-style.css',
		$root . '/assets/css/admin/products.css',
	);
}

/**
 * Selectors that must survive minification (guards against a broken minifier).
 */
const WDP_MINIFY_GUARD_SELECTORS = array(
	'wdp-admin-wrap',
	'wdp-admin-live-preview',
	'wdp-products-table',
	'wdp-type-card',
	'nav-tab',
);

/**
 * @param string $root    Plugin root.
 * @param string $cssPath CSS file to minify in place.
 * @return int Exit code (0 = ok or skipped safely).
 */
function wdp_minify_css_file(string $root, string $cssPath): int {
	if (!is_file($cssPath)) {
		fwrite(STDERR, "admin css not found: {$cssPath}\n");
		return 1;
	}

	$css = file_get_contents($cssPath);
	if (!is_string($css) || $css === '') {
		fwrite(STDERR, "empty admin css: {$cssPath}\n");
		return 1;
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
		return 1;
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
		$min = str_replace(array(' {', '{ ', ' }', '} ', ': ', ' ;', '; ', ', '), array('{', '{', '}', '}', ':', ';', ';', ','), (string) $min);
		$min = trim((string) $min);
	}

	if ($min === '') {
		fwrite(STDERR, "minify failed; keeping original {$cssPath}\n");
		return 0;
	}

	foreach (WDP_MINIFY_GUARD_SELECTORS as $sel) {
		if (strpos($css, $sel) !== false && strpos($min, $sel) === false) {
			fwrite(STDERR, "minify dropped selector {$sel}; keeping original {$cssPath}\n");
			return 0;
		}
	}

	file_put_contents($cssPath, $min);
	echo 'Minified ' . basename($cssPath) . ': ' . strlen($css) . ' → ' . strlen($min) . ' bytes (' . round(100 * strlen($min) / max(1, strlen($css))) . "%)\n";
	return 0;
}

$status = 0;
foreach ($paths as $path) {
	$status = max($status, wdp_minify_css_file($root, $path));
}
exit($status);

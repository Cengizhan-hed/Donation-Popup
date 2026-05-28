<?php
/**
 * Build single hashed frontend CSS bundle.
 *
 * Usage:
 *   php tools/build-css-bundle.php
 */

declare(strict_types=1);

$root = dirname(__DIR__);
$cssRoot = $root . '/assets/css';
$outDir = $cssRoot . '/build';

/**
 * Minify CSS via local npm tool when available.
 * Falls back to original content if minifier fails.
 *
 * @param string $root Project root.
 * @param string $css  Raw CSS bundle.
 * @return string
 */
function wdp_minify_css_bundle($root, $css) {
    $tmpIn = tempnam(sys_get_temp_dir(), 'wdp_css_in_');
    if (!is_string($tmpIn) || $tmpIn === '') {
        return $css;
    }
    $tmpOut = $tmpIn . '.min.css';

    try {
        if (file_put_contents($tmpIn, $css) === false) {
            return $css;
        }

        $cmd = 'npx --yes esbuild ' . escapeshellarg($tmpIn) . ' --loader=css --minify --legal-comments=none --outfile=' . escapeshellarg($tmpOut) . ' 2>/dev/null';
        $cwd = getcwd();
        @chdir($root);
        $exit = 1;
        @exec($cmd, $unused, $exit);
        if ($cwd !== false) {
            @chdir($cwd);
        }

        if ($exit !== 0 || !file_exists($tmpOut)) {
            return $css;
        }

        $min = file_get_contents($tmpOut);
        if (!is_string($min) || trim($min) === '') {
            return $css;
        }

        // Safety net: if critical selectors disappear after minify, keep original CSS.
        $critical_selectors = array(
            'wdp-field-stack__svg',
            'wdp-field-stack__row',
            'wdp-field-stack__input',
        );
        foreach ($critical_selectors as $selector) {
            if (strpos($css, $selector) !== false && strpos($min, $selector) === false) {
                return $css;
            }
        }

        if (strpos($css, '@layer') !== false && strpos($min, '@layer') === false) {
            return $css;
        }

        return $min . "\n";
    } finally {
        @unlink($tmpIn);
        @unlink($tmpOut);
    }
}

// Stack config uses ABSPATH guard; define for CLI builds.
if (!defined('ABSPATH')) {
    define('ABSPATH', $root . '/');
}

$stack_file = $root . '/includes/config/frontend-css-stack.php';
if (!file_exists($stack_file)) {
    fwrite(STDERR, "Missing CSS stack config: {$stack_file}\n");
    exit(1);
}
$stack = require $stack_file;
if (!is_array($stack)) {
    fwrite(STDERR, "Invalid CSS stack config.\n");
    exit(1);
}

if (!is_dir($outDir) && !mkdir($outDir, 0775, true) && !is_dir($outDir)) {
    fwrite(STDERR, "Cannot create build directory: {$outDir}\n");
    exit(1);
}

$parts = array();
foreach ($stack as $rel) {
    $abs = $cssRoot . '/' . $rel;
    if (!file_exists($abs)) {
        fwrite(STDERR, "Missing CSS file: {$rel}\n");
        exit(1);
    }
    $content = file_get_contents($abs);
    if (!is_string($content)) {
        fwrite(STDERR, "Cannot read CSS file: {$rel}\n");
        exit(1);
    }
    $parts[] = trim($content);
}

$bundle = implode("\n", $parts) . "\n";
$bundle = wdp_minify_css_bundle($root, $bundle);
$hash = substr(sha1($bundle), 0, 12);
$fileName = "donation-modal.{$hash}.css";
$outPath = $outDir . '/' . $fileName;

if (file_put_contents($outPath, $bundle) === false) {
    fwrite(STDERR, "Cannot write bundle file: {$outPath}\n");
    exit(1);
}

foreach (glob($outDir . '/donation-modal.*.css') ?: array() as $oldFile) {
    if (basename($oldFile) !== $fileName) {
        @unlink($oldFile);
    }
}

$manifest = array(
    'file' => 'build/' . $fileName,
    'hash' => $hash,
    'generated_at' => gmdate('c'),
);
$manifestJson = json_encode($manifest, JSON_UNESCAPED_SLASHES) . "\n";

if (file_put_contents($outDir . '/manifest.json', $manifestJson) === false) {
    fwrite(STDERR, "Cannot write manifest.json\n");
    exit(1);
}

fwrite(STDOUT, "Built CSS bundle: assets/css/build/{$fileName}\n");

<?php
/**
 * Build single hashed frontend JS bundle.
 *
 * Usage:
 *   php tools/build-js-bundle.php
 */

declare(strict_types=1);

$root = dirname(__DIR__);
$jsRoot = $root . '/assets/js';
$outDir = $jsRoot . '/build';

/**
 * Minify JS via local npm tool when available.
 * Falls back to original content if minifier fails.
 *
 * @param string $root Project root.
 * @param string $js   Raw JS bundle.
 * @return string
 */
function wdp_minify_js_bundle($root, $js) {
    $tmpIn = tempnam(sys_get_temp_dir(), 'wdp_js_in_');
    if (!is_string($tmpIn) || $tmpIn === '') {
        return $js;
    }
    $tmpInJs = $tmpIn . '.js';
    $tmpOut = $tmpIn . '.min.js';

    try {
        if (!@rename($tmpIn, $tmpInJs)) {
            @unlink($tmpIn);
            $tmpInJs = $tmpIn;
        }

        if (file_put_contents($tmpInJs, $js) === false) {
            return $js;
        }

        $cmd = 'npx --yes esbuild ' . escapeshellarg($tmpInJs) . ' --minify --legal-comments=none --outfile=' . escapeshellarg($tmpOut) . ' 2>/dev/null';
        $cwd = getcwd();
        @chdir($root);
        $exit = 1;
        @exec($cmd, $unused, $exit);
        if ($cwd !== false) {
            @chdir($cwd);
        }

        if ($exit !== 0 || !file_exists($tmpOut)) {
            return $js;
        }

        $min = file_get_contents($tmpOut);
        if (!is_string($min) || trim($min) === '') {
            return $js;
        }

        return $min . "\n";
    } finally {
        @unlink($tmpInJs);
        @unlink($tmpOut);
    }
}

if (!defined('ABSPATH')) {
    define('ABSPATH', $root . '/');
}

$stack_file = $root . '/includes/config/frontend-js-stack.php';
if (!file_exists($stack_file)) {
    fwrite(STDERR, "Missing JS stack config: {$stack_file}\n");
    exit(1);
}
$stack = require $stack_file;
if (!is_array($stack)) {
    fwrite(STDERR, "Invalid JS stack config.\n");
    exit(1);
}

if (!is_dir($outDir) && !mkdir($outDir, 0775, true) && !is_dir($outDir)) {
    fwrite(STDERR, "Cannot create build directory: {$outDir}\n");
    exit(1);
}

$parts = array();
foreach ($stack as $entry) {
    $rel = is_array($entry) ? ($entry['file'] ?? '') : $entry;
    if (!is_string($rel) || $rel === '') {
        continue;
    }
    $abs = $jsRoot . '/' . ltrim($rel, '/');
    if (!file_exists($abs)) {
        fwrite(STDERR, "Missing JS file: {$rel}\n");
        exit(1);
    }
    $content = file_get_contents($abs);
    if (!is_string($content)) {
        fwrite(STDERR, "Cannot read JS file: {$rel}\n");
        exit(1);
    }
    $parts[] = trim($content);
}

$bundle = implode("\n", $parts) . "\n";
$bundle = wdp_minify_js_bundle($root, $bundle);
$hash = substr(sha1($bundle), 0, 12);
$fileName = "donation-modal.{$hash}.js";
$outPath = $outDir . '/' . $fileName;

if (file_put_contents($outPath, $bundle) === false) {
    fwrite(STDERR, "Cannot write bundle file: {$outPath}\n");
    exit(1);
}

foreach (glob($outDir . '/donation-modal.*.js') ?: array() as $oldFile) {
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

fwrite(STDOUT, "Built JS bundle: assets/js/build/{$fileName}\n");

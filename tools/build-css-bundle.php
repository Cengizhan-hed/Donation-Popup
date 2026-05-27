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
    $parts[] = "/* >>> {$rel} */\n" . trim($content) . "\n";
}

$bundle = implode("\n", $parts) . "\n";
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
$manifestJson = json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";

if (file_put_contents($outDir . '/manifest.json', $manifestJson) === false) {
    fwrite(STDERR, "Cannot write manifest.json\n");
    exit(1);
}

fwrite(STDOUT, "Built CSS bundle: assets/css/build/{$fileName}\n");

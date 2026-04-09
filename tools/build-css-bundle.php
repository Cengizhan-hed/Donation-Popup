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

$stack = array(
    'src/tokens.css',
    'src/base.css',
    'src/layout.css',
    'src/forms/shared.css',
    'src/forms/hisseli.css',
    'src/components/buttons.css',
    'src/components/alerts.css',
    'src/components/loading.css',
    'src/components/quantity.css',
    'src/components/progress-bar.css',
    'src/components/success.css',
    'src/components/toast.css',
    'src/components/motion.css',
    'src/components/feedback.css',
    'src/components/accessibility.css',
    'src/components/amount-presets.css',
);

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

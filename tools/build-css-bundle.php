<?php
/**
 * frontend-css-stack.php sırasına göre CSS kaynaklarını tek bundle dosyasında birleştirir.
 *
 * @package WooCommerce\Donation_Popup
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
    $tmpBase = tempnam(sys_get_temp_dir(), 'wdp_css_in_');
    if (!is_string($tmpBase) || $tmpBase === '') {
        return $css;
    }
    // esbuild yükleyiciyi dosya uzantısından seçer: uzantısız geçici dosyada hata verip özgün CSS'e düşüyordu (küçültme hiç çalışmıyordu).
    $tmpIn  = $tmpBase . '.css';
    $tmpOut = $tmpBase . '.min.css';
    @rename($tmpBase, $tmpIn);

    try {
        if (file_put_contents($tmpIn, $css) === false) {
            return $css;
        }

        $cmd = 'npx --yes esbuild ' . escapeshellarg($tmpIn) . ' --minify --legal-comments=none --outfile=' . escapeshellarg($tmpOut) . ' 2>/dev/null';
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

        // Yalnız gerçek @layer kuralı (yorum satırındaki söz değil) küçültmede korunmalı.
        if (preg_match('/^\s*@layer\b/m', $css) === 1 && strpos($min, '@layer') === false) {
            return $css;
        }

        return $min . "\n";
    } finally {
        @unlink($tmpBase);
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

// K3: ilk görünüm kritik alt kümesi (satır içi basılır; tam paket engelleyici olmadan sonradan yüklenir).
// Ayıklayıcı (Node + Playwright Chromium) yoksa/başarısızsa bölme yapılmaz: tek paketle devam (geriye dönük güvenli).
$criticalName = null;
foreach (glob($outDir . '/critical.*.css') ?: array() as $oldCritical) {
    @unlink($oldCritical);
}
// K7: sayfa türüne göre ayrı kritik kümeler (critical.tmp.<tür>.css → critical.<tür>.<hash>.css).
$criticalSets = array();
$criticalTmp  = $outDir . '/critical.tmp.css';
$criticalCmd  = 'node ' . escapeshellarg($root . '/tools/css-critical/build-critical.mjs') . ' ' . escapeshellarg($outPath) . ' ' . escapeshellarg($criticalTmp) . ' 2>&1';
$criticalOut  = array();
$criticalExit = 1;
@exec($criticalCmd, $criticalOut, $criticalExit);
if ($criticalExit === 0 && is_file($criticalTmp) && filesize($criticalTmp) > 0) {
    $criticalCss  = (string) file_get_contents($criticalTmp);
    $criticalName = 'critical.' . substr(sha1($criticalCss), 0, 12) . '.css';
    rename($criticalTmp, $outDir . '/' . $criticalName);
    fwrite(STDOUT, implode("\n", $criticalOut) . "\n");
    foreach (glob($outDir . '/critical.tmp.*.css') ?: array() as $typedTmp) {
        $type = substr(basename($typedTmp), strlen('critical.tmp.'), -4);
        $typedCss = (string) file_get_contents($typedTmp);
        if (preg_match('/^[a-z0-9-]+$/', $type) === 1 && $typedCss !== '') {
            $typedName = 'critical.' . $type . '.' . substr(sha1($typedCss), 0, 12) . '.css';
            rename($typedTmp, $outDir . '/' . $typedName);
            $criticalSets[$type] = 'build/' . $typedName;
        } else {
            @unlink($typedTmp);
        }
    }
} else {
    foreach (glob($outDir . '/critical.tmp*.css') ?: array() as $typedTmp) {
        @unlink($typedTmp);
    }
    @unlink($criticalTmp);
    fwrite(STDERR, 'Kritik CSS üretilmedi (bölme yok, tek paket): ' . implode(' ', $criticalOut) . "\n");
}

$manifest = array(
    'file' => 'build/' . $fileName,
    'hash' => $hash,
    'generated_at' => gmdate('c'),
);
if ($criticalName !== null) {
    $manifest['critical'] = 'build/' . $criticalName;
    if ($criticalSets) {
        $manifest['critical_sets'] = $criticalSets;
    }
}
$manifestJson = json_encode($manifest, JSON_UNESCAPED_SLASHES) . "\n";

if (file_put_contents($outDir . '/manifest.json', $manifestJson) === false) {
    fwrite(STDERR, "Cannot write manifest.json\n");
    exit(1);
}

fwrite(STDOUT, "Built CSS bundle: assets/css/build/{$fileName}\n");

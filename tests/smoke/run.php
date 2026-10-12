<?php
/**
 * CLI smoke testleri — çalıştırma: php tests/smoke/run.php
 *
 * Ne işe yarar?
 * - Build çıktılarının (CSS/JS bundle) diskte olduğunu doğrular.
 * - PHP sınıflarının ve trait dosyalarının yüklenebildiğini kontrol eder.
 * - JS/CSS stack dosyalarının eksiksiz olduğunu kontrol eder.
 * - Yayın öncesi "temel kırılma" riskini hızlıca yakalar (unit test değildir).
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$failures = 0;

function wdp_smoke_assert(bool $condition, string $message): void
{
    global $failures;
    if ($condition) {
        echo "[OK] {$message}\n";
        return;
    }
    echo "[FAIL] {$message}\n";
    $failures++;
}

function wdp_smoke_file_contains(string $path, string $needle): bool
{
    if (!file_exists($path)) {
        return false;
    }
    $content = file_get_contents($path);
    return is_string($content) && strpos($content, $needle) !== false;
}

$css_manifest = WDP_PLUGIN_DIR . 'assets/css/build/manifest.json';
$js_manifest  = WDP_PLUGIN_DIR . 'assets/js/build/manifest.json';

wdp_smoke_assert(file_exists($css_manifest), 'CSS build manifest exists');
wdp_smoke_assert(file_exists($js_manifest), 'JS build manifest exists');

$css = json_decode((string) file_get_contents($css_manifest), true);
$js  = json_decode((string) file_get_contents($js_manifest), true);

wdp_smoke_assert(is_array($css) && !empty($css['file']), 'CSS manifest has file key');
wdp_smoke_assert(is_array($js) && !empty($js['file']), 'JS manifest has file key');

wdp_smoke_assert(
    file_exists(WDP_PLUGIN_DIR . 'assets/css/' . ltrim((string) $css['file'], '/')),
    'CSS bundle file on disk'
);
wdp_smoke_assert(
    file_exists(WDP_PLUGIN_DIR . 'assets/js/' . ltrim((string) $js['file'], '/')),
    'JS bundle file on disk'
);

wdp_smoke_assert(class_exists('WDP_Exception'), 'WDP_Exception loads');
wdp_smoke_assert(class_exists('WDP_Assets'), 'WDP_Assets loads');
wdp_smoke_assert(class_exists('WDP_Utils'), 'WDP_Utils loads');
wdp_smoke_assert(class_exists('WDP_Templates'), 'WDP_Templates loads');

$stack_css = require WDP_PLUGIN_DIR . 'includes/config/frontend-css-stack.php';
$stack_js  = require WDP_PLUGIN_DIR . 'includes/config/frontend-js-stack.php';
wdp_smoke_assert(is_array($stack_css) && count($stack_css) >= 15, 'CSS stack config');
wdp_smoke_assert(is_array($stack_js) && count($stack_js) >= 23, 'JS stack has expected module count');

if (is_array($stack_js)) {
    foreach ($stack_js as $entry) {
        $file = is_array($entry) && isset($entry['file']) ? (string) $entry['file'] : '';
        wdp_smoke_assert($file !== '' && file_exists(WDP_PLUGIN_DIR . 'assets/js/' . ltrim($file, '/')), 'JS stack entry exists: ' . $file);
    }
}
if (is_array($stack_css)) {
    foreach ($stack_css as $file) {
        $file = (string) $file;
        wdp_smoke_assert($file !== '' && file_exists(WDP_PLUGIN_DIR . 'assets/css/' . ltrim($file, '/')), 'CSS stack entry exists: ' . $file);
    }
}

$js_paths = array(
    'src/form.js',
    'src/form/messages.js',
    'src/form/pricing.js',
    'src/form/feedback.js',
    'src/form/sadaka.js',
    'src/form/ajax.js',
    'src/form/validate.js',
    'src/cart/ui.js',
    'src/cart/woo.js',
    'src/cart/actions.js',
    'src/cart.js',
    'src/shareholder.js',
    'src/shareholder/layout.js',
    'src/shareholder/list.js',
    'src/shareholder/scroll.js',
    'src/shareholder/guidance.js',
    'src/shareholder/render.js',
    'src/shareholder/quantity.js',
    'src/shareholder/forms-sync.js',
    'src/shareholder/setup.js',
    'src/modal.js',
    'src/core/utils.js',
    'src/bootstrap/init.js',
);
foreach ($js_paths as $rel) {
    wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'assets/js/' . $rel), 'JS file: ' . $rel);
}

$css_paths = array(
    'src/foundation/tokens.css',
    'src/components/quantity.css',
    'src/components/side-panel.css',
    'src/forms/shared.css',
);
foreach ($css_paths as $rel) {
    wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'assets/css/' . $rel), 'CSS file: ' . $rel);
}

wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'includes/class-assets.php'), 'Flat includes/class-assets.php');
wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'includes/class-exceptions.php'), 'Flat includes/class-exceptions.php');
wdp_smoke_assert(is_dir(WDP_PLUGIN_DIR . 'includes/traits/'), 'includes/traits/ directory');

$traits = glob(WDP_PLUGIN_DIR . 'includes/traits/trait-wdp-*.php') ?: array();
wdp_smoke_assert(count($traits) === 11, 'Expected 11 traits in includes/traits/');

$required_traits = array(
    'trait-wdp-ajax-base.php',
    'trait-wdp-ajax-product.php',
    'trait-wdp-ajax-cart-add.php',
    'trait-wdp-ajax-cart-session.php',
    'trait-wdp-ajax-cart-query.php',
    'trait-wdp-assets-optimizer.php',
    'trait-wdp-assets-registry.php',
    'trait-wdp-assets-inline-styles.php',
    'trait-wdp-utils-price.php',
    'trait-wdp-utils-order-meta.php',
    'trait-wdp-utils-legacy-settings.php',
);
foreach ($required_traits as $trait_file) {
    wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'includes/traits/' . $trait_file), 'Trait exists: ' . $trait_file);
}

wdp_smoke_assert(class_exists('WDP_Ajax'), 'WDP_Ajax loads');
wdp_smoke_assert(class_exists('WDP_Shortcodes'), 'WDP_Shortcodes loads');
wdp_smoke_assert(class_exists('WDP_Progress_Form'), 'WDP_Progress_Form loads');
wdp_smoke_assert(class_exists('WDP_Order_Meta_Keys'), 'WDP_Order_Meta_Keys loads');
wdp_smoke_assert(class_exists('WDP_Privacy'), 'WDP_Privacy loads');
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'uninstall.php', 'WP_UNINSTALL_PLUGIN')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'uninstall.php', 'wdp_delete_data_on_uninstall'),
    'uninstall.php is guarded by WP_UNINSTALL_PLUGIN and the opt-in setting'
);

$modal_js = WDP_PLUGIN_DIR . 'assets/js/src/modal.js';
$form_ajax_js = WDP_PLUGIN_DIR . 'assets/js/src/form/ajax.js';
$form_js = WDP_PLUGIN_DIR . 'assets/js/src/form.js';
$event_manager_js = WDP_PLUGIN_DIR . 'assets/js/src/bootstrap/event-manager.js';
$build_css_tool = WDP_PLUGIN_DIR . 'tools/build-css-bundle.php';
$build_js_tool = WDP_PLUGIN_DIR . 'tools/build-js-bundle.php';

wdp_smoke_assert(
    wdp_smoke_file_contains($modal_js, 'syncStateClasses: syncModalStateClasses'),
    'Modal exports syncStateClasses'
);
wdp_smoke_assert(
    wdp_smoke_file_contains($form_ajax_js, 'function syncModalSuccessState('),
    'Form AJAX module has modal success state sync helper'
);
wdp_smoke_assert(
    wdp_smoke_file_contains($form_js, 'formAjax.registerHooks'),
    'Form registers AJAX validation hooks'
);
$shareholder_js = WDP_PLUGIN_DIR . 'assets/js/src/shareholder.js';
wdp_smoke_assert(
    wdp_smoke_file_contains($shareholder_js, 'createShareholderRuntime')
        && wdp_smoke_file_contains($shareholder_js, 'rt.quantity.registerHooks'),
    'Shareholder registers quantity hooks'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/js/src/shareholder/render.js', 'WDPApp.shareholderRender'),
    'Shareholder render module exports API'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/js/src/shareholder/setup.js', 'WDPApp.shareholderSetup'),
    'Shareholder setup module exports API'
);
wdp_smoke_assert(
    wdp_smoke_file_contains($shareholder_js, 'createShareholderRuntime')
        && wdp_smoke_file_contains($shareholder_js, 'rt.setup.registerHooks'),
    'Shareholder registers setup hooks'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/js/src/cart.js', 'WDPApp.cart'),
    'Cart bridge exports WDPApp.cart'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/js/src/cart/ui.js', 'WDPApp.cartUi'),
    'Cart UI module exports API'
);
wdp_smoke_assert(
    wdp_smoke_file_contains($event_manager_js, 'function invokeModuleMethod('),
    'Event manager has shared module invoker'
);
wdp_smoke_assert(
    wdp_smoke_file_contains($build_css_tool, 'esbuild') && wdp_smoke_file_contains($build_css_tool, 'critical_selectors'),
    'CSS build tool includes minify step'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/traits/trait-wdp-ajax-cart-add.php', 'AJAX sepete ekleme'),
    'Cart add trait has Turkish file docblock'
);
wdp_smoke_assert(
    wdp_smoke_file_contains($build_js_tool, 'esbuild'),
    'JS build tool includes minify step'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/js/src/form/feedback.js', 'isCompactShareholderViewport: isCompactShareholderViewport'),
    'Form feedback exports compact viewport helper'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/js/src/form/validate.js', 'WDPApp.formValidate'),
    'Form validate module exports API'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/js/src/form/validate.js', 'function validateForm('),
    'Form validation defines validateForm helper'
);

exit($failures > 0 ? 1 : 0);

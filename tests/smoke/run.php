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
    'src/form/addon.js',
    'src/form/ajax.js',
    'src/form/validate.js',
    'src/form/cta-ready.js',
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
wdp_smoke_assert(class_exists('\DonationPanel\Modules\EntryPoints\Shortcodes'), '\DonationPanel\Modules\EntryPoints\Shortcodes loads');
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
    wdp_smoke_file_contains($form_ajax_js, 'function syncModalSuccessUi('),
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
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/js/src/form/cta-ready.js', 'WDPApp.formCtaReady'),
    'CTA ready queue exports formCtaReady'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/js/src/form/cta-ready.js', 'invokePluginSubmit'),
    'CTA ready invokes plugin submit handler'
);
wdp_smoke_assert(
    !wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/js/src/form/cta-ready.js', 'requestSubmit'),
    'CTA ready never uses requestSubmit (no native form navigation)'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/js/src/form.js', 'invokeEnterSubmit'),
    'Enter on donation form uses plugin submit, not native'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/js/src/cart/woo.js', 'reload_after_add_to_cart'),
    'Cart fallback reload is gated by flag'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/traits/trait-wdp-assets-registry.php', 'wdp_reload_after_add_to_cart'),
    'reload_after_add_to_cart filter is localized'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/templates/class-modal-shell-renderer.php', 'wdp-cta-gate__hit'),
    'Form CTA has early-tap gate overlay'
);

// Admin: product "Bağış" tab + Settings → Ürünler table.
wdp_smoke_assert(class_exists('WDP_Donation_Type'), 'WDP_Donation_Type loads');
wdp_smoke_assert(class_exists('WDP_Admin_Product_Data_Tab'), 'WDP_Admin_Product_Data_Tab loads');
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-admin-products-list-table.php', 'extends WP_List_Table'),
    'Products list table extends WP_List_Table'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-admin-hooks.php', 'WDP_Admin_Product_Data_Tab::register()'),
    'Product data tab hooks are registered'
);
wdp_smoke_assert(
    !file_exists(WDP_PLUGIN_DIR . 'includes/class-admin-product-row-renderer.php'),
    'Legacy product card renderer removed'
);
foreach (array('assets/css/admin/products.css', 'assets/js/admin/products.js') as $rel) {
    wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . $rel), 'Admin products asset: ' . $rel);
    wdp_smoke_assert(wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-admin-assets.php', $rel), 'Admin products asset enqueued: ' . $rel);
}
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'scripts/package-wp-plugin.sh', 'assets/css/admin/products.css'),
    'Pack script minifies admin/products.css'
);
wdp_smoke_assert(
    !file_exists(WDP_PLUGIN_DIR . 'assets/css/admin-style.css') && !file_exists(WDP_PLUGIN_DIR . 'assets/js/admin-script.js'),
    'Old admin settings CSS/JS removed (12.0.0 single menu)'
);

// 10.27.0: render guard, migrations, removed in-form module.
wdp_smoke_assert(class_exists('WDP_Render_Guard'), 'WDP_Render_Guard loads');
wdp_smoke_assert(class_exists('WDP_Migrations'), 'WDP_Migrations loads');
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-templates.php', 'WDP_Render_Guard::html')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Modules/EntryPoints/class-shortcodes.php', 'WDP_Render_Guard::html'),
    'Templates and shortcodes render through WDP_Render_Guard'
);
$wdp_removed_module_css = 'wdp-' . WDP_Migrations::REMOVED_MODULE_IDS[0];
wdp_smoke_assert(
    !wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/css/src/components/campaign-modules.css', $wdp_removed_module_css)
        && !wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/css/' . ltrim((string) ($css['file'] ?? ''), '/'), $wdp_removed_module_css),
    'Removed in-form module CSS is gone from source and bundle'
);

// 10.27.0: placement, list, blocks, lazy modal.
foreach (array(
    'WDP_Donation_Scope',
    'WDP_Addon_Product_Visibility',
    '\DonationPanel\Modules\EntryPoints\Product_Resolver',
    'WDP_Render_Registry',
    '\DonationPanel\Modules\EntryPoints\Auto_Placement',
    'WDP_Donations_List',
    'WDP_Lazy_Modal',
    'WDP_Placement_Settings',
    '\DonationPanel\Modules\EntryPoints\Blocks',
    '\DonationPanel\Modules\EntryPoints\Elementor\Elementor_Compat',
    'WDP_Form_Matrix',
    'WDP_Admin_Bulk_Actions',
) as $wdp_2b_class) {
    wdp_smoke_assert(class_exists($wdp_2b_class), $wdp_2b_class . ' loads');
}
wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'assets/css/list.css') && file_exists(WDP_PLUGIN_DIR . 'assets/js/list.js'), 'List CSS/JS exist');
wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'blocks/donation-form/block.json') && file_exists(WDP_PLUGIN_DIR . 'blocks/donations/block.json'), 'Gutenberg block.json files exist');
wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'src/Modules/EntryPoints/class-builder-detect.php'), 'Builder detect lives in the entry-points module');
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/config/frontend-js-stack.php', 'lazy-modal.js'),
    'Lazy modal is on the frontend JS stack'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/config/frontend-css-stack.php', 'container-queries.css'),
    'Container queries CSS is on the frontend stack'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/config/frontend-css-stack.php', 'rtl.css'),
    'RTL CSS is on the frontend stack'
);
wdp_smoke_assert(
    defined('WDP_VERSION') && WDP_VERSION === '11.0.0',
    'Plugin version is 11.0.0'
);
wdp_smoke_assert(
    file_exists(WDP_PLUGIN_DIR . 'templates/woocommerce/single-product/add-to-cart/simple.php'),
    'WooCommerce simple add-to-cart override template exists'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Modules/EntryPoints/class-fallback-button.php', 'function render_builder_fallback')
        && preg_match("/add_action\\(\\s*'wp_footer'/", (string) file_get_contents(WDP_PLUGIN_DIR . 'src/Modules/EntryPoints/class-auto-placement.php')) === 1,
    'Product page builder fallback is registered'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Modules/EntryPoints/class-auto-placement.php', 'function unhook_native_single_add_to_cart')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-cart.php', 'function should_reject_native_add_to_cart'),
    'Native add-to-cart unhook + server reject exist'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Modules/EntryPoints/class-auto-placement.php', 'filter_wc_get_template')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-migrations.php', 'step_10_28_1'),
    '10.28.1 template override and restore migration are present'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-migrations.php', 'step_10_28_4')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-migrations.php', 'step_10_28_5')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-addon-product-visibility.php', 'clear_visibility_caches')
        && !wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-addon-product-visibility.php', 'filter_is_donation_product'),
    '10.28.5 addon visibility caches cleared; no donation-scope hide filter'
);

// 12.0.0: tek yönetici menüsü (src/Admin); eski ayar ekranı ve eski yönetici varlıkları kaldırıldı.
foreach (array('class-admin-page-renderer', 'class-admin-form-tabs-renderer', 'class-admin-layout-tabs-renderer', 'class-admin-placement-tab-renderer', 'class-admin-design-studio-renderer', 'class-admin-settings-normalizer', 'class-admin-renderer-helpers') as $wdp_removed_admin) {
    wdp_smoke_assert(!file_exists(WDP_PLUGIN_DIR . 'includes/' . $wdp_removed_admin . '.php'), 'Old admin file removed: ' . $wdp_removed_admin);
}
foreach (array('src/Admin/class-ui-switch.php', 'src/Admin/class-settings-page.php') as $wdp_removed_rel) {
    wdp_smoke_assert(!file_exists(WDP_PLUGIN_DIR . $wdp_removed_rel), 'Old admin file removed: ' . $wdp_removed_rel);
}
foreach (array('class-admin-bootstrap', 'class-admin-controller', 'class-admin-assets', 'class-admin-view', 'class-field-registry', 'class-settings-store', 'class-status', 'class-pages', 'class-setup-wizard', 'class-guide') as $wdp_admin_file) {
    wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'src/Admin/' . $wdp_admin_file . '.php'), 'New admin file exists: ' . $wdp_admin_file);
}
wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'assets/src/admin/index.mjs') && file_exists(WDP_PLUGIN_DIR . 'assets/src/admin/admin.css'), 'Admin JS/CSS source exists (wp-scripts)');
$wdp_admin_js = (string) file_get_contents(WDP_PLUGIN_DIR . 'assets/src/admin/index.mjs') . (string) file_get_contents(WDP_PLUGIN_DIR . 'assets/src/admin/wizard.mjs');
wdp_smoke_assert(preg_match('/jQuery\\s*[(.]|[^\\w]\\$\\s*\\(/', $wdp_admin_js) !== 1, 'Admin JS does not use jQuery');
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Admin/class-admin-bootstrap.php', 'add_menu_page(')
        && !wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Admin/class-admin-bootstrap.php', "'woocommerce',"),
    'Plugin menu is one top-level menu, not under WooCommerce'
);

exit($failures > 0 ? 1 : 0);

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
    !wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/css/admin-style.css', '.wdp-product-card')
        && !wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/js/admin-script.js', 'wdp-product-card'),
    'Legacy product card CSS/JS removed'
);

// 10.27.0: render guard, migrations, removed in-form module.
wdp_smoke_assert(class_exists('WDP_Render_Guard'), 'WDP_Render_Guard loads');
wdp_smoke_assert(class_exists('WDP_Migrations'), 'WDP_Migrations loads');
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-templates.php', 'WDP_Render_Guard::html')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-shortcodes.php', 'WDP_Render_Guard::html'),
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
    'WDP_Sadaka_Product_Visibility',
    'WDP_Product_Resolver',
    'WDP_Render_Registry',
    'WDP_Product_Page_Integration',
    'WDP_Donations_List',
    'WDP_Lazy_Modal',
    'WDP_Schema',
    'WDP_Placement_Settings',
    'WDP_Blocks',
    'WDP_Elementor',
    'WDP_Form_Matrix',
    'WDP_Admin_Placement_Tab_Renderer',
    'WDP_Admin_Bulk_Actions',
) as $wdp_2b_class) {
    wdp_smoke_assert(class_exists($wdp_2b_class), $wdp_2b_class . ' loads');
}
wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'assets/css/list.css') && file_exists(WDP_PLUGIN_DIR . 'assets/js/list.js'), 'List CSS/JS exist');
wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'blocks/donation-form/block.json') && file_exists(WDP_PLUGIN_DIR . 'blocks/donations/block.json'), 'Gutenberg block.json files exist');
wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'includes/compat/class-builder-detect.php'), 'Builder detect lives in compat/');
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/config/frontend-js-stack.php', 'lazy-modal.js'),
    'Lazy modal is on the frontend JS stack'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/config/frontend-css-stack.php', 'container-queries.css'),
    'Container queries CSS is on the frontend stack'
);
wdp_smoke_assert(
    defined('WDP_VERSION') && WDP_VERSION === '10.34.13',
    'Plugin version is 10.34.13'
);
wdp_smoke_assert(
    file_exists(WDP_PLUGIN_DIR . 'templates/woocommerce/single-product/add-to-cart/simple.php'),
    'WooCommerce simple add-to-cart override template exists'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-product-page-integration.php', 'function render_builder_fallback')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-product-page-integration.php', "add_action('wp_footer'"),
    'Product page builder fallback is registered'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-product-page-integration.php', 'function unhook_native_single_add_to_cart')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-cart.php', 'function should_reject_native_add_to_cart'),
    'Native add-to-cart unhook + server reject exist'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-product-page-integration.php', 'filter_wc_get_template')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-migrations.php', 'step_10_28_1'),
    '10.28.1 template override and restore migration are present'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-migrations.php', 'step_10_28_4')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-migrations.php', 'step_10_28_5')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-sadaka-product-visibility.php', 'clear_visibility_caches')
        && !wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'includes/class-sadaka-product-visibility.php', 'filter_is_donation_product'),
    '10.28.5 sadaka visibility caches cleared; no donation-scope hide filter'
);

// 10.27.1: admin tabs/forms stay in sync (no hardcoded TAB_KEYS).
$admin_page_renderer = (string) file_get_contents(WDP_PLUGIN_DIR . 'includes/class-admin-page-renderer.php');
$admin_script_js     = (string) file_get_contents(WDP_PLUGIN_DIR . 'assets/js/admin-script.js');
$admin_assets_php    = (string) file_get_contents(WDP_PLUGIN_DIR . 'includes/class-admin-assets.php');
$admin_hooks_php     = (string) file_get_contents(WDP_PLUGIN_DIR . 'includes/class-admin-hooks.php');

preg_match_all('/data-tab="([a-z0-9\-]+)"/', $admin_page_renderer, $wdp_tab_matches);
$wdp_tab_keys = array_values(array_unique($wdp_tab_matches[1] ?? array()));
wdp_smoke_assert($wdp_tab_keys !== array(), 'Admin page renderer declares data-tab keys');
foreach ($wdp_tab_keys as $wdp_tab_key) {
    wdp_smoke_assert(
        strpos($admin_page_renderer, 'id="wdp-' . $wdp_tab_key . '-tab"') !== false,
        'Admin tab panel exists for data-tab=' . $wdp_tab_key
    );
}
wdp_smoke_assert(
    strpos($admin_script_js, 'const TAB_KEYS') === false
        && strpos($admin_script_js, 'var TAB_KEYS') === false
        && strpos($admin_script_js, 'function getTabKeys') !== false,
    'admin-script.js builds tab keys from DOM (no fixed TAB_KEYS)'
);
wdp_smoke_assert(
    strpos($admin_assets_php, 'var TAB_KEYS') === false
        && strpos($admin_assets_php, 'function getTabKeys') !== false,
    'Inline admin tabs script builds tab keys from DOM'
);
wdp_smoke_assert(
    in_array('placement', $wdp_tab_keys, true)
        && strpos($admin_page_renderer, 'id="wdp-placement-tab"') !== false,
    'Placement tab and panel are registered'
);

$wdp_includes_php = '';
foreach (glob(WDP_PLUGIN_DIR . 'includes/class-admin*.php') ?: array() as $wdp_admin_php_file) {
    $wdp_includes_php .= (string) file_get_contents($wdp_admin_php_file) . "\n";
}
$wdp_includes_php .= (string) file_get_contents(WDP_PLUGIN_DIR . 'includes/class-admin-renderer-helpers.php') . "\n";
preg_match_all('/id="(wdp-[a-z0-9\-]+-settings-form)"/', $wdp_includes_php, $wdp_form_matches);
$wdp_form_ids = array_values(array_unique($wdp_form_matches[1] ?? array()));
// Forms opened via open_form_container('…') without a literal id="…" attribute in the same file.
preg_match_all("/open_form_container\(\s*'([^']+)'/", $wdp_includes_php, $wdp_open_form_matches);
foreach ($wdp_open_form_matches[1] ?? array() as $wdp_open_form_id) {
    if (preg_match('/^wdp-.+-settings-form$/', $wdp_open_form_id) && !in_array($wdp_open_form_id, $wdp_form_ids, true)) {
        $wdp_form_ids[] = $wdp_open_form_id;
    }
}
wdp_smoke_assert($wdp_form_ids !== array(), 'Admin settings form ids discovered');
wdp_smoke_assert(
    strpos($admin_script_js, 'function bindSettingsForm') !== false
        && strpos($admin_script_js, 'function bindAllSettingsForms') !== false
        && strpos($admin_script_js, 'data-wdp-ajax-action') !== false
        && strpos($admin_script_js, 'bindAllSettingsForms()') !== false,
    'admin-script.js binds settings forms via data-wdp-ajax-action'
);
foreach ($wdp_form_ids as $wdp_form_id) {
    if (!preg_match('/^wdp-(.+)-settings-form$/', $wdp_form_id, $wdp_form_parts)) {
        wdp_smoke_assert(false, 'Unexpected settings form id: ' . $wdp_form_id);
        continue;
    }
    $wdp_ajax_action = 'wdp_save_' . str_replace('-', '_', $wdp_form_parts[1]) . '_settings';
    wdp_smoke_assert(
        strpos($wdp_includes_php, 'data-wdp-ajax-action="' . $wdp_ajax_action . '"') !== false
            || strpos($wdp_includes_php, "open_form_container('" . $wdp_form_id . "'") !== false,
        'Settings form has AJAX action markup: ' . $wdp_form_id
    );
    wdp_smoke_assert(
        strpos($admin_hooks_php, "wp_ajax_{$wdp_ajax_action}") !== false,
        'wp_ajax_ registered for ' . $wdp_ajax_action
    );
}

// 10.28.1: settings page self-check (each tab renderer + DOM shell).
$admin_selfcheck = require __DIR__ . '/admin-page-selfcheck.php';
if ((int) $admin_selfcheck > 0) {
    $failures += (int) $admin_selfcheck;
}

exit($failures > 0 ? 1 : 0);

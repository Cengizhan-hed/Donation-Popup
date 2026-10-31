<?php
/**
 * CLI smoke testleri — çalıştırma: php tests/smoke/run.php
 *
 * Ne işe yarar?
 * - Modül derlemelerinin (assets/build/<modül>/index.js + .asset.php) diskte olduğunu doğrular.
 * - Ad alanlı PHP sınıflarının yüklenebildiğini ve eski çekirdeğin (eski ön yüz, eski AJAX, eski paketler) gittiğini kontrol eder.
 * - Yayın öncesi "temel kırılma" riskini hızlıca yakalar (unit test değildir).
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require dirname(__DIR__) . '/support/os-junk.php';

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

foreach (array('experiences', 'campaign', 'thanks', 'side-cart', 'donor-account') as $wdp_module_build) {
    foreach (array('index.js', 'index.asset.php') as $wdp_build_file) {
        wdp_smoke_assert(
            file_exists(WDP_PLUGIN_DIR . 'assets/build/' . $wdp_module_build . '/' . $wdp_build_file),
            'Module build exists: ' . $wdp_module_build . '/' . $wdp_build_file
        );
    }
}

// Eski çekirdek gitti: eski ön yüz kaynakları, paketler, AJAX/şablon/trait dizinleri yok.
foreach (array(
    'assets/js/src',
    'assets/css/src',
    'assets/js/build',
    'assets/css/build',
    'includes/traits',
    'includes/templates',
    'includes/bootstrap',
    'includes/compat',
    'includes/i18n',
    'includes/class-ajax.php',
    'includes/class-cart.php',
    'includes/class-lazy-modal.php',
    'tools/build-css-bundle.php',
    'tools/build-js-bundle.php',
) as $wdp_gone) {
    wdp_smoke_assert(!file_exists(WDP_PLUGIN_DIR . $wdp_gone), 'Eski çekirdek kaldırıldı: ' . $wdp_gone);
}

wdp_smoke_assert(wdp_test_dir_absent_or_only_os_junk(WDP_PLUGIN_DIR . 'includes'), 'includes/ directory is gone (12.0.0)');
foreach (array(
    'DonationPanel\\Core\\Bootstrap',
    'DonationPanel\\Core\\Plugin',
    'DonationPanel\\Core\\Version_Migrations',
    'DonationPanel\\Core\\Release_12_Upgrade',
    'DonationPanel\\Core\\Uninstall',
    'DonationPanel\\Compat\\Public_Contract',
    'DonationPanel\\Domain\\Donation_Scope',
    'DonationPanel\\Domain\\Donation_Type',
    'DonationPanel\\Domain\\Campaign_Goal',
    'DonationPanel\\Domain\\Campaign_Totals',
    'DonationPanel\\Domain\\Addon_Product_Visibility',
    'DonationPanel\\Domain\\Placement_Settings',
    'DonationPanel\\Domain\\Product_Context',
    'DonationPanel\\WooCommerce\\Cart_Hooks',
    'DonationPanel\\WooCommerce\\Order_Hooks',
    'DonationPanel\\WooCommerce\\Order_Meta_Keys',
    'DonationPanel\\Privacy\\Order_Privacy',
    'DonationPanel\\Modules\\EntryPoints\\Shortcodes',
    'DonationPanel\\Modules\\EntryPoints\\Experience_Renderer',
    'DonationPanel\\Modules\\EntryPoints\\Render_Guard',
    'DonationPanel\\Modules\\EntryPoints\\Render_Registry',
    'DonationPanel\\Modules\\EntryPoints\\Donations_List',
    'DonationPanel\\Modules\\EntryPoints\\Product_Resolver',
    'DonationPanel\\Modules\\EntryPoints\\Auto_Placement',
    'DonationPanel\\Modules\\EntryPoints\\Blocks',
    'DonationPanel\\Support\\Price',
    'DonationPanel\\Support\\Security',
    'DonationPanel\\Support\\Phone_Countries',
) as $wdp_class) {
    wdp_smoke_assert(class_exists($wdp_class), $wdp_class . ' loads');
}
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'uninstall.php', 'WP_UNINSTALL_PLUGIN')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Core/class-uninstall.php', 'wdp_delete_data_on_uninstall'),
    'uninstall.php is guarded by WP_UNINSTALL_PLUGIN and the opt-in setting'
);
wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'assets/src/list/index.mjs') && file_exists(WDP_PLUGIN_DIR . 'assets/src/list/list.css'), 'List CSS/JS exist');
wdp_smoke_assert(file_exists(WDP_PLUGIN_DIR . 'blocks/donation-form/block.json') && file_exists(WDP_PLUGIN_DIR . 'blocks/donations/block.json'), 'Gutenberg block.json files exist');
wdp_smoke_assert(
    defined('WDP_VERSION') && 1 === preg_match('/^\d+\.\d+\.\d+$/', (string) WDP_VERSION),
    'Plugin version is a semantic version'
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
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/WooCommerce/class-cart-hooks.php', 'function should_reject_native_add_to_cart'),
    'Native add-to-cart unhook + server reject exist'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Modules/EntryPoints/class-shortcodes.php', 'Render_Guard::html')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Modules/EntryPoints/class-shortcodes.php', 'Experience_Renderer::render'),
    'Shortcodes render through Render_Guard and the experience bridge'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Core/class-version-migrations.php', 'step_10_28_5')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Domain/class-addon-product-visibility.php', 'clear_visibility_caches'),
    'Old data migrations and addon visibility cache clearing stay available'
);

// Admin: ürün "Donation" sekmesi (src/Admin/Product), ürün listesi sütunu/toplu işlemleri.
wdp_smoke_assert(class_exists('DonationPanel\\Domain\\Donation_Type'), 'Donation_Type loads');
wdp_smoke_assert(class_exists('DonationPanel\\Admin\\Product\\Product_Data_Tab'), 'Product_Data_Tab loads');
wdp_smoke_assert(class_exists('DonationPanel\\Admin\\Product\\Product_Settings'), 'Product_Settings loads');
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Admin/Product/class-product-admin.php', 'Product_Data_Tab::register()')
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Admin/class-admin-bootstrap.php', 'Product_Admin::init()'),
    'Product data tab hooks are registered'
);
wdp_smoke_assert(
    file_exists(WDP_PLUGIN_DIR . 'assets/src/admin-products/index.mjs') && file_exists(WDP_PLUGIN_DIR . 'assets/src/admin-products/products.css'),
    'Product tab JS/CSS source exists (wp-scripts)'
);
wdp_smoke_assert(
    !wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'assets/src/admin-products/index.mjs', 'jQuery'),
    'Product tab JS does not use jQuery'
);
wdp_smoke_assert(
    wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Admin/Product/class-product-assets.php', "'post.php'")
        && wdp_smoke_file_contains(WDP_PLUGIN_DIR . 'src/Admin/Product/class-product-assets.php', "'product' !== \$screen->post_type"),
    'Product tab assets load only on the product edit screen'
);
foreach (array('assets/css/admin/products.css', 'assets/js/admin/products.js') as $rel) {
    wdp_smoke_assert(!file_exists(WDP_PLUGIN_DIR . $rel), 'Old product tab asset removed: ' . $rel);
}

// 12.0.0: tek yönetici menüsü (src/Admin); eski ayar ekranı ve eski yönetici varlıkları kaldırıldı.
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

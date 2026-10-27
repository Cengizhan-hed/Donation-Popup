<?php
/**
 * E7: yeni yönetici deneyimi (ayar ekranı, sihirbaz, rehber, varlık kapsamı, strangler anahtarı).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Admin\Admin_Assets;
use DonationPanel\Admin\Admin_Bootstrap;
use DonationPanel\Admin\Guide;
use DonationPanel\Admin\Settings_Page;
use DonationPanel\Admin\Setup_Wizard;
use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Plugin;
use DonationPanel\Core\Settings;
use PHPUnit\Framework\TestCase;

if (!function_exists('add_submenu_page')) {
	function add_submenu_page($parent, $page_title, $menu_title, $capability, $slug, $callback = null) {
		WDP_Test_State::$options['__submenus'][] = array(
			'parent'     => (string) $parent,
			'capability' => (string) $capability,
			'slug'       => (string) $slug,
		);
		return (string) $parent . '_page_' . (string) $slug;
	}
}
if (!function_exists('register_setting')) {
	function register_setting($group, $name, $args = array()) {
		WDP_Test_State::$options['__registered_settings'][ (string) $name ] = array( 'group' => (string) $group, 'args' => $args );
	}
}
if (!function_exists('settings_fields')) {
	function settings_fields($group) {
		echo '<input type="hidden" name="option_page" value="' . esc_attr((string) $group) . '"><input type="hidden" name="_wpnonce" value="test-nonce">';
	}
}
if (!function_exists('settings_errors')) {
	function settings_errors(...$args) {}
}
if (!function_exists('esc_textarea')) {
	function esc_textarea($text) {
		return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
	}
}
if (!function_exists('has_filter')) {
	function has_filter($hook, $callback = false) {
		return isset(WDP_Test_State::$filters[ $hook ]);
	}
}
if (!function_exists('_n')) {
	function _n($single, $plural, $number, $domain = 'default') {
		return 1 === (int) $number ? $single : $plural;
	}
}
if (!function_exists('wp_script_add_data')) {
	function wp_script_add_data(...$args) {}
}

final class E7AdminTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$caps = array( 'manage_woocommerce' );
		if (class_exists(Admin_Bootstrap::class, false)) {
			Admin_Bootstrap::reset();
		}
	}

	private function page(): Settings_Page {
		$settings = new Settings();
		$registry = new Module_Registry($settings);
		Plugin::register_modules($registry);
		return new Settings_Page($settings, $registry);
	}

	private static function admin_files_loaded(): array {
		return array_values(
			array_filter(
				get_included_files(),
				static function ($file) {
					return false !== strpos($file, '/src/Admin/');
				}
			)
		);
	}

	public function test_default_admin_ui_is_legacy(): void {
		$this->assertSame('legacy', (new Settings())->get('admin.ui'));
		$this->assertFalse(Settings::admin_ui_is_new());
		$this->assertSame('', (new Settings())->get('admin.wizard'));
	}

	public function test_unknown_values_fall_back(): void {
		WDP_Test_State::$options[ Settings::OPTION_NAME ] = array( 'admin' => array( 'ui' => 'future', 'wizard' => 'weird' ) );
		$settings = new Settings();
		$this->assertSame('legacy', $settings->get('admin.ui'));
		$this->assertSame('', $settings->get('admin.wizard'));
	}

	public function test_setting_and_filter_switch_to_new_ui(): void {
		(new Settings())->update(array( 'admin' => array( 'ui' => 'new' ) ));
		$this->assertTrue(Settings::admin_ui_is_new());

		WDP_Test_State::reset();
		WDP_Test_State::$filters['donation_panel_admin_ui'] = static function () {
			return 'new';
		};
		$this->assertTrue(Settings::admin_ui_is_new());
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_legacy_ui_loads_no_admin_file(): void {
		WDP_Test_State::$is_admin = true;
		Plugin::boot()->on_plugins_loaded();
		// E8Q: yalniz kucuk gecis sinifi yuklenir; yeni ekran dosyalari yuklenmez.
		$loaded = array_map('basename', self::admin_files_loaded());
		$this->assertSame(array( 'class-ui-switch.php' ), $loaded);
		$this->assertArrayNotHasKey('admin_menu', WDP_Test_State::$actions);
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_new_ui_registers_menu_only_in_admin(): void {
		(new Settings())->update(array( 'admin' => array( 'ui' => 'new' ) ));

		WDP_Test_State::$is_admin = false;
		Plugin::boot()->on_plugins_loaded();
		$this->assertSame(array(), self::admin_files_loaded(), 'Yonetim alani disinda yuklenmemeli');

		Plugin::reset();
		WDP_Test_State::$is_admin = true;
		Plugin::boot()->on_plugins_loaded();
		$this->assertNotSame(array(), self::admin_files_loaded());
		$this->assertArrayHasKey('admin_menu', WDP_Test_State::$actions);
		$this->assertArrayHasKey('admin_post_donation_panel_wizard', WDP_Test_State::$actions);
	}

	public function test_menu_uses_woocommerce_capability_and_hides_wizard(): void {
		$container = new \DonationPanel\Core\Container();
		$container->instance(\DonationPanel\Core\Container::class, $container);
		$container->singleton(Settings::class, static function () {
			return new Settings();
		});
		$container->singleton(Module_Registry::class, static function ($c) {
			$r = new Module_Registry($c->get(Settings::class));
			Plugin::register_modules($r);
			return $r;
		});
		Admin_Bootstrap::init($container, WDP_PLUGIN_DIR, WDP_PLUGIN_URL);
		foreach (WDP_Test_State::$actions['admin_menu'] as $callback) {
			$callback();
		}
		$menus = WDP_Test_State::$options['__submenus'];
		$this->assertCount(3, $menus);
		foreach ($menus as $menu) {
			$this->assertSame('manage_woocommerce', $menu['capability']);
		}
		$by_slug = array_column($menus, 'parent', 'slug');
		$this->assertSame('woocommerce', $by_slug['donation-panel']);
		$this->assertSame('woocommerce', $by_slug['donation-panel-guide']);
		$this->assertSame('options.php', $by_slug['donation-panel-setup'], 'Sihirbaz menude gorunmemeli');
	}

	public function test_assets_load_only_on_own_screens(): void {
		$assets = new Admin_Assets(WDP_PLUGIN_DIR, WDP_PLUGIN_URL);
		$assets->own('woocommerce_page_donation-panel');
		foreach (array( 'plugins.php', 'index.php', 'woocommerce_page_wc-settings', 'woocommerce_page_wdp-popup-settings', 'edit.php' ) as $hook) {
			$assets->enqueue($hook);
		}
		$this->assertArrayNotHasKey('__enqueued_scripts', WDP_Test_State::$options);
		$this->assertArrayNotHasKey('__enqueued_styles', WDP_Test_State::$options);

		$assets->enqueue('woocommerce_page_donation-panel');
		$this->assertSame(array( 'donation-panel-admin' ), WDP_Test_State::$options['__enqueued_scripts']);
		$this->assertSame(array( 'donation-panel-admin' ), WDP_Test_State::$options['__enqueued_styles']);
	}

	public function test_register_uses_settings_api_with_woocommerce_capability(): void {
		$page = $this->page();
		$page->register();
		$this->assertArrayHasKey(Settings::OPTION_NAME, WDP_Test_State::$options['__registered_settings']);
		$this->assertSame('donation_panel', WDP_Test_State::$options['__registered_settings'][ Settings::OPTION_NAME ]['group']);
		$this->assertSame('manage_woocommerce', $page->capability());
	}

	public function test_sanitize_form_saves_modules_and_unchecked_means_off(): void {
		(new Settings())->update(array( 'modules' => array( 'thanks' => true, 'campaign' => true, 'entry_points' => true ) ));
		$page = $this->page();
		$out  = $page->sanitize(
			array(
				'_form'       => '1',
				'modules'     => array( 'impact' => '1', 'donor_account' => '1', 'not_a_module' => '1' ),
				'admin'       => array( 'ui' => 'new' ),
			)
		);
		$this->assertTrue($out['modules']['impact']);
		$this->assertTrue($out['modules']['donor_account']);
		$this->assertFalse($out['modules']['thanks']);
		$this->assertFalse($out['modules']['campaign']);
		$this->assertTrue($out['modules']['entry_points'], 'Anahtarda olmayan modul bayragi korunmali');
		$this->assertArrayNotHasKey('not_a_module', $out['modules']);
		$this->assertSame('new', $out['admin']['ui']);
		$this->assertFalse($out['general']['delete_data_on_uninstall']);
	}

	public function test_sanitize_rejects_bad_enum_values(): void {
		$page = $this->page();
		$out  = $page->sanitize(array( '_form' => '1', 'admin' => array( 'ui' => '<script>' ) ));
		$this->assertSame('legacy', $out['admin']['ui']);
	}

	public function test_sanitize_cleans_text_and_keeps_turkish_characters(): void {
		$page = $this->page();
		$out  = $page->sanitize(
			array(
				'_form'      => '1',
				'thanks'     => array( 'message' => "Bağışınız için çok teşekkürler <script>alert(1)</script>\nşğü" ),
				'tax_relief' => array( 'title' => "<b>Gift Aid</b> beyanı" ),
				'impact'     => array( 'map' => "25 = 1 gıda kolisi|gıda kolisi" ),
			)
		);
		$this->assertStringNotContainsString('<script>', $out['thanks']['message']);
		$this->assertStringContainsString('Bağışınız için çok teşekkürler', $out['thanks']['message']);
		$this->assertStringContainsString('şğü', $out['thanks']['message']);
		$this->assertStringNotContainsString('<b>', $out['tax_relief']['title']);
		$this->assertStringContainsString('gıda kolisi', $out['impact']['map']);
		$this->assertFalse($out['thanks']['celebrate'], 'Isaretsiz onay kutusu kapali olmali');
	}

	public function test_sanitize_without_form_marker_only_normalizes(): void {
		$page = $this->page();
		$out  = $page->sanitize(array( 'modules' => array( 'thanks' => true ) ));
		$this->assertTrue($out['modules']['thanks']);
		$this->assertSame(Settings::SCHEMA_VERSION, $out['version']);
	}

	public function test_sanitize_without_capability_changes_nothing(): void {
		WDP_Test_State::$caps = array();
		(new Settings())->update(array( 'modules' => array( 'thanks' => true ) ));
		$out = $this->page()->sanitize(array( '_form' => '1', 'modules' => array( 'campaign' => '1' ) ));
		$this->assertTrue($out['modules']['thanks']);
		$this->assertArrayNotHasKey('campaign', $out['modules']);
	}

	public function test_settings_persist_through_update_and_reload(): void {
		$page = $this->page();
		$out  = $page->sanitize(array( '_form' => '1', 'modules' => array( 'social_proof' => '1' ), 'thanks' => array( 'message' => 'Hoş geldiniz' ) ));
		update_option(Settings::OPTION_NAME, $out);
		$fresh = new Settings();
		$this->assertTrue($fresh->module_enabled('social_proof'));
		$this->assertSame('Hoş geldiniz', $fresh->get('thanks.message'));
	}

	public function test_settings_render_lists_every_module_and_each_has_help_text(): void {
		ob_start();
		$this->page()->render();
		$html = (string) ob_get_clean();

		foreach (array_keys(Settings_Page::module_definitions()) as $slug) {
			$this->assertStringContainsString('name="donation_panel_settings[modules][' . $slug . ']"', $html, $slug);
			$this->assertStringContainsString('id="dpa-mod-' . $slug . '-desc"', $html, $slug . ' aciklamasi yok');
		}
		$this->assertStringContainsString('name="option_page" value="donation_panel"', $html);
		$this->assertStringContainsString('name="donation_panel_settings[_form]"', $html);
		$this->assertStringNotContainsString('[experiences][engine]', $html);
		$this->assertStringContainsString('role="tablist"', $html);
		$this->assertStringContainsString('options.php', $html);
	}

	public function test_settings_render_denies_without_capability(): void {
		WDP_Test_State::$caps = array();
		$this->expectException(RuntimeException::class);
		$this->page()->render();
	}

	public function test_settings_render_escapes_saved_text(): void {
		WDP_Test_State::$options[ Settings::OPTION_NAME ] = array( 'thanks' => array( 'message' => '"><img src=x onerror=alert(1)>' ) );
		ob_start();
		$this->page()->render();
		$html = (string) ob_get_clean();
		$this->assertStringNotContainsString('<img src=x', $html);
	}

	public function test_wizard_goal_sets_module_defaults_and_marks_done(): void {
		$wizard = new Setup_Wizard(new Settings());
		$this->assertSame('done', $wizard->apply('done', 'campaign', false));
		$settings = new Settings();
		$this->assertTrue($settings->module_enabled('campaign'));
		$this->assertTrue($settings->module_enabled('impact'));
		$this->assertFalse($settings->module_enabled('donor_account', true));
		$this->assertSame('done', $settings->get('admin.wizard'));
		$this->assertNull($settings->get('experiences.engine'), 'Motor secimi yok (tek deneyim)');
	}

	public function test_wizard_try_new_form_and_unknown_goal(): void {
		$wizard = new Setup_Wizard(new Settings());
		$wizard->apply('done', 'nonsense', true);
		$settings = new Settings();
		$this->assertNull($settings->get('experiences.engine'));
		$this->assertFalse($settings->module_enabled('campaign', true), 'Bilinmeyen amac = sade');
	}

	public function test_wizard_skip_changes_no_module(): void {
		(new Settings())->update(array( 'modules' => array( 'thanks' => true ) ));
		$wizard = new Setup_Wizard(new Settings());
		$this->assertSame('skipped', $wizard->apply('anything', 'campaign', true));
		$settings = new Settings();
		$this->assertSame('skipped', $settings->get('admin.wizard'));
		$this->assertTrue($settings->module_enabled('thanks'));
		$this->assertNull($settings->get('experiences.engine'));
	}

	public function test_wizard_handle_requires_capability(): void {
		WDP_Test_State::$caps = array();
		$this->expectException(RuntimeException::class);
		(new Setup_Wizard(new Settings()))->handle();
	}

	public function test_wizard_render_has_four_steps_and_creates_no_product(): void {
		ob_start();
		(new Setup_Wizard(new Settings()))->render();
		$html = (string) ob_get_clean();
		foreach (array( 0, 1, 2, 3 ) as $step) {
			$this->assertStringContainsString('data-dpa-step="' . $step . '"', $html);
		}
		$this->assertStringContainsString('name="action" value="donation_panel_wizard"', $html);
		$this->assertStringContainsString('name="wizard_result" value="skipped"', $html);
		$this->assertStringContainsString('post_type=product', $html);
		$this->assertStringContainsString('[wdp_donation_button_panel]', $html);
	}

	public function test_guide_has_sections_and_help_tabs_text(): void {
		$sections = Guide::sections();
		foreach (array( 'placing', 'modules', 'trouble', 'currency', 'privacy' ) as $id) {
			$this->assertArrayHasKey($id, $sections);
			$this->assertNotSame('', $sections[ $id ]['title']);
			$this->assertNotEmpty($sections[ $id ]['body']);
		}
		$this->assertSame('[wdp_donation_button_panel]', $sections['placing']['code']);
		$this->assertStringContainsString('donation_panel_convert_amount', implode(' ', $sections['currency']['body']));

		ob_start();
		(new Guide())->render();
		$html = (string) ob_get_clean();
		$this->assertStringContainsString('id="dpa-g-trouble"', $html);
	}
}

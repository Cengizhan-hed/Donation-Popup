<?php
/**
 * 12.0.0 yönetici (adm): tek menü, alan kaydı bütünlüğü, ayar deposu (doğrulama, Türkçe, eski seçenek yansıtma/okuma),
 * durum kutusu hesapları (misafir ödeme uyarısı dahil), yönlendirme tablosu, varlık kapsamı.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use DonationPanel\Admin\Admin_Assets;
use DonationPanel\Admin\Admin_Bootstrap;
use DonationPanel\Admin\Field_Registry;
use DonationPanel\Admin\Settings_Store;
use DonationPanel\Admin\Setup_Wizard;
use DonationPanel\Admin\Status;
use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Plugin;
use DonationPanel\Core\Settings;
use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 2) . '/support/e0-stubs.php';
if (!function_exists('add_option')) {
	function add_option($key, $value = '', $deprecated = '', $autoload = 'yes') {
		WDP_Test_State::$options[ $key ] = $value;
		return true;
	}
}
if (!function_exists('add_menu_page')) {
	function add_menu_page($page_title, $menu_title, $capability, $slug, $callback = null, $icon = '', $position = null) {
		WDP_Test_State::$options['__menus'][] = array( 'slug' => (string) $slug, 'capability' => (string) $capability, 'icon' => (string) $icon );
		return 'toplevel_page_' . (string) $slug;
	}
}
if (!function_exists('add_submenu_page')) {
	function add_submenu_page($parent, $page_title, $menu_title, $capability, $slug, $callback = null) {
		WDP_Test_State::$options['__submenus'][] = array( 'parent' => (string) $parent, 'capability' => (string) $capability, 'slug' => (string) $slug );
		return (string) $parent . '_page_' . (string) $slug;
	}
}
if (!function_exists('_n')) {
	function _n($single, $plural, $number, $domain = 'default') {
		return 1 === (int) $number ? $single : $plural;
	}
}
if (!function_exists('get_post_status')) {
	function get_post_status($id = 0) {
		return isset(WDP_Test_State::$options['__post_status'][ (int) $id ]) ? WDP_Test_State::$options['__post_status'][ (int) $id ] : false;
	}
}
if (!function_exists('wp_style_add_data')) {
	function wp_style_add_data(...$args) {}
}

final class AdminTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$caps = array( 'manage_woocommerce' );
		if (class_exists(Admin_Bootstrap::class, false)) {
			Admin_Bootstrap::reset();
		}
	}

	private function store(): Settings_Store {
		return new Settings_Store(new Settings());
	}

	public function test_every_field_has_page_section_label_and_short_help(): void {
		$pages = Field_Registry::pages();
		$ids   = array();
		foreach (Field_Registry::fields() as $id => $spec) {
			$this->assertArrayHasKey($spec['page'], $pages, $id);
			$this->assertArrayHasKey($spec['section'], Field_Registry::sections($spec['page']), $id . ' bolumu');
			$this->assertNotSame('', $spec['label'], $id);
			$this->assertNotSame('', $spec['help'], $id . ' aciklamasi (her ayarin altinda kisa aciklama)');
			$this->assertContains($spec['type'], array( 'switch', 'text', 'textarea', 'select', 'cards', 'color', 'int', 'url' ), $id);
			list($group, $key) = explode('.', $id, 2);
			$this->assertArrayHasKey($key, Settings::schema()[ $group ], $id . ' Core semasinda olmali');
			$ids[] = $id;
		}
		$this->assertSame($ids, array_unique($ids));
	}

	public function test_every_setting_the_new_engine_reads_has_a_control(): void {
		$mapped = array();
		foreach (Field_Registry::fields() as $spec) {
			if (isset($spec['legacy'])) {
				$mapped[ $spec['legacy']['option'] ][] = $spec['legacy']['key'];
			}
		}
		$required = array(
			'wdp_button_settings'          => array( 'popup_button_text', 'popup_button_full_width', 'enable_amount_presets', 'amount_presets', 'enable_dedication', 'enable_anonymous', 'dedication_placeholder','enable_multi_step', 'brand_color' ),
			'wdp_success_settings'         => array( 'sadaka_wc_product_id', 'sadaka_toggle_label' ),
			'wdp_placement_settings'       => array( 'auto_place', 'position', 'display', 'hide_price', 'show_form_title', 'loop_button', 'donation_scope', 'donation_categories' ),
			'wdp_delete_data_on_uninstall' => array( '' ),
		);
		foreach ($required as $option => $keys) {
			foreach ($keys as $key) {
				$this->assertContains($key, $mapped[ $option ] ?? array(), $option . '.' . $key . ' icin yeni kontrol olmali (kayip 0)');
			}
		}
	}

	public function test_menu_order_is_exactly_the_approved_eight(): void {
		$this->assertSame(
			array( 'donation-panel', 'donation-panel-campaigns', 'donation-panel-forms', 'donation-panel-checkout', 'donation-panel-account', 'donation-panel-privacy', 'donation-panel-tools', 'donation-panel-guide' ),
			array_keys(Field_Registry::pages())
		);
	}

	public function test_single_top_level_menu_and_nothing_under_woocommerce(): void {
		$container = new Container();
		$container->instance(Container::class, $container);
		$container->singleton(Settings::class, static function () {
			return new Settings();
		});
		$container->singleton(Module_Registry::class, static function ($c) {
			$r = new Module_Registry($c->get(Settings::class));
			Plugin::register_modules($r);
			return $r;
		});
		WDP_Test_State::$is_admin = true;
		Admin_Bootstrap::init($container, WDP_PLUGIN_DIR, WDP_PLUGIN_URL);
		foreach (WDP_Test_State::$actions['admin_menu'] as $callback) {
			$callback();
		}
		$tops = WDP_Test_State::$options['__menus'];
		$this->assertCount(1, $tops);
		$this->assertSame('manage_woocommerce', $tops[0]['capability']);
		$this->assertStringStartsWith('data:image/svg+xml;base64,', $tops[0]['icon']);
		$subs = WDP_Test_State::$options['__submenus'];
		foreach ($subs as $sub) {
			$this->assertNotSame('woocommerce', $sub['parent'], 'WooCommerce altinda eklenti girisi olmamali');
			$this->assertSame('manage_woocommerce', $sub['capability']);
		}
		$visible = array_values(array_map(static function ($s) {
			return $s['slug'];
		}, array_filter($subs, static function ($s) {
			return 'donation-panel' === $s['parent'];
		})));
		$this->assertSame(array_keys(Field_Registry::pages()), $visible);
		$hidden = array_column($subs, 'parent', 'slug');
		$this->assertSame('options.php', $hidden['donation-panel-setup'], 'Sihirbaz menude gorunmemeli');
	}

	public function test_legacy_slugs_redirect_to_new_pages(): void {
		$map = Admin_Bootstrap::legacy_redirects();
		$this->assertSame('donation-panel', $map['wdp-popup-settings']);
		foreach ($map as $target) {
			$this->assertArrayHasKey($target, Field_Registry::pages());
		}
	}

	public function test_assets_load_only_on_own_screens(): void {
		$assets = new Admin_Assets(WDP_PLUGIN_DIR, WDP_PLUGIN_URL);
		$assets->own('toplevel_page_donation-panel');
		foreach (array( 'plugins.php', 'index.php', 'woocommerce_page_wc-settings', 'post.php', 'edit.php' ) as $hook) {
			$assets->enqueue($hook);
		}
		$this->assertArrayNotHasKey('__enqueued_scripts', WDP_Test_State::$options);
		$this->assertArrayNotHasKey('__enqueued_styles', WDP_Test_State::$options);
	}

	public function test_save_validates_and_keeps_turkish_characters(): void {
		$store = $this->store();
		$tr    = 'Bağışınız için çok teşekkürler: şğüıİöç ÇŞĞÜÖ';
		$saved = $store->save(array( 'design.button_text' => $tr, 'form.dedication' => true, 'display.mode' => 'popup' ), array( 'thanks' => true ));
		$this->assertIsArray($saved);
		$settings = new Settings();
		$this->assertSame($tr, $settings->get('design.button_text'));
		$this->assertTrue($settings->get('form.dedication'));
		$this->assertSame('popup', $settings->get('display.mode'));
		$this->assertTrue($settings->module_enabled('thanks'));
	}

	public function test_invalid_values_are_rejected_and_nothing_is_written(): void {
		$store = $this->store();
		foreach (array(
			array( 'design.brand' => 'blue' ),
			array( 'design.brand' => 'var(--a);color:red' ),
			array( 'design.accent' => 'url(x)' ),
			array( 'display.mode' => 'fullscreen' ),
			array( 'form.presets' => '25, abc' ),
			array( 'form.presets' => '1, 2, 3, 4, 5, 6, 7' ),
			array( 'not.a_field' => '1' ),
		) as $bad) {
			$out = $store->save($bad);
			$this->assertTrue(is_wp_error($out), json_encode($bad));
		}
		$mixed = $store->save(array( 'form.dedication' => true, 'display.mode' => 'nope' ));
		$this->assertTrue(is_wp_error($mixed));
		$this->assertArrayNotHasKey(Settings::OPTION_NAME, WDP_Test_State::$options, 'Tek gecersiz deger varken hicbir sey yazilmamali');
		$unknown = $store->save(array(), array( 'bogus' => true ));
		$this->assertTrue(is_wp_error($unknown));
	}

	public function test_color_fields_accept_hex_and_css_variable(): void {
		$store = $this->store();
		$this->assertSame('#12305a', $store->sanitize_value('design.brand', '#12305a'));
		$this->assertSame('var(--e-global-color-primary)', $store->sanitize_value('design.brand', ' var(--e-global-color-primary) '));
		$this->assertSame('var(--wp--preset--color--accent, #aabbcc)', $store->sanitize_value('design.accent', 'var(--wp--preset--color--accent,#abc)'));
		$this->assertSame('', $store->sanitize_value('design.brand', ''));
		$this->assertTrue(is_wp_error($store->sanitize_value('design.brand', 'var(--a, var(--b))')));
	}

	public function test_presets_are_normalized(): void {
		$store = $this->store();
		$this->assertSame('25, 50, 100', $store->sanitize_value('form.presets', ' 25,50 , 100,50'));
		$this->assertSame('', $store->sanitize_value('form.presets', ''));
		$this->assertSame('9,3', $store->sanitize_value('placement.categories', '9, x, 3, 3'));
	}

	public function test_mirror_writes_legacy_options_without_dropping_other_keys(): void {
		WDP_Test_State::$options['wdp_button_settings']    = array( 'brand_color' => '#112233', 'enable_multi_step' => '1' );
		WDP_Test_State::$options['wdp_placement_settings'] = array( 'loop_button' => 'panel' );
		$this->store()->save(
			array(
				'form.dedication'     => true,
				'form.anonymous'      => false,
				'form.presets'        => '10, 20',
				'display.mode'        => 'inline',
				'placement.auto_place' => false,
				'placement.categories' => '4, 2',
			)
		);
		$button = WDP_Test_State::$options['wdp_button_settings'];
		$this->assertSame('1', $button['enable_dedication']);
		$this->assertSame('0', $button['enable_anonymous']);
		$this->assertSame('10, 20', $button['amount_presets']);
		$this->assertSame('#112233', $button['brand_color'], 'Baska anahtarlar korunmali');
		$this->assertSame('1', $button['enable_multi_step']);
		$place = WDP_Test_State::$options['wdp_placement_settings'];
		$this->assertSame('inline', $place['display']);
		$this->assertSame('no', $place['auto_place']);
		$this->assertSame(array( 4, 2 ), $place['donation_categories']);
		$this->assertSame('panel', $place['loop_button']);
	}

	public function test_custom_colors_are_mirrored_only_when_chosen(): void {
		$store = $this->store();
		$store->save(array( 'design.colors' => 'theme', 'design.brand' => '#aa0000', 'design.accent' => '#00aa00' ));
		$this->assertArrayNotHasKey('wdp_button_settings', WDP_Test_State::$options, 'Tema renkleri secili: eski renk yazilmamali');
		$store->save(array( 'design.colors' => 'custom' ));
		$this->assertSame('#aa0000', WDP_Test_State::$options['wdp_button_settings']['brand_color']);
		$this->assertSame('#00aa00', WDP_Test_State::$options['wdp_button_settings']['popup_button_color']);
	}

	public function test_get_falls_back_to_legacy_options_and_stored_value_wins(): void {
		WDP_Test_State::$options['wdp_button_settings']    = array( 'enable_dedication' => '1', 'popup_button_text' => 'Bağış Yap', 'amount_presets' => '5, 10' );
		WDP_Test_State::$options['wdp_placement_settings'] = array( 'display' => 'button_popup', 'auto_place' => 'no', 'donation_categories' => array( 7, 8 ) );
		$store = $this->store();
		$this->assertTrue($store->get('form.dedication'));
		$this->assertSame('Bağış Yap', $store->get('design.button_text'));
		$this->assertSame('5, 10', $store->get('form.presets'));
		$this->assertSame('popup', $store->get('display.mode'));
		$this->assertFalse($store->get('placement.auto_place'));
		$this->assertSame('7, 8', $store->get('placement.categories'));
		$store->save(array( 'form.dedication' => false ));
		$this->assertFalse($store->get('form.dedication'), 'Kayitli yeni deger eskiyi ezer');
	}

	public function test_delete_data_flag_mirrors_the_scalar_legacy_option(): void {
		$this->store()->save(array( 'general.delete_data_on_uninstall' => true ));
		$this->assertSame('1', WDP_Test_State::$options['wdp_delete_data_on_uninstall']);
		$this->store()->save(array( 'general.delete_data_on_uninstall' => false ));
		$this->assertSame('0', WDP_Test_State::$options['wdp_delete_data_on_uninstall']);
	}

	public function test_guest_checkout_warning_and_privacy_status(): void {
		$status = new Status(new Settings());
		WDP_Test_State::$options['woocommerce_enable_guest_checkout'] = 'yes';
		$this->assertTrue($status->guest_checkout_enabled());
		WDP_Test_State::$options['woocommerce_enable_guest_checkout'] = 'no';
		$this->assertFalse($status->guest_checkout_enabled());
		$items = array_column($status->items(), null, 'id');
		$this->assertFalse($items['guest']['ok']);
		$this->assertStringContainsString('wc-settings&tab=account', $items['guest']['url']);

		$this->assertFalse($status->privacy_page_linked());
		WDP_Test_State::$options['wp_page_for_privacy_policy'] = 55;
		WDP_Test_State::$options['__post_status'][55]          = 'publish';
		$this->assertTrue($status->privacy_page_linked());
		WDP_Test_State::$options['__post_status'][55] = 'draft';
		$this->assertFalse($status->privacy_page_linked());
	}

	public function test_progress_has_six_steps_and_wizard_step_counts(): void {
		$status = new Status(new Settings());
		$this->assertCount(6, $status->steps());
		$before = $status->progress();
		(new Settings())->update(array( 'admin' => array( 'wizard' => 'done' ) ));
		$this->assertSame($before + 1, (new Status(new Settings()))->progress());
	}

	public function test_wizard_progress_is_persistent_and_bounded(): void {
		$settings = new Settings();
		$wizard   = new Setup_Wizard($settings, $this->store());
		$this->assertSame(1, $wizard->current_step());
		$settings->update(array( 'admin' => array( 'wizard_step' => 4 ) ));
		$this->assertSame(4, (new Setup_Wizard(new Settings(), $this->store()))->current_step());
		$settings->update(array( 'admin' => array( 'wizard_step' => 99 ) ));
		$this->assertSame(Setup_Wizard::STEP_COUNT, (new Setup_Wizard(new Settings(), $this->store()))->current_step());
		$this->assertCount(5, Setup_Wizard::step_labels());
	}

	public function test_side_cart_settings_have_controls_and_validate(): void {
		$fields = Field_Registry::fields();
		foreach (array( 'side_cart.floating', 'side_cart.position', 'side_cart.suggest', 'side_cart.suggest_product', 'side_cart.suggest_amounts', 'side_cart.suggest_hint' ) as $id) {
			$this->assertArrayHasKey($id, $fields, $id);
			$this->assertSame('basket', $fields[ $id ]['section'], $id . ' Yan sepet bolumunde');
		}
		$store = $this->store();
		$this->assertSame('start', $store->sanitize_value('side_cart.position', 'start'));
		$this->assertTrue(is_wp_error($store->sanitize_value('side_cart.position', 'top')));
		$this->assertSame('25, 75', $store->sanitize_value('side_cart.suggest_amounts', ' 25,75 ,25'));
		$this->assertTrue(is_wp_error($store->sanitize_value('side_cart.suggest_amounts', '1, 2, 3, 4')));
		$this->assertTrue(is_wp_error($store->sanitize_value('side_cart.suggest_amounts', 'ten')));
		$this->assertSame('', $store->sanitize_value('side_cart.suggest_amounts', ''));
		$this->assertSame(5, $store->sanitize_value('side_cart.suggest_product', '-5'));
	}

	public function test_side_cart_suggestion_comes_from_settings_and_falls_back_to_addon_product(): void {
		$this->assertSame(array(), \DonationPanel\Modules\SideCart\Side_Cart_Suggestion::from_settings(new Settings()), 'Varsayilan: oneri yok');
		$settings = new Settings();
		$settings->update(array(
			'side_cart' => array( 'suggest' => true, 'suggest_product' => 0, 'suggest_amounts' => '25, 75', 'suggest_hint' => 'Küçük bir katkı' ),
			'checkout'  => array( 'addon_product_id' => 321 ),
		));
		$raw = \DonationPanel\Modules\SideCart\Side_Cart_Suggestion::from_settings(new Settings());
		$this->assertSame(321, $raw['product_id']);
		$this->assertSame('Küçük bir katkı', $raw['hint']);
		$clean = \DonationPanel\Modules\SideCart\Side_Cart_Suggestion::sanitize($raw);
		$this->assertSame(array( 25.0, 75.0 ), $clean['amounts']);
		$settings->update(array( 'side_cart' => array( 'suggest_product' => 55 ) ));
		$this->assertSame(55, \DonationPanel\Modules\SideCart\Side_Cart_Suggestion::from_settings(new Settings())['product_id']);
	}

	public function test_side_cart_type_tag_is_translated_label_or_nothing(): void {
		$this->assertSame(\DonationPanel\Domain\Donation_Type::get_label('shares'), \DonationPanel\Modules\SideCart\Side_Cart_Renderer::type_label('shares'));
		$this->assertNotSame('', \DonationPanel\Modules\SideCart\Side_Cart_Renderer::type_label('shares'));
		$this->assertSame('', \DonationPanel\Modules\SideCart\Side_Cart_Renderer::type_label('general'), 'Ham slug bagisciya gosterilmez');
	}

	public function test_floating_button_corner_follows_setting(): void {
		$this->assertStringContainsString('donation-panel-sc__fab--start', \DonationPanel\Modules\SideCart\Side_Cart_Renderer::floating_button(0, 'start'));
		$this->assertStringNotContainsString('--start', \DonationPanel\Modules\SideCart\Side_Cart_Renderer::floating_button(0, 'end'));
		$this->assertStringNotContainsString('--start', \DonationPanel\Modules\SideCart\Side_Cart_Renderer::floating_button(0));
	}

	public function test_colors_note_writes_each_color_source(): void {
		$palette = array( 'theme' => array( array( 'slug' => 'primary', 'name' => 'Primary', 'color' => '#1d3557' ) ) );
		$res     = \DonationPanel\Frontend\Theme_Colors::resolve($palette);
		$html    = \DonationPanel\Admin\Admin_View::colors_note('theme', $res);
		$this->assertStringContainsString('data-dpa-color-source="primary:theme"', $html);
		// Dil bağımsız: beklenen metinler aynı çeviri işlevinden.
		$theme_src = sprintf(__('Theme palette: %s', 'woo-donation-popup'), 'primary');
		$this->assertStringContainsString($theme_src, $html);
		$this->assertStringContainsString('data-dpa-color-source="action:primary"', $html);
		$this->assertStringContainsString(__('Follows the main color', 'woo-donation-popup'), $html);
		$none = \DonationPanel\Frontend\Theme_Colors::resolve(array());
		$html = \DonationPanel\Admin\Admin_View::colors_note('none', $none);
		$this->assertStringContainsString('data-dpa-colors-note="none"', $html);
		$this->assertStringContainsString('#' . \DonationPanel\Frontend\Theme_Colors::DEFAULT_PRIMARY, $html);
		$this->assertStringContainsString('data-dpa-color-source="primary:default"', $html);
		$empty = sprintf(__('Empty: %1$s (%2$s).', 'woo-donation-popup'), $theme_src, '#1d3557');
		$this->assertSame($empty, \DonationPanel\Admin\Admin_View::color_fallback_text($res['primary']));
		$this->assertSame(__('Empty: the button follows the main color.', 'woo-donation-popup'), \DonationPanel\Admin\Admin_View::color_fallback_text($res['action']));
		$field = \DonationPanel\Admin\Admin_View::field('design.brand', \DonationPanel\Admin\Admin_View::with_color_source(Field_Registry::fields()['design.brand'], $res['primary']), '#7a1f5c');
		$this->assertStringContainsString(__('Source: your choice.', 'woo-donation-popup'), $field);
		$this->assertStringContainsString('data-dpa-color-fallback="' . esc_attr($empty) . '"', $field);
	}

	public function test_module_definitions_cover_all_seven_and_all_exist_in_registry(): void {
		$registry = new Module_Registry(new Settings());
		Plugin::register_modules($registry);
		$defs = Settings_Store::module_definitions();
		$this->assertSame(array( 'campaign', 'impact', 'side_cart', 'donor_account', 'social_proof', 'thanks', 'tax_relief' ), array_keys($defs));
		foreach (array_keys($defs) as $slug) {
			$this->assertIsBool($registry->is_enabled($slug), $slug);
		}
	}
}

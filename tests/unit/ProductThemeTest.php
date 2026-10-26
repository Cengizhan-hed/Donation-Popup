<?php
/**
 * 10.32.0 — Bu ürüne özel görünüm: renk önceliği, hex, türevler, köşe, yoğunluk, aydınlatma.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class ProductThemeTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'brand_color'          => '#0f608b',
			'button_primary_color' => '#0f608b',
			'ui_border_radius'     => 12,
		);
	}

	public function test_primary_priority_product_over_brand(): void {
		WDP_Test_State::$post_meta[10] = array(
			'_theme_primary' => '#aabbcc',
		);
		$this->assertSame(
			'#aabbcc',
			WDP_Form_Modules::resolve_product_primary_color(10)
		);
		$this->assertSame(
			'#aabbcc',
			WDP_Form_Modules::resolve_product_shell_primary(10)
		);

		WDP_Test_State::$post_meta[10]['_theme_primary'] = '';
		$this->assertSame('', WDP_Form_Modules::resolve_product_shell_primary(10));
		$this->assertSame('#0f608b', WDP_Form_Modules::resolve_product_primary_color(10));
	}

	public function test_inherit_flag_ignored_in_theme_style(): void {
		WDP_Test_State::$post_meta[11] = array(
			'_theme_primary'                => '#abcdef',
			'_theme_inherit_category_color' => 'yes',
		);
		$style = WDP_Form_Modules::build_product_theme_style(11);
		$this->assertStringContainsString('--wdp-primary:#abcdef', $style);
	}

	public function test_hex_without_hash_accepted(): void {
		$meta = WDP_Product_Settings_Service::from_request(array( 'theme_primary' => '036a37' ));
		$this->assertSame('#036a37', $meta['_theme_primary']);
	}

	public function test_invalid_hex_rejects_with_error(): void {
		$meta = WDP_Product_Settings_Service::from_product_panel(
			array( 'theme_primary' => 'not-a-color' ),
			array( '_theme_primary' => '#112233' )
		);
		$this->assertSame('#112233', $meta['_theme_primary']);
		$notes = WDP_Product_Settings_Service::drain_corrections();
		$this->assertNotEmpty($notes);
		$this->assertStringContainsString('Ana renk', $notes[0]);
	}

	public function test_empty_hex_clears(): void {
		$meta = WDP_Product_Settings_Service::from_request(array( 'theme_primary' => '' ));
		$this->assertSame('', $meta['_theme_primary']);
	}

	public function test_palette_derivatives_and_on_primary(): void {
		WDP_Test_State::$post_meta[12] = array( '_theme_primary' => '#036a37' );
		$style = WDP_Form_Modules::build_product_theme_style(12);
		$this->assertStringContainsString('--wdp-primary:#036a37', $style);
		$this->assertStringContainsString('--wdp-primary-hover:', $style);
		$this->assertStringContainsString('--wdp-primary-soft:', $style);
		$this->assertStringContainsString('--wdp-on-primary:', $style);
		$this->assertStringContainsString('--wdp-primary-border:', $style);

		$yellow = WDP_Color_Palette::from_hex('#f4e04d');
		$this->assertSame('#0f172a', $yellow['on_primary']);
		$this->assertGreaterThanOrEqual(4.5, WDP_Color_Palette::contrast_ratio('#f4e04d', $yellow['on_primary']));

		$blue = WDP_Color_Palette::from_hex('#0f608b');
		$this->assertSame('#ffffff', $blue['on_primary']);
		$this->assertGreaterThanOrEqual(4.5, WDP_Color_Palette::contrast_ratio('#0f608b', $blue['on_primary']));

		$style = WDP_Form_Modules::build_product_theme_style(12);
		$this->assertStringContainsString('--wdp-shareholder-header-bg:#036a37', $style);
		$this->assertStringContainsString('--wdp-shareholder-header-color:', $style);
	}

	public function test_readable_ink_meets_aa_on_light_and_dark(): void {
		$light = WDP_Color_Palette::readable_ink('#fafbfc', '#ffffff');
		$this->assertSame('#0f172a', $light);
		$this->assertGreaterThanOrEqual(4.5, WDP_Color_Palette::contrast_ratio('#fafbfc', $light));

		$dark = WDP_Color_Palette::readable_ink('#0f608b', '#ffffff');
		$this->assertSame('#ffffff', $dark);
		$this->assertGreaterThanOrEqual(4.5, WDP_Color_Palette::contrast_ratio('#0f608b', $dark));
	}

	public function test_contrast_warning_note_does_not_block(): void {
		// Near-mid gray: both inks may stay under 4.5 — warning only.
		$meta = WDP_Product_Settings_Service::from_request(array( 'theme_primary' => '#777777' ));
		$this->assertSame('#777777', $meta['_theme_primary']);
		$notes = WDP_Product_Settings_Service::drain_corrections();
		$joined = implode(' ', $notes);
		$this->assertStringContainsString('kontrast', mb_strtolower($joined));
	}

	public function test_dark_modal_bg_text_vars(): void {
		WDP_Test_State::$post_meta[13] = array( '_theme_modal_bg' => '#0f172a' );
		$style = WDP_Form_Modules::build_product_theme_style(13);
		$this->assertStringContainsString('--wdp-modal-bg:#0f172a', $style);
		$this->assertStringContainsString('--wdp-text-primary:#f8fafc', $style);
		$this->assertTrue(WDP_Color_Palette::is_dark_surface('#0f172a'));
		$this->assertFalse(WDP_Color_Palette::is_dark_surface('#ffffff'));
	}

	public function test_radius_clamp_and_notes(): void {
		$meta3 = WDP_Product_Settings_Service::from_request(array( 'theme_radius' => '3' ));
		$this->assertSame('4', $meta3['_theme_radius']);
		$notes3 = WDP_Product_Settings_Service::drain_corrections();
		$this->assertNotEmpty($notes3);

		$meta40 = WDP_Product_Settings_Service::from_request(array( 'theme_radius' => '40' ));
		$this->assertSame('32', $meta40['_theme_radius']);

		$meta33 = WDP_Product_Settings_Service::from_request(array( 'theme_radius' => '33' ));
		$this->assertSame('32', $meta33['_theme_radius']);

		$empty = WDP_Product_Settings_Service::from_request(array( 'theme_radius' => '' ));
		$this->assertSame('', $empty['_theme_radius']);

		$this->assertSame(4, WDP_Form_Modules::clamp_product_theme_radius(3));
		$this->assertSame(32, WDP_Form_Modules::clamp_product_theme_radius(40));
		$this->assertSame(0, WDP_Form_Modules::clamp_product_theme_radius(0));

		WDP_Test_State::$post_meta[14] = array( '_theme_radius' => '3' );
		$style = WDP_Form_Modules::build_product_theme_style(14);
		$this->assertStringContainsString('--wdp-radius-ui:4px', $style);
	}

	public function test_panel_radius_ratio(): void {
		$ladder = WDP_Form_Modules::product_radius_ladder(24);
		// global ui=12, panel=20 → ratio 2 → panel 40
		$this->assertSame(24, $ladder['ui']);
		$this->assertSame(40, $ladder['panel']);
		$this->assertSame(40, $ladder['sheet']);
		$this->assertSame(40, $ladder['lg']);

		WDP_Test_State::$post_meta[15] = array( '_theme_radius' => '24' );
		$style = WDP_Form_Modules::build_product_theme_style(15);
		$this->assertStringContainsString('--wdp-radius-panel:40px', $style);
		$this->assertStringContainsString('--wdp-radius-sheet:40px', $style);
	}

	public function test_density_not_in_output(): void {
		WDP_Test_State::$post_meta[16] = array(
			'_theme_primary' => '#036a37',
			'_theme_density' => 'compact',
		);
		$style = WDP_Form_Modules::build_product_theme_style(16);
		$this->assertStringNotContainsString('--wdp-density', $style);

		$meta = WDP_Product_Settings_Service::from_request(array( 'theme_density' => 'compact' ));
		$this->assertArrayNotHasKey('_theme_density', $meta);
	}

	public function test_theme_preset_id_not_read_or_written(): void {
		$meta = WDP_Product_Settings_Service::from_request(array( 'theme_preset_id' => 'ocean' ));
		$this->assertArrayNotHasKey('_theme_preset_id', $meta);

		$p = new WC_Product(17);
		$p->type = 'simple';
		WDP_Test_State::$products[17] = $p;
		WDP_Test_State::$post_meta[17] = array( '_theme_preset_id' => 'ocean' );
		$ctx = \DonationPanel\Domain\Product_Context::build_form_context($p);
		$this->assertArrayNotHasKey('theme_preset_id', $ctx);
	}

	public function test_title_style_uses_product_primary(): void {
		WDP_Test_State::$post_meta[18] = array( '_theme_primary' => '#998877' );
		$attr = WDP_Form_Modules::get_title_style_attr(18);
		$this->assertStringContainsString('#998877', $attr);

		WDP_Test_State::$post_meta[18]['_theme_primary'] = '';
		$this->assertSame('', WDP_Form_Modules::get_title_style_attr(18));
	}

	public function test_privacy_default_label_and_migration(): void {
		$label = WDP_Donation_Optional_Fields::default_privacy_link_label();
		$this->assertSame('Kişisel verilerin işlenmesine ilişkin aydınlatma metni', $label);

		WDP_Test_State::$options['wdp_button_settings'] = array(
			'enable_privacy_notice' => '1',
			'privacy_notice_text'   => '',
			'privacy_notice_url'    => 'https://example.test/p',
		);
		$n = WDP_Donation_Optional_Fields::resolve_privacy_notice(array( 'has_email' => true ));
		$this->assertSame($label, $n['link_label']);
		$html = WDP_Donation_Optional_Fields::render_privacy_notice_html(array( 'has_email' => true ));
		$this->assertStringContainsString($label, $html);
		$this->assertStringNotContainsString('yurt dışındaki saha', $html);

		$this->assertArrayHasKey('10.32.0', \DonationPanel\Core\Version_Migrations::steps());
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'privacy_notice_text' => 'Kişisel verileriniz Aydınlatma Metni kapsamında işlenir.',
		);
		unset(WDP_Test_State::$options['wdp_migrated_10_32_0']);
		$summary = \DonationPanel\Core\Version_Migrations::step_10_32_0(false);
		$this->assertStringContainsString('cleared_legacy_default', $summary);
		$this->assertSame('', WDP_Test_State::$options['wdp_button_settings']['privacy_notice_text']);

		WDP_Test_State::$options['wdp_button_settings']['privacy_notice_text'] = 'Özel KVKK cümlem';
		unset(WDP_Test_State::$options['wdp_migrated_10_32_0']);
		\DonationPanel\Core\Version_Migrations::step_10_32_0(false);
		$this->assertSame('Özel KVKK cümlem', WDP_Test_State::$options['wdp_button_settings']['privacy_notice_text']);
	}

	public function test_media_warning_flag_in_panel_values(): void {
		$p = new WC_Product(19);
		$p->type     = 'simple';
		$p->image_id = 0;
		WDP_Test_State::$products[19]  = $p;
		WDP_Test_State::$post_meta[19] = array( '_enable_campaign_media' => 'yes' );
		$ref = new ReflectionMethod('WDP_Admin_Product_Data_Tab', 'get_panel_values');
		$ref->setAccessible(true);
		$values = $ref->invoke(null, $p);
		$this->assertSame('yes', $values['enable_campaign_media']);
		$this->assertSame('no', $values['has_featured_image']);

		$p->image_id = 99;
		$values2     = $ref->invoke(null, $p);
		$this->assertSame('yes', $values2['has_featured_image']);
	}
}

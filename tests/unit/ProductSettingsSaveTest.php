<?php
/**
 * Ürün "Bağış" paneli ve eski AJAX kaydının meta normalizasyonu testleri.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class ProductSettingsSaveTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_donation_type_overrides_legacy_flags(): void {
		$meta = WDP_Product_Settings_Service::from_request(
			array(
				'donation_type'         => 'campaign',
				'allow_multiple_shares' => 'yes',
				'allow_custom_price'    => 'no',
			)
		);

		$this->assertSame('yes', $meta['_allow_custom_price']);
		$this->assertSame('no', $meta['_allow_multiple_shares']);
		$this->assertSame('yes', $meta['_enable_progress_bar']);
	}

	public function test_invalid_donation_type_falls_back_to_legacy_flags(): void {
		$meta = WDP_Product_Settings_Service::from_request(
			array(
				'donation_type'         => 'everything',
				'allow_multiple_shares' => '1',
			)
		);

		$this->assertSame('yes', $meta['_allow_multiple_shares']);
		$this->assertSame(\DonationPanel\Domain\Donation_Type::SHARES, \DonationPanel\Domain\Donation_Type::infer_from_meta($meta));
	}

	public function test_legacy_flag_exclusivity_is_unchanged(): void {
		$meta = WDP_Product_Settings_Service::from_request(
			array(
				'allow_custom_price'    => 'true',
				'allow_multiple_shares' => 'true',
				'enable_progress_bar'   => 'true',
			)
		);

		$this->assertSame('yes', $meta['_enable_progress_bar']);
		$this->assertSame('yes', $meta['_allow_custom_price']);
		$this->assertSame('no', $meta['_allow_multiple_shares']);
	}

	public function test_every_type_saves_and_infers_back(): void {
		foreach (\DonationPanel\Domain\Donation_Type::ids() as $type) {
			$meta = WDP_Product_Settings_Service::from_product_panel(array('donation_type' => $type));
			$this->assertSame($type, \DonationPanel\Domain\Donation_Type::infer_from_meta($meta), $type);
		}
	}

	public function test_panel_keeps_the_same_meta_keys_as_legacy_save(): void {
		$this->assertSame(
			array_keys(WDP_Product_Settings_Service::from_request(array())),
			array_keys(WDP_Product_Settings_Service::from_product_panel(array()))
		);
	}

	public function test_panel_unchecked_checkboxes_are_saved_as_no(): void {
		$meta = WDP_Product_Settings_Service::from_product_panel(
			array(
				'donation_type'   => 'fixed',
				'enable_urgency'  => 'yes',
			)
		);

		$this->assertSame('yes', $meta['_enable_urgency']);
		// Legacy defaults are "on" when the key is missing; the panel must turn them off.
		$this->assertSame('no', $meta['_enable_trust_strip']);
		$this->assertSame('no', $meta['_enable_quantity']);
		$this->assertSame('no', $meta['_enable_amount_presets']);
		// 10.30.0: wizard / alan ikonları üçlü select; POST'ta yoksa genel ayar ('').
		$this->assertSame('', $meta['_enable_field_icons']);
		$this->assertSame('', $meta['_enable_wizard']);
	}

	public function test_tristate_fields(): void {
		$meta = WDP_Product_Settings_Service::from_product_panel(
			array(
				'enable_email'       => 'yes',
				'enable_dedication'  => 'no',
				'enable_anonymous'   => '',
				'enable_wizard'      => 'yes',
				'enable_field_icons' => 'no',
			)
		);

		$this->assertSame('yes', $meta['_enable_email']);
		$this->assertSame('no', $meta['_enable_dedication']);
		$this->assertSame('', $meta['_enable_anonymous']);
		$this->assertSame('yes', $meta['_enable_wizard']);
		$this->assertSame('no', $meta['_enable_field_icons']);

		$this->assertSame('yes', WDP_Product_Settings_Service::parse_tristate_flag(true));
		$this->assertSame('', WDP_Product_Settings_Service::parse_tristate_flag(false));
		$this->assertSame('', WDP_Product_Settings_Service::parse_tristate_flag(null));
		$this->assertSame('yes', WDP_Product_Settings_Service::parse_tristate_flag('ON'));
		$this->assertSame('no', WDP_Product_Settings_Service::parse_tristate_flag(' No '));
		$this->assertSame('', WDP_Product_Settings_Service::parse_tristate_flag('maybe'));
	}

	public function test_trust_badges_are_stored_in_the_legacy_json_format_with_unicode_intact(): void {
		$meta = WDP_Product_Settings_Service::from_product_panel(
			array(
				'trust_badges' => array(
					3 => array('icon' => 'builtin:heart', 'text' => 'Güvenli ödeme'),
					7 => array('icon' => 'builtin:heart', 'text' => ''),
					9 => 'not-a-row',
				),
			)
		);

		$this->assertStringNotContainsString('\\u', $meta['_trust_badges']);
		$this->assertSame(
			array(array('icon' => 'builtin:heart', 'text' => 'Güvenli ödeme')),
			json_decode($meta['_trust_badges'], true)
		);
	}

	public function test_empty_repeaters_store_empty_string(): void {
		$meta = WDP_Product_Settings_Service::from_product_panel(array('trust_badges' => 'junk'));

		$this->assertSame('', $meta['_trust_badges']);
	}

	public function test_block_order_and_celebration_are_no_longer_written(): void {
		$meta = WDP_Product_Settings_Service::from_product_panel(
			array('module_order' => array('urgency', 'media'), 'module_order_custom' => 'yes', 'progress_celebrate' => 'yes')
		);
		$this->assertArrayNotHasKey('_wdp_module_order', $meta);
		$this->assertArrayNotHasKey('_progress_celebrate', $meta);
	}

	public function test_theme_preset_id_not_written(): void {
		$meta = WDP_Product_Settings_Service::from_product_panel(array(), array( '_theme_preset_id' => 'ocean' ));
		$this->assertArrayNotHasKey('_theme_preset_id', $meta);

		$legacy = WDP_Product_Settings_Service::from_request(array( 'theme_preset_id' => 'forest' ));
		$this->assertArrayNotHasKey('_theme_preset_id', $legacy);
	}

	public function test_max_shares_zero_or_empty_falls_back_to_default(): void {
		$this->assertSame('', WDP_Product_Settings_Service::from_request(array('max_shares' => '0'))['_max_shares']);
		$this->assertSame('', WDP_Product_Settings_Service::from_request(array('max_shares' => ''))['_max_shares']);
		$this->assertSame(5, WDP_Product_Settings_Service::from_request(array('max_shares' => '5'))['_max_shares']);
	}

	public function test_repair_unicode_escapes_restores_only_latin_letters(): void {
		$this->assertSame('Güvenli ödeme', WDP_Product_Settings_Service::repair_unicode_escapes('Gu00fcvenli u00f6deme'));
		$this->assertSame('Bağış', WDP_Product_Settings_Service::repair_unicode_escapes('Bau011fu0131u015f'));
		$this->assertSame('menu0020 u0041', WDP_Product_Settings_Service::repair_unicode_escapes('menu0020 u0041'));
		$this->assertSame('Normal metin', WDP_Product_Settings_Service::repair_unicode_escapes('Normal metin'));
	}

	public function test_public_flags_include_donation_type(): void {
		$meta  = WDP_Product_Settings_Service::from_request(array('donation_type' => 'custom'));
		$flags = WDP_Product_Settings_Service::public_flags_from_normalized($meta);

		$this->assertSame('custom', $flags['donation_type']);
		$this->assertTrue($flags['allow_custom_price']);
		$this->assertFalse($flags['enable_progress_bar']);
	}
}

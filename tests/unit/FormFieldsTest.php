<?php
/**
 * 10.30.0 Form alanları: sunucu yok sayma, e-posta doğrulama, sınırlar, anonim maske, üçlü, aydınlatma.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class FormFieldsTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	private function product(int $id, array $meta): WC_Product {
		WDP_Test_State::$post_meta[ $id ] = $meta;
		$p                                = new WC_Product($id);
		WDP_Test_State::$products[ $id ]  = $p;
		return $p;
	}

	public function test_closed_fields_ignored_on_ajax_style_helper(): void {
		$p = $this->product(
			101,
			array(
				'_enable_email'      => 'no',
				'_enable_dedication' => 'no',
				'_enable_anonymous'  => 'no',
			)
		);
		$data = array();
		WDP_Donation_Optional_Fields::apply_from_request(
			$p,
			array(
				'donation_email'      => 'leak@example.com',
				'donation_dedication' => 'Gizli ithaf',
				'donation_anonymous'  => '1',
			),
			$data
		);
		$this->assertArrayNotHasKey('email', $data);
		$this->assertArrayNotHasKey('dedication', $data);
		$this->assertArrayNotHasKey('anonymous', $data);
	}

	public function test_closed_fields_ignored_legacy_cart_path(): void {
		$p = $this->product(
			102,
			array(
				'_enable_email'      => 'no',
				'_enable_dedication' => 'no',
				'_enable_anonymous'  => 'no',
			)
		);
		$_POST = array(
			'donation_modal'      => '1',
			'donation_full_name'  => 'Ali Veli',
			'donation_phone'      => '5551112233',
			'donation_email'      => 'leak@example.com',
			'donation_dedication' => 'İthaf',
			'donation_anonymous'  => '1',
		);
		$out = \DonationPanel\WooCommerce\Cart_Hooks::add_donation_item_data(array(), 102, 0);
		$this->assertArrayHasKey('donation_data', $out);
		$this->assertArrayNotHasKey('email', $out['donation_data']);
		$this->assertArrayNotHasKey('dedication', $out['donation_data']);
		$this->assertArrayNotHasKey('anonymous', $out['donation_data']);
		unset($_POST);
	}

	public function test_shares_type_ignores_optional_fields(): void {
		$p = $this->product(
			103,
			array(
				'_allow_multiple_shares' => 'yes',
				'_enable_email'          => 'yes',
				'_enable_dedication'     => 'yes',
				'_enable_anonymous'      => 'yes',
			)
		);
		$this->assertFalse(WDP_Donation_Optional_Fields::product_supports_optional_contact_fields($p));
		$flags = WDP_Donation_Optional_Fields::resolve_flags($p);
		$this->assertFalse($flags['email']);
		$this->assertFalse($flags['dedication']);
		$this->assertFalse($flags['anonymous']);
		$data = array();
		WDP_Donation_Optional_Fields::apply_from_request(
			$p,
			array(
				'donation_email'      => 'x@y.com',
				'donation_dedication' => 'A',
				'donation_anonymous'  => '1',
			),
			$data
		);
		$this->assertSame(array(), $data);
	}

	public function test_invalid_email_throws_validation(): void {
		$p = $this->product(104, array('_enable_email' => 'yes'));
		$this->expectException(\DonationPanel\Support\Validation_Exception::class);
		$data = array();
		try {
			WDP_Donation_Optional_Fields::apply_from_request(
				$p,
				array('donation_email' => 'not-an-email'),
				$data
			);
		} catch (\DonationPanel\Support\Validation_Exception $e) {
			$this->assertTrue(in_array('donation_email', $e->getErrors(), true));
			throw $e;
		}
	}

	public function test_empty_email_allowed_when_enabled(): void {
		$p    = $this->product(105, array('_enable_email' => 'yes'));
		$data = array();
		WDP_Donation_Optional_Fields::apply_from_request($p, array('donation_email' => ''), $data);
		$this->assertArrayNotHasKey('email', $data);
	}

	public function test_dedication_turkish_char_limit_120(): void {
		$p      = $this->product(106, array('_enable_dedication' => 'yes'));
		$filler = str_repeat('ğüşiöçİ', 20); // 140 chars
		$this->assertGreaterThan(120, mb_strlen($filler));
		$data = array();
		WDP_Donation_Optional_Fields::apply_from_request(
			$p,
			array('donation_dedication' => $filler),
			$data
		);
		$this->assertSame(120, mb_strlen($data['dedication']));
		$this->assertSame(mb_substr($filler, 0, 120), $data['dedication']);
		// Ortadan bölünme yok: son karakter geçerli Türkçe harf.
		$last = mb_substr($data['dedication'], -1);
		$this->assertMatchesRegularExpression('/^[ğüşiöçİ]$/u', $last);
	}

	public function test_security_sanitize_text_char_based(): void {
		$s = str_repeat('İ', 105);
		$o = \DonationPanel\Support\Security::sanitize_text($s, 100);
		$this->assertSame(100, mb_strlen($o));
	}

	public function test_product_note_save_limit_400(): void {
		$long = str_repeat('a', 450);
		$meta = WDP_Product_Settings_Service::from_request(array('product_note_text' => $long));
		$this->assertSame(400, mb_strlen($meta['_product_note_text']));
	}

	public function test_dedication_placeholder_save_limit_120(): void {
		$meta = WDP_Product_Settings_Service::from_request(
			array('dedication_placeholder' => str_repeat('b', 150))
		);
		$this->assertSame(120, mb_strlen($meta['_dedication_placeholder']));
	}

	public function test_anonymous_mask_multibyte(): void {
		$this->assertSame('A*** Y***', WDP_Donation_Optional_Fields::mask_public_donor_name('Ayşe Yılmaz', true));
		$this->assertSame('İ*** Ö***', WDP_Donation_Optional_Fields::mask_public_donor_name('İhsan Öğünç', '1'));
		$this->assertSame('Ayşe Yılmaz', WDP_Donation_Optional_Fields::mask_public_donor_name('Ayşe Yılmaz', false));
		$this->assertSame('Anonim', WDP_Donation_Optional_Fields::mask_public_donor_name('', true));
	}

	public function test_wizard_tristate_resolution(): void {
		WDP_Test_State::$options['wdp_button_settings'] = array('enable_multi_step' => '1');
		$empty = $this->product(201, array());
		$ctx   = \DonationPanel\Domain\Product_Context::build_form_context($empty);
		$this->assertTrue($ctx['enable_wizard'], 'boş meta → genel açık');

		$off = $this->product(202, array('_enable_wizard' => 'no'));
		$ctx = \DonationPanel\Domain\Product_Context::build_form_context($off);
		$this->assertFalse($ctx['enable_wizard'], 'ürün Kapalı genel açığı ezer');

		$on = $this->product(203, array('_enable_wizard' => 'yes'));
		WDP_Test_State::$options['wdp_button_settings'] = array('enable_multi_step' => '0');
		$ctx = \DonationPanel\Domain\Product_Context::build_form_context($on);
		$this->assertTrue($ctx['enable_wizard'], 'ürün Açık genel kapalıyı ezer');
	}

	public function test_field_icons_tristate_resolution(): void {
		WDP_Test_State::$options['wdp_button_settings'] = array('enable_field_icons' => '0');
		$empty = $this->product(211, array());
		$ctx   = \DonationPanel\Domain\Product_Context::build_form_context($empty);
		$this->assertFalse($ctx['enable_field_icons'], 'boş → genel kapalı');

		$on = $this->product(212, array('_enable_field_icons' => 'yes'));
		$ctx = \DonationPanel\Domain\Product_Context::build_form_context($on);
		$this->assertTrue($ctx['enable_field_icons']);
	}

	public function test_privacy_notice_resolution(): void {
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'enable_privacy_notice' => '1',
			'privacy_notice_text'   => 'Kişisel verileriniz Aydınlatma Metni kapsamında işlenir.',
			'privacy_notice_url'    => 'https://example.test/gizlilik',
		);
		$n = WDP_Donation_Optional_Fields::resolve_privacy_notice(array('has_email' => true));
		$this->assertNotNull($n);
		$this->assertSame('https://example.test/gizlilik', $n['url']);

		$this->assertNull(
			WDP_Donation_Optional_Fields::resolve_privacy_notice(array()),
			'e-posta/ithaf/hissedar yoksa gösterme'
		);

		WDP_Test_State::$options['wdp_button_settings']['privacy_notice_url'] = '';
		WDP_Test_State::$options['__privacy_policy_url']                     = 'https://example.test/wp-privacy';
		$n2 = WDP_Donation_Optional_Fields::resolve_privacy_notice(array('has_dedication' => true));
		$this->assertSame('https://example.test/wp-privacy', $n2['url']);

		WDP_Test_State::$options['__privacy_policy_url'] = '';
		$html = WDP_Donation_Optional_Fields::render_privacy_notice_html(array('has_shareholders' => true));
		$this->assertSame('', $html, 'URL yoksa HTML boş');
	}

	public function test_wizard_icons_saved_as_tristate(): void {
		$meta = WDP_Product_Settings_Service::from_request(
			array(
				'enable_wizard'      => '',
				'enable_field_icons' => 'no',
			)
		);
		$this->assertSame('', $meta['_enable_wizard']);
		$this->assertSame('no', $meta['_enable_field_icons']);
	}

	public function test_migration_10_30_0_idempotent(): void {
		$this->assertArrayHasKey('10.30.0', \DonationPanel\Core\Version_Migrations::steps());
		WDP_Test_State::$options['wdp_button_settings'] = array('enable_donor_email' => '1');
		$summary = \DonationPanel\Core\Version_Migrations::step_10_30_0(false);
		$this->assertStringContainsString('privacy_keys:', $summary);
		$this->assertSame('0', WDP_Test_State::$options['wdp_button_settings']['enable_privacy_notice']);
		$again = \DonationPanel\Core\Version_Migrations::step_10_30_0(false);
		$this->assertStringContainsString('none', $again);
		$this->assertStringContainsString('fresh', \DonationPanel\Core\Version_Migrations::step_10_30_0(true));
	}

	public function test_legacy_cart_path_still_reachable_without_ajax_flow(): void {
		// Kanıt: wdp_ajax_flow yokken donation_modal=1 yolu add_donation_item_data çalışır.
		$this->product(120, array('_enable_email' => 'yes', '_enable_dedication' => 'yes'));
		$_POST = array(
			'donation_modal'      => '1',
			'donation_full_name'  => 'Test User',
			'donation_phone'      => '5550001122',
			'donation_email'      => 'ok@example.com',
			'donation_dedication' => 'Annem',
		);
		$out = \DonationPanel\WooCommerce\Cart_Hooks::add_donation_item_data(array(), 120, 0);
		$this->assertSame('ok@example.com', $out['donation_data']['email']);
		$this->assertSame('Annem', $out['donation_data']['dedication']);

		$_POST['wdp_ajax_flow'] = '1';
		$_POST['action']        = 'wdp_ajax_add_to_cart';
		$skip                   = \DonationPanel\WooCommerce\Cart_Hooks::add_donation_item_data(array('keep' => 1), 120, 0);
		$this->assertSame(array('keep' => 1), $skip, 'AJAX akışında legacy yol atlanır');
		unset($_POST);
	}
}

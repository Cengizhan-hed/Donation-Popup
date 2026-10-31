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


	public function test_dedication_placeholder_save_limit_120(): void {
		$meta = \DonationPanel\Admin\Product\Product_Settings::normalize(
			array('dedication_placeholder' => str_repeat('b', 150))
		)['meta'];
		$this->assertSame(120, mb_strlen($meta['_dedication_placeholder']));
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
		$n = \DonationPanel\Domain\Privacy_Notice::resolve(array('has_email' => true));
		$this->assertNotNull($n);
		$this->assertSame('https://example.test/gizlilik', $n['url']);

		$this->assertNull(
			\DonationPanel\Domain\Privacy_Notice::resolve(array()),
			'e-posta/ithaf/hissedar yoksa gösterme'
		);

		WDP_Test_State::$options['wdp_button_settings']['privacy_notice_url'] = '';
		WDP_Test_State::$options['__privacy_policy_url']                     = 'https://example.test/wp-privacy';
		$n2 = \DonationPanel\Domain\Privacy_Notice::resolve(array('has_dedication' => true));
		$this->assertSame('https://example.test/wp-privacy', $n2['url']);

		WDP_Test_State::$options['__privacy_policy_url'] = '';
		$html = \DonationPanel\Domain\Privacy_Notice::render_html(array('has_shareholders' => true));
		$this->assertSame('', $html, 'URL yoksa HTML boş');
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

}

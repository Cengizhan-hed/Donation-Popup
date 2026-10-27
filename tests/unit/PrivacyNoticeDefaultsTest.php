<?php
/**
 * Gizlilik bağlantısının varsayılan etiketi ve 10.32.0 göçü (ürüne özel görünüm 12.0.0'da kaldırıldı).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class PrivacyNoticeDefaultsTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_privacy_default_label_and_migration(): void {
		$label = \DonationPanel\Domain\Privacy_Notice::default_link_label();
		$this->assertSame('Kişisel verilerin işlenmesine ilişkin aydınlatma metni', $label);

		WDP_Test_State::$options['wdp_button_settings'] = array(
			'enable_privacy_notice' => '1',
			'privacy_notice_text'   => '',
			'privacy_notice_url'    => 'https://example.test/p',
		);
		$n = \DonationPanel\Domain\Privacy_Notice::resolve(array( 'has_email' => true ));
		$this->assertSame($label, $n['link_label']);
		$html = \DonationPanel\Domain\Privacy_Notice::render_html(array( 'has_email' => true ));
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
}

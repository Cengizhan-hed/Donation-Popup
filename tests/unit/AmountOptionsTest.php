<?php
/**
 * 10.29.x Tutar seçenekleri: katı kayıt doğrulaması, önerilen tutar (ürün), işlem ücreti, geçiş.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Admin\Product\Product_Settings;
use DonationPanel\Domain\Amount_Presets;
use DonationPanel\Domain\Cover_Fee;
use PHPUnit\Framework\TestCase;

final class AmountOptionsTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	/**
	 * @return array<string, array{0:string}>
	 */
	public static function invalid_tokens(): array {
		return array(
			'binlik nokta'     => array('100, 1.000'),
			'ondalik nokta'    => array('100 1.5'),
			'ondalik virgul'   => array('1,5'),
			'ondalik listede'  => array('100 1,5 250'),
			'harf'             => array('5o0'),
			'sifir'            => array('0, 100'),
			'negatif'          => array('-5'),
		);
	}

	/**
	 * @dataProvider invalid_tokens
	 */
	public function test_presets_save_rejects_non_integer_tokens(string $raw): void {
		$check = Product_Settings::validate_amount_presets($raw);
		$this->assertFalse($check['ok']);
		$this->assertNotSame('', $check['error']);
	}

	public function test_presets_save_reports_invalid_token(): void {
		$check = Product_Settings::validate_amount_presets('100 5o0 250');
		$this->assertFalse($check['ok']);
		$this->assertStringContainsString('5o0', $check['error']);
	}

	public function test_presets_save_accepts_separators_and_empty(): void {
		$this->assertSame(array(100, 250, 500), Product_Settings::validate_amount_presets("100, 250;500")['amounts']);
		$this->assertSame(array(100, 250), Product_Settings::validate_amount_presets('100 250')['amounts']);
		$empty = Product_Settings::validate_amount_presets('');
		$this->assertTrue($empty['ok']);
		$this->assertSame(array(), $empty['amounts']);
	}

	public function test_presets_save_rejects_more_than_six(): void {
		$this->assertTrue(Product_Settings::validate_amount_presets('1,2,3,4,5,6')['ok']);
		$this->assertFalse(Product_Settings::validate_amount_presets('1,2,3,4,5,6,7')['ok']);
	}

	public function test_soft_parse_still_tolerates_old_data(): void {
		$this->assertSame(array(1.0, 1.5, 50.0), Amount_Presets::parse_csv('1.000 1.5 5o0'));
		$this->assertCount(6, Amount_Presets::parse_csv('1,2,3,4,5,6,7,8'));
	}

	public function test_cover_fee_percent_save_bounds(): void {
		foreach (array('', '0', 0, null) as $off) {
			$r = Product_Settings::validate_cover_fee($off);
			$this->assertTrue($r['ok']);
			$this->assertSame(0.0, $r['percent']);
		}
		$this->assertTrue(Product_Settings::validate_cover_fee('0.5')['ok']);
		$this->assertTrue(Product_Settings::validate_cover_fee('15')['ok']);
		$this->assertSame(2.5, Product_Settings::validate_cover_fee('2,5')['percent']);
		foreach (array('0.4', '15.1', '20', '-1', 'abc') as $bad) {
			$r = Product_Settings::validate_cover_fee($bad);
			$this->assertFalse($r['ok'], $bad);
			$this->assertNotSame('', $r['error']);
		}
	}

	public function test_cover_fee_runtime_clamp(): void {
		$this->assertSame(0.0, Cover_Fee::clamp_percent(0));
		$this->assertSame(0.0, Cover_Fee::clamp_percent('-3'));
		$this->assertSame(0.5, Cover_Fee::clamp_percent('0.1'));
		$this->assertSame(15.0, Cover_Fee::clamp_percent('50'));
		$this->assertSame(3.0, Cover_Fee::clamp_percent('3'));
	}

	public function test_recommended_save_validation(): void {
		$ok = Product_Settings::validate_recommended('', array(100, 250));
		$this->assertTrue($ok['ok']);
		$this->assertSame('', $ok['value']);

		$in = Product_Settings::validate_recommended('250', array(100, 250, 500));
		$this->assertTrue($in['ok']);
		$this->assertSame('250', $in['value']);

		$missing = Product_Settings::validate_recommended('777', array(100, 250));
		$this->assertFalse($missing['ok']);
		$this->assertStringContainsString('777', $missing['error']);

		$bad = Product_Settings::validate_recommended('12.5', array(100, 250));
		$this->assertFalse($bad['ok']);
	}

	public function test_product_save_rejects_invalid_presets_and_keeps_existing(): void {
		$meta = Product_Settings::normalize(array(
				'donation_type'              => 'custom',
				'amount_presets'             => '100, 1.000',
				'cover_fee_percent'          => '40',
				'amount_preset_recommended'  => 'abc',
			),
			array(
				'_amount_presets'            => '100, 250',
				'_cover_fee_percent'         => '3',
				'_amount_preset_recommended' => '250',
			))['meta'];
		$this->assertSame('100, 250', $meta['_amount_presets']);
		$this->assertSame('3', $meta['_cover_fee_percent']);
		$this->assertSame('250', $meta['_amount_preset_recommended']);
	}

	public function test_product_save_rejects_recommended_not_in_list(): void {
		$meta = Product_Settings::normalize(array(
				'donation_type'             => 'custom',
				'amount_presets'            => '100, 250, 500',
				'amount_preset_recommended' => '777',
			),
			array(
				'_amount_presets'            => '100, 250, 500',
				'_amount_preset_recommended' => '',
			))['meta'];
		$this->assertSame('', $meta['_amount_preset_recommended']);
	}

	public function test_product_save_stores_valid_values(): void {
		$meta = Product_Settings::normalize(array(
				'donation_type'             => 'custom',
				'amount_presets'            => '100 250;500',
				'cover_fee_percent'         => '2.5',
				'amount_preset_recommended' => '250',
			))['meta'];
		$this->assertSame('100, 250, 500', $meta['_amount_presets']);
		$this->assertSame('2.5', $meta['_cover_fee_percent']);
		$this->assertSame('250', $meta['_amount_preset_recommended']);

		$off = Product_Settings::normalize(array('cover_fee_percent' => '0'))['meta'];
		$this->assertSame('', $off['_cover_fee_percent']);
		$this->assertSame('', $off['_amount_preset_recommended']);
	}

	public function test_steps_include_10_29_0_and_10_29_1(): void {
		$this->assertArrayHasKey('10.29.0', \DonationPanel\Core\Version_Migrations::steps());
		$this->assertArrayHasKey('10.29.1', \DonationPanel\Core\Version_Migrations::steps());
		$this->assertArrayHasKey('10.30.0', \DonationPanel\Core\Version_Migrations::steps());
	}

	public function test_migration_10_29_0_repairs_and_is_idempotent(): void {
		WDP_Test_State::$post_meta[21] = array('_cover_fee_percent' => '50');
		WDP_Test_State::$post_meta[22] = array('_cover_fee_percent' => '0.2');
		WDP_Test_State::$post_meta[23] = array('_cover_fee_percent' => '3');
		WDP_Test_State::$post_meta[24] = array('_cover_fee_percent' => '');
		WDP_Test_State::$options['wdp_button_settings'] = array('amount_presets' => '100, 200, 300, 400, 500, 600, 700, 800');

		$summary = \DonationPanel\Core\Version_Migrations::step_10_29_0(false);
		$this->assertStringContainsString('cover_fee_fixed:2', $summary);
		$this->assertSame('15', WDP_Test_State::$post_meta[21]['_cover_fee_percent']);
		$this->assertSame('0.5', WDP_Test_State::$post_meta[22]['_cover_fee_percent']);
		$this->assertSame('3', WDP_Test_State::$post_meta[23]['_cover_fee_percent']);
		$this->assertSame('', WDP_Test_State::$post_meta[24]['_cover_fee_percent']);
		$this->assertSame('100, 200, 300, 400, 500, 600', WDP_Test_State::$options['wdp_button_settings']['amount_presets']);

		$again = \DonationPanel\Core\Version_Migrations::step_10_29_0(false);
		$this->assertStringContainsString('cover_fee_fixed:0', $again);
		$this->assertStringContainsString('global_presets_trimmed:no', $again);
	}

	public function test_migration_10_29_1_removes_global_recommended(): void {
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'amount_presets'            => '100, 250',
			'amount_preset_recommended' => '250',
		);
		WDP_Test_State::$post_meta[55] = array('_amount_preset_recommended' => '500');

		$summary = \DonationPanel\Core\Version_Migrations::step_10_29_1(false);
		$this->assertStringContainsString('global_recommended_removed:yes', $summary);
		$this->assertArrayNotHasKey('amount_preset_recommended', WDP_Test_State::$options['wdp_button_settings']);
		$this->assertSame('500', WDP_Test_State::$post_meta[55]['_amount_preset_recommended'], 'ürün meta korunur');

		$again = \DonationPanel\Core\Version_Migrations::step_10_29_1(false);
		$this->assertStringContainsString('global_recommended_removed:no', $again);
	}

	public function test_migration_10_29_0_skips_fresh_install(): void {
		WDP_Test_State::$post_meta[21] = array('_cover_fee_percent' => '50');
		$this->assertStringContainsString('fresh', \DonationPanel\Core\Version_Migrations::step_10_29_0(true));
		$this->assertSame('50', WDP_Test_State::$post_meta[21]['_cover_fee_percent']);
	}
}

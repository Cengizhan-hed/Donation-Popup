<?php
/**
 * 10.29.x Tutar seçenekleri: katı kayıt doğrulaması, önerilen tutar (ürün), işlem ücreti, geçiş.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

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
		$check = WDP_Form_Modules::validate_amount_presets_for_save($raw);
		$this->assertFalse($check['ok']);
		$this->assertNotSame('', $check['error']);
	}

	public function test_presets_save_reports_invalid_token(): void {
		$check = WDP_Form_Modules::validate_amount_presets_for_save('100 5o0 250');
		$this->assertFalse($check['ok']);
		$this->assertSame('5o0', $check['invalid']);
		$this->assertStringContainsString('5o0', $check['error']);
	}

	public function test_presets_save_accepts_separators_and_empty(): void {
		$this->assertSame(array(100, 250, 500), WDP_Form_Modules::validate_amount_presets_for_save("100, 250;500")['amounts']);
		$this->assertSame(array(100, 250), WDP_Form_Modules::validate_amount_presets_for_save('100 250')['amounts']);
		$empty = WDP_Form_Modules::validate_amount_presets_for_save('');
		$this->assertTrue($empty['ok']);
		$this->assertSame(array(), $empty['amounts']);
	}

	public function test_presets_save_rejects_more_than_six(): void {
		$this->assertTrue(WDP_Form_Modules::validate_amount_presets_for_save('1,2,3,4,5,6')['ok']);
		$this->assertFalse(WDP_Form_Modules::validate_amount_presets_for_save('1,2,3,4,5,6,7')['ok']);
	}

	public function test_soft_parse_still_tolerates_old_data(): void {
		$this->assertSame(array(1.0, 1.5, 50.0), WDP_Form_Modules::parse_amount_presets_csv('1.000 1.5 5o0'));
		$this->assertCount(6, WDP_Form_Modules::parse_amount_presets_csv('1,2,3,4,5,6,7,8'));
	}

	public function test_cover_fee_percent_save_bounds(): void {
		foreach (array('', '0', 0, null) as $off) {
			$r = WDP_Form_Modules::normalize_cover_fee_percent_for_save($off);
			$this->assertTrue($r['ok']);
			$this->assertSame(0.0, $r['percent']);
		}
		$this->assertTrue(WDP_Form_Modules::normalize_cover_fee_percent_for_save('0.5')['ok']);
		$this->assertTrue(WDP_Form_Modules::normalize_cover_fee_percent_for_save('15')['ok']);
		$this->assertSame(2.5, WDP_Form_Modules::normalize_cover_fee_percent_for_save('2,5')['percent']);
		foreach (array('0.4', '15.1', '20', '-1', 'abc') as $bad) {
			$r = WDP_Form_Modules::normalize_cover_fee_percent_for_save($bad);
			$this->assertFalse($r['ok'], $bad);
			$this->assertNotSame('', $r['error']);
		}
	}

	public function test_cover_fee_runtime_clamp(): void {
		$this->assertSame(0.0, WDP_Form_Modules::clamp_cover_fee_percent_for_runtime(0));
		$this->assertSame(0.0, WDP_Form_Modules::clamp_cover_fee_percent_for_runtime('-3'));
		$this->assertSame(0.5, WDP_Form_Modules::clamp_cover_fee_percent_for_runtime('0.1'));
		$this->assertSame(15.0, WDP_Form_Modules::clamp_cover_fee_percent_for_runtime('50'));
		$this->assertSame(3.0, WDP_Form_Modules::clamp_cover_fee_percent_for_runtime('3'));
	}

	public function test_recommended_amount_resolution_product_only(): void {
		$list = array(100.0, 250.0, 500.0, 1000.0);
		$this->assertNull(WDP_Form_Modules::resolve_recommended_amount($list, null));
		$this->assertNull(WDP_Form_Modules::resolve_recommended_amount($list, ''));
		$this->assertNull(WDP_Form_Modules::resolve_recommended_amount($list, 0));
		$this->assertSame(250.0, WDP_Form_Modules::resolve_recommended_amount($list, 250));
		$this->assertSame(250.0, WDP_Form_Modules::resolve_recommended_amount($list, '250'));
		$this->assertNull(WDP_Form_Modules::resolve_recommended_amount($list, 999), 'listede yoksa etiket yok');
		$this->assertNull(WDP_Form_Modules::resolve_recommended_amount(array(), 100));
	}

	public function test_recommended_save_validation(): void {
		$ok = WDP_Form_Modules::validate_recommended_amount_for_save('', array(100, 250));
		$this->assertTrue($ok['ok']);
		$this->assertSame('', $ok['value']);

		$in = WDP_Form_Modules::validate_recommended_amount_for_save('250', array(100, 250, 500));
		$this->assertTrue($in['ok']);
		$this->assertSame('250', $in['value']);

		$missing = WDP_Form_Modules::validate_recommended_amount_for_save('777', array(100, 250));
		$this->assertFalse($missing['ok']);
		$this->assertStringContainsString('777', $missing['error']);

		$bad = WDP_Form_Modules::validate_recommended_amount_for_save('12.5', array(100, 250));
		$this->assertFalse($bad['ok']);
	}

	public function test_cover_fee_render_has_total_row_and_clamped_percent(): void {
		$html = WDP_Form_Modules::render_cover_fee(99);
		$this->assertStringContainsString('data-wdp-form-total', $html);
		$this->assertStringContainsString('data-wdp-cover-fee-percent="15"', $html);
		$this->assertSame('', WDP_Form_Modules::render_cover_fee(0));
	}

	public function test_product_save_rejects_invalid_presets_and_keeps_existing(): void {
		$meta = WDP_Product_Settings_Service::from_product_panel(
			array(
				'donation_type'              => 'custom',
				'amount_presets'             => '100, 1.000',
				'cover_fee_percent'          => '40',
				'amount_preset_recommended'  => 'abc',
			),
			array(
				'_amount_presets'            => '100, 250',
				'_cover_fee_percent'         => '3',
				'_amount_preset_recommended' => '250',
			)
		);
		$this->assertSame('100, 250', $meta['_amount_presets']);
		$this->assertSame('3', $meta['_cover_fee_percent']);
		$this->assertSame('250', $meta['_amount_preset_recommended']);
	}

	public function test_product_save_rejects_recommended_not_in_list(): void {
		$meta = WDP_Product_Settings_Service::from_product_panel(
			array(
				'donation_type'             => 'custom',
				'amount_presets'            => '100, 250, 500',
				'amount_preset_recommended' => '777',
			),
			array(
				'_amount_presets'            => '100, 250, 500',
				'_amount_preset_recommended' => '',
			)
		);
		$this->assertSame('', $meta['_amount_preset_recommended']);
	}

	public function test_product_save_stores_valid_values(): void {
		$meta = WDP_Product_Settings_Service::from_product_panel(
			array(
				'donation_type'             => 'custom',
				'amount_presets'            => '100 250;500',
				'cover_fee_percent'         => '2.5',
				'amount_preset_recommended' => '250',
			)
		);
		$this->assertSame('100, 250, 500', $meta['_amount_presets']);
		$this->assertSame('2.5', $meta['_cover_fee_percent']);
		$this->assertSame('250', $meta['_amount_preset_recommended']);

		$off = WDP_Product_Settings_Service::from_request(array('cover_fee_percent' => '0'));
		$this->assertSame('', $off['_cover_fee_percent']);
		$this->assertSame('', $off['_amount_preset_recommended']);
	}

	public function test_global_normalizer_drops_recommended_key(): void {
		WDP_Test_State::$options['wdp_button_settings'] = array('amount_presets' => '100, 250');
		$bad = WDP_Admin_Settings_Normalizer::normalize_normal_form_settings(
			array_merge(WDP_Test_State::$options['wdp_button_settings'], array('amount_presets' => '100, 1.000'))
		);
		$this->assertNotSame('', WDP_Admin_Settings_Normalizer::$last_validation_error);
		$this->assertStringContainsString('1.000', WDP_Admin_Settings_Normalizer::$last_validation_error);
		$this->assertSame('100, 250', $bad['amount_presets']);
		$this->assertArrayNotHasKey('amount_preset_recommended', $bad);

		$ok = WDP_Admin_Settings_Normalizer::normalize_normal_form_settings(
			array('amount_presets' => '', 'amount_preset_recommended' => '250')
		);
		$this->assertSame('', WDP_Admin_Settings_Normalizer::$last_validation_error);
		$this->assertSame('100, 250, 500, 1000, 2500', $ok['amount_presets']);
		$this->assertArrayNotHasKey('amount_preset_recommended', $ok);
	}

	public function test_steps_include_10_29_0_and_10_29_1(): void {
		$this->assertArrayHasKey('10.29.0', WDP_Migrations::steps());
		$this->assertArrayHasKey('10.29.1', WDP_Migrations::steps());
		$this->assertArrayHasKey('10.30.0', WDP_Migrations::steps());
	}

	public function test_migration_10_29_0_repairs_and_is_idempotent(): void {
		WDP_Test_State::$post_meta[21] = array('_cover_fee_percent' => '50');
		WDP_Test_State::$post_meta[22] = array('_cover_fee_percent' => '0.2');
		WDP_Test_State::$post_meta[23] = array('_cover_fee_percent' => '3');
		WDP_Test_State::$post_meta[24] = array('_cover_fee_percent' => '');
		WDP_Test_State::$options['wdp_button_settings'] = array('amount_presets' => '100, 200, 300, 400, 500, 600, 700, 800');

		$summary = WDP_Migrations::step_10_29_0(false);
		$this->assertStringContainsString('cover_fee_fixed:2', $summary);
		$this->assertSame('15', WDP_Test_State::$post_meta[21]['_cover_fee_percent']);
		$this->assertSame('0.5', WDP_Test_State::$post_meta[22]['_cover_fee_percent']);
		$this->assertSame('3', WDP_Test_State::$post_meta[23]['_cover_fee_percent']);
		$this->assertSame('', WDP_Test_State::$post_meta[24]['_cover_fee_percent']);
		$this->assertSame('100, 200, 300, 400, 500, 600', WDP_Test_State::$options['wdp_button_settings']['amount_presets']);

		$again = WDP_Migrations::step_10_29_0(false);
		$this->assertStringContainsString('cover_fee_fixed:0', $again);
		$this->assertStringContainsString('global_presets_trimmed:no', $again);
	}

	public function test_migration_10_29_1_removes_global_recommended(): void {
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'amount_presets'            => '100, 250',
			'amount_preset_recommended' => '250',
		);
		WDP_Test_State::$post_meta[55] = array('_amount_preset_recommended' => '500');

		$summary = WDP_Migrations::step_10_29_1(false);
		$this->assertStringContainsString('global_recommended_removed:yes', $summary);
		$this->assertArrayNotHasKey('amount_preset_recommended', WDP_Test_State::$options['wdp_button_settings']);
		$this->assertSame('500', WDP_Test_State::$post_meta[55]['_amount_preset_recommended'], 'ürün meta korunur');

		$again = WDP_Migrations::step_10_29_1(false);
		$this->assertStringContainsString('global_recommended_removed:no', $again);
	}

	public function test_migration_10_29_0_skips_fresh_install(): void {
		WDP_Test_State::$post_meta[21] = array('_cover_fee_percent' => '50');
		$this->assertStringContainsString('fresh', WDP_Migrations::step_10_29_0(true));
		$this->assertSame('50', WDP_Test_State::$post_meta[21]['_cover_fee_percent']);
	}

	/**
	 * @param array<string,string> $meta Product meta.
	 */
	private function render_presets(array $meta, $min = 0): string {
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'enable_amount_presets'     => '1',
			'amount_presets'            => '100, 250, 500, 1000',
			'amount_preset_recommended' => '500', // eski genel değer — yok sayılmalı
		);
		WDP_Test_State::$post_meta[31] = $meta;
		return WDP_Form_Fields_Renderer::render_amount_presets($min, '₺', array('product_id' => 31));
	}

	public function test_presets_render_only_for_custom_and_campaign(): void {
		$this->assertNotSame('', $this->render_presets(array('_allow_custom_price' => 'yes')));
		$this->assertNotSame('', $this->render_presets(array('_enable_progress_bar' => 'yes', '_allow_custom_price' => 'yes')));
		$this->assertSame('', $this->render_presets(array()), 'sabit tutar');
		$this->assertSame('', $this->render_presets(array('_allow_multiple_shares' => 'yes')), 'hisseli');
	}

	public function test_presets_label_recommended_only_when_product_sets(): void {
		$empty = $this->render_presets(array('_allow_custom_price' => 'yes'));
		$this->assertStringNotContainsString('data-recommended="1"', $empty);
		$this->assertStringNotContainsString('data-popular-label', $empty);
		$this->assertStringNotContainsString('aria-pressed="true"', $empty);

		$configured = $this->render_presets(array('_allow_custom_price' => 'yes', '_amount_preset_recommended' => '250'));
		$this->assertMatchesRegularExpression('/data-amount="250"[^>]*data-popular-label/s', $configured);
		$this->assertSame(1, substr_count($configured, 'data-recommended="1"'));
		$this->assertStringNotContainsString('aria-pressed="true"', $configured);

		$missing = $this->render_presets(array('_allow_custom_price' => 'yes', '_amount_preset_recommended' => '777'));
		$this->assertStringNotContainsString('data-recommended="1"', $missing);

		// Min altı gizli → görünen listede yoksa etiket yok.
		$below_min = $this->render_presets(array('_allow_custom_price' => 'yes', '_amount_preset_recommended' => '100'), 300);
		$this->assertStringNotContainsString('data-amount="100"', $below_min);
		$this->assertStringNotContainsString('data-recommended="1"', $below_min);
	}

	public function test_presets_below_min_hidden_and_section_gone_when_all_hidden(): void {
		$html = $this->render_presets(array('_allow_custom_price' => 'yes'), 300);
		$this->assertStringNotContainsString('data-amount="100"', $html);
		$this->assertStringNotContainsString('data-amount="250"', $html);
		$this->assertStringContainsString('data-amount="500"', $html);
		$this->assertSame('', $this->render_presets(array('_allow_custom_price' => 'yes'), 5000), 'hepsi min altında → bölüm yok, çarpan uydurulmaz');
	}
}

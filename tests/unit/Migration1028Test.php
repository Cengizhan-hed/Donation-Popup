<?php
/**
 * WDP_Migrations 10.28.0: yedek, token eşlemesi, ölü anahtar silme, idempotentlik.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class Migration1028Test extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_step_creates_backup_and_maps_primary(): void {
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'button_primary_color'     => '#0f608b',
			'ui_border_radius'         => '14',
			'glass_blur_px'            => '22',
			'motion_intensity'         => 'normal',
			'button_shadow_sc_enabled' => '1',
			'form_density'             => 'compact',
			'title_font_size'          => '27',
		);
		WDP_Test_State::$options['wdp_progress_bar_settings'] = array(
			'percentage_bg'    => '#ffffff',
			'percentage_text'  => '#0f172a',
			'enable_celebrate' => '1',
		);

		$summary = WDP_Migrations::step_10_28_0(false);
		$this->assertIsString($summary);

		$backup = WDP_Test_State::$options['wdp_settings_backup_10_27'] ?? null;
		$this->assertIsArray($backup);
		$this->assertArrayHasKey('wdp_button_settings', $backup);

		$button = WDP_Test_State::$options['wdp_button_settings'];
		$this->assertSame('#0f608b', $button['brand_color']);
		$this->assertSame('14', (string) $button['ui_border_radius']);
		$this->assertSame('tight', $button['form_density']);
		$this->assertSame('L', $button['title_size']);
		$this->assertArrayNotHasKey('glass_blur_px', $button);
		$this->assertArrayNotHasKey('motion_intensity', $button);
		$this->assertArrayNotHasKey('button_shadow_sc_enabled', $button);

		$progress = WDP_Test_State::$options['wdp_progress_bar_settings'];
		$this->assertArrayNotHasKey('percentage_bg', $progress);
		$this->assertArrayNotHasKey('percentage_text', $progress);
	}

	public function test_step_is_idempotent(): void {
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'brand_color'      => '#1d5fa8',
			'ui_border_radius' => '10',
		);
		WDP_Migrations::step_10_28_0(false);
		$first = WDP_Test_State::$options['wdp_button_settings'];
		WDP_Migrations::step_10_28_0(false);
		$second = WDP_Test_State::$options['wdp_button_settings'];
		$this->assertSame($first['brand_color'], $second['brand_color']);
		$this->assertSame($first['ui_border_radius'], $second['ui_border_radius']);
	}

	public function test_fresh_install_skips_backup_option(): void {
		WDP_Migrations::step_10_28_0(true);
		$this->assertArrayNotHasKey('wdp_settings_backup_10_27', WDP_Test_State::$options);
	}
}

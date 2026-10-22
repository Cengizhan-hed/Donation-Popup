<?php
/**
 * 10.3.1 biçimli tohum: yükseltmede özelleştirilmiş radius/layout korunur (idempotent).
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class Migration1031SettingsPreserveTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	/**
	 * 10.3.1 had no ui_border_radius; radii and layout sizes were independent ints.
	 *
	 * @return array{button: array<string, mixed>, layout: array<string, int>}
	 */
	private function seed_1031_custom_settings(): array {
		$button = array(
			'button_primary_color'       => '#ff0000',
			'button_border_radius'       => 20,
			'input_border_radius'        => 20,
			'modal_border_radius'        => 20,
			'popup_button_border_radius' => 20,
		);
		$layout = array(
			'inpage_form_width_desktop'         => 640,
			'inpage_form_width_mobile'          => 360,
			'modal_padding_top_desktop'         => 16,
			'modal_padding_bottom_desktop'      => 16,
			'modal_padding_left_desktop'        => 16,
			'modal_padding_right_desktop'       => 16,
			'modal_padding_top_mobile'          => 14,
			'modal_padding_bottom_mobile'       => 14,
			'modal_padding_left_mobile'         => 14,
			'modal_padding_right_mobile'        => 14,
			'popup_modal_width_desktop'         => 700,
			'side_panel_width_desktop_percent'  => 40,
			'side_panel_width_desktop_min_px'   => 500,
			'side_panel_width_desktop_max_px'   => 900,
			'side_panel_width_tablet_percent'   => 70,
			'side_panel_width_tablet_max_px'    => 700,
			'side_panel_width_mobile_max_px'    => 100,
		);
		WDP_Test_State::$options['wdp_version']                = '10.3.1';
		WDP_Test_State::$options['wdp_button_settings']        = $button;
		WDP_Test_State::$options['wdp_modal_layout_settings']  = $layout;
		return array( 'button' => $button, 'layout' => $layout );
	}

	/**
	 * @param array<string, mixed> $button
	 * @param array<string, int>   $layout
	 */
	private function assert_custom_values_kept(array $button, array $layout): void {
		$stored_button = WDP_Test_State::$options['wdp_button_settings'];
		$stored_layout = WDP_Test_State::$options['wdp_modal_layout_settings'];
		foreach (array( 'button_border_radius', 'input_border_radius', 'modal_border_radius', 'popup_button_border_radius' ) as $key) {
			$this->assertSame(20, (int) $stored_button[ $key ], $key);
		}
		$this->assertSame(20, (int) $stored_button['ui_border_radius']);
		$this->assertSame('#ff0000', $stored_button['button_primary_color']);
		foreach ($layout as $key => $value) {
			$this->assertSame($value, (int) $stored_layout[ $key ], $key);
		}
	}

	public function test_rewrite_keeps_1031_custom_radius_and_layout(): void {
		$seed = $this->seed_1031_custom_settings();
		$written = WDP_Admin_Settings_Normalizer::rewrite_stored_options();
		$this->assertGreaterThan(0, $written);
		$this->assert_custom_values_kept($seed['button'], $seed['layout']);
	}

	public function test_rewrite_is_idempotent(): void {
		$this->seed_1031_custom_settings();
		WDP_Admin_Settings_Normalizer::rewrite_stored_options();
		$after_first = WDP_Test_State::$options;
		WDP_Admin_Settings_Normalizer::rewrite_stored_options();
		$this->assertSame($after_first['wdp_button_settings'], WDP_Test_State::$options['wdp_button_settings']);
		$this->assertSame($after_first['wdp_modal_layout_settings'], WDP_Test_State::$options['wdp_modal_layout_settings']);
	}

	public function test_upgrade_from_1031_seed_preserves_values_and_is_idempotent(): void {
		$seed = $this->seed_1031_custom_settings();
		$this->assertTrue(WDP_Migrations::run());
		$this->assert_custom_values_kept($seed['button'], $seed['layout']);

		$after_first = WDP_Test_State::$options;
		unset($after_first[ WDP_Migrations::LOG_OPTION ]);

		WDP_Test_State::$options[ WDP_Migrations::OPTION ] = '10.26.0';
		foreach (array_keys(WDP_Test_State::$options) as $key) {
			if (strpos((string) $key, 'wdp_migrated_') === 0) {
				unset(WDP_Test_State::$options[ $key ]);
			}
		}
		$this->assertTrue(WDP_Migrations::run());
		$after_second = WDP_Test_State::$options;
		unset($after_second[ WDP_Migrations::LOG_OPTION ]);
		$this->assertSame($after_first['wdp_button_settings'], $after_second['wdp_button_settings']);
		$this->assertSame($after_first['wdp_modal_layout_settings'], $after_second['wdp_modal_layout_settings']);
		$this->assert_custom_values_kept($seed['button'], $seed['layout']);
	}
}

<?php
/**
 * 10.3.1 biçimli tohum: yükseltmede özelleştirilmiş radius/layout korunur (idempotent).
 *
 * @package DonationPanel
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
		$this->assertTrue(\DonationPanel\Core\Version_Migrations::run());
		$this->assert_custom_values_kept($seed['button'], $seed['layout']);

		$after_first = WDP_Test_State::$options;
		unset($after_first[ \DonationPanel\Core\Version_Migrations::LOG_OPTION ]);

		WDP_Test_State::$options[ \DonationPanel\Core\Version_Migrations::OPTION ] = '10.26.0';
		foreach (array_keys(WDP_Test_State::$options) as $key) {
			if (strpos((string) $key, 'wdp_migrated_') === 0) {
				unset(WDP_Test_State::$options[ $key ]);
			}
		}
		$this->assertTrue(\DonationPanel\Core\Version_Migrations::run());
		$after_second = WDP_Test_State::$options;
		unset($after_second[ \DonationPanel\Core\Version_Migrations::LOG_OPTION ]);
		$this->assertSame($after_first['wdp_button_settings'], $after_second['wdp_button_settings']);
		$this->assertSame($after_first['wdp_modal_layout_settings'], $after_second['wdp_modal_layout_settings']);
		$this->assert_custom_values_kept($seed['button'], $seed['layout']);
	}

	/**
	 * @return string[]
	 */
	private function radius_keys(): array {
		return array( 'button_border_radius', 'input_border_radius', 'modal_border_radius', 'popup_button_border_radius' );
	}

	public function test_rewrite_keeps_zero_legacy_radius_and_seeds_ui_zero(): void {
		$button = array();
		foreach ( $this->radius_keys() as $key ) {
			$button[ $key ] = 0;
		}
		WDP_Test_State::$options['wdp_button_settings'] = $button;
		WDP_Admin_Settings_Normalizer::rewrite_stored_options();
		$stored = WDP_Test_State::$options['wdp_button_settings'];
		$this->assertSame( 0, (int) $stored['ui_border_radius'] );
		foreach ( $this->radius_keys() as $key ) {
			$this->assertSame( 0, (int) $stored[ $key ], $key );
		}
	}

	public function test_rewrite_keeps_stored_ui_border_radius_zero(): void {
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'ui_border_radius'           => 0,
			'button_border_radius'       => 10,
			'input_border_radius'        => 10,
			'modal_border_radius'        => 10,
			'popup_button_border_radius' => 10,
		);
		WDP_Admin_Settings_Normalizer::rewrite_stored_options();
		$stored = WDP_Test_State::$options['wdp_button_settings'];
		$this->assertSame( 0, (int) $stored['ui_border_radius'] );
		foreach ( $this->radius_keys() as $key ) {
			$this->assertSame( 10, (int) $stored[ $key ], $key );
		}
	}

	public function test_rewrite_missing_or_empty_radius_defaults_to_ten(): void {
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'button_primary_color' => '#ff0000',
		);
		WDP_Admin_Settings_Normalizer::rewrite_stored_options();
		$stored = WDP_Test_State::$options['wdp_button_settings'];
		$this->assertSame( 10, (int) $stored['ui_border_radius'] );
		foreach ( $this->radius_keys() as $key ) {
			$this->assertSame( 10, (int) $stored[ $key ], $key );
		}

		WDP_Test_State::reset();
		$empty = array();
		foreach ( $this->radius_keys() as $key ) {
			$empty[ $key ] = '';
		}
		WDP_Test_State::$options['wdp_button_settings'] = $empty;
		WDP_Admin_Settings_Normalizer::rewrite_stored_options();
		$this->assertSame( 10, (int) WDP_Test_State::$options['wdp_button_settings']['ui_border_radius'] );
	}

	public function test_zero_radius_upgrade_from_1031_is_idempotent(): void {
		$button = array();
		foreach ( $this->radius_keys() as $key ) {
			$button[ $key ] = 0;
		}
		WDP_Test_State::$options['wdp_version']         = '10.3.1';
		WDP_Test_State::$options['wdp_button_settings'] = $button;
		$this->assertTrue( \DonationPanel\Core\Version_Migrations::run() );
		$after_first = WDP_Test_State::$options['wdp_button_settings'];
		$this->assertSame( 0, (int) $after_first['ui_border_radius'] );
		foreach ( $this->radius_keys() as $key ) {
			$this->assertSame( 0, (int) $after_first[ $key ], $key );
		}

		unset( WDP_Test_State::$options[ \DonationPanel\Core\Version_Migrations::LOG_OPTION ] );
		WDP_Test_State::$options[ \DonationPanel\Core\Version_Migrations::OPTION ] = '10.26.0';
		foreach ( array_keys( WDP_Test_State::$options ) as $key ) {
			if ( strpos( (string) $key, 'wdp_migrated_' ) === 0 ) {
				unset( WDP_Test_State::$options[ $key ] );
			}
		}
		$this->assertTrue( \DonationPanel\Core\Version_Migrations::run() );
		$this->assertSame( $after_first, WDP_Test_State::$options['wdp_button_settings'] );
		$this->assertSame( 0, (int) WDP_Test_State::$options['wdp_button_settings']['ui_border_radius'] );
	}

	public function test_normalize_keeps_request_ui_radius_zero(): void {
		WDP_Test_State::$options['wdp_button_settings'] = array( 'ui_border_radius' => 10 );
		$out = WDP_Admin_Settings_Normalizer::normalize_normal_form_settings( array( 'ui_border_radius' => 0 ) );
		$this->assertSame( 0, (int) $out['ui_border_radius'] );
		foreach ( $this->radius_keys() as $key ) {
			$this->assertSame( 0, (int) $out[ $key ], $key );
		}
	}

	public function test_rewrite_keeps_zero_blur_border_and_shareholder_radius(): void {
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'button_shadow_sc_blur'     => 0,
			'button_shadow_modal_blur'  => 0,
			'glass_blur_px'             => 0,
			'popup_button_border_size'  => 0,
		);
		WDP_Test_State::$options['wdp_shareholder_settings'] = array(
			'shareholder_card_radius'  => 0,
			'shareholders_area_radius' => 0,
		);
		WDP_Test_State::$options['wdp_success_settings'] = array(
			'success_button_radius'  => 0,
			'success_message_radius' => 0,
			'mini_cart_radius'       => 0,
		);
		WDP_Admin_Settings_Normalizer::rewrite_stored_options();
		$button = WDP_Test_State::$options['wdp_button_settings'];
		$this->assertSame( 0, (int) $button['button_shadow_sc_blur'] );
		$this->assertSame( 0, (int) $button['button_shadow_modal_blur'] );
		$this->assertSame( 0, (int) $button['glass_blur_px'] );
		$this->assertSame( 0, (int) $button['popup_button_border_size'] );
		$share = WDP_Test_State::$options['wdp_shareholder_settings'];
		$this->assertSame( 0, (int) $share['shareholder_card_radius'] );
		$this->assertSame( 0, (int) $share['shareholders_area_radius'] );
		$success = WDP_Test_State::$options['wdp_success_settings'];
		$this->assertSame( 0, (int) $success['success_button_radius'] );
		$this->assertSame( 0, (int) $success['success_message_radius'] );
		$this->assertSame( 0, (int) $success['mini_cart_radius'] );
	}
}

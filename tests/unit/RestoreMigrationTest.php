<?php
/**
 * Version_Migrations 10.28.1: 10.28.0 yedeğinden geri yükleme ve idempotentlik.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class RestoreMigrationTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	/**
	 * Post-10.28.0 state: mutated options + extra keys; backup holds the pre-10.28.0 snapshot.
	 *
	 * @return void
	 */
	private function seed_post_10280_with_backup(): void {
		WDP_Test_State::$options['wdp_db_version'] = '10.28.0';
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'brand_color'          => '#1d5fa8',
			'button_primary_color' => '#1d5fa8',
			'title_size'           => 'L',
			'form_density'         => 'tight',
			'primary_color'        => '#ff0000',
		);
		WDP_Test_State::$options['wdp_progress_bar_settings'] = array(
			'enable_celebrate' => '1',
		);
		WDP_Test_State::$options['wdp_placement_settings'] = array(
			'auto_place' => 'no',
			'display'    => 'inline',
		);
		WDP_Test_State::$post_meta[42] = array(
			'_theme_density'       => 'compact',
			'_allow_custom_price'  => 'yes',
			'_theme_primary_hover' => '#abc',
		);

		WDP_Test_State::$options[ \DonationPanel\Core\Version_Migrations::BACKUP_OPTION ] = array(
			'wdp_button_settings' => array(
				'button_primary_color' => '#0f608b',
				'primary_color'        => '#ff0000',
				'ui_border_radius'     => '14',
				'glass_blur_px'        => '22',
			),
			'wdp_progress_bar_settings' => array(
				'percentage_bg'    => '#ffffff',
				'percentage_text'  => '#0f172a',
				'enable_celebrate' => '1',
			),
			'wdp_placement_settings' => array(
				'auto_place'     => 'no',
				'display'        => 'inline',
				'loop_button'    => 'link',
				'hide_price'     => 'yes',
				'donation_scope' => 'all',
			),
			'product_meta' => array(
				42 => array(
					'_allow_custom_price'  => 'yes',
					'_theme_primary_hover' => '#0f608b',
				),
			),
		);
	}

	public function test_full_restore_from_post_10280_state(): void {
		$this->seed_post_10280_with_backup();

		$summary = \DonationPanel\Core\Version_Migrations::step_10_28_1(false);
		$this->assertStringContainsString('restore:ok', $summary);

		$button = WDP_Test_State::$options['wdp_button_settings'];
		$this->assertSame('#0f608b', $button['button_primary_color']);
		$this->assertSame('14', (string) $button['ui_border_radius']);
		$this->assertSame('22', (string) $button['glass_blur_px']);
		$this->assertArrayNotHasKey('brand_color', $button);
		$this->assertArrayNotHasKey('title_size', $button);

		$progress = WDP_Test_State::$options['wdp_progress_bar_settings'];
		$this->assertSame('#ffffff', $progress['percentage_bg']);

		$this->assertSame('yes', WDP_Test_State::$post_meta[42]['_allow_custom_price']);
		$this->assertSame('#0f608b', WDP_Test_State::$post_meta[42]['_theme_primary_hover']);
		$this->assertArrayNotHasKey('_theme_density', WDP_Test_State::$post_meta[42]);

		$this->assertArrayNotHasKey(\DonationPanel\Core\Version_Migrations::BACKUP_OPTION, WDP_Test_State::$options);
		$this->assertIsArray(WDP_Test_State::$options[ \DonationPanel\Core\Version_Migrations::BACKUP_RESTORED_OPTION ]);

		// Placement remapped to 10.28.1 WooCommerce defaults after restore.
		$placement = WDP_Test_State::$options[ \DonationPanel\Domain\Placement_Settings::OPTION ];
		$this->assertSame('yes', $placement['auto_place']);
		$this->assertSame('button_panel', $placement['display']);
		$this->assertSame('panel', $placement['loop_button']);
	}

	public function test_no_backup_does_nothing_to_options_except_placement(): void {
		WDP_Test_State::$options['wdp_button_settings'] = array('primary_color' => '#112233');
		WDP_Test_State::$options['wdp_db_version']      = '10.27.1';

		$summary = \DonationPanel\Core\Version_Migrations::step_10_28_1(false);
		$this->assertStringContainsString('restore:skipped', $summary);
		$this->assertSame('#112233', WDP_Test_State::$options['wdp_button_settings']['primary_color']);
		$this->assertArrayNotHasKey(\DonationPanel\Core\Version_Migrations::BACKUP_RESTORED_OPTION, WDP_Test_State::$options);

		$placement = WDP_Test_State::$options[ \DonationPanel\Domain\Placement_Settings::OPTION ];
		$this->assertSame('yes', $placement['auto_place']);
	}

	public function test_running_restore_twice_is_idempotent(): void {
		$this->seed_post_10280_with_backup();
		\DonationPanel\Core\Version_Migrations::step_10_28_1(false);
		$after_first = WDP_Test_State::$options;
		unset($after_first[ \DonationPanel\Core\Version_Migrations::LOG_OPTION ]);
		$meta_first = WDP_Test_State::$post_meta;

		$summary = \DonationPanel\Core\Version_Migrations::step_10_28_1(false);
		$this->assertStringContainsString('restore:already', $summary);

		$after_second = WDP_Test_State::$options;
		unset($after_second[ \DonationPanel\Core\Version_Migrations::LOG_OPTION ]);
		$this->assertSame($after_first, $after_second);
		$this->assertSame($meta_first, WDP_Test_State::$post_meta);
	}
}

<?php
/**
 * WDP_Migrations: yeni kurulum / güncelleme ayrımı, 10.27.0 veri temizliği ve idempotentlik.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class MigrationTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	private function seed_upgrade_site(): void {
		WDP_Test_State::$options['wdp_version']         = '10.26.0';
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'module_order'        => 'media,faq,impact,urgency',
			'primary_color'       => '#ff0000',
			'enable_faq'          => '1',
		);
		WDP_Test_State::$post_meta[10] = array(
			'_enable_faq'        => 'yes',
			'_faq_items'         => '[{"q":"Ne zaman?","a":"Bugün"}]',
			'_wdp_module_order'  => 'faq,media,impact',
			'_allow_custom_price' => 'yes',
		);
		WDP_Test_State::$post_meta[11] = array(
			'_wdp_module_order' => 'faq',
		);
		WDP_Test_State::$post_meta[12] = array(
			'_wdp_module_order' => 'media,impact',
		);
	}

	public function test_fresh_install_is_detected_without_old_data(): void {
		$this->assertTrue(WDP_Migrations::is_fresh_install());
	}

	public function test_old_options_mean_upgrade(): void {
		WDP_Test_State::$options['wdp_success_settings'] = array('title' => 'Teşekkürler');
		$this->assertFalse(WDP_Migrations::is_fresh_install());
	}

	public function test_previous_version_recorded_before_bootstrap_overwrite_means_upgrade(): void {
		WDP_Migrations::remember_previous_version('10.26.0');
		WDP_Test_State::$options['wdp_version'] = WDP_VERSION;

		$this->assertFalse(WDP_Migrations::is_fresh_install());
	}

	public function test_upgrade_removes_faq_data_and_keeps_user_values(): void {
		$this->seed_upgrade_site();

		$this->assertTrue(WDP_Migrations::run());

		$this->assertArrayNotHasKey('_enable_faq', WDP_Test_State::$post_meta[10]);
		$this->assertArrayNotHasKey('_faq_items', WDP_Test_State::$post_meta[10]);
		$this->assertSame('media,impact', WDP_Test_State::$post_meta[10]['_wdp_module_order']);
		$this->assertSame('', WDP_Test_State::$post_meta[11]['_wdp_module_order']);
		$this->assertSame('media,impact', WDP_Test_State::$post_meta[12]['_wdp_module_order']);
		$this->assertSame('yes', WDP_Test_State::$post_meta[10]['_allow_custom_price']);

		$button = WDP_Test_State::$options['wdp_button_settings'];
		$this->assertSame('media,impact,urgency', $button['module_order']);
		$this->assertSame('#ff0000', $button['primary_color']);
		$this->assertArrayNotHasKey('enable_faq', $button);

		$this->assertSame(WDP_VERSION, WDP_Test_State::$options[ WDP_Migrations::OPTION ]);
		$this->assertArrayNotHasKey(WDP_Migrations::LOCK, WDP_Test_State::$transients);

		$placement = WDP_Test_State::$options[ WDP_Placement_Settings::OPTION ];
		$this->assertSame('no', $placement['auto_place']);
		$this->assertSame('1', WDP_Test_State::$options[ WDP_Migrations::NOTICE_OPTION ]);
	}

	public function test_fresh_install_writes_auto_place_yes(): void {
		$this->assertTrue(WDP_Migrations::is_fresh_install());
		WDP_Migrations::run();
		$placement = WDP_Test_State::$options[ WDP_Placement_Settings::OPTION ];
		$this->assertSame('yes', $placement['auto_place']);
		$this->assertArrayNotHasKey(WDP_Migrations::NOTICE_OPTION, WDP_Test_State::$options);
	}

	public function test_running_twice_is_idempotent(): void {
		$this->seed_upgrade_site();
		WDP_Migrations::run();
		$options_after_first = WDP_Test_State::$options;
		unset($options_after_first[ WDP_Migrations::LOG_OPTION ]);
		$meta_after_first = WDP_Test_State::$post_meta;

		WDP_Test_State::$options[ WDP_Migrations::OPTION ] = '10.26.0';
		WDP_Migrations::run();
		$options_after_second = WDP_Test_State::$options;
		unset($options_after_second[ WDP_Migrations::LOG_OPTION ]);

		$this->assertSame($meta_after_first, WDP_Test_State::$post_meta);
		$this->assertSame($options_after_first, $options_after_second);
		$this->assertFalse(WDP_Migrations::needs_run());
	}

	public function test_locked_run_is_skipped(): void {
		$this->seed_upgrade_site();
		WDP_Test_State::$transients[ WDP_Migrations::LOCK ] = '1';

		$this->assertFalse(WDP_Migrations::run());
		$this->assertArrayHasKey('_enable_faq', WDP_Test_State::$post_meta[10]);
	}

	public function test_strip_ids_from_csv_keeps_unrelated_lists_unchanged(): void {
		$this->assertSame(' media , impact ', WDP_Migrations::strip_ids_from_csv(' media , impact '));
		$this->assertSame('media', WDP_Migrations::strip_ids_from_csv('faq,media'));
		$this->assertSame('', WDP_Migrations::strip_ids_from_csv('faq'));
	}
}

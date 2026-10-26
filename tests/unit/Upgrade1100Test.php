<?php
/**
 * 11.0.0 yükseltmesi: ayarlar korunur, yükseltilen kurulumda eski deneyim kalır, yeni kurulumda yeni varsayılan; idempotent.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use DonationPanel\Core\Settings;
use PHPUnit\Framework\TestCase;

final class Upgrade1100Test extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	private function seed_10352_site(): void {
		WDP_Test_State::$options['wdp_version']          = '10.35.2';
		WDP_Test_State::$options[ WDP_Migrations::OPTION ] = '10.35.2';
		WDP_Test_State::$options['wdp_button_settings']  = array( 'button_primary_color' => '#ff0000' );
		WDP_Test_State::$options[ Settings::OPTION_NAME ] = array(
			'general' => array( 'delete_data_on_uninstall' => true ),
		);
	}

	public function test_version_constant_is_11_0_0(): void {
		$this->assertSame('11.0.0', WDP_VERSION);
	}

	public function test_upgrade_keeps_settings_and_legacy_experience(): void {
		$this->seed_10352_site();
		$before_button = WDP_Test_State::$options['wdp_button_settings'];

		$this->assertTrue(WDP_Migrations::needs_run());
		WDP_Migrations::maybe_run();

		$this->assertSame('11.0.0', WDP_Test_State::$options[ WDP_Migrations::OPTION ]);
		$this->assertSame($before_button, WDP_Test_State::$options['wdp_button_settings']);
		$this->assertTrue(Settings::normalize(WDP_Test_State::$options[ Settings::OPTION_NAME ])['general']['delete_data_on_uninstall']);

		$this->assertFalse(Settings::upgrade_new_default());
		$this->assertFalse(Settings::engine_is_new());
		$this->assertFalse(Settings::admin_ui_is_new());
		$this->assertFalse(Settings::seed_fresh_install());
	}

	public function test_upgrade_is_idempotent(): void {
		$this->seed_10352_site();
		WDP_Migrations::maybe_run();
		$snapshot = WDP_Test_State::$options;
		$this->assertFalse(WDP_Migrations::needs_run());
		WDP_Migrations::maybe_run();
		$this->assertSame($snapshot, WDP_Test_State::$options);
	}

	public function test_explicit_choice_survives_upgrade(): void {
		$this->seed_10352_site();
		WDP_Test_State::$options[ Settings::OPTION_NAME ]['experiences'] = array( 'engine' => 'new' );
		WDP_Migrations::maybe_run();
		$this->assertTrue(Settings::engine_is_new());
		$this->assertFalse(Settings::admin_ui_is_new());
	}

	public function test_fresh_install_gets_new_experience(): void {
		$this->assertTrue(Settings::seed_fresh_install());
		$this->assertTrue(Settings::engine_is_new());
		$this->assertTrue(Settings::admin_ui_is_new());
		$this->assertFalse(Settings::seed_fresh_install());
	}
}

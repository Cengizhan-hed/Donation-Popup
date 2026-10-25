<?php
/**
 * E0: şemalı ayar deposu + eski wdp_* seçeneklerinin idempotent göçü.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use DonationPanel\Core\Legacy_Settings_Importer;
use DonationPanel\Core\Migrations;
use DonationPanel\Core\Settings;
use PHPUnit\Framework\TestCase;

final class E0SettingsTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_defaults_and_schema_version(): void {
		$s = new Settings();
		$this->assertFalse($s->get('general.delete_data_on_uninstall'));
		$this->assertSame(Settings::SCHEMA_VERSION, $s->all()['version']);
		$this->assertSame('x', $s->get('general.missing', 'x'));
		$this->assertTrue($s->module_enabled('any', true));
		$this->assertFalse($s->module_enabled('any'));
	}

	public function test_update_only_accepts_schema_keys_and_casts_types(): void {
		$s = new Settings();
		$s->update(array(
			'general' => array( 'delete_data_on_uninstall' => 'yes', 'rogue' => 'x' ),
			'rogue'   => array( 'a' => 1 ),
			'modules' => array( 'My Module!' => 1 ),
		));
		$stored = WDP_Test_State::$options[ Settings::OPTION_NAME ];
		$this->assertTrue($stored['general']['delete_data_on_uninstall']);
		$this->assertArrayNotHasKey('rogue', $stored['general']);
		$this->assertArrayNotHasKey('rogue', $stored);
		$this->assertTrue($stored['modules']['mymodule']);
	}

	public function test_corrupt_stored_value_falls_back_to_defaults(): void {
		WDP_Test_State::$options[ Settings::OPTION_NAME ] = 'garbage';
		$this->assertFalse((new Settings())->get('general.delete_data_on_uninstall'));
	}

	public function test_legacy_import_is_idempotent_and_never_touches_legacy_keys(): void {
		WDP_Test_State::$options['wdp_delete_data_on_uninstall'] = '1';
		WDP_Test_State::$options['wdp_button_settings']           = array( 'a' => 'b' );
		$legacy_before = array(
			'wdp_delete_data_on_uninstall' => WDP_Test_State::$options['wdp_delete_data_on_uninstall'],
			'wdp_button_settings'          => WDP_Test_State::$options['wdp_button_settings'],
		);

		$settings = new Settings();
		$importer = new Legacy_Settings_Importer($settings);
		$this->assertSame(1, $importer->import());
		$this->assertTrue($settings->get('general.delete_data_on_uninstall'));

		$after_first = WDP_Test_State::$options;
		$this->assertSame(0, $importer->import(), 'ikinci calistirma degisiklik yapmamali');
		$this->assertSame($after_first, WDP_Test_State::$options);

		foreach ($legacy_before as $key => $value) {
			$this->assertSame($value, WDP_Test_State::$options[ $key ], $key . ' degismemeli');
		}
	}

	public function test_import_does_not_overwrite_existing_new_value(): void {
		WDP_Test_State::$options['wdp_delete_data_on_uninstall'] = '1';
		$settings = new Settings();
		$settings->update(array( 'general' => array( 'delete_data_on_uninstall' => false ) ));
		$this->assertSame(0, (new Legacy_Settings_Importer($settings))->import());
		$this->assertFalse($settings->get('general.delete_data_on_uninstall'));
	}

	public function test_import_without_legacy_options_writes_nothing(): void {
		$importer = new Legacy_Settings_Importer(new Settings());
		$this->assertSame(0, $importer->import());
		$this->assertArrayNotHasKey(Settings::OPTION_NAME, WDP_Test_State::$options);
	}

	public function test_migration_step_runs_import_once(): void {
		WDP_Test_State::$options['wdp_delete_data_on_uninstall'] = '1';
		$settings   = new Settings();
		$importer   = new Legacy_Settings_Importer($settings);
		$migrations = new Migrations();
		$migrations->add_step('settings_import_v1', 1, array( $importer, 'import' ));

		$this->assertSame(array( 'settings_import_v1' ), $migrations->run());
		$snapshot = WDP_Test_State::$options;
		$this->assertSame(array(), $migrations->run());
		$this->assertSame($snapshot, WDP_Test_State::$options);
	}
}

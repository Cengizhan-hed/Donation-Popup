<?php
/**
 * E8A: varsayılan geçişi (yeni kurulum / yükseltme bayrağı / eski deneyime dön) ve önizleme.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Plugin;
use DonationPanel\Core\Settings;
use DonationPanel\Modules\Preview\Preview;
use PHPUnit\Framework\TestCase;

final class E8ASettingsPreviewTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		Settings::set_preview(false);
		unset($_GET['dp_preview']);
	}

	protected function tearDown(): void {
		Settings::set_preview(false);
		unset($_GET['dp_preview']);
	}

	public function test_fresh_install_defaults_to_new_engine_and_ui(): void {
		$this->assertTrue(Settings::seed_fresh_install());
		$stored = WDP_Test_State::$options[ Settings::OPTION_NAME ];
		$this->assertSame('new', $stored['experiences']['engine']);
		$this->assertSame('new', $stored['admin']['ui']);
		$this->assertTrue(Settings::engine_is_new());
		$this->assertTrue(Settings::admin_ui_is_new());
	}

	public function test_seed_is_idempotent_and_never_overwrites_a_choice(): void {
		Settings::seed_fresh_install();
		( new Settings() )->update(array( 'experiences' => array( 'engine' => 'legacy' ) ));
		$this->assertFalse(Settings::seed_fresh_install());
		$this->assertFalse(Settings::engine_is_new());
	}

	public function test_existing_installs_are_not_seeded(): void {
		WDP_Test_State::$options['wdp_version'] = '10.30.0';
		$this->assertFalse(Settings::seed_fresh_install());
		$this->assertArrayNotHasKey(Settings::OPTION_NAME, WDP_Test_State::$options);
		$this->assertFalse(Settings::engine_is_new());
		$this->assertFalse(Settings::admin_ui_is_new());

		WDP_Test_State::reset();
		WDP_Test_State::$options['wdp_cache_version'] = 12345;
		$this->assertFalse(Settings::seed_fresh_install());
	}

	public function test_upgrade_flag_default_is_off_and_keeps_upgraded_values(): void {
		$this->assertFalse(Settings::upgrade_new_default());
		WDP_Test_State::$options['wdp_version']         = '10.30.0';
		WDP_Test_State::$options[ Settings::OPTION_NAME ] = array( 'modules' => array( 'campaign' => true ) );
		$this->assertFalse(Settings::engine_is_new());
		$this->assertFalse(Settings::admin_ui_is_new());
	}

	public function test_upgrade_flag_moves_unsaved_choice_to_new_but_respects_explicit_legacy(): void {
		WDP_Test_State::$options['wdp_version']         = '10.30.0';
		WDP_Test_State::$options[ Settings::UPGRADE_FLAG_OPTION ] = '1';
		$this->assertTrue(Settings::upgrade_new_default());
		$this->assertTrue(Settings::engine_is_new());
		$this->assertTrue(Settings::admin_ui_is_new());

		// "Eski deneyime dön": açık kayıt bayraktan güçlüdür.
		( new Settings() )->update(array(
			'experiences' => array( 'engine' => 'legacy' ),
			'admin'       => array( 'ui' => 'legacy' ),
		));
		$this->assertFalse(Settings::engine_is_new());
		$this->assertFalse(Settings::admin_ui_is_new());
		$s = new Settings();
		$this->assertSame('legacy', $s->get('experiences.engine'));
	}

	public function test_both_engines_register_modules_accordingly(): void {
		$registry = new Module_Registry(new Settings());
		Plugin::register_modules($registry);
		$this->assertFalse($registry->is_enabled('experiences'));

		( new Settings() )->update(array( 'experiences' => array( 'engine' => 'new' ) ));
		$registry = new Module_Registry(new Settings());
		Plugin::register_modules($registry);
		$this->assertTrue($registry->is_enabled('experiences'));
		$this->assertTrue($registry->is_enabled('impact'));
	}

	public function test_preview_is_ignored_without_param_login_or_capability(): void {
		$this->assertFalse(Preview::activate());
		$this->assertFalse(Settings::is_preview());

		$_GET['dp_preview'] = '1';
		$this->assertFalse(Preview::activate(), 'oturumsuz');
		WDP_Test_State::$user_id = 5;
		$this->assertFalse(Preview::activate(), 'yetkisiz');
		$this->assertFalse(Settings::is_preview());

		$_GET['dp_preview'] = '0';
		WDP_Test_State::$caps = array( 'manage_woocommerce' );
		$this->assertFalse(Preview::activate(), 'parametre 1 degil');
	}

	public function test_preview_forces_modules_without_writing_settings(): void {
		$_GET['dp_preview']      = '1';
		WDP_Test_State::$user_id = 5;
		WDP_Test_State::$caps    = array( 'manage_woocommerce' );

		$registry = new Module_Registry(new Settings());
		Plugin::register_modules($registry);
		$this->assertFalse($registry->is_enabled('social_proof'));
		$this->assertFalse($registry->is_enabled('experiences'));

		$this->assertTrue(Preview::activate());
		$this->assertTrue(Settings::is_preview());
		foreach ( $registry->slugs() as $slug ) {
			$this->assertTrue($registry->is_enabled($slug), $slug);
		}
		$this->assertTrue(Settings::engine_is_new());
		$this->assertTrue(( new Settings() )->module_enabled('thanks'));
		$this->assertArrayNotHasKey(Settings::OPTION_NAME, WDP_Test_State::$options, 'ayar yazilmaz');

		Settings::set_preview(false);
		$this->assertFalse($registry->is_enabled('social_proof'));
	}

	public function test_preview_link_format(): void {
		$this->assertSame('https://example.test/urun/?dp_preview=1', Preview::link_for('https://example.test/urun/'));
	}
}

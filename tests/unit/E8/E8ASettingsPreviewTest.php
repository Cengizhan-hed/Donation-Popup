<?php
/**
 * E8A: yeni kurulum varsayılanı ve önizleme.
 *
 * @package DonationPanel
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

	public function test_fresh_install_seeds_settings_without_engine_or_ui_choice(): void {
		$this->assertTrue(Settings::seed_fresh_install());
		$stored = WDP_Test_State::$options[ Settings::OPTION_NAME ];
		$this->assertArrayNotHasKey('experiences', $stored);
		$this->assertArrayNotHasKey('ui', $stored['admin']);
		$this->assertFalse(method_exists(Settings::class, 'admin_ui_is_new'));
	}

	public function test_seed_is_idempotent_and_never_overwrites_a_choice(): void {
		Settings::seed_fresh_install();
		( new Settings() )->update(array( 'admin' => array( 'wizard' => 'done' ) ));
		$this->assertFalse(Settings::seed_fresh_install());
		$this->assertSame('done', ( new Settings() )->get('admin.wizard'));
	}

	public function test_existing_installs_are_not_seeded(): void {
		WDP_Test_State::$options['wdp_version'] = '10.30.0';
		$this->assertFalse(Settings::seed_fresh_install());
		$this->assertArrayNotHasKey(Settings::OPTION_NAME, WDP_Test_State::$options);

		WDP_Test_State::reset();
		WDP_Test_State::$options['wdp_cache_version'] = 12345;
		$this->assertFalse(Settings::seed_fresh_install());
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
		$this->assertTrue($registry->is_enabled('experiences'));

		$this->assertTrue(Preview::activate());
		$this->assertTrue(Settings::is_preview());
		foreach ( $registry->slugs() as $slug ) {
			$this->assertTrue($registry->is_enabled($slug), $slug);
		}
		$this->assertTrue(( new Settings() )->module_enabled('thanks'));
		$this->assertArrayNotHasKey(Settings::OPTION_NAME, WDP_Test_State::$options, 'ayar yazilmaz');

		Settings::set_preview(false);
		$this->assertFalse($registry->is_enabled('social_proof'));
	}

	public function test_preview_link_format(): void {
		$this->assertSame('https://example.test/urun/?dp_preview=1', Preview::link_for('https://example.test/urun/'));
	}
}

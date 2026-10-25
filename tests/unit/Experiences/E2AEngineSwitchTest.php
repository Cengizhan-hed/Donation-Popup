<?php
/**
 * E2A: `experiences.engine` anahtarı — legacy iken hiçbir yeni dosya yüklenmez.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Plugin;
use DonationPanel\Core\Settings;
use PHPUnit\Framework\TestCase;

final class E2AEngineSwitchTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	private static function experiences_files_loaded(): array {
		return array_values(
			array_filter(
				get_included_files(),
				static function ( $file ) {
					return false !== strpos( $file, '/src/Modules/Experiences/' );
				}
			)
		);
	}

	public function test_default_engine_is_legacy(): void {
		$this->assertSame( 'legacy', ( new Settings() )->get( 'experiences.engine' ) );
		$this->assertFalse( Settings::engine_is_new() );
	}

	public function test_unknown_engine_value_falls_back_to_legacy(): void {
		WDP_Test_State::$options[ Settings::OPTION_NAME ] = array( 'experiences' => array( 'engine' => 'future' ) );
		$this->assertSame( 'legacy', ( new Settings() )->get( 'experiences.engine' ) );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_legacy_engine_loads_no_experiences_file(): void {
		$registry = new Module_Registry( new Settings() );
		Plugin::register_modules( $registry );
		$this->assertContains( 'experiences', $registry->slugs() );
		$this->assertFalse( $registry->is_enabled( 'experiences' ) );

		$registry->boot( new Container() );
		$this->assertNotContains( 'experiences', $registry->active_slugs() );
		$this->assertSame( array(), self::experiences_files_loaded() );
	}

	public function test_new_engine_enables_module(): void {
		( new Settings() )->update( array( 'experiences' => array( 'engine' => 'new' ) ) );
		$registry = new Module_Registry( new Settings() );
		Plugin::register_modules( $registry );
		$this->assertTrue( $registry->is_enabled( 'experiences' ) );
	}

	public function test_explicit_module_setting_wins_over_engine(): void {
		( new Settings() )->update( array( 'experiences' => array( 'engine' => 'new' ), 'modules' => array( 'experiences' => false ) ) );
		$registry = new Module_Registry( new Settings() );
		Plugin::register_modules( $registry );
		$this->assertFalse( $registry->is_enabled( 'experiences' ) );
	}
}

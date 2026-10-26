<?php
/**
 * 12.0.0: tek deneyim — `experiences` modülü varsayılan açıktır, motor seçimi yoktur.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Plugin;
use DonationPanel\Core\Settings;
use PHPUnit\Framework\TestCase;

final class ExperiencesSingleEngineTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_experiences_and_impact_are_on_by_default(): void {
		$registry = new Module_Registry( new Settings() );
		Plugin::register_modules( $registry );
		$this->assertContains( 'experiences', $registry->slugs() );
		$this->assertTrue( $registry->is_enabled( 'experiences' ) );
		$this->assertTrue( $registry->is_enabled( 'impact' ) );
	}

	public function test_explicit_module_setting_still_switches_off(): void {
		( new Settings() )->update( array( 'modules' => array( 'experiences' => false ) ) );
		$registry = new Module_Registry( new Settings() );
		Plugin::register_modules( $registry );
		$this->assertFalse( $registry->is_enabled( 'experiences' ) );
	}

	public function test_engine_choice_is_gone_from_schema_and_stored_value_is_dropped(): void {
		$this->assertArrayNotHasKey( 'experiences', Settings::schema() );
		$this->assertFalse( method_exists( Settings::class, 'engine_is_new' ) );
		$this->assertFalse( defined( Settings::class . '::ENGINES' ) );

		WDP_Test_State::$options[ Settings::OPTION_NAME ] = array( 'experiences' => array( 'engine' => 'legacy' ) );
		$this->assertNull( ( new Settings() )->get( 'experiences.engine' ) );
		$this->assertArrayNotHasKey( 'experiences', Settings::normalize( WDP_Test_State::$options[ Settings::OPTION_NAME ] ) );
	}
}

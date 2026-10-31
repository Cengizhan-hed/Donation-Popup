<?php
/**
 * 12.4 email5: kaldırılan e-posta ayarlarının göçü yalnız kendi anahtarlarını siler ve idempotenttir.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Email_Settings_Cleanup;
use DonationPanel\Core\Migrations;
use DonationPanel\Core\Settings;
use PHPUnit\Framework\TestCase;

final class EmailSettingsCleanupTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	private function seed(): void {
		WDP_Test_State::$options[ Settings::OPTION_NAME ] = array(
			'general' => array( 'delete_data_on_uninstall' => true ),
			'form'    => array(
				'donor_email' => true,
				'dedication'  => true,
			),
			'shares'  => array(
				'email'       => true,
				'copy_button' => true,
			),
			'modules' => array( 'campaign' => true ),
		);
		WDP_Test_State::$options['wdp_button_settings']      = array(
			'enable_donor_email'  => '1',
			'button_primary_color' => '#ff0000',
		);
		WDP_Test_State::$options['wdp_shareholder_settings'] = array(
			'shareholder_enable_email'       => '1',
			'shareholder_enable_copy_button' => '1',
		);
		foreach ( array( 10, 11 ) as $id ) {
			WDP_Test_State::$products[ $id ]   = new WC_Product( $id );
			WDP_Test_State::$post_types[ $id ] = 'product';
		}
		WDP_Test_State::$post_meta[10] = array(
			'_enable_email'      => 'yes',
			'_enable_dedication' => 'yes',
			'_wdp_donor_count'   => '5',
			'_other_plugin_key'  => 'keep',
		);
		WDP_Test_State::$post_meta[11] = array( '_enable_email' => '' );
		WDP_Test_State::$post_meta[12] = array( '_enable_email' => 'yes' ); // ürün değil: dokunulmaz.
	}

	public function test_removes_only_the_removed_email_keys(): void {
		$this->seed();

		$summary = ( new Email_Settings_Cleanup() )->run();

		$stored = WDP_Test_State::$options[ Settings::OPTION_NAME ];
		$this->assertArrayNotHasKey( 'donor_email', $stored['form'] );
		$this->assertTrue( $stored['form']['dedication'] );
		$this->assertArrayNotHasKey( 'email', $stored['shares'] );
		$this->assertTrue( $stored['shares']['copy_button'] );
		$this->assertTrue( $stored['general']['delete_data_on_uninstall'] );
		$this->assertTrue( $stored['modules']['campaign'] );
		$this->assertSame( array( 'button_primary_color' => '#ff0000' ), array( 'button_primary_color' => WDP_Test_State::$options['wdp_button_settings']['button_primary_color'] ) );
		$this->assertArrayNotHasKey( 'enable_donor_email', WDP_Test_State::$options['wdp_button_settings'] );
		$this->assertArrayNotHasKey( 'shareholder_enable_email', WDP_Test_State::$options['wdp_shareholder_settings'] );
		$this->assertSame( '1', WDP_Test_State::$options['wdp_shareholder_settings']['shareholder_enable_copy_button'] );

		$this->assertArrayNotHasKey( '_enable_email', WDP_Test_State::$post_meta[10] );
		$this->assertArrayNotHasKey( '_enable_email', WDP_Test_State::$post_meta[11] );
		$this->assertSame( 'yes', WDP_Test_State::$post_meta[10]['_enable_dedication'] );
		$this->assertSame( '5', WDP_Test_State::$post_meta[10]['_wdp_donor_count'] );
		$this->assertSame( 'keep', WDP_Test_State::$post_meta[10]['_other_plugin_key'] );
		$this->assertSame( 'yes', WDP_Test_State::$post_meta[12]['_enable_email'], 'ürün olmayan kayda dokunulmaz' );
		$this->assertSame( array( 'settings' => 2, 'legacy' => 2, 'product_meta' => 2 ), $summary );
	}

	public function test_running_twice_gives_the_same_result(): void {
		$this->seed();
		( new Email_Settings_Cleanup() )->run();
		$snapshot_options = WDP_Test_State::$options;
		$snapshot_meta    = WDP_Test_State::$post_meta;

		$second = ( new Email_Settings_Cleanup() )->run();

		$this->assertSame( $snapshot_options, WDP_Test_State::$options );
		$this->assertSame( $snapshot_meta, WDP_Test_State::$post_meta );
		$this->assertSame( array( 'settings' => 0, 'legacy' => 0, 'product_meta' => 0 ), $second );
	}

	public function test_product_meta_is_cleaned_in_chunks_across_many_products(): void {
		$total = Email_Settings_Cleanup::BATCH * 2 + 37;
		for ( $id = 1000; $id < 1000 + $total; $id++ ) {
			WDP_Test_State::$products[ $id ]         = new WC_Product( $id );
			WDP_Test_State::$post_types[ $id ]       = 'product';
			WDP_Test_State::$post_meta[ $id ]        = array( '_enable_email' => 'yes', '_enable_dedication' => 'yes' );
		}

		$summary = ( new Email_Settings_Cleanup() )->run();

		$this->assertSame( $total, $summary['product_meta'] );
		foreach ( WDP_Test_State::$post_meta as $meta ) {
			$this->assertArrayNotHasKey( '_enable_email', $meta );
			$this->assertSame( 'yes', $meta['_enable_dedication'] );
		}
	}

	public function test_missing_options_are_not_created(): void {
		( new Email_Settings_Cleanup() )->run();

		$this->assertArrayNotHasKey( Settings::OPTION_NAME, WDP_Test_State::$options );
		$this->assertArrayNotHasKey( 'wdp_button_settings', WDP_Test_State::$options );
		$this->assertArrayNotHasKey( 'wdp_shareholder_settings', WDP_Test_State::$options );
	}

	public function test_step_is_version_gated_and_runs_once(): void {
		$this->seed();
		$migrations = new Migrations();
		$migrations->add_step(
			'email_settings_cleanup',
			3,
			static function () {
				( new Email_Settings_Cleanup() )->run();
			}
		);

		$this->assertSame( array( 'email_settings_cleanup' ), $migrations->run() );
		$this->assertSame( array(), $migrations->run() );
		$this->assertSame( 3, $migrations->state()['version'] );
	}

	public function test_schema_no_longer_knows_the_removed_keys(): void {
		$schema = Settings::schema();

		$this->assertArrayNotHasKey( 'donor_email', $schema['form'] );
		$this->assertArrayNotHasKey( 'email', $schema['shares'] );
	}
}

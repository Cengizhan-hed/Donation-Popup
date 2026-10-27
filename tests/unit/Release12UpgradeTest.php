<?php
/**
 * 12.0.0 yükseltme adımı: motor seçimi artığı temizlenir, kampanya devir alanları kurulur, toplam değişmez, idempotent.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Release_12_Upgrade;
use DonationPanel\Core\Settings;
use DonationPanel\Core\Version_Migrations;
use PHPUnit\Framework\TestCase;

final class Release12UpgradeTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	private function product( int $id, $total ): void {
		WDP_Test_State::$products[ $id ]  = new WC_Product( $id );
		WDP_Test_State::$post_types[ $id ] = 'product';
		if ( null !== $total ) {
			WDP_Test_State::$post_meta[ $id ][ Release_12_Upgrade::META_TOTAL ] = $total;
		}
	}

	public function test_removes_engine_choice_and_obsolete_options_but_keeps_other_settings(): void {
		WDP_Test_State::$options[ Settings::OPTION_NAME ]  = array(
			'general'     => array( 'delete_data_on_uninstall' => true ),
			'experiences' => array( 'engine' => 'legacy' ),
			'modules'     => array( 'campaign' => true ),
		);
		WDP_Test_State::$options['wdp_upgrade_new_default']        = '1';
		WDP_Test_State::$options['wdp_deprecated_ajax_wdp_ajax_add_to_cart'] = 7;
		WDP_Test_State::$options['wdp_button_settings']            = array( 'button_primary_color' => '#ff0000' );

		$summary = ( new Release_12_Upgrade() )->run();

		$stored = WDP_Test_State::$options[ Settings::OPTION_NAME ];
		$this->assertArrayNotHasKey( 'experiences', $stored );
		$this->assertTrue( $stored['general']['delete_data_on_uninstall'] );
		$this->assertTrue( $stored['modules']['campaign'] );
		$this->assertArrayNotHasKey( 'wdp_upgrade_new_default', WDP_Test_State::$options );
		$this->assertArrayNotHasKey( 'wdp_deprecated_ajax_wdp_ajax_add_to_cart', WDP_Test_State::$options );
		$this->assertSame( array( 'button_primary_color' => '#ff0000' ), WDP_Test_State::$options['wdp_button_settings'], 'bağışçıya/yöneticiye ait ayar korunur' );
		$this->assertSame( 1, $summary['settings_cleaned'] );
	}

	public function test_carry_over_fields_are_seeded_and_total_is_untouched(): void {
		$this->product( 10, '1234.5' );
		$this->product( 11, null );
		$this->product( 12, '0' );
		WDP_Test_State::$post_meta[10]['_wdp_manual_total'] = '50';

		$before = time();
		( new Release_12_Upgrade() )->run();

		$this->assertEquals( 1234.5, WDP_Test_State::$post_meta[10][ Release_12_Upgrade::META_CARRIED ] );
		$this->assertGreaterThanOrEqual( $before, (int) WDP_Test_State::$post_meta[10][ Release_12_Upgrade::META_CAMPAIGN_START ] );
		$this->assertSame( '1234.5', WDP_Test_State::$post_meta[10][ Release_12_Upgrade::META_TOTAL ], 'saklı toplam değişmez' );
		$this->assertSame( '50', WDP_Test_State::$post_meta[10]['_wdp_manual_total'], 'elle eklenen tutar değişmez' );
		$this->assertArrayNotHasKey( Release_12_Upgrade::META_CARRIED, WDP_Test_State::$post_meta[11] ?? array(), 'toplamı olmayan ürüne dokunulmaz' );
		$this->assertEquals( 0.0, WDP_Test_State::$post_meta[12][ Release_12_Upgrade::META_CARRIED ] );
	}

	public function test_is_idempotent_and_never_overwrites_existing_carry_fields(): void {
		$this->product( 20, '300' );
		WDP_Test_State::$post_meta[20][ Release_12_Upgrade::META_CARRIED ]       = '111';
		WDP_Test_State::$post_meta[20][ Release_12_Upgrade::META_CAMPAIGN_START ] = '1700000000';

		( new Release_12_Upgrade() )->run();
		$snapshot = WDP_Test_State::$post_meta;
		$second   = ( new Release_12_Upgrade() )->run();

		$this->assertSame( '111', (string) WDP_Test_State::$post_meta[20][ Release_12_Upgrade::META_CARRIED ] );
		$this->assertSame( '1700000000', (string) WDP_Test_State::$post_meta[20][ Release_12_Upgrade::META_CAMPAIGN_START ] );
		$this->assertSame( $snapshot, WDP_Test_State::$post_meta );
		$this->assertSame( array( 'settings_cleaned' => 0, 'options_deleted' => 0, 'carried' => 0 ), $second );
	}

	public function test_old_version_migrations_stay_idempotent_after_the_move(): void {
		WDP_Test_State::$options['wdp_version']                  = '10.35.2';
		WDP_Test_State::$options[ Version_Migrations::OPTION ]   = '10.35.2';
		WDP_Test_State::$options['wdp_button_settings']          = array( 'button_primary_color' => '#ff0000' );

		$this->assertTrue( Version_Migrations::needs_run() );
		Version_Migrations::maybe_run();
		$snapshot = WDP_Test_State::$options;
		$this->assertFalse( Version_Migrations::needs_run() );
		Version_Migrations::maybe_run();
		$this->assertSame( $snapshot, WDP_Test_State::$options );
		$this->assertSame( array( 'button_primary_color' => '#ff0000' ), WDP_Test_State::$options['wdp_button_settings'] );
	}
}

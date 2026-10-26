<?php
/**
 * K2: kampanya toplamı tanımı (ödenmiş, iadesiz, dönem içi, kurla çevrilmiş), elle eklenen tutar ve göç ÖNERİSİ.
 *
 * Her test ayrı süreçte koşar (wc_get_orders çifti bu dosyada tanımlı).
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use DonationPanel\Cli\Totals_Recalculator;
use PHPUnit\Framework\TestCase;

final class K2CampaignTotalsTest extends TestCase {

	private const P1 = 101;

	/** @var WDP_Fake_Order[] */
	public static $orders = array();

	protected function setUp(): void {
		WDP_Test_State::reset();
		self::$orders = array();
		WDP_Test_State::$options['woocommerce_currency'] = 'TRY';
		if ( ! function_exists( 'wc_get_orders' ) ) {
			function wc_get_orders( $args ) { // phpcs:ignore
				$want = isset( $args['status'] ) ? array_map( static function ( $s ) { return preg_replace( '/^wc-/', '', (string) $s ); }, (array) $args['status'] ) : array();
				$hit  = array();
				foreach ( K2CampaignTotalsTest::$orders as $o ) {
					if ( ! $want || in_array( $o->get_status(), $want, true ) ) {
						$hit[] = $o;
					}
				}
				return (object) array(
					'orders'        => $hit,
					'max_num_pages' => 1,
				);
			}
		}
	}

	private function order( int $id, float $amount, string $status, string $date = '2026-06-01 12:00:00', string $currency = 'TRY', float $refunded = 0.0 ): WDP_Fake_Order {
		$order             = new WDP_Fake_Order( $id, array( 1 => new WDP_Fake_Order_Item( self::P1, $amount, 1, array( '_custom_price' => $amount ) ) ) );
		$order->currency   = $currency;
		$order->status     = $status;
		$order->created_ts = (int) strtotime( $date . ' UTC' );
		if ( $refunded > 0 ) {
			$order->refunded_for_item[1] = $refunded;
		}
		return $order;
	}

	/**
	 * A 100 completed, B 50 processing, G 200 completed (80 iade), I 30 EUR (kur 0.03 => 1000), iptal 30, bekleyen 20,
	 * beklemede 10, basarisiz 5, donem disi 40. Dönem 2026 yılı.
	 */
	private function seed(): void {
		WDP_Test_State::$timezone = 'UTC';
		update_post_meta( self::P1, '_wdp_campaign_starts_at', '2026-01-01' );
		update_post_meta( self::P1, '_wdp_campaign_ends_at', '2026-12-31' );
		add_filter(
			'wdp_order_exchange_rate',
			static function ( $rate, $order, $currency ) {
				unset( $rate, $order );
				return 'EUR' === $currency ? 0.03 : null;
			},
			10,
			3
		);
		self::$orders = array(
			$this->order( 1, 100.0, 'completed' ),
			$this->order( 2, 50.0, 'processing' ),
			$this->order( 3, 200.0, 'completed', '2026-12-31 23:59:59', 'TRY', 80.0 ),
			$this->order( 4, 30.0, 'completed', '2026-03-01 10:00:00', 'EUR' ),
			$this->order( 5, 30.0, 'cancelled' ),
			$this->order( 6, 20.0, 'pending' ),
			$this->order( 7, 10.0, 'on-hold' ),
			$this->order( 8, 5.0, 'failed' ),
			$this->order( 9, 40.0, 'completed', '2025-06-01 12:00:00' ),
		);
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_definition_counts_only_paid_in_period_net_of_refunds_converted(): void {
		$this->seed();
		$result = ( new Totals_Recalculator() )->run( array( self::P1 ) );
		$row    = $result['rows'][0];
		// 100 + 50 + (200-80) + 30/0.03 = 1270; 4 siparis; iptal/bekleyen/beklemede/basarisiz/donem disi sayilmaz.
		$this->assertEqualsWithDelta( 1270.0, $row['new_total'], 0.001 );
		$this->assertSame( 4, $row['orders'] );
		$this->assertSame( 4, $row['new_donors'] );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_default_is_dry_run_and_write_needs_explicit_permission(): void {
		$this->seed();
		update_post_meta( self::P1, '_wdp_total_donation_amount', 5.0 );
		$calc = new Totals_Recalculator();

		$default = $calc->run( array( self::P1 ) );
		$this->assertSame( 0, $default['written'] );
		$this->assertEquals( 5.0, get_post_meta( self::P1, '_wdp_total_donation_amount', true ) );

		try {
			$calc->run( array( self::P1 ), false );
			$this->fail( 'izinsiz yazma reddedilmeli' );
		} catch ( \RuntimeException $e ) {
			$this->assertStringContainsString( 'write mode is disabled', $e->getMessage() );
		}
		$this->assertEquals( 5.0, get_post_meta( self::P1, '_wdp_total_donation_amount', true ), 'istisna sonrasi hicbir sey yazilmaz' );
		foreach ( self::$orders as $order ) {
			$this->assertArrayNotHasKey( '_wdp_progress_counted', $order->meta );
		}
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_breakdown_splits_diff_into_status_period_refund_and_manual(): void {
		$this->seed();
		// 1270 + durum 65 + donem disi 40 + iade 80 + elle 500.
		update_post_meta( self::P1, '_wdp_total_donation_amount', 1955.0 );
		update_post_meta( self::P1, '_wdp_donor_count', 4 );

		$row = ( new Totals_Recalculator() )->run( array( self::P1 ) )['rows'][0];
		$this->assertEqualsWithDelta( 685.0, $row['diff'], 0.001 );
		$this->assertEqualsWithDelta( 65.0, $row['breakdown']['status'], 0.001 );
		$this->assertEqualsWithDelta( 40.0, $row['breakdown']['period_out'], 0.001 );
		$this->assertEqualsWithDelta( 80.0, $row['breakdown']['refund'], 0.001 );
		$this->assertEqualsWithDelta( 500.0, $row['breakdown']['assigned']['manual'], 0.001 );
		$this->assertSame( 'manual', $row['reason'] );
		$this->assertEqualsWithDelta( 685.0, $row['suggested_manual'], 0.001 );
		$this->assertEqualsWithDelta( 1955.0, $row['display_after'], 0.001, 'bagiscinin gordugu sayi degismez' );
		$this->assertFalse( $row['display_increases'] );
		$this->assertEqualsWithDelta( 30.0, $row['breakdown']['status_detail']['cancelled'], 0.001 );
		$this->assertEqualsWithDelta( 5.0, $row['breakdown']['status_detail']['failed'], 0.001 );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_negative_diff_suggests_no_manual_and_flags_increase(): void {
		$this->seed();
		update_post_meta( self::P1, '_wdp_total_donation_amount', 1000.0 );
		update_post_meta( self::P1, '_wdp_donor_count', 4 );

		$row = ( new Totals_Recalculator() )->run( array( self::P1 ) )['rows'][0];
		$this->assertEqualsWithDelta( -270.0, $row['diff'], 0.001 );
		$this->assertSame( 0.0, $row['suggested_manual'] );
		$this->assertSame( 'currency', $row['reason'], 'yabanci birimli satir var' );
		$this->assertEqualsWithDelta( 1270.0, $row['display_after'], 0.001 );
		$this->assertTrue( $row['display_increases'] );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_missing_stored_total_is_labelled_no_data(): void {
		$this->seed();
		$row = ( new Totals_Recalculator() )->run( array( self::P1 ) )['rows'][0];
		$this->assertNull( $row['diff'] );
		$this->assertSame( 'no_data', $row['reason'] );
		$this->assertSame( 0.0, $row['suggested_manual'] );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_period_end_is_inclusive_and_no_period_counts_everything(): void {
		$this->seed();
		$this->assertTrue( WDP_Utils::is_order_in_campaign_period( self::$orders[2], self::P1 ), 'bitis gunu 23:59:59 dahil' );
		$this->assertFalse( WDP_Utils::is_order_in_campaign_period( self::$orders[8], self::P1 ) );
		delete_post_meta( self::P1, '_wdp_campaign_starts_at' );
		delete_post_meta( self::P1, '_wdp_campaign_ends_at' );
		$this->assertNull( WDP_Utils::get_campaign_period( self::P1 ) );
		$this->assertTrue( WDP_Utils::is_order_in_campaign_period( self::$orders[8], self::P1 ) );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_apply_never_touches_manual_total_and_display_adds_it(): void {
		$this->seed();
		update_post_meta( self::P1, '_wdp_manual_total', 300.0 );
		update_post_meta( self::P1, '_wdp_total_donation_amount', 10.0 );

		$result = ( new Totals_Recalculator() )->run( array( self::P1 ), false, true );
		$this->assertSame( 1, $result['written'] );
		$this->assertEquals( 300.0, get_post_meta( self::P1, '_wdp_manual_total', true ) );
		$this->assertEqualsWithDelta( 1270.0, (float) get_post_meta( self::P1, '_wdp_total_donation_amount', true ), 0.001 );

		$this->assertEqualsWithDelta( 1570.0, WDP_Utils::get_total_donation_amount( self::P1 ), 0.001 );
		$this->assertEqualsWithDelta( 1270.0, WDP_Utils::get_calculated_total_donation_amount( self::P1 ), 0.001 );
		$this->assertEqualsWithDelta( 300.0, WDP_Utils::get_manual_total( self::P1 ), 0.001 );
		$this->assertEqualsWithDelta( 1570.0, WDP_Utils::get_totals_for_products( array( self::P1 ) )[ self::P1 ], 0.001 );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_manual_total_is_not_reduced_by_incremental_order_updates(): void {
		update_post_meta( self::P1, '_wdp_manual_total', 300.0 );
		update_post_meta( self::P1, '_wdp_total_donation_amount', 100.0 );
		$order = $this->order( 1, 50.0, 'completed' );

		WDP_Utils::sync_order_donation_totals_on_status_change( 1, 'pending', 'completed', $order );
		WDP_Utils::sync_order_donation_totals_on_status_change( 1, 'completed', 'cancelled', $order );

		$this->assertEquals( 300.0, get_post_meta( self::P1, '_wdp_manual_total', true ) );
		$this->assertEqualsWithDelta( 100.0, (float) get_post_meta( self::P1, '_wdp_total_donation_amount', true ), 0.001 );
	}
}

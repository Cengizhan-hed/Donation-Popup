<?php
/**
 * #3/#16: kampanya toplamı kilit altında, sipariş bayrağı taze okunur; HPOS silme/çöp kancaları.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Domain\Campaign_Totals;
use DonationPanel\Domain\Named_Lock;
use PHPUnit\Framework\TestCase;

final class CampaignTotalsAtomicTest extends TestCase {

	private const PRODUCT = 301;

	protected function setUp(): void {
		WDP_Test_State::reset();
		update_post_meta( self::PRODUCT, '_wdp_total_donation_amount', 100.0 );
	}

	private function order( int $id, float $amount ): WDP_Fake_Order {
		return new WDP_Fake_Order( $id, array( 1 => new WDP_Fake_Order_Item( self::PRODUCT, $amount, 1, array( '_custom_price' => $amount ) ) ) );
	}

	private function total(): float {
		return (float) get_post_meta( self::PRODUCT, '_wdp_total_donation_amount', true );
	}

	public function test_stale_order_object_does_not_double_count(): void {
		// Bir başka istek siparişi zaten saydı (taze kayıtta bayrak var); bu istekteki nesne bayatta kalmış.
		$fresh                       = $this->order( 7, 50.0 );
		$fresh->meta['_wdp_progress_counted'] = 'yes';
		WDP_Test_State::$orders[7]   = $fresh;
		$stale                       = $this->order( 7, 50.0 );

		$this->assertFalse( Campaign_Totals::count_order_in_progress_totals( $stale ) );
		$this->assertSame( 100.0, $this->total() );
	}

	public function test_lock_is_released_after_count_and_after_exception(): void {
		$order = $this->order( 8, 25.0 );
		WDP_Test_State::$orders[8] = $order;
		Campaign_Totals::count_order_in_progress_totals( $order );
		$this->assertSame( 125.0, $this->total() );
		foreach ( array_keys( WDP_Test_State::$options ) as $name ) {
			$this->assertStringStartsNotWith( Named_Lock::PREFIX, (string) $name, 'kilit bırakılmalı' );
		}

		try {
			Named_Lock::run( 'x', static function () {
				throw new \RuntimeException( 'boom' );
			} );
		} catch ( \RuntimeException $e ) {
			unset( $e );
		}
		$this->assertArrayNotHasKey( Named_Lock::PREFIX . 'x', WDP_Test_State::$options );
	}

	public function test_lock_is_held_while_callback_runs(): void {
		$seen = null;
		Named_Lock::run( 'y', static function () use ( &$seen ) {
			$seen = array_key_exists( Named_Lock::PREFIX . 'y', WDP_Test_State::$options );
		} );
		$this->assertTrue( $seen );
	}

	public function test_hpos_delete_and_trash_hooks_uncount_order(): void {
		$order = $this->order( 9, 40.0 );
		WDP_Test_State::$orders[9] = $order;
		Campaign_Totals::count_order_in_progress_totals( $order );
		$this->assertSame( 140.0, $this->total() );

		Campaign_Totals::uncount_order_progress_on_hpos_removal( 9, $order );
		$this->assertSame( 100.0, $this->total() );

		// ikinci çağrı (post kancası + HPOS kancası birlikte) tekrar düşmez
		Campaign_Totals::uncount_order_progress_on_hpos_removal( 9, $order );
		$this->assertSame( 100.0, $this->total() );
	}

	public function test_init_registers_hpos_hooks(): void {
		Campaign_Totals::init();
		foreach ( array( 'woocommerce_before_delete_order', 'woocommerce_before_trash_order', 'woocommerce_untrash_order' ) as $hook ) {
			$this->assertNotEmpty( WDP_Test_State::$actions[ $hook ] ?? array(), $hook );
		}
	}
}

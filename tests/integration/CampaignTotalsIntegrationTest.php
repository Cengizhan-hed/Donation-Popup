<?php
/**
 * Gerçek WP + WooCommerce + HPOS: kampanya toplamı yalnız bir kez sayılır, sipariş silinince/çöpe gidince düşer.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Domain\Campaign_Totals;

final class CampaignTotalsIntegrationTest extends WDP_Integration_Test_Case {

	public function test_order_is_counted_once_even_with_a_stale_order_object(): void {
		$product = $this->create_product( '40' );
		$id      = $product->get_id();
		$order   = $this->create_order( $id, 40.0, 'pending' );

		$stale = wc_get_order( $order->get_id() ); // bu nesne "pending" kalacak
		$fresh = wc_get_order( $order->get_id() );
		$fresh->update_status( 'completed' );
		$this->assertSame( 40.0, $this->total_for( $id ), 'Tamamlanınca bir kez sayılır.' );
		$this->assertSame( 1, $this->donors_for( $id ) );

		// Başka bir istekteki bayat nesne yeniden saymaya çalışır: çift sayım olmamalı.
		$this->assertFalse( Campaign_Totals::count_order_in_progress_totals( $stale ) );
		$this->assertSame( 40.0, $this->total_for( $id ) );
		$this->assertSame( 1, $this->donors_for( $id ) );
	}

	public function test_two_different_orders_add_up_without_double_counting(): void {
		$product = $this->create_product( '10' );
		$id      = $product->get_id();
		$a       = $this->create_order( $id, 10.0, 'pending' );
		$b       = $this->create_order( $id, 15.0, 'pending' );
		foreach ( array( $a, $b ) as $order ) {
			wc_get_order( $order->get_id() )->update_status( 'processing' );
		}
		// Aynı sipariş tekrar durum değiştirir (processing -> completed): yeniden sayılmaz.
		wc_get_order( $a->get_id() )->update_status( 'completed' );
		$this->assertSame( 25.0, $this->total_for( $id ) );
		$this->assertSame( 2, $this->donors_for( $id ) );
	}

	public function test_hpos_trash_and_permanent_delete_lower_the_total(): void {
		$this->assertTrue( \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled(), 'Bu test HPOS içindir.' );
		$product = $this->create_product( '60' );
		$id      = $product->get_id();
		$keep    = $this->create_order( $id, 20.0, 'completed' );
		$trash   = $this->create_order( $id, 60.0, 'completed' );
		$gone    = $this->create_order( $id, 5.0, 'completed' );
		$this->assertSame( 85.0, $this->total_for( $id ) );
		$this->assertSame( 3, $this->donors_for( $id ) );

		wc_get_order( $trash->get_id() )->delete( false ); // çöpe
		$this->assertSame( 25.0, $this->total_for( $id ), 'Çöpe giden sipariş toplamdan düşmeli.' );

		wc_get_order( $gone->get_id() )->delete( true ); // kalıcı silme
		$this->assertSame( 20.0, $this->total_for( $id ), 'Kalıcı silinen sipariş toplamdan düşmeli.' );
		$this->assertSame( 1, $this->donors_for( $id ) );
		$this->assertNotNull( wc_get_order( $keep->get_id() ) );
	}
}

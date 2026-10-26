<?php
/**
 * Progress bar totals: paid statuses, double-count guard, reversals and refunds.
 *
 * @package WDP\Tests
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * @covers WDP_Utils
 */
final class ProgressTotalsTest extends TestCase {

	private const PRODUCT = 101;

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	private function total(int $product_id = self::PRODUCT): float {
		return (float) get_post_meta($product_id, '_wdp_total_donation_amount', true);
	}

	private function order(int $id, float $amount, int $product_id = self::PRODUCT): WDP_Fake_Order {
		return new WDP_Fake_Order($id, array(1 => new WDP_Fake_Order_Item($product_id, $amount, 1, array('_custom_price' => $amount))));
	}

	public function test_default_paid_statuses_and_filter(): void {
		$this->assertSame(array('processing', 'completed'), \DonationPanel\Domain\Campaign_Totals::get_progress_paid_statuses());

		add_filter('wdp_progress_paid_statuses', static function () {
			return array('wc-completed', 'on-hold', '');
		});
		$this->assertSame(array('completed', 'on-hold'), \DonationPanel\Domain\Campaign_Totals::get_progress_paid_statuses());
	}

	public function test_paid_order_is_counted_once_across_processing_and_completed(): void {
		update_post_meta(self::PRODUCT, '_wdp_total_donation_amount', 100.0);
		$order = $this->order(1, 50.0);

		\DonationPanel\Domain\Campaign_Totals::sync_order_donation_totals_on_status_change(1, 'pending', 'processing', $order);
		\DonationPanel\Domain\Campaign_Totals::sync_order_donation_totals_on_status_change(1, 'processing', 'completed', $order);

		$this->assertSame(150.0, $this->total());
		$this->assertSame('yes', $order->meta['_wdp_progress_counted']);
		$this->assertSame(1, (int) get_post_meta(self::PRODUCT, '_wdp_donor_count', true));
	}

	public function test_unpaid_status_is_not_counted(): void {
		update_post_meta(self::PRODUCT, '_wdp_total_donation_amount', 0.0);
		$order = $this->order(2, 50.0);

		\DonationPanel\Domain\Campaign_Totals::sync_order_donation_totals_on_status_change(2, 'pending', 'on-hold', $order);

		$this->assertSame(0.0, $this->total());
		$this->assertArrayNotHasKey('_wdp_progress_counted', $order->meta);
	}

	public function test_cancel_reverts_counted_order_and_clears_flag(): void {
		update_post_meta(self::PRODUCT, '_wdp_total_donation_amount', 100.0);
		$order = $this->order(3, 40.0);

		\DonationPanel\Domain\Campaign_Totals::sync_order_donation_totals_on_status_change(3, 'pending', 'processing', $order);
		\DonationPanel\Domain\Campaign_Totals::sync_order_donation_totals_on_status_change(3, 'processing', 'cancelled', $order);

		$this->assertSame(100.0, $this->total());
		$this->assertArrayNotHasKey('_wdp_progress_counted', $order->meta);

		// Cancelling again (or failing) does not subtract twice.
		\DonationPanel\Domain\Campaign_Totals::sync_order_donation_totals_on_status_change(3, 'cancelled', 'failed', $order);
		$this->assertSame(100.0, $this->total());

		// Re-activated order counts again.
		\DonationPanel\Domain\Campaign_Totals::sync_order_donation_totals_on_status_change(3, 'failed', 'completed', $order);
		$this->assertSame(140.0, $this->total());
	}

	public function test_never_counted_order_is_not_subtracted(): void {
		update_post_meta(self::PRODUCT, '_wdp_total_donation_amount', 100.0);
		$order = $this->order(4, 40.0);

		\DonationPanel\Domain\Campaign_Totals::sync_order_donation_totals_on_status_change(4, 'pending', 'failed', $order);

		$this->assertSame(100.0, $this->total());
	}

	public function test_partial_refund_then_full_refund_never_over_subtracts(): void {
		update_post_meta(self::PRODUCT, '_wdp_total_donation_amount', 0.0);
		$order = $this->order(5, 100.0);
		\DonationPanel\Domain\Campaign_Totals::count_order_in_progress_totals($order);
		$this->assertSame(100.0, $this->total());

		$refund = new WC_Order_Refund(50, array(new WDP_Fake_Order_Item(self::PRODUCT, -30.0)));
		$this->assertSame(30.0, \DonationPanel\Domain\Campaign_Totals::apply_refund_to_progress_totals($order, $refund));
		$this->assertSame(70.0, $this->total());
		$this->assertSame(array(self::PRODUCT => 70.0), $order->meta['_wdp_progress_amounts']);

		// Same refund twice is ignored.
		$this->assertSame(0.0, \DonationPanel\Domain\Campaign_Totals::apply_refund_to_progress_totals($order, $refund));

		// Remaining amount removed when status becomes refunded.
		\DonationPanel\Domain\Campaign_Totals::sync_order_donation_totals_on_status_change(5, 'processing', 'refunded', $order);
		$this->assertSame(0.0, $this->total());

		// Refund arriving after the order was reverted is a no-op.
		$late = new WC_Order_Refund(51, array(new WDP_Fake_Order_Item(self::PRODUCT, -70.0)));
		$this->assertSame(0.0, \DonationPanel\Domain\Campaign_Totals::apply_refund_to_progress_totals($order, $late));
		$this->assertSame(0.0, $this->total());
	}

	public function test_total_never_goes_negative(): void {
		update_post_meta(self::PRODUCT, '_wdp_total_donation_amount', 10.0);

		$this->assertSame(0.0, \DonationPanel\Domain\Campaign_Totals::update_product_donation_total(self::PRODUCT, -500.0));
		$this->assertSame(0.0, $this->total());
		$this->assertSame(0.0, \DonationPanel\Domain\Campaign_Totals::update_product_donation_total(self::PRODUCT, -25.0, true));
	}

	public function test_uninitialized_total_is_left_for_full_scan(): void {
		$order = $this->order(6, 80.0);

		\DonationPanel\Domain\Campaign_Totals::count_order_in_progress_totals($order);

		$this->assertSame('', get_post_meta(self::PRODUCT, '_wdp_total_donation_amount', true));
		$this->assertSame('yes', $order->meta['_wdp_progress_counted']);
	}

	public function test_legacy_applied_order_is_not_double_counted_but_is_reverted(): void {
		update_post_meta(self::PRODUCT, '_wdp_total_donation_amount', 200.0);
		$order = $this->order(7, 60.0);
		$order->meta['_wdp_donation_totals_applied'] = 'yes';

		\DonationPanel\Domain\Campaign_Totals::sync_order_donation_totals_on_status_change(7, 'processing', 'completed', $order);
		$this->assertSame(200.0, $this->total());
		$this->assertSame('yes', $order->meta['_wdp_progress_counted']);

		\DonationPanel\Domain\Campaign_Totals::sync_order_donation_totals_on_status_change(7, 'completed', 'refunded', $order);
		$this->assertSame(140.0, $this->total());
		$this->assertArrayNotHasKey('_wdp_donation_totals_applied', $order->meta);
	}

	public function test_amounts_are_net_of_previous_refunds(): void {
		$order = $this->order(8, 100.0);
		$order->refunded_for_item[1] = 25.0;

		$this->assertSame(array(self::PRODUCT => 75.0), \DonationPanel\Domain\Campaign_Totals::compute_order_progress_amounts($order));
	}
}

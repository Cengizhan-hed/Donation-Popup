<?php
/**
 * E8A: `wp donation-panel recalc-totals` mantığı (kuru çalıştırma yazmaz, idempotent, para birimi dönüşümü).
 *
 * wc_get_orders çiftini bu dosya tanımlar; diğer testlerle çakışmaması için her test ayrı süreçte koşar.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Cli\Totals_Recalculator;
use PHPUnit\Framework\TestCase;

final class E8ARecalcTotalsTest extends TestCase {

	private const P1 = 101;
	private const P2 = 102;

	/** @var WDP_Fake_Order[] */
	public static $orders = array();

	protected function setUp(): void {
		WDP_Test_State::reset();
		self::$orders = array();
		WDP_Test_State::$options['woocommerce_currency'] = 'TRY';
		if ( ! function_exists('wc_get_orders') ) {
			function wc_get_orders( $args ) { // phpcs:ignore
				unset( $args );
				return (object) array(
					'orders'        => E8ARecalcTotalsTest::$orders,
					'max_num_pages' => 1,
				);
			}
		}
	}

	private function order(int $id, float $amount, string $currency = 'TRY', int $product = self::P1): WDP_Fake_Order {
		$order           = new WDP_Fake_Order($id, array( 1 => new WDP_Fake_Order_Item($product, $amount, 1, array( '_custom_price' => $amount )) ));
		$order->currency = $currency;
		return $order;
	}

	private function total(int $id = self::P1) {
		return get_post_meta($id, '_wdp_total_donation_amount', true);
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_single_currency_dry_run_does_not_write_then_apply_is_idempotent(): void {
		update_post_meta(self::P1, '_wdp_total_donation_amount', 10.0);
		update_post_meta(self::P1, '_wdp_donor_count', 1);
		self::$orders = array( $this->order(1, 50.0), $this->order(2, 70.0) );

		$calc = new Totals_Recalculator();
		$dry  = $calc->run(array( self::P1 ), true);

		$this->assertSame(10.0, $dry['rows'][0]['old_total']);
		$this->assertSame(120.0, $dry['rows'][0]['new_total']);
		$this->assertSame(2, $dry['rows'][0]['new_donors']);
		$this->assertSame(1, $dry['changed']);
		$this->assertSame(0, $dry['written']);
		$this->assertEquals(10.0, $this->total());
		$this->assertSame(1, (int) get_post_meta(self::P1, '_wdp_donor_count', true));
		foreach ( self::$orders as $order ) {
			$this->assertArrayNotHasKey('_wdp_progress_counted', $order->meta, 'siparis bayragi yazilmaz');
			$this->assertArrayNotHasKey('_wdp_progress_amounts', $order->meta);
		}

		$applied = $calc->run(array( self::P1 ), false, true);
		$this->assertSame(1, $applied['written']);
		$this->assertEquals(120.0, $this->total());
		$this->assertSame(2, (int) get_post_meta(self::P1, '_wdp_donor_count', true));

		$again = $calc->run(array( self::P1 ), false, true);
		$this->assertSame(0, $again['changed']);
		$this->assertSame(0, $again['written']);
		$this->assertEquals(120.0, $this->total());
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_eur_usd_orders_use_stored_rates(): void {
		add_filter('wdp_order_exchange_rate', static function ( $rate, $order, $currency ) {
			unset( $rate, $order );
			$map = array( 'EUR' => 0.03, 'USD' => 0.025 );
			return isset($map[ $currency ]) ? $map[ $currency ] : null;
		}, 10, 3);
		self::$orders = array( $this->order(1, 100.0), $this->order(2, 30.0, 'EUR'), $this->order(3, 10.0, 'USD') );

		$result = ( new Totals_Recalculator() )->run(array( self::P1 ), false, true);

		// 100 TRY + 30 EUR / 0.03 (=1000) + 10 USD / 0.025 (=400).
		$this->assertEqualsWithDelta(1500.0, $result['rows'][0]['new_total'], 0.001);
		$this->assertEqualsWithDelta(1500.0, (float) $this->total(), 0.001);
		$this->assertSame(0, $result['unconverted']);
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_order_without_rate_is_left_out_with_warning_and_dry_run_leaves_no_trace(): void {
		self::$orders = array( $this->order(1, 40.0), $this->order(2, 25.0, 'USD') );

		$calc = new Totals_Recalculator();
		$dry  = $calc->run(array( self::P1 ), true);
		$this->assertSame(40.0, $dry['rows'][0]['new_total']);
		$this->assertSame(1, $dry['rows'][0]['unconverted']);
		$this->assertSame(1, $dry['unconverted']);
		$this->assertSame('', get_post_meta(self::P1, '_wdp_progress_unconverted_orders', true), 'kuru calistirma uyari listesi yazmaz');
		$this->assertSame('', $this->total());

		$calc->run(array( self::P1 ), false, true);
		$this->assertEquals(40.0, $this->total());
		$this->assertSame(array( 2 ), get_post_meta(self::P1, '_wdp_progress_unconverted_orders', true));
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_many_products_are_scanned_together_and_only_differing_are_written(): void {
		update_post_meta(self::P1, '_wdp_total_donation_amount', 50.0);
		update_post_meta(self::P1, '_wdp_donor_count', 1);
		update_post_meta(self::P2, '_wdp_total_donation_amount', 5.0);
		self::$orders = array( $this->order(1, 50.0), $this->order(2, 20.0, 'TRY', self::P2) );

		$calc = new Totals_Recalculator();
		$ids  = $calc->all_product_ids();
		sort($ids);
		$this->assertSame(array( self::P1, self::P2 ), $ids);

		$result = $calc->run($ids, false, true);
		$this->assertSame(1, $result['changed'], 'P1 ayni, P2 farkli');
		$this->assertSame(1, $result['written']);
		$this->assertEquals(50.0, $this->total(self::P1));
		$this->assertEquals(20.0, $this->total(self::P2));
		$this->assertArrayNotHasKey('_wdp_progress_counted', self::$orders[0]->meta, 'degismeyen urunun siparisine dokunulmaz');
		$this->assertSame('yes', self::$orders[1]->meta['_wdp_progress_counted']);
	}
}

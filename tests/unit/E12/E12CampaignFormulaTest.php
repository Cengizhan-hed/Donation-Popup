<?php
/**
 * 12-e: kampanya toplamı formülü (devreden tutar + başlangıçtan sonra ödenmiş siparişler), önizleme (yazmaz),
 * onaylı uygulama (günlüklü), devreden tutar düzenleme, REST yetki/nonce/istek sınırı, CLI yalnız kuru çalıştırma.
 *
 * wc_get_orders çiftini bu dosya tanımlar; her test ayrı süreçte koşar.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Admin\Campaign_Totals_Controller;
use DonationPanel\Cli\Totals_Recalculator;
use DonationPanel\Domain\Campaign_Formula;
use DonationPanel\Domain\Campaign_Totals;
use DonationPanel\Http\Rate_Limiter;
use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 2) . '/support/e0-stubs.php';
if (!function_exists('wp_date')) {
	function wp_date($format, $timestamp = null) { // phpcs:ignore
		return gmdate((string) $format, (int) $timestamp);
	}
}
if (!function_exists('wc_set_time_limit')) {
	function wc_set_time_limit($limit = 0) {} // phpcs:ignore
}

final class E12CampaignFormulaTest extends TestCase {

	private const P  = 201;
	private const T0 = 1780000000; // Kampanya başlangıcı (göç anı).
	private const ONE_DAY = 86400;

	/** @var WDP_Fake_Order[] */
	public static $orders = array();

	protected function setUp(): void {
		WDP_Test_State::reset();
		self::$orders = array();
		WDP_Test_State::$options['woocommerce_currency'] = 'TRY';
		WDP_Test_State::$timezone                        = 'UTC';
		WDP_Test_State::$caps                            = array( 'manage_woocommerce' );
		WDP_Test_State::$user_id                         = 7;
		WDP_Test_State::$post_types[ self::P ]           = 'product';
		if (!function_exists('wc_get_orders')) {
			function wc_get_orders($args) { // phpcs:ignore
				$want = isset($args['status']) ? array_map(static function ($s) { return preg_replace('/^wc-/', '', (string) $s); }, (array) $args['status']) : array();
				$hit  = array();
				foreach (E12CampaignFormulaTest::$orders as $o) {
					if (!$want || in_array($o->get_status(), $want, true)) {
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

	/** Göç sonrası durum: saklanan = devreden = 1000, başlangıç T0, elle eklenen 50. */
	private function migrated(): void {
		update_post_meta(self::P, '_wdp_total_donation_amount', 1000.0);
		update_post_meta(self::P, '_wdp_carried_amount', 1000.0);
		update_post_meta(self::P, '_wdp_campaign_start', self::T0);
		update_post_meta(self::P, '_wdp_manual_total', 50.0);
	}

	private function order(int $id, float $amount, string $status = 'completed', ?int $paid = null, ?int $created = null, string $currency = 'TRY', float $refunded = 0.0): WDP_Fake_Order {
		$order             = new WDP_Fake_Order($id, array( 1 => new WDP_Fake_Order_Item(self::P, $amount, 1, array( '_custom_price' => $amount )) ));
		$order->status     = $status;
		$order->currency   = $currency;
		$order->paid_ts    = $paid;
		$order->created_ts = $created ?? $paid;
		if ($refunded > 0) {
			$order->refunded_for_item[1] = $refunded;
		}
		return $order;
	}

	private function stored(): float {
		return (float) get_post_meta(self::P, '_wdp_total_donation_amount', true);
	}

	private function shown(): float {
		return Campaign_Totals::get_total_donation_amount(self::P);
	}

	private function snapshot(): string {
		return serialize(array( WDP_Test_State::$post_meta, array_map(static function ($o) { return $o->meta; }, self::$orders) ));
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_migration_keeps_shown_total_and_preview_matches_without_new_orders(): void {
		$this->migrated();
		// Göç öncesi ödenmiş siparişler devreden tutarın içindedir; formülde sayılmazlar.
		self::$orders = array( $this->order(1, 600.0, 'completed', self::T0 - 5 * self::ONE_DAY), $this->order(2, 400.0, 'processing', self::T0 - 1) );

		$this->assertEqualsWithDelta(1050.0, $this->shown(), 0.001, 'bagiscinin gordugu toplam (devreden + elle)');
		$p = Campaign_Formula::preview(self::P);
		$this->assertEqualsWithDelta(1000.0, $p['computed'], 0.001);
		$this->assertEqualsWithDelta(0.0, (float) $p['diff'], 0.001);
		$this->assertSame(0, $p['orders']);
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_new_paid_order_adds_and_cancel_or_refund_subtracts_keeping_formula_consistent(): void {
		$this->migrated();
		$order        = $this->order(3, 100.0, 'processing', self::T0 + 10);
		self::$orders = array( $order );

		Campaign_Totals::sync_order_donation_totals_on_status_change(3, 'pending', 'processing', $order);
		$this->assertEqualsWithDelta(1100.0, $this->stored(), 0.001);
		$this->assertEqualsWithDelta(1150.0, $this->shown(), 0.001);
		$this->assertEqualsWithDelta(0.0, (float) Campaign_Formula::preview(self::P)['diff'], 0.001, 'saklanan toplam formulle tutarli');

		Campaign_Totals::sync_order_donation_totals_on_status_change(3, 'processing', 'cancelled', $order);
		$order->status = 'cancelled';
		$this->assertEqualsWithDelta(1000.0, $this->stored(), 0.001);
		$this->assertEqualsWithDelta(0.0, (float) Campaign_Formula::preview(self::P)['diff'], 0.001);

		// Yeniden say, sonra kismi iade.
		$order->status = 'completed';
		Campaign_Totals::sync_order_donation_totals_on_status_change(3, 'cancelled', 'completed', $order);
		$this->assertEqualsWithDelta(1100.0, $this->stored(), 0.001);
		$order->refunded_for_item[1] = 30.0;
		$refund                      = new WC_Order_Refund(900, array( 1 => new WDP_Fake_Order_Item(self::P, -30.0, 1) ));
		Campaign_Totals::apply_refund_to_progress_totals($order, $refund);
		$this->assertEqualsWithDelta(1070.0, $this->stored(), 0.001);
		$this->assertEqualsWithDelta(0.0, (float) Campaign_Formula::preview(self::P)['diff'], 0.001, 'iade sonrasi da tutarli');
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_pre_start_order_changes_never_touch_the_stored_total(): void {
		$this->migrated();
		$old           = $this->order(4, 600.0, 'completed', self::T0 - 3 * self::ONE_DAY);
		$old->meta['_wdp_progress_counted'] = 'yes';
		$old->meta['_wdp_progress_amounts'] = array( self::P => 600.0 );
		self::$orders = array( $old );

		Campaign_Totals::sync_order_donation_totals_on_status_change(4, 'completed', 'cancelled', $old);
		$this->assertEqualsWithDelta(1000.0, $this->stored(), 0.001, 'devreden tutarin icindeki siparis iptali toplami degistirmez');
		$old->meta['_wdp_progress_counted'] = 'yes';
		$refund = new WC_Order_Refund(901, array( 1 => new WDP_Fake_Order_Item(self::P, -100.0, 1) ));
		Campaign_Totals::apply_refund_to_progress_totals($old, $refund);
		$this->assertEqualsWithDelta(1000.0, $this->stored(), 0.001);
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_order_created_before_start_but_paid_after_start_is_counted(): void {
		$this->migrated();
		$order        = $this->order(5, 70.0, 'processing', self::T0 + 100, self::T0 - 2 * self::ONE_DAY);
		self::$orders = array( $order );

		Campaign_Totals::sync_order_donation_totals_on_status_change(5, 'pending', 'processing', $order);
		$this->assertEqualsWithDelta(1070.0, $this->stored(), 0.001);
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_preview_writes_nothing_and_reports_difference_orders_and_currency_warning(): void {
		$this->migrated();
		add_filter('wdp_order_exchange_rate', static function ($rate, $order, $currency) {
			unset($rate, $order);
			return 'EUR' === $currency ? 0.03 : null;
		}, 10, 3);
		self::$orders = array(
			$this->order(6, 100.0, 'completed', self::T0 + 1),
			$this->order(7, 30.0, 'completed', self::T0 + 2, null, 'EUR'),       // 30 / 0.03 = 1000
			$this->order(8, 200.0, 'completed', self::T0 + 3, null, 'TRY', 80.0), // iade dusulur: 120
			$this->order(9, 50.0, 'cancelled', self::T0 + 4),
			$this->order(10, 25.0, 'completed', self::T0 + 5, null, 'USD'),      // kur yok: dahil edilmez
		);
		$before = $this->snapshot();

		$p = Campaign_Formula::preview(self::P);

		$this->assertSame($before, $this->snapshot(), 'onizleme meta ya da siparis bayragi yazmaz');
		$this->assertEqualsWithDelta(1000.0 + 100.0 + 1000.0 + 120.0, $p['computed'], 0.001);
		$this->assertEqualsWithDelta(1000.0, (float) $p['stored'], 0.001);
		$this->assertEqualsWithDelta(1220.0, (float) $p['diff'], 0.001);
		$this->assertSame(3, $p['orders']);
		$this->assertSame(1, $p['unconverted']);
		$this->assertSame(array(), Campaign_Formula::get_log(self::P));
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_apply_writes_logs_flags_orders_and_stale_or_past_end_are_refused(): void {
		$this->migrated();
		self::$orders = array( $this->order(11, 100.0, 'completed', self::T0 + 1), $this->order(12, 40.0, 'processing', self::T0 + 2) );
		$p            = Campaign_Formula::preview(self::P);
		$this->assertEqualsWithDelta(1140.0, $p['computed'], 0.001);

		$stale = Campaign_Formula::apply(self::P, null, null, 999.0, 7);
		$this->assertFalse($stale['ok']);
		$this->assertSame('stale', $stale['reason']);
		$this->assertEqualsWithDelta(1000.0, $this->stored(), 0.001, 'bayat onizleme yazmaz');
		$this->assertSame(array(), Campaign_Formula::get_log(self::P));

		$past = Campaign_Formula::apply(self::P, null, 1000, $p['computed'], 7);
		$this->assertSame('end_in_past', $past['reason']);
		$this->assertEqualsWithDelta(1000.0, $this->stored(), 0.001);

		$done = Campaign_Formula::apply(self::P, null, null, $p['computed'], 7);
		$this->assertTrue($done['ok']);
		$this->assertEqualsWithDelta(1140.0, $this->stored(), 0.001);
		$this->assertEqualsWithDelta(1190.0, $this->shown(), 0.001, 'elle eklenen korunur');
		$this->assertSame('yes', self::$orders[0]->meta['_wdp_progress_counted'], 'sayilan siparis isaretlenir');

		$log = Campaign_Formula::get_log(self::P);
		$this->assertCount(1, $log);
		$this->assertSame('recalc', $log[0]['type']);
		$this->assertSame(7, $log[0]['user']);
		$this->assertEqualsWithDelta(1000.0, (float) $log[0]['old'], 0.001);
		$this->assertEqualsWithDelta(1140.0, (float) $log[0]['new'], 0.001);
		$this->assertArrayHasKey('at', $log[0]);

		// Tekrar uygulama: fark yok, ayni sonuc (idempotent).
		$again = Campaign_Formula::apply(self::P, null, null, 1140.0, 7);
		$this->assertTrue($again['ok']);
		$this->assertEqualsWithDelta(1140.0, $this->stored(), 0.001);
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_apply_with_earlier_from_moves_the_start_and_counts_older_orders(): void {
		$this->migrated();
		self::$orders = array( $this->order(13, 100.0, 'completed', self::T0 - 2 * self::ONE_DAY), $this->order(14, 10.0, 'completed', self::T0 + 5) );
		$from         = self::T0 - 3 * self::ONE_DAY;
		$p            = Campaign_Formula::preview(self::P, $from, null);
		$this->assertEqualsWithDelta(1110.0, $p['computed'], 0.001);
		$this->assertTrue(Campaign_Formula::apply(self::P, $from, null, $p['computed'], 7)['ok']);
		$this->assertSame($from, Campaign_Formula::get_start(self::P));
		$this->assertEqualsWithDelta(1110.0, $this->stored(), 0.001);
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_set_carried_shifts_stored_total_by_the_same_amount_and_logs(): void {
		$this->migrated();
		$res = Campaign_Formula::set_carried(self::P, 1500.0, 9);
		$this->assertEqualsWithDelta(1500.0, $res['stored'], 0.001);
		$this->assertEqualsWithDelta(1500.0, $this->stored(), 0.001);
		$this->assertEqualsWithDelta(1500.0, Campaign_Formula::get_carried(self::P), 0.001);
		$res = Campaign_Formula::set_carried(self::P, -5.0, 9);
		$this->assertEqualsWithDelta(0.0, $res['new'], 0.001, 'negatif devreden 0 olur');
		$this->assertEqualsWithDelta(0.0, $this->stored(), 0.001);
		$log = Campaign_Formula::get_log(self::P);
		$this->assertCount(2, $log);
		$this->assertSame('carried', $log[0]['type']);
		$this->assertSame(9, $log[1]['user']);
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_legacy_period_dates_still_limit_counted_orders(): void {
		$this->migrated();
		update_post_meta(self::P, '_wdp_campaign_ends_at', gmdate('Y-m-d', self::T0 + 2 * self::ONE_DAY));
		self::$orders = array( $this->order(15, 10.0, 'completed', self::T0 + self::ONE_DAY), $this->order(16, 20.0, 'completed', self::T0 + 5 * self::ONE_DAY) );
		$p            = Campaign_Formula::preview(self::P);
		$this->assertSame(1, $p['orders']);
		$this->assertEqualsWithDelta(1010.0, $p['computed'], 0.001);
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_rest_permission_nonce_validation_and_rate_limit(): void {
		$this->migrated();
		self::$orders = array( $this->order(17, 10.0, 'completed', self::T0 + 1) );
		$c            = new Campaign_Totals_Controller(new Rate_Limiter(static function () { return '203.0.113.5'; }));

		// Yetki: yalniz manage_woocommerce.
		WDP_Test_State::$caps = array();
		$perm                 = new ReflectionMethod($c, 'permission_for');
		$perm->setAccessible(true);
		$cb = $perm->invoke($c, 'manage_woocommerce');
		$this->assertFalse($cb());
		WDP_Test_State::$caps = array( 'manage_woocommerce' );
		$this->assertTrue($cb());

		$req = function (array $params, bool $nonce = true): WP_REST_Request {
			$r         = new WP_REST_Request();
			$r->params = $params + array( 'id' => self::P );
			if ($nonce) {
				$r->headers['X-WP-Nonce'] = 'abc';
			}
			return $r;
		};

		$no_nonce = $c->preview($req(array(), false));
		$this->assertInstanceOf(WP_Error::class, $no_nonce);
		$this->assertSame(403, $no_nonce->get_error_data()['status']);

		$bad_date = $c->preview($req(array( 'from' => '31/01/2026' )));
		$this->assertSame(400, $bad_date->get_error_data()['status']);
		$bad_range = $c->preview($req(array( 'from' => '2026-02-01', 'to' => '2026-01-01' )));
		$this->assertSame(400, $bad_range->get_error_data()['status']);
		$missing = $c->preview($req(array( 'id' => 999 )));
		$this->assertSame(404, $missing->get_error_data()['status']);

		$before = $this->snapshot();
		$ok     = $c->preview($req(array()));
		$this->assertSame($before, $this->snapshot(), 'onizleme ucu yazmaz');
		$data = $ok instanceof WP_REST_Response ? $ok->get_data() : $ok;
		$this->assertEqualsWithDelta(1010.0, $data['computed'], 0.001);
		$this->assertSame(1, $data['orders']);

		// Onaysiz (expected yok) uygulama reddedilir; yanlis expected 409; dogru expected yazar.
		$this->assertSame(400, $c->apply($req(array()))->get_error_data()['status']);
		$this->assertSame(409, $c->apply($req(array( 'expected' => 5 )))->get_error_data()['status']);
		$this->assertEqualsWithDelta(1000.0, $this->stored(), 0.001);
		$applied = $c->apply($req(array( 'expected' => 1010.0 )));
		$this->assertEqualsWithDelta(1010.0, $this->stored(), 0.001);
		$this->assertInstanceOf(WP_REST_Response::class, $applied);

		// Devreden tutar ucu.
		$this->assertSame(400, $c->set_carried($req(array( 'amount' => 'abc' )))->get_error_data()['status']);
		$this->assertSame(400, $c->set_carried($req(array( 'amount' => -1 )))->get_error_data()['status']);
		$saved = $c->set_carried($req(array( 'amount' => 1200 )));
		$this->assertEqualsWithDelta(1200.0, Campaign_Formula::get_carried(self::P), 0.001);
		$this->assertInstanceOf(WP_REST_Response::class, $saved);

		// Istek siniri: onizleme dakikada 20.
		$limited = null;
		for ($i = 0; $i < 25; $i++) {
			$r = $c->preview($req(array()));
			if ($r instanceof WP_Error) {
				$limited = $r;
				break;
			}
		}
		$this->assertNotNull($limited);
		$this->assertSame(429, $limited->get_error_data()['status']);
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_cli_recalculator_is_read_only_and_has_no_write_mode(): void {
		$this->migrated();
		self::$orders = array( $this->order(18, 10.0, 'completed', self::T0 + 1) );
		$before       = $this->snapshot();

		$res = (new Totals_Recalculator())->run(array( self::P ));

		$this->assertSame($before, $this->snapshot());
		$this->assertSame(1, $res['changed']);
		$this->assertEqualsWithDelta(1010.0, $res['rows'][0]['computed'], 0.001);
		$this->assertEqualsWithDelta(1000.0, (float) $res['rows'][0]['stored'], 0.001);
		$this->assertSame(1, (new ReflectionMethod(Totals_Recalculator::class, 'run'))->getNumberOfParameters(), 'yazma bayragi yok');

		$src = (string) file_get_contents(dirname(__DIR__, 3) . '/src/Cli/class-cli-command.php');
		$this->assertStringNotContainsString("assoc_args['apply']", str_replace("isset( \$assoc_args['apply'] )", '', $src), 'CLI yazma yolu yok');
		$this->assertStringNotContainsString('recalculate_product_donation_total', (string) file_get_contents(dirname(__DIR__, 3) . '/src/Domain/class-campaign-totals.php'), 'eski toplu yazim kalkti');
	}
}

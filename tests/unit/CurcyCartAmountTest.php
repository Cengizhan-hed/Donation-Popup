<?php
/**
 * Çoklu para biriminde bağış tutarı: bağışçının seçili birimde yazdığı tutar aynen kalır; sepete ana birimde konur,
 * kampanya toplamı doğru çevrilir. Kurlar `donation_panel_convert_amount` filtresiyle simüle edilir (eklenti adı yok).
 *
 * @package WDP\Tests
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class CurcyCartAmountTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options['woocommerce_currency'] = 'TRY';
		WDP_Test_State::$currency                         = 'TRY';
	}

	/**
	 * Sahte kurlar: 1 TRY = $rates[kod] birim (ana birim 1).
	 *
	 * @param array<string, float> $rates Kurlar.
	 */
	private function fake_rates(array $rates): void {
		$rates['TRY'] = 1.0;
		add_filter('donation_panel_convert_amount', static function ($amount, $from, $to) use ($rates) {
			if (!isset($rates[ $from ], $rates[ $to ])) {
				return $amount;
			}
			return (float) $amount / $rates[ $from ] * $rates[ $to ];
		}, 10, 4);
	}

	private function store_price(array $item): ?float {
		$m = new ReflectionMethod('WDP_Cart', 'resolve_cart_line_store_price');
		$m->setAccessible(true);
		$r = $m->invoke(null, $item);
		return null === $r ? null : (float) $r;
	}

	public function test_default_no_filter_is_unchanged_on_any_currency(): void {
		WDP_Test_State::$currency = 'EUR';
		$item                     = WDP_Cart::stamp_input_currency(array('custom_price' => 100.0));
		$this->assertSame('EUR', $item['wdp_input_currency']);
		$this->assertSame(100.0, $this->store_price($item));
		$this->assertSame(100.0, WDP_Cart::get_cart_line_unit_price($item));
	}

	public function test_eur_100_with_rate_002_goes_to_cart_as_5000_try_and_displays_100_eur(): void {
		$this->fake_rates(array('EUR' => 0.02));
		WDP_Test_State::$currency = 'EUR';
		$item                     = WDP_Cart::stamp_input_currency(array('custom_price' => 100.0));
		$this->assertEqualsWithDelta(5000.0, $this->store_price($item), 0.0001);
		// Gösterim: yazıldığı birimde aynen.
		$this->assertSame(100.0, WDP_Cart::get_cart_line_unit_price($item));
		// Curcy'nin geri çevirmesi: ana fiyat * oran = 100 EUR.
		$this->assertEqualsWithDelta(100.0, $this->store_price($item) * 0.02, 0.0001);
	}

	public function test_rates_023_and_1_and_odd_amount(): void {
		$this->fake_rates(array('USD' => 0.023, 'GBP' => 1.0));
		WDP_Test_State::$currency = 'USD';
		$usd                      = WDP_Cart::stamp_input_currency(array('custom_price' => 33.33));
		$this->assertEqualsWithDelta(33.33 / 0.023, $this->store_price($usd), 0.00001);
		$this->assertEqualsWithDelta(33.33, $this->store_price($usd) * 0.023, 0.0001);

		WDP_Test_State::$currency = 'GBP';
		$gbp                      = WDP_Cart::stamp_input_currency(array('custom_price' => 75.0));
		$this->assertSame(75.0, $this->store_price($gbp));
	}

	public function test_display_follows_currency_switch_after_add(): void {
		$this->fake_rates(array('EUR' => 0.02, 'USD' => 0.023));
		WDP_Test_State::$currency = 'EUR';
		$item                     = WDP_Cart::stamp_input_currency(array('custom_price' => 100.0));
		WDP_Test_State::$currency = 'USD';
		// 100 EUR = 5000 TRY = 115 USD.
		$this->assertEqualsWithDelta(115.0, (float) WDP_Cart::get_cart_line_unit_price($item), 0.001);
		$this->assertEqualsWithDelta(5000.0, $this->store_price($item), 0.0001);
	}

	public function test_base_currency_line_and_unstamped_legacy_line_unchanged(): void {
		$this->fake_rates(array('EUR' => 0.02));
		$item = WDP_Cart::stamp_input_currency(array('custom_price' => 250.0));
		$this->assertSame(250.0, $this->store_price($item));
		WDP_Test_State::$currency = 'EUR';
		// Eski (damgasız) satır: dönüşüm yok.
		$this->assertSame(250.0, $this->store_price(array('custom_price' => 250.0)));
		// Sabit fiyat satırında (ana birim) stamp yok.
		$this->assertNull(WDP_Cart::stamp_input_currency(array())['wdp_input_currency'] ?? null);
	}

	public function test_base_currency_is_woocommerce_option_not_active_currency(): void {
		WDP_Test_State::$currency = 'EUR';
		$this->assertSame('TRY', WDP_Progress_Currency::get_base_currency());
		$this->assertSame('EUR', WDP_Progress_Currency::get_active_currency());
	}

	public function test_legacy_filter_name_still_converts(): void {
		add_filter('wdp_convert_amount', static function ($amount, $from, $to) {
			return 'EUR' === $from && 'TRY' === $to ? (float) $amount / 0.02 : $amount;
		}, 10, 4);
		$this->assertEqualsWithDelta(5000.0, WDP_Progress_Currency::to_store_amount(100.0, 'EUR'), 0.0001);
	}

	public function test_campaign_total_for_eur_orders_is_converted_even_when_active_currency_is_eur(): void {
		$this->fake_rates(array('EUR' => 0.02));
		add_filter('wdp_order_exchange_rate', static function ($rate, $order, $currency) {
			return 'EUR' === $currency ? 0.02 : $rate;
		}, 10, 4);
		// Ön yüzde etkin para birimi EUR iken de ana birim TRY kalmalı.
		WDP_Test_State::$currency = 'EUR';
		$order           = new WDP_Fake_Order(77, array(1 => new WDP_Fake_Order_Item(101, 102.0, 1, array('_custom_price' => 102.0))));
		$order->currency = 'EUR';
		$amounts         = WDP_Utils::compute_order_progress_amounts($order);
		$this->assertEqualsWithDelta(5100.0, $amounts[101], 0.01);
	}

	public function test_campaign_total_without_stored_rate_uses_convert_filter(): void {
		$this->fake_rates(array('EUR' => 0.02));
		$r = WDP_Progress_Currency::convert_to_base(102.0, 'EUR', null);
		$this->assertTrue($r['ok']);
		$this->assertEqualsWithDelta(5100.0, $r['amount'], 0.01);
	}

	public function test_decimals_rounding_round_trip(): void {
		$this->fake_rates(array('EUR' => 0.023));
		WDP_Test_State::$currency = 'EUR';
		$item                     = WDP_Cart::stamp_input_currency(array('custom_price' => 10.55));
		$display                  = WDP_Cart::get_cart_line_unit_price($item);
		$this->assertSame(10.55, $display);
		$this->assertEqualsWithDelta(10.55, round($this->store_price($item) * 0.023, 2), 0.0001);
	}
}

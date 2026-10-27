<?php
/**
 * K8: çekirdek para birimi eklentisi tanımaz (filtre yokken tutar değişmez); Curcy snippet'i filtrelerle eski davranışı verir.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class SiteSnippetCurcyBridgeTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$currency                        = 'TRY';
		WDP_Test_State::$options['woocommerce_currency'] = 'TRY';
		require_once dirname(__DIR__, 2) . '/docs/site-snippets/curcy-bridge.php';
	}

	private static function order(array $meta, string $currency = 'EUR'): object {
		$o           = new WDP_Fake_Order(40, array());
		$o->currency = $currency;
		$o->meta     = $meta;
		return $o;
	}

	public function test_core_without_filters_leaves_amount_unchanged(): void {
		$this->assertSame(12.5, \DonationPanel\Domain\Progress_Currency::convert_amount(12.5, 'EUR', 'TRY'));
		$this->assertSame(12.5, \DonationPanel\Domain\Progress_Currency::convert_amount(12.5, 'TRY', 'TRY'));
		$this->assertNull(\DonationPanel\Domain\Progress_Currency::get_order_rate(self::order(array()), 'EUR'));
		$r = \DonationPanel\Domain\Progress_Currency::convert_to_base(10.0, 'EUR', self::order(array()));
		$this->assertFalse($r['ok']);
		$this->assertSame('missing_rate', $r['reason']);
	}

	public function test_convert_amount_filter_is_used_when_rate_missing(): void {
		WDP_Test_State::$filters['wdp_convert_amount'] = static function ($amount, $from, $to) {
			return 'EUR' === $from && 'TRY' === $to ? $amount * 40 : $amount;
		};
		$this->assertSame(400.0, \DonationPanel\Domain\Progress_Currency::convert_amount(10.0, 'EUR', 'TRY'));
		$r = \DonationPanel\Domain\Progress_Currency::convert_to_base(10.0, 'EUR', self::order(array()));
		$this->assertTrue($r['ok']);
		$this->assertSame(400.0, $r['amount']);
	}

	public function test_snippet_registers_all_core_filters(): void {
		WDP_Site_Curcy_Bridge::init();
		foreach (array('wdp_order_exchange_rate', 'wdp_progress_live_rate', 'wdp_client_context', 'donation_panel_convert_amount') as $hook) {
			$this->assertArrayHasKey($hook, WDP_Test_State::$filters, $hook);
		}
	}

	public function test_snippet_reads_curcy_order_info_rate_via_core(): void {
		WDP_Site_Curcy_Bridge::init();
		$order = self::order(array('wmc_order_info' => array('EUR' => array('rate' => '0.025'))));
		$this->assertSame(0.025, \DonationPanel\Domain\Progress_Currency::get_order_rate($order, 'EUR'));
		$r = \DonationPanel\Domain\Progress_Currency::convert_to_base(25.0, 'EUR', $order);
		$this->assertEqualsWithDelta(1000.0, $r['amount'], 0.01);
	}

	public function test_snippet_reads_woocs_rate_and_respects_prior_value(): void {
		$order = self::order(array('_woocs_order_rate' => '0.5'), 'USD');
		$this->assertSame(0.5, WDP_Site_Curcy_Bridge::order_rate(null, $order, 'USD', 'TRY'));
		$this->assertSame(2.0, WDP_Site_Curcy_Bridge::order_rate(2.0, $order, 'USD', 'TRY'));
		$this->assertNull(WDP_Site_Curcy_Bridge::order_rate(null, self::order(array()), 'USD', 'TRY'));
	}

	public function test_snippet_client_context_adds_cookies_events_selectors(): void {
		$ctx = WDP_Site_Curcy_Bridge::client_context(array('currency_cookies' => array()));
		$this->assertSame('wmc_current_currency', $ctx['currency_cookies'][0]);
		$this->assertContains('woocommerce_currency', $ctx['currency_cookies']);
		$this->assertContains('wp-wpml_current_language', $ctx['lang_cookies']);
		$this->assertContains('wmc_currency_changed', $ctx['change_events']);
		$this->assertContains('.wmc-currency', $ctx['switcher_selectors']);
	}

	public function test_snippet_convert_amount_without_curcy_is_unchanged(): void {
		WDP_Test_Curcy_Data::$list = array();
		$this->assertSame(10.0, WDP_Site_Curcy_Bridge::convert_amount(10.0, 'EUR', 'USD'));
		$this->assertNull(WDP_Site_Curcy_Bridge::live_rate(null, 'EUR'));
	}

	public function test_snippet_live_rate_and_cross_conversion_with_curcy_stub(): void {
		WDP_Test_Curcy_Data::$list = array(
			'EUR' => array('rate' => 0.025),
			'USD' => array('rate' => 0.03),
		);
		WDP_Site_Curcy_Bridge::init();
		$this->assertSame(0.025, \DonationPanel\Domain\Progress_Currency::get_live_rate('EUR'));
		// 25 EUR -> 1000 TRY (ana birim) ; EUR -> USD: 25/0.025*0.03 = 30.
		$this->assertEqualsWithDelta(1000.0, \DonationPanel\Domain\Progress_Currency::convert_amount(25.0, 'EUR', 'TRY'), 0.001);
		$this->assertEqualsWithDelta(30.0, \DonationPanel\Domain\Progress_Currency::convert_amount(25.0, 'EUR', 'USD'), 0.001);
		// Siparişte kur yok: canlı kurla ilerleme çubuğu dönüşümü.
		$r = \DonationPanel\Domain\Progress_Currency::convert_to_base(25.0, 'EUR', self::order(array()));
		$this->assertTrue($r['ok']);
		$this->assertEqualsWithDelta(1000.0, $r['amount'], 0.01);
		WDP_Test_Curcy_Data::$list = array();
	}

	public function test_base_currency_is_store_option_not_selected_currency(): void {
		WDP_Test_State::$options['woocommerce_currency'] = 'TRY';
		WDP_Test_State::$currency                        = 'EUR'; // Ziyaretçi EUR seçti.
		WDP_Test_Curcy_Data::$list                       = array('EUR' => array('rate' => 0.02));
		$this->assertEqualsWithDelta(5000.0, WDP_Site_Curcy_Bridge::convert_amount(100.0, 'EUR', 'TRY'), 0.001);
		$this->assertEqualsWithDelta(100.0, WDP_Site_Curcy_Bridge::convert_amount(5000.0, 'TRY', 'EUR'), 0.001);
		// Kur 1: değişmez.
		WDP_Test_Curcy_Data::$list = array('EUR' => array('rate' => 1.0));
		$this->assertEqualsWithDelta(100.0, WDP_Site_Curcy_Bridge::convert_amount(100.0, 'EUR', 'TRY'), 0.001);
		WDP_Test_Curcy_Data::$list = array();
	}
}

if (!class_exists('WOOMULTI_CURRENCY_Data')) {
	/** Curcy saplaması (yalnız test). */
	class WOOMULTI_CURRENCY_Data {
		public static function get_ins() {
			return new self();
		}
		public function get_list_currencies() {
			return WDP_Test_Curcy_Data::$list;
		}
	}
	/** Saplama verisi. */
	class WDP_Test_Curcy_Data {
		/** @var array<string, array<string, float>> */
		public static $list = array();
	}
}

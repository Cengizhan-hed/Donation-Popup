<?php
/**
 * Çoklu para birimi bağdaştırıcısı: sipariş kuru ve istemci bağlamı yalnız filtreyle.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class CompatCurrencyTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_reads_curcy_order_info_rate(): void {
		$order = new class() {
			public function get_meta($key) {
				return 'wmc_order_info' === $key ? array('EUR' => array('rate' => '0.025')) : '';
			}
		};
		$this->assertSame(0.025, WDP_Compat_Currency::order_rate(null, $order, 'eur', 'TRY'));
	}

	public function test_reads_woocs_rate_and_respects_prior_value(): void {
		$order = new class() {
			public function get_meta($key) {
				return '_woocs_order_rate' === $key ? '0.5' : '';
			}
		};
		$this->assertSame(0.5, WDP_Compat_Currency::order_rate(null, $order, 'USD', 'TRY'));
		$this->assertSame(2.0, WDP_Compat_Currency::order_rate(2.0, $order, 'USD', 'TRY'));
	}

	public function test_unknown_rate_stays_null(): void {
		$order = new class() {
			public function get_meta($key) {
				return '';
			}
		};
		$this->assertNull(WDP_Compat_Currency::order_rate(null, $order, 'USD', 'TRY'));
	}

	public function test_client_context_adds_cookies_events_selectors(): void {
		$ctx = WDP_Compat_Currency::client_context(array('currency_cookies' => array('woocommerce_currency')));
		$this->assertSame('wmc_current_currency', $ctx['currency_cookies'][0]);
		$this->assertContains('woocommerce_currency', $ctx['currency_cookies']);
		$this->assertContains('wp-wpml_current_language', $ctx['lang_cookies']);
		$this->assertContains('wmc_currency_changed', $ctx['change_events']);
	}
}

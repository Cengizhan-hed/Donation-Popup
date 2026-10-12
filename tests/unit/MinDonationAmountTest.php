<?php
/**
 * Zero / minimum donation amount guard.
 *
 * @package WDP\Tests
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * @covers WDP_Cart
 */
final class MinDonationAmountTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_default_minimum_is_one_when_product_min_is_empty_or_zero(): void {
		$this->assertSame(1.0, WDP_Cart::get_min_donation_amount(''));
		$this->assertSame(1.0, WDP_Cart::get_min_donation_amount('0'));
		$this->assertSame(1.0, WDP_Cart::get_min_donation_amount(null));
	}

	public function test_product_minimum_wins_when_higher(): void {
		$this->assertSame(50.0, WDP_Cart::get_min_donation_amount('50'));
	}

	public function test_minimum_is_filterable(): void {
		add_filter('wdp_min_donation_amount', static function ($min, $product_id) {
			return 42 === $product_id ? 25 : $min;
		}, 10, 2);

		$this->assertSame(25.0, WDP_Cart::get_min_donation_amount('', 42));
		$this->assertSame(1.0, WDP_Cart::get_min_donation_amount('', 7));
	}

	public function test_zero_amount_is_rejected_even_without_any_minimum(): void {
		add_filter('wdp_min_donation_amount', static function () {
			return 0;
		});

		$this->assertNotSame('', WDP_Cart::get_donation_amount_error(0, '', 1));
		$this->assertSame('', WDP_Cart::get_donation_amount_error(0.5, '', 1));
	}

	public function test_error_message_uses_currency_formatting_not_hardcoded_tl(): void {
		$plain = WDP_Cart::get_donation_amount_error(0, '', 1, true);
		$this->assertStringContainsString('₺', $plain);
		$this->assertStringNotContainsString('TL', $plain);
		$this->assertStringNotContainsString('<span', $plain);

		$html = WDP_Cart::get_donation_amount_error(10, '100', 1, false);
		$this->assertStringContainsString('100', $html);
		$this->assertStringContainsString('woocommerce-Price-amount', $html);
	}

	public function test_valid_amount_has_no_error(): void {
		$this->assertSame('', WDP_Cart::get_donation_amount_error(1, '', 1));
		$this->assertSame('', WDP_Cart::get_donation_amount_error(150, '100', 1));
	}

	public function test_detects_zero_priced_donation_lines(): void {
		$this->assertTrue(WDP_Cart::is_zero_priced_donation_line(array('donation_data' => array(), 'custom_price' => 0), 0.0));
		$this->assertFalse(WDP_Cart::is_zero_priced_donation_line(array('donation_data' => array()), 25.0));
		$this->assertTrue(WDP_Cart::is_zero_priced_donation_line(array('wdp_sadaka_donation' => true), 0.0));
	}

	public function test_null_price_falls_back_to_product_price(): void {
		$zero_product = new class() {
			public function get_price() {
				return '0';
			}
		};
		$priced_product = new class() {
			public function get_price() {
				return '10';
			}
		};

		$this->assertTrue(WDP_Cart::is_zero_priced_donation_line(array('donation_data' => array(), 'data' => $zero_product), null));
		$this->assertFalse(WDP_Cart::is_zero_priced_donation_line(array('donation_data' => array(), 'data' => $priced_product), null));
	}

	public function test_non_donation_lines_are_untouched(): void {
		$this->assertFalse(WDP_Cart::is_zero_priced_donation_line(array('product_id' => 5), 0.0));
	}
}

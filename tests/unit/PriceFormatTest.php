<?php
/**
 * WooCommerce tutar biçimi — yer tutucu ondalık kırpılmaz, sembol konumu.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class PriceFormatTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_gbp_keeps_two_decimals_in_placeholder(): void {
		WDP_Test_State::$price_decimals = 2;
		WDP_Test_State::$price_thousand = ',';
		WDP_Test_State::$price_decimal  = '.';
		$this->assertSame('5.00', WDP_Utils::format_localized_amount(5));
		$this->assertSame('min: 5.00', WDP_Utils::format_min_placeholder(5));
		$this->assertSame('5.00', WDP_Utils::format_amount_for_min_placeholder(5));
	}

	public function test_eur_right_space_number_and_position_class(): void {
		WDP_Test_State::$price_decimals = 2;
		WDP_Test_State::$price_thousand = '.';
		WDP_Test_State::$price_decimal  = ',';
		WDP_Test_State::$options['woocommerce_currency_pos'] = 'right_space';
		$this->assertSame('10,00', WDP_Utils::format_localized_amount(10));
		$this->assertSame('min: 10,00', WDP_Utils::format_min_placeholder(10));
		$this->assertSame('right_space', WDP_Utils::currency_position());
		$this->assertSame('wdp-currency-pos-right_space', WDP_Utils::currency_position_class());
	}

	public function test_try_zero_decimals(): void {
		WDP_Test_State::$price_decimals = 0;
		WDP_Test_State::$price_thousand = '.';
		WDP_Test_State::$price_decimal  = ',';
		WDP_Test_State::$options['woocommerce_currency_pos'] = 'left';
		$this->assertSame('1.234', WDP_Utils::format_localized_amount(1234));
		$this->assertSame('min: 1.234', WDP_Utils::format_min_placeholder(1234));
		$this->assertSame('wdp-currency-pos-left', WDP_Utils::currency_position_class());
	}
}

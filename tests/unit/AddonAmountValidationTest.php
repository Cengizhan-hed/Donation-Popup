<?php
/**
 * Alt bağış tutarı sunucu doğrulaması.
 *
 * @package WDP\Tests
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * @covers WDP_Utils::parse_addon_amount
 * @covers WDP_Utils::validate_addon_amount
 */
final class AddonAmountValidationTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_parse_plain_and_locale_amounts(): void {
		$this->assertSame(5566.0, \DonationPanel\Domain\Addon_Settings::parse_addon_amount('5566'));
		$this->assertSame(5566.0, \DonationPanel\Domain\Addon_Settings::parse_addon_amount('5.566'));
		$this->assertSame(5566.0, \DonationPanel\Domain\Addon_Settings::parse_addon_amount('5,566'));
		$this->assertSame(5.5, \DonationPanel\Domain\Addon_Settings::parse_addon_amount('5,5'));
		$this->assertNull(\DonationPanel\Domain\Addon_Settings::parse_addon_amount(''));
		$this->assertNull(\DonationPanel\Domain\Addon_Settings::parse_addon_amount('abc'));
	}

	public function test_empty_and_zero_rejected_when_panel_amount_required(): void {
		$empty = \DonationPanel\Domain\Addon_Settings::validate_addon_amount('', 0.0, 0.0);
		$this->assertFalse($empty['ok']);
		$this->assertSame('empty', $empty['code']);

		$zero = \DonationPanel\Domain\Addon_Settings::validate_addon_amount('0', 0.0, 0.0);
		$this->assertFalse($zero['ok']);
		$this->assertSame('invalid', $zero['code']);

		$neg = \DonationPanel\Domain\Addon_Settings::validate_addon_amount('-10', 0.0, 0.0);
		$this->assertFalse($neg['ok']);
	}

	public function test_valid_amounts_accepted(): void {
		$ok = \DonationPanel\Domain\Addon_Settings::validate_addon_amount('5566', 0.0, 0.0);
		$this->assertTrue($ok['ok']);
		$this->assertSame(5566.0, $ok['amount']);

		$dot = \DonationPanel\Domain\Addon_Settings::validate_addon_amount('5.566', 0.0, 0.0);
		$this->assertTrue($dot['ok']);
		$this->assertSame(5566.0, $dot['amount']);

		$comma = \DonationPanel\Domain\Addon_Settings::validate_addon_amount('5,566', 0.0, 0.0);
		$this->assertTrue($comma['ok']);
		$this->assertSame(5566.0, $comma['amount']);
	}

	public function test_below_min_rejected(): void {
		$result = \DonationPanel\Domain\Addon_Settings::validate_addon_amount('50', 100.0, 0.0);
		$this->assertFalse($result['ok']);
		$this->assertSame('below_min', $result['code']);
		$this->assertNotSame('', $result['message']);
	}

	public function test_fixed_price_wins(): void {
		$result = \DonationPanel\Domain\Addon_Settings::validate_addon_amount('', 100.0, 250.0);
		$this->assertTrue($result['ok']);
		$this->assertSame(250.0, $result['amount']);
		$this->assertSame('fixed', $result['code']);
	}
}

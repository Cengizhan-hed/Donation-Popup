<?php
/**
 * Shared amount-parse vectors (PHP = JS).
 *
 * @package WDP\Tests
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * @covers WDP_Utils
 */
final class DonorAmountParseTest extends TestCase {

	/** @var array<string,array> */
	private static $stores = array();

	/** @var array<int,array> */
	private static $vectors = array();

	public static function setUpBeforeClass(): void {
		$file = dirname(__DIR__) . '/fixtures/amount-parse-vectors.json';
		$raw  = file_get_contents($file);
		self::assertNotFalse($raw);
		$data = json_decode($raw, true);
		self::assertIsArray($data);
		self::$stores  = $data['stores'];
		self::$vectors = $data['vectors'];
	}

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_vectors_match_php_parser(): void {
		foreach (self::$vectors as $row) {
			$store = self::$stores[ $row['store'] ];
			$got   = WDP_Utils::parse_donor_amount($row['input'], $store);
			$this->assertSame(
				$row['status'],
				$got['status'],
				$row['store'] . ' "' . $row['input'] . '" status'
			);
			if ($row['status'] === 'ok') {
				$this->assertTrue($got['ok']);
				$this->assertEqualsWithDelta((float) $row['amount'], $got['amount'], 0.0001, $row['store'] . ' ' . $row['input']);
			} else {
				$this->assertFalse($got['ok']);
				$this->assertNotSame('', $got['error']);
			}
		}
	}

	public function test_try_zero_fraction_accepted_nonzero_warns(): void {
		WDP_Test_State::$price_decimals = 0;
		WDP_Test_State::$price_thousand = '.';
		WDP_Test_State::$price_decimal  = ',';
		$cfg = array(
			'decimals'          => 0,
			'thousandSeparator' => '.',
			'decimalSeparator'  => ',',
		);
		$ok = WDP_Utils::parse_donor_amount('50,00', $cfg);
		$this->assertSame('ok', $ok['status']);
		$this->assertEqualsWithDelta(50.0, $ok['amount'], 0.0001);
		$dot = WDP_Utils::parse_donor_amount('10.00', $cfg);
		$this->assertSame('ok', $dot['status']);
		$this->assertEqualsWithDelta(10.0, $dot['amount'], 0.0001);
		$got = WDP_Utils::parse_donor_amount('10,50', $cfg);
		$this->assertSame('ambiguous', $got['status']);
		$this->assertStringContainsString('kuruşlu', $got['error']);
		$this->assertStringContainsString('10', $got['error']);
		$thou = WDP_Utils::parse_donor_amount('1.250', $cfg);
		$this->assertSame('ok', $thou['status']);
		$this->assertEqualsWithDelta(1250.0, $thou['amount'], 0.0001);
	}

	public function test_normalize_paste_strips_symbol_and_space(): void {
		$this->assertSame('1.250', WDP_Utils::normalize_amount_input('₺1.250', '.', ','));
		$this->assertSame('1250', WDP_Utils::normalize_amount_input('1 250', '.', ','));
	}
}

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

	public function test_try_ambiguous_message_is_integer_example(): void {
		WDP_Test_State::$price_decimals = 0;
		WDP_Test_State::$price_thousand = '.';
		WDP_Test_State::$price_decimal  = ',';
		$got = WDP_Utils::parse_donor_amount('10.00', array(
			'decimals'          => 0,
			'thousandSeparator' => '.',
			'decimalSeparator'  => ',',
		));
		$this->assertSame('ambiguous', $got['status']);
		$this->assertStringContainsString('tam sayı', $got['error']);
		$this->assertStringContainsString('10', $got['error']);
	}

	public function test_normalize_paste_strips_symbol_and_space(): void {
		$this->assertSame('1.250', WDP_Utils::normalize_amount_input('₺1.250', '.', ','));
		$this->assertSame('1250', WDP_Utils::normalize_amount_input('1 250', '.', ','));
	}
}

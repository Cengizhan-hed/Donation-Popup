<?php
/**
 * Fix2 #12: tutar ayrıştırma Woo ondalık sayısı/ayırıcılarına göre (PHP = JS ortak vektörler).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Modules\Experiences\Field_Validator;
use PHPUnit\Framework\TestCase;

final class FieldValidatorAmountStoreSettingsTest extends TestCase {

	/** @var array<string, array<string, mixed>> */
	private static $stores = array();

	/** @var array<int, array<string, mixed>> */
	private static $vectors = array();

	public static function setUpBeforeClass(): void {
		$data = json_decode( (string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/amount-parse-vectors.json' ), true );
		self::assertIsArray( $data );
		self::$stores  = $data['stores'];
		self::$vectors = $data['vectors'];
	}

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	/**
	 * Üretim yolu (Field_Validator) ortak vektörlerle aynı sonucu verir; mağaza ayarı Woo'dan okunur.
	 */
	public function test_field_validator_uses_woo_settings_for_every_shared_vector(): void {
		foreach ( self::$vectors as $row ) {
			$store                           = self::$stores[ $row['store'] ];
			WDP_Test_State::$price_decimals  = (int) $store['decimals'];
			WDP_Test_State::$price_thousand  = (string) $store['thousandSeparator'];
			WDP_Test_State::$price_decimal   = (string) $store['decimalSeparator'];
			$got = Field_Validator::parse_amount( $row['input'] );
			if ( 'ok' === $row['status'] ) {
				$this->assertNotNull( $got, $row['store'] . ' ' . $row['input'] );
				$this->assertEqualsWithDelta( (float) $row['amount'], $got, 0.0001, $row['store'] . ' ' . $row['input'] );
			} else {
				$this->assertNull( $got, $row['store'] . ' ' . $row['input'] . ' belirsiz/geçersiz null olmalı' );
			}
		}
	}

	public function test_three_decimal_currency_does_not_turn_1_250_into_1250(): void {
		WDP_Test_State::$price_decimals = 3;
		WDP_Test_State::$price_thousand = ',';
		WDP_Test_State::$price_decimal  = '.';
		$model  = array(
			'min'      => 0.5,
			'decimals' => 3,
			'types'    => array(),
			'fields'   => array(),
		);
		$result = Field_Validator::validate( $model, array( 'amount' => '1.250' ) );
		$this->assertArrayNotHasKey( 'amount', $result['errors'] );
		$this->assertSame( 1.25, $result['amount'] );
	}

	public function test_ambiguous_input_is_rejected_with_a_format_message(): void {
		WDP_Test_State::$price_decimals = 3;
		WDP_Test_State::$price_thousand = ' ';
		WDP_Test_State::$price_decimal  = ',';
		$model  = array(
			'min'      => 0.5,
			'decimals' => 3,
			'types'    => array(),
			'fields'   => array(),
		);
		$result = Field_Validator::validate( $model, array( 'amount' => '1.250' ) );
		$this->assertArrayHasKey( 'amount', $result['errors'] );
		$this->assertStringContainsString( '10,000', $result['errors']['amount'] );
	}
}

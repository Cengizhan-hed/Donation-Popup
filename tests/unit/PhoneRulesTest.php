<?php
/**
 * Telefon kuralları: ortak vektörler (JS ile aynı sonuç), tablo bütünlüğü, sunucu doğrulaması ve E.164.
 *
 * @package WDP\Tests
 */

declare(strict_types=1);

use DonationPanel\Support\Phone_Rules;
use PHPUnit\Framework\TestCase;

/**
 * @covers \DonationPanel\Support\Phone_Rules
 */
final class PhoneRulesTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	/**
	 * @return array<string, array{0: array<string, mixed>}>
	 */
	public static function vectors(): array {
		$file = dirname( __DIR__ ) . '/fixtures/phone-vectors.json';
		$data = json_decode( (string) file_get_contents( $file ), true );
		$out  = array();
		foreach ( $data['cases'] as $i => $case ) {
			$out[ $i . ' ' . $case['iso'] . ' ' . $case['raw'] ] = array( $case );
		}
		return $out;
	}

	/**
	 * @dataProvider vectors
	 * @param array<string, mixed> $case Vektör.
	 */
	public function test_shared_vectors( array $case ): void {
		$r = Phone_Rules::parse( $case['raw'], $case['iso'] );
		$this->assertSame( $case['status'], $r['status'] );
		$this->assertSame( $case['oiso'], $r['iso'] );
		$this->assertSame( $case['national'], $r['national'] );
		$this->assertSame( $case['e164'], $r['e164'] );
		$this->assertSame( $case['warning'], $r['warning'] );
	}

	public function test_table_covers_all_countries_with_sane_ranges(): void {
		$table = Phone_Rules::table();
		$this->assertGreaterThanOrEqual( 240, count( $table ) );
		foreach ( $table as $iso => $row ) {
			$this->assertMatchesRegularExpression( '/^[a-z]{2}$/', (string) $iso );
			$this->assertGreaterThan( 0, (int) $row['dial'] );
			$this->assertGreaterThanOrEqual( 4, $row['min'] );
			$this->assertLessThanOrEqual( 13, $row['max'] );
			$this->assertGreaterThanOrEqual( $row['min'], $row['max'], $iso );
			// E.164: ülke kodu + ulusal numara en çok 15 hane.
			$this->assertLessThanOrEqual( 15, strlen( $row['dial'] ) + $row['max'], $iso );
		}
	}

	public function test_legacy_length_rules_follow_the_table(): void {
		$rules = \DonationPanel\Support\Phone_Countries::get_national_length_rules();
		$this->assertSame( array( 'min' => 10, 'max' => 10 ), $rules['tr'] );
		$this->assertSame( array( 'min' => 10, 'max' => 10 ), $rules['gb'] );
		$this->assertSame( count( Phone_Rules::table() ), count( $rules ) );
	}

	public function test_empty_is_valid_and_garbage_is_not(): void {
		$this->assertSame( '', Phone_Rules::error( '', 'tr' ) );
		$this->assertSame( 'short', Phone_Rules::error( '530', 'tr' ) );
		$this->assertSame( 'long', Phone_Rules::error( '5303071593999', 'tr' ) );
		$this->assertSame( 'unknown', Phone_Rules::error( '+999 1234567', 'tr' ) );
	}

	public function test_validator_checks_phone_per_country_and_allows_empty_when_optional(): void {
		$field = static function ( bool $required ): array {
			return array(
				'kind'     => 'fixed',
				'unit'     => 10.0,
				'quantity' => array( 'max' => 5 ),
				'fields'   => array(
					array(
						'name'     => 'donation_phone',
						'type'     => 'tel',
						'required' => $required,
					),
				),
			);
		};
		$run   = static function ( array $model, string $phone ): array {
			return \DonationPanel\Modules\Experiences\Field_Validator::validate( $model, array( 'amount' => '10', 'quantity' => '1', 'donation_phone' => $phone ) )['errors'];
		};
		$this->assertArrayNotHasKey( 'donation_phone', $run( $field( false ), '' ) );
		$this->assertArrayNotHasKey( 'donation_phone', $run( $field( false ), '+90 530 307 15 93' ) );
		$this->assertArrayNotHasKey( 'donation_phone', $run( $field( false ), '+44 7911 123456' ) );
		$this->assertArrayHasKey( 'donation_phone', $run( $field( false ), '+90 530 307 15' ) );
		$this->assertArrayHasKey( 'donation_phone', $run( $field( false ), '+44 7911 12345' ) );
		$this->assertArrayHasKey( 'donation_phone', $run( $field( false ), '+90 530 307 15 93 9' ) );
		$this->assertArrayHasKey( 'donation_phone', $run( $field( false ), '+999 1234567' ) );
		$this->assertArrayHasKey( 'donation_phone', $run( $field( false ), '530<script>' ) );
		$this->assertArrayHasKey( 'donation_phone', $run( $field( true ), '' ) );
	}

	public function test_to_e164_normalises_but_never_loses_unparsed_input(): void {
		$this->assertSame( '+905303071593', Phone_Rules::to_e164( '+90 530 307 15 93', 'tr' ) );
		$this->assertSame( '+447911123456', Phone_Rules::to_e164( '07911 123456', 'gb' ) );
		$this->assertSame( '530', Phone_Rules::to_e164( ' 530 ', 'tr' ) );
	}
}

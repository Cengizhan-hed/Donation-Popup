<?php
/**
 * E2A: alan doğrulama (tutar ayrıştırma, e-posta, telefon, Türkçe karakter uzunluğu).
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use DonationPanel\Modules\Experiences\Field_Validator;
use PHPUnit\Framework\TestCase;

final class E2AFieldValidatorTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	/**
	 * @return array<string, array{0: string, 1: float|null}>
	 */
	public static function amount_vectors(): array {
		return array(
			'tam sayi'        => array( '100', 100.0 ),
			'binlik nokta'    => array( '1.000', 1000.0 ),
			'binlik virgul'   => array( '1,000', 1000.0 ),
			'ondalik virgul'  => array( '12,50', 12.5 ),
			'ondalik nokta'   => array( '12.5', 12.5 ),
			'simgeli'         => array( '₺ 250', 250.0 ),
			'binlik+ondalik'  => array( '1.234,56', 1234.56 ),
			'bos'             => array( '', null ),
			'harf'            => array( 'abc', null ),
		);
	}

	/**
	 * @dataProvider amount_vectors
	 */
	public function test_parse_amount( string $raw, ?float $expected ): void {
		$this->assertSame( $expected, Field_Validator::parse_amount( $raw ) );
	}

	/**
	 * @return array<string, mixed>
	 */
	private function model(): array {
		return array(
			'min'      => 10.0,
			'decimals' => 0,
			'types'    => array(),
			'fields'   => array(
				array( 'name' => 'donation_full_name', 'type' => 'text', 'required' => true, 'maxlength' => 10 ),
				array( 'name' => 'donation_phone', 'type' => 'tel', 'required' => false, 'maxlength' => 28 ),
				array( 'name' => 'donation_email', 'type' => 'email', 'required' => false, 'maxlength' => 100 ),
				array( 'name' => 'donation_anonymous', 'type' => 'checkbox', 'required' => false ),
			),
		);
	}

	public function test_valid_input_passes_and_turkish_characters_count_as_characters(): void {
		$result = Field_Validator::validate(
			$this->model(),
			array(
				'amount'             => '100',
				'donation_full_name' => 'ĞÜŞİÖÇğüşıöç', // 12 karakter, 24 bayt.
				'donation_phone'     => '+90 532 000 00 00',
				'donation_email'     => 'bagis@example.org',
			)
		);
		$this->assertArrayHasKey( 'donation_full_name', $result['errors'], '12 karakter > 10 sinir: hata beklenir.' );

		$ok = Field_Validator::validate(
			$this->model(),
			array(
				'amount'             => '100',
				'donation_full_name' => 'Çağlar Şen',
				'donation_phone'     => '+90 532 000 00 00',
				'donation_email'     => 'bagis@example.org',
			)
		);
		$this->assertTrue( $ok['valid'] );
		$this->assertSame( 100.0, $ok['amount'] );
	}

	public function test_errors_per_field(): void {
		$result = Field_Validator::validate(
			$this->model(),
			array(
				'amount'             => '5',
				'donation_full_name' => '',
				'donation_phone'     => 'abc',
				'donation_email'     => 'not-an-email',
			)
		);
		$this->assertFalse( $result['valid'] );
		$this->assertSame( array( 'amount', 'donation_full_name', 'donation_phone', 'donation_email' ), array_keys( $result['errors'] ) );
	}

	public function test_fractional_amount_rejected_when_currency_has_no_decimals(): void {
		$result = Field_Validator::validate( $this->model(), array( 'amount' => '12,50', 'donation_full_name' => 'Ada' ) );
		$this->assertArrayHasKey( 'amount', $result['errors'] );
	}

	public function test_unknown_donation_type_rejected(): void {
		$model          = $this->model();
		$model['types'] = array(
			array( 'value' => 'once', 'label' => 'Once' ),
			array( 'value' => 'monthly', 'label' => 'Monthly' ),
		);
		$result         = Field_Validator::validate( $model, array( 'amount' => '50', 'donation_full_name' => 'Ada', 'donation_type' => 'weekly' ) );
		$this->assertArrayHasKey( 'donation_type', $result['errors'] );
	}

	public function test_response_never_echoes_personal_values(): void {
		$result = Field_Validator::validate( $this->model(), array( 'amount' => '50', 'donation_full_name' => 'Gizli Ad', 'donation_email' => 'x@y' ) );
		$this->assertStringNotContainsString( 'Gizli Ad', (string) wp_json_encode( $result ) );
	}
}

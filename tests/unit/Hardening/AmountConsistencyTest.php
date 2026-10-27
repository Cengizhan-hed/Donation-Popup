<?php
/**
 * #9/#10/#13: tutar sınırı tek kaynak, indirimli fiyat tek kural, ek bağış asgarisi para birimine duyarlı.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Domain\Amount_Limits;
use DonationPanel\Modules\Experiences\Field_Validator;
use DonationPanel\WooCommerce\Cart_Hooks;
use PHPUnit\Framework\TestCase;

final class Fix9SaleProduct extends WC_Product {
	public function get_regular_price() {
		return '100';
	}

	public function get_price() {
		return '80';
	}
}

final class AmountConsistencyTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	/** @return array<string, mixed> */
	private function model(): array {
		return array(
			'min'      => 1.0,
			'decimals' => 2,
			'types'    => array(),
			'fields'   => array(),
		);
	}

	public function test_limit_default_and_filter(): void {
		$this->assertSame( 9999999.0, Amount_Limits::max() );
		add_filter( 'donation_panel_max_amount', static function () {
			return 500.0;
		} );
		$this->assertSame( 500.0, Amount_Limits::max() );
	}

	public function test_validator_and_cart_resolver_share_one_limit(): void {
		// Eskiden doğrulayıcı 99.999.999'a kadar kabul eder, sepet 999.999 üstünü sessizce düşürürdü.
		$ok = Field_Validator::validate( $this->model(), array( 'amount' => '2000000' ) );
		$this->assertTrue( $ok['valid'] );
		$this->assertSame( 2000000.0, $ok['amount'] );

		$line = array( 'product_id' => 5, 'custom_price' => 2000000.0 );
		$this->assertSame( 2000000.0, $this->raw_price( $line ), 'sepet, doğrulayıcının kabul ettiği tutarı düşürmemeli' );

		$too_big = Field_Validator::validate( $this->model(), array( 'amount' => '10000000' ) );
		$this->assertFalse( $too_big['valid'] );
		$this->assertStringContainsString( '9', (string) $too_big['errors']['amount'] );
		$this->assertNotSame( 'Please enter a donation amount.', $too_big['errors']['amount'], 'aşan tutar için net ileti' );
		$this->assertNull( $this->raw_price( array( 'product_id' => 5, 'custom_price' => 10000000.0 ) ) );
	}

	public function test_sale_price_is_the_single_unit_price_rule(): void {
		$p                         = new Fix9SaleProduct( 6 );
		WDP_Test_State::$products[6] = $p;
		$this->assertSame( 80.0, $this->raw_price( array( 'product_id' => 6 ) ), 'formda görünen (indirimli) fiyat tahsil edilir' );
	}

	public function test_addon_minimum_is_compared_in_store_currency(): void {
		WDP_Test_State::$options['woocommerce_currency'] = 'TRY';
		WDP_Test_State::$currency                         = 'EUR';
		add_filter( 'donation_panel_convert_amount', static function ( $amount, $from, $to ) {
			if ( 'EUR' === $from && 'TRY' === $to ) {
				return (float) $amount * 40;
			}
			if ( 'TRY' === $from && 'EUR' === $to ) {
				return (float) $amount / 40;
			}
			return $amount;
		}, 10, 4 );
		$model          = $this->model();
		$model['addon'] = array( 'min' => 100.0 ); // mağaza ana biriminde (TRY).

		// 5 EUR = 200 TRY >= 100 TRY: kabul.
		$ok = Field_Validator::validate( $model, array( 'amount' => '50', 'addon_active' => '1', 'addon_amount' => '5' ) );
		$this->assertArrayNotHasKey( 'addon_amount', $ok['errors'] );

		// 2 EUR = 80 TRY < 100 TRY: red; ileti asgariyi yazılan birimde (2,5) gösterir.
		$bad = Field_Validator::validate( $model, array( 'amount' => '50', 'addon_active' => '1', 'addon_amount' => '2' ) );
		$this->assertArrayHasKey( 'addon_amount', $bad['errors'] );
		$this->assertStringContainsString( '2.5', (string) $bad['errors']['addon_amount'] );
	}

	private function raw_price( array $line ) {
		$m = new ReflectionMethod( Cart_Hooks::class, 'resolve_cart_line_raw_price' );
		$m->setAccessible( true );
		return $m->invoke( null, $line );
	}
}

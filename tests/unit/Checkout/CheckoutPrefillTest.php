<?php
/**
 * 12-d: ödeme sayfası ön doldurma (alan eşleme, boş alan kuralı, UTF-8, geçersiz e-posta).
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\WooCommerce\Checkout\Checkout_Prefill;
use PHPUnit\Framework\TestCase;

/** Sahte WC_Customer. */
final class Checkout_Fake_Customer {
	/** @var array<string, string> */
	public $b = array(
		'first_name' => '',
		'last_name'  => '',
		'phone'      => '',
		'email'      => '',
	);

	public function __call( $name, $args ) {
		if ( 0 === strpos( $name, 'get_billing_' ) ) {
			return $this->b[ substr( $name, 12 ) ];
		}
		if ( 0 === strpos( $name, 'set_billing_' ) ) {
			$this->b[ substr( $name, 12 ) ] = $args[0];
			return null;
		}
		throw new BadMethodCallException( $name );
	}
}

final class CheckoutPrefillTest extends TestCase {

	private function item( array $data ): array {
		return array( 'donation_data' => $data );
	}

	public function test_maps_name_phone_email_utf8(): void {
		$v = Checkout_Prefill::values_from_cart( array( $this->item( array( 'full_name' => 'Şükrü Ömer Çağlayan', 'phone' => '+90 532 000 00 00', 'email' => 'a@example.com' ) ) ) );
		$this->assertSame( 'Şükrü Ömer', $v['first_name'] );
		$this->assertSame( 'Çağlayan', $v['last_name'] );
		$this->assertSame( '+905320000000', $v['phone'] ); // WooCommerce'e E.164.
		$this->assertSame( 'a@example.com', $v['email'] );
	}

	public function test_single_word_name_has_no_last_name(): void {
		$v = Checkout_Prefill::values_from_cart( array( $this->item( array( 'full_name' => 'İbrahim' ) ) ) );
		$this->assertSame( array( 'first_name' => 'İbrahim' ), $v );
	}

	public function test_invalid_email_skipped(): void {
		$v = Checkout_Prefill::values_from_cart( array( $this->item( array( 'full_name' => 'Ali Veli', 'email' => 'not-an-email' ) ) ) );
		$this->assertArrayNotHasKey( 'email', $v );
	}

	public function test_latest_donation_wins_and_shares_ignored(): void {
		$items = array(
			$this->item( array( 'full_name' => 'Eski Bağışçı' ) ),
			$this->item( array( 'full_name' => 'Yeni Kişi', 'phone' => '+44 7000 000000' ) ),
			$this->item( array( 'share_count' => 2, 'shareholders' => array( 1 => array( 'name' => 'X Y' ) ) ) ),
		);
		$v = Checkout_Prefill::values_from_cart( $items );
		$this->assertSame( 'Yeni', $v['first_name'] );
		$this->assertSame( '+447000000000', $v['phone'] );
	}

	public function test_no_donation_data_returns_empty(): void {
		$this->assertSame( array(), Checkout_Prefill::values_from_cart( array( array( 'data' => 1 ), $this->item( array( 'anonymous' => '1' ) ) ) ) );
	}

	public function test_guest_empty_fields_filled(): void {
		$c = new Checkout_Fake_Customer();
		$w = Checkout_Prefill::apply( $c, array( $this->item( array( 'full_name' => 'Ayşe Demir', 'phone' => '+90 555 111 22 33', 'email' => 'ayse@example.com' ) ) ) );
		$this->assertCount( 4, $w );
		$this->assertSame( 'Ayşe', $c->b['first_name'] );
		$this->assertSame( 'ayse@example.com', $c->b['email'] );
	}

	public function test_logged_in_filled_fields_not_overwritten(): void {
		$c            = new Checkout_Fake_Customer();
		$c->b['first_name'] = 'Hesap';
		$c->b['email']      = 'hesap@example.com';
		$w = Checkout_Prefill::apply( $c, array( $this->item( array( 'full_name' => 'Ayşe Demir', 'phone' => '+90 555 111 22 33', 'email' => 'ayse@example.com' ) ) ) );
		$this->assertSame( 'Hesap', $c->b['first_name'] );
		$this->assertSame( 'hesap@example.com', $c->b['email'] );
		$this->assertSame( 'Demir', $c->b['last_name'] );
		$this->assertSame( '+905551112233', $c->b['phone'] );
		$this->assertSame( array( 'last_name', 'phone' ), array_keys( $w ) );
	}
}

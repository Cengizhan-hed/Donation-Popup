<?php
/**
 * E2B: Donation_Order_Meta — eski anahtarlar birebir, Türkçe karakter, anonim veriyi silmez, çift yazım yok.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use DonationPanel\WooCommerce\Donation_Order_Meta;
use PHPUnit\Framework\TestCase;

/** Sahte sipariş kalemi. */
final class E2B_Fake_Order_Item {
	/** @var array<string, mixed> */
	public $meta = array();

	public function get_meta( $key, $single = true ) {
		return isset( $this->meta[ $key ] ) ? $this->meta[ $key ] : '';
	}

	public function add_meta_data( $key, $value ) {
		$this->meta[ $key ] = $value;
	}
}

final class E2BOrderMetaTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_writes_legacy_keys_exactly_like_the_old_writer(): void {
		$values = array(
			'custom_price'  => 150.0,
			'donation_data' => array(
				'full_name'  => 'Çağlar Şükrü Öztürk İğdır',
				'phone'      => '+44 7700 900123',
				'note'       => 'Ğüşiöç ĞÜŞİÖÇ notu',
				'email'      => 'bagis@ornek.org',
				'dedication' => 'Annem Şükriye için',
			),
		);

		$new = new E2B_Fake_Order_Item();
		( new Donation_Order_Meta() )->write_item( $new, 'k1', $values, null );

		$old = new E2B_Fake_Order_Item();
		WDP_Order::add_donation_meta_to_order( $old, 'k1', $values, null );

		$this->assertSame( $old->meta, $new->meta );
		$this->assertSame( 'Çağlar Şükrü Öztürk İğdır', $new->meta[ WDP_Order_Meta_Keys::DONOR_NAME ] );
		$this->assertSame( 'wdp_donor_name', WDP_Order_Meta_Keys::DONOR_NAME );
		$this->assertSame( 150.0, $new->meta['_custom_price'] );
		$this->assertSame( 'Annem Şükriye için', $new->meta[ WDP_Order_Meta_Keys::DEDICATION ] );
	}

	public function test_anonymous_keeps_every_donor_field(): void {
		$item = new E2B_Fake_Order_Item();
		( new Donation_Order_Meta() )->write_item(
			$item,
			'k',
			array(
				'donation_data' => array(
					'full_name'  => 'Ayşe Yılmaz',
					'phone'      => '0555 000 00 00',
					'email'      => 'ayse@ornek.org',
					'dedication' => 'Babam için',
					'anonymous'  => '1',
				),
			),
			null
		);
		$this->assertSame( 'yes', $item->meta[ WDP_Order_Meta_Keys::ANONYMOUS ] );
		$this->assertSame( 'Ayşe Yılmaz', $item->meta[ WDP_Order_Meta_Keys::DONOR_NAME ] );
		$this->assertSame( '0555 000 00 00', $item->meta[ WDP_Order_Meta_Keys::DONOR_PHONE ] );
		$this->assertSame( 'ayse@ornek.org', $item->meta[ WDP_Order_Meta_Keys::DONOR_EMAIL ] );
		$this->assertSame( 'Babam için', $item->meta[ WDP_Order_Meta_Keys::DEDICATION ] );
	}

	public function test_does_not_overwrite_or_duplicate_existing_keys(): void {
		$item = new E2B_Fake_Order_Item();
		$item->meta[ WDP_Order_Meta_Keys::DONOR_NAME ] = 'İlk';
		( new Donation_Order_Meta() )->write_item( $item, 'k', array( 'donation_data' => array( 'full_name' => 'İkinci' ) ), null );
		$this->assertSame( 'İlk', $item->meta[ WDP_Order_Meta_Keys::DONOR_NAME ] );
	}

	public function test_ignores_lines_without_donation_data(): void {
		$item = new E2B_Fake_Order_Item();
		( new Donation_Order_Meta() )->write_item( $item, 'k', array( 'product_id' => 1 ), null );
		$this->assertSame( array(), $item->meta );
	}

	public function test_take_over_replaces_legacy_hook(): void {
		WDP_Test_State::$actions = array();
		add_action( Donation_Order_Meta::HOOK, array( 'WDP_Order', 'add_donation_meta_to_order' ), 10, 4 );
		( new Donation_Order_Meta() )->take_over();
		$callbacks = isset( WDP_Test_State::$actions[ Donation_Order_Meta::HOOK ] ) ? WDP_Test_State::$actions[ Donation_Order_Meta::HOOK ] : array();
		$legacy    = array_filter(
			$callbacks,
			static function ( $cb ) {
				return is_array( $cb ) && 'WDP_Order' === $cb[0];
			}
		);
		$this->assertCount( 0, $legacy );
		$this->assertCount( 1, $callbacks );
	}
}

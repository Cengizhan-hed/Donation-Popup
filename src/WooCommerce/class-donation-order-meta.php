<?php
/**
 * `DonationOrderMeta`: sepet öğesindeki bağış verisini sipariş kalemi meta alanlarına yazar.
 *
 * - Yalnız WooCommerce sipariş kalemi API'si kullanılır (HPOS ile uyumlu; doğrudan postmeta yok).
 * - ESKİ meta anahtarları birebir korunur (`WDP_Order_Meta_Keys::build_item_meta`, `_custom_price`).
 * - Bağışçının yazdığı hiçbir alan silinmez/maskelenmez; anonim yalnız `wdp_anonymous = yes` bayrağıdır.
 * - Klasik ve blok ödeme aynı `woocommerce_checkout_create_order_line_item` kancasından geçer.
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce;

defined( 'ABSPATH' ) || exit;

/**
 * Donation_Order_Meta.
 */
final class Donation_Order_Meta {

	const HOOK = 'woocommerce_checkout_create_order_line_item';

	/**
	 * Kancaları kaydeder: eski yazıcının yerini alır (çift kayıt olmaz).
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'init', array( $this, 'take_over' ), 99 );
	}

	/**
	 * Eski `WDP_Order` yazıcısını kaldırıp kendini bağlar.
	 *
	 * @return void
	 */
	public function take_over() {
		remove_action( self::HOOK, array( 'WDP_Order', 'add_donation_meta_to_order' ), 10 );
		add_action( self::HOOK, array( $this, 'write_item' ), 10, 4 );
	}

	/**
	 * Sipariş kalemine bağış verisini yazar.
	 *
	 * @param object               $item          WC_Order_Item_Product.
	 * @param string               $cart_item_key Sepet öğesi anahtarı.
	 * @param array<string, mixed> $values        Sepet öğesi.
	 * @param object               $order         WC_Order.
	 * @return void
	 */
	public function write_item( $item, $cart_item_key = '', $values = array(), $order = null ) {
		unset( $cart_item_key, $order );
		if ( ! is_array( $values ) ) {
			return;
		}

		if ( isset( $values['custom_price'] ) && $values['custom_price'] > 0 ) {
			$this->add_once( $item, '_custom_price', (float) $values['custom_price'] );
		}

		if ( isset( $values['donation_data'] ) && is_array( $values['donation_data'] ) ) {
			foreach ( self::meta_for( $values['donation_data'] ) as $key => $value ) {
				$this->add_once( $item, $key, $value );
			}
		}
	}

	/**
	 * Bağış verisinden sabit anahtarlı sipariş kalemi meta listesi (eski sözleşme).
	 *
	 * @param array<string, mixed> $donation_data Sepet öğesi `donation_data`.
	 * @return array<string, mixed>
	 */
	public static function meta_for( array $donation_data ) {
		return class_exists( 'WDP_Order_Meta_Keys' ) ? \WDP_Order_Meta_Keys::build_item_meta( $donation_data ) : array();
	}

	/**
	 * Aynı anahtar zaten varsa yazmaz.
	 *
	 * @param object $item  Sipariş kalemi.
	 * @param string $key   Anahtar.
	 * @param mixed  $value Değer.
	 * @return void
	 */
	private function add_once( $item, $key, $value ) {
		if ( '' !== (string) $item->get_meta( $key, true ) ) {
			return;
		}
		$item->add_meta_data( $key, $value );
	}
}

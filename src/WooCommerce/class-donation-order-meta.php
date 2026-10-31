<?php
/**
 * `DonationOrderMeta`: sepet öğesindeki bağış verisini sipariş kalemi meta alanlarına yazar.
 *
 * - Yalnız WooCommerce sipariş kalemi API'si kullanılır (HPOS ile uyumlu; doğrudan postmeta yok).
 * - ESKİ meta anahtarları birebir korunur (`Order_Meta_Keys::build_item_meta`, `_custom_price`).
 * - Yeni anahtarlar: `wdp_donation_type` (bağış türü), `wdp_donation_frequency` (düzenli bağış seçeneği).
 * - Bağışçının yazdığı hiçbir alan silinmez/maskelenmez; anonim yalnız `wdp_anonymous = yes` bayrağıdır.
 * - Klasik ve blok ödeme aynı `woocommerce_checkout_create_order_line_item` kancasından geçer.
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce;

use DonationPanel\Domain\Donation_Type;

defined( 'ABSPATH' ) || exit;

/**
 * Donation_Order_Meta.
 */
final class Donation_Order_Meta {

	const HOOK = 'woocommerce_checkout_create_order_line_item';

	/** Bağış türü (fixed|custom|shares|campaign) — yeni anahtar; eski anahtarlar değişmez. */
	const KEY_TYPE = 'wdp_donation_type';

	/** Düzenli bağış seçeneği (`donation_panel_frequency_options` değeri). */
	const KEY_FREQUENCY = 'wdp_donation_frequency';

	/**
	 * Kancaları kaydeder: sipariş kalemi için TEK yazıcı (çekirdekten, modülden bağımsız).
	 *
	 * @return void
	 */
	public function register() {
		add_action( self::HOOK, array( $this, 'write_item' ), 10, 4 );
		add_filter( 'woocommerce_order_item_display_meta_key', array( __CLASS__, 'display_key' ), 10, 2 );
		add_filter( 'woocommerce_order_item_display_meta_value', array( __CLASS__, 'display_value' ), 10, 2 );
	}

	/**
	 * Yeni anahtarlar için okunur ad.
	 *
	 * @param string $display_key Görünen anahtar.
	 * @param object $meta        Meta (key, value).
	 * @return string
	 */
	public static function display_key( $display_key, $meta = null ) {
		$raw = is_object( $meta ) && isset( $meta->key ) ? (string) $meta->key : '';
		if ( self::KEY_TYPE === $raw ) {
			return __( 'Donation type', 'woo-donation-popup' );
		}
		if ( self::KEY_FREQUENCY === $raw ) {
			return __( 'Donation frequency', 'woo-donation-popup' );
		}
		return $display_key;
	}

	/**
	 * Bağış türü değerini okunur etiketle gösterir.
	 *
	 * @param string $display_value Görünen değer.
	 * @param object $meta          Meta (key, value).
	 * @return string
	 */
	public static function display_value( $display_value, $meta = null ) {
		if ( is_object( $meta ) && isset( $meta->key, $meta->value ) && self::KEY_TYPE === (string) $meta->key ) {
			return esc_html( Donation_Type::get_label( (string) $meta->value ) );
		}
		return $display_value;
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
			if ( ! empty( $values['wdp_input_currency'] ) && is_scalar( $values['wdp_input_currency'] ) ) {
				$this->add_once( $item, '_wdp_input_currency', strtoupper( sanitize_text_field( (string) $values['wdp_input_currency'] ) ) );
			}
		}

		if ( ! empty( $values['donation_panel_kind'] ) && empty( $values['wdp_sadaka_donation'] ) ) {
			$this->add_once( $item, self::KEY_TYPE, sanitize_key( (string) $values['donation_panel_kind'] ) );
		}
		if ( ! empty( $values['donation_panel_type'] ) ) {
			$this->add_once( $item, self::KEY_FREQUENCY, sanitize_key( (string) $values['donation_panel_type'] ) );
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
		return Order_Meta_Keys::build_item_meta( $donation_data );
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

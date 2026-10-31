<?php
/**
 * Ödeme sayfası ön doldurma: bağış formunda yazılan ad, telefon ve e-posta fatura alanlarına gelir.
 *
 * Yalnız WooCommerce'in standart yolu kullanılır: oturum müşterisinin (`WC()->customer`) BOŞ fatura alanları
 * doldurulur. Klasik ödeme alan değerini müşteriden, blok ödeme Store API üzerinden aynı müşteriden okur;
 * bu yüzden iki sayfa türü tek yolla kapsanır. Hesaptaki dolu değerlerin üzerine yazılmaz, kalıcı müşteri
 * kaydı oluşturulmaz (oturum müşterisi yalnız oturuma yazılır), sipariş meta yazımına dokunulmaz.
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce\Checkout;

use DonationPanel\Support\Phone_Countries;
use DonationPanel\Support\Phone_Rules;
use DonationPanel\WooCommerce\Cart_Data;

defined( 'ABSPATH' ) || exit;

/**
 * Checkout_Prefill.
 */
final class Checkout_Prefill {

	/**
	 * Kancaları kaydeder.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'woocommerce_add_to_cart', array( $this, 'on_add_to_cart' ), 30 );
		add_action( 'template_redirect', array( $this, 'on_template_redirect' ), 20 );
	}

	/**
	 * Bağış sepete eklenince (klasik ve Store API) oturum müşterisini doldurur.
	 *
	 * @return void
	 */
	public function on_add_to_cart() {
		$this->prefill_current();
	}

	/**
	 * Ödeme sayfası (klasik ve blok) açılırken doldurur; sipariş alındı sayfasında değil.
	 *
	 * @return void
	 */
	public function on_template_redirect() {
		if ( ! function_exists( 'is_checkout' ) || ! is_checkout() ) {
			return;
		}
		if ( function_exists( 'is_wc_endpoint_url' ) && is_wc_endpoint_url( 'order-received' ) ) {
			return;
		}
		$this->prefill_current();
	}

	/**
	 * Geçerli sepet ve müşteri üzerinde çalışır.
	 *
	 * @return void
	 */
	private function prefill_current() {
		if ( ! function_exists( 'WC' ) ) {
			return;
		}
		$wc = WC();
		if ( ! $wc || ! $wc->cart instanceof \WC_Cart || ! $wc->customer instanceof \WC_Customer ) {
			return;
		}
		self::apply( $wc->customer, $wc->cart->get_cart() );
	}

	/**
	 * Sepet öğelerinden müşterinin BOŞ fatura alanlarını doldurur.
	 *
	 * @param object               $customer `WC_Customer` benzeri (get/set_billing_*).
	 * @param array<mixed, mixed> $items    Sepet öğeleri.
	 * @return array<string, string> Gerçekten yazılan alanlar (alan => değer).
	 */
	public static function apply( $customer, array $items ) {
		$values  = self::values_from_cart( $items );
		$written = array();
		foreach ( $values as $field => $value ) {
			$getter = 'get_billing_' . $field;
			$setter = 'set_billing_' . $field;
			if ( ! is_callable( array( $customer, $getter ) ) || ! is_callable( array( $customer, $setter ) ) ) {
				continue;
			}
			if ( '' !== trim( (string) $customer->$getter() ) ) {
				continue;
			}
			$customer->$setter( $value );
			$written[ $field ] = $value;
		}
		return $written;
	}

	/**
	 * En son gönderilen bağışın kişi alanlarını fatura alanlarına eşler.
	 *
	 * @param array<mixed, mixed> $items Sepet öğeleri.
	 * @return array<string, string> `first_name`, `last_name`, `phone`, `email` (yalnız dolu olanlar).
	 */
	public static function values_from_cart( array $items ) {
		foreach ( array_reverse( $items ) as $item ) {
			$data = is_array( $item ) && isset( $item['donation_data'] ) && is_array( $item['donation_data'] ) ? $item['donation_data'] : array();
			if ( ! $data || isset( $data['share_count'] ) ) {
				continue;
			}
			$values = self::map_donation_data( $data );
			if ( $values ) {
				return $values;
			}
		}
		return array();
	}

	/**
	 * Tek bağışın kişi verisini fatura alanlarına eşler (temizler, UTF-8 güvenli).
	 *
	 * @param array<string, mixed> $data Sepet öğesi `donation_data`.
	 * @return array<string, string>
	 */
	public static function map_donation_data( array $data ) {
		$values = array();

		$name = isset( $data['full_name'] ) && is_scalar( $data['full_name'] ) ? Cart_Data::text( (string) $data['full_name'], Cart_Data::NAME_MAX ) : '';
		if ( '' !== $name ) {
			$parts = preg_split( '/\s+/u', $name, -1, PREG_SPLIT_NO_EMPTY );
			$parts = is_array( $parts ) ? $parts : array( $name );
			if ( count( $parts ) > 1 ) {
				$values['last_name']  = (string) array_pop( $parts );
				$values['first_name'] = implode( ' ', $parts );
			} else {
				$values['first_name'] = $parts[0];
			}
		}

		$phone = isset( $data['phone'] ) && is_scalar( $data['phone'] ) ? Cart_Data::phone( (string) $data['phone'] ) : '';
		if ( '' !== $phone ) {
			// Ödeme sayfası telefon alanına E.164 gider (çözümlenemezse ham değer aynen).
			$values['phone'] = Phone_Rules::to_e164( $phone, Phone_Countries::get_default_country_iso() );
		}

		$email = isset( $data['email'] ) && is_scalar( $data['email'] ) ? sanitize_email( trim( (string) $data['email'] ) ) : '';
		if ( '' !== $email && is_email( $email ) ) {
			$values['email'] = $email;
		}

		return $values;
	}
}

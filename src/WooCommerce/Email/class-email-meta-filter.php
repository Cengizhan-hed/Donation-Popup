<?php
/**
 * E-posta bağlamında bağış kalemi meta süzgeci (saf mantık; sipariş verisi ve yönetici ekranı DEĞİŞMEZ).
 *
 * - Dahili/teknik anahtarlar (`_` ile başlayanlar, `donation_panel_*`, tanınmayan `wdp_*`) hiçbir e-postada görünmez.
 * - Müşteri e-postalarında telefon (bağışçı ve hissedar) gösterilmez; yönetici e-postasında kalır.
 * - Eski (çevrilmiş etiketli) anahtarlar e-posta anındaki dilin etiketiyle gösterilir; saklanan anahtar değişmez.
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce\Email;

use DonationPanel\WooCommerce\Donation_Order_Meta;
use DonationPanel\WooCommerce\Order_Meta_Keys;

defined( 'ABSPATH' ) || exit;

/**
 * Email_Meta_Filter.
 */
final class Email_Meta_Filter {

	/**
	 * `woocommerce_order_item_get_formatted_meta_data`: yalnız e-posta bağlamında çalışır.
	 *
	 * @param mixed $formatted Biçimli meta (kimlik => nesne).
	 * @param mixed $item      Sipariş kalemi.
	 * @return mixed
	 */
	public static function filter( $formatted, $item = null ) {
		unset( $item );
		$mode = Email_Context::mode();
		if ( '' === $mode || ! is_array( $formatted ) ) {
			return $formatted;
		}
		return self::apply( $formatted, Email_Context::CUSTOMER === $mode );
	}

	/**
	 * Süzme + etiket çevirisi (bağlamdan bağımsız, test edilebilir).
	 *
	 * @param array<int|string, object> $formatted Biçimli meta.
	 * @param bool                      $customer  Alıcı müşteri mi.
	 * @return array<int|string, object>
	 */
	public static function apply( array $formatted, $customer ) {
		foreach ( $formatted as $id => $meta ) {
			$key = is_object( $meta ) && isset( $meta->key ) ? (string) $meta->key : '';
			if ( self::is_technical_key( $key ) ) {
				unset( $formatted[ $id ] );
				continue;
			}
			$fixed = Order_Meta_Keys::normalize_key( $key );
			if ( $customer && null !== $fixed && self::is_phone_key( $fixed ) ) {
				unset( $formatted[ $id ] );
				continue;
			}
			// Eski (çevrilmiş) anahtar: görünen etiket e-posta anındaki dile göre yeniden üretilir.
			if ( null !== $fixed && $fixed !== $key ) {
				$label = Order_Meta_Keys::get_label( $fixed );
				if ( null !== $label ) {
					$meta->display_key = $label;
				}
			}
		}
		return $formatted;
	}

	/**
	 * Teknik/dahili anahtar mı (e-postada asla gösterilmez).
	 *
	 * @param string $key Ham meta anahtarı.
	 * @return bool
	 */
	public static function is_technical_key( $key ) {
		$key = (string) $key;
		if ( '' === $key || '_' === $key[0] || 0 === strpos( $key, 'donation_panel_' ) ) {
			return true;
		}
		if ( 0 === strpos( $key, 'wdp_' ) ) {
			return ! ( Order_Meta_Keys::is_fixed_key( $key ) || in_array( $key, array( Donation_Order_Meta::KEY_TYPE, Donation_Order_Meta::KEY_FREQUENCY ), true ) );
		}
		return false;
	}

	/**
	 * Sabit anahtar telefon mu (bağışçı ya da hissedar).
	 *
	 * @param string $fixed Sabit anahtar.
	 * @return bool
	 */
	public static function is_phone_key( $fixed ) {
		if ( Order_Meta_Keys::DONOR_PHONE === $fixed ) {
			return true;
		}
		$parsed = Order_Meta_Keys::parse_shareholder_key( $fixed );
		return null !== $parsed && 'phone' === $parsed['field'];
	}
}

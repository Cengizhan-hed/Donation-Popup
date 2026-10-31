<?php
/**
 * Küçük, genel güvenlik yardımcıları.
 *
 * Hız sınırı ve istemci IP'si `DonationPanel\Http\Rate_Limiter` / `Client_Ip` içindedir; REST uçları
 * `Rest_Controller` ortak nonce/yetki yolunu kullanır. Bu sınıfta yalnız sayı doğrulama kalır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Security.
 */
class Security {

	/**
	 * Sayıyı doğrular; aralık dışındaysa ya da sayı değilse null.
	 *
	 * @param mixed      $value Değer.
	 * @param float|null $min   En düşük.
	 * @param float|null $max   En yüksek.
	 * @return float|null
	 */
	public static function sanitize_numeric( $value, $min = null, $max = null ) {
		if ( ! is_numeric( $value ) ) {
			return null;
		}

		$value = floatval( $value );

		if ( null !== $min && $value < $min ) {
			return null;
		}

		if ( null !== $max && $value > $max ) {
			return null;
		}

		return $value;
	}
}

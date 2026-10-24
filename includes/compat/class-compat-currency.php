<?php
/**
 * Çoklu para birimi / çok dilli eklenti bağdaştırıcısı (yalnızca bu dosya eklenti adlarını bilir).
 *
 * Çekirdek filtreleri: wdp_order_exchange_rate, wdp_progress_live_rate, wdp_client_context.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class WDP_Compat_Currency
 */
class WDP_Compat_Currency {

	/**
	 * @return void
	 */
	public static function init() {
		add_filter( 'wdp_order_exchange_rate', array( __CLASS__, 'order_rate' ), 10, 4 );
		add_filter( 'wdp_progress_live_rate', array( __CLASS__, 'live_rate' ), 10, 3 );
		add_filter( 'wdp_client_context', array( __CLASS__, 'client_context' ), 10, 1 );
	}

	/**
	 * Siparişe yazılmış kur: Curcy wmc_order_info / wmc_order_rate, WOOCS _woocs_order_rate.
	 *
	 * @param float|null $rate     Önceki değer.
	 * @param mixed      $order    Order.
	 * @param string     $currency Order currency.
	 * @param string     $base     Base currency (kullanılmaz).
	 * @return float|null
	 */
	public static function order_rate( $rate, $order, $currency, $base = '' ) {
		unset( $base );
		if ( null !== $rate || ! is_object( $order ) || ! method_exists( $order, 'get_meta' ) ) {
			return $rate;
		}
		$currency = strtoupper( (string) $currency );

		$info = $order->get_meta( 'wmc_order_info', true );
		if ( ! is_array( $info ) ) {
			$info = $order->get_meta( '_wmc_order_info', true );
		}
		if ( is_array( $info ) ) {
			if ( isset( $info[ $currency ] ) && is_array( $info[ $currency ] ) && isset( $info[ $currency ]['rate'] ) ) {
				$value = (float) $info[ $currency ]['rate'];
				if ( $value > 0 ) {
					return $value;
				}
			}
			// Bazı sürümler tek düzey 'rate' + 'currency' tutar.
			if ( isset( $info['rate'], $info['currency'] ) && strtoupper( (string) $info['currency'] ) === $currency ) {
				$value = (float) $info['rate'];
				if ( $value > 0 ) {
					return $value;
				}
			}
		}

		foreach ( array( 'wmc_order_rate', '_wmc_order_rate', '_woocs_order_rate', 'woocs_order_rate' ) as $key ) {
			$raw = $order->get_meta( $key, true );
			if ( '' !== $raw && null !== $raw && is_numeric( $raw ) && (float) $raw > 0 ) {
				return (float) $raw;
			}
		}
		return $rate;
	}

	/**
	 * Curcy canlı kur listesi.
	 *
	 * @param float|null $rate     Önceki değer.
	 * @param string     $currency Currency code.
	 * @param string     $base     Base currency (kullanılmaz).
	 * @return float|null
	 */
	public static function live_rate( $rate, $currency, $base = '' ) {
		unset( $base );
		if ( null !== $rate ) {
			return $rate;
		}
		$currency = strtoupper( (string) $currency );
		if ( class_exists( 'WOOMULTI_CURRENCY_Data' ) && method_exists( 'WOOMULTI_CURRENCY_Data', 'get_ins' ) ) {
			$settings = WOOMULTI_CURRENCY_Data::get_ins();
			if ( is_object( $settings ) && method_exists( $settings, 'get_list_currencies' ) ) {
				$list = $settings->get_list_currencies();
				if ( is_array( $list ) && isset( $list[ $currency ]['rate'] ) && (float) $list[ $currency ]['rate'] > 0 ) {
					return (float) $list[ $currency ]['rate'];
				}
			}
		}
		return $rate;
	}

	/**
	 * Ön yüz para birimi/dil sinyali: çerez adları, değiştirici seçicileri, olaylar.
	 *
	 * @param array<string, mixed> $context Çekirdek bağlamı.
	 * @return array<string, mixed>
	 */
	public static function client_context( $context ) {
		$context = is_array( $context ) ? $context : array();
		$merge   = static function ( $key, $add, $prepend = false ) use ( &$context ) {
			$cur             = isset( $context[ $key ] ) && is_array( $context[ $key ] ) ? $context[ $key ] : array();
			$context[ $key ] = array_values( array_unique( $prepend ? array_merge( $add, $cur ) : array_merge( $cur, $add ) ) );
		};
		$merge( 'currency_cookies', array( 'wmc_current_currency' ), true );
		$merge( 'currency_cookies', array( 'wmc_currency', 'woocs_current_currency' ) );
		$merge( 'lang_cookies', array( 'wp-wpml_current_language', 'wpml_language' ) );
		$merge( 'switcher_selectors', array( '.wmc-currency', '.wmc-currency-wrapper', '.woocommerce-currency-switcher', '.woocs_currency' ) );
		$merge( 'change_events', array( 'wmc_currency_changed', 'woocs_currency_changed', 'curcy_currency_changed' ) );
		return $context;
	}
}

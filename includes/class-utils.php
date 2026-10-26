<?php
/**
 * Yönetici köprüsü (GEÇİCİ): eski yönetici dosyalarının çağırdığı WDP_Utils yöntemlerini yeni sınıflara yönlendirir.
 * Yeni kod bu sınıfı KULLANMAZ; yönetici dosyaları kaldırılınca silinir.
 *
 * @package DonationPanel
 */

use DonationPanel\Domain\Addon_Settings;
use DonationPanel\Domain\Button_Settings;
use DonationPanel\Domain\Campaign_Totals;
use DonationPanel\Support\Price;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class WDP_Utils
 */
class WDP_Utils {

	/**
	 * @param mixed $settings Ham ayar.
	 * @return array
	 */
	public static function normalize_legacy_popup_button_text( $settings ) {
		return Button_Settings::normalize_legacy_popup_button_text( $settings );
	}

	/**
	 * @param mixed  $amount Tutar.
	 * @return string
	 */
	public static function format_price_html( $amount ) {
		return Price::format_price_html( $amount );
	}

	/**
	 * @param mixed $amount Tutar.
	 * @return string
	 */
	public static function format_price_plain( $amount ) {
		return Price::format_price_plain( $amount );
	}

	/**
	 * @param mixed $amount Tutar.
	 * @return string
	 */
	public static function format_localized_amount( $amount ) {
		return Price::format_localized_amount( $amount );
	}

	/**
	 * @return string
	 */
	public static function get_display_currency_symbol() {
		return Price::get_display_currency_symbol();
	}

	/**
	 * @return int
	 */
	public static function get_default_addon_wc_product_id() {
		return Addon_Settings::get_default_addon_wc_product_id();
	}

	/**
	 * @param int $product_id Ürün.
	 * @return float
	 */
	public static function get_manual_total( $product_id ) {
		return Campaign_Totals::get_manual_total( $product_id );
	}

	/**
	 * @param int $product_id Ürün.
	 * @return int
	 */
	public static function get_donor_count( $product_id ) {
		return Campaign_Totals::get_donor_count( $product_id );
	}

	/**
	 * @param int $product_id Ürün.
	 * @return mixed
	 */
	public static function recalculate_product_donation_total( $product_id ) {
		return Campaign_Totals::recalculate_product_donation_total( $product_id );
	}

	/**
	 * Hex renk (tek renk) ya da bozuk değerden geçerli bir hex arka plan.
	 *
	 * @param mixed  $value    Kayıtlı veya gönderilmiş değer.
	 * @param string $fallback Geçersizse kullanılacak renk.
	 * @return string
	 */
	public static function coerce_solid_hex_background( $value, $fallback = '#ffffff' ) {
		if ( ! is_string( $value ) || '' === $value ) {
			return $fallback;
		}
		$trim = trim( $value );
		$hex  = sanitize_hex_color( $trim );
		if ( $hex ) {
			return $hex;
		}
		if ( preg_match_all( '/#(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{6})\b/', $trim, $matches ) && ! empty( $matches[0] ) ) {
			foreach ( $matches[0] as $candidate ) {
				$san = sanitize_hex_color( $candidate );
				if ( $san ) {
					return $san;
				}
			}
		}
		return $fallback;
	}

	/**
	 * Progress bar dolgu rengi (tek renk); eski fill_start / fill_mid / fill_end ile uyum.
	 *
	 * @param array $settings wdp_progress_bar_settings.
	 * @return string
	 */
	public static function resolve_progress_bar_fill_color( array $settings ) {
		if ( ! empty( $settings['fill_color'] ) && sanitize_hex_color( $settings['fill_color'] ) ) {
			return sanitize_hex_color( $settings['fill_color'] );
		}
		foreach ( array( 'fill_mid', 'fill_start', 'fill_end' ) as $key ) {
			if ( ! empty( $settings[ $key ] ) && sanitize_hex_color( $settings[ $key ] ) ) {
				return sanitize_hex_color( $settings[ $key ] );
			}
		}
		return '#2563eb';
	}

	/**
	 * Eski tek "button_shadow_*" anahtarlarını shortcode ('sc') ve modal içi ('modal') çiftleriyle doldurur.
	 *
	 * @param mixed $settings Ayar dizisi.
	 * @return array
	 */
	public static function migrate_button_shadow_to_sc_modal( $settings ) {
		if ( ! is_array( $settings ) ) {
			return array();
		}
		if ( array_key_exists( 'button_shadow_sc_enabled', $settings ) || array_key_exists( 'button_shadow_modal_enabled', $settings ) ) {
			return $settings;
		}
		if ( ! array_key_exists( 'button_shadow_enabled', $settings ) ) {
			return $settings;
		}

		$base = array(
			'enabled'        => isset( $settings['button_shadow_enabled'] ) ? (string) $settings['button_shadow_enabled'] : '0',
			'color'          => isset( $settings['button_shadow_color'] ) ? $settings['button_shadow_color'] : '#94a3b8',
			'x'              => isset( $settings['button_shadow_x'] ) ? $settings['button_shadow_x'] : 0,
			'y'              => isset( $settings['button_shadow_y'] ) ? $settings['button_shadow_y'] : 8,
			'blur'           => isset( $settings['button_shadow_blur'] ) ? $settings['button_shadow_blur'] : 20,
			'spread'         => isset( $settings['button_shadow_spread'] ) ? $settings['button_shadow_spread'] : 0,
			'hover_enhanced' => isset( $settings['button_shadow_hover_enhanced'] ) ? (string) $settings['button_shadow_hover_enhanced'] : '0',
			'hover_blur'     => isset( $settings['button_shadow_hover_blur'] ) ? $settings['button_shadow_hover_blur'] : 24,
			'hover_color'    => isset( $settings['button_shadow_hover_color'] ) ? $settings['button_shadow_hover_color'] : '',
			'hover_x'        => isset( $settings['button_shadow_hover_x'] ) ? $settings['button_shadow_hover_x'] : 0,
			'hover_y'        => isset( $settings['button_shadow_hover_y'] ) ? $settings['button_shadow_hover_y'] : 10,
			'hover_spread'   => isset( $settings['button_shadow_hover_spread'] ) ? $settings['button_shadow_hover_spread'] : 0,
		);

		foreach ( array( 'sc', 'modal' ) as $slot ) {
			$p = 'button_shadow_' . $slot . '_';
			foreach ( $base as $suffix => $value ) {
				$settings[ $p . $suffix ] = $value;
			}
		}

		return $settings;
	}
}

<?php
/**
 * Alt bağış (ek bağış) ürün ayarları ve tutar doğrulama.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

use DonationPanel\WooCommerce\Cart_Hooks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Addon_Settings
 */
class Addon_Settings {

/**
	 * Alt bağış satırı için ürün meta'sındaki WooCommerce ürün ID'si.
	 *
	 * @param int|WC_Product $parent_product Ana bağış ürünü.
	 * @return int Geçerli WC ürün ID veya 0.
	 */
	public static function resolve_addon_wc_product_id( $parent_product ) {
		$configured = self::get_configured_addon_wc_product_id( $parent_product );
		if ( $configured <= 0 ) {
			return 0;
		}

		/**
		 * Alt bağış sepet satırında kullanılacak WooCommerce ürün ID.
		 *
		 * @param int $configured Ürün meta _addon_wc_product_id.
		 * @param int $parent_id  Ana bağış ürün ID.
		 */
		$parent_id  = $parent_product instanceof \WC_Product
			? (int) $parent_product->get_id()
			: absint( $parent_product );
		$filtered   = apply_filters( 'wdp_sadaka_wc_product_id', $configured, $parent_id );
		$product_id = absint( $filtered );

		return self::is_valid_addon_wc_product( $product_id ) ? $product_id : 0;
	}

/**
	 * Addon sepet satırı için kullanılabilir WC ürünü (gizli/katalog ürünleri dahil).
	 *
	 * @param int $product_id Product ID.
	 * @return bool
	 */
	public static function is_valid_addon_wc_product( $product_id ) {
		$product_id = absint( $product_id );
		if ( $product_id <= 0 ) {
			return false;
		}

		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			return false;
		}
		if ( method_exists( $product, 'exists' ) && ! $product->exists() ) {
			return false;
		}

		$type = method_exists( $product, 'get_type' ) ? (string) $product->get_type() : '';
		if ( $type !== '' && $type !== 'simple' ) {
			return false;
		}

		$status = $product->get_status();
		return in_array( $status, array( 'publish', 'private' ), true );
	}

/**
	 * Genel alt bağış WC ürün ID (Başarı & Mini Sepet).
	 * 0 değeri, zorunlu yapılandırma eksik olduğunu ifade eder.
	 *
	 * @return int
	 */
	public static function get_default_addon_wc_product_id() {
		$settings = get_option( 'wdp_success_settings', array() );
		$id       = 0;
		if ( is_array( $settings ) && ! empty( $settings['sadaka_wc_product_id'] ) ) {
			$id = absint( $settings['sadaka_wc_product_id'] );
		}
		return $id > 0 ? $id : 0;
	}

/**
	 * Alt bağış aç/kapa buton metni (ürün meta → genel ayar → varsayılan).
	 *
	 * @param WC_Product|int|null $parent_product Ana bağış ürünü.
	 * @return string
	 */
	public static function get_addon_toggle_label( $parent_product = null ) {
		if ( $parent_product !== null ) {
			$parent = $parent_product instanceof \WC_Product ? $parent_product : wc_get_product( (int) $parent_product );
			if ( $parent ) {
				$per_product = trim( (string) Addon_Product_Visibility::get_meta( $parent, '_addon_toggle_label' ) );
				if ( $per_product !== '' ) {
					return sanitize_text_field( $per_product );
				}
			}
		}

		$settings = get_option( 'wdp_success_settings', array() );
		if ( is_array( $settings ) && ! empty( $settings['sadaka_toggle_label'] ) ) {
			$label = sanitize_text_field( $settings['sadaka_toggle_label'] );
			if ( $label !== '' ) {
				return $label;
			}
		}

		return __( 'Add add-on donation', 'woo-donation-popup' );
	}

/**
	 * Ürün meta veya genel ayar alt bağış WC ürün ID'si.
	 *
	 * @param WC_Product|int $parent_product Ana bağış ürünü.
	 * @return int
	 */
	public static function get_configured_addon_wc_product_id( $parent_product ) {
		$parent = $parent_product instanceof \WC_Product ? $parent_product : wc_get_product( (int) $parent_product );
		if ( ! $parent ) {
			return self::get_default_addon_wc_product_id();
		}

		$per_product = absint( Addon_Product_Visibility::get_meta( $parent, '_addon_wc_product_id' ) );
		if ( $per_product > 0 ) {
			return $per_product;
		}

		return self::get_default_addon_wc_product_id();
	}

/**
	 * Alt bağış sabit fiyatı (ürün meta). 0 = özel tutar modu.
	 *
	 * @param WC_Product|int $parent_product Ana bağış ürünü.
	 * @return float
	 */
	public static function get_addon_fixed_price( $parent_product ) {
		$parent = $parent_product instanceof \WC_Product ? $parent_product : wc_get_product( (int) $parent_product );
		if ( ! $parent ) {
			return 0.0;
		}

		$raw = Addon_Product_Visibility::get_meta( $parent, '_addon_fixed_price' );
		if ( $raw === '' || $raw === null ) {
			return 0.0;
		}

		$value = (float) wc_format_decimal( $raw );
		return $value > 0 ? $value : 0.0;
	}

/**
	 * Yerel biçimli alt bağış tutarını sayıya çevirir (5.566 / 5,566 / 5566).
	 *
	 * @param mixed $raw Ham tutar.
	 * @return float|null Geçerli sayı veya null.
	 */
	public static function parse_addon_amount( $raw ) {
		if ( $raw === null || $raw === '' ) {
			return null;
		}
		if ( is_int( $raw ) || is_float( $raw ) ) {
			$n = (float) $raw;
			return is_finite( $n ) ? $n : null;
		}
		$s = preg_replace( '/\s+/u', '', (string) $raw );
		if ( $s === '' || $s === null ) {
			return null;
		}
		$has_comma = strpos( $s, ',' ) !== false;
		$has_dot   = strpos( $s, '.' ) !== false;
		if ( $has_comma && $has_dot ) {
			// 1.234,56 → 1234.56
			if ( strrpos( $s, ',' ) > strrpos( $s, '.' ) ) {
				$s = str_replace( '.', '', $s );
				$s = str_replace( ',', '.', $s );
			} else {
				// 1,234.56 → 1234.56
				$s = str_replace( ',', '', $s );
			}
		} elseif ( $has_comma ) {
			$parts = explode( ',', $s );
			if ( count( $parts ) > 2 ) {
				$s = implode( '', $parts );
			} elseif ( count( $parts ) === 2 && strlen( $parts[1] ) === 3 && ctype_digit( $parts[1] ) && ctype_digit( str_replace( '-', '', $parts[0] ) ) ) {
				// 5,566 → binlik
				$s = $parts[0] . $parts[1];
			} else {
				// 5,5 / 5,56 → ondalık
				$s = $parts[0] . '.' . ( isset( $parts[1] ) ? $parts[1] : '' );
			}
		} else {
			$parts = explode( '.', $s );
			if ( count( $parts ) > 2 ) {
				$s = implode( '', $parts );
			} elseif ( count( $parts ) === 2 && strlen( $parts[1] ) === 3 && ctype_digit( $parts[1] ) && ctype_digit( str_replace( '-', '', $parts[0] ) ) ) {
				// 5.566 → binlik
				$s = $parts[0] . $parts[1];
			}
		}
		if ( ! is_numeric( $s ) ) {
			return null;
		}
		$n = (float) $s;
		return is_finite( $n ) ? $n : null;
	}

/**
	 * Açık alt bağış paneli için tutar doğrulaması.
	 *
	 * @param mixed $raw         Ham tutar (sabit fiyat yoksa).
	 * @param float $min_price   Minimum tutar (0 = yok).
	 * @param float $fixed_price Sabit tutar (>0 ise raw yok sayılır).
	 * @return array{ok:bool,amount:float|null,code:string,message:string}
	 */
	public static function validate_addon_amount( $raw, $min_price = 0.0, $fixed_price = 0.0 ) {
		$fixed = (float) $fixed_price;
		if ( $fixed > 0 ) {
			return array(
				'ok'      => true,
				'amount'  => $fixed,
				'code'    => 'fixed',
				'message' => '',
			);
		}

		$raw_str = is_string( $raw ) ? trim( $raw ) : (string) $raw;
		if ( $raw_str === '' || $raw === null ) {
			return array(
				'ok'      => false,
				'amount'  => null,
				'code'    => 'empty',
				'message' => __( 'Please enter a valid add-on donation amount.', 'woo-donation-popup' ),
			);
		}

		$amount = self::parse_addon_amount( $raw_str );
		if ( null === $amount || $amount <= 0 ) {
			return array(
				'ok'      => false,
				'amount'  => null,
				'code'    => 'invalid',
				'message' => __( 'Please enter a valid add-on donation amount.', 'woo-donation-popup' ),
			);
		}

		$min = (float) $min_price;
		if ( $min > 0 && $amount + 0.0001 < $min ) {
			$formatted = class_exists( 'DonationPanel\\WooCommerce\\Cart_Hooks' )
				? Cart_Hooks::format_amount_for_message( $min, true )
				: (string) $min;
			return array(
				'ok'      => false,
				'amount'  => $amount,
				'code'    => 'below_min',
				'message' => sprintf(
					/* translators: %s: formatted minimum amount with currency */
					__( 'Please enter %s or more for the add-on donation.', 'woo-donation-popup' ),
					$formatted
				),
			);
		}

		return array(
			'ok'      => true,
			'amount'  => $amount,
			'code'    => 'valid',
			'message' => '',
		);
	}
}

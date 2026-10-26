<?php
/**
 * Hedefli kampanya: hedefe ulaşma kararı, mesaj ve kapatma kapısı.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

use DonationPanel\WooCommerce\Cart_Hooks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Campaign_Goal
 */
class Campaign_Goal {

	const ACTION_CONTINUE = 'continue';
	const ACTION_MESSAGE  = 'message';
	const ACTION_CLOSE    = 'close';

	const MAX_GOAL_AMOUNT = 1000000000.0;
	const MESSAGE_MAX_LEN = 300;

	/**
	 * Varsayılan hedefe-ulaşıldı mesajı (ürün alanı boşsa).
	 *
	 * @return string
	 */
	public static function default_message() {
		return __(
			'We have reached our goal, thank you for your support. Extra donations to this campaign are used in similar projects.',
			'woo-donation-popup'
		);
	}

	/**
	 * @param mixed $raw Meta veya istek değeri.
	 * @return string continue|message|close
	 */
	public static function sanitize_action( $raw ) {
		$raw = sanitize_key( (string) $raw );
		if ( in_array( $raw, array( self::ACTION_CONTINUE, self::ACTION_MESSAGE, self::ACTION_CLOSE ), true ) ) {
			return $raw;
		}
		// Boş / bilinmeyen → message (mevcut ürünler migration olmadan message gibi davranır).
		return self::ACTION_MESSAGE;
	}

	/**
	 * @param int|\WC_Product $product Product.
	 * @return string
	 */
	public static function resolve_action( $product ) {
		$meta = '';
		if ( $product instanceof \WC_Product ) {
			$meta = (string) $product->get_meta( '_goal_reached_action' );
		} else {
			$meta = (string) get_post_meta( absint( $product ), '_goal_reached_action', true );
		}
		return self::sanitize_action( $meta );
	}

	/**
	 * @param string $raw Raw message.
	 * @return string
	 */
	public static function sanitize_message( $raw ) {
		$text = sanitize_text_field( (string) $raw );
		if ( function_exists( 'mb_substr' ) && function_exists( 'mb_strlen' ) && mb_strlen( $text ) > self::MESSAGE_MAX_LEN ) {
			return mb_substr( $text, 0, self::MESSAGE_MAX_LEN );
		}
		if ( strlen( $text ) > self::MESSAGE_MAX_LEN ) {
			return substr( $text, 0, self::MESSAGE_MAX_LEN );
		}
		return $text;
	}

	/**
	 * @param int|\WC_Product $product Product.
	 * @return string
	 */
	public static function resolve_message( $product ) {
		$meta = '';
		if ( $product instanceof \WC_Product ) {
			$meta = (string) $product->get_meta( '_goal_reached_message' );
		} else {
			$meta = (string) get_post_meta( absint( $product ), '_goal_reached_message', true );
		}
		$meta = self::sanitize_message( $meta );
		return $meta !== '' ? $meta : self::default_message();
	}

	/**
	 * @param int|\WC_Product $product Product.
	 * @return float
	 */
	public static function resolve_goal_amount( $product ) {
		$raw = '';
		if ( $product instanceof \WC_Product ) {
			$raw = (string) $product->get_meta( '_progress_bar_limit' );
		} else {
			$raw = (string) get_post_meta( absint( $product ), '_progress_bar_limit', true );
		}
		if ( $raw === '' || ! is_numeric( $raw ) ) {
			return 0.0;
		}
		$goal = (float) $raw;
		return $goal > 0 ? $goal : 0.0;
	}

	/**
	 * Onaylı (ödenmiş) toplanan tutar.
	 *
	 * @param int $product_id Product ID.
	 * @return float
	 */
	public static function get_confirmed_total( $product_id ) {
		return (float) Campaign_Totals::get_total_donation_amount( absint( $product_id ) );
	}

	/**
	 * Kapı / close kontrolü için etkili toplam (onaylı + sepette bekleyen).
	 *
	 * @param int  $product_id      Product ID.
	 * @param bool $include_pending Sepet bekleyenini ekle.
	 * @return float
	 */
	public static function get_effective_total( $product_id, $include_pending = false ) {
		$product_id = absint( $product_id );
		$total      = self::get_confirmed_total( $product_id );
		if ( $include_pending ) {
			$total += (float) Cart_Hooks::sum_cart_pending_for_product( $product_id );
		}
		return max( 0.0, $total );
	}

	/**
	 * Yüzde (0–100); hedef aşımında 100'de kalır. Tek kaynak: onaylı toplam / hedef.
	 *
	 * @param float $current Confirmed total.
	 * @param float $limit   Goal.
	 * @return float
	 */
	public static function compute_percent( $current, $limit ) {
		$limit   = max( 1.0, (float) $limit );
		$current = max( 0.0, (float) $current );
		return min( 100.0, ( $current / $limit ) * 100.0 );
	}

	/**
	 * Hedefe ulaşıldı mı? (görünüm ve sunucu aynı fonksiyon).
	 *
	 * @param int   $product_id Product ID.
	 * @param array $args {
	 *     @type bool  $include_pending Sepet bekleyenini dahil et (close kapısı).
	 *     @type float $goal            Opsiyonel hedef override.
	 *     @type float $confirmed       Opsiyonel onaylı toplam override.
	 * }
	 * @return bool
	 */
	public static function is_goal_reached( $product_id, array $args = array() ) {
		$product_id = absint( $product_id );
		if ( ! $product_id ) {
			return false;
		}
		$goal = isset( $args['goal'] ) ? (float) $args['goal'] : self::resolve_goal_amount( $product_id );
		if ( $goal <= 0 ) {
			return false;
		}
		$include_pending = ! empty( $args['include_pending'] );
		if ( isset( $args['confirmed'] ) ) {
			$total = (float) $args['confirmed'];
			if ( $include_pending ) {
				$total += (float) Cart_Hooks::sum_cart_pending_for_product( $product_id );
			}
		} else {
			$total = self::get_effective_total( $product_id, $include_pending );
		}
		return $total >= $goal;
	}

	/**
	 * Progress bar açık mı?
	 *
	 * @param int|\WC_Product $product Product.
	 * @return bool
	 */
	public static function is_campaign_product( $product ) {
		if ( $product instanceof \WC_Product ) {
			return $product->get_meta( '_enable_progress_bar' ) === 'yes';
		}
		return get_post_meta( absint( $product ), '_enable_progress_bar', true ) === 'yes';
	}

	/**
	 * Close modunda yeni bağış reddedilmeli mi?
	 *
	 * @param int|\WC_Product $product Product.
	 * @return bool
	 */
	public static function should_block_new_donations( $product ) {
		if ( ! self::is_campaign_product( $product ) ) {
			return false;
		}
		if ( self::resolve_action( $product ) !== self::ACTION_CLOSE ) {
			return false;
		}
		$product_id = $product instanceof \WC_Product ? (int) $product->get_id() : absint( $product );
		return self::is_goal_reached( $product_id, array( 'include_pending' => true ) );
	}

	/**
	 * Mesaj gösterilmeli mi? (message veya close; continue hayır).
	 *
	 * @param int|\WC_Product $product Product.
	 * @return bool
	 */
	public static function should_show_reached_message( $product ) {
		if ( ! self::is_campaign_product( $product ) ) {
			return false;
		}
		$action = self::resolve_action( $product );
		if ( $action === self::ACTION_CONTINUE ) {
			return false;
		}
		$product_id = $product instanceof \WC_Product ? (int) $product->get_id() : absint( $product );
		// Mesaj: yalnız onaylı toplam (sepet bekleyen dahil değil).
		return self::is_goal_reached( $product_id, array( 'include_pending' => false ) );
	}

	/**
	 * Formda bağıştan önce gösterilen mesaj HTML.
	 *
	 * @param int|\WC_Product $product Product.
	 * @param bool           $closed  Close modunda alanlar pasif.
	 * @return string
	 */
	public static function render_reached_notice_html( $product, $closed = false ) {
		if ( ! self::should_show_reached_message( $product ) ) {
			return '';
		}
		$message = self::resolve_message( $product );
		$class   = 'wdp-goal-reached-notice';
		if ( $closed || self::should_block_new_donations( $product ) ) {
			$class .= ' wdp-goal-reached-notice--closed';
		}
		return '<div class="' . esc_attr( $class ) . '" role="status" data-wdp-goal-notice="1"><p class="wdp-goal-reached-notice__text">'
			. esc_html( $message )
			. '</p></div>';
	}

	/**
	 * Close kapısı: hedef kapalıysa istisna fırlatır (ileti kullanıcıya gösterilir).
	 *
	 * @param int|\WC_Product $product Product.
	 * @return void
	 * @throws \RuntimeException Hedef kapalıysa.
	 */
	public static function assert_accepts_donation( $product ) {
		if ( ! self::should_block_new_donations( $product ) ) {
			return;
		}
		$message = self::resolve_message( $product );
		throw new \RuntimeException( $message ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- ileti temizlenmiş metindir.
	}

	/**
	 * woocommerce_add_to_cart_validation için: false + notice.
	 *
	 * @param bool           $passed     Current.
	 * @param int|\WC_Product $product_id Product.
	 * @return bool
	 */
	public static function filter_add_to_cart_validation( $passed, $product_id ) {
		if ( ! $passed ) {
			return false;
		}
		$product = $product_id instanceof \WC_Product ? $product_id : wc_get_product( absint( $product_id ) );
		if ( ! $product || ! self::should_block_new_donations( $product ) ) {
			return $passed;
		}
		if ( function_exists( 'wc_add_notice' ) ) {
			wc_add_notice( self::resolve_message( $product ), 'error' );
		}
		return false;
	}
}

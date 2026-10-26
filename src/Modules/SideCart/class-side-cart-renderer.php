<?php
/**
 * Yan sepet çıktısı: sunucuda çizilen çekmece gövdesi, tetikleyici ve çekmece kabuğu.
 *
 * Tüm metinler çevrilebilir; tutarlar WooCommerce'in `wc_price` çıktısıdır (etkin para birimi, ondalık, ayırıcılar).
 * Tema özel seçici yok; `donation-panel/side-cart/` şablonları yok (tek çıktı kaynağı bu sınıf).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\SideCart;

defined( 'ABSPATH' ) || exit;

/**
 * Side_Cart_Renderer.
 */
final class Side_Cart_Renderer {

	const DRAWER_ID = 'dp-sc-drawer';

	/**
	 * Sepet simgesi.
	 *
	 * @return string
	 */
	private static function cart_icon() {
		return '<svg class="dp-sc__ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>';
	}

	/**
	 * Sayaç rozeti (WooCommerce parça yenilemesiyle de değişir: `span.dp-sc__count`).
	 *
	 * @param int $count Kalem sayısı.
	 * @return string
	 */
	public static function count_badge( $count ) {
		$count = max( 0, (int) $count );
		return '<span class="dp-sc__count" data-dp-sc-count' . ( $count > 0 ? '' : ' hidden' ) . '>' . esc_html( (string) $count ) . '</span>';
	}

	/**
	 * Tetikleyici düğme (kısa kod çıktısı).
	 *
	 * @param int    $count Kalem sayısı.
	 * @param string $label Erişilebilir ad.
	 * @return string
	 */
	public static function trigger( $count, $label = '' ) {
		if ( '' === $label ) {
			$label = __( 'Donation basket', 'woo-donation-popup' );
		}
		return '<button type="button" class="dp dp-sc__trigger" data-dp-sc-open aria-haspopup="dialog" aria-expanded="false" aria-controls="' . esc_attr( self::DRAWER_ID ) . '">'
			. self::cart_icon() . '<span class="dp-sc__sr">' . esc_html( $label ) . '</span>' . self::count_badge( $count ) . '</button>';
	}

	/**
	 * Kalem sayısı metni ("3 gifts in your basket").
	 *
	 * @param int $count Kalem sayısı.
	 * @return string
	 */
	public static function count_text( $count ) {
		/* translators: %d: number of gifts in the donation basket. */
		return sprintf( _n( '%d gift in your basket', '%d gifts in your basket', (int) $count, 'woo-donation-popup' ), (int) $count );
	}

	/**
	 * Çekmece gövdesi (REST ve ilk çıktıda aynı): satırlar + sabit alt çubuk ya da boş durum.
	 *
	 * @param array<int, array<string, mixed>> $lines         Satırlar (Side_Cart_Lines).
	 * @param string                           $subtotal_html Ara toplam (WooCommerce).
	 * @param string                           $checkout_url  Ödeme sayfası.
	 * @return string
	 */
	public static function body( array $lines, $subtotal_html, $checkout_url ) {
		if ( empty( $lines ) ) {
			return '<div class="dp-sc__empty"><div class="dp-sc__empty-art">' . self::cart_icon() . '</div><h3>' . esc_html__( 'Your basket is empty', 'woo-donation-popup' ) . '</h3><p>' . esc_html__( 'Add a gift and it will be summarised here.', 'woo-donation-popup' ) . '</p><button type="button" class="dp-sc__btn dp-sc__btn--secondary" data-dp-sc-close>' . esc_html__( 'Continue giving', 'woo-donation-popup' ) . '</button></div>';
		}

		$html  = '<div class="dp-sc__scroll"><ul class="dp-sc__list">';
		$count = count( $lines );
		foreach ( $lines as $line ) {
			$html .= self::line( $line );
		}
		$html .= '</ul></div>';
		$html .= '<div class="dp-sc__bar"><div class="dp-sc__subtotal"><span>' . esc_html__( 'Subtotal', 'woo-donation-popup' ) . '</span><strong class="dp-sc__num">' . wp_kses_post( $subtotal_html ) . '</strong></div>'
			. '<p class="dp-sc__hint">' . esc_html__( 'Payment method and any taxes are shown at checkout.', 'woo-donation-popup' ) . '</p>'
			. '<a class="dp-sc__btn dp-sc__btn--primary" data-dp-sc-go href="' . esc_url( $checkout_url ) . '">' . esc_html__( 'Continue to checkout', 'woo-donation-popup' ) . '</a></div>';
		return '<p class="dp-sc__sub" data-dp-sc-sub>' . esc_html( self::count_text( $count ) ) . '</p>' . $html;
	}

	/**
	 * Tek satır.
	 *
	 * @param array<string, mixed> $line Satır modeli.
	 * @return string
	 */
	private static function line( array $line ) {
		$key  = isset( $line['key'] ) ? (string) $line['key'] : '';
		$name = isset( $line['name'] ) ? (string) $line['name'] : '';
		$qty  = isset( $line['quantity'] ) ? max( 1, (int) $line['quantity'] ) : 1;

		$meta = array();
		if ( ! empty( $line['type'] ) ) {
			$meta[] = '<span class="dp-sc__tag">' . esc_html( self::type_label( (string) $line['type'] ) ) . '</span>';
		}
		if ( ! empty( $line['unit_html'] ) ) {
			$meta[] = '<span class="dp-sc__num">' . wp_kses_post( (string) $line['unit_html'] ) . '</span>';
		}
		$details = '';
		if ( ! empty( $line['dedication'] ) ) {
			/* translators: %s: dedication text typed by the donor. */
			$details .= '<small class="dp-sc__detail">' . esc_html( sprintf( __( 'In honour of: %s', 'woo-donation-popup' ), (string) $line['dedication'] ) ) . '</small>';
		}
		if ( ! empty( $line['share_names'] ) && is_array( $line['share_names'] ) ) {
			/* translators: %s: comma separated names of the people the shares are donated on behalf of. */
			$details .= '<small class="dp-sc__detail">' . esc_html( sprintf( __( 'On behalf of: %s', 'woo-donation-popup' ), implode( ', ', array_map( 'strval', $line['share_names'] ) ) ) ) . '</small>';
		}

		$stepper = '';
		if ( ! empty( $line['can_quantity'] ) ) {
			$stepper = '<div class="dp-sc__stepper" role="group" aria-label="' . esc_attr__( 'Quantity', 'woo-donation-popup' ) . '">'
				. '<button type="button" class="dp-sc__step" data-dp-sc-qty="-1" data-dp-sc-key="' . esc_attr( $key ) . '" aria-label="' . esc_attr__( 'Decrease quantity', 'woo-donation-popup' ) . '"' . ( $qty <= 1 ? ' disabled' : '' ) . '><svg class="dp-sc__ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>'
				. '<output class="dp-sc__num" aria-live="polite">' . esc_html( (string) $qty ) . '</output>'
				. '<button type="button" class="dp-sc__step" data-dp-sc-qty="1" data-dp-sc-key="' . esc_attr( $key ) . '" aria-label="' . esc_attr__( 'Increase quantity', 'woo-donation-popup' ) . '"><svg class="dp-sc__ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>';
		}

		$thumb = ! empty( $line['image'] )
			? '<img class="dp-sc__thumb" src="' . esc_url( (string) $line['image'] ) . '" alt="" loading="lazy" width="52" height="52">'
			: '<span class="dp-sc__thumb dp-sc__thumb--ph" aria-hidden="true">' . self::cart_icon() . '</span>';

		return '<li class="dp-sc__row" data-dp-sc-line="' . esc_attr( $key ) . '" data-qty="' . esc_attr( (string) $qty ) . '">' . $thumb
			. '<div class="dp-sc__info"><b class="dp-sc__name">' . esc_html( $name ) . '</b><span class="dp-sc__meta">' . implode( ' ', $meta ) . '</span>' . $details
			. '<div class="dp-sc__actions">' . $stepper
			/* translators: %s: donation name. */
			. '<button type="button" class="dp-sc__remove" data-dp-sc-remove data-dp-sc-key="' . esc_attr( $key ) . '" aria-label="' . esc_attr( sprintf( __( 'Remove %s', 'woo-donation-popup' ), $name ) ) . '">' . esc_html__( 'Remove', 'woo-donation-popup' ) . '</button></div></div>'
			. '<div class="dp-sc__amt dp-sc__num">' . wp_kses_post( (string) ( isset( $line['total_html'] ) ? $line['total_html'] : '' ) ) . '</div></li>';
	}

	/**
	 * Bağış türü için okunur ad (bilinmeyen tür: ilk harfi büyük slug).
	 *
	 * @param string $type Tür.
	 * @return string
	 */
	private static function type_label( $type ) {
		return ucfirst( str_replace( array( '-', '_' ), ' ', $type ) );
	}

	/**
	 * Çekmece kabuğu (sayfada bir kez, `wp_footer`).
	 *
	 * @param string                $body_html  `body()` çıktısı.
	 * @param array<string, string> $attributes Veri öznitelikleri (rest, store, checkout, nonce, mesajlar).
	 * @return string
	 */
	public static function drawer( $body_html, array $attributes ) {
		$data = '';
		foreach ( $attributes as $name => $value ) {
			$data .= ' data-dp-sc-' . sanitize_key( (string) $name ) . '="' . esc_attr( (string) $value ) . '"';
		}
		return '<div class="dp dp-sc" data-dp-sc' . $data . '>'
			. '<div class="dp-sc__overlay" data-dp-sc-overlay>'
			. '<div class="dp-sc__surface" id="' . esc_attr( self::DRAWER_ID ) . '" role="dialog" aria-modal="true" aria-labelledby="' . esc_attr( self::DRAWER_ID ) . '-title" tabindex="-1" data-dp-sc-surface>'
			. '<div class="dp-sc__handle" aria-hidden="true"></div>'
			. '<div class="dp-sc__head"><h2 class="dp-sc__title" id="' . esc_attr( self::DRAWER_ID ) . '-title">' . esc_html__( 'Donation basket', 'woo-donation-popup' ) . '</h2>'
			. '<button type="button" class="dp-sc__close" data-dp-sc-close aria-label="' . esc_attr__( 'Close basket', 'woo-donation-popup' ) . '"><svg class="dp-sc__ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'
			. '<div class="dp-sc__body" data-dp-sc-body aria-live="polite">' . $body_html . '</div>'
			. '</div></div></div>';
	}
}

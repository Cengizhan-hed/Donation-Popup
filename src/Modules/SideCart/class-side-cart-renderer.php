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
		return '<svg class="donation-panel-sc__ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>';
	}

	/**
	 * Sayaç rozeti (WooCommerce parça yenilemesiyle de değişir: `span.donation-panel-sc__count`).
	 *
	 * @param int $count Kalem sayısı.
	 * @return string
	 */
	public static function count_badge( $count ) {
		$count = max( 0, (int) $count );
		return '<span class="donation-panel-sc__count" data-dp-sc-count' . ( $count > 0 ? '' : ' hidden' ) . '>' . esc_html( (string) $count ) . '</span>';
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
		return '<button type="button" class="donation-panel donation-panel-sc__trigger" data-dp-sc-open aria-haspopup="dialog" aria-expanded="false" aria-controls="' . esc_attr( self::DRAWER_ID ) . '">'
			. self::cart_icon() . '<span class="donation-panel-sc__sr">' . esc_html( $label ) . '</span>' . self::count_badge( $count ) . '</button>';
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
	 * Çekmece gövdesi (REST ve ilk çıktıda aynı): satırlar + ek bağış önerisi + sabit alt çubuk ya da boş durum.
	 * Kalem sayısı metni başlıkta (`count_text`) durur.
	 *
	 * @param array<int, array<string, mixed>> $lines         Satırlar (Side_Cart_Lines).
	 * @param string                           $subtotal_html Toplam (WooCommerce).
	 * @param string                           $checkout_url  Ödeme sayfası.
	 * @param array<string, mixed>             $suggestion    Ek bağış önerisi (Side_Cart_Suggestion::current).
	 * @return string
	 */
	public static function body( array $lines, $subtotal_html, $checkout_url, array $suggestion = array() ) {
		if ( empty( $lines ) ) {
			return '<div class="donation-panel-sc__empty"><div class="donation-panel-sc__empty-art">' . self::cart_icon() . '</div><h3>' . esc_html__( 'Your basket is empty', 'woo-donation-popup' ) . '</h3><p>' . esc_html__( 'Add a gift and it will be summarised here.', 'woo-donation-popup' ) . '</p><button type="button" class="dpx-btn dpx-btn--outline" data-dp-sc-close>' . esc_html__( 'Continue giving', 'woo-donation-popup' ) . '</button></div>';
		}

		$html = '<div class="donation-panel-sc__scroll"><ul class="donation-panel-sc__list">';
		foreach ( $lines as $line ) {
			$html .= self::line( $line );
		}
		$html .= '</ul>' . self::suggestion( $suggestion ) . '</div>';
		$html .= '<div class="donation-panel-sc__bar"><div class="donation-panel-sc__subtotal"><span>' . esc_html__( 'Total', 'woo-donation-popup' ) . '</span><strong class="donation-panel-sc__num">' . wp_kses_post( $subtotal_html ) . '</strong></div>'
			. '<a class="dpx-btn dpx-btn--primary" data-dp-sc-go href="' . esc_url( $checkout_url ) . '">' . esc_html__( 'Complete donation', 'woo-donation-popup' ) . '</a>'
			. '<button type="button" class="dpx-btn dpx-btn--link" data-dp-sc-close>' . esc_html__( 'Add another donation', 'woo-donation-popup' ) . '</button>'
			. '<p class="donation-panel-sc__hint">' . esc_html__( 'Payment method and any taxes are shown at checkout.', 'woo-donation-popup' ) . '</p></div>';
		return $html;
	}

	/**
	 * "Bağışınıza eklemek ister misiniz?" kartı: küçük tutar düğmeleri (tek dokunuşla eklenir).
	 *
	 * @param array<string, mixed> $suggestion Öneri (Side_Cart_Suggestion).
	 * @return string
	 */
	private static function suggestion( array $suggestion ) {
		if ( empty( $suggestion['product_id'] ) || empty( $suggestion['amounts'] ) ) {
			return '';
		}
		$buttons = '';
		foreach ( (array) $suggestion['amounts'] as $amount ) {
			$label    = function_exists( 'wc_price' ) ? html_entity_decode( wp_strip_all_tags( (string) wc_price( (float) $amount ) ), ENT_QUOTES, 'UTF-8' ) : (string) $amount;
			$buttons .= '<button type="button" class="dpx-btn dpx-btn--outline donation-panel-sc__suggest-btn" data-dp-sc-suggest data-product="' . esc_attr( (string) (int) $suggestion['product_id'] ) . '" data-amount="' . esc_attr( (string) $amount ) . '" aria-label="' . esc_attr( sprintf( /* translators: 1: suggested donation name, 2: amount with currency. */ __( 'Add %1$s %2$s to your basket', 'woo-donation-popup' ), (string) $suggestion['title'], $label ) ) . '">+ ' . esc_html( $label ) . '</button>';
		}
		$hint = '' !== (string) $suggestion['hint'] ? '<span class="donation-panel-sc__suggest-hint">' . esc_html( (string) $suggestion['hint'] ) . '</span>' : '';
		return '<section class="donation-panel-sc__suggest" aria-labelledby="dp-sc-suggest-title"><b class="donation-panel-sc__suggest-title" id="dp-sc-suggest-title">' . esc_html__( 'Would you like to add to your donation?', 'woo-donation-popup' ) . '</b>'
			. '<div class="donation-panel-sc__suggest-row"><span class="donation-panel-sc__suggest-text"><span class="donation-panel-sc__suggest-name">' . esc_html( (string) $suggestion['title'] ) . '</span>' . $hint . '</span>'
			. '<span class="donation-panel-sc__suggest-actions">' . $buttons . '</span></div></section>';
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

		$meta       = array();
		$type_label = ! empty( $line['type'] ) ? self::type_label( (string) $line['type'] ) : '';
		if ( '' !== $type_label ) {
			$meta[] = '<span class="donation-panel-sc__tag">' . esc_html( $type_label ) . '</span>';
		}
		if ( ! empty( $line['unit_html'] ) ) {
			$meta[] = '<span class="donation-panel-sc__num">' . wp_kses_post( (string) $line['unit_html'] ) . '</span>';
		}
		$details = '';
		if ( ! empty( $line['dedication'] ) ) {
			/* translators: %s: dedication text typed by the donor. */
			$details .= '<small class="donation-panel-sc__detail">' . esc_html( sprintf( __( 'In honour of: %s', 'woo-donation-popup' ), (string) $line['dedication'] ) ) . '</small>';
		}
		if ( ! empty( $line['share_names'] ) && is_array( $line['share_names'] ) ) {
			/* translators: %s: comma separated names of the people the shares are donated on behalf of. */
			$details .= '<small class="donation-panel-sc__detail">' . esc_html( sprintf( __( 'On behalf of: %s', 'woo-donation-popup' ), implode( ', ', array_map( 'strval', $line['share_names'] ) ) ) ) . '</small>';
		}

		$stepper = '';
		if ( ! empty( $line['can_quantity'] ) ) {
			$stepper = '<div class="donation-panel-sc__stepper" role="group" aria-label="' . esc_attr__( 'Quantity', 'woo-donation-popup' ) . '">'
				. '<button type="button" class="donation-panel-sc__step" data-dp-sc-qty="-1" data-dp-sc-key="' . esc_attr( $key ) . '" aria-label="' . esc_attr__( 'Decrease quantity', 'woo-donation-popup' ) . '"' . ( $qty <= 1 ? ' disabled' : '' ) . '><svg class="donation-panel-sc__ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>'
				. '<output class="donation-panel-sc__num" aria-live="polite">' . esc_html( (string) $qty ) . '</output>'
				. '<button type="button" class="donation-panel-sc__step" data-dp-sc-qty="1" data-dp-sc-key="' . esc_attr( $key ) . '" aria-label="' . esc_attr__( 'Increase quantity', 'woo-donation-popup' ) . '"><svg class="donation-panel-sc__ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>';
		}

		$thumb = ! empty( $line['image'] )
			? '<img class="donation-panel-sc__thumb" src="' . esc_url( (string) $line['image'] ) . '" alt="" loading="lazy" width="56" height="56">'
			: '<span class="donation-panel-sc__thumb donation-panel-sc__thumb--ph" aria-hidden="true">' . self::cart_icon() . '</span>';

		return '<li class="donation-panel-sc__row" data-dp-sc-line="' . esc_attr( $key ) . '" data-qty="' . esc_attr( (string) $qty ) . '">' . $thumb
			. '<div class="donation-panel-sc__info"><b class="donation-panel-sc__name">' . esc_html( $name ) . '</b><span class="donation-panel-sc__meta">' . implode( ' ', $meta ) . '</span>' . $details
			. '<div class="donation-panel-sc__actions">' . $stepper
			/* translators: %s: donation name. */
			. '<button type="button" class="donation-panel-sc__remove" data-dp-sc-remove data-dp-sc-key="' . esc_attr( $key ) . '" aria-label="' . esc_attr( sprintf( __( 'Remove %s', 'woo-donation-popup' ), $name ) ) . '">' . esc_html__( 'Remove', 'woo-donation-popup' ) . '</button></div></div>'
			. '<div class="donation-panel-sc__amt donation-panel-sc__num">' . wp_kses_post( (string) ( isset( $line['total_html'] ) ? $line['total_html'] : '' ) ) . '</div></li>';
	}

	/**
	 * Bağış türü için çevrilmiş ad (Donation_Type tanımlarından). Bilinmeyen tür: '' (12.3 denetimi: ham, çevrilmemiş
	 * slug — ör. "General" — bağışçıya gösterilmez).
	 *
	 * @param string $type Tür.
	 * @return string
	 */
	public static function type_label( $type ) {
		$defs = \DonationPanel\Domain\Donation_Type::get_definitions();
		return isset( $defs[ $type ]['label'] ) ? (string) $defs[ $type ]['label'] : '';
	}

	/**
	 * Yüzen sepet düğmesi (alt köşede; sepet boşken `hidden`, görünürlüğü istemci Woo sepet çerezinden belirler).
	 *
	 * @param int    $count    Kalem sayısı.
	 * @param string $position 'end' (sağ alt; RTL'de sol) ya da 'start' (sol alt; RTL'de sağ).
	 * @return string
	 */
	public static function floating_button( $count, $position = 'end' ) {
		$class = 'start' === $position ? 'donation-panel-sc__fab donation-panel-sc__fab--start' : 'donation-panel-sc__fab';
		return '<button type="button" class="' . esc_attr( $class ) . '" data-dp-sc-fab hidden aria-haspopup="dialog" aria-expanded="false" aria-controls="' . esc_attr( self::DRAWER_ID ) . '">'
			. self::cart_icon() . '<span class="donation-panel-sc__sr">' . esc_html__( 'Donation basket', 'woo-donation-popup' ) . '</span>' . self::count_badge( $count ) . '</button>';
	}

	/**
	 * Çekmece kabuğu (sayfada bir kez, `wp_footer`): HTML <dialog> (üst katman).
	 *
	 * @param string                $body_html  `body()` çıktısı.
	 * @param array<string, string> $attributes Veri öznitelikleri (rest, store, checkout, nonce, mesajlar).
	 * @param string                $sub        Başlık altı kalem sayısı metni.
	 * @param string                $floating   Yüzen düğme HTML'i (boşsa yok).
	 * @return string
	 */
	public static function drawer( $body_html, array $attributes, $sub = '', $floating = '' ) {
		$data = '';
		foreach ( $attributes as $name => $value ) {
			$data .= ' data-dp-sc-' . sanitize_key( (string) $name ) . '="' . esc_attr( (string) $value ) . '"';
		}
		return '<div class="donation-panel donation-panel-sc" data-dp-sc' . $data . '>'
			. $floating
			. '<dialog class="donation-panel-sc__overlay" id="' . esc_attr( self::DRAWER_ID ) . '" role="dialog" aria-modal="true" aria-labelledby="' . esc_attr( self::DRAWER_ID ) . '-title" data-dp-sc-overlay>'
			. '<div class="donation-panel-sc__surface" tabindex="-1" data-dp-sc-surface>'
			. '<div class="donation-panel-sc__handle" aria-hidden="true"></div>'
			. '<div class="donation-panel-sc__head"><div class="donation-panel-sc__headtext"><h2 class="donation-panel-sc__title" id="' . esc_attr( self::DRAWER_ID ) . '-title">' . esc_html__( 'Your donation basket', 'woo-donation-popup' ) . '</h2>'
			. '<span class="donation-panel-sc__sub" data-dp-sc-sub>' . esc_html( $sub ) . '</span></div>'
			. '<button type="button" class="donation-panel-sc__close" data-dp-sc-close aria-label="' . esc_attr__( 'Close basket', 'woo-donation-popup' ) . '"><svg class="donation-panel-sc__ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'
			. '<div class="donation-panel-sc__body" data-dp-sc-body aria-live="polite">' . $body_html . '</div>'
			. '</div></dialog></div>';
	}
}

<?php
/**
 * Yönetici ekranları için çıktı yardımcıları (sayfa kabuğu, kart, satır, anahtar, alan). Tüm çıktı kaçışlıdır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Admin_View.
 */
final class Admin_View {

	/**
	 * Sayfa kabuğunu açar: başlık, alt başlık, Rehber düğmesi.
	 *
	 * @param string $slug     Sayfa slug'ı (kök kimliği için).
	 * @param string $title    Başlık.
	 * @param string $subtitle Alt başlık.
	 * @param bool   $guide    Rehber düğmesi gösterilsin mi.
	 * @return string
	 */
	public static function open( $slug, $title, $subtitle, $guide = true ) {
		$html  = '<div class="wrap dpa" id="dpa-' . esc_attr( $slug ) . '" data-dpa-page="' . esc_attr( $slug ) . '">';
		$html .= '<header class="dpa-head"><div><h1 class="dpa-title">' . esc_html( $title ) . '</h1><p class="dpa-sub">' . esc_html( $subtitle ) . '</p></div>';
		if ( $guide ) {
			$html .= '<a class="dpa-btn dpa-btn--ghost" href="' . esc_url( self::url( Admin_Bootstrap::SLUG_GUIDE ) ) . '">' . self::icon( 'help' ) . esc_html__( 'Guide', 'woo-donation-popup' ) . '</a>';
		}
		$html .= '</header><hr class="wp-header-end">';
		return $html . '<div class="dpa-notices" data-dpa-notices role="status" aria-live="polite"></div>';
	}

	/**
	 * Sayfa kabuğunu kapatır.
	 *
	 * @return string
	 */
	public static function close() {
		return '</div>';
	}

	/**
	 * Kart.
	 *
	 * @param string $title Başlık ('' = başlıksız).
	 * @param string $body  Hazır HTML.
	 * @param string $extra_class Ek sınıf.
	 * @param string $intro Başlık altı kısa açıklama.
	 * @return string
	 */
	public static function card( $title, $body, $extra_class = '', $intro = '' ) {
		$head = '' !== $title ? '<h2 class="dpa-card__title">' . esc_html( $title ) . '</h2>' : '';
		$note = '' !== $intro ? '<p class="dpa-card__intro">' . esc_html( $intro ) . '</p>' : '';
		return '<section class="dpa-card ' . esc_attr( $extra_class ) . '">' . $head . $note . $body . '</section>';
	}

	/**
	 * Satır içi SVG ikon (dekoratif).
	 *
	 * @param string $name check|alert|help|heart.
	 * @return string
	 */
	public static function icon( $name ) {
		$paths = array(
			'check' => '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
			'alert' => '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5h.01"/>',
			'help'  => '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>',
			'heart' => '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
		);
		$path  = isset( $paths[ $name ] ) ? $paths[ $name ] : '';
		return '<svg class="dpa-icon dpa-icon--' . esc_attr( $name ) . '" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' . $path . '</svg>';
	}

	/**
	 * Modül satırı: başlık + altında kısa açıklama + sağda anahtar. Anahtar değişince kendiliğinden kaydedilir.
	 *
	 * @param string $slug    Modül.
	 * @param string $label   Ad.
	 * @param string $help    Açıklama.
	 * @param bool   $enabled Açık mı.
	 * @return string
	 */
	public static function module_row( $slug, $label, $help, $enabled ) {
		$id = 'dpa-mod-' . $slug;
		return '<label class="dpa-mod" for="' . esc_attr( $id ) . '"><span class="dpa-mod__text"><span class="dpa-mod__label">' . esc_html( $label ) . '</span><span class="dpa-mod__help" id="' . esc_attr( $id ) . '-desc">' . esc_html( $help ) . '</span></span>'
			. '<span class="dpa-switch"><input type="checkbox" role="switch" value="1" id="' . esc_attr( $id ) . '" aria-describedby="' . esc_attr( $id ) . '-desc" data-dpa-module="' . esc_attr( $slug ) . '"' . ( $enabled ? ' checked' : '' ) . '><span class="dpa-switch__track" aria-hidden="true"></span></span></label>';
	}

	/**
	 * Açıklamalı ayar satırı: başlık + altında kısa açıklama + denetim.
	 *
	 * @param string $label      Başlık.
	 * @param string $help       Kısa açıklama.
	 * @param string $control    Hazır (kaçışlı) denetim HTML'i.
	 * @param string $control_id `for` hedefi ('' = etiket bağlanmaz).
	 * @return string
	 */
	public static function row( $label, $help, $control, $control_id = '' ) {
		$desc_id = '' !== $control_id ? $control_id . '-desc' : '';
		$title   = '' !== $control_id
			? '<label for="' . esc_attr( $control_id ) . '">' . esc_html( $label ) . '</label>'
			: '<span class="dpa-row__label">' . esc_html( $label ) . '</span>';
		$help_el = '' !== $help
			? '<p class="dpa-row__help"' . ( '' !== $desc_id ? ' id="' . esc_attr( $desc_id ) . '"' : '' ) . '>' . esc_html( $help ) . '</p>'
			: '';
		return '<div class="dpa-row"><div class="dpa-row__text">' . $title . $help_el . '</div><div class="dpa-row__control">' . $control . '</div></div>';
	}

	/**
	 * Kayıtlı bir alanı çizer (tip alan kaydından gelir).
	 *
	 * @param string               $id    Alan kimliği.
	 * @param array<string, mixed> $spec  Alan tanımı.
	 * @param mixed                $value Geçerli değer.
	 * @return string
	 */
	public static function field( $id, array $spec, $value ) {
		$dom  = 'dpa-f-' . str_replace( '.', '-', $id );
		$av   = ' data-dpa-field="' . esc_attr( $id ) . '"';
		$desc = ' aria-describedby="' . esc_attr( $dom ) . '-desc"';
		switch ( $spec['type'] ) {
			case 'switch':
				$control = '<span class="dpa-switch"><input type="checkbox" role="switch" value="1" id="' . esc_attr( $dom ) . '"' . $desc . $av . ( $value ? ' checked' : '' ) . '><span class="dpa-switch__track" aria-hidden="true"></span></span>';
				break;
			case 'select':
				$control = '<select class="dpa-input" id="' . esc_attr( $dom ) . '"' . $desc . $av . '>';
				foreach ( $spec['options'] as $key => $label ) {
					$control .= '<option value="' . esc_attr( (string) $key ) . '"' . selected( (string) $value, (string) $key, false ) . '>' . esc_html( $label ) . '</option>';
				}
				$control .= '</select>';
				break;
			case 'textarea':
				$control = '<textarea class="dpa-input" rows="4" id="' . esc_attr( $dom ) . '"' . $desc . $av . '>' . esc_textarea( (string) $value ) . '</textarea>';
				break;
			case 'color':
				$control = '<input type="color" class="dpa-color" id="' . esc_attr( $dom ) . '"' . $desc . ' value="' . esc_attr( '' !== (string) $value ? (string) $value : '#12305a' ) . '"' . $av . ( '' === (string) $value ? ' data-dpa-empty="1"' : '' ) . '>';
				break;
			case 'int':
				$control = '<input type="number" min="0" step="1" class="dpa-input dpa-input--short" id="' . esc_attr( $dom ) . '"' . $desc . ' value="' . esc_attr( (string) (int) $value ) . '"' . $av . '>';
				break;
			case 'url':
				$control = '<input type="url" class="dpa-input" id="' . esc_attr( $dom ) . '"' . $desc . ' value="' . esc_attr( (string) $value ) . '"' . $av . '>';
				break;
			default:
				$control = '<input type="text" class="dpa-input" id="' . esc_attr( $dom ) . '"' . $desc . ' value="' . esc_attr( (string) $value ) . '"' . $av . '>';
		}
		return self::row( $spec['label'], $spec['help'], $control, $dom );
	}

	/**
	 * Seçim kartları (tasarım: üç kartlı ızgara; gerçek radyo düğmeleri).
	 *
	 * @param string                            $id      Alan kimliği.
	 * @param array<string, array<int, string>> $options değer => [ başlık, açıklama ].
	 * @param string                            $current Seçili.
	 * @param string                            $legend  Grup adı.
	 * @return string
	 */
	public static function cards( $id, array $options, $current, $legend ) {
		$html = '<fieldset class="dpa-cards"><legend class="screen-reader-text">' . esc_html( $legend ) . '</legend>';
		foreach ( $options as $value => $def ) {
			$dom   = 'dpa-c-' . str_replace( '.', '-', $id ) . '-' . $value;
			$html .= '<label class="dpa-choice dpa-choice--' . esc_attr( (string) $value ) . '" for="' . esc_attr( $dom ) . '"><input type="radio" class="dpa-choice__input" name="' . esc_attr( $id ) . '" id="' . esc_attr( $dom ) . '" value="' . esc_attr( (string) $value ) . '" data-dpa-field="' . esc_attr( $id ) . '"' . checked( $current, (string) $value, false ) . '>'
				. '<span class="dpa-choice__art" aria-hidden="true"><i></i></span><span class="dpa-choice__title">' . esc_html( $def[0] ) . '</span><span class="dpa-choice__help">' . esc_html( $def[1] ) . '</span></label>';
		}
		return $html . '</fieldset>';
	}

	/**
	 * Durum satırı (tamam ya da uyarı + isteğe bağlı bağlantı).
	 *
	 * @param bool   $ok   Tamam mı.
	 * @param string $text Metin.
	 * @param string $url  Bağlantı.
	 * @param string $link Bağlantı metni.
	 * @return string
	 */
	public static function status_row( $ok, $text, $url = '', $link = '' ) {
		$tail   = ( ! $ok && '' !== $url && '' !== $link ) ? ' <span aria-hidden="true">&middot;</span> <a href="' . esc_url( $url ) . '">' . esc_html( $link ) . '</a>' : '';
		$prefix = $ok ? __( 'OK:', 'woo-donation-popup' ) : __( 'Needs attention:', 'woo-donation-popup' );
		return '<li class="dpa-status dpa-status--' . ( $ok ? 'ok' : 'warn' ) . '">' . self::icon( $ok ? 'check' : 'alert' ) . '<span><span class="screen-reader-text">' . esc_html( $prefix ) . ' </span>' . esc_html( $text ) . $tail . '</span></li>';
	}

	/**
	 * Kaydetme çubuğu (REST ile kaydeder; durum iletisi canlı bölge).
	 *
	 * @return string
	 */
	public static function savebar() {
		return '<div class="dpa-savebar"><span class="dpa-savebar__msg" data-dpa-msg role="status" aria-live="polite" data-unsaved="' . esc_attr__( 'You have unsaved changes', 'woo-donation-popup' ) . '" data-saved="' . esc_attr__( 'Saved', 'woo-donation-popup' ) . '"></span>'
			. '<button type="button" class="dpa-btn dpa-btn--primary" data-dpa-save>' . esc_html__( 'Save changes', 'woo-donation-popup' ) . '</button></div>';
	}

	/**
	 * Durum rozeti.
	 *
	 * @param string $text Metin.
	 * @param string $tone info|success|neutral|warn.
	 * @return string
	 */
	public static function badge( $text, $tone = 'neutral' ) {
		return '<span class="dpa-badge dpa-badge--' . esc_attr( sanitize_html_class( $tone ) ) . '">' . esc_html( $text ) . '</span>';
	}

	/**
	 * Kopyalanabilir kod bloğu (düğme betikle çalışır; betiksiz de metin seçilebilir).
	 *
	 * @param string $code Kod.
	 * @return string
	 */
	public static function code( $code ) {
		return '<div class="dpa-code"><code>' . esc_html( $code ) . '</code><button type="button" class="dpa-btn dpa-btn--small dpa-copy" data-dpa-copy="' . esc_attr( $code ) . '">' . esc_html__( 'Copy', 'woo-donation-popup' ) . '</button></div>';
	}

	/**
	 * Yönetici ekran adresi.
	 *
	 * @param string                $slug Sayfa.
	 * @param array<string, string> $args Ek sorgu parametreleri.
	 * @return string
	 */
	public static function url( $slug, array $args = array() ) {
		return add_query_arg( array_merge( array( 'page' => $slug ), $args ), admin_url( 'admin.php' ) );
	}
}

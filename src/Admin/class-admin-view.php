<?php
/**
 * Yönetici ekranları için küçük çıktı yardımcıları (satır, anahtar, rozet). Tüm çıktı kaçışlıdır.
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
	 * Açıklamalı ayar satırı: başlık + altında kısa açıklama + denetim.
	 *
	 * @param string $label     Başlık.
	 * @param string $help      Kısa açıklama.
	 * @param string $control   Hazır (kaçışlı) denetim HTML'i.
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
	 * Aç/kapa anahtarı (gerçek onay kutusu; klavye + ekran okuyucu uyumlu).
	 *
	 * @param string $name    Alan adı.
	 * @param string $id      Alan kimliği.
	 * @param bool   $checked Açık mı.
	 * @param string $slug    Önizleme bağı (isteğe bağlı).
	 * @return string
	 */
	public static function switch_control( $name, $id, $checked, $slug = '' ) {
		return '<span class="dpa-switch"><input type="checkbox" role="switch" value="1" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '" aria-describedby="' . esc_attr( $id ) . '-desc"'
			. ( '' !== $slug ? ' data-dpa-module="' . esc_attr( $slug ) . '"' : '' )
			. ( $checked ? ' checked' : '' ) . '><span class="dpa-switch__track" aria-hidden="true"></span></span>';
	}

	/**
	 * Açılır liste.
	 *
	 * @param string                $name    Alan adı.
	 * @param string                $id      Alan kimliği.
	 * @param array<string, string> $options değer => etiket.
	 * @param string                $current Seçili değer.
	 * @return string
	 */
	public static function select( $name, $id, array $options, $current ) {
		$html = '<select class="dpa-input" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '" aria-describedby="' . esc_attr( $id ) . '-desc">';
		foreach ( $options as $value => $label ) {
			$html .= '<option value="' . esc_attr( (string) $value ) . '"' . selected( $current, (string) $value, false ) . '>' . esc_html( $label ) . '</option>';
		}
		return $html . '</select>';
	}

	/**
	 * Metin alanı.
	 *
	 * @param string $name  Alan adı.
	 * @param string $id    Alan kimliği.
	 * @param string $value Değer.
	 * @return string
	 */
	public static function text( $name, $id, $value ) {
		return '<input type="text" class="dpa-input" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '" value="' . esc_attr( $value ) . '" aria-describedby="' . esc_attr( $id ) . '-desc">';
	}

	/**
	 * Çok satırlı alan.
	 *
	 * @param string $name  Alan adı.
	 * @param string $id    Alan kimliği.
	 * @param string $value Değer.
	 * @param int    $rows  Satır sayısı.
	 * @return string
	 */
	public static function textarea( $name, $id, $value, $rows = 4 ) {
		return '<textarea class="dpa-input" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '" rows="' . (int) $rows . '" aria-describedby="' . esc_attr( $id ) . '-desc">' . esc_textarea( $value ) . '</textarea>';
	}

	/**
	 * Durum rozeti.
	 *
	 * @param string $text Metin.
	 * @param string $tone info|success|neutral.
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
		return '<div class="dpa-code"><code>' . esc_html( $code ) . '</code><button type="button" class="button dpa-copy" data-dpa-copy="' . esc_attr( $code ) . '">' . esc_html__( 'Copy', 'woo-donation-popup' ) . '</button></div>';
	}

	/**
	 * Yönetici ekran adresi.
	 *
	 * @param string $slug Sayfa.
	 * @param array<string, string> $args Ek sorgu parametreleri.
	 * @return string
	 */
	public static function url( $slug, array $args = array() ) {
		return add_query_arg( array_merge( array( 'page' => $slug ), $args ), admin_url( 'admin.php' ) );
	}
}

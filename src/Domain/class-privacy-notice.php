<?php
/**
 * Form altındaki kısa gizlilik bağlantısı: metin sitede (WordPress gizlilik sayfası); eklenti yalnız bağlantıyı gösterir.
 *
 * Ayar (`wdp_button_settings`): `enable_privacy_notice`, `privacy_notice_text`, `privacy_notice_url`.
 * Adres boşsa WordPress'in atadığı gizlilik politikası sayfası kullanılır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * Privacy_Notice.
 */
final class Privacy_Notice {

	/**
	 * Geçerli form için bildirimi çözer.
	 *
	 * @param array<string, bool> $options `has_email`, `has_dedication`, `has_shareholders` (kişisel veri toplayan alan var mı).
	 * @return array{show: bool, text: string, url: string, link_label: string}|null Gösterilmeyecekse null.
	 */
	public static function resolve( array $options = array() ) {
		$button = Button_Settings::get();
		if ( empty( $button['enable_privacy_notice'] ) || '1' !== (string) $button['enable_privacy_notice'] ) {
			return null;
		}
		$eligible = ! empty( $options['has_email'] ) || ! empty( $options['has_dedication'] ) || ! empty( $options['has_shareholders'] );
		if ( ! $eligible ) {
			return null;
		}

		$label = isset( $button['privacy_notice_text'] ) && '' !== trim( (string) $button['privacy_notice_text'] )
			? trim( (string) $button['privacy_notice_text'] )
			: self::default_link_label();

		$url = isset( $button['privacy_notice_url'] ) ? trim( (string) $button['privacy_notice_url'] ) : '';
		if ( '' === $url && function_exists( 'get_privacy_policy_url' ) ) {
			$url = (string) get_privacy_policy_url();
		}
		$url = '' !== $url ? esc_url_raw( $url ) : '';

		return array(
			'show'       => true,
			'text'       => $label,
			'url'        => $url,
			'link_label' => $label,
		);
	}

	/**
	 * Varsayılan kısa bağlantı metni (uzun metin yok; KVKK sayfası sitenindir).
	 *
	 * @return string
	 */
	public static function default_link_label() {
		return __( 'Privacy notice on the processing of personal data', 'woo-donation-popup' );
	}

	/**
	 * Gizlilik satırının güvenli HTML'i (gizliyse ya da adres yoksa boş).
	 *
	 * @param array<string, bool> $options Bkz. resolve().
	 * @return string
	 */
	public static function render_html( array $options = array() ) {
		$notice = self::resolve( $options );
		if ( ! $notice || empty( $notice['show'] ) || empty( $notice['url'] ) ) {
			return '';
		}
		return '<p class="dp-privacy-notice"><a href="' . esc_url( $notice['url'] ) . '" target="_blank" rel="noopener">' . esc_html( $notice['link_label'] ) . '</a></p>';
	}
}

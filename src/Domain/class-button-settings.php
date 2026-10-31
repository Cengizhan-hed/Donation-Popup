<?php
/**
 * Düğme ayarları (`wdp_button_settings` seçeneği): okuma ve eski anahtarları yeni şemaya taşıyarak normalleştirme.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * Button_Settings.
 */
final class Button_Settings {

	/**
	 * Seçenek adı (veri sözleşmesi; değişmez).
	 */
	const OPTION = 'wdp_button_settings';

	/**
	 * Normalleştirilmiş düğme ayarları.
	 *
	 * @return array<string, mixed>
	 */
	public static function get() {
		return self::normalize_legacy_popup_button_text( get_option( self::OPTION, array() ) );
	}

	/**
	 * Eski kurulumlar: yalnız `button_text_donate` kayıtlıysa popup düğme metnine yansıtır.
	 *
	 * @param mixed $settings `get_option( 'wdp_button_settings' )` ham değeri (bozuk kayıtta dizi olmayabilir).
	 * @return array<string, mixed>
	 */
	public static function normalize_legacy_popup_button_text( $settings ) {
		if ( ! is_array( $settings ) ) {
			$settings = array();
		}
		if ( ! array_key_exists( 'popup_button_text', $settings ) && ! empty( $settings['button_text_donate'] ) ) {
			$settings['popup_button_text'] = $settings['button_text_donate'];
		}
		return $settings;
	}
}

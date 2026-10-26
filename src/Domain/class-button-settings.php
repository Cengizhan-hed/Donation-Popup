<?php
/**
 * Düğme ayarları (`wdp_button_settings`) okuma ve normalleştirme.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Button_Settings
 */
class Button_Settings {

/**
	 * Eski kurulumlar: sadece button_text_donate kayıtlıysa popup buton metnine yansıtır.
	 *
	 * @param mixed $settings get_option('wdp_button_settings') ham değeri (bozuk kayıtta dizi olmayabilir).
	 * @return array
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

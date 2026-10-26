<?php
/**
 * Giriş noktalarının (kısa kod, blok, otomatik yerleşim) form deneyimini çizdiği tek köprü.
 *
 * Çıktıyı `experiences` modülü üretir (`[donation_panel_experience]` ile aynı yol); modül kapalıysa ya da
 * ürün bulunamazsa boş döner. `donation_panel_experience_html` süzgeci çıktıyı değiştirmeye/üretmeye izin verir.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Plugin;
use DonationPanel\Modules\Experiences\Experiences_Module;

defined( 'ABSPATH' ) || exit;

/**
 * Experience_Renderer.
 */
final class Experience_Renderer {

	/**
	 * Deneyimi çizer.
	 *
	 * @param int    $product_id   Ürün kimliği.
	 * @param string $kind         popup | side_panel | inline | bottom_sheet.
	 * @param string $button_text  Düğme metni ('' = genel ayar).
	 * @param string $extra_class  Sarmalayıcıya eklenecek ek sınıf listesi ('' = yok).
	 * @return string HTML ('' = çizilemedi).
	 */
	public static function render( $product_id, $kind, $button_text = '', $extra_class = '' ) {
		$product_id = absint( $product_id );
		if ( $product_id <= 0 ) {
			return '';
		}

		/**
		 * Giriş noktası çıktısını üretir ya da değiştirir (null = eklentinin kendi deneyimi çizilir).
		 *
		 * @param string|null $html        Hazır HTML ya da null.
		 * @param int         $product_id  Ürün kimliği.
		 * @param string      $kind        Kap türü.
		 * @param string      $button_text Düğme metni.
		 */
		$html = apply_filters( 'donation_panel_experience_html', null, $product_id, (string) $kind, (string) $button_text );
		if ( null === $html ) {
			$html = self::module_html( $product_id, (string) $kind, (string) $button_text );
		}
		$html = is_string( $html ) ? $html : '';

		if ( '' !== $html && '' !== $extra_class ) {
			$html = '<div class="dp-entry ' . esc_attr( $extra_class ) . '">' . $html . '</div>';
		}
		return $html;
	}

	/**
	 * `experiences` modülünden çıktı alır.
	 *
	 * @param int    $product_id  Ürün kimliği.
	 * @param string $kind        Kap türü.
	 * @param string $button_text Düğme metni.
	 * @return string
	 */
	private static function module_html( $product_id, $kind, $button_text ) {
		$plugin = Plugin::instance();
		if ( null === $plugin ) {
			return '';
		}
		$module = $plugin->container()->get( Module_Registry::class )->get( Experiences_Module::SLUG );
		if ( ! $module instanceof Experiences_Module ) {
			return '';
		}
		return $module->shortcode(
			array(
				'id'          => $product_id,
				'kind'        => $kind,
				'button_text' => $button_text,
			)
		);
	}
}

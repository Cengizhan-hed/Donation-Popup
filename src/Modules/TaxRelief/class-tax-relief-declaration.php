<?php
/**
 * Vergi indirimi beyanı: metin, özet (hash) ve sipariş meta yapısı (saf mantık).
 *
 * Ülke/ad varsayımı yoktur: metinler ayardan gelir, boşsa genel ve çevrilebilir varsayılan kullanılır.
 * Bağışçının yazdığı hiçbir alan burada silinmez/maskelenmez; yalnız "beyan edildi" bayrağı ve
 * beyan metninin hash'i sipariş kaydına yazılır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\TaxRelief;

defined( 'ABSPATH' ) || exit;

/**
 * Tax_Relief_Declaration.
 */
final class Tax_Relief_Declaration {

	/**
	 * Ek adımın kimliği.
	 */
	const STEP_ID = 'tax_relief';

	/**
	 * Form/REST alan adı (onay kutusu).
	 */
	const FIELD = 'donation_tax_relief';

	/**
	 * Sepet öğesi anahtarı.
	 */
	const CART_KEY = 'donation_panel_tax_relief';

	/**
	 * Sipariş meta: beyan edildi.
	 */
	const META_DECLARED = '_wdp_tax_relief_declared';

	/**
	 * Sipariş meta: beyan metninin SHA-256 özeti.
	 */
	const META_HASH = '_wdp_tax_relief_text_hash';

	/**
	 * Gösterilecek metinler: ayar doluysa o, değilse genel çevrilebilir varsayılan.
	 *
	 * @param array<string, mixed> $settings `tax_relief` ayar grubu.
	 * @return array{step_label: string, title: string, text: string, checkbox_label: string}
	 */
	public static function texts( array $settings ) {
		$pick = static function ( $key, $fallback ) use ( $settings ) {
			$value = isset( $settings[ $key ] ) && is_scalar( $settings[ $key ] ) ? trim( (string) $settings[ $key ] ) : '';
			return '' !== $value ? $value : $fallback;
		};

		$texts = array(
			'step_label'     => $pick( 'step_label', __( 'Tax relief', 'woo-donation-popup' ) ),
			'title'          => $pick( 'title', __( 'Tax relief declaration', 'woo-donation-popup' ) ),
			'text'           => $pick( 'text', __( 'I confirm that I am eligible, and ask that this donation be treated as eligible for tax relief where my tax authority allows it.', 'woo-donation-popup' ) ),
			'checkbox_label' => $pick( 'checkbox_label', __( 'Yes, I make this declaration', 'woo-donation-popup' ) ),
		);

		/**
		 * Vergi indirimi beyanı metinlerini değiştirir.
		 *
		 * @param array<string, string> $texts `step_label`, `title`, `text`, `checkbox_label`.
		 */
		$filtered = (array) apply_filters( 'donation_panel_tax_relief_texts', $texts );
		foreach ( $texts as $key => $default_value ) {
			$texts[ $key ] = isset( $filtered[ $key ] ) && is_scalar( $filtered[ $key ] ) && '' !== trim( (string) $filtered[ $key ] )
				? (string) $filtered[ $key ]
				: $default_value;
		}
		return $texts;
	}

	/**
	 * Beyan metninin özeti (boşluklar tek aralığa indirilir; hangi söz üzerine beyan verildiğinin kanıtı).
	 *
	 * @param string $text Beyan metni.
	 * @return string 64 karakterlik SHA-256 özeti.
	 */
	public static function hash( $text ) {
		$normalized = preg_replace( '/\s+/u', ' ', trim( (string) $text ) );
		return hash( 'sha256', (string) $normalized );
	}

	/**
	 * Ham istek değeri onay anlamına geliyor mu (yalnız açık onay; varsayılan beyan yok).
	 *
	 * @param mixed $raw Ham değer.
	 * @return bool
	 */
	public static function is_ticked( $raw ) {
		return in_array( $raw, array( true, 1, '1', 'yes', 'true', 'on' ), true );
	}

	/**
	 * Sepet öğesinden sipariş meta listesi; beyan yoksa boş.
	 *
	 * @param array<string, mixed> $cart_item Sepet öğesi.
	 * @param string               $text      Geçerli beyan metni.
	 * @return array<string, string>
	 */
	public static function order_meta( array $cart_item, $text ) {
		if ( empty( $cart_item[ self::CART_KEY ] ) ) {
			return array();
		}
		return array(
			self::META_DECLARED => 'yes',
			self::META_HASH     => self::hash( $text ),
		);
	}
}

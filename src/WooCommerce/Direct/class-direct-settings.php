<?php
/**
 * Doğrudan (sepetsiz) bağış ayarı: ürün meta `_donation_panel_direct` (yes | no | '' = genel ayar) + genel varsayılan
 * `direct.enabled` (Ayarlar > Formlar). Açıkken bağış sepete eklenmez; gönderim sipariş (pending) üretir ve ödeme
 * WooCommerce'in standart order-pay uç noktasında yapılır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce\Direct;

use DonationPanel\Core\Settings;
use DonationPanel\Domain\Product_Meta;

defined( 'ABSPATH' ) || exit;

/**
 * Direct_Settings.
 */
final class Direct_Settings {

	/** Ürün meta anahtarı (sözleşme; değişmez). */
	const META = '_donation_panel_direct';

	/**
	 * Bu ürün için doğrudan bağış açık mı?
	 *
	 * @param object|null $product \WC_Product.
	 * @return bool
	 */
	public static function enabled_for( $product ) {
		if ( ! is_object( $product ) ) {
			return false;
		}
		$value = strtolower( trim( (string) Product_Meta::get( $product, self::META ) ) );
		if ( 'yes' === $value ) {
			$enabled = true;
		} elseif ( 'no' === $value ) {
			$enabled = false;
		} else {
			$enabled = self::global_default();
		}

		/**
		 * Doğrudan (sepetsiz) bağışı ürün bazında açar/kapatır.
		 *
		 * @param bool   $enabled Açık mı.
		 * @param object $product Ürün.
		 */
		return (bool) apply_filters( 'donation_panel_direct_enabled', $enabled, $product );
	}

	/**
	 * Genel varsayılan (`direct.enabled`; varsayılan kapalı).
	 *
	 * @return bool
	 */
	public static function global_default() {
		return (bool) ( new Settings() )->get( 'direct.enabled', false );
	}
}

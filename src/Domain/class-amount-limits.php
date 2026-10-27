<?php
/**
 * Tek bağış tutarı üst sınırı (doğrulayıcı ve sepet fiyat çözücü aynı kaynağı kullanır).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * Amount_Limits.
 */
final class Amount_Limits {

	/** Varsayılan üst sınır (yazılan birimde, tek bağış). */
	const DEFAULT_MAX = 9999999.0;

	/**
	 * Tek seferde yazılabilecek en yüksek tutar.
	 *
	 * @return float
	 */
	public static function max() {
		/**
		 * Tek bağış tutarı üst sınırı (yazılan para biriminde).
		 *
		 * @param float $max Varsayılan 9.999.999.
		 */
		$max = apply_filters( 'donation_panel_max_amount', self::DEFAULT_MAX );
		return is_numeric( $max ) && (float) $max > 0 ? (float) $max : self::DEFAULT_MAX;
	}
}

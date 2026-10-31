<?php
/**
 * İşlem ücretini karşılama (bağışçı isterse ücret tutara eklenir): yüzde sınırı ve tutara uygulama.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * Cover_Fee.
 */
final class Cover_Fee {

	/**
	 * Çalışma zamanı sınırı: kapalıysa 0, açıksa 0,5–15.
	 *
	 * @param mixed $raw Kayıtlı ya da gönderilen değer.
	 * @return float
	 */
	public static function clamp_percent( $raw ) {
		$value = is_numeric( $raw ) ? (float) $raw : (float) str_replace( ',', '.', is_scalar( $raw ) ? (string) $raw : '' );
		if ( $value <= 0 ) {
			return 0.0;
		}
		return (float) min( 15, max( 0.5, $value ) );
	}
}

<?php
/**
 * Kısa ömürlü adlandırılmış kilit (kampanya toplamı gibi oku-değiştir-yaz işleri için).
 *
 * `add_option` veritabanında benzersiz `option_name` ile atomiktir; harici nesne önbelleği gerekmez.
 * Kilit alınamazsa (zaman aşımı) iş yine de çalışır: bir bağışı kaybetmek, nadir bir üst üste binmeden kötüdür.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * Named_Lock.
 */
final class Named_Lock {

	const PREFIX = 'donation_panel_lock_';

	/** Eskimiş kilit süresi (sn). */
	const STALE_AFTER = 30;

	/**
	 * Kilit altında çalıştırır; kilit her durumda (hata dahil) bırakılır.
	 *
	 * @param string   $name     Kilit adı (harf/rakam/_).
	 * @param callable $callback Çalıştırılacak iş.
	 * @return mixed Geri çağrının dönüşü.
	 */
	public static function run( $name, callable $callback ) {
		$key  = self::PREFIX . preg_replace( '/[^a-z0-9_]/', '', strtolower( (string) $name ) );
		$held = self::acquire( $key );
		try {
			return call_user_func( $callback );
		} finally {
			if ( $held ) {
				delete_option( $key );
			}
		}
	}

	/**
	 * @param string $key Seçenek adı.
	 * @return bool Kilit alındı mı.
	 */
	private static function acquire( $key ) {
		$attempts = (int) apply_filters( 'donation_panel_lock_attempts', 10 );
		for ( $i = 0; $i < max( 1, $attempts ); $i++ ) {
			if ( add_option( $key, time(), '', 'no' ) ) {
				return true;
			}
			$taken = (int) get_option( $key, 0 );
			if ( $taken > 0 && ( time() - $taken ) >= self::STALE_AFTER ) {
				update_option( $key, time(), false );
				return true;
			}
			usleep( 50000 );
		}
		return false;
	}
}

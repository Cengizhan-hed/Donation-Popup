<?php
/**
 * Misafir bağışlarını hesaba bağlama belirteci: tek kullanımlık, süreli, yalnız karması saklanır.
 *
 * Saf çekirdek (`make_record` / `check_record`) WordPress'ten bağımsızdır; saklama kullanıcı metasıdır.
 * Düz belirteç yalnızca e-postadaki bağlantıda bulunur; veritabanında yalnız HMAC karması durur.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\DonorAccount;

defined( 'ABSPATH' ) || exit;

/**
 * Guest_Link_Token.
 */
final class Guest_Link_Token {

	const META = '_donation_panel_guest_link';

	/**
	 * Geçerlilik süresi (sn).
	 */
	const TTL = 3600;

	/**
	 * Saklanacak kaydı üretir.
	 *
	 * @param string $token  Düz belirteç.
	 * @param string $email  Hesap e-postası (bağlanacak siparişlerin fatura e-postası).
	 * @param int    $now    Şimdi (unix).
	 * @param string $secret HMAC anahtarı.
	 * @param int    $ttl    Süre (sn).
	 * @return array{hash: string, expires: int, email: string}
	 */
	public static function make_record( $token, $email, $now, $secret, $ttl = self::TTL ) {
		return array(
			'hash'    => hash_hmac( 'sha256', (string) $token, (string) $secret ),
			'expires' => (int) $now + (int) $ttl,
			'email'   => strtolower( trim( (string) $email ) ),
		);
	}

	/**
	 * Kaydı belirteçle sınar (zaman sabit karşılaştırma; süre ve biçim denetimi).
	 *
	 * @param mixed  $record Saklanan kayıt.
	 * @param string $token  Gelen belirteç.
	 * @param int    $now    Şimdi (unix).
	 * @param string $secret HMAC anahtarı.
	 * @return bool
	 */
	public static function check_record( $record, $token, $now, $secret ) {
		if ( ! is_array( $record ) || empty( $record['hash'] ) || empty( $record['expires'] ) || '' === (string) $token ) {
			return false;
		}
		if ( (int) $record['expires'] < (int) $now ) {
			return false;
		}
		return hash_equals( (string) $record['hash'], hash_hmac( 'sha256', (string) $token, (string) $secret ) );
	}

	/**
	 * Yeni belirteç üretir, karmasını saklar (öncekini geçersiz kılar) ve düz belirteci döndürür.
	 *
	 * @param int    $user_id Kullanıcı.
	 * @param string $email   Hesap e-postası.
	 * @return string
	 */
	public static function issue( $user_id, $email ) {
		$token = wp_generate_password( 40, false, false );
		update_user_meta( (int) $user_id, self::META, self::make_record( $token, $email, time(), wp_salt( 'auth' ) ) );
		return $token;
	}

	/**
	 * Belirteci doğrular; geçerliyse TEK KULLANIMLIK olarak siler ve kaydın e-postasını döndürür.
	 *
	 * @param int    $user_id Kullanıcı.
	 * @param string $token   Gelen belirteç.
	 * @return string|null Doğrulanan e-posta ya da null.
	 */
	public static function consume( $user_id, $token ) {
		$record = get_user_meta( (int) $user_id, self::META, true );
		if ( ! self::check_record( $record, $token, time(), wp_salt( 'auth' ) ) ) {
			return null;
		}
		delete_user_meta( (int) $user_id, self::META );
		return (string) $record['email'];
	}
}

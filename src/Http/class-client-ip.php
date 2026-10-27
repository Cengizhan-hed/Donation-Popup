<?php
/**
 * İstemci IP'si: varsayılan REMOTE_ADDR; vekil başlıkları yalnız güvenilen vekilden gelirse okunur.
 *
 * Başlıklar (X-Forwarded-For, X-Real-IP) istemci tarafından yazılabildiği için varsayılan olarak güvenilmez.
 * Ters vekil/CDN arkasındaki siteler vekil adreslerini `donation_panel_trusted_proxies` süzgeciyle bildirir.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Http;

defined( 'ABSPATH' ) || exit;

/**
 * Client_Ip.
 */
final class Client_Ip {

	/**
	 * İstemci IP'si.
	 *
	 * @return string Geçerli IP ya da '0.0.0.0'.
	 */
	public static function get() {
		$remote = self::valid_ip( isset( $_SERVER['REMOTE_ADDR'] ) ? wp_unslash( (string) $_SERVER['REMOTE_ADDR'] ) : '' ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- IP biçimi filter_var ile doğrulanır.
		$ip     = '' !== $remote ? $remote : '0.0.0.0';

		$trusted = self::trusted_proxies();
		// Eski sözleşme: `wdp_trust_proxy_headers` true dönerse doğrudan bağlanan adres vekil sayılır.
		if ( '' !== $remote && apply_filters( 'wdp_trust_proxy_headers', false ) ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
			$trusted[] = $remote;
		}
		if ( '' !== $remote && $trusted && self::is_trusted( $remote, $trusted ) ) {
			$forwarded = self::forwarded_client( $trusted );
			if ( '' !== $forwarded ) {
				$ip = $forwarded;
			}
		}

		/**
		 * Hız sınırı için istemci IP'sini değiştirir.
		 *
		 * @param string $ip     Çözülen IP.
		 * @param string $remote REMOTE_ADDR (doğrulanmış ya da boş).
		 */
		$filtered = apply_filters( 'donation_panel_client_ip', $ip, $remote );
		$filtered = self::valid_ip( is_scalar( $filtered ) ? (string) $filtered : '' );
		return '' !== $filtered ? $filtered : $ip;
	}

	/**
	 * Güvenilen vekil adresleri (IP ya da CIDR).
	 *
	 * @return string[]
	 */
	public static function trusted_proxies() {
		/**
		 * Güvenilen ters vekil/CDN adresleri (IP ya da CIDR, ör. `10.0.0.0/8`). Varsayılan: yok.
		 *
		 * @param string[] $proxies Adresler.
		 */
		$proxies = apply_filters( 'donation_panel_trusted_proxies', array() );
		if ( ! is_array( $proxies ) ) {
			return array();
		}
		return array_values( array_filter( array_map( 'trim', array_filter( $proxies, 'is_string' ) ) ) );
	}

	/**
	 * X-Forwarded-For zincirinde sağdan ilk güvenilmeyen adres; yoksa X-Real-IP; yoksa ''.
	 *
	 * @param string[] $trusted Güvenilen vekiller.
	 * @return string
	 */
	private static function forwarded_client( array $trusted ) {
		$chain = isset( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ? explode( ',', wp_unslash( (string) $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- her parça filter_var ile doğrulanır.
		foreach ( array_reverse( $chain ) as $candidate ) {
			$candidate = self::valid_ip( $candidate );
			if ( '' === $candidate ) {
				continue;
			}
			if ( ! self::is_trusted( $candidate, $trusted ) ) {
				return $candidate;
			}
		}
		if ( isset( $_SERVER['HTTP_X_REAL_IP'] ) ) {
			return self::valid_ip( wp_unslash( (string) $_SERVER['HTTP_X_REAL_IP'] ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- filter_var ile doğrulanır.
		}
		return '';
	}

	/**
	 * @param string   $ip      IP.
	 * @param string[] $trusted IP/CIDR listesi.
	 * @return bool
	 */
	private static function is_trusted( $ip, array $trusted ) {
		foreach ( $trusted as $entry ) {
			if ( self::matches( $ip, $entry ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param string $ip    IP.
	 * @param string $entry IP ya da CIDR.
	 * @return bool
	 */
	private static function matches( $ip, $entry ) {
		if ( false === strpos( $entry, '/' ) ) {
			return self::valid_ip( $entry ) === $ip;
		}
		list( $subnet, $bits ) = explode( '/', $entry, 2 );
		$ip_bin                = @inet_pton( $ip ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- geçersiz giriş false döner.
		$subnet_bin            = @inet_pton( trim( $subnet ) ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- geçersiz giriş false döner.
		if ( false === $ip_bin || false === $subnet_bin || strlen( $ip_bin ) !== strlen( $subnet_bin ) || ! ctype_digit( $bits ) ) {
			return false;
		}
		$bits = (int) $bits;
		if ( $bits > strlen( $ip_bin ) * 8 ) {
			return false;
		}
		$bytes = intdiv( $bits, 8 );
		if ( substr( $ip_bin, 0, $bytes ) !== substr( $subnet_bin, 0, $bytes ) ) {
			return false;
		}
		$rest = $bits % 8;
		if ( 0 === $rest ) {
			return true;
		}
		$mask = ( 0xFF << ( 8 - $rest ) ) & 0xFF;
		return ( ord( $ip_bin[ $bytes ] ) & $mask ) === ( ord( $subnet_bin[ $bytes ] ) & $mask );
	}

	/**
	 * @param string $value Aday.
	 * @return string Geçerli IP ya da ''.
	 */
	private static function valid_ip( $value ) {
		$value = trim( (string) $value );
		return false !== filter_var( $value, FILTER_VALIDATE_IP ) ? $value : '';
	}
}

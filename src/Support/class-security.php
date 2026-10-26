<?php
/**
 * Sanitizasyon, nonce, yetki, rate limit ve istek kaynağı doğrulaması.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Security
 */
class Security {

	/** IP katmanı üst sınırı (salt okunur uçlar, /dk). */
	const READ_IP_RATE_LIMIT = 600;

	/**
	 * Sanitize text field with additional checks
	 *
	 * @param string $value Value to sanitize.
	 * @param int    $max_length Maximum length.
	 * @return string
	 */
	public static function sanitize_text( $value, $max_length = 255 ) {
		if ( ! is_string( $value ) ) {
			return '';
		}

		$value = sanitize_text_field( $value );
		$value = self::limit_chars( $value, (int) $max_length );

		return trim( $value );
	}

	/**
	 * Truncate by Unicode characters (not bytes) so Turkish letters are not split.
	 *
	 * @param string $value Text.
	 * @param int    $max   Max characters; ≤0 leaves value unchanged.
	 * @return string
	 */
	public static function limit_chars( $value, $max ) {
		$value = (string) $value;
		$max   = (int) $max;
		if ( $max <= 0 ) {
			return $value;
		}
		if ( function_exists( 'mb_strlen' ) && function_exists( 'mb_substr' ) ) {
			if ( mb_strlen( $value ) > $max ) {
				return mb_substr( $value, 0, $max );
			}
			return $value;
		}
		if ( strlen( $value ) > $max ) {
			return substr( $value, 0, $max );
		}
		return $value;
	}

	/**
	 * Sanitize textarea with character (not byte) length limit.
	 *
	 * @param string $value Text.
	 * @param int    $max_length Max characters.
	 * @return string
	 */
	public static function sanitize_textarea( $value, $max_length = 500 ) {
		if ( ! is_string( $value ) ) {
			return '';
		}
		$value = sanitize_textarea_field( $value );
		return trim( self::limit_chars( $value, (int) $max_length ) );
	}

	/**
	 * Sanitize phone number
	 *
	 * @param string $phone Phone number.
	 * @return string
	 */
	public static function sanitize_phone( $phone ) {
		if ( ! is_string( $phone ) ) {
			return '';
		}

		// Remove all non-numeric characters except + and spaces
		$phone = preg_replace( '/[^0-9+\s\-()]/', '', $phone );
		$phone = sanitize_text_field( $phone );

		// E.164 / formatted international numbers (libphonenumber-safe headroom)
		if ( strlen( $phone ) > 28 ) {
			$phone = substr( $phone, 0, 28 );
		}

		return trim( $phone );
	}

	/**
	 * Sanitize numeric value
	 *
	 * @param mixed  $value Value to sanitize.
	 * @param float  $min   Minimum value.
	 * @param float  $max   Maximum value.
	 * @return float|null
	 */
	public static function sanitize_numeric( $value, $min = null, $max = null ) {
		if ( ! is_numeric( $value ) ) {
			return null;
		}

		$value = floatval( $value );

		if ( null !== $min && $value < $min ) {
			return null;
		}

		if ( null !== $max && $value > $max ) {
			return null;
		}

		return $value;
	}

	/**
	 * Validate product ID
	 *
	 * @param int             $product_id Product ID.
	 * @param \WC_Product|null $product_out Optional product output reference.
	 * @return bool
	 */
	public static function validate_product_id( $product_id, &$product_out = null ) {
		$product_id = absint( $product_id );

		if ( $product_id <= 0 ) {
			return false;
		}

		// Check if product exists and is published
		$product = wc_get_product( $product_id );

		if ( ! $product ) {
			return false;
		}

		// Check if user can view this product
		if ( ! current_user_can( 'edit_post', $product_id ) ) {
			if ( $product->get_status() !== 'publish' ) {
				return false;
			}
			$password = '';
			if ( method_exists( $product, 'get_post_password' ) ) {
				$password = (string) $product->get_post_password();
			}
			if ( '' !== $password ) {
				return false;
			}
			// Katalogda gizli (mağaza/arama listesinden gizli) ama yayında ürün satın alınabilir; bağış ürünleri
			// sık böyle kurulur. Bu yüzden is_visible()/katalog görünürlüğü kontrolü yoktur (REST ile aynı kural).
		}

		$product_out = $product;
		return true;
	}

	/**
	 * Rate limiting check (simple implementation)
	 *
	 * @param string $key     Unique key (e.g., IP address).
	 * @param int    $limit   Request limit.
	 * @param int    $period  Time period in seconds.
	 * @return bool
	 */
	public static function check_rate_limit( $key, $limit = 10, $period = 60 ) {
		$key = (string) $key;
		if ( '' === $key ) {
			$key = 'anonymous';
		}
		$transient_key = 'wdp_rate_limit_' . md5( $key );
		$current       = get_transient( $transient_key );

		if ( false === $current ) {
			set_transient( $transient_key, 1, $period );
			return true;
		}

		if ( $current >= $limit ) {
			return false;
		}

		set_transient( $transient_key, $current + 1, $period );
		return true;
	}

	/**
	 * Build a rate-limit key that is stable per visitor/session.
	 *
	 * Logged-in: `u:<id>|a:<action>` (unchanged).
	 * Guest: hash of IP + UA + WC session. No cookie of our own is set (privacy: `wdp_vid` was removed in
	 * Phase 8); `$use_visitor_token` is kept for call compatibility and only selects the extra IP layer
	 * (see `check_action_rate_limit`), which caps shared (CGNAT) addresses.
	 *
	 * @param string $action             Action scope.
	 * @param bool   $use_visitor_token  Unused (kept for compatibility).
	 * @return string
	 */
	public static function get_rate_limit_key( $action = 'default', $use_visitor_token = false ) {
		$action = sanitize_key( (string) $action );

		if ( is_user_logged_in() ) {
			return 'u:' . get_current_user_id() . '|a:' . $action;
		}

		unset( $use_visitor_token );

		$session_id = '';
		if ( function_exists( 'WC' ) && isset( WC()->session ) ) {
			$session_id = (string) WC()->session->get_customer_id();
		}

		$ip = self::get_client_ip();
		$ua = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : 'unknown';

		return 'g:' . md5( $session_id . '|' . $ip . '|' . $ua ) . '|a:' . $action;
	}

	/**
	 * IP-layer key (second bucket for cached read endpoints).
	 *
	 * @param string $action Action scope.
	 * @return string
	 */
	public static function get_rate_limit_ip_key( $action = 'default' ) {
		$action = sanitize_key( (string) $action );
		return 'ip:' . md5( self::get_client_ip() ) . '|a:' . $action;
	}

	/**
	 * Visitor + optional IP layer. Logged-in uses a single user key (no IP layer).
	 *
	 * @param string $action            Action scope.
	 * @param int    $limit             Per-visitor / per-user limit.
	 * @param int    $period            Window seconds.
	 * @param bool   $use_visitor_token Guest read endpoints.
	 * @return bool False when limited.
	 */
	public static function check_action_rate_limit( $action, $limit, $period, $use_visitor_token = false ) {
		$key = self::get_rate_limit_key( $action, $use_visitor_token );
		if ( ! self::check_rate_limit( $key, $limit, $period ) ) {
			return false;
		}
		if ( $use_visitor_token && ! is_user_logged_in() ) {
			$ip_limit = (int) apply_filters( 'wdp_rate_limit_ip_max', self::READ_IP_RATE_LIMIT, $action ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
			if ( $ip_limit > 0 && ! self::check_rate_limit( self::get_rate_limit_ip_key( $action ), $ip_limit, $period ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Get client IP address.
	 * Prefer REMOTE_ADDR; proxy headers are spoofable unless a trusted proxy is configured.
	 *
	 * @return string
	 */
	public static function get_client_ip() {
		// Prefer REMOTE_ADDR first. Only trust X-Forwarded-For (etc.) when
		// apply_filters( 'wdp_trust_proxy_headers', false ) is true for known proxies.
		$remote = isset( $_SERVER['REMOTE_ADDR'] ) ? trim( sanitize_text_field( wp_unslash( (string) $_SERVER['REMOTE_ADDR'] ) ) ) : '';
		if ( '' !== $remote && false !== filter_var( $remote, FILTER_VALIDATE_IP ) ) {
			if ( ! (bool) apply_filters( 'wdp_trust_proxy_headers', false ) ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
				return $remote;
			}
		}

		if ( (bool) apply_filters( 'wdp_trust_proxy_headers', false ) ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
			$proxy_keys = array(
				'HTTP_CLIENT_IP',
				'HTTP_X_FORWARDED_FOR',
				'HTTP_X_FORWARDED',
				'HTTP_X_CLUSTER_CLIENT_IP',
				'HTTP_FORWARDED_FOR',
				'HTTP_FORWARDED',
			);
			foreach ( $proxy_keys as $key ) {
				if ( empty( $_SERVER[ $key ] ) ) {
					continue;
				}
				foreach ( explode( ',', sanitize_text_field( wp_unslash( (string) $_SERVER[ $key ] ) ) ) as $ip ) {
					$ip = trim( $ip );
					if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE ) !== false ) {
						return $ip;
					}
				}
			}
		}

		if ( '' !== $remote && false !== filter_var( $remote, FILTER_VALIDATE_IP ) ) {
			return $remote;
		}

		return '0.0.0.0';
	}

	/**
	 * Check user capability for AJAX operations
	 * SECURITY: Verify user permissions
	 *
	 * @param string $capability Capability to check.
	 * @return bool
	 */
	public static function check_capability( $capability = 'read' ) {
		if ( ! is_user_logged_in() ) {
			// For non-logged-in users, only allow read operations
			return 'read' === $capability;
		}

		return current_user_can( $capability );
	}

	/**
	 * Validate and sanitize email address
	 * SECURITY: Enhanced email validation
	 *
	 * @param string $email Email address.
	 * @return string|false Sanitized email or false if invalid.
	 */
	public static function sanitize_email( $email ) {
		if ( ! is_string( $email ) ) {
			return false;
		}

		$email = trim( $email );

		// SECURITY: Length check before validation
		if ( strlen( $email ) > 254 ) {
			return false;
		}

		$email = sanitize_email( $email );

		// SECURITY: Additional validation
		if ( ! is_email( $email ) ) {
			return false;
		}

		return $email;
	}

	/**
	 * Validate request origin
	 * SECURITY: CSRF protection enhancement
	 *
	 * @param bool $credential_issuance True for endpoints that issue new nonces without a prior nonce (stricter: Sec-Fetch-Site "none" is not accepted).
	 * @return bool
	 */
	public static function validate_request_origin( $credential_issuance = false ) {
		$site_host = wp_parse_url( home_url(), PHP_URL_HOST );
		if ( empty( $site_host ) ) {
			return false;
		}

		$referer = isset( $_SERVER['HTTP_REFERER'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) ) : '';
		$origin  = isset( $_SERVER['HTTP_ORIGIN'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_ORIGIN'] ) ) : '';

		if ( ! empty( $origin ) ) {
			$origin_host = wp_parse_url( $origin, PHP_URL_HOST );
			if ( empty( $origin_host ) || ! hash_equals( (string) $site_host, (string) $origin_host ) ) {
				return false;
			}
			return true;
		}

		if ( ! empty( $referer ) ) {
			$referer_host = wp_parse_url( $referer, PHP_URL_HOST );
			if ( empty( $referer_host ) || ! hash_equals( (string) $site_host, (string) $referer_host ) ) {
				return false;
			}
			return true;
		}

		$fetch_site = isset( $_SERVER['HTTP_SEC_FETCH_SITE'] ) ? strtolower( sanitize_text_field( wp_unslash( $_SERVER['HTTP_SEC_FETCH_SITE'] ) ) ) : '';
		if ( in_array( $fetch_site, array( 'same-origin', 'same-site' ), true ) ) {
			return true;
		}

		// "none" is trivially spoofable outside a browser; allow only for nonce-protected AJAX (Referer/Origin often absent with strict policies).
		if ( ! $credential_issuance && 'none' === $fetch_site ) {
			return true;
		}

		return false;
	}
}

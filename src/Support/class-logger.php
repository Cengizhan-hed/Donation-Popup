<?php
/**
 * WC_Logger sarmalayıcı: kişisel veri (e-posta, telefon, ad alanları) yazmaz.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Support;

defined( 'ABSPATH' ) || exit;

/**
 * Logger.
 */
class Logger {

	const SOURCE = 'woo-donation-popup';

	/**
	 * Bağlamda değeri gizlenecek anahtar parçaları.
	 *
	 * @var string[]
	 */
	private static $sensitive_keys = array( 'email', 'mail', 'phone', 'tel', 'name', 'address', 'dedication', 'note', 'message', 'password', 'token', 'nonce' );

	/**
	 * Yazıcı: function ( string $level, string $message, array $context ).
	 *
	 * @var callable|null
	 */
	private $sink;

	/**
	 * Kurucu.
	 *
	 * @param callable|null $sink Test için özel yazıcı; yoksa WC_Logger.
	 */
	public function __construct( $sink = null ) {
		$this->sink = is_callable( $sink ) ? $sink : null;
	}

	/**
	 * Günlüğe yazar (temizlenmiş ileti + bağlam).
	 *
	 * @param string               $level   debug|info|notice|warning|error.
	 * @param string               $message İleti.
	 * @param array<string, mixed> $context Bağlam.
	 * @return void
	 */
	public function log( $level, $message, array $context = array() ) {
		$message = self::scrub_message( (string) $message );
		$context = self::scrub_context( $context );

		if ( null !== $this->sink ) {
			call_user_func( $this->sink, $level, $message, $context );
			return;
		}

		if ( ! function_exists( 'wc_get_logger' ) ) {
			return;
		}
		$context['source'] = self::SOURCE;
		wc_get_logger()->log( $level, $message, $context );
	}

	/**
	 * Hata düzeyi kısayolu.
	 *
	 * @param string               $message İleti.
	 * @param array<string, mixed> $context Bağlam.
	 * @return void
	 */
	public function error( $message, array $context = array() ) {
		$this->log( 'error', $message, $context );
	}

	/**
	 * Bilgi düzeyi kısayolu.
	 *
	 * @param string               $message İleti.
	 * @param array<string, mixed> $context Bağlam.
	 * @return void
	 */
	public function info( $message, array $context = array() ) {
		$this->log( 'info', $message, $context );
	}

	/**
	 * İletideki e-posta ve telefon benzeri dizileri maskeler.
	 *
	 * @param string $message İleti.
	 * @return string
	 */
	public static function scrub_message( $message ) {
		$message = (string) preg_replace( '/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/', '[email]', $message );
		return (string) preg_replace( '/\+?\d[\d\s().\-]{7,}\d/', '[number]', $message );
	}

	/**
	 * Bağlamdaki hassas anahtarların değerlerini gizler (iç içe diziler dahil).
	 *
	 * @param array<string, mixed> $context Bağlam.
	 * @return array<string, mixed>
	 */
	public static function scrub_context( array $context ) {
		$clean = array();
		foreach ( $context as $key => $value ) {
			$key_text = strtolower( (string) $key );
			$hide     = false;
			foreach ( self::$sensitive_keys as $needle ) {
				if ( false !== strpos( $key_text, $needle ) ) {
					$hide = true;
					break;
				}
			}

			if ( $hide ) {
				$clean[ $key ] = '[redacted]';
			} elseif ( is_array( $value ) ) {
				$clean[ $key ] = self::scrub_context( $value );
			} elseif ( is_scalar( $value ) ) {
				$clean[ $key ] = is_string( $value ) ? self::scrub_message( $value ) : $value;
			} else {
				$clean[ $key ] = '[' . gettype( $value ) . ']';
			}
		}
		return $clean;
	}
}

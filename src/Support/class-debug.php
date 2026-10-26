<?php
/**
 * WP_DEBUG açıkken hata günlüğüne yazar.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Debug
 */
class Debug {

/**
	 * Log debug message.
	 *
	 * Only logs if WP_DEBUG is enabled. Supports arrays, objects, and strings.
	 *
	 * @since 10.0
	 * @param mixed $message Message to log. Can be string, array, or object.
	 * @return void
	 */
	public static function log( $message ) {
		if ( ! defined( 'WP_DEBUG' ) || true !== WP_DEBUG ) {
			return;
		}

		if ( is_array( $message ) || is_object( $message ) ) {
			error_log( print_r( $message, true ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions -- yalnız WP_DEBUG açıkken geliştirici günlüğü.
			return;
		}

		error_log( (string) $message ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- yalnız WP_DEBUG açıkken geliştirici günlüğü.
	}
}

<?php
/**
 * Render giriş noktalarını hatalara karşı korur: açık output buffer'ları kapatır, hatayı loglar, ziyaretçiye boş döner.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

use DonationPanel\Support\Admin_Notice;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wraps public render entry points so a broken setting or meta value never takes the page down.
 */
class Render_Guard {

	/**
	 * Run an HTML-producing callback; on any Throwable return the failure notice instead.
	 *
	 * @param callable $callback   Returns HTML.
	 * @param int      $product_id Product ID (for the notice/log).
	 * @param string   $context    Entry point name for the log.
	 * @return string
	 */
	public static function html( callable $callback, $product_id = 0, $context = 'render' ) {
		$level = ob_get_level();
		try {
			$html = call_user_func( $callback );
			return is_scalar( $html ) ? (string) $html : '';
		} catch ( \Throwable $e ) {
			self::close_buffers( $level );
			self::log( $e, $context, $product_id );
			return self::failure_notice( $product_id );
		}
	}

	/**
	 * Run a value-producing callback (filters, AJAX payloads); on any Throwable return $fallback.
	 *
	 * @param callable $callback Callback.
	 * @param mixed    $fallback Value returned on failure.
	 * @param string   $context  Entry point name for the log.
	 * @return mixed
	 */
	public static function value( callable $callback, $fallback, $context = 'filter' ) {
		$level = ob_get_level();
		try {
			return call_user_func( $callback );
		} catch ( \Throwable $e ) {
			self::close_buffers( $level );
			self::log( $e, $context, 0 );
			return $fallback;
		}
	}

	/**
	 * Admin-only notice shown in place of a form that failed to render.
	 *
	 * @param int $product_id Product ID.
	 * @return string
	 */
	public static function failure_notice( $product_id = 0 ) {
		$product_id = absint( $product_id );
		$message    = $product_id > 0
			/* translators: %d: product ID */
			? sprintf( __( 'The donation form could not be rendered (product #%d). See the error log for details.', 'woo-donation-popup' ), $product_id )
			: __( 'The donation form could not be rendered. See the error log for details.', 'woo-donation-popup' );

		return Admin_Notice::admin_notice_html( $message );
	}

	/**
	 * Discard buffers opened after $level so half-rendered HTML never leaks.
	 *
	 * @param int $level Buffer level before the callback ran.
	 * @return void
	 */
	private static function close_buffers( $level ) {
		while ( ob_get_level() > $level ) {
			ob_end_clean();
		}
	}

	/**
	 * @param \Throwable $e          Error.
	 * @param string     $context    Entry point.
	 * @param int        $product_id Product ID.
	 * @return void
	 */
	private static function log( \Throwable $e, $context, $product_id ) {
		if ( ! function_exists( 'wdp_debug_log' ) ) {
			return;
		}
		wdp_debug_log(
			sprintf(
				'WDP render error [%s] product #%d: %s (%s) in %s:%d',
				(string) $context,
				absint( $product_id ),
				$e->getMessage(),
				get_class( $e ),
				$e->getFile(),
				$e->getLine()
			)
		);
	}
}

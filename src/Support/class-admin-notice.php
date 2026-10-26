<?php
/**
 * Yalnız yönetim alanında/oluşturucu önizlemesinde görünen küçük uyarı.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Support;

use DonationPanel\Modules\EntryPoints\Builder_Detect;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Admin_Notice
 */
class Admin_Notice {

	/**
	 * Notice shown only to shop editors in place of a form that cannot be displayed.
	 *
	 * Visitors always get an empty string, so a misconfigured shortcode never shows them an error.
	 *
	 * @param string $message Plain-text message.
	 * @return string Safe HTML (or '').
	 */
	public static function admin_notice_html( $message ) {
		$in_editor = Builder_Detect::is_builder_preview();
		$in_admin  = function_exists( 'is_admin' ) && is_admin()
			&& ! ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() );
		if ( ! $in_editor && ! $in_admin ) {
			return '';
		}
		$message = trim( (string) $message );
		if ( '' === $message ) {
			return '';
		}
		self::enqueue_admin_notice_style();
		return '<div class="wdp-admin-notice" role="note">' . esc_html( $message ) . '</div>';
	}

	/**
	 * Tiny stylesheet for .wdp-admin-notice (printed in the footer when content is already rendering).
	 *
	 * @return void
	 */
	private static function enqueue_admin_notice_style() {
		static $done = false;
		if ( $done || ! function_exists( 'wp_register_style' ) || ! function_exists( 'wp_add_inline_style' ) ) {
			return;
		}
		$done = true;
		wp_register_style( 'wdp-admin-notice', false, array(), defined( 'WDP_VERSION' ) ? WDP_VERSION : false );
		wp_enqueue_style( 'wdp-admin-notice' );
		wp_add_inline_style( 'wdp-admin-notice', '.wdp-admin-notice{box-sizing:border-box;margin:12px 0;padding:10px 14px;border:1px solid #f0b849;border-left-width:4px;border-radius:4px;background:#fcf9e8;color:#1e1e1e;font-size:14px;line-height:1.5}' );
	}
}

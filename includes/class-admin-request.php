<?php
/**
 * Admin AJAX nonce/yetki kontrolü ve standart JSON başarı/hata yanıtları.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Shared admin request guard and response formatter.
 */
class WDP_Admin_Request {
	/**
	 * Validate nonce and capability for admin AJAX.
	 *
	 * @return true
	 */
	public static function guard() {
		check_ajax_referer('wdp_admin_nonce', 'nonce');

		if (!current_user_can('manage_woocommerce')) {
			self::json_error(__('Bu işlem için yetkiniz yok.', 'woo-donation-popup'), 'forbidden', 403);
		}

		return true;
	}

	/**
	 * Send success response.
	 *
	 * @param string $message Human readable message.
	 * @param array  $data    Additional data payload.
	 * @return void
	 */
	public static function json_success($message, array $data = array()) {
		wp_send_json_success(
			array_merge(
				array(
					'code'    => 'ok',
					'message' => $message,
				),
				$data
			)
		);
	}

	/**
	 * Send structured error response.
	 *
	 * @param string $message Error message.
	 * @param string $code    Error code.
	 * @param int    $status  HTTP status.
	 * @return void
	 */
	public static function json_error($message, $code = 'error', $status = 400) {
		wp_send_json_error(
			array(
				'code'    => sanitize_key($code),
				'message' => $message,
			),
			$status
		);
	}
}

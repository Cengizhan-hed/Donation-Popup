<?php
/**
 * Liste ve döngü butonları için gecikmeli modal HTML (AJAX wdp_render_modal).
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Lazy-loads donation modal markup for loop/list CTAs.
 */
class WDP_Lazy_Modal {

	/**
	 * @return void
	 */
	public static function init() {
		add_action('wp_ajax_wdp_render_modal', array(__CLASS__, 'ajax_render'));
		add_action('wp_ajax_nopriv_wdp_render_modal', array(__CLASS__, 'ajax_render'));
	}

	/**
	 * @return void
	 */
	public static function ajax_render() {
		try {
			if (!WDP_Security::validate_request_origin()) {
				wp_send_json_error(array('message' => __('Invalid request origin', 'woo-donation-popup')), 403);
			}
			// Bilinçli: check_ajax_referer YOK. SiteGround sayfa önbelleği eski
			// wdp_ajax.nonces.render_modal gömebilir; nonce zorunlu olsa hem ön yükleme
			// hem tıklama kırılır. Koruma: origin + rate limit. İstemci security
			// gönderir; boş/403 yanıtında tıklama fresh nonce + yeniden dener
			// (assets/js/src/lazy-modal.js ensureAndOpen).
			if (!WDP_Security::check_action_rate_limit('render_modal', 60, 60, true)) {
				if (!headers_sent()) {
					header('Retry-After: 60', true);
				}
				wp_send_json_error(array('message' => __('Too many requests were sent. Please try again shortly.', 'woo-donation-popup'), 'code' => 'rate_limit', 'retry_after' => 60), 429);
			}

			$product_id = isset($_REQUEST['product_id']) ? absint(wp_unslash($_REQUEST['product_id'])) : 0;
			$mode       = isset($_REQUEST['mode']) ? sanitize_key(wp_unslash($_REQUEST['mode'])) : 'popup';
			if ($mode !== 'side_panel') {
				$mode = 'popup';
			}

			$product = null;
			if (!WDP_Security::validate_product_id($product_id, $product) || !$product) {
				wp_send_json_error(array('message' => __('Product not found or cannot be displayed.', 'woo-donation-popup')), 404);
			}
			if (!WDP_Donation_Scope::is_donation_product($product)) {
				wp_send_json_error(array('message' => __('This product is not marked as a donation product.', 'woo-donation-popup')), 403);
			}

			$html = WDP_Templates::render_donation_modal($product_id, '', '', '', $mode);
			if (!is_string($html) || $html === '') {
				wp_send_json_error(array('message' => __('The donation form cannot be shown right now.', 'woo-donation-popup')), 500);
			}

			wp_send_json_success(array('html' => $html, 'product_id' => $product_id, 'mode' => $mode));
		} catch (\Throwable $e) {
			if (function_exists('wdp_debug_log')) {
				wdp_debug_log('WDP lazy modal: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
			}
			wp_send_json_error(array('message' => __('The donation form cannot be shown right now.', 'woo-donation-popup')), 500);
		}
	}
}

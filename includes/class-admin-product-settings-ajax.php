<?php
/**
 * Ürün ilerleme toplamını yeniden hesaplayan AJAX ucu.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Handles product settings CRUD endpoints for admin.
 */
class WDP_Admin_Product_Settings_Ajax {
	/**
	 * Recalculate a product's progress total from all paid orders.
	 *
	 * @return void
	 */
	public static function recalculate_total() {
		try {
		WDP_Admin_Request::guard();

		$product_id = isset($_POST['product_id']) ? absint(wp_unslash($_POST['product_id'])) : 0;
		if (!$product_id) {
			WDP_Admin_Request::json_error(__('Invalid product ID.', 'woo-donation-popup'), 'invalid_product');
		}

		$product = wc_get_product($product_id);
		if (!$product) {
			WDP_Admin_Request::json_error(__('Product not found.', 'woo-donation-popup'), 'not_found', 404);
		}

		if (function_exists('wc_set_time_limit')) {
			wc_set_time_limit(0);
		}

		$result = WDP_Utils::recalculate_product_donation_total($product_id);
		$total_text = WDP_Utils::format_price_plain($result['total']);

		WDP_Admin_Request::json_success(
			sprintf(
				/* translators: 1: product name, 2: formatted total, 3: order count */
				__('Recalculated the total for "%1$s": %2$s (%3$d orders).', 'woo-donation-popup'),
				wp_strip_all_tags($product->get_name()),
				$total_text,
				(int) $result['orders']
			),
			array(
				'total'      => (float) $result['total'],
				'total_text' => $total_text,
				'donors'     => (int) $result['donors'],
				'orders'     => (int) $result['orders'],
			)
		);
		} catch (\Throwable $e) {
			if (function_exists('wdp_debug_log')) {
				wdp_debug_log('WDP recalculate: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
			}
			WDP_Admin_Request::json_error(__('The total could not be calculated. Details are in the error log.', 'woo-donation-popup'), 'error', 500);
		}
	}
}

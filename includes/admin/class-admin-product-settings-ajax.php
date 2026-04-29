<?php
/**
 * Product settings admin AJAX controller.
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
	 * Save product settings.
	 *
	 * @return void
	 */
	public static function save() {
		WDP_Admin_Request::guard();

		$product_id = isset($_POST['product_id']) ? absint(wp_unslash($_POST['product_id'])) : 0;
		if (!$product_id) {
			WDP_Admin_Request::json_error(__('Geçersiz ürün ID.', 'woo-donation-popup'), 'invalid_product');
		}

		$product = wc_get_product($product_id);
		if (!$product) {
			WDP_Admin_Request::json_error(__('Ürün bulunamadı.', 'woo-donation-popup'), 'not_found', 404);
		}

		$normalized_settings = WDP_Product_Settings_Service::from_request($_POST);
		foreach ($normalized_settings as $meta_key => $meta_value) {
			update_post_meta($product_id, $meta_key, $meta_value);
		}

		delete_transient('wdp_admin_products_list');
		WDP_Admin_Request::json_success(
			sprintf(__('"%s" ürünü için ayarlar başarıyla kaydedildi.', 'woo-donation-popup'), $product->get_name())
		);
	}

	/**
	 * Get product settings.
	 *
	 * @return void
	 */
	public static function get() {
		WDP_Admin_Request::guard();

		$product_id = isset($_POST['product_id']) ? absint(wp_unslash($_POST['product_id'])) : 0;
		if (!$product_id) {
			WDP_Admin_Request::json_error(__('Geçersiz ürün ID.', 'woo-donation-popup'), 'invalid_product');
		}

		$product = wc_get_product($product_id);
		if (!$product) {
			WDP_Admin_Request::json_error(__('Ürün bulunamadı.', 'woo-donation-popup'), 'not_found', 404);
		}

		$allow_custom_price    = get_post_meta($product_id, '_allow_custom_price', true) === 'yes';
		$min_custom_price      = get_post_meta($product_id, '_min_custom_price', true);
		$allow_multiple_shares = get_post_meta($product_id, '_allow_multiple_shares', true) === 'yes';
		$max_shares            = get_post_meta($product_id, '_max_shares', true);
		$enable_progress_bar   = get_post_meta($product_id, '_enable_progress_bar', true) === 'yes';
		$progress_bar_limit    = get_post_meta($product_id, '_progress_bar_limit', true);
		$enable_product_note   = get_post_meta($product_id, '_enable_product_note', true) === 'yes';
		$product_note_text     = get_post_meta($product_id, '_product_note_text', true);
		$product_note_icon     = get_post_meta($product_id, '_product_note_icon', true);

		if ($product_note_icon === '') {
			$product_note_icon = 'info';
		}
		if ($min_custom_price === '') {
			$min_custom_price = '0';
		}
		if ($max_shares === '') {
			$max_shares = '7';
		}
		if ($progress_bar_limit === '') {
			$progress_bar_limit = '100000';
		}

		wp_send_json_success(
			array(
				'code'                  => 'ok',
				'allow_custom_price'    => $allow_custom_price,
				'min_custom_price'      => $min_custom_price,
				'allow_multiple_shares' => $allow_multiple_shares,
				'max_shares'            => $max_shares,
				'enable_progress_bar'   => $enable_progress_bar,
				'progress_bar_limit'    => $progress_bar_limit,
				'enable_product_note'   => $enable_product_note,
				'product_note_text'     => $product_note_text,
				'product_note_icon'     => $product_note_icon,
			)
		);
	}
}

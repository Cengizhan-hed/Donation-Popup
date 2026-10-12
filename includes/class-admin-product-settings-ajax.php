<?php
/**
 * Tek ürün bağış ayarlarını okuma ve post meta kaydetme AJAX uçları.
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

		$existing_meta = array();
		foreach (WDP_Product_Settings_Service::PRESERVED_FIELDS as $meta_key) {
			$existing_meta[ $meta_key ] = get_post_meta($product_id, $meta_key, true);
		}

		$normalized_settings = WDP_Product_Settings_Service::from_request(
			WDP_Product_Settings_Service::with_preserved_fields($_POST, $existing_meta)
		);
		foreach ($normalized_settings as $meta_key => $meta_value) {
			update_post_meta($product_id, $meta_key, wp_slash($meta_value));
		}

		WDP_Admin_Request::json_success(
			sprintf(__('"%s" ürünü için ayarlar başarıyla kaydedildi.', 'woo-donation-popup'), $product->get_name()),
			array(
				'settings' => WDP_Product_Settings_Service::public_flags_from_normalized($normalized_settings),
			)
		);
	}

	/**
	 * Recalculate a product's progress total from all paid orders.
	 *
	 * @return void
	 */
	public static function recalculate_total() {
		WDP_Admin_Request::guard();

		$product_id = isset($_POST['product_id']) ? absint(wp_unslash($_POST['product_id'])) : 0;
		if (!$product_id) {
			WDP_Admin_Request::json_error(__('Geçersiz ürün ID.', 'woo-donation-popup'), 'invalid_product');
		}

		$product = wc_get_product($product_id);
		if (!$product) {
			WDP_Admin_Request::json_error(__('Ürün bulunamadı.', 'woo-donation-popup'), 'not_found', 404);
		}

		if (function_exists('wc_set_time_limit')) {
			wc_set_time_limit(0);
		}

		$result = WDP_Utils::recalculate_product_donation_total($product_id);
		$total_text = WDP_Utils::format_price_plain($result['total']);

		WDP_Admin_Request::json_success(
			sprintf(
				/* translators: 1: product name, 2: formatted total, 3: order count */
				__('"%1$s" toplamı yeniden hesaplandı: %2$s (%3$d sipariş).', 'woo-donation-popup'),
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
		$product_note_text = get_post_meta($product_id, '_product_note_text', true);
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
				'donation_type'         => WDP_Donation_Type::infer_from_flags($allow_custom_price, $allow_multiple_shares, $enable_progress_bar),
				'allow_custom_price'    => $allow_custom_price,
				'min_custom_price'      => $min_custom_price,
				'allow_multiple_shares' => $allow_multiple_shares,
				'max_shares'            => $max_shares,
				'enable_progress_bar'   => $enable_progress_bar,
				'progress_bar_limit'    => $progress_bar_limit,
				'enable_product_note' => $enable_product_note,
				'product_note_text'   => sanitize_textarea_field((string) $product_note_text),
			)
		);
	}
}

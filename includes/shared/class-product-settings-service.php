<?php
/**
 * Product settings normalization service.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Converts request payload into normalized product settings.
 */
class WDP_Product_Settings_Service {
	/**
	 * Meta keys persisted for donation product settings (single source for saves + cache invalidation).
	 *
	 * @return string[]
	 */
	public static function get_settings_meta_keys() {
		static $keys = null;

		if (null === $keys) {
			$keys = array_keys(self::from_request(array()));
		}

		return $keys;
	}

	/**
	 * Normalize product settings payload.
	 *
	 * @param array $request Request array.
	 * @return array
	 */
	public static function from_request(array $request) {
		$allow_custom_price    = isset($request['allow_custom_price']) && wp_unslash($request['allow_custom_price']) === 'true' ? 'yes' : 'no';
		$allow_multiple_shares = isset($request['allow_multiple_shares']) && wp_unslash($request['allow_multiple_shares']) === 'true' ? 'yes' : 'no';
		$enable_progress_bar   = isset($request['enable_progress_bar']) && wp_unslash($request['enable_progress_bar']) === 'true' ? 'yes' : 'no';
		$enable_product_note   = isset($request['enable_product_note']) && wp_unslash($request['enable_product_note']) === 'true' ? 'yes' : 'no';
		$enable_sadaka_donation = isset($request['enable_sadaka_donation']) && wp_unslash($request['enable_sadaka_donation']) === 'true' ? 'yes' : 'no';

		return array(
			'_allow_custom_price'    => $allow_custom_price,
			'_min_custom_price'      => isset($request['min_custom_price']) ? wc_format_decimal(wp_unslash($request['min_custom_price'])) : '',
			'_allow_multiple_shares' => $allow_multiple_shares,
			'_max_shares'            => isset($request['max_shares']) ? absint(wp_unslash($request['max_shares'])) : '',
			'_enable_progress_bar'   => $enable_progress_bar,
			'_progress_bar_limit'    => isset($request['progress_bar_limit']) ? wc_format_decimal(wp_unslash($request['progress_bar_limit'])) : '',
			'_enable_product_note'   => $enable_product_note,
			'_product_note_text'     => isset($request['product_note_text']) ? sanitize_textarea_field(wp_unslash($request['product_note_text'])) : '',
			'_enable_sadaka_donation' => $enable_sadaka_donation,
			'_sadaka_min_price'       => isset($request['sadaka_min_price']) ? wc_format_decimal(wp_unslash($request['sadaka_min_price'])) : '',
			'_sadaka_fixed_price'     => isset($request['sadaka_fixed_price']) ? wc_format_decimal(wp_unslash($request['sadaka_fixed_price'])) : '',
			'_sadaka_donation_message' => isset($request['sadaka_donation_message']) ? sanitize_textarea_field(wp_unslash($request['sadaka_donation_message'])) : '',
			'_sadaka_toggle_label'    => isset($request['sadaka_toggle_label']) ? sanitize_text_field(wp_unslash($request['sadaka_toggle_label'])) : '',
			'_sadaka_wc_product_id'   => isset($request['sadaka_wc_product_id']) ? absint(wp_unslash($request['sadaka_wc_product_id'])) : '',
		);
	}
}

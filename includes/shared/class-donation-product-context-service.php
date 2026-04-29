<?php
/**
 * Donation product context service.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Builds normalized product context for shortcode/template rendering.
 */
class WDP_Donation_Product_Context_Service {
	/**
	 * Resolve product by ID safely.
	 *
	 * @param int $product_id Product ID.
	 * @return WC_Product|false
	 */
	public static function get_product($product_id) {
		$product_id = absint($product_id);
		if (!$product_id) {
			return false;
		}

		$product = wc_get_product($product_id);
		if (!$product) {
			return false;
		}

		return $product;
	}

	/**
	 * Build normalized form context.
	 *
	 * @param WC_Product $product Product.
	 * @return array
	 */
	public static function build_form_context($product) {
		$product_id            = (int) $product->get_id();
		$product_price         = $product->get_price();
		$allow_custom_price    = $product->get_meta('_allow_custom_price') === 'yes';
		$allow_multiple_shares = $product->get_meta('_allow_multiple_shares') === 'yes';
		$enable_progress_bar   = $product->get_meta('_enable_progress_bar') === 'yes';

		$min_price = (string) $product->get_meta('_min_custom_price');
		if ($allow_custom_price && $min_price === '') {
			$min_price = '0';
		}

		$max_shares = (string) $product->get_meta('_max_shares');
		if ($allow_multiple_shares && $max_shares === '') {
			$max_shares = '7';
		}

		$progress_bar_limit = (string) $product->get_meta('_progress_bar_limit');
		if ($progress_bar_limit === '') {
			$progress_bar_limit = '100000';
		}
		$progress_bar_limit_value = (float) $progress_bar_limit;

		$progress_min_price = $min_price;
		if ($enable_progress_bar) {
			$product_base_price = (float) $product->get_price();
			if ($product_base_price > 0) {
				$progress_min_price = ($min_price !== '' && (float) $min_price > 0) ? (string) min((float) $min_price, $product_base_price) : (string) $product_base_price;
			} else {
				$progress_min_price = ($min_price !== '' && (float) $min_price > 0) ? $min_price : '0';
			}
		}

		$total_donation = 0.0;
		if ($enable_progress_bar) {
			$total_donation = WDP_Utils::get_total_donation_amount($product_id);
		}

		$product_note_icon = (string) $product->get_meta('_product_note_icon');
		if ($product_note_icon === '') {
			$product_note_icon = 'info';
		}

		return array(
			'product_id'                    => $product_id,
			'product_name'                  => $product->get_name(),
			'product_price'                 => $product_price,
			'formatted_price'               => $product_price ? WDP_Utils::format_price_html($product_price) : '',
			'allow_custom_price'            => $allow_custom_price,
			'min_price'                     => $min_price,
			'allow_multiple_shares'         => $allow_multiple_shares,
			'max_shares'                    => $max_shares,
			'enable_progress_bar'           => $enable_progress_bar,
			'progress_bar_limit'            => $progress_bar_limit_value,
			'progress_min_price'            => $progress_min_price,
			'total_donation'                => $total_donation,
			'enable_product_note'           => $product->get_meta('_enable_product_note') === 'yes',
			'product_note_text'             => trim((string) $product->get_meta('_product_note_text')),
			'product_note_icon'             => $product_note_icon,
			'currency_symbol'               => function_exists('get_woocommerce_currency_symbol') ? get_woocommerce_currency_symbol() : '₺',
			'custom_price_placeholder'      => ((float) $min_price > 0) ? ('min: ' . WDP_Utils::format_amount_for_min_placeholder($min_price)) : __('Bağış tutarı *', 'woo-donation-popup'),
		);
	}
}

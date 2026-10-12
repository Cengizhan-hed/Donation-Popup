<?php
/**
 * Kategori bazlı modal başlık rengi okuma, kayıt ve inline stil.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Resolves title color from product categories and admin mapping.
 */
class WDP_Category_Title_Color_Service {
	const OPTION_KEY = 'wdp_category_title_colors';

	/**
	 * @return array<int,string> term_id => hex color
	 */
	public static function get_all() {
		$stored = get_option(self::OPTION_KEY, array());
		if (!is_array($stored)) {
			return array();
		}

		$out = array();
		foreach ($stored as $term_id => $color) {
			$term_id = absint($term_id);
			$hex = sanitize_hex_color((string) $color);
			if ($term_id > 0 && $hex) {
				$out[$term_id] = $hex;
			}
		}

		return $out;
	}

	/**
	 * @param array $request Raw POST (category_color_enable, category_color).
	 * @return array<int,string>
	 */
	public static function normalize_from_request(array $request) {
		$raw_colors = isset($request['category_color']) && is_array($request['category_color'])
			? $request['category_color']
			: array();
		$raw_enable = isset($request['category_color_enable']) && is_array($request['category_color_enable'])
			? $request['category_color_enable']
			: array();

		$out = array();
		foreach ($raw_colors as $term_id => $color) {
			$term_id = absint($term_id);
			if ($term_id <= 0 || empty($raw_enable[$term_id])) {
				continue;
			}
			$hex = sanitize_hex_color(wp_unslash((string) $color));
			if ($hex) {
				$out[$term_id] = $hex;
			}
		}

		return $out;
	}

	/**
	 * First matching product_cat color (deepest term wins when multiple match).
	 *
	 * @param int $product_id Product ID.
	 * @return string Hex color or empty.
	 */
	public static function get_color_for_product($product_id) {
		$product_id = absint($product_id);
		if ($product_id <= 0) {
			return '';
		}

		$map = self::get_all();
		if (empty($map)) {
			return '';
		}

		$term_ids = wc_get_product_term_ids($product_id, 'product_cat');
		if (empty($term_ids) || !is_array($term_ids)) {
			return '';
		}

		$best_id = 0;
		$best_depth = -1;

		foreach ($term_ids as $term_id) {
			$term_id = absint($term_id);
			if ($term_id <= 0 || !isset($map[$term_id])) {
				continue;
			}

			$depth = 0;
			$ancestor = $term_id;
			while ($ancestor) {
				$term = get_term($ancestor, 'product_cat');
				if (!$term || is_wp_error($term) || !$term->parent) {
					break;
				}
				$depth++;
				$ancestor = (int) $term->parent;
			}

			if ($depth > $best_depth) {
				$best_depth = $depth;
				$best_id = $term_id;
			}
		}

		return $best_id > 0 ? $map[$best_id] : '';
	}

	/**
	 * Inline style attribute for product title.
	 * Global marka rengi varsa kategori rengi modal başlığını ezmez.
	 *
	 * @param int $product_id Product ID.
	 * @return string Safe HTML attribute fragment (empty or style="...").
	 */
	public static function get_title_style_attr($product_id) {
		$button_settings = get_option('wdp_button_settings', array());
		if (is_array($button_settings)) {
			$brand = isset($button_settings['brand_color']) ? sanitize_hex_color((string) $button_settings['brand_color']) : '';
			$primary = isset($button_settings['button_primary_color']) ? sanitize_hex_color((string) $button_settings['button_primary_color']) : '';
			// Marka veya özel primary varken kategori yeşili başlığı ezmesin.
			$effective = $brand !== '' ? $brand : $primary;
			if ($effective !== '') {
				$legacy_greens = array('#036a37', '#025a2e', '#047857', '#065f46', '#166534', '#14532d');
				$is_legacy_green = in_array(strtolower($effective), $legacy_greens, true);
				if (!$is_legacy_green || $brand !== '') {
					$use_category = (bool) apply_filters('wdp_use_category_title_color_with_brand', false, absint($product_id));
					if (!$use_category) {
						return '';
					}
				}
			}
		}

		$color = self::get_color_for_product($product_id);
		if ($color === '') {
			return '';
		}

		return ' style="color:' . esc_attr($color) . '"';
	}
}

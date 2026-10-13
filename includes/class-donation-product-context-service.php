<?php
/**
 * WC ürününden normalize edilmiş form bağlamı (fiyat, hisse, sadaka) üretir.
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

		// Progress bar forms always collect a custom amount.
		if ($enable_progress_bar) {
			$allow_custom_price = true;
		}

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

		$sadaka_min_price = (string) $product->get_meta('_sadaka_min_price');
		if ($sadaka_min_price === '') {
			$sadaka_min_price = '0';
		}

		$sadaka_fixed_price = (string) $product->get_meta('_sadaka_fixed_price');
		$sadaka_fixed_float = ($sadaka_fixed_price !== '') ? (float) wc_format_decimal($sadaka_fixed_price) : 0.0;
		$sadaka_is_fixed_price = $sadaka_fixed_float > 0;
		$sadaka_wc_product_id = class_exists('WDP_Utils')
			? (string) WDP_Utils::get_configured_sadaka_wc_product_id($product)
			: (string) absint($product->get_meta('_sadaka_wc_product_id'));
		$sadaka_toggle_label = class_exists('WDP_Utils') ? WDP_Utils::get_sadaka_toggle_label($product) : __('Alt Bağış Ekle', 'woo-donation-popup');

		$context = array(
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
			'enable_sadaka_donation'        => $product->get_meta('_enable_sadaka_donation') === 'yes',
			'sadaka_donation_message'       => trim((string) $product->get_meta('_sadaka_donation_message')),
			'sadaka_min_price'              => $sadaka_min_price,
			'sadaka_fixed_price'            => $sadaka_is_fixed_price ? wc_format_decimal($sadaka_fixed_float) : '',
			'sadaka_is_fixed_price'         => $sadaka_is_fixed_price,
			'sadaka_wc_product_id'          => $sadaka_wc_product_id,
			'sadaka_toggle_label'           => $sadaka_toggle_label,
			'currency_symbol'               => WDP_Utils::get_display_currency_symbol(),
			'custom_price_placeholder'      => ((float) ($enable_progress_bar ? $progress_min_price : $min_price) > 0)
				? ('min: ' . WDP_Utils::format_amount_for_min_placeholder($enable_progress_bar ? $progress_min_price : $min_price))
				: '',
			'sadaka_price_placeholder'      => $sadaka_is_fixed_price
				? ''
				: (((float) $sadaka_min_price > 0)
					? ('min: ' . WDP_Utils::format_amount_for_min_placeholder($sadaka_min_price))
					: __('Alt bağış tutarı', 'woo-donation-popup')),
			'enable_trust_strip'            => self::meta_flag_default_yes($product, '_enable_trust_strip'),
			'enable_quantity'               => self::meta_flag_default_yes($product, '_enable_quantity'),
			'enable_amount_presets'         => self::meta_flag_default_yes($product, '_enable_amount_presets'),
			'enable_wizard'                 => $product->get_meta('_enable_wizard') === 'yes',
			'enable_field_icons'            => self::meta_flag_default_yes($product, '_enable_field_icons'),
			'enable_impact_line'            => self::meta_flag_default_yes($product, '_enable_impact_line'),
			'progress_celebrate'            => self::meta_flag_default_yes($product, '_progress_celebrate'),
			'impact_line_text'              => trim((string) $product->get_meta('_impact_line_text')),
			'amount_presets'                => trim((string) $product->get_meta('_amount_presets')),
			'enable_email'                  => self::meta_flag_or_global($product, '_enable_email', 'enable_donor_email'),
			'enable_dedication'             => self::meta_flag_or_global($product, '_enable_dedication', 'enable_dedication'),
			'enable_anonymous'              => self::meta_flag_or_global($product, '_enable_anonymous', 'enable_anonymous'),
			'dedication_placeholder'        => trim((string) $product->get_meta('_dedication_placeholder')),
			'trust_badges'                  => (string) $product->get_meta('_trust_badges'),
			'theme_preset_id'               => sanitize_key((string) $product->get_meta('_theme_preset_id')),
			'theme_primary'                 => (string) $product->get_meta('_theme_primary'),
			'theme_primary_hover'           => (string) $product->get_meta('_theme_primary_hover'),
			'theme_radius'                  => (string) $product->get_meta('_theme_radius'),
			'theme_density'                 => (string) $product->get_meta('_theme_density'),
			'theme_modal_bg'                => (string) $product->get_meta('_theme_modal_bg'),
			'theme_inherit_category'        => $product->get_meta('_theme_inherit_category_color') === 'yes',
			'layout_mode'                   => in_array(sanitize_key((string) $product->get_meta('_layout_mode')), array('classic', 'campaign', 'story'), true)
				? sanitize_key((string) $product->get_meta('_layout_mode'))
				: 'classic',
			'enable_campaign_media'         => $product->get_meta('_enable_campaign_media') === 'yes',
			'enable_urgency'                => $product->get_meta('_enable_urgency') === 'yes',
			'urgency_text'                  => trim((string) $product->get_meta('_urgency_text')),
			'urgency_ends_at'               => trim((string) $product->get_meta('_urgency_ends_at')),
			'enable_social_proof'           => $product->get_meta('_enable_social_proof') === 'yes',
			'social_proof_text'             => trim((string) $product->get_meta('_social_proof_text')),
			'enable_cover_fee'              => $product->get_meta('_enable_cover_fee') === 'yes',
			'cover_fee_percent'             => min(20, max(0, (float) $product->get_meta('_cover_fee_percent'))),
			'module_order'                  => (string) $product->get_meta('_wdp_module_order'),
		);

		return apply_filters('wdp_form_context', $context, $product);
	}

	/**
	 * Post meta yes/no with empty → yes.
	 *
	 * @param WC_Product $product Product.
	 * @param string     $key     Meta key.
	 * @return bool
	 */
	private static function meta_flag_default_yes($product, $key) {
		$raw = $product->get_meta($key);
		if ($raw === '' || $raw === null) {
			return true;
		}
		return $raw === 'yes';
	}

	/**
	 * yes/no meta with empty → global button setting.
	 *
	 * @param WC_Product $product     Product.
	 * @param string     $meta_key    Meta key.
	 * @param string     $global_key  Key in wdp_button_settings.
	 * @return bool
	 */
	private static function meta_flag_or_global($product, $meta_key, $global_key) {
		$raw = $product->get_meta($meta_key);
		if ($raw === 'yes') {
			return true;
		}
		if ($raw === 'no') {
			return false;
		}
		$button = get_option('wdp_button_settings', array());
		return is_array($button) && !empty($button[ $global_key ]) && (string) $button[ $global_key ] === '1';
	}
}

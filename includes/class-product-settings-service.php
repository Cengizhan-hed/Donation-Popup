<?php
/**
 * Admin isteğinden ürün meta ayarlarını normalize eder ve doğrular.
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
	 * Parse loose boolean flags from admin AJAX / form payloads.
	 *
	 * Accepts true|1|yes|on (case-insensitive) and native bool/int.
	 *
	 * @param mixed $value Raw value.
	 * @return bool
	 */
	public static function parse_bool_flag($value) {
		if (is_bool($value)) {
			return $value;
		}
		if (is_int($value) || is_float($value)) {
			return (int) $value === 1;
		}
		$raw = strtolower(trim((string) wp_unslash($value)));
		return in_array($raw, array('1', 'true', 'yes', 'on'), true);
	}

	/**
	 * Normalize product settings payload.
	 *
	 * Progress bar forms always need a custom amount field, so enabling
	 * progress implies `_allow_custom_price = yes`.
	 *
	 * @param array $request Request array.
	 * @return array
	 */
	public static function from_request(array $request) {
		$allow_custom_price     = self::parse_bool_flag(isset($request['allow_custom_price']) ? $request['allow_custom_price'] : false);
		$allow_multiple_shares  = self::parse_bool_flag(isset($request['allow_multiple_shares']) ? $request['allow_multiple_shares'] : false);
		$enable_progress_bar    = self::parse_bool_flag(isset($request['enable_progress_bar']) ? $request['enable_progress_bar'] : false);
		$enable_product_note    = self::parse_bool_flag(isset($request['enable_product_note']) ? $request['enable_product_note'] : false);
		$enable_sadaka_donation = self::parse_bool_flag(isset($request['enable_sadaka_donation']) ? $request['enable_sadaka_donation'] : false);
		$enable_trust_strip     = self::parse_bool_flag(isset($request['enable_trust_strip']) ? $request['enable_trust_strip'] : true);
		$enable_quantity        = self::parse_bool_flag(isset($request['enable_quantity']) ? $request['enable_quantity'] : true);
		$enable_amount_presets  = self::parse_bool_flag(isset($request['enable_amount_presets']) ? $request['enable_amount_presets'] : true);
		$enable_wizard          = self::parse_bool_flag(isset($request['enable_wizard']) ? $request['enable_wizard'] : false);
		$enable_field_icons     = self::parse_bool_flag(isset($request['enable_field_icons']) ? $request['enable_field_icons'] : true);
		$enable_impact_line     = self::parse_bool_flag(isset($request['enable_impact_line']) ? $request['enable_impact_line'] : true);
		$progress_celebrate     = self::parse_bool_flag(isset($request['progress_celebrate']) ? $request['progress_celebrate'] : true);
		$enable_email           = self::parse_bool_flag(isset($request['enable_email']) ? $request['enable_email'] : false);
		$enable_dedication      = self::parse_bool_flag(isset($request['enable_dedication']) ? $request['enable_dedication'] : false);
		$enable_anonymous       = self::parse_bool_flag(isset($request['enable_anonymous']) ? $request['enable_anonymous'] : false);
		$enable_urgency         = self::parse_bool_flag(isset($request['enable_urgency']) ? $request['enable_urgency'] : false);
		$enable_social_proof    = self::parse_bool_flag(isset($request['enable_social_proof']) ? $request['enable_social_proof'] : false);
		$enable_faq             = self::parse_bool_flag(isset($request['enable_faq']) ? $request['enable_faq'] : false);
		$enable_cover_fee       = self::parse_bool_flag(isset($request['enable_cover_fee']) ? $request['enable_cover_fee'] : false);
		$enable_campaign_media  = self::parse_bool_flag(isset($request['enable_campaign_media']) ? $request['enable_campaign_media'] : false);
		$theme_inherit_category = self::parse_bool_flag(isset($request['theme_inherit_category_color']) ? $request['theme_inherit_category_color'] : false);

		// Mutual exclusivity (server-side): progress ⇔ custom amount, shares exclusive.
		if ($enable_progress_bar) {
			$allow_custom_price    = true;
			$allow_multiple_shares = false;
		} elseif ($allow_multiple_shares) {
			$allow_custom_price  = false;
			$enable_progress_bar = false;
		} elseif ($allow_custom_price) {
			$allow_multiple_shares = false;
			$enable_progress_bar   = false;
		}

		$layout_mode = isset($request['layout_mode']) ? sanitize_key((string) wp_unslash($request['layout_mode'])) : 'classic';
		if (!in_array($layout_mode, array('classic', 'campaign', 'story'), true)) {
			$layout_mode = 'classic';
		}

		$theme_density = isset($request['theme_density']) ? sanitize_key((string) wp_unslash($request['theme_density'])) : '';
		if ($theme_density !== '' && !in_array($theme_density, array('compact', 'normal', 'spacious'), true)) {
			$theme_density = '';
		}

		$faq_raw = isset($request['faq_items']) ? $request['faq_items'] : '';
		$faq     = class_exists('WDP_Form_Modules') ? WDP_Form_Modules::sanitize_faq_items($faq_raw) : array();

		$trust_raw    = isset($request['trust_badges']) ? $request['trust_badges'] : '';
		$trust_badges = class_exists('WDP_Form_Modules') ? WDP_Form_Modules::sanitize_trust_badges($trust_raw) : array();

		$module_order = isset($request['module_order']) ? $request['module_order'] : '';
		$order_list   = class_exists('WDP_Form_Modules') ? WDP_Form_Modules::sanitize_order($module_order) : array();

		$amount_presets = isset($request['amount_presets']) ? sanitize_text_field(wp_unslash($request['amount_presets'])) : '';
		if ($amount_presets !== '' && class_exists('WDP_Form_Modules')) {
			$parsed = WDP_Form_Modules::parse_amount_presets_csv($amount_presets);
			$amount_presets = !empty($parsed) ? implode(', ', $parsed) : '';
		}

		$cover_fee_percent = isset($request['cover_fee_percent']) ? (float) wc_format_decimal(wp_unslash($request['cover_fee_percent'])) : 0;
		if ($cover_fee_percent < 0) {
			$cover_fee_percent = 0;
		}
		if ($cover_fee_percent > 15) {
			$cover_fee_percent = 15;
		}

		$theme_radius = isset($request['theme_radius']) ? absint(wp_unslash($request['theme_radius'])) : 0;
		if ($theme_radius > 32) {
			$theme_radius = 32;
		}

		return array(
			'_allow_custom_price'             => $allow_custom_price ? 'yes' : 'no',
			'_min_custom_price'               => isset($request['min_custom_price']) ? wc_format_decimal(wp_unslash($request['min_custom_price'])) : '',
			'_allow_multiple_shares'          => $allow_multiple_shares ? 'yes' : 'no',
			'_max_shares'                     => isset($request['max_shares']) ? absint(wp_unslash($request['max_shares'])) : '',
			'_enable_progress_bar'            => $enable_progress_bar ? 'yes' : 'no',
			'_progress_bar_limit'             => isset($request['progress_bar_limit']) ? wc_format_decimal(wp_unslash($request['progress_bar_limit'])) : '',
			'_enable_product_note'            => $enable_product_note ? 'yes' : 'no',
			'_product_note_text'              => isset($request['product_note_text']) ? sanitize_textarea_field(wp_unslash($request['product_note_text'])) : '',
			'_enable_sadaka_donation'         => $enable_sadaka_donation ? 'yes' : 'no',
			'_sadaka_min_price'               => isset($request['sadaka_min_price']) ? wc_format_decimal(wp_unslash($request['sadaka_min_price'])) : '',
			'_sadaka_fixed_price'             => isset($request['sadaka_fixed_price']) ? wc_format_decimal(wp_unslash($request['sadaka_fixed_price'])) : '',
			'_sadaka_donation_message'        => isset($request['sadaka_donation_message']) ? sanitize_textarea_field(wp_unslash($request['sadaka_donation_message'])) : '',
			'_sadaka_toggle_label'            => isset($request['sadaka_toggle_label']) ? sanitize_text_field(wp_unslash($request['sadaka_toggle_label'])) : '',
			'_sadaka_wc_product_id'           => isset($request['sadaka_wc_product_id']) ? absint(wp_unslash($request['sadaka_wc_product_id'])) : '',
			'_enable_trust_strip'             => $enable_trust_strip ? 'yes' : 'no',
			'_enable_quantity'                => $enable_quantity ? 'yes' : 'no',
			'_enable_amount_presets'          => $enable_amount_presets ? 'yes' : 'no',
			'_enable_wizard'                  => $enable_wizard ? 'yes' : 'no',
			'_enable_field_icons'             => $enable_field_icons ? 'yes' : 'no',
			'_enable_impact_line'             => $enable_impact_line ? 'yes' : 'no',
			'_progress_celebrate'             => $progress_celebrate ? 'yes' : 'no',
			'_impact_line_text'               => isset($request['impact_line_text']) ? sanitize_text_field(wp_unslash($request['impact_line_text'])) : '',
			'_amount_presets'                 => $amount_presets,
			'_enable_email'                   => $enable_email ? 'yes' : '',
			'_enable_dedication'              => $enable_dedication ? 'yes' : '',
			'_enable_anonymous'               => $enable_anonymous ? 'yes' : '',
			'_dedication_placeholder'         => isset($request['dedication_placeholder']) ? sanitize_text_field(wp_unslash($request['dedication_placeholder'])) : '',
			'_trust_badges'                   => !empty($trust_badges) ? wp_json_encode($trust_badges) : '',
			'_theme_preset_id'                => isset($request['theme_preset_id']) ? sanitize_key((string) wp_unslash($request['theme_preset_id'])) : '',
			'_theme_primary'                  => isset($request['theme_primary']) ? (sanitize_hex_color(wp_unslash($request['theme_primary'])) ?: '') : '',
			'_theme_primary_hover'            => isset($request['theme_primary_hover']) ? (sanitize_hex_color(wp_unslash($request['theme_primary_hover'])) ?: '') : '',
			'_theme_radius'                   => $theme_radius > 0 ? (string) $theme_radius : '',
			'_theme_density'                  => $theme_density,
			'_theme_modal_bg'                 => isset($request['theme_modal_bg']) ? (sanitize_hex_color(wp_unslash($request['theme_modal_bg'])) ?: '') : '',
			'_theme_inherit_category_color'   => $theme_inherit_category ? 'yes' : 'no',
			'_layout_mode'                    => $layout_mode,
			'_enable_campaign_media'          => $enable_campaign_media ? 'yes' : 'no',
			'_enable_urgency'                 => $enable_urgency ? 'yes' : 'no',
			'_urgency_text'                   => isset($request['urgency_text']) ? sanitize_text_field(wp_unslash($request['urgency_text'])) : '',
			'_urgency_ends_at'                => isset($request['urgency_ends_at']) ? sanitize_text_field(wp_unslash($request['urgency_ends_at'])) : '',
			'_enable_social_proof'            => $enable_social_proof ? 'yes' : 'no',
			'_social_proof_text'              => isset($request['social_proof_text']) ? sanitize_text_field(wp_unslash($request['social_proof_text'])) : '',
			'_enable_faq'                     => $enable_faq ? 'yes' : 'no',
			'_faq_items'                      => !empty($faq) ? wp_json_encode($faq) : '',
			'_enable_cover_fee'               => $enable_cover_fee ? 'yes' : 'no',
			'_cover_fee_percent'              => $cover_fee_percent > 0 ? (string) $cover_fee_percent : '',
			'_wdp_module_order'               => !empty($order_list) ? implode(',', $order_list) : '',
		);
	}

	/**
	 * Public flags for admin UI sync after save.
	 *
	 * @param array $normalized Meta map from from_request().
	 * @return array
	 */
	public static function public_flags_from_normalized(array $normalized) {
		return array(
			'allow_custom_price'     => (isset($normalized['_allow_custom_price']) && $normalized['_allow_custom_price'] === 'yes'),
			'allow_multiple_shares'  => (isset($normalized['_allow_multiple_shares']) && $normalized['_allow_multiple_shares'] === 'yes'),
			'enable_progress_bar'    => (isset($normalized['_enable_progress_bar']) && $normalized['_enable_progress_bar'] === 'yes'),
			'enable_product_note'    => (isset($normalized['_enable_product_note']) && $normalized['_enable_product_note'] === 'yes'),
			'enable_sadaka_donation' => (isset($normalized['_enable_sadaka_donation']) && $normalized['_enable_sadaka_donation'] === 'yes'),
			'min_custom_price'       => isset($normalized['_min_custom_price']) ? $normalized['_min_custom_price'] : '',
			'max_shares'             => isset($normalized['_max_shares']) ? $normalized['_max_shares'] : '',
			'progress_bar_limit'     => isset($normalized['_progress_bar_limit']) ? $normalized['_progress_bar_limit'] : '',
		);
	}
}

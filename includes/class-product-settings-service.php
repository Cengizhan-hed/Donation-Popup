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
	 * Checkbox fields of the product "Bağış" panel (absent from POST = unchecked).
	 */
	const PANEL_CHECKBOX_FIELDS = array(
		'enable_product_note',
		'enable_sadaka_donation',
		'enable_trust_strip',
		'enable_quantity',
		'enable_amount_presets',
		'enable_impact_line',
		'progress_celebrate',
		'enable_urgency',
		'enable_social_proof',
		'enable_cover_fee',
		'enable_campaign_media',
	);

	/**
	 * Request field => meta key kept as-is when the request does not carry it
	 * (no admin control writes these values). Empty: `_theme_preset_id` is dead meta (not read/written).
	 */
	const PRESERVED_FIELDS = array();

	/**
	 * Keep Unicode as-is so slashing/unslashing on the way to meta cannot strip `\uXXXX` escapes.
	 */
	const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

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
	 * Parse a product flag that can also defer to the global setting.
	 *
	 * Returns `yes`, `no` or `''` (= use global). Legacy boolean payloads keep their
	 * old meaning: true → `yes`, false/unchecked → `''`.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function parse_tristate_flag($value) {
		if ($value === null) {
			return '';
		}
		if (is_bool($value) || is_int($value) || is_float($value)) {
			return self::parse_bool_flag($value) ? 'yes' : '';
		}
		$raw = strtolower(trim((string) wp_unslash($value)));
		if ($raw === 'no') {
			return 'no';
		}
		return in_array($raw, array('1', 'true', 'yes', 'on'), true) ? 'yes' : '';
	}

	/**
	 * Restore Latin letters that older saves stored as bare `u00fc`-style sequences
	 * (a `\uXXXX` JSON escape that lost its backslash).
	 *
	 * Only U+00C0–U+017F (Turkish/Latin letters) are restored so ordinary text is untouched.
	 *
	 * @param string $text Text.
	 * @return string
	 */
	public static function repair_unicode_escapes($text) {
		$text = (string) $text;
		if (strpos($text, 'u0') === false) {
			return $text;
		}
		return (string) preg_replace_callback(
			'/u(0[0-1][0-9a-fA-F]{2})/',
			static function ($m) {
				$code = hexdec($m[1]);
				if ($code < 0xC0 || $code > 0x17F) {
					return $m[0];
				}
				return html_entity_decode('&#' . $code . ';', ENT_QUOTES, 'UTF-8');
			},
			$text
		);
	}

	/**
	 * Fill fields that no admin control sends from the product's existing meta.
	 *
	 * @param array $request       Request array.
	 * @param array $existing_meta Meta key => current value.
	 * @return array
	 */
	public static function with_preserved_fields(array $request, array $existing_meta) {
		foreach (self::PRESERVED_FIELDS as $field => $meta_key) {
			if (!array_key_exists($field, $request)) {
				$request[ $field ] = isset($existing_meta[ $meta_key ]) ? (string) $existing_meta[ $meta_key ] : '';
			}
		}
		return $request;
	}

	/**
	 * Normalize the product edit screen "Bağış" panel payload.
	 *
	 * @param array $posted        Raw (slashed) `$_POST['wdp_donation']`.
	 * @param array $existing_meta Meta key => current value (for preserved fields).
	 * @return array Meta map, same shape as from_request().
	 */
	public static function from_product_panel(array $posted, array $existing_meta = array(), $parent_product_id = 0) {
		$request = $posted;

		foreach (self::PANEL_CHECKBOX_FIELDS as $field) {
			$request[ $field ] = (isset($request[ $field ]) && self::parse_bool_flag($request[ $field ])) ? 'yes' : 'no';
		}

		$request['donation_type'] = WDP_Donation_Type::sanitize(isset($request['donation_type']) ? $request['donation_type'] : '');

		$request['trust_badges'] = self::rows_from_panel(isset($request['trust_badges']) ? $request['trust_badges'] : array(), array('icon', 'text'));

		$custom_order = isset($request['module_order_custom']) && self::parse_bool_flag($request['module_order_custom']);
		$request['module_order'] = ($custom_order && isset($request['module_order']) && is_array($request['module_order']))
			? array_values(array_map('strval', array_filter(wp_unslash($request['module_order']), 'is_scalar')))
			: '';
		unset($request['module_order_custom']);

		$request = self::with_preserved_fields($request, $existing_meta);
		// For Önerilen list check when product presets are empty/rejected (10.29.1).
		$request['__existing_amount_presets'] = isset($existing_meta['_amount_presets'])
			? (is_scalar($existing_meta['_amount_presets']) ? (string) $existing_meta['_amount_presets'] : '')
			: '';
		$normalized = self::from_request($request);
		foreach (self::$rejected_meta as $meta_key) {
			// Rejected input never overwrites stored data (Y3/Y4/Y2).
			if (array_key_exists($meta_key, $existing_meta)) {
				$normalized[ $meta_key ] = is_scalar($existing_meta[ $meta_key ]) ? (string) $existing_meta[ $meta_key ] : '';
			}
		}
		self::$rejected_meta = array();
		return self::validate_sadaka_wc_product_meta($normalized, (int) $parent_product_id);
	}

	/**
	 * Clear invalid _sadaka_wc_product_id and record an admin correction notice.
	 *
	 * @param array $normalized Meta map.
	 * @param int   $parent_id  Parent product ID.
	 * @return array
	 */
	public static function validate_sadaka_wc_product_meta(array $normalized, $parent_id = 0) {
		$raw = isset($normalized['_sadaka_wc_product_id']) ? absint($normalized['_sadaka_wc_product_id']) : 0;
		if ($raw <= 0) {
			$normalized['_sadaka_wc_product_id'] = '';
			return $normalized;
		}

		$result = class_exists('WDP_Sadaka_Product_Visibility')
			? WDP_Sadaka_Product_Visibility::validate_sadaka_product_id($raw, (int) $parent_id)
			: array('ok' => true, 'id' => $raw, 'error' => '');

		if (empty($result['ok'])) {
			$normalized['_sadaka_wc_product_id'] = '';
			if (!empty($result['error'])) {
				self::$corrections[] = $result['error'];
			}
			return $normalized;
		}

		$normalized['_sadaka_wc_product_id'] = (int) $result['id'];
		return $normalized;
	}

	/**
	 * Repeater rows → list of associative rows (unslashed; sanitized later by WDP_Form_Modules).
	 *
	 * @param mixed    $rows Raw rows.
	 * @param string[] $keys Column keys.
	 * @return array<int, array<string, string>>
	 */
	private static function rows_from_panel($rows, array $keys) {
		if (!is_array($rows)) {
			return array();
		}
		$out = array();
		foreach (wp_unslash($rows) as $row) {
			if (!is_array($row)) {
				continue;
			}
			$clean = array();
			foreach ($keys as $key) {
				$clean[ $key ] = isset($row[ $key ]) && is_scalar($row[ $key ]) ? (string) $row[ $key ] : '';
			}
			$out[] = $clean;
		}
		return $out;
	}

	/**
	 * Normalize product settings payload.
	 *
	 * A valid `donation_type` decides the three legacy form-mode flags; without it the
	 * flags are read individually. Progress bar forms always need a custom amount
	 * field, so enabling progress implies `_allow_custom_price = yes`.
	 *
	 * @param array $request Request array.
	 * @return array
	 */
	public static function from_request(array $request) {
		self::$rejected_meta = array();
		self::$corrections   = array();

		$allow_custom_price     = self::parse_bool_flag(isset($request['allow_custom_price']) ? $request['allow_custom_price'] : false);
		$allow_multiple_shares  = self::parse_bool_flag(isset($request['allow_multiple_shares']) ? $request['allow_multiple_shares'] : false);
		$enable_progress_bar    = self::parse_bool_flag(isset($request['enable_progress_bar']) ? $request['enable_progress_bar'] : false);
		$donation_type          = isset($request['donation_type']) ? WDP_Donation_Type::sanitize(wp_unslash($request['donation_type']), '') : '';
		if ($donation_type !== '') {
			$type_flags            = WDP_Donation_Type::to_flags($donation_type);
			$allow_custom_price    = $type_flags['allow_custom_price'];
			$allow_multiple_shares = $type_flags['allow_multiple_shares'];
			$enable_progress_bar   = $type_flags['enable_progress_bar'];
		}
		$enable_product_note    = self::parse_bool_flag(isset($request['enable_product_note']) ? $request['enable_product_note'] : false);
		$enable_sadaka_donation = self::parse_bool_flag(isset($request['enable_sadaka_donation']) ? $request['enable_sadaka_donation'] : false);
		$enable_trust_strip     = self::parse_bool_flag(isset($request['enable_trust_strip']) ? $request['enable_trust_strip'] : true);
		$enable_quantity        = self::parse_bool_flag(isset($request['enable_quantity']) ? $request['enable_quantity'] : true);
		$enable_amount_presets  = self::parse_bool_flag(isset($request['enable_amount_presets']) ? $request['enable_amount_presets'] : true);
		$enable_wizard          = self::parse_tristate_flag(isset($request['enable_wizard']) ? $request['enable_wizard'] : null);
		$enable_field_icons     = self::parse_tristate_flag(isset($request['enable_field_icons']) ? $request['enable_field_icons'] : null);
		$enable_impact_line     = self::parse_bool_flag(isset($request['enable_impact_line']) ? $request['enable_impact_line'] : true);
		$progress_celebrate     = self::parse_bool_flag(isset($request['progress_celebrate']) ? $request['progress_celebrate'] : true);
		$enable_email           = self::parse_tristate_flag(isset($request['enable_email']) ? $request['enable_email'] : null);
		$enable_dedication      = self::parse_tristate_flag(isset($request['enable_dedication']) ? $request['enable_dedication'] : null);
		$enable_anonymous       = self::parse_tristate_flag(isset($request['enable_anonymous']) ? $request['enable_anonymous'] : null);
		$enable_urgency         = self::parse_bool_flag(isset($request['enable_urgency']) ? $request['enable_urgency'] : false);
		$enable_social_proof    = self::parse_bool_flag(isset($request['enable_social_proof']) ? $request['enable_social_proof'] : false);
		$enable_cover_fee       = self::parse_bool_flag(isset($request['enable_cover_fee']) ? $request['enable_cover_fee'] : false);
		$enable_campaign_media = self::parse_bool_flag(isset($request['enable_campaign_media']) ? $request['enable_campaign_media'] : false);

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

		$trust_raw    = isset($request['trust_badges']) ? $request['trust_badges'] : '';
		$trust_badges = class_exists('WDP_Form_Modules') ? WDP_Form_Modules::sanitize_trust_badges($trust_raw) : array();

		// Empty order → '' so the product follows the global order (sanitize_order() would pin the defaults).
		$module_order = isset($request['module_order']) ? $request['module_order'] : '';
		$has_order    = is_array($module_order) ? !empty($module_order) : (is_scalar($module_order) && trim((string) $module_order) !== '');
		$order_list   = ($has_order && class_exists('WDP_Form_Modules')) ? WDP_Form_Modules::sanitize_order($module_order) : array();

		// 10.29.0 (Y3/Y4/Y2): strict validation on save. A rejected field keeps its previous
		// value (restored in from_product_panel from the existing meta) and raises an admin error.
		$amount_presets = '';
		$presets_raw    = isset($request['amount_presets']) && is_scalar($request['amount_presets']) ? sanitize_text_field(wp_unslash((string) $request['amount_presets'])) : '';
		$presets_check  = WDP_Form_Modules::validate_amount_presets_for_save($presets_raw);
		if (!empty($presets_check['ok'])) {
			$amount_presets = !empty($presets_check['amounts']) ? implode(', ', $presets_check['amounts']) : '';
		} else {
			self::reject_meta('_amount_presets', isset($presets_check['error']) ? (string) $presets_check['error'] : '');
		}

		// Effective list for Önerilen: non-empty product list, else stored product list, else global.
		$allowed_for_recommended = array();
		if (!empty($presets_check['ok']) && !empty($presets_check['amounts'])) {
			$allowed_for_recommended = array_map('intval', $presets_check['amounts']);
		} else {
			$fallback_raw = $amount_presets;
			if ($fallback_raw === '' && isset($request['__existing_amount_presets']) && is_scalar($request['__existing_amount_presets'])) {
				$fallback_raw = (string) $request['__existing_amount_presets'];
			}
			$from_product = WDP_Form_Modules::parse_amount_presets_csv($fallback_raw);
			if (!empty($from_product)) {
				$allowed_for_recommended = array_map('intval', $from_product);
			} else {
				$button     = get_option('wdp_button_settings', array());
				$global_raw = (is_array($button) && isset($button['amount_presets'])) ? (string) $button['amount_presets'] : '';
				$allowed_for_recommended = array_map('intval', WDP_Form_Modules::parse_amount_presets_csv($global_raw));
			}
		}

		$recommended     = '';
		$recommended_raw = isset($request['amount_preset_recommended']) && is_scalar($request['amount_preset_recommended'])
			? trim((string) wp_unslash($request['amount_preset_recommended']))
			: '';
		$recommended_check = WDP_Form_Modules::validate_recommended_amount_for_save($recommended_raw, $allowed_for_recommended);
		if (!empty($recommended_check['ok'])) {
			$recommended = isset($recommended_check['value']) ? (string) $recommended_check['value'] : '';
		} else {
			self::reject_meta(
				'_amount_preset_recommended',
				isset($recommended_check['error']) ? (string) $recommended_check['error'] : ''
			);
		}

		$cover_fee_raw   = isset($request['cover_fee_percent']) && is_scalar($request['cover_fee_percent']) ? (string) wp_unslash((string) $request['cover_fee_percent']) : '';
		$cover_fee_check = WDP_Form_Modules::normalize_cover_fee_percent_for_save($cover_fee_raw);
		$cover_fee_percent = 0.0;
		if (!empty($cover_fee_check['ok'])) {
			$cover_fee_percent = (float) $cover_fee_check['percent'];
		} else {
			self::reject_meta('_cover_fee_percent', (string) $cover_fee_check['error']);
		}

		// 0 / empty → '' so the front end falls back to the default share count.
		// Admin + sunucu tek üst sınır: 50 (aşan yeni kayıt hata; mevcut meta silinmez).
		$max_shares_raw = isset($request['max_shares']) ? absint(wp_unslash($request['max_shares'])) : 0;
		if ($max_shares_raw > 50) {
			self::reject_meta('_max_shares', __('The maximum number of shares can be 50.', 'woo-donation-popup'));
			$max_shares = '';
		} elseif ($max_shares_raw > 0) {
			$max_shares = (int) self::clamp_number($max_shares_raw, 1, 50, __('Maximum shares', 'woo-donation-popup'));
		} else {
			$max_shares = '';
		}

		$theme_radius_raw = isset($request['theme_radius']) && is_scalar($request['theme_radius'])
			? trim((string) wp_unslash($request['theme_radius']))
			: '';
		$theme_radius     = '';
		if ($theme_radius_raw !== '' && $theme_radius_raw !== '0') {
			$radius_in  = absint($theme_radius_raw);
			$radius_out = class_exists('WDP_Form_Modules')
				? WDP_Form_Modules::clamp_product_theme_radius($radius_in)
				: max(4, min(32, $radius_in));
			if ($radius_out > 0 && $radius_out !== $radius_in) {
				self::note_clamp(__('Corner radius', 'woo-donation-popup'), (string) $radius_in, (string) $radius_out);
			}
			$theme_radius = $radius_out > 0 ? (string) $radius_out : '';
		}

		$theme_primary = self::parse_theme_hex_field(
			isset($request['theme_primary']) ? $request['theme_primary'] : null,
			'_theme_primary',
			__('Primary color', 'woo-donation-popup')
		);
		$theme_primary_hover = self::parse_theme_hex_field(
			isset($request['theme_primary_hover']) ? $request['theme_primary_hover'] : null,
			'_theme_primary_hover',
			__('Primary color (hover)', 'woo-donation-popup')
		);
		$theme_modal_bg = self::parse_theme_hex_field(
			isset($request['theme_modal_bg']) ? $request['theme_modal_bg'] : null,
			'_theme_modal_bg',
			__('Background color', 'woo-donation-popup')
		);

		if ($theme_primary !== '' && class_exists('WDP_Color_Palette')) {
			$on    = WDP_Color_Palette::pick_on_color($theme_primary);
			$ratio = WDP_Color_Palette::contrast_ratio($theme_primary, $on);
			if ($ratio < 4.5) {
				self::$corrections[] = sprintf(
					/* translators: 1: field label, 2: contrast ratio */
					__('Button text contrast with «%1$s» is %2$s:1 (recommended minimum 4.5:1). Saved; choose a darker or lighter color.', 'woo-donation-popup'),
					__('Primary color', 'woo-donation-popup'),
					number_format_i18n($ratio, 2)
				);
			}
		}
		if ($theme_modal_bg !== '' && class_exists('WDP_Color_Palette')) {
			$text  = WDP_Color_Palette::is_dark_surface($theme_modal_bg) ? '#f8fafc' : '#0f172a';
			$ratio = WDP_Color_Palette::contrast_ratio($theme_modal_bg, $text);
			if ($ratio < 4.5) {
				self::$corrections[] = sprintf(
					/* translators: 1: field label, 2: contrast ratio */
					__('Text contrast with «%1$s» is %2$s:1 (recommended minimum 4.5:1). Saved; choose a lighter or darker background.', 'woo-donation-popup'),
					__('Background color', 'woo-donation-popup'),
					number_format_i18n($ratio, 2)
				);
			}
		}

		$min_raw = isset($request['min_custom_price']) && is_scalar($request['min_custom_price'])
			? (string) wp_unslash($request['min_custom_price'])
			: '0';
		$min_parsed       = self::parse_money_input($min_raw === '' ? '0' : $min_raw);
		$min_custom_price = !empty($min_parsed['ok']) ? (float) $min_parsed['amount'] : 0.0;
		$min_custom_price = self::clamp_number($min_custom_price, 0, 100000000, __('Minimum amount', 'woo-donation-popup'));

		$goal_raw    = isset($request['progress_bar_limit']) && is_scalar($request['progress_bar_limit'])
			? (string) wp_unslash($request['progress_bar_limit'])
			: '';
		$goal_parsed = self::parse_money_input($goal_raw);
		$goal        = !empty($goal_parsed['ok']) ? (float) $goal_parsed['amount'] : 0.0;
		if ($enable_progress_bar) {
			if (empty($goal_parsed['ok']) || $goal <= 0) {
				self::reject_meta(
					'_progress_bar_limit',
					isset($goal_parsed['error']) && $goal_parsed['error'] !== ''
						? (string) $goal_parsed['error']
						: __('The goal amount cannot be empty or zero.', 'woo-donation-popup')
				);
				$goal = 0.0;
			} elseif ($goal > WDP_Campaign_Goal::MAX_GOAL_AMOUNT) {
				self::reject_meta(
					'_progress_bar_limit',
					sprintf(
						/* translators: %s: max amount */
						__('The goal amount can be at most %s.', 'woo-donation-popup'),
						wc_format_decimal(WDP_Campaign_Goal::MAX_GOAL_AMOUNT)
					)
				);
				$goal = 0.0;
			}
		}

		$goal_action = class_exists('WDP_Campaign_Goal')
			? WDP_Campaign_Goal::sanitize_action(isset($request['goal_reached_action']) ? $request['goal_reached_action'] : '')
			: 'message';
		$goal_message_raw = isset($request['goal_reached_message']) && is_scalar($request['goal_reached_message'])
			? (string) wp_unslash($request['goal_reached_message'])
			: '';
		$goal_message = class_exists('WDP_Campaign_Goal')
			? WDP_Campaign_Goal::sanitize_message($goal_message_raw)
			: sanitize_text_field($goal_message_raw);

		$urgency_ends_raw = isset($request['urgency_ends_at']) ? sanitize_text_field(wp_unslash($request['urgency_ends_at'])) : '';
		$urgency_ends_at  = '';
		if ($urgency_ends_raw !== '') {
			$ends_check = self::validate_urgency_ends_at($urgency_ends_raw);
			if (!empty($ends_check['ok'])) {
				$urgency_ends_at = (string) $ends_check['value'];
			} else {
				self::reject_meta('_urgency_ends_at', (string) $ends_check['error']);
			}
		}

		$social_proof_text = isset($request['social_proof_text'])
			? self::limit_text(sanitize_text_field(wp_unslash($request['social_proof_text'])), 200)
			: '';

		return array(
			'_allow_custom_price'             => $allow_custom_price ? 'yes' : 'no',
			'_min_custom_price'               => $min_custom_price > 0 ? wc_format_decimal($min_custom_price) : '0',
			'_allow_multiple_shares'          => $allow_multiple_shares ? 'yes' : 'no',
			'_max_shares'                     => $max_shares,
			'_enable_progress_bar'            => $enable_progress_bar ? 'yes' : 'no',
			'_progress_bar_limit'             => $goal > 0 ? wc_format_decimal($goal) : '',
			'_enable_product_note'            => $enable_product_note ? 'yes' : 'no',
			'_product_note_text'              => isset($request['product_note_text']) ? self::limit_text(sanitize_textarea_field(wp_unslash($request['product_note_text'])), 400) : '',
			'_enable_sadaka_donation'         => $enable_sadaka_donation ? 'yes' : 'no',
			'_sadaka_min_price'               => isset($request['sadaka_min_price']) ? wc_format_decimal(wp_unslash($request['sadaka_min_price'])) : '',
			'_sadaka_fixed_price'             => isset($request['sadaka_fixed_price']) ? wc_format_decimal(wp_unslash($request['sadaka_fixed_price'])) : '',
			'_sadaka_donation_message'        => isset($request['sadaka_donation_message']) ? self::limit_text(sanitize_textarea_field(wp_unslash($request['sadaka_donation_message'])), 500) : '',
			'_sadaka_toggle_label'            => isset($request['sadaka_toggle_label']) ? self::limit_text(sanitize_text_field(wp_unslash($request['sadaka_toggle_label'])), 80) : '',
			'_sadaka_wc_product_id'           => isset($request['sadaka_wc_product_id']) ? absint(wp_unslash($request['sadaka_wc_product_id'])) : '',
			'_enable_trust_strip'             => $enable_trust_strip ? 'yes' : 'no',
			'_enable_quantity'                => $enable_quantity ? 'yes' : 'no',
			'_enable_amount_presets'          => $enable_amount_presets ? 'yes' : 'no',
			'_enable_wizard'                  => $enable_wizard,
			'_enable_field_icons'             => $enable_field_icons,
			'_enable_impact_line'             => $enable_impact_line ? 'yes' : 'no',
			'_progress_celebrate'             => $progress_celebrate ? 'yes' : 'no',
			'_impact_line_text'               => isset($request['impact_line_text']) ? self::limit_text(sanitize_text_field(wp_unslash($request['impact_line_text'])), 200) : '',
			'_amount_presets'                 => $amount_presets,
			'_amount_preset_recommended'      => $recommended,
			'_enable_email'                   => $enable_email,
			'_enable_dedication'              => $enable_dedication,
			'_enable_anonymous'               => $enable_anonymous,
			'_dedication_placeholder'         => isset($request['dedication_placeholder']) ? self::limit_text(sanitize_text_field(wp_unslash($request['dedication_placeholder'])), 120) : '',
			'_trust_badges'                   => !empty($trust_badges) ? wp_json_encode($trust_badges, self::JSON_FLAGS) : '',
			'_theme_primary'                  => $theme_primary,
			'_theme_primary_hover'            => $theme_primary_hover,
			'_theme_radius'                   => $theme_radius,
			'_theme_modal_bg'                 => $theme_modal_bg,
			'_layout_mode'                    => $layout_mode,
			'_enable_campaign_media'          => $enable_campaign_media ? 'yes' : 'no',
			'_enable_urgency'                 => $enable_urgency ? 'yes' : 'no',
			'_urgency_text'                   => isset($request['urgency_text']) ? self::limit_text(sanitize_text_field(wp_unslash($request['urgency_text'])), 200) : '',
			'_urgency_ends_at'                => $urgency_ends_at,
			'_enable_social_proof'            => $enable_social_proof ? 'yes' : 'no',
			'_social_proof_text'              => $social_proof_text,
			'_enable_cover_fee'               => $enable_cover_fee ? 'yes' : 'no',
			'_cover_fee_percent'              => $cover_fee_percent > 0 ? (string) $cover_fee_percent : '',
			'_goal_reached_action'            => $goal_action,
			'_goal_reached_message'           => $goal_message,
			'_wdp_module_order'               => !empty($order_list) ? implode(',', $order_list) : '',
			'_wdp_donation_product'           => self::parse_tristate_flag(isset($request['donation_product']) ? $request['donation_product'] : null),
			'_wdp_auto_place'                 => (isset($request['auto_place']) && is_scalar($request['auto_place']) && strtolower(trim((string) $request['auto_place'])) === 'no') ? 'no' : '',
		);
	}

	/**
	 * Binlik ayırıcılı tutar girişi ("100.000", "100,000.50") → float.
	 *
	 * Ölçüm: PHP `(float) "100.000"` = 100; birim test stub `wc_format_decimal` de dizeyi olduğu gibi
	 * döndürür. Bu yüzden TR/EN binlik kalıpları önce temizlenir, sonra wc_format_decimal kullanılır.
	 *
	 * @param mixed $raw Raw input.
	 * @return array{ok:bool,amount:float,error:string}
	 */
	public static function parse_money_input($raw) {
		$raw = trim((string) $raw);
		if ($raw === '') {
			return array('ok' => false, 'amount' => 0.0, 'error' => __('Please enter a valid amount.', 'woo-donation-popup'));
		}
		// TR: 100.000 veya 100.000,50
		if (preg_match('/^\d{1,3}(\.\d{3})+(,\d{1,6})?$/', $raw)) {
			$normalized = str_replace('.', '', $raw);
			$normalized = str_replace(',', '.', $normalized);
		} elseif (preg_match('/^\d{1,3}(,\d{3})+(\.\d{1,6})?$/', $raw)) {
			// EN: 100,000 or 100,000.50
			$normalized = str_replace(',', '', $raw);
		} else {
			$normalized = function_exists('wc_format_decimal') ? (string) wc_format_decimal($raw) : $raw;
			$normalized = str_replace(',', '.', $normalized);
		}
		if ($normalized === '' || !is_numeric($normalized)) {
			return array(
				'ok'     => false,
				'amount' => 0.0,
				'error'  => __('The goal amount must be a valid number.', 'woo-donation-popup'),
			);
		}
		return array('ok' => true, 'amount' => (float) $normalized, 'error' => '');
	}

	/**
	 * Aciliyet bitiş tarihi: yalnız Y-m-d.
	 *
	 * @param string $raw Raw date.
	 * @return array{ok:bool,value:string,error:string}
	 */
	public static function validate_urgency_ends_at($raw) {
		$raw = trim((string) $raw);
		if ($raw === '') {
			return array('ok' => true, 'value' => '', 'error' => '');
		}
		if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
			return array(
				'ok'    => false,
				'value' => '',
				'error' => __('The end date must be in Y-m-d format (e.g. 2026-12-31).', 'woo-donation-popup'),
			);
		}
		$dt = \DateTimeImmutable::createFromFormat('Y-m-d', $raw);
		$errors = \DateTimeImmutable::getLastErrors();
		$bad = !$dt || (is_array($errors) && (!empty($errors['warning_count']) || !empty($errors['error_count'])));
		if ($bad || $dt->format('Y-m-d') !== $raw) {
			return array(
				'ok'    => false,
				'value' => '',
				'error' => __('The end date must be a valid calendar day.', 'woo-donation-popup'),
			);
		}
		return array('ok' => true, 'value' => $raw, 'error' => '');
	}

	/** @var string[] */
	private static $corrections = array();

	/**
	 * Meta keys whose posted value failed strict validation in the last from_request() call.
	 *
	 * @var string[]
	 */
	private static $rejected_meta = array();

	/**
	 * Mark a meta key as rejected and queue the admin error.
	 *
	 * @param string $meta_key Meta key.
	 * @param string $message  Error text.
	 * @return void
	 */
	private static function reject_meta($meta_key, $message) {
		self::$rejected_meta[] = $meta_key;
		if ($message !== '') {
			self::$corrections[] = $message;
		}
	}

	/**
	 * Meta keys that are strictly validated on save; the product panel passes their current
	 * values as $existing_meta so a rejected field keeps what was stored.
	 */
	const VALIDATED_META_KEYS = array(
		'_amount_presets',
		'_amount_preset_recommended',
		'_cover_fee_percent',
		'_progress_bar_limit',
		'_max_shares',
		'_urgency_ends_at',
		'_theme_primary',
		'_theme_primary_hover',
		'_theme_modal_bg',
	);

	/**
	 * Parse a product theme hex field. Empty clears; `#` optional; invalid → reject (no silent delete).
	 *
	 * @param mixed  $raw      Posted value.
	 * @param string $meta_key Meta key for reject restore.
	 * @param string $label    Field label.
	 * @return string Normalized `#rrggbb` or empty.
	 */
	private static function parse_theme_hex_field($raw, $meta_key, $label) {
		if ($raw === null || !is_scalar($raw)) {
			return '';
		}
		$value = trim((string) wp_unslash($raw));
		if ($value === '') {
			return '';
		}
		$hex = class_exists('WDP_Color_Palette')
			? WDP_Color_Palette::normalize_hex($value)
			: (string) (sanitize_hex_color($value[0] === '#' ? $value : '#' . $value) ?: '');
		if ($hex === '') {
			self::reject_meta(
				$meta_key,
				sprintf(
					/* translators: %s: field label */
					__('«%s» must be a valid color (#RGB or #RRGGBB).', 'woo-donation-popup'),
					$label
				)
			);
			return '';
		}
		return $hex;
	}

	/**
	 * Drain pending correction/warning messages (tests / callers that skip flush).
	 *
	 * @return string[]
	 */
	public static function drain_corrections() {
		$out               = self::$corrections;
		self::$corrections = array();
		return $out;
	}

	/**
	 * @param float  $value Value.
	 * @param float  $min   Min.
	 * @param float  $max   Max.
	 * @param string $label Field label.
	 * @return float
	 */
	private static function clamp_number($value, $min, $max, $label) {
		$clamped = max($min, min($max, $value));
		if ((string) $clamped !== (string) $value) {
			self::note_clamp($label, (string) $value, (string) $clamped);
		}
		return $clamped;
	}

	/**
	 * @param string $label Field.
	 * @param string $from  Original.
	 * @param string $to    Corrected.
	 * @return void
	 */
	private static function note_clamp($label, $from, $to) {
		self::$corrections[] = sprintf(
			/* translators: 1: field name, 2: original value, 3: corrected value */
			__('The «%1$s» value was corrected from %2$s to %3$s.', 'woo-donation-popup'),
			$label,
			$from,
			$to
		);
	}

	/**
	 * @param string $value Text.
	 * @param int    $max   Max length.
	 * @return string
	 */
	private static function limit_text($value, $max) {
		$max = (int) $max;
		if ($max <= 0) {
			return $value;
		}
		if (function_exists('mb_substr') && function_exists('mb_strlen') && mb_strlen($value) > $max) {
			return mb_substr($value, 0, $max);
		}
		if (strlen($value) > $max) {
			return substr($value, 0, $max);
		}
		return $value;
	}

	/**
	 * Push WooCommerce admin notices for values that were clamped on save.
	 *
	 * @return void
	 */
	public static function flush_correction_notices() {
		if (empty(self::$corrections)) {
			return;
		}
		foreach (self::$corrections as $message) {
			if (class_exists('WC_Admin_Meta_Boxes') && method_exists('WC_Admin_Meta_Boxes', 'add_error')) {
				WC_Admin_Meta_Boxes::add_error($message);
			} elseif (function_exists('wc_add_notice')) {
				wc_add_notice($message, 'notice');
			}
		}
		self::$corrections = array();
	}

	/**
	 * Public flags for admin UI sync after save.
	 *
	 * @param array $normalized Meta map from from_request().
	 * @return array
	 */
	public static function public_flags_from_normalized(array $normalized) {
		return array(
			'donation_type'          => WDP_Donation_Type::infer_from_meta($normalized),
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

<?php
/**
 * Form, başarı ekranı, progress bar, modal ve Meta Pixel ayar isteklerini normalize eder.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Normalizes and bounds admin settings payloads.
 */
class WDP_Admin_Settings_Normalizer {
	/**
	 * Strict-validation error of the last normalize_normal_form_settings() call ('' = none).
	 * Admin save handlers must refuse to persist the option when this is not empty (10.29.0).
	 *
	 * @var string
	 */
	public static $last_validation_error = '';

	/**
	 * Normalize normal form settings.
	 *
	 * @param array $request Raw request payload.
	 * @return array
	 */
	public static function normalize_normal_form_settings(array $request) {
		self::$last_validation_error = '';
		$existing = WDP_Utils::migrate_button_shadow_to_sc_modal(
			WDP_Utils::normalize_legacy_popup_button_text(
				get_option('wdp_button_settings', array())
			)
		);

		$popup_btn_text_color = self::pick_hex($request, $existing, 'popup_button_text_color', '#ffffff');

		$settings = array(
			'button_primary_color'              => self::pick_hex($request, $existing, 'button_primary_color', '#0f608b'),
			'button_primary_hover'              => self::pick_hex($request, $existing, 'button_primary_hover', '#0c4f72'),
			'ui_border_radius'                  => isset($request['ui_border_radius'])
				? absint($request['ui_border_radius'])
				: (isset($request['button_border_radius'])
					? absint($request['button_border_radius'])
					: self::pick_int($request, $existing, 'ui_border_radius', 10)),
			'button_border_radius'              => self::pick_int($request, $existing, 'button_border_radius', 10),
			'button_text_add_to_cart'           => self::pick_text($request, $existing, 'button_text_add_to_cart', 'Sepete Ekle'),
			'button_text_go_checkout'           => self::pick_text($request, $existing, 'button_text_go_checkout', 'Ödemeye Git'),
			'modal_background_color'            => self::pick_hex($request, $existing, 'modal_background_color', '#ffffff'),
			'modal_border_radius'               => self::pick_int($request, $existing, 'modal_border_radius', 10),
			'input_border_color'                => self::pick_hex($request, $existing, 'input_border_color', '#d1d5db'),
			'input_border_radius'               => self::pick_int($request, $existing, 'input_border_radius', 10),
			'title_color'                       => self::pick_hex($request, $existing, 'title_color', '#1f2937'),
			'title_font_size'                   => self::pick_int($request, $existing, 'title_font_size', 27),
			'title_font_size_mobile'            => isset($request['title_font_size_mobile']) && '' !== $request['title_font_size_mobile']
				? absint($request['title_font_size_mobile'])
				: (isset($existing['title_font_size_mobile']) && '' !== $existing['title_font_size_mobile'] ? absint($existing['title_font_size_mobile']) : 0),
			'close_button_color'                => self::pick_hex($request, $existing, 'close_button_color', '#6b7280'),
			'button_checkout_color'             => self::pick_hex($request, $existing, 'button_checkout_color', '#16a34a'),
			'button_checkout_hover'             => self::pick_hex($request, $existing, 'button_checkout_hover', '#15803d'),
			'popup_button_text'                 => self::pick_text($request, $existing, 'popup_button_text', 'Bağış Yap'),
			'popup_button_color'                => self::pick_hex($request, $existing, 'popup_button_color', '#0f608b'),
			'popup_button_hover'                => self::pick_hex($request, $existing, 'popup_button_hover', '#0c4f72'),
			'popup_button_text_color'           => $popup_btn_text_color,
			'popup_button_font_size'            => self::pick_int($request, $existing, 'popup_button_font_size', 18),
			'popup_button_font_weight'          => self::pick_text($request, $existing, 'popup_button_font_weight', '700'),
			'popup_button_font_family'          => self::pick_text($request, $existing, 'popup_button_font_family', 'inherit'),
			'popup_button_custom_font'          => self::pick_text($request, $existing, 'popup_button_custom_font', ''),
			'popup_button_size'                 => (isset($request['popup_button_size']) && in_array($request['popup_button_size'], array('custom', 'small', 'medium', 'large', 'xlarge'), true)) ? sanitize_text_field($request['popup_button_size']) : (isset($existing['popup_button_size']) ? sanitize_text_field($existing['popup_button_size']) : 'large'),
			'shortcode_button_size'             => (isset($request['shortcode_button_size']) && in_array(strtolower((string) $request['shortcode_button_size']), array('small', 'medium', 'large', 'xlarge'), true)) ? strtolower(sanitize_text_field($request['shortcode_button_size'])) : (isset($existing['shortcode_button_size']) && in_array(strtolower((string) $existing['shortcode_button_size']), array('small', 'medium', 'large', 'xlarge'), true) ? strtolower(sanitize_text_field($existing['shortcode_button_size'])) : 'medium'),
			'popup_button_custom_min_width'     => self::pick_int($request, $existing, 'popup_button_custom_min_width', 140),
			'popup_button_custom_min_height'    => self::pick_int($request, $existing, 'popup_button_custom_min_height', 48),
			'popup_button_custom_padding_x'     => self::pick_int($request, $existing, 'popup_button_custom_padding_x', 24),
			'popup_button_border_radius'        => self::pick_int($request, $existing, 'popup_button_border_radius', 10),
			'popup_button_border_size'          => self::pick_int($request, $existing, 'popup_button_border_size', 0),
			'popup_button_full_width'           => self::pick_flag($request, $existing, 'popup_button_full_width', '0'),
			'label_color'                       => self::pick_hex($request, $existing, 'label_color', '#374151'),
			'label_font_size'                   => self::pick_int($request, $existing, 'label_font_size', 14),
			'label_font_weight'                 => self::pick_text($request, $existing, 'label_font_weight', '600'),
			'placeholder_color'                 => self::pick_hex($request, $existing, 'placeholder_color', '#64748b'),
			'form_gap'                          => self::pick_int($request, $existing, 'form_gap', 16),
			'form_button_order'                 => isset($request['form_button_order']) ? (('checkout_first' === $request['form_button_order']) ? 'checkout_first' : 'add_first') : (isset($existing['form_button_order']) && 'checkout_first' === $existing['form_button_order'] ? 'checkout_first' : 'add_first'),
			'form_button_alignment'             => in_array(isset($request['form_button_alignment']) ? $request['form_button_alignment'] : (isset($existing['form_button_alignment']) ? $existing['form_button_alignment'] : 'left'), array('left', 'center', 'right'), true) ? sanitize_text_field(isset($request['form_button_alignment']) ? $request['form_button_alignment'] : (isset($existing['form_button_alignment']) ? $existing['form_button_alignment'] : 'left')) : 'left',
			'enable_multi_step'                 => self::pick_flag($request, $existing, 'enable_multi_step', '0'),
			'enable_amount_presets'             => self::pick_flag($request, $existing, 'enable_amount_presets', '0'),
			'amount_presets'                    => self::pick_text($request, $existing, 'amount_presets', '100, 250, 500, 1000, 2500'),
			'style_preset_id'                   => isset($request['style_preset_id']) ? sanitize_key((string) wp_unslash($request['style_preset_id'])) : (isset($existing['style_preset_id']) ? sanitize_key((string) $existing['style_preset_id']) : 'classic'),
			'brand_color'                       => (isset($request['brand_color']) && sanitize_hex_color($request['brand_color']))
				? sanitize_hex_color($request['brand_color'])
				: ((isset($existing['brand_color']) && sanitize_hex_color($existing['brand_color']))
					? sanitize_hex_color($existing['brand_color'])
					: self::pick_hex($request, $existing, 'button_primary_color', '#0f608b')),
			'enable_field_icons'                => self::pick_flag($request, $existing, 'enable_field_icons', '1'),
			'trust_strip_enabled'               => self::pick_flag($request, $existing, 'trust_strip_enabled', '0'),
			'trust_strip_text'                  => self::pick_text($request, $existing, 'trust_strip_text', __('Güvenli ödeme · SSL korumalı işlem', 'woo-donation-popup')),
			'icon_field_user'                   => class_exists('WDP_Icon_Library')
				? WDP_Icon_Library::sanitize_icon_value(isset($request['icon_field_user']) ? $request['icon_field_user'] : (isset($existing['icon_field_user']) ? $existing['icon_field_user'] : 'builtin:user'), 'builtin:user')
				: 'builtin:user',
			'icon_field_note'                   => class_exists('WDP_Icon_Library')
				? WDP_Icon_Library::sanitize_icon_value(isset($request['icon_field_note']) ? $request['icon_field_note'] : (isset($existing['icon_field_note']) ? $existing['icon_field_note'] : 'builtin:note'), 'builtin:note')
				: 'builtin:note',
			'icon_field_email'                  => class_exists('WDP_Icon_Library')
				? WDP_Icon_Library::sanitize_icon_value(isset($request['icon_field_email']) ? $request['icon_field_email'] : (isset($existing['icon_field_email']) ? $existing['icon_field_email'] : 'builtin:email'), 'builtin:email')
				: 'builtin:email',
			'icon_cart'                         => class_exists('WDP_Icon_Library')
				? WDP_Icon_Library::sanitize_icon_value(isset($request['icon_cart']) ? $request['icon_cart'] : (isset($existing['icon_cart']) ? $existing['icon_cart'] : 'builtin:cart'), 'builtin:cart')
				: 'builtin:cart',
			'icon_checkout'                     => class_exists('WDP_Icon_Library')
				? WDP_Icon_Library::sanitize_icon_value(isset($request['icon_checkout']) ? $request['icon_checkout'] : (isset($existing['icon_checkout']) ? $existing['icon_checkout'] : 'builtin:checkout'), 'builtin:checkout')
				: 'builtin:checkout',
			'icon_trust'                        => class_exists('WDP_Icon_Library')
				? WDP_Icon_Library::sanitize_icon_value(isset($request['icon_trust']) ? $request['icon_trust'] : (isset($existing['icon_trust']) ? $existing['icon_trust'] : 'builtin:shield'), 'builtin:shield')
				: 'builtin:shield',
			'icon_continue'                     => class_exists('WDP_Icon_Library')
				? WDP_Icon_Library::sanitize_icon_value(isset($request['icon_continue']) ? $request['icon_continue'] : (isset($existing['icon_continue']) ? $existing['icon_continue'] : 'builtin:continue'), 'builtin:continue')
				: 'builtin:continue',
			'icon_field_phone'                  => class_exists('WDP_Icon_Library')
				? WDP_Icon_Library::sanitize_icon_value(isset($request['icon_field_phone']) ? $request['icon_field_phone'] : (isset($existing['icon_field_phone']) ? $existing['icon_field_phone'] : 'builtin:phone'), 'builtin:phone')
				: 'builtin:phone',
			'icon_success'                      => class_exists('WDP_Icon_Library')
				? WDP_Icon_Library::sanitize_icon_value(isset($request['icon_success']) ? $request['icon_success'] : (isset($existing['icon_success']) ? $existing['icon_success'] : 'builtin:check'), 'builtin:check')
				: 'builtin:check',
			'icon_sadaka'                       => class_exists('WDP_Icon_Library')
				? WDP_Icon_Library::sanitize_icon_value(isset($request['icon_sadaka']) ? $request['icon_sadaka'] : (isset($existing['icon_sadaka']) ? $existing['icon_sadaka'] : 'builtin:gift'), 'builtin:gift')
				: 'builtin:gift',
			'icon_progress'                     => class_exists('WDP_Icon_Library')
				? WDP_Icon_Library::sanitize_icon_value(isset($request['icon_progress']) ? $request['icon_progress'] : (isset($existing['icon_progress']) ? $existing['icon_progress'] : 'builtin:star'), 'builtin:star')
				: 'builtin:star',
			'form_density'                      => in_array(isset($request['form_density']) ? $request['form_density'] : (isset($existing['form_density']) ? $existing['form_density'] : 'normal'), array('compact', 'normal', 'spacious'), true)
				? sanitize_text_field(isset($request['form_density']) ? $request['form_density'] : (isset($existing['form_density']) ? $existing['form_density'] : 'normal'))
				: 'normal',
			'glass_blur_px'                     => self::pick_int($request, $existing, 'glass_blur_px', 22),
			'glass_fill_opacity'                => self::pick_int($request, $existing, 'glass_fill_opacity', 90),
			'elevation_level'                   => self::pick_int($request, $existing, 'elevation_level', 3),
			'overlay_tint'                      => self::pick_hex($request, $existing, 'overlay_tint', '#0f172a'),
			'overlay_opacity'                   => self::pick_int($request, $existing, 'overlay_opacity', 52),
			'body_font_family'                  => self::pick_text($request, $existing, 'body_font_family', 'inherit'),
			'motion_intensity'                  => in_array(isset($request['motion_intensity']) ? $request['motion_intensity'] : (isset($existing['motion_intensity']) ? $existing['motion_intensity'] : 'normal'), array('subtle', 'normal', 'expressive'), true)
				? sanitize_text_field(isset($request['motion_intensity']) ? $request['motion_intensity'] : (isset($existing['motion_intensity']) ? $existing['motion_intensity'] : 'normal'))
				: 'normal',
			'chip_style'                        => in_array(isset($request['chip_style']) ? $request['chip_style'] : (isset($existing['chip_style']) ? $existing['chip_style'] : 'soft'), array('soft', 'outline', 'solid'), true)
				? sanitize_text_field(isset($request['chip_style']) ? $request['chip_style'] : (isset($existing['chip_style']) ? $existing['chip_style'] : 'soft'))
				: 'soft',
			'enable_donor_email'                => self::pick_flag($request, $existing, 'enable_donor_email', '0'),
			'enable_dedication'                 => self::pick_flag($request, $existing, 'enable_dedication', '0'),
			'enable_anonymous'                  => self::pick_flag($request, $existing, 'enable_anonymous', '0'),
			'dedication_placeholder'            => self::pick_text($request, $existing, 'dedication_placeholder', __('Kimin adına? (isteğe bağlı)', 'woo-donation-popup')),
			'enable_privacy_notice'             => self::pick_flag($request, $existing, 'enable_privacy_notice', '0'),
			'privacy_notice_text'               => self::pick_text(
				$request,
				$existing,
				'privacy_notice_text',
				__(
					'Kişisel verileriniz bağışınızın gerçekleştirilmesi için işlenir ve yurt dışındaki saha ekiplerimizle paylaşılır. Ayrıntı için Aydınlatma Metni\'ne bakın.',
					'woo-donation-popup'
				)
			),
			'privacy_notice_url'                => self::pick_text($request, $existing, 'privacy_notice_url', ''),
			'module_order'                      => isset($request['module_order'])
				? (class_exists('WDP_Form_Modules') ? implode(',', WDP_Form_Modules::sanitize_header_order(wp_unslash($request['module_order']))) : sanitize_text_field(wp_unslash($request['module_order'])))
				: (isset($existing['module_order']) ? (string) $existing['module_order'] : ''),
			'trust_badges'                      => isset($request['trust_badges'])
				? (class_exists('WDP_Form_Modules') ? wp_json_encode(WDP_Form_Modules::sanitize_trust_badges($request['trust_badges'])) : '')
				: (isset($existing['trust_badges']) ? (is_string($existing['trust_badges']) ? $existing['trust_badges'] : wp_json_encode($existing['trust_badges'])) : ''),
		);

		foreach (array('sc', 'modal') as $slot) {
			$pre = 'button_shadow_' . $slot . '_';
			$settings[ $pre . 'enabled' ]        = self::pick_flag($request, $existing, $pre . 'enabled', '0');
			$settings[ $pre . 'hover_enhanced' ] = self::pick_flag($request, $existing, $pre . 'hover_enhanced', '0');
			$settings[ $pre . 'color' ]          = self::pick_hex($request, $existing, $pre . 'color', '#94a3b8');
			$settings[ $pre . 'x' ]              = isset($request[ $pre . 'x' ]) ? (int) $request[ $pre . 'x' ] : (isset($existing[ $pre . 'x' ]) ? (int) $existing[ $pre . 'x' ] : 0);
			$settings[ $pre . 'y' ]              = isset($request[ $pre . 'y' ]) ? (int) $request[ $pre . 'y' ] : (isset($existing[ $pre . 'y' ]) ? (int) $existing[ $pre . 'y' ] : 8);
			$settings[ $pre . 'blur' ]           = self::pick_int($request, $existing, $pre . 'blur', 20);
			$settings[ $pre . 'spread' ]         = isset($request[ $pre . 'spread' ]) ? (int) $request[ $pre . 'spread' ] : (isset($existing[ $pre . 'spread' ]) ? (int) $existing[ $pre . 'spread' ] : 0);
			$settings[ $pre . 'hover_blur' ]     = self::pick_int($request, $existing, $pre . 'hover_blur', 24);
			$settings[ $pre . 'hover_color' ]    = isset($request[ $pre . 'hover_color' ])
				? (sanitize_hex_color($request[ $pre . 'hover_color' ]) ?: '')
				: (isset($existing[ $pre . 'hover_color' ]) ? (sanitize_hex_color($existing[ $pre . 'hover_color' ]) ?: '') : '');
			$settings[ $pre . 'hover_x' ]        = isset($request[ $pre . 'hover_x' ]) ? (int) $request[ $pre . 'hover_x' ] : (isset($existing[ $pre . 'hover_x' ]) ? (int) $existing[ $pre . 'hover_x' ] : 0);
			$settings[ $pre . 'hover_y' ]        = isset($request[ $pre . 'hover_y' ]) ? (int) $request[ $pre . 'hover_y' ] : (isset($existing[ $pre . 'hover_y' ]) ? (int) $existing[ $pre . 'hover_y' ] : 10);
			$settings[ $pre . 'hover_spread' ]   = isset($request[ $pre . 'hover_spread' ]) ? (int) $request[ $pre . 'hover_spread' ] : (isset($existing[ $pre . 'hover_spread' ]) ? (int) $existing[ $pre . 'hover_spread' ] : 0);
		}

		$settings['ui_border_radius'] = self::clamp_max(isset($settings['ui_border_radius']) ? (int) $settings['ui_border_radius'] : 10, 50);
		// Tek UI radius → tüm yüzeyler (geriye dönük alanlar senkron)
		$settings['button_border_radius'] = $settings['ui_border_radius'];
		$settings['modal_border_radius'] = $settings['ui_border_radius'];
		$settings['input_border_radius'] = $settings['ui_border_radius'];
		$settings['popup_button_border_radius'] = $settings['ui_border_radius'];
		$settings['form_gap'] = self::clamp_range($settings['form_gap'], 4, 40);
		$settings['title_font_size'] = self::clamp_range($settings['title_font_size'], 14, 48);
		if (isset($settings['glass_blur_px'])) {
			$settings['glass_blur_px'] = self::clamp_range((int) $settings['glass_blur_px'], 0, 40);
		}
		if (isset($settings['glass_fill_opacity'])) {
			$settings['glass_fill_opacity'] = self::clamp_range((int) $settings['glass_fill_opacity'], 60, 100);
		}
		if (isset($settings['elevation_level'])) {
			$settings['elevation_level'] = self::clamp_range((int) $settings['elevation_level'], 1, 5);
		}
		if (isset($settings['overlay_opacity'])) {
			$settings['overlay_opacity'] = self::clamp_range((int) $settings['overlay_opacity'], 20, 80);
		}

		// 10.29.0 (Y3/Y4/Y6): strict list validation. A changed, invalid value is rejected (the
		// stored list is kept and last_validation_error is set); an UNCHANGED legacy value is
		// tolerated and soft-cleaned so unrelated tabs (e.g. Design Studio) can still save.
		$default_presets = '100, 250, 500, 1000, 2500';
		$preset_raw      = isset($settings['amount_presets']) ? trim((string) $settings['amount_presets']) : '';
		$stored_presets  = isset($existing['amount_presets']) ? trim(sanitize_text_field((string) $existing['amount_presets'])) : '';
		$preset_check    = WDP_Form_Modules::validate_amount_presets_for_save($preset_raw);
		if (!empty($preset_check['ok'])) {
			$settings['amount_presets'] = !empty($preset_check['amounts']) ? implode(', ', $preset_check['amounts']) : $default_presets;
		} else {
			$kept = WDP_Form_Modules::parse_amount_presets_csv($stored_presets);
			if ($preset_raw !== $stored_presets) {
				self::$last_validation_error = isset($preset_check['error']) ? (string) $preset_check['error'] : '';
			}
			$settings['amount_presets'] = !empty($kept)
				? implode(', ', array_map('intval', $kept))
				: $default_presets;
		}

		// 10.29.1 (K2): genel amount_preset_recommended kaldırıldı; eski anahtar sessizce yok sayılır.
		unset($settings['amount_preset_recommended']);
		if (!empty($settings['title_font_size_mobile'])) {
			$settings['title_font_size_mobile'] = self::clamp_range($settings['title_font_size_mobile'], 12, 40);
		}
		$settings['popup_button_font_size'] = self::clamp_range($settings['popup_button_font_size'], 12, 32);
		$settings['popup_button_border_size'] = self::clamp_max($settings['popup_button_border_size'], 20);
		$settings['popup_button_custom_min_width'] = self::clamp_range($settings['popup_button_custom_min_width'], 80, 420);
		$settings['popup_button_custom_min_height'] = self::clamp_range($settings['popup_button_custom_min_height'], 36, 100);
		$settings['popup_button_custom_padding_x'] = self::clamp_range($settings['popup_button_custom_padding_x'], 8, 64);

		foreach (array('sc', 'modal') as $slot) {
			$pre = 'button_shadow_' . $slot . '_';
			$settings[ $pre . 'x' ]            = self::clamp_range((int) $settings[ $pre . 'x' ], -24, 24);
			$settings[ $pre . 'y' ]            = self::clamp_range((int) $settings[ $pre . 'y' ], -24, 24);
			$settings[ $pre . 'blur' ]         = self::clamp_range((int) $settings[ $pre . 'blur' ], 0, 48);
			$settings[ $pre . 'spread' ]       = self::clamp_range((int) $settings[ $pre . 'spread' ], -8, 12);
			$settings[ $pre . 'hover_blur' ]   = self::clamp_range((int) $settings[ $pre . 'hover_blur' ], 0, 48);
			$settings[ $pre . 'hover_x' ]      = self::clamp_range((int) $settings[ $pre . 'hover_x' ], -24, 24);
			$settings[ $pre . 'hover_y' ]      = self::clamp_range((int) $settings[ $pre . 'hover_y' ], -24, 24);
			$settings[ $pre . 'hover_spread' ] = self::clamp_range((int) $settings[ $pre . 'hover_spread' ], -8, 12);
			$base_c                            = sanitize_hex_color($settings[ $pre . 'color' ]);
			$settings[ $pre . 'color' ]        = $base_c ? $base_c : '#94a3b8';
			if ('1' === $settings[ $pre . 'hover_enhanced' ]) {
				$h_c                               = sanitize_hex_color($settings[ $pre . 'hover_color' ]);
				$settings[ $pre . 'hover_color' ] = $h_c ? $h_c : $settings[ $pre . 'color' ];
			} else {
				$settings[ $pre . 'hover_color' ] = '';
			}
		}
		$settings['button_text_donate'] = $settings['popup_button_text'];

		return $settings;
	}

	/**
	 * Normalize shareholder settings.
	 *
	 * @param array $request Raw request payload.
	 * @return array
	 */
	public static function normalize_shareholder_settings(array $request) {
		$existing = get_option('wdp_shareholder_settings', array());
		if (!is_array($existing)) {
			$existing = array();
		}

		$solid_requested = isset($request['shareholders_area_bg']) ? sanitize_hex_color($request['shareholders_area_bg']) : '';
		if (!$solid_requested && !empty($existing['shareholders_area_bg'])) {
			$solid_requested = WDP_Utils::coerce_solid_hex_background($existing['shareholders_area_bg'], '#fafbfc');
		}
		if (!$solid_requested) {
			$solid_requested = '#fafbfc';
		}

		$pick_hex = static function ($key, $default) use ($request, $existing) {
			return self::pick_hex($request, $existing, $key, $default);
		};

		$pick_int = static function ($key, $default) use ($request, $existing) {
			if (isset($request[ $key ]) && '' !== $request[ $key ]) {
				return absint($request[ $key ]);
			}
			if (isset($existing[ $key ]) && '' !== $existing[ $key ]) {
				return absint($existing[ $key ]);
			}
			return $default;
		};

		$pick_text = static function ($key, $default) use ($request, $existing) {
			if (isset($request[ $key ])) {
				return sanitize_text_field($request[ $key ]);
			}
			if (isset($existing[ $key ]) && '' !== $existing[ $key ]) {
				return sanitize_text_field($existing[ $key ]);
			}
			return $default;
		};

		$settings = array(
			'shareholder_card_bg'            => $pick_hex('shareholder_card_bg', '#ffffff'),
			'shareholder_card_border'        => $pick_hex('shareholder_card_border', '#f0f2f5'),
			'shareholder_card_radius'        => $pick_int('shareholder_card_radius', 10),
			'shareholder_card_shadow'        => $pick_text('shareholder_card_shadow', '0 1px 3px rgba(0, 0, 0, 0.05)'),
			'shareholder_header_bg'          => $pick_hex('shareholder_header_bg', '#0f608b'),
			'shareholder_header_color'       => $pick_hex('shareholder_header_color', '#ffffff'),
			'shareholder_header_bg_hover'    => $pick_hex('shareholder_header_bg_hover', '#0c4f72'),
			'shareholder_content_padding'    => $pick_int('shareholder_content_padding', 12),
			'shareholders_area_bg'           => $solid_requested,
			'shareholders_area_border'       => self::pick_hex($request, $existing, 'shareholders_area_border', '#e1e5e9'),
			'shareholders_area_radius'       => $pick_int('shareholders_area_radius', 10),
			'shareholders_scrollbar_color'   => $pick_hex('shareholders_scrollbar_color', '#0f608b'),
			'share_counter_border'           => $pick_hex('share_counter_border', '#d1d5db'),
			'share_counter_bg'               => $pick_hex('share_counter_bg', '#ffffff'),
			'share_counter_button_color'     => $pick_hex('share_counter_button_color', '#888888'),
			'shareholder_header_text'        => $pick_text('shareholder_header_text', 'Hissedar Bilgileri'),
			'shareholder_name_placeholder'   => $pick_text('shareholder_name_placeholder', 'Ad Soyad *'),
			'shareholder_phone_placeholder'  => $pick_text('shareholder_phone_placeholder', 'Telefon Numarası *'),
			'shareholder_note_placeholder'   => $pick_text('shareholder_note_placeholder', 'Not (isteğe bağlı)'),
			'shareholder_copy_button_text'   => $pick_text('shareholder_copy_button_text', 'Kopyasını Oluştur'),
			'shareholder_enable_copy_button' => isset($request['shareholder_enable_copy_button'])
				? ('1' === (string) $request['shareholder_enable_copy_button'] ? '1' : '0')
				: (isset($existing['shareholder_enable_copy_button']) ? (('1' === (string) $existing['shareholder_enable_copy_button']) ? '1' : '0') : '0'),
			'shareholder_layout'             => isset($request['shareholder_layout'])
				? ('two-column' === $request['shareholder_layout'] ? 'two-column' : 'single')
				: (isset($existing['shareholder_layout']) && 'two-column' === $existing['shareholder_layout'] ? 'two-column' : 'single'),
			'shareholder_density'            => in_array(isset($request['shareholder_density']) ? $request['shareholder_density'] : (isset($existing['shareholder_density']) ? $existing['shareholder_density'] : 'normal'), array('compact', 'normal', 'spacious'), true)
				? sanitize_text_field(isset($request['shareholder_density']) ? $request['shareholder_density'] : (isset($existing['shareholder_density']) ? $existing['shareholder_density'] : 'normal'))
				: 'normal',
			'shareholder_enable_email'       => isset($request['shareholder_enable_email'])
				? ('1' === (string) $request['shareholder_enable_email'] ? '1' : '0')
				: (isset($existing['shareholder_enable_email']) ? (('1' === (string) $existing['shareholder_enable_email']) ? '1' : '0') : '0'),
			'shareholder_email_placeholder'  => $pick_text('shareholder_email_placeholder', 'E-posta (isteğe bağlı)'),
		);

		$settings['shareholder_card_radius'] = self::clamp_max($settings['shareholder_card_radius'], 50);
		$settings['shareholders_area_radius'] = self::clamp_max($settings['shareholders_area_radius'], 50);
		$settings['shareholder_content_padding'] = self::clamp_max($settings['shareholder_content_padding'], 30);

		return $settings;
	}

	/**
	 * Normalize success screen settings.
	 *
	 * @param array $request Raw request payload.
	 * @return array
	 */
	public static function normalize_success_screen_settings(array $request) {
		$existing = get_option('wdp_success_settings', array());
		if (!is_array($existing)) {
			$existing = array();
		}

		$settings = array(
			'success_button_color'      => self::pick_hex($request, $existing, 'success_button_color', '#0f608b'),
			'success_button_hover'      => self::pick_hex($request, $existing, 'success_button_hover', '#0c4f72'),
			'success_button_radius'     => self::pick_int($request, $existing, 'success_button_radius', 10),
			'success_text_view_cart'    => self::pick_text($request, $existing, 'success_text_view_cart', 'Sepete Git'),
			'success_text_go_checkout'  => self::pick_text($request, $existing, 'success_text_go_checkout', 'Bağışı Tamamla'),
			'success_text_new_donation' => self::pick_text($request, $existing, 'success_text_new_donation', 'Bağış eklemeye devam edin'),
			'success_message_bg'        => self::pick_text($request, $existing, 'success_message_bg', 'rgba(22, 163, 74, 0.1)'),
			'success_message_color'     => self::pick_hex($request, $existing, 'success_message_color', '#16a34a'),
			'success_message_border'    => self::pick_text($request, $existing, 'success_message_border', 'rgba(22, 163, 74, 0.2)'),
			'success_message_radius'    => self::pick_int($request, $existing, 'success_message_radius', 10),
			'mini_cart_bg'              => self::pick_hex($request, $existing, 'mini_cart_bg', '#f9fafb'),
			'mini_cart_border'          => self::pick_hex($request, $existing, 'mini_cart_border', '#e5e7eb'),
			'mini_cart_radius'          => self::pick_int($request, $existing, 'mini_cart_radius', 10),
			'cart_item_name_color'      => self::pick_hex($request, $existing, 'cart_item_name_color', '#1f2937'),
			'cart_item_price_color'     => self::pick_hex($request, $existing, 'cart_item_price_color', '#0f608b'),
			'sadaka_wc_product_id'      => isset($request['sadaka_wc_product_id']) ? absint($request['sadaka_wc_product_id']) : (isset($existing['sadaka_wc_product_id']) ? absint($existing['sadaka_wc_product_id']) : 0),
			'sadaka_toggle_label'       => self::pick_text($request, $existing, 'sadaka_toggle_label', __('Alt Bağış Ekle', 'woo-donation-popup')),
		);
		if ($settings['sadaka_wc_product_id'] <= 0) {
			$settings['sadaka_wc_product_id'] = 0;
		}
		if ($settings['sadaka_toggle_label'] === '') {
			$settings['sadaka_toggle_label'] = __('Alt Bağış Ekle', 'woo-donation-popup');
		}
		$settings['success_button_radius'] = self::clamp_max($settings['success_button_radius'], 50);
		$settings['success_message_radius'] = self::clamp_max($settings['success_message_radius'], 50);
		$settings['mini_cart_radius'] = self::clamp_max($settings['mini_cart_radius'], 50);
		return $settings;
	}

	/**
	 * Normalize progress bar settings.
	 *
	 * @param array $request Raw request payload.
	 * @return array
	 */
	public static function normalize_progress_bar_settings(array $request) {
		$existing = get_option('wdp_progress_bar_settings', array());
		if (!is_array($existing)) {
			$existing = array();
		}

		$fill = self::pick_hex($request, $existing, 'progress_fill_color', '');
		if (!$fill && !empty($existing['fill_color'])) {
			$fill = sanitize_hex_color($existing['fill_color']) ?: '';
		}
		if (!$fill) {
			$fill = WDP_Utils::resolve_progress_bar_fill_color($existing);
		}

		$pending = self::pick_hex($request, $existing, 'progress_pending_bg', '');
		if (!$pending && !empty($existing['pending_bg'])) {
			$pending = sanitize_hex_color($existing['pending_bg']) ?: '';
		}
		if (!$pending) {
			$pending = '#0f608b';
		}

		$height = isset($request['progress_bar_height'])
			? absint($request['progress_bar_height'])
			: (isset($existing['bar_height']) ? absint($existing['bar_height']) : 18);
		$height = self::clamp_range($height, 12, 28);

		$pick_prog_hex = static function ($req_key, $store_key, $default) use ($request, $existing) {
			if (isset($request[ $req_key ])) {
				$v = sanitize_hex_color($request[ $req_key ]);
				return $v ? $v : $default;
			}
			if (!empty($existing[ $store_key ])) {
				$v = sanitize_hex_color($existing[ $store_key ]);
				return $v ? $v : $default;
			}
			return $default;
		};

		return array(
			'container_bg'            => $pick_prog_hex('progress_container_bg', 'container_bg', '#ffffff'),
			'container_border'        => $pick_prog_hex('progress_container_border', 'container_border', '#e5e9ec'),
			'track_bg'                => $pick_prog_hex('progress_track_bg', 'track_bg', '#eef2f4'),
			'fill_color'              => $fill,
			'preview_bg'              => $pick_prog_hex('progress_preview_bg', 'preview_bg', '#94a3b8'),
			'pending_bg'              => $pending,
			'percentage_bg'           => $pick_prog_hex('progress_percentage_bg', 'percentage_bg', '#ffffff'),
			'percentage_text'         => $pick_prog_hex('progress_percentage_text', 'percentage_text', '#0f172a'),
			'bar_height'              => (string) $height,
			'enable_celebrate'        => array_key_exists('progress_enable_celebrate', $request)
				? ((!empty($request['progress_enable_celebrate']) && '0' !== (string) $request['progress_enable_celebrate']) ? '1' : '0')
				: (isset($existing['enable_celebrate']) ? (('1' === (string) $existing['enable_celebrate']) ? '1' : '0') : '1'),
		);
	}

	/**
	 * Normalize modal layout settings.
	 *
	 * @param array $request Raw request payload.
	 * @return array
	 */
	public static function normalize_modal_layout_settings(array $request) {
		$settings = array(
			'side_panel_width_desktop_percent' => isset($request['side_panel_width_desktop_percent']) ? self::clamp_range(absint($request['side_panel_width_desktop_percent']), 30, 100) : 50,
			'side_panel_width_desktop_min_px'  => isset($request['side_panel_width_desktop_min_px']) ? self::clamp_range(absint($request['side_panel_width_desktop_min_px']), 320, 900) : 400,
			'side_panel_width_desktop_max_px'  => isset($request['side_panel_width_desktop_max_px']) ? self::clamp_range(absint($request['side_panel_width_desktop_max_px']), 400, 1200) : 720,
			'side_panel_width_tablet_percent'  => isset($request['side_panel_width_tablet_percent']) ? self::clamp_range(absint($request['side_panel_width_tablet_percent']), 30, 100) : 55,
			'side_panel_width_tablet_min_px'   => isset($request['side_panel_width_tablet_min_px']) ? self::clamp_range(absint($request['side_panel_width_tablet_min_px']), 300, 800) : 380,
			'side_panel_width_tablet_max_px'   => isset($request['side_panel_width_tablet_max_px']) ? self::clamp_range(absint($request['side_panel_width_tablet_max_px']), 380, 900) : 600,
			'side_panel_width_mobile_percent'  => isset($request['side_panel_width_mobile_percent']) ? self::clamp_range(absint($request['side_panel_width_mobile_percent']), 70, 100) : 92,
			'side_panel_width_mobile_min_px'   => isset($request['side_panel_width_mobile_min_px']) ? self::clamp_range(absint($request['side_panel_width_mobile_min_px']), 0, 600) : 0,
			'side_panel_width_mobile_max_px'   => isset($request['side_panel_width_mobile_max_px']) ? self::clamp_range(absint($request['side_panel_width_mobile_max_px']), 320, 1200) : 100,
			'popup_modal_width_desktop'   => isset($request['popup_modal_width_desktop']) && '' !== $request['popup_modal_width_desktop'] ? absint($request['popup_modal_width_desktop']) : 540,
			'inpage_form_width_desktop'   => isset($request['inpage_form_width_desktop']) && '' !== $request['inpage_form_width_desktop'] ? absint($request['inpage_form_width_desktop']) : 480,
			'modal_padding_top_desktop'   => isset($request['modal_padding_top_desktop']) && '' !== $request['modal_padding_top_desktop'] ? absint($request['modal_padding_top_desktop']) : 32,
			'modal_padding_right_desktop' => isset($request['modal_padding_right_desktop']) && '' !== $request['modal_padding_right_desktop'] ? absint($request['modal_padding_right_desktop']) : 24,
			'modal_padding_bottom_desktop'=> isset($request['modal_padding_bottom_desktop']) && '' !== $request['modal_padding_bottom_desktop'] ? absint($request['modal_padding_bottom_desktop']) : 24,
			'modal_padding_left_desktop'  => isset($request['modal_padding_left_desktop']) && '' !== $request['modal_padding_left_desktop'] ? absint($request['modal_padding_left_desktop']) : 24,
			'popup_modal_width_mobile'    => isset($request['popup_modal_width_mobile']) && '' !== $request['popup_modal_width_mobile'] ? absint($request['popup_modal_width_mobile']) : 540,
			'inpage_form_width_mobile'    => isset($request['inpage_form_width_mobile']) && '' !== $request['inpage_form_width_mobile'] ? absint($request['inpage_form_width_mobile']) : 480,
			'modal_padding_top_mobile'    => isset($request['modal_padding_top_mobile']) && '' !== $request['modal_padding_top_mobile'] ? absint($request['modal_padding_top_mobile']) : 28,
			'modal_padding_right_mobile'  => isset($request['modal_padding_right_mobile']) && '' !== $request['modal_padding_right_mobile'] ? absint($request['modal_padding_right_mobile']) : 20,
			'modal_padding_bottom_mobile' => isset($request['modal_padding_bottom_mobile']) && '' !== $request['modal_padding_bottom_mobile'] ? absint($request['modal_padding_bottom_mobile']) : 20,
			'modal_padding_left_mobile'   => isset($request['modal_padding_left_mobile']) && '' !== $request['modal_padding_left_mobile'] ? absint($request['modal_padding_left_mobile']) : 20,
		);

		if ($settings['side_panel_width_desktop_min_px'] > $settings['side_panel_width_desktop_max_px']) {
			$settings['side_panel_width_desktop_min_px'] = $settings['side_panel_width_desktop_max_px'];
		}
		if ($settings['side_panel_width_tablet_min_px'] > $settings['side_panel_width_tablet_max_px']) {
			$settings['side_panel_width_tablet_min_px'] = $settings['side_panel_width_tablet_max_px'];
		}
		if ($settings['side_panel_width_mobile_min_px'] > $settings['side_panel_width_mobile_max_px']) {
			$settings['side_panel_width_mobile_min_px'] = $settings['side_panel_width_mobile_max_px'];
		}

		$settings['popup_modal_width_desktop'] = self::clamp_range($settings['popup_modal_width_desktop'], 300, 800);
		$settings['inpage_form_width_desktop'] = self::clamp_range($settings['inpage_form_width_desktop'], 300, 800);
		$settings['popup_modal_width_mobile'] = self::clamp_range($settings['popup_modal_width_mobile'], 300, 800);
		$settings['inpage_form_width_mobile'] = self::clamp_range($settings['inpage_form_width_mobile'], 300, 800);
		$settings['modal_padding_top_desktop'] = self::clamp_max($settings['modal_padding_top_desktop'], 100);
		$settings['modal_padding_right_desktop'] = self::clamp_max($settings['modal_padding_right_desktop'], 100);
		$settings['modal_padding_bottom_desktop'] = self::clamp_max($settings['modal_padding_bottom_desktop'], 100);
		$settings['modal_padding_left_desktop'] = self::clamp_max($settings['modal_padding_left_desktop'], 100);
		$settings['modal_padding_top_mobile'] = self::clamp_max($settings['modal_padding_top_mobile'], 100);
		$settings['modal_padding_right_mobile'] = self::clamp_max($settings['modal_padding_right_mobile'], 100);
		$settings['modal_padding_bottom_mobile'] = self::clamp_max($settings['modal_padding_bottom_mobile'], 100);
		$settings['modal_padding_left_mobile'] = self::clamp_max($settings['modal_padding_left_mobile'], 100);

		return $settings;
	}

	/**
	 * Normalize Meta Pixel companion settings.
	 *
	 * @param array $request Raw POST fields.
	 * @return array
	 */
	public static function normalize_meta_tracking_settings(array $request) {
		$defaults = class_exists('WDP_Meta_Tracking') ? WDP_Meta_Tracking::default_settings() : array();
		$chk      = static function ($key) use ($request) {
			return isset($request[ $key ]) && '1' === (string) $request[ $key ];
		};

		$pixel_raw = isset($request['optional_pixel_id']) ? sanitize_text_field(wp_unslash($request['optional_pixel_id'])) : '';
		$pixel     = preg_replace('/\D/', '', $pixel_raw);

		$out = array_merge(
			$defaults,
			array(
				'enabled'                    => $chk('meta_enabled') ? '1' : '0',
				'view_content'               => $chk('meta_view_content') ? '1' : '0',
				'add_to_cart'                => $chk('meta_add_to_cart') ? '1' : '0',
				'purchase'                   => $chk('meta_purchase') ? '1' : '0',
				'custom_debug'               => $chk('meta_custom_debug') ? '1' : '0',
				'debug'                      => $chk('meta_debug') ? '1' : '0',
				'load_base_pixel'            => $chk('meta_load_base_pixel') ? '1' : '0',
				'initiate_checkout'          => $chk('meta_initiate_checkout') ? '1' : '0',
				'purchase_include_on_hold'   => $chk('meta_purchase_include_on_hold') ? '1' : '0',
				'require_consent'            => $chk('meta_require_consent') ? '1' : '0',
				'optional_pixel_id'          => strlen($pixel) >= 8 ? $pixel : '',
			)
		);

		return $out;
	}

	/**
	 * Pick hex from request → existing → default (never persist null).
	 *
	 * @param array  $request  Request.
	 * @param array  $existing Existing option.
	 * @param string $key      Key.
	 * @param string $default  Default hex.
	 * @return string
	 */
	private static function pick_hex(array $request, array $existing, $key, $default) {
		if (array_key_exists($key, $request)) {
			$v = sanitize_hex_color($request[ $key ]);
			return $v ? $v : $default;
		}
		if (!empty($existing[ $key ])) {
			$v = sanitize_hex_color($existing[ $key ]);
			return $v ? $v : $default;
		}
		return $default;
	}

	/**
	 * Pick text from request → existing → default.
	 *
	 * @param array  $request  Request.
	 * @param array  $existing Existing option.
	 * @param string $key      Key.
	 * @param string $default  Default.
	 * @return string
	 */
	private static function pick_text(array $request, array $existing, $key, $default) {
		if (array_key_exists($key, $request)) {
			return sanitize_text_field(wp_unslash($request[ $key ]));
		}
		if (isset($existing[ $key ]) && '' !== $existing[ $key ]) {
			return sanitize_text_field((string) $existing[ $key ]);
		}
		return $default;
	}

	/**
	 * Pick int from request → existing → default.
	 *
	 * @param array  $request  Request.
	 * @param array  $existing Existing option.
	 * @param string $key      Key.
	 * @param int    $default  Default.
	 * @return int
	 */
	private static function pick_int(array $request, array $existing, $key, $default) {
		if (isset($request[ $key ]) && '' !== $request[ $key ]) {
			return absint($request[ $key ]);
		}
		if (isset($existing[ $key ]) && '' !== $existing[ $key ]) {
			return absint($existing[ $key ]);
		}
		return (int) $default;
	}

	/**
	 * Pick checkbox flag. Missing key keeps existing (callers force '0' for form-owned checkboxes).
	 *
	 * @param array  $request  Request.
	 * @param array  $existing Existing option.
	 * @param string $key      Key.
	 * @param string $default  Default '0'|'1'.
	 * @return string
	 */
	private static function pick_flag(array $request, array $existing, $key, $default = '0') {
		if (array_key_exists($key, $request)) {
			$v = $request[ $key ];
			return (!empty($v) && '0' !== (string) $v) ? '1' : '0';
		}
		if (array_key_exists($key, $existing)) {
			return ('1' === (string) $existing[ $key ]) ? '1' : '0';
		}
		return ('1' === (string) $default) ? '1' : '0';
	}

	/**
	 * Clamp value between min and max.
	 *
	 * @param int $value Value.
	 * @param int $min Minimum.
	 * @param int $max Maximum.
	 * @return int
	 */
	/**
	 * Re-save stored option groups so missing keys receive defaults (user values are kept).
	 *
	 * @return int Number of options written.
	 */
	public static function rewrite_stored_options() {
		$written = 0;
		$map     = array(
			'wdp_button_settings'        => 'normalize_normal_form_settings',
			'wdp_shareholder_settings'   => 'normalize_shareholder_settings',
			'wdp_success_settings'       => 'normalize_success_screen_settings',
			'wdp_progress_bar_settings'  => 'normalize_progress_bar_settings',
			'wdp_modal_layout_settings'  => 'normalize_modal_layout_settings',
			'wdp_meta_tracking_settings' => 'normalize_meta_tracking_settings',
		);
		foreach ($map as $option => $method) {
			if (get_option($option, false) === false) {
				continue;
			}
			if (!method_exists(__CLASS__, $method)) {
				continue;
			}
			$current = get_option($option, array());
			$clean   = call_user_func(array(__CLASS__, $method), array());
			if (is_array($clean)) {
				$merged = is_array($current) ? array_merge($current, $clean) : $clean;
				update_option($option, $merged, false);
				$written++;
			}
		}
		return $written;
	}

	private static function clamp_range($value, $min, $max) {
		return max($min, min($value, $max));
	}

	/**
	 * Clamp value to max.
	 *
	 * @param int $value Value.
	 * @param int $max Maximum.
	 * @return int
	 */
	private static function clamp_max($value, $max) {
		return min($value, $max);
	}
}

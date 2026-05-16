<?php
/**
 * Admin settings normalizer.
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
	 * Normalize normal form settings.
	 *
	 * @param array $request Raw request payload.
	 * @return array
	 */
	public static function normalize_normal_form_settings(array $request) {
		$existing = WDP_Utils::migrate_button_shadow_to_sc_modal(
			WDP_Utils::normalize_legacy_popup_button_text(
				get_option('wdp_button_settings', array())
			)
		);

		$popup_btn_text_color = isset($request['popup_button_text_color']) ? sanitize_hex_color($request['popup_button_text_color']) : '';
		if (!$popup_btn_text_color && isset($existing['popup_button_text_color'])) {
			$popup_btn_text_color = sanitize_hex_color($existing['popup_button_text_color']);
		}
		if (!$popup_btn_text_color) {
			$popup_btn_text_color = '#ffffff';
		}

		$settings = array(
			'button_primary_color'              => isset($request['button_primary_color']) ? sanitize_hex_color($request['button_primary_color']) : '#1e73be',
			'button_primary_hover'              => isset($request['button_primary_hover']) ? sanitize_hex_color($request['button_primary_hover']) : '#185d98',
			'button_border_radius'              => isset($request['button_border_radius']) ? absint($request['button_border_radius']) : 20,
			'button_text_add_to_cart'           => isset($request['button_text_add_to_cart']) ? sanitize_text_field($request['button_text_add_to_cart']) : 'Sepete Ekle',
			'button_text_go_checkout'           => isset($request['button_text_go_checkout']) ? sanitize_text_field($request['button_text_go_checkout']) : 'Ödemeye Git',
			'modal_background_color'            => isset($request['modal_background_color']) ? sanitize_hex_color($request['modal_background_color']) : '#ffffff',
			'modal_border_radius'               => isset($request['modal_border_radius']) ? absint($request['modal_border_radius']) : 20,
			'input_border_color'                => isset($request['input_border_color']) ? sanitize_hex_color($request['input_border_color']) : '#d1d5db',
			'input_border_radius'               => isset($request['input_border_radius']) ? absint($request['input_border_radius']) : 20,
			'title_color'                       => isset($request['title_color']) ? sanitize_hex_color($request['title_color']) : '#1f2937',
			'title_font_size'                   => isset($request['title_font_size']) ? absint($request['title_font_size']) : 27,
			'title_font_size_mobile'            => isset($request['title_font_size_mobile']) && '' !== $request['title_font_size_mobile'] ? absint($request['title_font_size_mobile']) : 0,
			'close_button_color'                => isset($request['close_button_color']) ? sanitize_hex_color($request['close_button_color']) : '#6b7280',
			'button_checkout_color'             => isset($request['button_checkout_color']) ? sanitize_hex_color($request['button_checkout_color']) : '#48bb78',
			'button_checkout_hover'             => isset($request['button_checkout_hover']) ? sanitize_hex_color($request['button_checkout_hover']) : '#38a169',
			'popup_button_text'                 => isset($request['popup_button_text']) ? sanitize_text_field($request['popup_button_text']) : 'Bağış Yap',
			'popup_button_color'                => isset($request['popup_button_color']) ? sanitize_hex_color($request['popup_button_color']) : '#1e73be',
			'popup_button_hover'                => isset($request['popup_button_hover']) ? sanitize_hex_color($request['popup_button_hover']) : '#185d98',
			'popup_button_text_color'           => $popup_btn_text_color,
			'popup_button_font_size'            => isset($request['popup_button_font_size']) ? absint($request['popup_button_font_size']) : 18,
			'popup_button_font_weight'          => isset($request['popup_button_font_weight']) ? sanitize_text_field($request['popup_button_font_weight']) : (isset($existing['popup_button_font_weight']) ? sanitize_text_field($existing['popup_button_font_weight']) : '700'),
			'popup_button_font_family'          => isset($request['popup_button_font_family']) ? sanitize_text_field($request['popup_button_font_family']) : (isset($existing['popup_button_font_family']) ? sanitize_text_field($existing['popup_button_font_family']) : 'inherit'),
			'popup_button_custom_font'          => isset($request['popup_button_custom_font']) ? sanitize_text_field($request['popup_button_custom_font']) : (isset($existing['popup_button_custom_font']) ? sanitize_text_field($existing['popup_button_custom_font']) : ''),
			'popup_button_size'                 => (isset($request['popup_button_size']) && in_array($request['popup_button_size'], array('custom', 'small', 'medium', 'large', 'xlarge'), true)) ? sanitize_text_field($request['popup_button_size']) : (isset($existing['popup_button_size']) ? sanitize_text_field($existing['popup_button_size']) : 'large'),
			'shortcode_button_size'             => (isset($request['shortcode_button_size']) && in_array(strtolower((string) $request['shortcode_button_size']), array('small', 'medium', 'large', 'xlarge'), true)) ? strtolower(sanitize_text_field($request['shortcode_button_size'])) : (isset($existing['shortcode_button_size']) && in_array(strtolower((string) $existing['shortcode_button_size']), array('small', 'medium', 'large', 'xlarge'), true) ? strtolower(sanitize_text_field($existing['shortcode_button_size'])) : 'medium'),
			'popup_button_custom_min_width'     => isset($request['popup_button_custom_min_width']) ? absint($request['popup_button_custom_min_width']) : (isset($existing['popup_button_custom_min_width']) ? absint($existing['popup_button_custom_min_width']) : 140),
			'popup_button_custom_min_height'    => isset($request['popup_button_custom_min_height']) ? absint($request['popup_button_custom_min_height']) : (isset($existing['popup_button_custom_min_height']) ? absint($existing['popup_button_custom_min_height']) : 48),
			'popup_button_custom_padding_x'     => isset($request['popup_button_custom_padding_x']) ? absint($request['popup_button_custom_padding_x']) : (isset($existing['popup_button_custom_padding_x']) ? absint($existing['popup_button_custom_padding_x']) : 24),
			'popup_button_border_radius'        => isset($request['popup_button_border_radius']) ? absint($request['popup_button_border_radius']) : 20,
			'popup_button_border_size'          => isset($request['popup_button_border_size']) ? absint($request['popup_button_border_size']) : (isset($existing['popup_button_border_size']) ? absint($existing['popup_button_border_size']) : 0),
			'popup_button_full_width'           => isset($request['popup_button_full_width']) ? ('1' === $request['popup_button_full_width'] ? '1' : '0') : (isset($existing['popup_button_full_width']) ? (('1' === $existing['popup_button_full_width']) ? '1' : '0') : '0'),
			'label_color'                       => isset($request['label_color']) ? sanitize_hex_color($request['label_color']) : '#374151',
			'label_font_size'                   => isset($request['label_font_size']) ? absint($request['label_font_size']) : 14,
			'label_font_weight'                 => isset($request['label_font_weight']) ? sanitize_text_field($request['label_font_weight']) : '600',
			'placeholder_color'                 => isset($request['placeholder_color']) ? sanitize_hex_color($request['placeholder_color']) : '#6b7280',
			'form_gap'                          => isset($request['form_gap']) ? absint($request['form_gap']) : 16,
			'form_button_order'                 => isset($request['form_button_order']) ? (('checkout_first' === $request['form_button_order']) ? 'checkout_first' : 'add_first') : (isset($existing['form_button_order']) && 'checkout_first' === $existing['form_button_order'] ? 'checkout_first' : 'add_first'),
			'form_button_alignment'             => in_array(isset($request['form_button_alignment']) ? $request['form_button_alignment'] : (isset($existing['form_button_alignment']) ? $existing['form_button_alignment'] : 'left'), array('left', 'center', 'right'), true) ? sanitize_text_field(isset($request['form_button_alignment']) ? $request['form_button_alignment'] : (isset($existing['form_button_alignment']) ? $existing['form_button_alignment'] : 'left')) : 'left',
		);

		foreach (array('sc', 'modal') as $slot) {
			$pre = 'button_shadow_' . $slot . '_';
			/* İşaretli değilse POST’ta anahtar yok — kapalı sayılır. */
			$settings[ $pre . 'enabled' ]        = isset($request[ $pre . 'enabled' ]) && '1' === $request[ $pre . 'enabled' ] ? '1' : '0';
			$settings[ $pre . 'hover_enhanced' ] = isset($request[ $pre . 'hover_enhanced' ]) && '1' === $request[ $pre . 'hover_enhanced' ] ? '1' : '0';
			$settings[ $pre . 'color' ]          = isset($request[ $pre . 'color' ]) ? sanitize_hex_color($request[ $pre . 'color' ]) : (isset($existing[ $pre . 'color' ]) ? sanitize_hex_color($existing[ $pre . 'color' ]) : '#94a3b8');
			$settings[ $pre . 'x' ]              = isset($request[ $pre . 'x' ]) ? (int) $request[ $pre . 'x' ] : (isset($existing[ $pre . 'x' ]) ? (int) $existing[ $pre . 'x' ] : 0);
			$settings[ $pre . 'y' ]              = isset($request[ $pre . 'y' ]) ? (int) $request[ $pre . 'y' ] : (isset($existing[ $pre . 'y' ]) ? (int) $existing[ $pre . 'y' ] : 8);
			$settings[ $pre . 'blur' ]           = isset($request[ $pre . 'blur' ]) ? absint($request[ $pre . 'blur' ]) : (isset($existing[ $pre . 'blur' ]) ? absint($existing[ $pre . 'blur' ]) : 20);
			$settings[ $pre . 'spread' ]         = isset($request[ $pre . 'spread' ]) ? (int) $request[ $pre . 'spread' ] : (isset($existing[ $pre . 'spread' ]) ? (int) $existing[ $pre . 'spread' ] : 0);
			$settings[ $pre . 'hover_blur' ]       = isset($request[ $pre . 'hover_blur' ]) ? absint($request[ $pre . 'hover_blur' ]) : (isset($existing[ $pre . 'hover_blur' ]) ? absint($existing[ $pre . 'hover_blur' ]) : 24);
			$settings[ $pre . 'hover_color' ]      = isset($request[ $pre . 'hover_color' ]) ? sanitize_hex_color($request[ $pre . 'hover_color' ]) : (isset($existing[ $pre . 'hover_color' ]) ? sanitize_hex_color($existing[ $pre . 'hover_color' ]) : '');
			$settings[ $pre . 'hover_x' ]          = isset($request[ $pre . 'hover_x' ]) ? (int) $request[ $pre . 'hover_x' ] : (isset($existing[ $pre . 'hover_x' ]) ? (int) $existing[ $pre . 'hover_x' ] : 0);
			$settings[ $pre . 'hover_y' ]          = isset($request[ $pre . 'hover_y' ]) ? (int) $request[ $pre . 'hover_y' ] : (isset($existing[ $pre . 'hover_y' ]) ? (int) $existing[ $pre . 'hover_y' ] : 10);
			$settings[ $pre . 'hover_spread' ]     = isset($request[ $pre . 'hover_spread' ]) ? (int) $request[ $pre . 'hover_spread' ] : (isset($existing[ $pre . 'hover_spread' ]) ? (int) $existing[ $pre . 'hover_spread' ] : 0);
		}

		$settings['button_border_radius'] = self::clamp_max($settings['button_border_radius'], 50);
		$settings['modal_border_radius'] = self::clamp_max($settings['modal_border_radius'], 50);
		$settings['input_border_radius'] = self::clamp_max($settings['input_border_radius'], 50);
		$settings['form_gap'] = self::clamp_range($settings['form_gap'], 4, 40);
		$settings['title_font_size'] = self::clamp_range($settings['title_font_size'], 14, 48);
		if (!empty($settings['title_font_size_mobile'])) {
			$settings['title_font_size_mobile'] = self::clamp_range($settings['title_font_size_mobile'], 12, 40);
		}
		$settings['popup_button_font_size'] = self::clamp_range($settings['popup_button_font_size'], 12, 32);
		$settings['popup_button_border_radius'] = self::clamp_max($settings['popup_button_border_radius'], 50);
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
		$solid_requested = isset($request['shareholders_area_bg']) ? sanitize_hex_color($request['shareholders_area_bg']) : '';
		if (!$solid_requested && !empty($existing['shareholders_area_bg'])) {
			$solid_requested = WDP_Utils::coerce_solid_hex_background($existing['shareholders_area_bg'], '#fafbfc');
		}
		if (!$solid_requested) {
			$solid_requested = '#fafbfc';
		}

		$settings = array(
			'shareholder_card_bg'            => isset($request['shareholder_card_bg']) ? sanitize_hex_color($request['shareholder_card_bg']) : '#ffffff',
			'shareholder_card_border'        => isset($request['shareholder_card_border']) ? sanitize_hex_color($request['shareholder_card_border']) : '#f0f2f5',
			'shareholder_card_radius'        => isset($request['shareholder_card_radius']) ? absint($request['shareholder_card_radius']) : 20,
			'shareholder_card_shadow'        => isset($request['shareholder_card_shadow']) ? sanitize_text_field($request['shareholder_card_shadow']) : '0 1px 3px rgba(0, 0, 0, 0.05)',
			'shareholder_header_bg'          => isset($request['shareholder_header_bg']) ? sanitize_hex_color($request['shareholder_header_bg']) : '#f9fafb',
			'shareholder_header_color'       => isset($request['shareholder_header_color']) ? sanitize_hex_color($request['shareholder_header_color']) : '#1f2937',
			'shareholder_content_padding'    => isset($request['shareholder_content_padding']) ? absint($request['shareholder_content_padding']) : 12,
			'shareholders_area_bg'           => $solid_requested,
			'shareholders_area_border'       => isset($request['shareholders_area_border']) ? sanitize_hex_color($request['shareholders_area_border']) : '#e1e5e9',
			'shareholders_area_radius'       => isset($request['shareholders_area_radius']) ? absint($request['shareholders_area_radius']) : 20,
			'shareholders_scrollbar_color'   => isset($request['shareholders_scrollbar_color']) ? sanitize_hex_color($request['shareholders_scrollbar_color']) : '#4a90e2',
			'share_counter_border'           => isset($request['share_counter_border']) ? sanitize_hex_color($request['share_counter_border']) : '#d1d5db',
			'share_counter_bg'               => isset($request['share_counter_bg']) ? sanitize_hex_color($request['share_counter_bg']) : '#ffffff',
			'share_counter_button_color'     => isset($request['share_counter_button_color']) ? sanitize_hex_color($request['share_counter_button_color']) : '#888888',
			'shareholder_header_text'        => isset($request['shareholder_header_text']) ? sanitize_text_field($request['shareholder_header_text']) : 'Hissedar Bilgileri',
			'shareholder_name_placeholder'   => isset($request['shareholder_name_placeholder']) ? sanitize_text_field($request['shareholder_name_placeholder']) : 'Ad Soyad *',
			'shareholder_phone_placeholder'  => isset($request['shareholder_phone_placeholder']) ? sanitize_text_field($request['shareholder_phone_placeholder']) : 'Telefon Numarası *',
			'shareholder_note_placeholder'   => isset($request['shareholder_note_placeholder']) ? sanitize_text_field($request['shareholder_note_placeholder']) : 'Not (isteğe bağlı)',
			'shareholder_copy_button_text'   => isset($request['shareholder_copy_button_text']) ? sanitize_text_field($request['shareholder_copy_button_text']) : '📋 Kopyasını Oluştur',
			'shareholder_enable_copy_button' => isset($request['shareholder_enable_copy_button']) && '1' === $request['shareholder_enable_copy_button'] ? '1' : '0',
			'shareholder_layout'             => isset($request['shareholder_layout']) && 'two-column' === $request['shareholder_layout'] ? 'two-column' : 'single',
			'shareholder_density'            => in_array(isset($request['shareholder_density']) ? $request['shareholder_density'] : 'normal', array('compact', 'normal', 'spacious'), true) ? sanitize_text_field($request['shareholder_density']) : 'normal',
			'shareholder_enable_email'       => isset($request['shareholder_enable_email']) && '1' === $request['shareholder_enable_email'] ? '1' : '0',
			'shareholder_email_placeholder'  => isset($request['shareholder_email_placeholder']) ? sanitize_text_field($request['shareholder_email_placeholder']) : 'E-posta (isteğe bağlı)',
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
		$settings = array(
			'success_button_color'     => isset($request['success_button_color']) ? sanitize_hex_color($request['success_button_color']) : '#1e73be',
			'success_button_hover'     => isset($request['success_button_hover']) ? sanitize_hex_color($request['success_button_hover']) : '#185d98',
			'success_button_radius'    => isset($request['success_button_radius']) ? absint($request['success_button_radius']) : 20,
			'success_text_view_cart'   => isset($request['success_text_view_cart']) ? sanitize_text_field($request['success_text_view_cart']) : 'Sepeti Görüntüle',
			'success_text_go_checkout' => isset($request['success_text_go_checkout']) ? sanitize_text_field($request['success_text_go_checkout']) : 'Ödemeye Git',
			'success_text_new_donation'=> isset($request['success_text_new_donation']) ? sanitize_text_field($request['success_text_new_donation']) : 'Yeni Bağış Ekle',
			'success_message_bg'       => isset($request['success_message_bg']) ? sanitize_text_field($request['success_message_bg']) : 'rgba(72, 187, 120, 0.1)',
			'success_message_color'    => isset($request['success_message_color']) ? sanitize_hex_color($request['success_message_color']) : '#48bb78',
			'success_message_border'   => isset($request['success_message_border']) ? sanitize_text_field($request['success_message_border']) : 'rgba(72, 187, 120, 0.2)',
			'success_message_radius'   => isset($request['success_message_radius']) ? absint($request['success_message_radius']) : 20,
			'mini_cart_bg'             => isset($request['mini_cart_bg']) ? sanitize_hex_color($request['mini_cart_bg']) : '#f9fafb',
			'mini_cart_border'         => isset($request['mini_cart_border']) ? sanitize_hex_color($request['mini_cart_border']) : '#e5e7eb',
			'mini_cart_radius'         => isset($request['mini_cart_radius']) ? absint($request['mini_cart_radius']) : 20,
			'cart_item_name_color'     => isset($request['cart_item_name_color']) ? sanitize_hex_color($request['cart_item_name_color']) : '#1f2937',
			'cart_item_price_color'    => isset($request['cart_item_price_color']) ? sanitize_hex_color($request['cart_item_price_color']) : '#1e73be',
		);
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
		$fill = isset($request['progress_fill_color']) ? sanitize_hex_color($request['progress_fill_color']) : '';
		if (!$fill) {
			$fill = WDP_Utils::resolve_progress_bar_fill_color(get_option('wdp_progress_bar_settings', array()));
		}
		return array(
			'container_bg'    => isset($request['progress_container_bg']) ? sanitize_hex_color($request['progress_container_bg']) : '#f8fafc',
			'container_border'=> isset($request['progress_container_border']) ? sanitize_hex_color($request['progress_container_border']) : '#e2e8f0',
			'track_bg'        => isset($request['progress_track_bg']) ? sanitize_hex_color($request['progress_track_bg']) : '#e2e8f0',
			'fill_color'      => $fill,
			'preview_bg'      => isset($request['progress_preview_bg']) ? sanitize_hex_color($request['progress_preview_bg']) : '#64748b',
			'percentage_bg'   => isset($request['progress_percentage_bg']) ? sanitize_hex_color($request['progress_percentage_bg']) : '#ffffff',
			'percentage_text' => isset($request['progress_percentage_text']) ? sanitize_hex_color($request['progress_percentage_text']) : '#1e293b',
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
				'optional_pixel_id'          => strlen($pixel) >= 8 ? $pixel : '',
			)
		);

		return $out;
	}

	/**
	 * Clamp value between min and max.
	 *
	 * @param int $value Value.
	 * @param int $min Minimum.
	 * @param int $max Maximum.
	 * @return int
	 */
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

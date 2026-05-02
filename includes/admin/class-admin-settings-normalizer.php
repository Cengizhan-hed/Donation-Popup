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
		$existing = WDP_Utils::normalize_legacy_popup_button_text(
			get_option('wdp_button_settings', array())
		);

		$settings = array(
			'button_primary_color'              => isset($request['button_primary_color']) ? sanitize_hex_color($request['button_primary_color']) : '#1e73be',
			'button_primary_hover'              => isset($request['button_primary_hover']) ? sanitize_hex_color($request['button_primary_hover']) : '#185d98',
			'button_border_radius'              => isset($request['button_border_radius']) ? absint($request['button_border_radius']) : 10,
			'button_text_add_to_cart'           => isset($request['button_text_add_to_cart']) ? sanitize_text_field($request['button_text_add_to_cart']) : 'Sepete Ekle',
			'button_text_go_checkout'           => isset($request['button_text_go_checkout']) ? sanitize_text_field($request['button_text_go_checkout']) : 'Ödemeye Git',
			'modal_background_color'            => isset($request['modal_background_color']) ? sanitize_hex_color($request['modal_background_color']) : '#ffffff',
			'modal_border_radius'               => isset($request['modal_border_radius']) ? absint($request['modal_border_radius']) : 10,
			'input_border_color'                => isset($request['input_border_color']) ? sanitize_hex_color($request['input_border_color']) : '#d1d5db',
			'input_border_radius'               => isset($request['input_border_radius']) ? absint($request['input_border_radius']) : 10,
			'title_color'                       => isset($request['title_color']) ? sanitize_hex_color($request['title_color']) : '#1f2937',
			'title_font_size'                   => isset($request['title_font_size']) ? absint($request['title_font_size']) : 27,
			'title_font_size_mobile'            => isset($request['title_font_size_mobile']) && '' !== $request['title_font_size_mobile'] ? absint($request['title_font_size_mobile']) : 0,
			'close_button_color'                => isset($request['close_button_color']) ? sanitize_hex_color($request['close_button_color']) : '#6b7280',
			'button_checkout_color'             => isset($request['button_checkout_color']) ? sanitize_hex_color($request['button_checkout_color']) : '#48bb78',
			'button_checkout_hover'             => isset($request['button_checkout_hover']) ? sanitize_hex_color($request['button_checkout_hover']) : '#38a169',
			'popup_button_text'                 => isset($request['popup_button_text']) ? sanitize_text_field($request['popup_button_text']) : 'Bağış Yap',
			'popup_button_color'                => isset($request['popup_button_color']) ? sanitize_hex_color($request['popup_button_color']) : '#1e73be',
			'popup_button_hover'                => isset($request['popup_button_hover']) ? sanitize_hex_color($request['popup_button_hover']) : '#185d98',
			'popup_button_font_size'            => isset($request['popup_button_font_size']) ? absint($request['popup_button_font_size']) : 18,
			'popup_button_font_weight'          => isset($request['popup_button_font_weight']) ? sanitize_text_field($request['popup_button_font_weight']) : (isset($existing['popup_button_font_weight']) ? sanitize_text_field($existing['popup_button_font_weight']) : '700'),
			'popup_button_font_family'          => isset($request['popup_button_font_family']) ? sanitize_text_field($request['popup_button_font_family']) : (isset($existing['popup_button_font_family']) ? sanitize_text_field($existing['popup_button_font_family']) : 'inherit'),
			'popup_button_custom_font'          => isset($request['popup_button_custom_font']) ? sanitize_text_field($request['popup_button_custom_font']) : (isset($existing['popup_button_custom_font']) ? sanitize_text_field($existing['popup_button_custom_font']) : ''),
			'popup_button_size'                 => (isset($request['popup_button_size']) && in_array($request['popup_button_size'], array('custom', 'small', 'medium', 'large', 'xlarge'), true)) ? sanitize_text_field($request['popup_button_size']) : (isset($existing['popup_button_size']) ? sanitize_text_field($existing['popup_button_size']) : 'large'),
			'popup_button_custom_min_width'     => isset($request['popup_button_custom_min_width']) ? absint($request['popup_button_custom_min_width']) : (isset($existing['popup_button_custom_min_width']) ? absint($existing['popup_button_custom_min_width']) : 140),
			'popup_button_custom_min_height'    => isset($request['popup_button_custom_min_height']) ? absint($request['popup_button_custom_min_height']) : (isset($existing['popup_button_custom_min_height']) ? absint($existing['popup_button_custom_min_height']) : 48),
			'popup_button_custom_padding_x'     => isset($request['popup_button_custom_padding_x']) ? absint($request['popup_button_custom_padding_x']) : (isset($existing['popup_button_custom_padding_x']) ? absint($existing['popup_button_custom_padding_x']) : 24),
			'popup_button_border_radius'        => isset($request['popup_button_border_radius']) ? absint($request['popup_button_border_radius']) : 10,
			'popup_button_border_size'          => isset($request['popup_button_border_size']) ? absint($request['popup_button_border_size']) : (isset($existing['popup_button_border_size']) ? absint($existing['popup_button_border_size']) : 0),
			'popup_button_full_width'           => isset($request['popup_button_full_width']) ? ('1' === $request['popup_button_full_width'] ? '1' : '0') : (isset($existing['popup_button_full_width']) ? (('1' === $existing['popup_button_full_width']) ? '1' : '0') : '0'),
			'popup_button_use_gradient'         => isset($request['popup_button_use_gradient']) && '1' === $request['popup_button_use_gradient'] ? '1' : '0',
			'popup_button_gradient_start'       => isset($request['popup_button_gradient_start']) ? sanitize_hex_color($request['popup_button_gradient_start']) : (isset($existing['popup_button_gradient_start']) ? sanitize_hex_color($existing['popup_button_gradient_start']) : '#ff8244'),
			'popup_button_gradient_end'         => isset($request['popup_button_gradient_end']) ? sanitize_hex_color($request['popup_button_gradient_end']) : (isset($existing['popup_button_gradient_end']) ? sanitize_hex_color($existing['popup_button_gradient_end']) : '#ff9860'),
			'popup_button_gradient_hover_start' => isset($request['popup_button_gradient_hover_start']) ? sanitize_hex_color($request['popup_button_gradient_hover_start']) : (isset($existing['popup_button_gradient_hover_start']) ? sanitize_hex_color($existing['popup_button_gradient_hover_start']) : '#ff8244'),
			'popup_button_gradient_hover_end'   => isset($request['popup_button_gradient_hover_end']) ? sanitize_hex_color($request['popup_button_gradient_hover_end']) : (isset($existing['popup_button_gradient_hover_end']) ? sanitize_hex_color($existing['popup_button_gradient_hover_end']) : '#ff9860'),
			'popup_button_gradient_start_stop'  => isset($request['popup_button_gradient_start_stop']) ? absint($request['popup_button_gradient_start_stop']) : (isset($existing['popup_button_gradient_start_stop']) ? absint($existing['popup_button_gradient_start_stop']) : 0),
			'popup_button_gradient_end_stop'    => isset($request['popup_button_gradient_end_stop']) ? absint($request['popup_button_gradient_end_stop']) : (isset($existing['popup_button_gradient_end_stop']) ? absint($existing['popup_button_gradient_end_stop']) : 100),
			'popup_button_gradient_type'        => (isset($request['popup_button_gradient_type']) && in_array($request['popup_button_gradient_type'], array('linear', 'radial'), true)) ? sanitize_text_field($request['popup_button_gradient_type']) : (isset($existing['popup_button_gradient_type']) ? sanitize_text_field($existing['popup_button_gradient_type']) : 'linear'),
			'popup_button_gradient_angle'       => isset($request['popup_button_gradient_angle']) ? absint($request['popup_button_gradient_angle']) : (isset($existing['popup_button_gradient_angle']) ? absint($existing['popup_button_gradient_angle']) : 150),
			'label_color'                       => isset($request['label_color']) ? sanitize_hex_color($request['label_color']) : '#374151',
			'label_font_size'                   => isset($request['label_font_size']) ? absint($request['label_font_size']) : 14,
			'label_font_weight'                 => isset($request['label_font_weight']) ? sanitize_text_field($request['label_font_weight']) : '600',
			'placeholder_color'                 => isset($request['placeholder_color']) ? sanitize_hex_color($request['placeholder_color']) : '#6b7280',
			'form_gap'                          => isset($request['form_gap']) ? absint($request['form_gap']) : 16,
			'error_bg_color'                    => isset($request['error_bg_color']) ? sanitize_hex_color($request['error_bg_color']) : (isset($existing['error_bg_color']) ? sanitize_hex_color($existing['error_bg_color']) : '#fed7d7'),
			'error_border_color'                => isset($request['error_border_color']) ? sanitize_hex_color($request['error_border_color']) : (isset($existing['error_border_color']) ? sanitize_hex_color($existing['error_border_color']) : '#feb2b2'),
			'error_text_color'                  => isset($request['error_text_color']) ? sanitize_hex_color($request['error_text_color']) : (isset($existing['error_text_color']) ? sanitize_hex_color($existing['error_text_color']) : '#c53030'),
			'input_error_bg_color'              => isset($request['input_error_bg_color']) ? sanitize_hex_color($request['input_error_bg_color']) : (isset($existing['input_error_bg_color']) ? sanitize_hex_color($existing['input_error_bg_color']) : '#fed7d7'),
			'input_error_border_color'          => isset($request['input_error_border_color']) ? sanitize_hex_color($request['input_error_border_color']) : (isset($existing['input_error_border_color']) ? sanitize_hex_color($existing['input_error_border_color']) : '#feb2b2'),
			'input_error_text_color'            => isset($request['input_error_text_color']) ? sanitize_hex_color($request['input_error_text_color']) : (isset($existing['input_error_text_color']) ? sanitize_hex_color($existing['input_error_text_color']) : '#c53030'),
			'form_button_order'                 => isset($request['form_button_order']) ? (('checkout_first' === $request['form_button_order']) ? 'checkout_first' : 'add_first') : (isset($existing['form_button_order']) && 'checkout_first' === $existing['form_button_order'] ? 'checkout_first' : 'add_first'),
			'form_button_alignment'             => in_array(isset($request['form_button_alignment']) ? $request['form_button_alignment'] : (isset($existing['form_button_alignment']) ? $existing['form_button_alignment'] : 'left'), array('left', 'center', 'right'), true) ? sanitize_text_field(isset($request['form_button_alignment']) ? $request['form_button_alignment'] : (isset($existing['form_button_alignment']) ? $existing['form_button_alignment'] : 'left')) : 'left',
		);

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
		$settings['popup_button_gradient_start_stop'] = self::clamp_max($settings['popup_button_gradient_start_stop'], 100);
		$settings['popup_button_gradient_end_stop'] = self::clamp_max($settings['popup_button_gradient_end_stop'], 100);
		$settings['popup_button_gradient_angle'] = self::clamp_max($settings['popup_button_gradient_angle'], 360);
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
		$use_gradient = isset($request['shareholders_area_use_gradient']) && '1' == $request['shareholders_area_use_gradient'];
		$solid_color = isset($request['shareholders_area_solid_color']) ? sanitize_hex_color($request['shareholders_area_solid_color']) : '#ffffff';
		$gradient_1 = isset($request['shareholders_area_color1']) ? sanitize_hex_color($request['shareholders_area_color1']) : '#ffffff';
		$gradient_2 = isset($request['shareholders_area_color2']) ? sanitize_hex_color($request['shareholders_area_color2']) : '#fafbfc';

		$settings = array(
			'shareholder_card_bg'            => isset($request['shareholder_card_bg']) ? sanitize_hex_color($request['shareholder_card_bg']) : '#ffffff',
			'shareholder_card_border'        => isset($request['shareholder_card_border']) ? sanitize_hex_color($request['shareholder_card_border']) : '#f0f2f5',
			'shareholder_card_radius'        => isset($request['shareholder_card_radius']) ? absint($request['shareholder_card_radius']) : 10,
			'shareholder_card_shadow'        => isset($request['shareholder_card_shadow']) ? sanitize_text_field($request['shareholder_card_shadow']) : '0 1px 3px rgba(0, 0, 0, 0.05)',
			'shareholder_header_bg'          => isset($request['shareholder_header_bg']) ? sanitize_hex_color($request['shareholder_header_bg']) : '#f9fafb',
			'shareholder_header_color'       => isset($request['shareholder_header_color']) ? sanitize_hex_color($request['shareholder_header_color']) : '#1f2937',
			'shareholder_content_padding'    => isset($request['shareholder_content_padding']) ? absint($request['shareholder_content_padding']) : 12,
			'shareholders_area_bg'           => $use_gradient ? 'linear-gradient(to bottom, ' . $gradient_1 . ' 0%, ' . $gradient_2 . ' 100%)' : $solid_color,
			'shareholders_area_border'       => isset($request['shareholders_area_border']) ? sanitize_hex_color($request['shareholders_area_border']) : '#e1e5e9',
			'shareholders_area_radius'       => isset($request['shareholders_area_radius']) ? absint($request['shareholders_area_radius']) : 10,
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
			'success_button_radius'    => isset($request['success_button_radius']) ? absint($request['success_button_radius']) : 10,
			'success_text_view_cart'   => isset($request['success_text_view_cart']) ? sanitize_text_field($request['success_text_view_cart']) : 'Sepeti Görüntüle',
			'success_text_go_checkout' => isset($request['success_text_go_checkout']) ? sanitize_text_field($request['success_text_go_checkout']) : 'Ödemeye Git',
			'success_text_new_donation'=> isset($request['success_text_new_donation']) ? sanitize_text_field($request['success_text_new_donation']) : 'Yeni Bağış Ekle',
			'success_message_bg'       => isset($request['success_message_bg']) ? sanitize_text_field($request['success_message_bg']) : 'rgba(72, 187, 120, 0.1)',
			'success_message_color'    => isset($request['success_message_color']) ? sanitize_hex_color($request['success_message_color']) : '#48bb78',
			'success_message_border'   => isset($request['success_message_border']) ? sanitize_text_field($request['success_message_border']) : 'rgba(72, 187, 120, 0.2)',
			'success_message_radius'   => isset($request['success_message_radius']) ? absint($request['success_message_radius']) : 10,
			'mini_cart_bg'             => isset($request['mini_cart_bg']) ? sanitize_hex_color($request['mini_cart_bg']) : '#f9fafb',
			'mini_cart_border'         => isset($request['mini_cart_border']) ? sanitize_hex_color($request['mini_cart_border']) : '#e5e7eb',
			'mini_cart_radius'         => isset($request['mini_cart_radius']) ? absint($request['mini_cart_radius']) : 10,
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
		return array(
			'container_bg'    => isset($request['progress_container_bg']) ? sanitize_hex_color($request['progress_container_bg']) : '#f8fafc',
			'container_border'=> isset($request['progress_container_border']) ? sanitize_hex_color($request['progress_container_border']) : '#e2e8f0',
			'track_bg'        => isset($request['progress_track_bg']) ? sanitize_hex_color($request['progress_track_bg']) : '#e2e8f0',
			'fill_start'      => isset($request['progress_fill_start']) ? sanitize_hex_color($request['progress_fill_start']) : '#3b82f6',
			'fill_mid'        => isset($request['progress_fill_mid']) ? sanitize_hex_color($request['progress_fill_mid']) : '#2563eb',
			'fill_end'        => isset($request['progress_fill_end']) ? sanitize_hex_color($request['progress_fill_end']) : '#1d4ed8',
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

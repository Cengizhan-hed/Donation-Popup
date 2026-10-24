<?php
/**
 * Normal form, hisseli form ve başarı/mini sepet özelleştirme sekmeleri.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Renders normal/shareholder/success tabs.
 */
class WDP_Admin_Form_Tabs_Renderer {
	/**
	 * Render normal form customization tab.
	 *
	 * @return void
	 */
	public static function render_normal_form_tab() {
		$button_settings = WDP_Utils::migrate_button_shadow_to_sc_modal(
			WDP_Utils::normalize_legacy_popup_button_text(
				get_option('wdp_button_settings', array())
			)
		);

		$defaults = array(
			'button_primary_color'              => '#0f608b',
			'button_primary_hover'              => '#0c4f72',
			'ui_border_radius'                  => '10',
			'button_border_radius'              => '10',
			'button_text_add_to_cart'           => __('Add to cart', 'woo-donation-popup'),
			'button_text_go_checkout'           => __('Go to checkout', 'woo-donation-popup'),
			'button_text_donate'                => __('Donate', 'woo-donation-popup'),
			'popup_button_text'                 => __('Donate', 'woo-donation-popup'),
			'popup_button_color'                => '#0f608b',
			'popup_button_hover'                => '#0c4f72',
			'popup_button_text_color'           => '#ffffff',
			'popup_button_font_size'            => '18',
			'popup_button_font_weight'          => '700',
			'popup_button_font_family'          => 'inherit',
			'popup_button_custom_font'          => '',
			'popup_button_size'                 => 'large',
			'shortcode_button_size'             => 'medium',
			'popup_button_custom_min_width'     => '140',
			'popup_button_custom_min_height'    => '48',
			'popup_button_custom_padding_x'     => '24',
			'popup_button_border_radius'        => '10',
			'popup_button_border_size'          => '0',
			'popup_button_full_width'           => '0',
			'button_shadow_sc_enabled'          => '0',
			'button_shadow_sc_color'            => '#94a3b8',
			'button_shadow_sc_x'                => '0',
			'button_shadow_sc_y'                => '8',
			'button_shadow_sc_blur'             => '20',
			'button_shadow_sc_spread'           => '0',
			'button_shadow_sc_hover_enhanced'   => '0',
			'button_shadow_sc_hover_blur'       => '24',
			'button_shadow_sc_hover_color'      => '#64748b',
			'button_shadow_sc_hover_x'          => '0',
			'button_shadow_sc_hover_y'          => '10',
			'button_shadow_sc_hover_spread'      => '0',
			'button_shadow_modal_enabled'       => '0',
			'button_shadow_modal_color'         => '#94a3b8',
			'button_shadow_modal_x'             => '0',
			'button_shadow_modal_y'             => '8',
			'button_shadow_modal_blur'          => '20',
			'button_shadow_modal_spread'        => '0',
			'button_shadow_modal_hover_enhanced' => '0',
			'button_shadow_modal_hover_blur'    => '24',
			'button_shadow_modal_hover_color'   => '#64748b',
			'button_shadow_modal_hover_x'       => '0',
			'button_shadow_modal_hover_y'       => '10',
			'button_shadow_modal_hover_spread'  => '0',
		);

		$settings = wp_parse_args($button_settings, $defaults);

		WDP_Admin_Renderer_Helpers::open_settings_split();
		WDP_Admin_Renderer_Helpers::open_form_container('wdp-normal-form-settings-form');
		self::render_normal_tab_header();
		self::render_normal_chrome_section($settings);
		self::render_normal_modal_inner_section($settings);
		self::render_normal_fields_section($settings);
		self::render_normal_wizard_section($settings);
		self::render_normal_form_buttons_section($settings);
		self::render_normal_trigger_section($settings);
		WDP_Admin_Renderer_Helpers::close_form_container('wdp-save-normal-form-settings', true);
		WDP_Admin_Renderer_Helpers::begin_live_preview_aside('wdp-live-preview-normal', __('Standard form preview', 'woo-donation-popup'));
		self::render_normal_form_live_preview($settings);
		WDP_Admin_Renderer_Helpers::close_settings_split();
	}

	/**
	 * Render shareholder form customization tab.
	 *
	 * @return void
	 */
	public static function render_shareholder_form_tab() {
		$settings = get_option('wdp_shareholder_settings', array());
		$defaults = array(
			'shareholder_card_bg'            => '#ffffff',
			'shareholder_card_border'        => '#f0f2f5',
			'shareholder_card_radius'        => '10',
			'shareholder_card_shadow'        => '0 1px 3px rgba(0, 0, 0, 0.05)',
			'shareholder_header_bg'          => '#0f608b',
			'shareholder_header_color'       => '#ffffff',
			'shareholder_header_bg_hover'    => '#0c4f72',
			'shareholder_content_padding'    => '12',
			'shareholders_area_bg'           => '#fafbfc',
			'shareholders_area_border'       => '#e1e5e9',
			'shareholders_area_radius'       => '10',
			'shareholders_scrollbar_color'   => '#0f608b',
			'share_counter_border'           => '#d1d5db',
			'share_counter_bg'               => '#ffffff',
			'share_counter_button_color'     => '#888888',
			'shareholder_header_text'        => __('Shareholder details', 'woo-donation-popup'),
			'shareholder_name_placeholder'   => __('Full name *', 'woo-donation-popup'),
			'shareholder_phone_placeholder'  => __('Phone number *', 'woo-donation-popup'),
			'shareholder_note_placeholder'   => __('Note (optional)', 'woo-donation-popup'),
			'shareholder_copy_button_text'   => __('Create a copy', 'woo-donation-popup'),
			'shareholder_enable_copy_button' => '1',
			'shareholder_layout'             => 'single',
			'shareholder_density'            => 'normal',
			'shareholder_enable_email'       => '0',
			'shareholder_email_placeholder'  => __('Email (optional)', 'woo-donation-popup'),
		);

		$settings = wp_parse_args($settings, $defaults);
		$shareholder_header_text       = $settings['shareholder_header_text'];
		$shareholder_name_placeholder  = $settings['shareholder_name_placeholder'];
		$shareholder_phone_placeholder = $settings['shareholder_phone_placeholder'];
		$shareholder_note_placeholder  = $settings['shareholder_note_placeholder'];
		$shareholder_copy_button_text  = $settings['shareholder_copy_button_text'];
		$enable_copy                   = !empty($settings['shareholder_enable_copy_button']) && (string) $settings['shareholder_enable_copy_button'] !== '0';
		$shareholder_layout            = $settings['shareholder_layout'];
		$shareholder_density           = $settings['shareholder_density'];
		$enable_email                  = !empty($settings['shareholder_enable_email']) && (string) $settings['shareholder_enable_email'] !== '0';
		$shareholder_email_placeholder = $settings['shareholder_email_placeholder'];
		$shareholders_area_bg = WDP_Utils::coerce_solid_hex_background(
			isset($settings['shareholders_area_bg']) ? $settings['shareholders_area_bg'] : '#fafbfc',
			'#fafbfc'
		);

		WDP_Admin_Renderer_Helpers::open_settings_split();
		WDP_Admin_Renderer_Helpers::open_form_container('wdp-shareholder-form-settings-form');

		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('What can you do on this tab?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list"><li>' . esc_html__('Texts, card look, and shareholder-area colors on the share-based donation form.', 'woo-donation-popup') . '</li><li>' . esc_html__('The preview on the right updates as soon as you change settings.', 'woo-donation-popup') . '</li></ul></div>';

		WDP_Admin_Renderer_Helpers::render_section_heading(
			__('Texts and layout', 'woo-donation-popup'),
			__('Heading, placeholders, copy button, and field layout.', 'woo-donation-popup')
		);
		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="shareholder_header_text">' . esc_html__('Shareholder heading text', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_header_text" name="shareholder_header_text" value="' . esc_attr($shareholder_header_text) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_name_placeholder">' . esc_html__('Full name placeholder', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_name_placeholder" name="shareholder_name_placeholder" value="' . esc_attr($shareholder_name_placeholder) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_phone_placeholder">' . esc_html__('Phone placeholder', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_phone_placeholder" name="shareholder_phone_placeholder" value="' . esc_attr($shareholder_phone_placeholder) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_note_placeholder">' . esc_html__('Note placeholder', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_note_placeholder" name="shareholder_note_placeholder" value="' . esc_attr($shareholder_note_placeholder) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_copy_button_text">' . esc_html__('Create-copy button', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_copy_button_text" name="shareholder_copy_button_text" value="' . esc_attr($shareholder_copy_button_text) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_enable_copy_button">' . esc_html__('Copy button', 'woo-donation-popup') . '</label></th><td><label><input type="checkbox" id="shareholder_enable_copy_button" name="shareholder_enable_copy_button" value="1" ' . checked($enable_copy, true, false) . ' /> ' . esc_html__('Show', 'woo-donation-popup') . '</label></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_layout">' . esc_html__('Field layout', 'woo-donation-popup') . '</label></th><td><select id="shareholder_layout" name="shareholder_layout"><option value="single" ' . selected($shareholder_layout, 'single', false) . '>' . esc_html__('One column', 'woo-donation-popup') . '</option><option value="two-column" ' . selected($shareholder_layout, 'two-column', false) . '>' . esc_html__('Two columns', 'woo-donation-popup') . '</option></select></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_density">' . esc_html__('Form density', 'woo-donation-popup') . '</label></th><td><select id="shareholder_density" name="shareholder_density"><option value="compact" ' . selected($shareholder_density, 'compact', false) . '>' . esc_html__('Compact', 'woo-donation-popup') . '</option><option value="normal" ' . selected($shareholder_density, 'normal', false) . '>' . esc_html__('Normal', 'woo-donation-popup') . '</option><option value="spacious" ' . selected($shareholder_density, 'spacious', false) . '>' . esc_html__('Spacious', 'woo-donation-popup') . '</option></select><p class="description">' . esc_html__('Affects spacing, input, and CTA height on all form surfaces.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_enable_email">' . esc_html_x('Email field', 'form tab title', 'woo-donation-popup') . '</label></th><td><label><input type="checkbox" id="shareholder_enable_email" name="shareholder_enable_email" value="1" ' . checked($enable_email, true, false) . ' /> ' . esc_html__('Show', 'woo-donation-popup') . '</label></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_email_placeholder">' . esc_html__('Email placeholder', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_email_placeholder" name="shareholder_email_placeholder" value="' . esc_attr($shareholder_email_placeholder) . '" class="regular-text" /></td></tr>';
		echo '</table>';

		WDP_Admin_Renderer_Helpers::render_section_heading(
			__('Card and field appearance', 'woo-donation-popup'),
			__('Shareholder card, heading bar, and field background.', 'woo-donation-popup')
		);
		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="shareholder_header_bg">' . esc_html__('Heading background', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholder_header_bg" name="shareholder_header_bg" value="' . esc_attr($settings['shareholder_header_bg']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_header_color">' . esc_html__('Heading text', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholder_header_color" name="shareholder_header_color" value="' . esc_attr($settings['shareholder_header_color']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_card_bg">' . esc_html__('Card background', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholder_card_bg" name="shareholder_card_bg" value="' . esc_attr($settings['shareholder_card_bg']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_card_border">' . esc_html__('Card border', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholder_card_border" name="shareholder_card_border" value="' . esc_attr($settings['shareholder_card_border']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_card_radius">' . esc_html__('Card radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="shareholder_card_radius" name="shareholder_card_radius" value="' . esc_attr($settings['shareholder_card_radius']) . '" min="0" max="40" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholders_area_bg">' . esc_html__('Field background', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholders_area_bg" name="shareholders_area_bg" value="' . esc_attr($shareholders_area_bg) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholders_area_border">' . esc_html__('Field border', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholders_area_border" name="shareholders_area_border" value="' . esc_attr($settings['shareholders_area_border']) . '" /></td></tr>';
		echo '</table>';

		WDP_Admin_Renderer_Helpers::close_form_container('wdp-save-shareholder-form-settings');
		WDP_Admin_Renderer_Helpers::begin_live_preview_aside('wdp-live-preview-shareholder', __('Share-based form preview', 'woo-donation-popup'));
		self::render_shareholder_live_preview($settings, $shareholders_area_bg);
		WDP_Admin_Renderer_Helpers::close_settings_split();
	}

	public static function render_success_screen_tab() {
		$settings = get_option('wdp_success_settings', array());
		$defaults = array(
			'success_button_color'      => '#0f608b',
			'success_button_hover'      => '#0c4f72',
			'success_button_radius'     => '10',
			'success_text_view_cart'    => __('Go to cart', 'woo-donation-popup'),
			'success_text_go_checkout'  => __('Complete donation', 'woo-donation-popup'),
			'success_text_new_donation' => __('Continue adding donations', 'woo-donation-popup'),
			'success_message_bg'        => 'rgba(22, 163, 74, 0.1)',
			'success_message_color'     => '#16a34a',
			'success_message_border'    => 'rgba(22, 163, 74, 0.2)',
			'success_message_radius'    => '10',
			'mini_cart_bg'              => '#f9fafb',
			'mini_cart_border'          => '#e5e7eb',
			'mini_cart_radius'          => '10',
			'cart_item_name_color'      => '#1f2937',
			'cart_item_price_color'     => '#0f608b',
			'sadaka_wc_product_id'      => 0,
			'sadaka_toggle_label'       => __('Add add-on donation', 'woo-donation-popup'),
		);
		$settings = wp_parse_args($settings, $defaults);
		if (empty($settings['sadaka_wc_product_id'])) {
			$settings['sadaka_wc_product_id'] = 0;
		}

		WDP_Admin_Renderer_Helpers::open_settings_split();
		WDP_Admin_Renderer_Helpers::open_form_container('wdp-success-screen-settings-form');

		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('What can you do on this tab?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list"><li>' . esc_html__('Success message, mini cart, and action buttons after adding to the cart.', 'woo-donation-popup') . '</li><li>' . esc_html__('The preview on the right shows colors and texts live.', 'woo-donation-popup') . '</li></ul></div>';

		WDP_Admin_Renderer_Helpers::render_section_heading(
			__('Success message', 'woo-donation-popup'),
			__('Color and corner settings for the thank-you row.', 'woo-donation-popup')
		);
		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="success_message_bg">' . esc_html__('Message background', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_message_bg" name="success_message_bg" value="' . esc_attr($settings['success_message_bg']) . '" class="regular-text" /><p class="description">' . esc_html__('Hex or rgba is accepted.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="success_message_color">' . esc_html__('Message text', 'woo-donation-popup') . '</label></th><td><input type="color" id="success_message_color" name="success_message_color" value="' . esc_attr($settings['success_message_color']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_message_border">' . esc_html__('Message border', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_message_border" name="success_message_border" value="' . esc_attr($settings['success_message_border']) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_message_radius">' . esc_html__('Message radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="success_message_radius" name="success_message_radius" value="' . esc_attr($settings['success_message_radius']) . '" min="0" max="50" step="1" class="small-text" /></td></tr>';
		echo '</table>';

		WDP_Admin_Renderer_Helpers::render_section_heading(
			__('Buttons and mini cart', 'woo-donation-popup'),
			__('Action button, mini-cart card, and product row colors.', 'woo-donation-popup')
		);
		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="success_button_color">' . esc_html__('Button color', 'woo-donation-popup') . '</label></th><td><input type="color" id="success_button_color" name="success_button_color" value="' . esc_attr($settings['success_button_color']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_button_hover">' . esc_html__('Button hover', 'woo-donation-popup') . '</label></th><td><input type="color" id="success_button_hover" name="success_button_hover" value="' . esc_attr($settings['success_button_hover']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_button_radius">' . esc_html__('Button radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="success_button_radius" name="success_button_radius" value="' . esc_attr($settings['success_button_radius']) . '" min="0" max="50" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_text_view_cart">' . esc_html__('Go to cart', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_text_view_cart" name="success_text_view_cart" value="' . esc_attr($settings['success_text_view_cart']) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_text_go_checkout">' . esc_html__('Complete donation', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_text_go_checkout" name="success_text_go_checkout" value="' . esc_attr($settings['success_text_go_checkout']) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_text_new_donation">' . esc_html__('New donation', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_text_new_donation" name="success_text_new_donation" value="' . esc_attr($settings['success_text_new_donation']) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="mini_cart_bg">' . esc_html__('Mini cart background', 'woo-donation-popup') . '</label></th><td><input type="color" id="mini_cart_bg" name="mini_cart_bg" value="' . esc_attr($settings['mini_cart_bg']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="mini_cart_border">' . esc_html__('Mini cart border', 'woo-donation-popup') . '</label></th><td><input type="color" id="mini_cart_border" name="mini_cart_border" value="' . esc_attr($settings['mini_cart_border']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="mini_cart_radius">' . esc_html__('Mini cart radius', 'woo-donation-popup') . '</label></th><td><input type="number" id="mini_cart_radius" name="mini_cart_radius" value="' . esc_attr($settings['mini_cart_radius']) . '" min="0" max="50" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="cart_item_name_color">' . esc_html__('Product name color', 'woo-donation-popup') . '</label></th><td><input type="color" id="cart_item_name_color" name="cart_item_name_color" value="' . esc_attr($settings['cart_item_name_color']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="cart_item_price_color">' . esc_html__('Price color', 'woo-donation-popup') . '</label></th><td><input type="color" id="cart_item_price_color" name="cart_item_price_color" value="' . esc_attr($settings['cart_item_price_color']) . '" /></td></tr>';
		echo '</table>';

		WDP_Admin_Renderer_Helpers::render_section_heading(
			__('Add-on donation (default)', 'woo-donation-popup'),
			__('The WooCommerce product used when the product card has no custom ID.', 'woo-donation-popup')
		);
		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="sadaka_wc_product_id">' . esc_html__('Default add-on donation product', 'woo-donation-popup') . '</label></th><td>';
		$sadaka_default_id = absint($settings['sadaka_wc_product_id']);
		if (class_exists('WDP_Sadaka_Product_Visibility')) {
			$opts = WDP_Sadaka_Product_Visibility::product_search_options($sadaka_default_id);
			echo '<select class="wc-product-search" style="width:100%;max-width:400px;" id="sadaka_wc_product_id" name="sadaka_wc_product_id"';
			echo ' data-placeholder="' . esc_attr__('Search by product name…', 'woo-donation-popup') . '"';
			echo ' data-action="woocommerce_json_search_products_and_variations" data-allow_clear="true">';
			foreach ($opts as $opt_id => $opt_label) {
				if ((string) $opt_id === '') {
					continue;
				}
				echo '<option value="' . esc_attr((string) $opt_id) . '" selected="selected">' . esc_html($opt_label) . '</option>';
			}
			echo '</select>';
		} else {
			echo '<input type="number" id="sadaka_wc_product_id" name="sadaka_wc_product_id" value="' . esc_attr($settings['sadaka_wc_product_id']) . '" min="1" step="1" class="small-text" placeholder="' . esc_attr__('e.g. 123', 'woo-donation-popup') . '" />';
		}
		echo '<p class="description">' . esc_html__('If empty/0, the add-on donation row is not added. The selected product is hidden from the shop/list/search; the direct URL and cart still work.', 'woo-donation-popup') . '</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row"><label for="sadaka_toggle_label">' . esc_html__('Add-on donation toggle text', 'woo-donation-popup') . '</label></th><td><input type="text" id="sadaka_toggle_label" name="sadaka_toggle_label" value="' . esc_attr($settings['sadaka_toggle_label']) . '" class="regular-text" /></td></tr>';
		echo '</table>';

		WDP_Admin_Renderer_Helpers::close_form_container('wdp-save-success-screen-settings');
		WDP_Admin_Renderer_Helpers::begin_live_preview_aside('wdp-live-preview-success', __('Success screen preview', 'woo-donation-popup'));
		self::render_success_live_preview($settings);
		WDP_Admin_Renderer_Helpers::close_settings_split();
	}

	/**
	 * Hisseli form live preview (no named inputs).
	 *
	 * @param array  $settings Settings.
	 * @param string $area_bg  Coerced area background.
	 * @return void
	 */
	private static function render_shareholder_live_preview(array $settings, $area_bg) {
		$density = isset($settings['shareholder_density']) ? (string) $settings['shareholder_density'] : 'normal';
		if (!in_array($density, array('compact', 'normal', 'spacious'), true)) {
			$density = 'normal';
		}
		echo '<div class="wdp-admin-share-preview" id="wdp-admin-share-preview" data-density="' . esc_attr($density) . '" style="';
		echo '--wdp-lp-sh-header-bg:' . esc_attr($settings['shareholder_header_bg']) . ';';
		echo '--wdp-lp-sh-header-fg:' . esc_attr($settings['shareholder_header_color']) . ';';
		echo '--wdp-lp-sh-card-bg:' . esc_attr($settings['shareholder_card_bg']) . ';';
		echo '--wdp-lp-sh-card-border:' . esc_attr($settings['shareholder_card_border']) . ';';
		echo '--wdp-lp-sh-radius:' . esc_attr($settings['shareholder_card_radius']) . 'px;';
		echo '--wdp-lp-sh-area:' . esc_attr($area_bg) . ';';
		echo '--wdp-lp-sh-area-border:' . esc_attr($settings['shareholders_area_border']) . ';';
		echo '">';
		echo '<div class="wdp-admin-share-preview__area">';
		echo '<div class="wdp-admin-share-preview__card">';
		echo '<div class="wdp-admin-share-preview__hdr" data-lp-sh-header>' . esc_html($settings['shareholder_header_text']) . '</div>';
		echo '<div class="wdp-admin-share-preview__body">';
		echo '<div class="wdp-admin-share-preview__field" data-lp-sh-name>' . esc_html($settings['shareholder_name_placeholder']) . '</div>';
		echo '<div class="wdp-admin-share-preview__field" data-lp-sh-phone>' . esc_html($settings['shareholder_phone_placeholder']) . '</div>';
		echo '<div class="wdp-admin-share-preview__field" data-lp-sh-note>' . esc_html($settings['shareholder_note_placeholder']) . '</div>';
		echo '<div class="wdp-admin-share-preview__field is-email" data-lp-sh-email hidden>' . esc_html($settings['shareholder_email_placeholder']) . '</div>';
		echo '<button type="button" class="wdp-admin-share-preview__copy" data-lp-sh-copy tabindex="-1">' . esc_html($settings['shareholder_copy_button_text']) . '</button>';
		echo '</div></div></div></div>';
	}

	/**
	 * Success screen live preview (no named inputs).
	 *
	 * @param array $settings Success settings.
	 * @return void
	 */
	private static function render_success_live_preview(array $settings) {
		echo '<div class="wdp-admin-success-preview" id="wdp-admin-success-preview" style="';
		echo '--wdp-lp-su-msg-bg:' . esc_attr($settings['success_message_bg']) . ';';
		echo '--wdp-lp-su-msg-fg:' . esc_attr($settings['success_message_color']) . ';';
		echo '--wdp-lp-su-msg-bd:' . esc_attr($settings['success_message_border']) . ';';
		echo '--wdp-lp-su-msg-r:' . esc_attr($settings['success_message_radius']) . 'px;';
		echo '--wdp-lp-su-btn:' . esc_attr($settings['success_button_color']) . ';';
		echo '--wdp-lp-su-btn-r:' . esc_attr($settings['success_button_radius']) . 'px;';
		echo '--wdp-lp-su-cart-bg:' . esc_attr($settings['mini_cart_bg']) . ';';
		echo '--wdp-lp-su-cart-bd:' . esc_attr($settings['mini_cart_border']) . ';';
		echo '--wdp-lp-su-cart-r:' . esc_attr($settings['mini_cart_radius']) . 'px;';
		echo '--wdp-lp-su-name:' . esc_attr($settings['cart_item_name_color']) . ';';
		echo '--wdp-lp-su-price:' . esc_attr($settings['cart_item_price_color']) . ';';
		echo '">';
		echo '<div class="wdp-admin-success-preview__msg">' . esc_html__('Your donation was added to the cart.', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-admin-success-preview__cart">';
		echo '<div class="wdp-admin-success-preview__row"><span data-lp-su-name class="name">' . esc_html__('Sample campaign', 'woo-donation-popup') . '</span><span data-lp-su-price class="price">₺500</span></div>';
		echo '</div>';
		echo '<div class="wdp-admin-success-preview__actions">';
		echo '<span class="btn" data-lp-su-cart>' . esc_html($settings['success_text_view_cart']) . '</span>';
		echo '<span class="btn primary" data-lp-su-pay>' . esc_html($settings['success_text_go_checkout']) . '</span>';
		echo '<span class="link" data-lp-su-new>' . esc_html($settings['success_text_new_donation']) . '</span>';
		echo '</div></div>';
	}

	/**
	 * Mini modal mock for Normal Form live preview (no named inputs).
	 *
	 * @param array $settings Button/settings map.
	 * @return void
	 */
	private static function render_normal_form_live_preview(array $settings) {
		$title_color = isset($settings['title_color']) ? $settings['title_color'] : '#1f2937';
		$title_size = isset($settings['title_font_size']) ? $settings['title_font_size'] : '22';
		$close_color = isset($settings['close_button_color']) ? $settings['close_button_color'] : '#6b7280';
		$modal_bg = isset($settings['modal_background_color']) ? $settings['modal_background_color'] : '#ffffff';
		$ui_radius = isset($settings['ui_border_radius']) ? $settings['ui_border_radius'] : '12';
		$input_border = isset($settings['input_border_color']) ? $settings['input_border_color'] : '#d1d5db';
		$label_color = isset($settings['label_color']) ? $settings['label_color'] : '#374151';
		$primary = isset($settings['button_primary_color']) ? $settings['button_primary_color'] : '#0f608b';
		$checkout = isset($settings['button_checkout_color']) ? $settings['button_checkout_color'] : '#16a34a';
		$add_text = isset($settings['button_text_add_to_cart']) ? $settings['button_text_add_to_cart'] : __('Add to cart', 'woo-donation-popup');
		$pay_text = isset($settings['button_text_go_checkout']) ? $settings['button_text_go_checkout'] : __('Go to checkout', 'woo-donation-popup');
		$trigger = isset($settings['popup_button_text']) ? $settings['popup_button_text'] : __('Donate', 'woo-donation-popup');
		$trigger_bg = isset($settings['popup_button_color']) ? $settings['popup_button_color'] : '#0f608b';
		$trigger_fg = isset($settings['popup_button_text_color']) ? $settings['popup_button_text_color'] : '#ffffff';
		$wizard_on = !empty($settings['enable_multi_step']) && (string) $settings['enable_multi_step'] === '1';
		$presets_on = !empty($settings['enable_amount_presets']) && (string) $settings['enable_amount_presets'] === '1';
		$presets_raw = isset($settings['amount_presets']) ? $settings['amount_presets'] : (class_exists('WDP_Form_Modules') ? WDP_Form_Modules::default_amount_presets_csv() : '100, 250, 500, 1000, 2500');
		$preset_parts = preg_split('/[\s,;]+/', (string) $presets_raw);
		$preset_chips = array();
		if ($presets_on && is_array($preset_parts)) {
			foreach ($preset_parts as $p) {
				$n = (float) preg_replace('/[^\d.]/', '', str_replace(',', '.', (string) $p));
				if ($n > 0) {
					$preset_chips[] = $n;
				}
				if (count($preset_chips) >= 6) {
					break;
				}
			}
		}

		echo '<div class="wdp-admin-normal-preview' . ($wizard_on ? ' is-wizard' : '') . '" id="wdp-admin-normal-preview" style="';
		echo '--wdp-lp-title:' . esc_attr($title_color) . ';';
		echo '--wdp-lp-title-size:' . esc_attr($title_size) . 'px;';
		echo '--wdp-lp-close:' . esc_attr($close_color) . ';';
		echo '--wdp-lp-modal-bg:' . esc_attr($modal_bg) . ';';
		echo '--wdp-lp-radius:' . esc_attr($ui_radius) . 'px;';
		echo '--wdp-lp-input-border:' . esc_attr($input_border) . ';';
		echo '--wdp-lp-label:' . esc_attr($label_color) . ';';
		echo '--wdp-lp-primary:' . esc_attr($primary) . ';';
		echo '--wdp-lp-checkout:' . esc_attr($checkout) . ';';
		echo '--wdp-lp-trigger-bg:' . esc_attr($trigger_bg) . ';';
		echo '--wdp-lp-trigger-fg:' . esc_attr($trigger_fg) . ';';
		echo '">';
		echo '<button type="button" class="wdp-admin-normal-preview__trigger" tabindex="-1">' . esc_html($trigger) . '</button>';
		echo '<div class="wdp-admin-normal-preview__modal">';
		echo '<div class="wdp-admin-normal-preview__chrome"><span class="wdp-admin-normal-preview__title">' . esc_html__('Sample campaign', 'woo-donation-popup') . '</span><span class="wdp-admin-normal-preview__close" aria-hidden="true">×</span></div>';

		echo '<div class="wdp-admin-normal-preview__wizard" data-lp-wizard ' . ($wizard_on ? '' : 'hidden') . '>';
		echo '<span class="is-active">' . esc_html__('1 Details', 'woo-donation-popup') . '</span>';
		echo '<span>' . esc_html__('2 Amount', 'woo-donation-popup') . '</span>';
		echo '<span>' . esc_html__('3 Confirm', 'woo-donation-popup') . '</span>';
		echo '</div>';

		/* Amount-first: tutar + presets önce, alanlar sonra. Önerilen yalnız üründe ayarlanır (10.29.1). */
		echo '<div class="wdp-admin-normal-preview__amount">';
		echo '<label class="wdp-admin-normal-preview__label">' . esc_html_x('Donation amount', 'admin form tab', 'woo-donation-popup') . '</label>';
		echo '<div class="wdp-admin-normal-preview__presets" data-lp-presets' . ($presets_on ? '' : ' hidden') . '>';
		$preview_symbol = class_exists('WDP_Utils') ? WDP_Utils::get_display_currency_symbol() : '';
		foreach ($preset_chips as $i => $chip) {
			$chip_label = class_exists('WDP_Utils')
				? wp_strip_all_tags(WDP_Utils::format_price_html($chip))
				: ($preview_symbol . (string) (int) $chip);
			echo '<span class="wdp-admin-normal-preview__chip">' . esc_html($chip_label) . '</span>';
		}
		echo '</div>';
		$preview_vals   = class_exists('WDP_Form_Modules') ? WDP_Form_Modules::default_amount_preset_values() : array(100, 250, 500);
		$preview_sample = isset($preview_vals[2]) ? $preview_vals[2] : 25;
		$preview_sample_label = class_exists('WDP_Utils')
			? wp_strip_all_tags(WDP_Utils::format_localized_amount($preview_sample))
			: (string) $preview_sample;
		echo '<div class="wdp-admin-normal-preview__input amount"><span>' . esc_html($preview_symbol) . '</span><em>' . esc_html($preview_sample_label) . '</em></div>';
		echo '</div>';

		echo '<div class="wdp-admin-normal-preview__stack">';
		echo '<div class="wdp-admin-normal-preview__row"><span class="wdp-admin-normal-preview__icon" aria-hidden="true"></span><span class="wdp-admin-normal-preview__ph">' . esc_html__('Full name *', 'woo-donation-popup') . '</span></div>';
		echo '<div class="wdp-admin-normal-preview__row"><span class="wdp-admin-normal-preview__icon phone" aria-hidden="true"></span><span class="wdp-admin-normal-preview__ph">' . esc_html__('+1 555 000 0000', 'woo-donation-popup') . '</span></div>';
		echo '<div class="wdp-admin-normal-preview__row"><span class="wdp-admin-normal-preview__icon note" aria-hidden="true"></span><span class="wdp-admin-normal-preview__ph">' . esc_html__('Note (optional)', 'woo-donation-popup') . '</span></div>';
		echo '</div>';

		echo '<div class="wdp-admin-normal-preview__actions">';
		echo '<span class="wdp-admin-normal-preview__btn primary" data-lp-add>' . esc_html($add_text) . '</span>';
		echo '<span class="wdp-admin-normal-preview__btn checkout" data-lp-pay>' . esc_html($pay_text) . '</span>';
		echo '</div>';
		echo '<p class="wdp-admin-normal-preview__trust">' . esc_html__('Secure payment · Instant confirmation', 'woo-donation-popup') . '</p>';
		echo '</div></div>';
	}

	private static function render_normal_tab_header() {
		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('What can you do on this tab?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list"><li>' . esc_html__('The order below follows the flow the donor sees in the popup: heading and close first, then the box and fields, and finally the form buttons and the on-page trigger button.', 'woo-donation-popup') . '</li><li>' . esc_html__('Window width and padding are on the “Popup & form layout” tab; this tab covers the popup’s inner color, texts, and buttons.', 'woo-donation-popup') . '</li><li>' . esc_html__('If “Multiple shares” or “Progress bar” is on in the product card, some settings live on the share/progress tabs.', 'woo-donation-popup') . '</li></ul></div>';
		echo '<nav class="wdp-settings-toc" aria-label="' . esc_attr__('Standard form sections', 'woo-donation-popup') . '"><span class="wdp-settings-toc__label">' . esc_html__('On this page:', 'woo-donation-popup') . '</span><a href="#wdp-normal-sec-presets">' . esc_html__('Style packs', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-icons">' . esc_html__('Icons', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-chrome">' . esc_html__('Heading and close', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-modal-inner">' . esc_html__('Box inside the popup', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-fields">' . esc_html__('Fields and labels', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-wizard">' . esc_html__('Multi-step form', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-amount-presets">' . esc_html__('Quick amount', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-form-buttons">' . esc_html__('Buttons below the form', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-trigger">' . esc_html__('On-page trigger button', 'woo-donation-popup') . '</a></nav>';
	}

	private static function render_normal_chrome_section(array $settings) {
		$title_color = isset($settings['title_color']) ? $settings['title_color'] : '#1f2937';
		$title_size = isset($settings['title_font_size']) ? $settings['title_font_size'] : '27';
		$title_size_mobile = !empty($settings['title_font_size_mobile']) ? $settings['title_font_size_mobile'] : $title_size;
		$close_color = isset($settings['close_button_color']) ? $settings['close_button_color'] : '#6b7280';
		echo '<div id="wdp-normal-sec-chrome" class="wdp-settings-section"><h2>' . __('Heading settings', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="title_color">' . __('Heading color', 'woo-donation-popup') . '</label></th><td><input type="color" id="title_color" name="title_color" value="' . esc_attr($title_color) . '" /></td></tr><tr><th scope="row"><label for="title_font_size">' . __('Heading font size (desktop, px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="title_font_size" name="title_font_size" value="' . esc_attr($title_size) . '" min="14" max="48" step="1" class="small-text" /></td></tr><tr><th scope="row"><label for="title_font_size_mobile">' . __('Heading font size (mobile, px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="title_font_size_mobile" name="title_font_size_mobile" value="' . esc_attr($title_size_mobile) . '" min="12" max="40" step="1" class="small-text" /></td></tr></table>';
		echo '<h2>' . __('Close button settings', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="close_button_color">' . __('Close button color', 'woo-donation-popup') . '</label></th><td><input type="color" id="close_button_color" name="close_button_color" value="' . esc_attr($close_color) . '" /></td></tr></table></div>';
	}

	private static function render_normal_modal_inner_section(array $settings) {
		$modal_bg = isset($settings['modal_background_color']) ? $settings['modal_background_color'] : '#ffffff';
		$ui_radius = isset($settings['ui_border_radius']) ? $settings['ui_border_radius'] : (isset($settings['modal_border_radius']) ? $settings['modal_border_radius'] : '10');
		echo '<div id="wdp-normal-sec-modal-inner" class="wdp-settings-section"><h2>' . __('Box inside the popup (background and corners)', 'woo-donation-popup') . '</h2><p class="wdp-settings-section__hint">' . esc_html__('Window width and inner padding are on the “Popup & form layout” tab; this is the content-box color and the corner radius for the whole UI.', 'woo-donation-popup') . '</p><table class="form-table"><tr><th scope="row"><label for="modal_background_color">' . __('Popup background color', 'woo-donation-popup') . '</label></th><td><input type="color" id="modal_background_color" name="modal_background_color" value="' . esc_attr($modal_bg) . '" /></td></tr><tr><th scope="row"><label for="ui_border_radius">' . __('UI radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="ui_border_radius" name="ui_border_radius" value="' . esc_attr($ui_radius) . '" min="0" max="50" step="1" class="small-text" /><p class="description">' . esc_html__('One radius for the popup, inputs, buttons, and cards (default 10).', 'woo-donation-popup') . '</p><input type="hidden" name="modal_border_radius" value="' . esc_attr($ui_radius) . '" /><input type="hidden" name="input_border_radius" value="' . esc_attr($ui_radius) . '" /><input type="hidden" name="button_border_radius" value="' . esc_attr($ui_radius) . '" /><input type="hidden" name="popup_button_border_radius" value="' . esc_attr($ui_radius) . '" /></td></tr></table></div>';
	}

	private static function render_normal_fields_section(array $settings) {
		$input_border = isset($settings['input_border_color']) ? $settings['input_border_color'] : '#d1d5db';
		$label_color = isset($settings['label_color']) ? $settings['label_color'] : '#374151';
		$label_font_size = isset($settings['label_font_size']) ? $settings['label_font_size'] : 14;
		$label_font_weight = isset($settings['label_font_weight']) ? $settings['label_font_weight'] : '600';
		$placeholder_color = isset($settings['placeholder_color']) ? $settings['placeholder_color'] : '#64748b';
		$form_gap = isset($settings['form_gap']) ? $settings['form_gap'] : 16;
		echo '<div id="wdp-normal-sec-fields" class="wdp-settings-section"><h2>' . __('Input field settings', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="input_border_color">' . __('Input border color', 'woo-donation-popup') . '</label></th><td><input type="color" id="input_border_color" name="input_border_color" value="' . esc_attr($input_border) . '" /></td></tr><tr><th scope="row"><label for="label_color">' . __('Label color', 'woo-donation-popup') . '</label></th><td><input type="color" id="label_color" name="label_color" value="' . esc_attr($label_color) . '" /></td></tr><tr><th scope="row"><label for="label_font_size">' . __('Label font size (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="label_font_size" name="label_font_size" value="' . esc_attr($label_font_size) . '" min="10" max="24" step="1" class="small-text" /></td></tr><tr><th scope="row"><label for="label_font_weight">' . __('Label font weight', 'woo-donation-popup') . '</label></th><td><select id="label_font_weight" name="label_font_weight"><option value="400" ' . selected($label_font_weight, '400', false) . '>' . esc_html__('Normal (400)', 'woo-donation-popup') . '</option><option value="500" ' . selected($label_font_weight, '500', false) . '>' . esc_html__('Medium (500)', 'woo-donation-popup') . '</option><option value="600" ' . selected($label_font_weight, '600', false) . '>' . esc_html__('Semibold (600)', 'woo-donation-popup') . '</option><option value="700" ' . selected($label_font_weight, '700', false) . '>' . esc_html__('Bold (700)', 'woo-donation-popup') . '</option></select></td></tr><tr><th scope="row"><label for="placeholder_color">' . __('Placeholder color', 'woo-donation-popup') . '</label></th><td><input type="color" id="placeholder_color" name="placeholder_color" value="' . esc_attr($placeholder_color) . '" /></td></tr><tr><th scope="row"><label for="form_gap">' . __('Spacing between form elements (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="form_gap" name="form_gap" value="' . esc_attr($form_gap) . '" min="4" max="40" step="1" class="small-text" /></td></tr></table></div>';
	}

	/**
	 * Açılır-kapanır çok adımlı form ayarı.
	 *
	 * @param array $settings Settings.
	 * @return void
	 */
	private static function render_normal_wizard_section(array $settings) {
		$enabled = !empty($settings['enable_multi_step']) && (string) $settings['enable_multi_step'] === '1';
		$presets_enabled = !empty($settings['enable_amount_presets']) && (string) $settings['enable_amount_presets'] === '1';
		$amount_presets = isset($settings['amount_presets']) ? $settings['amount_presets'] : (class_exists('WDP_Form_Modules') ? WDP_Form_Modules::default_amount_presets_csv() : '100, 250, 500, 1000, 2500');
		echo '<div id="wdp-normal-sec-wizard" class="wdp-settings-section"><h2>' . esc_html__('Multi-step form', 'woo-donation-popup') . '</h2>';
		echo '<p class="wdp-settings-section__hint">' . esc_html__('When on, the form moves step by step. Share-based: Shares → Confirm. Standard/Progress: Details → Amount → (Add-on donation) → Confirm. The progress bar always stays at the top.', 'woo-donation-popup') . '</p>';
		echo '<table class="form-table"><tr><th scope="row">' . esc_html__('Enable the multi-step form', 'woo-donation-popup') . '</th><td>';
		echo '<label class="wdp-admin-toggle"><input type="checkbox" id="enable_multi_step" name="enable_multi_step" value="1" ' . checked($enabled, true, false) . ' /> ';
		echo '<span>' . esc_html__('Use a step-by-step flow in the popup and inline forms', 'woo-donation-popup') . '</span></label>';
		echo '<p class="description">' . esc_html__('When off, the form stays on a single screen in the classic layout.', 'woo-donation-popup') . '</p>';
		echo '</td></tr></table></div>';

		echo '<div id="wdp-normal-sec-amount-presets" class="wdp-settings-section"><h2>' . esc_html__('Quick amount buttons', 'woo-donation-popup') . '</h2>';
		echo '<p class="wdp-settings-section__hint">' . esc_html__('Shows one-click buttons above the amount box only on “Custom amount (donor enters)” and “Goal campaign” forms. When off, only the amount field is shown.', 'woo-donation-popup') . '</p>';
		echo '<table class="form-table"><tr><th scope="row">' . esc_html__('Show quick amount buttons', 'woo-donation-popup') . '</th><td>';
		echo '<label class="wdp-admin-toggle"><input type="checkbox" id="enable_amount_presets" name="enable_amount_presets" value="1" ' . checked($presets_enabled, true, false) . ' data-wdp-toggle-target="#wdp-amount-presets-fields" /> ';
		echo '<span>' . esc_html__('One-click buttons such as $100 / $250 above the amount box.', 'woo-donation-popup') . '</span></label>';
		echo '</td></tr></table>';
		echo '<div id="wdp-amount-presets-fields" class="wdp-admin-collapsible"' . ($presets_enabled ? '' : ' hidden') . '>';
		echo '<table class="form-table"><tr><th scope="row"><label for="amount_presets">' . esc_html__('Quick amount buttons', 'woo-donation-popup') . '</label></th><td>';
		echo '<input type="text" id="amount_presets" name="amount_presets" value="' . esc_attr($amount_presets) . '" class="large-text" />';
		echo '<p class="description">' . esc_html__('Whole numbers only; separate with commas, spaces, or semicolons, at most 6 values (e.g. 100, 250, 500, 1000, 2500). "1.000" or "1,5" is invalid. Buttons below the product’s minimum amount are not shown. The “Suggested” label comes only from the Suggested amount field on the product card.', 'woo-donation-popup') . '</p>';
		echo '<p class="description" id="wdp-amount-presets-hint" data-lp-preset-hint></p>';
		echo '</td></tr></table></div></div>';
	}

	private static function render_normal_form_buttons_section(array $settings) {
		$checkout_color = isset($settings['button_checkout_color']) ? $settings['button_checkout_color'] : '#16a34a';
		$checkout_hover = isset($settings['button_checkout_hover']) ? $settings['button_checkout_hover'] : '#15803d';

		echo '<div id="wdp-normal-sec-form-buttons" class="wdp-settings-section"><h2>' . __('Button colors', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="button_primary_color">' . __('Primary button color', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_primary_color" name="button_primary_color" value="' . esc_attr($settings['button_primary_color']) . '" /></td></tr><tr><th scope="row"><label for="button_primary_hover">' . __('Button hover color', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_primary_hover" name="button_primary_hover" value="' . esc_attr($settings['button_primary_hover']) . '" /></td></tr><tr><th scope="row"><label for="button_checkout_color">' . __('Pay button color', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_checkout_color" name="button_checkout_color" value="' . esc_attr($checkout_color) . '" /></td></tr><tr><th scope="row"><label for="button_checkout_hover">' . __('Pay button hover color', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_checkout_hover" name="button_checkout_hover" value="' . esc_attr($checkout_hover) . '" /></td></tr></table>';

		echo '<h2>' . __('Button shadow (plugin buttons only)', 'woo-donation-popup') . '</h2>';
		echo '<p class="description" style="margin-top:0;">' . esc_html__('Two groups: (1) shortcode/trigger buttons on the page — CSS `--wdp-plugin-btn-shadow-sc`; (2) all other plugin buttons inside the popup and inline form — `--wdp-plugin-btn-shadow-modal`. Close (X) and quick amount buttons are excluded.', 'woo-donation-popup') . '</p>';

		self::render_button_shadow_settings_group($settings, 'sc', __('1) Shortcode / trigger buttons', 'woo-donation-popup'), 'wdp-bs-sc');
		self::render_button_shadow_settings_group($settings, 'modal', __('2) Buttons inside the popup and inline form', 'woo-donation-popup'), 'wdp-bs-modal');

		echo '<h2>' . __('Button labels', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="button_text_add_to_cart">' . __('Add to cart button', 'woo-donation-popup') . '</label></th><td><input type="text" id="button_text_add_to_cart" name="button_text_add_to_cart" value="' . esc_attr($settings['button_text_add_to_cart']) . '" class="regular-text" /></td></tr><tr><th scope="row"><label for="button_text_go_checkout">' . __('Go to checkout button', 'woo-donation-popup') . '</label></th><td><input type="text" id="button_text_go_checkout" name="button_text_go_checkout" value="' . esc_attr($settings['button_text_go_checkout']) . '" class="regular-text" /></td></tr></table></div>';
	}

	/**
	 * Buton box-shadow ayar tablosu (sc | modal).
	 *
	 * @param array  $settings WP option + defaults.
	 * @param string $slot     'sc' veya 'modal'.
	 * @param string $title    Bölüm başlığı.
	 * @param string $css_class tbody sınıfı (admin JS satır gösterme).
	 */
	private static function render_button_shadow_settings_group( array $settings, $slot, $title, $css_class ) {
		$pre = 'button_shadow_' . $slot . '_';
		$shadow_enabled  = isset($settings[ $pre . 'enabled' ]) ? $settings[ $pre . 'enabled' ] : '0';
		$sx              = isset($settings[ $pre . 'x' ]) ? (int) $settings[ $pre . 'x' ] : 0;
		$sy              = isset($settings[ $pre . 'y' ]) ? (int) $settings[ $pre . 'y' ] : 8;
		$sblur           = isset($settings[ $pre . 'blur' ]) ? (int) $settings[ $pre . 'blur' ] : 20;
		$sspread         = isset($settings[ $pre . 'spread' ]) ? (int) $settings[ $pre . 'spread' ] : 0;
		$shadow_color    = isset($settings[ $pre . 'color' ]) ? $settings[ $pre . 'color' ] : '#94a3b8';
		$hover_shadow_en = isset($settings[ $pre . 'hover_enhanced' ]) ? $settings[ $pre . 'hover_enhanced' ] : '0';
		$hx              = isset($settings[ $pre . 'hover_x' ]) ? (int) $settings[ $pre . 'hover_x' ] : 0;
		$hy              = isset($settings[ $pre . 'hover_y' ]) ? (int) $settings[ $pre . 'hover_y' ] : 10;
		$hblur           = isset($settings[ $pre . 'hover_blur' ]) ? (int) $settings[ $pre . 'hover_blur' ] : 24;
		$hspread         = isset($settings[ $pre . 'hover_spread' ]) ? (int) $settings[ $pre . 'hover_spread' ] : 0;
		$hcolor          = isset($settings[ $pre . 'hover_color' ]) && $settings[ $pre . 'hover_color' ] ? $settings[ $pre . 'hover_color' ] : '#64748b';

		$id_en   = $pre . 'enabled';
		$id_hov  = $pre . 'hover_enhanced';
		$varcite = ('sc' === $slot)
			? '--wdp-plugin-btn-shadow-sc / --wdp-plugin-btn-shadow-sc-hover'
			: '--wdp-plugin-btn-shadow-modal / --wdp-plugin-btn-shadow-modal-hover';

		echo '<h3>' . esc_html($title) . '</h3>';
		echo '<table class="form-table wdp-button-shadow-group ' . esc_attr($css_class) . '" data-shadow-slot="' . esc_attr($slot) . '">';
		echo '<tr class="button-shadow-master-row"><th scope="row"><label for="' . esc_attr($id_en) . '">' . __('Enable button shadow', 'woo-donation-popup') . '</label></th><td><label><input type="checkbox" id="' . esc_attr($id_en) . '" name="' . esc_attr($id_en) . '" value="1" ' . checked($shadow_enabled, '1', false) . ' /> ' . esc_html__('When on, buttons in this group get the regular shadow.', 'woo-donation-popup') . '</label>';
		echo '<p class="description">' . esc_html__('When off, no box-shadow output is generated for this group.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr class="button-shadow-rows"><th scope="row"><label for="' . esc_attr($pre) . 'color">' . __('Regular shadow color (hex)', 'woo-donation-popup') . '</label></th><td><input type="color" id="' . esc_attr($pre) . 'color" name="' . esc_attr($pre) . 'color" value="' . esc_attr($shadow_color) . '" /></td></tr>';
		echo '<tr class="button-shadow-rows"><th scope="row">' . __('Regular shadow: X/Y/blur/spread (px)', 'woo-donation-popup') . '</th><td>';
		echo '<label style="margin-right:12px">' . esc_html__('X', 'woo-donation-popup') . ' <input type="number" class="small-text" name="' . esc_attr($pre) . 'x" id="' . esc_attr($pre) . 'x" value="' . esc_attr($sx) . '" min="-24" max="24" step="1" /></label>';
		echo '<label style="margin-right:12px">' . esc_html__('Y', 'woo-donation-popup') . ' <input type="number" class="small-text" name="' . esc_attr($pre) . 'y" id="' . esc_attr($pre) . 'y" value="' . esc_attr($sy) . '" min="-24" max="24" step="1" /></label>';
		echo '<label style="margin-right:12px">' . esc_html__('Blur', 'woo-donation-popup') . ' <input type="number" class="small-text" name="' . esc_attr($pre) . 'blur" id="' . esc_attr($pre) . 'blur" value="' . esc_attr($sblur) . '" min="0" max="48" step="1" /></label>';
		echo '<label>' . esc_html__('Spread', 'woo-donation-popup') . ' <input type="number" class="small-text" name="' . esc_attr($pre) . 'spread" id="' . esc_attr($pre) . 'spread" value="' . esc_attr($sspread) . '" min="-8" max="12" step="1" /></label>';
		echo '<p class="description">' . esc_html__('Suggested light value: Y 8px / blur 20px.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr class="button-shadow-rows"><th scope="row">' . __('Enable hover shadow', 'woo-donation-popup') . '</th><td><label><input type="checkbox" id="' . esc_attr($id_hov) . '" name="' . esc_attr($id_hov) . '" value="1" ' . checked($hover_shadow_en, '1', false) . ' /> ' . sprintf(
			/* translators: %s: CSS custom property names */
			esc_html__('When on, hover/focus uses a separate shadow (%s); when off, only the regular shadow remains.', 'woo-donation-popup'),
			esc_html($varcite)
		) . '</label></td></tr>';
		echo '<tr class="button-shadow-rows button-shadow-hover-extra"><th scope="row"><label for="' . esc_attr($pre) . 'hover_color">' . __('Hover shadow color (hex)', 'woo-donation-popup') . '</label></th><td><input type="color" id="' . esc_attr($pre) . 'hover_color" name="' . esc_attr($pre) . 'hover_color" value="' . esc_attr($hcolor) . '" /></td></tr>';
		echo '<tr class="button-shadow-rows button-shadow-hover-extra"><th scope="row">' . __('Hover shadow: X/Y/blur/spread (px)', 'woo-donation-popup') . '</th><td>';
		echo '<label style="margin-right:12px">' . esc_html__('X', 'woo-donation-popup') . ' <input type="number" class="small-text" id="' . esc_attr($pre) . 'hover_x" name="' . esc_attr($pre) . 'hover_x" value="' . esc_attr($hx) . '" min="-24" max="24" step="1" /></label>';
		echo '<label style="margin-right:12px">' . esc_html__('Y', 'woo-donation-popup') . ' <input type="number" class="small-text" id="' . esc_attr($pre) . 'hover_y" name="' . esc_attr($pre) . 'hover_y" value="' . esc_attr($hy) . '" min="-24" max="24" step="1" /></label>';
		echo '<label style="margin-right:12px">' . esc_html__('Blur', 'woo-donation-popup') . ' <input type="number" class="small-text" id="' . esc_attr($pre) . 'hover_blur" name="' . esc_attr($pre) . 'hover_blur" value="' . esc_attr($hblur) . '" min="0" max="48" step="1" /></label>';
		echo '<label>' . esc_html__('Spread', 'woo-donation-popup') . ' <input type="number" class="small-text" id="' . esc_attr($pre) . 'hover_spread" name="' . esc_attr($pre) . 'hover_spread" value="' . esc_attr($hspread) . '" min="-8" max="12" step="1" /></label></td></tr>';
		echo '</table>';
	}

	private static function render_normal_trigger_section(array $settings) {
		$popup_button_text = isset($settings['popup_button_text']) ? $settings['popup_button_text'] : __('Donate', 'woo-donation-popup');
		$popup_button_color = isset($settings['popup_button_color']) ? $settings['popup_button_color'] : '#0f608b';
		$popup_button_hover = isset($settings['popup_button_hover']) ? $settings['popup_button_hover'] : '#0c4f72';
		$popup_button_text_color = isset($settings['popup_button_text_color']) ? $settings['popup_button_text_color'] : '#ffffff';
		$shortcode_button_size = isset($settings['shortcode_button_size']) ? strtolower((string) $settings['shortcode_button_size']) : 'medium';
		if (!in_array($shortcode_button_size, array('small', 'medium', 'large', 'xlarge'), true)) {
			$shortcode_button_size = 'medium';
		}
		echo '<div id="wdp-normal-sec-trigger" class="wdp-settings-section"><h2>' . __('On-page trigger button (shortcode)', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="popup_button_text">' . _x('Button text', 'design tab', 'woo-donation-popup') . '</label></th><td><input type="text" id="popup_button_text" name="popup_button_text" value="' . esc_attr($popup_button_text) . '" class="regular-text" /></td></tr><tr><th scope="row"><label for="popup_button_color">' . __('Button color', 'woo-donation-popup') . '</label></th><td><input type="color" id="popup_button_color" name="popup_button_color" value="' . esc_attr($popup_button_color) . '" /></td></tr><tr><th scope="row"><label for="popup_button_hover">' . __('Button hover color', 'woo-donation-popup') . '</label></th><td><input type="color" id="popup_button_hover" name="popup_button_hover" value="' . esc_attr($popup_button_hover) . '" /></td></tr><tr><th scope="row"><label for="popup_button_text_color">' . __('Button text color', 'woo-donation-popup') . '</label></th><td><input type="color" id="popup_button_text_color" name="popup_button_text_color" value="' . esc_attr($popup_button_text_color) . '" /><p class="description">' . esc_html__('Only on the shortcode trigger; use it for readability on a light background.', 'woo-donation-popup') . '</p></td></tr><tr><th scope="row"><label for="shortcode_button_size">' . __('Shortcode button size', 'woo-donation-popup') . '</label></th><td><select id="shortcode_button_size" name="shortcode_button_size"><option value="small" ' . selected($shortcode_button_size, 'small', false) . '>' . esc_html__('Small', 'woo-donation-popup') . '</option><option value="medium" ' . selected($shortcode_button_size, 'medium', false) . '>' . esc_html__('Medium', 'woo-donation-popup') . '</option><option value="large" ' . selected($shortcode_button_size, 'large', false) . '>' . esc_html__('Large', 'woo-donation-popup') . '</option><option value="xlarge" ' . selected($shortcode_button_size, 'xlarge', false) . '>' . esc_html__('Extra large', 'woo-donation-popup') . '</option></select><p class="description">' . esc_html__('Affects only the trigger button added with the shortcode; it does not affect buttons inside the popup or form.', 'woo-donation-popup') . '</p></td></tr></table></div>';
	}
}

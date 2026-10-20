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
			'button_text_add_to_cart'           => 'Sepete Ekle',
			'button_text_go_checkout'           => 'Ödemeye Git',
			'button_text_donate'                => 'Bağış Yap',
			'popup_button_text'                 => 'Bağış Yap',
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
		WDP_Admin_Renderer_Helpers::begin_live_preview_aside('wdp-live-preview-normal', __('Normal form önizlemesi', 'woo-donation-popup'));
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
			'shareholder_header_text'        => 'Hissedar Bilgileri',
			'shareholder_name_placeholder'   => 'Ad Soyad *',
			'shareholder_phone_placeholder'  => 'Telefon Numarası *',
			'shareholder_note_placeholder'   => 'Not (isteğe bağlı)',
			'shareholder_copy_button_text'   => 'Kopyasını Oluştur',
			'shareholder_enable_copy_button' => '1',
			'shareholder_layout'             => 'single',
			'shareholder_density'            => 'normal',
			'shareholder_enable_email'       => '0',
			'shareholder_email_placeholder'  => 'E-posta (isteğe bağlı)',
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

		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('Bu sekmede ne yaparsınız?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list"><li>' . esc_html__('Hisseli bağış formundaki metinler, kart görünümü ve hissedar alanı renkleri.', 'woo-donation-popup') . '</li><li>' . esc_html__('Sağdaki önizleme ayarları değiştirildikçe anında güncellenir.', 'woo-donation-popup') . '</li></ul></div>';

		WDP_Admin_Renderer_Helpers::render_section_heading(
			__('Metinler ve düzen', 'woo-donation-popup'),
			__('Başlık, placeholder’lar, kopya butonu ve alan düzeni.', 'woo-donation-popup')
		);
		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="shareholder_header_text">' . esc_html__('Hissedar Başlık Metni', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_header_text" name="shareholder_header_text" value="' . esc_attr($shareholder_header_text) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_name_placeholder">' . esc_html__('Ad Soyad Placeholder', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_name_placeholder" name="shareholder_name_placeholder" value="' . esc_attr($shareholder_name_placeholder) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_phone_placeholder">' . esc_html__('Telefon Placeholder', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_phone_placeholder" name="shareholder_phone_placeholder" value="' . esc_attr($shareholder_phone_placeholder) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_note_placeholder">' . esc_html__('Not Placeholder', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_note_placeholder" name="shareholder_note_placeholder" value="' . esc_attr($shareholder_note_placeholder) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_copy_button_text">' . esc_html__('Kopya Oluştur Butonu', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_copy_button_text" name="shareholder_copy_button_text" value="' . esc_attr($shareholder_copy_button_text) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_enable_copy_button">' . esc_html__('Kopya Butonu', 'woo-donation-popup') . '</label></th><td><label><input type="checkbox" id="shareholder_enable_copy_button" name="shareholder_enable_copy_button" value="1" ' . checked($enable_copy, true, false) . ' /> ' . esc_html__('Göster', 'woo-donation-popup') . '</label></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_layout">' . esc_html__('Alan Düzeni', 'woo-donation-popup') . '</label></th><td><select id="shareholder_layout" name="shareholder_layout"><option value="single" ' . selected($shareholder_layout, 'single', false) . '>' . esc_html__('Tek Sütun', 'woo-donation-popup') . '</option><option value="two-column" ' . selected($shareholder_layout, 'two-column', false) . '>' . esc_html__('İki Sütun', 'woo-donation-popup') . '</option></select></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_density">' . esc_html__('Form Yoğunluğu', 'woo-donation-popup') . '</label></th><td><select id="shareholder_density" name="shareholder_density"><option value="compact" ' . selected($shareholder_density, 'compact', false) . '>' . esc_html__('Kompakt', 'woo-donation-popup') . '</option><option value="normal" ' . selected($shareholder_density, 'normal', false) . '>' . esc_html__('Normal', 'woo-donation-popup') . '</option><option value="spacious" ' . selected($shareholder_density, 'spacious', false) . '>' . esc_html__('Geniş', 'woo-donation-popup') . '</option></select><p class="description">' . esc_html__('Tüm form yüzeylerinde boşluk, input ve CTA yüksekliğini etkiler.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_enable_email">' . esc_html__('E-posta Alanı', 'woo-donation-popup') . '</label></th><td><label><input type="checkbox" id="shareholder_enable_email" name="shareholder_enable_email" value="1" ' . checked($enable_email, true, false) . ' /> ' . esc_html__('Göster', 'woo-donation-popup') . '</label></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_email_placeholder">' . esc_html__('E-posta Placeholder', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_email_placeholder" name="shareholder_email_placeholder" value="' . esc_attr($shareholder_email_placeholder) . '" class="regular-text" /></td></tr>';
		echo '</table>';

		WDP_Admin_Renderer_Helpers::render_section_heading(
			__('Kart ve alan görünümü', 'woo-donation-popup'),
			__('Hissedar kartı, başlık şeridi ve alan arka planı.', 'woo-donation-popup')
		);
		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="shareholder_header_bg">' . esc_html__('Başlık Arka Plan', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholder_header_bg" name="shareholder_header_bg" value="' . esc_attr($settings['shareholder_header_bg']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_header_color">' . esc_html__('Başlık Metin', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholder_header_color" name="shareholder_header_color" value="' . esc_attr($settings['shareholder_header_color']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_card_bg">' . esc_html__('Kart Arka Plan', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholder_card_bg" name="shareholder_card_bg" value="' . esc_attr($settings['shareholder_card_bg']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_card_border">' . esc_html__('Kart Border', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholder_card_border" name="shareholder_card_border" value="' . esc_attr($settings['shareholder_card_border']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_card_radius">' . esc_html__('Kart Radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="shareholder_card_radius" name="shareholder_card_radius" value="' . esc_attr($settings['shareholder_card_radius']) . '" min="0" max="40" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholders_area_bg">' . esc_html__('Alan Arka Plan', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholders_area_bg" name="shareholders_area_bg" value="' . esc_attr($shareholders_area_bg) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholders_area_border">' . esc_html__('Alan Border', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholders_area_border" name="shareholders_area_border" value="' . esc_attr($settings['shareholders_area_border']) . '" /></td></tr>';
		echo '</table>';

		WDP_Admin_Renderer_Helpers::close_form_container('wdp-save-shareholder-form-settings');
		WDP_Admin_Renderer_Helpers::begin_live_preview_aside('wdp-live-preview-shareholder', __('Hisseli form önizlemesi', 'woo-donation-popup'));
		self::render_shareholder_live_preview($settings, $shareholders_area_bg);
		WDP_Admin_Renderer_Helpers::close_settings_split();
	}

	public static function render_success_screen_tab() {
		$settings = get_option('wdp_success_settings', array());
		$defaults = array(
			'success_button_color'      => '#0f608b',
			'success_button_hover'      => '#0c4f72',
			'success_button_radius'     => '10',
			'success_text_view_cart'    => 'Sepete Git',
			'success_text_go_checkout'  => 'Bağışı Tamamla',
			'success_text_new_donation' => 'Bağış eklemeye devam edin',
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
			'sadaka_toggle_label'       => 'Alt Bağış Ekle',
		);
		$settings = wp_parse_args($settings, $defaults);
		if (empty($settings['sadaka_wc_product_id'])) {
			$settings['sadaka_wc_product_id'] = 0;
		}

		WDP_Admin_Renderer_Helpers::open_settings_split();
		WDP_Admin_Renderer_Helpers::open_form_container('wdp-success-screen-settings-form');

		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('Bu sekmede ne yaparsınız?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list"><li>' . esc_html__('Sepete ekleme sonrası başarı mesajı, mini sepet ve aksiyon butonları.', 'woo-donation-popup') . '</li><li>' . esc_html__('Sağdaki önizleme renk ve metinleri canlı gösterir.', 'woo-donation-popup') . '</li></ul></div>';

		WDP_Admin_Renderer_Helpers::render_section_heading(
			__('Başarı mesajı', 'woo-donation-popup'),
			__('Teşekkür satırının renk ve köşe ayarları.', 'woo-donation-popup')
		);
		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="success_message_bg">' . esc_html__('Mesaj Arka Plan', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_message_bg" name="success_message_bg" value="' . esc_attr($settings['success_message_bg']) . '" class="regular-text" /><p class="description">' . esc_html__('Hex veya rgba kabul edilir.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="success_message_color">' . esc_html__('Mesaj Metin', 'woo-donation-popup') . '</label></th><td><input type="color" id="success_message_color" name="success_message_color" value="' . esc_attr($settings['success_message_color']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_message_border">' . esc_html__('Mesaj Border', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_message_border" name="success_message_border" value="' . esc_attr($settings['success_message_border']) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_message_radius">' . esc_html__('Mesaj Radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="success_message_radius" name="success_message_radius" value="' . esc_attr($settings['success_message_radius']) . '" min="0" max="50" step="1" class="small-text" /></td></tr>';
		echo '</table>';

		WDP_Admin_Renderer_Helpers::render_section_heading(
			__('Butonlar ve mini sepet', 'woo-donation-popup'),
			__('Aksiyon butonları, mini sepet kartı ve ürün satırı renkleri.', 'woo-donation-popup')
		);
		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="success_button_color">' . esc_html__('Buton Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="success_button_color" name="success_button_color" value="' . esc_attr($settings['success_button_color']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_button_hover">' . esc_html__('Buton Hover', 'woo-donation-popup') . '</label></th><td><input type="color" id="success_button_hover" name="success_button_hover" value="' . esc_attr($settings['success_button_hover']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_button_radius">' . esc_html__('Buton Radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="success_button_radius" name="success_button_radius" value="' . esc_attr($settings['success_button_radius']) . '" min="0" max="50" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_text_view_cart">' . esc_html__('Sepete Git', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_text_view_cart" name="success_text_view_cart" value="' . esc_attr($settings['success_text_view_cart']) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_text_go_checkout">' . esc_html__('Bağışı Tamamla', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_text_go_checkout" name="success_text_go_checkout" value="' . esc_attr($settings['success_text_go_checkout']) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_text_new_donation">' . esc_html__('Yeni Bağış', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_text_new_donation" name="success_text_new_donation" value="' . esc_attr($settings['success_text_new_donation']) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="mini_cart_bg">' . esc_html__('Mini Sepet Arka Plan', 'woo-donation-popup') . '</label></th><td><input type="color" id="mini_cart_bg" name="mini_cart_bg" value="' . esc_attr($settings['mini_cart_bg']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="mini_cart_border">' . esc_html__('Mini Sepet Border', 'woo-donation-popup') . '</label></th><td><input type="color" id="mini_cart_border" name="mini_cart_border" value="' . esc_attr($settings['mini_cart_border']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="mini_cart_radius">' . esc_html__('Mini Sepet Radius', 'woo-donation-popup') . '</label></th><td><input type="number" id="mini_cart_radius" name="mini_cart_radius" value="' . esc_attr($settings['mini_cart_radius']) . '" min="0" max="50" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="cart_item_name_color">' . esc_html__('Ürün Adı Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="cart_item_name_color" name="cart_item_name_color" value="' . esc_attr($settings['cart_item_name_color']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="cart_item_price_color">' . esc_html__('Fiyat Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="cart_item_price_color" name="cart_item_price_color" value="' . esc_attr($settings['cart_item_price_color']) . '" /></td></tr>';
		echo '</table>';

		WDP_Admin_Renderer_Helpers::render_section_heading(
			__('Alt bağış (varsayılan)', 'woo-donation-popup'),
			__('Ürün kartında özel ID yoksa kullanılan WC ürünü.', 'woo-donation-popup')
		);
		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="sadaka_wc_product_id">' . esc_html__('Varsayılan alt bağış ürünü', 'woo-donation-popup') . '</label></th><td>';
		$sadaka_default_id = absint($settings['sadaka_wc_product_id']);
		if (class_exists('WDP_Sadaka_Product_Visibility')) {
			$opts = WDP_Sadaka_Product_Visibility::product_search_options($sadaka_default_id);
			echo '<select class="wc-product-search" style="width:100%;max-width:400px;" id="sadaka_wc_product_id" name="sadaka_wc_product_id"';
			echo ' data-placeholder="' . esc_attr__('Ürün adı ile ara…', 'woo-donation-popup') . '"';
			echo ' data-action="woocommerce_json_search_products_and_variations" data-allow_clear="true">';
			foreach ($opts as $opt_id => $opt_label) {
				if ((string) $opt_id === '') {
					continue;
				}
				echo '<option value="' . esc_attr((string) $opt_id) . '" selected="selected">' . esc_html($opt_label) . '</option>';
			}
			echo '</select>';
		} else {
			echo '<input type="number" id="sadaka_wc_product_id" name="sadaka_wc_product_id" value="' . esc_attr($settings['sadaka_wc_product_id']) . '" min="1" step="1" class="small-text" placeholder="' . esc_attr__('Örn: 123', 'woo-donation-popup') . '" />';
		}
		echo '<p class="description">' . esc_html__('Boş/0 ise alt bağış satırı eklenmez. Seçilen ürün mağaza/liste/aramadan gizlenir; doğrudan URL ve sepet çalışmaya devam eder.', 'woo-donation-popup') . '</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row"><label for="sadaka_toggle_label">' . esc_html__('Alt Bağış Toggle Metni', 'woo-donation-popup') . '</label></th><td><input type="text" id="sadaka_toggle_label" name="sadaka_toggle_label" value="' . esc_attr($settings['sadaka_toggle_label']) . '" class="regular-text" /></td></tr>';
		echo '</table>';

		WDP_Admin_Renderer_Helpers::close_form_container('wdp-save-success-screen-settings');
		WDP_Admin_Renderer_Helpers::begin_live_preview_aside('wdp-live-preview-success', __('Başarı ekranı önizlemesi', 'woo-donation-popup'));
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
		echo '<div class="wdp-admin-success-preview__msg">' . esc_html__('Bağışınız sepete eklendi.', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-admin-success-preview__cart">';
		echo '<div class="wdp-admin-success-preview__row"><span data-lp-su-name class="name">' . esc_html__('Örnek Kampanya', 'woo-donation-popup') . '</span><span data-lp-su-price class="price">₺500</span></div>';
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
		$add_text = isset($settings['button_text_add_to_cart']) ? $settings['button_text_add_to_cart'] : 'Sepete Ekle';
		$pay_text = isset($settings['button_text_go_checkout']) ? $settings['button_text_go_checkout'] : 'Ödemeye Git';
		$trigger = isset($settings['popup_button_text']) ? $settings['popup_button_text'] : 'Bağış Yap';
		$trigger_bg = isset($settings['popup_button_color']) ? $settings['popup_button_color'] : '#0f608b';
		$trigger_fg = isset($settings['popup_button_text_color']) ? $settings['popup_button_text_color'] : '#ffffff';
		$wizard_on = !empty($settings['enable_multi_step']) && (string) $settings['enable_multi_step'] === '1';
		$presets_on = !empty($settings['enable_amount_presets']) && (string) $settings['enable_amount_presets'] === '1';
		$presets_raw = isset($settings['amount_presets']) ? $settings['amount_presets'] : '100, 250, 500, 1000';
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
		echo '<div class="wdp-admin-normal-preview__chrome"><span class="wdp-admin-normal-preview__title">' . esc_html__('Örnek Kampanya', 'woo-donation-popup') . '</span><span class="wdp-admin-normal-preview__close" aria-hidden="true">×</span></div>';

		echo '<div class="wdp-admin-normal-preview__wizard" data-lp-wizard ' . ($wizard_on ? '' : 'hidden') . '>';
		echo '<span class="is-active">' . esc_html__('1 Bilgi', 'woo-donation-popup') . '</span>';
		echo '<span>' . esc_html__('2 Tutar', 'woo-donation-popup') . '</span>';
		echo '<span>' . esc_html__('3 Onay', 'woo-donation-popup') . '</span>';
		echo '</div>';

		/* Amount-first: tutar + presets önce, alanlar sonra. Önerilen yalnız üründe ayarlanır (10.29.1). */
		echo '<div class="wdp-admin-normal-preview__amount">';
		echo '<label class="wdp-admin-normal-preview__label">' . esc_html__('Bağış tutarı', 'woo-donation-popup') . '</label>';
		echo '<div class="wdp-admin-normal-preview__presets" data-lp-presets' . ($presets_on ? '' : ' hidden') . '>';
		foreach ($preset_chips as $i => $chip) {
			echo '<span class="wdp-admin-normal-preview__chip">₺' . esc_html((string) (int) $chip) . '</span>';
		}
		echo '</div>';
		echo '<div class="wdp-admin-normal-preview__input amount"><span>₺</span><em>' . esc_html__('500', 'woo-donation-popup') . '</em></div>';
		echo '</div>';

		echo '<div class="wdp-admin-normal-preview__stack">';
		echo '<div class="wdp-admin-normal-preview__row"><span class="wdp-admin-normal-preview__icon" aria-hidden="true"></span><span class="wdp-admin-normal-preview__ph">' . esc_html__('Ad Soyad *', 'woo-donation-popup') . '</span></div>';
		echo '<div class="wdp-admin-normal-preview__row"><span class="wdp-admin-normal-preview__icon phone" aria-hidden="true"></span><span class="wdp-admin-normal-preview__ph">' . esc_html__('+90 5xx xxx xx xx', 'woo-donation-popup') . '</span></div>';
		echo '<div class="wdp-admin-normal-preview__row"><span class="wdp-admin-normal-preview__icon note" aria-hidden="true"></span><span class="wdp-admin-normal-preview__ph">' . esc_html__('Not (isteğe bağlı)', 'woo-donation-popup') . '</span></div>';
		echo '</div>';

		echo '<div class="wdp-admin-normal-preview__actions">';
		echo '<span class="wdp-admin-normal-preview__btn primary" data-lp-add>' . esc_html($add_text) . '</span>';
		echo '<span class="wdp-admin-normal-preview__btn checkout" data-lp-pay>' . esc_html($pay_text) . '</span>';
		echo '</div>';
		echo '<p class="wdp-admin-normal-preview__trust">' . esc_html__('Güvenli ödeme · Anında onay', 'woo-donation-popup') . '</p>';
		echo '</div></div>';
	}

	private static function render_normal_tab_header() {
		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('Bu sekmede ne yaparsınız?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list"><li>' . esc_html__('Aşağıdaki sıra, popup’ta kullanıcının gördüğü akışa göredir: önce üst başlık ve kapat, sonra kutu ve alanlar, en sonda form butonları ve sayfadaki açan buton.', 'woo-donation-popup') . '</li><li>' . esc_html__('Pencere genişliği ve padding “Modal & Form Görünümü” sekmesindedir; bu sekme modalın iç rengi, yazılar ve butonları kapsar.', 'woo-donation-popup') . '</li><li>' . esc_html__('Ürün kartında “Çoklu Hisse” veya “Progress Bar” açıksa bir kısım ayar hisse/progress sekmelerindedir.', 'woo-donation-popup') . '</li></ul></div>';
		echo '<nav class="wdp-settings-toc" aria-label="' . esc_attr__('Normal form bölümleri', 'woo-donation-popup') . '"><span class="wdp-settings-toc__label">' . esc_html__('Bu sayfada:', 'woo-donation-popup') . '</span><a href="#wdp-normal-sec-presets">' . esc_html__('Görünüm paketleri', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-icons">' . esc_html__('İkonlar', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-chrome">' . esc_html__('Başlık ve kapat', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-modal-inner">' . esc_html__('Modal içi kutu', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-fields">' . esc_html__('Alanlar ve etiketler', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-wizard">' . esc_html__('Çok adımlı form', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-amount-presets">' . esc_html__('Hızlı tutar', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-form-buttons">' . esc_html__('Form altı butonları', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-trigger">' . esc_html__('Sayfadaki açan buton', 'woo-donation-popup') . '</a></nav>';
	}

	private static function render_normal_chrome_section(array $settings) {
		$title_color = isset($settings['title_color']) ? $settings['title_color'] : '#1f2937';
		$title_size = isset($settings['title_font_size']) ? $settings['title_font_size'] : '27';
		$title_size_mobile = !empty($settings['title_font_size_mobile']) ? $settings['title_font_size_mobile'] : $title_size;
		$close_color = isset($settings['close_button_color']) ? $settings['close_button_color'] : '#6b7280';
		echo '<div id="wdp-normal-sec-chrome" class="wdp-settings-section"><h2>' . __('Başlık Ayarları', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="title_color">' . __('Başlık Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="title_color" name="title_color" value="' . esc_attr($title_color) . '" /></td></tr><tr><th scope="row"><label for="title_font_size">' . __('Başlık Font Boyutu (Masaüstü, px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="title_font_size" name="title_font_size" value="' . esc_attr($title_size) . '" min="14" max="48" step="1" class="small-text" /></td></tr><tr><th scope="row"><label for="title_font_size_mobile">' . __('Başlık Font Boyutu (Mobil, px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="title_font_size_mobile" name="title_font_size_mobile" value="' . esc_attr($title_size_mobile) . '" min="12" max="40" step="1" class="small-text" /></td></tr></table>';
		echo '<h2>' . __('Kapat Butonu Ayarları', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="close_button_color">' . __('Kapat Butonu Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="close_button_color" name="close_button_color" value="' . esc_attr($close_color) . '" /></td></tr></table></div>';
	}

	private static function render_normal_modal_inner_section(array $settings) {
		$modal_bg = isset($settings['modal_background_color']) ? $settings['modal_background_color'] : '#ffffff';
		$ui_radius = isset($settings['ui_border_radius']) ? $settings['ui_border_radius'] : (isset($settings['modal_border_radius']) ? $settings['modal_border_radius'] : '10');
		echo '<div id="wdp-normal-sec-modal-inner" class="wdp-settings-section"><h2>' . __('Modal içi kutu (arka plan ve köşeler)', 'woo-donation-popup') . '</h2><p class="wdp-settings-section__hint">' . esc_html__('Pencere genişliği ve iç padding “Modal & Form Görünümü” sekmesindedir; burası içerik kutusunun rengi ve tüm UI köşe yuvarlaklığıdır.', 'woo-donation-popup') . '</p><table class="form-table"><tr><th scope="row"><label for="modal_background_color">' . __('Modal Arka Plan Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="modal_background_color" name="modal_background_color" value="' . esc_attr($modal_bg) . '" /></td></tr><tr><th scope="row"><label for="ui_border_radius">' . __('UI Radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="ui_border_radius" name="ui_border_radius" value="' . esc_attr($ui_radius) . '" min="0" max="50" step="1" class="small-text" /><p class="description">' . esc_html__('Modal, input, buton ve kartlar için tek radius (varsayılan 10).', 'woo-donation-popup') . '</p><input type="hidden" name="modal_border_radius" value="' . esc_attr($ui_radius) . '" /><input type="hidden" name="input_border_radius" value="' . esc_attr($ui_radius) . '" /><input type="hidden" name="button_border_radius" value="' . esc_attr($ui_radius) . '" /><input type="hidden" name="popup_button_border_radius" value="' . esc_attr($ui_radius) . '" /></td></tr></table></div>';
	}

	private static function render_normal_fields_section(array $settings) {
		$input_border = isset($settings['input_border_color']) ? $settings['input_border_color'] : '#d1d5db';
		$label_color = isset($settings['label_color']) ? $settings['label_color'] : '#374151';
		$label_font_size = isset($settings['label_font_size']) ? $settings['label_font_size'] : 14;
		$label_font_weight = isset($settings['label_font_weight']) ? $settings['label_font_weight'] : '600';
		$placeholder_color = isset($settings['placeholder_color']) ? $settings['placeholder_color'] : '#64748b';
		$form_gap = isset($settings['form_gap']) ? $settings['form_gap'] : 16;
		echo '<div id="wdp-normal-sec-fields" class="wdp-settings-section"><h2>' . __('Input Alanları Ayarları', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="input_border_color">' . __('Input Border Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="input_border_color" name="input_border_color" value="' . esc_attr($input_border) . '" /></td></tr><tr><th scope="row"><label for="label_color">' . __('Label Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="label_color" name="label_color" value="' . esc_attr($label_color) . '" /></td></tr><tr><th scope="row"><label for="label_font_size">' . __('Label Font Boyutu (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="label_font_size" name="label_font_size" value="' . esc_attr($label_font_size) . '" min="10" max="24" step="1" class="small-text" /></td></tr><tr><th scope="row"><label for="label_font_weight">' . __('Label Font Kalınlığı', 'woo-donation-popup') . '</label></th><td><select id="label_font_weight" name="label_font_weight"><option value="400" ' . selected($label_font_weight, '400', false) . '>Normal (400)</option><option value="500" ' . selected($label_font_weight, '500', false) . '>Orta (500)</option><option value="600" ' . selected($label_font_weight, '600', false) . '>Yarı Kalın (600)</option><option value="700" ' . selected($label_font_weight, '700', false) . '>Kalın (700)</option></select></td></tr><tr><th scope="row"><label for="placeholder_color">' . __('Placeholder Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="placeholder_color" name="placeholder_color" value="' . esc_attr($placeholder_color) . '" /></td></tr><tr><th scope="row"><label for="form_gap">' . __('Form Elemanları Arası Boşluk (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="form_gap" name="form_gap" value="' . esc_attr($form_gap) . '" min="4" max="40" step="1" class="small-text" /></td></tr></table></div>';
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
		$amount_presets = isset($settings['amount_presets']) ? $settings['amount_presets'] : '100, 250, 500, 1000, 2500';
		echo '<div id="wdp-normal-sec-wizard" class="wdp-settings-section"><h2>' . esc_html__('Çok adımlı form', 'woo-donation-popup') . '</h2>';
		echo '<p class="wdp-settings-section__hint">' . esc_html__('Açıldığında form adım adım ilerler. Hisseli: Hisseler → Onay. Standart/Progress: Bilgiler → Tutar → (Alt bağış) → Onay. Progress bar her zaman üstte kalır.', 'woo-donation-popup') . '</p>';
		echo '<table class="form-table"><tr><th scope="row">' . esc_html__('Çok adımlı formu etkinleştir', 'woo-donation-popup') . '</th><td>';
		echo '<label class="wdp-admin-toggle"><input type="checkbox" id="enable_multi_step" name="enable_multi_step" value="1" ' . checked($enabled, true, false) . ' /> ';
		echo '<span>' . esc_html__('Popup ve gömülü formlarda adım adım akış kullan', 'woo-donation-popup') . '</span></label>';
		echo '<p class="description">' . esc_html__('Kapalıyken form tek ekranda klasik görünümde kalır.', 'woo-donation-popup') . '</p>';
		echo '</td></tr></table></div>';

		echo '<div id="wdp-normal-sec-amount-presets" class="wdp-settings-section"><h2>' . esc_html__('Hızlı tutar düğmeleri', 'woo-donation-popup') . '</h2>';
		echo '<p class="wdp-settings-section__hint">' . esc_html__('Yalnız "Bağışçı belirler" ve "Hedefli kampanya" formlarında, tutar kutusunun üstünde tek tıkla seçilen düğmeleri gösterir. Kapalıyken yalnızca tutar alanı görünür.', 'woo-donation-popup') . '</p>';
		echo '<table class="form-table"><tr><th scope="row">' . esc_html__('Hızlı tutar düğmelerini göster', 'woo-donation-popup') . '</th><td>';
		echo '<label class="wdp-admin-toggle"><input type="checkbox" id="enable_amount_presets" name="enable_amount_presets" value="1" ' . checked($presets_enabled, true, false) . ' data-wdp-toggle-target="#wdp-amount-presets-fields" /> ';
		echo '<span>' . esc_html__('Tutar kutusunun üstünde 100 ₺ / 250 ₺ gibi tek tıkla seçilen düğmeler.', 'woo-donation-popup') . '</span></label>';
		echo '</td></tr></table>';
		echo '<div id="wdp-amount-presets-fields" class="wdp-admin-collapsible"' . ($presets_enabled ? '' : ' hidden') . '>';
		echo '<table class="form-table"><tr><th scope="row"><label for="amount_presets">' . esc_html__('Hızlı tutar düğmeleri', 'woo-donation-popup') . '</label></th><td>';
		echo '<input type="text" id="amount_presets" name="amount_presets" value="' . esc_attr($amount_presets) . '" class="large-text" />';
		echo '<p class="description">' . esc_html__('Yalnız tam sayılar; virgül, boşluk veya noktalı virgülle ayırın, en fazla 6 değer (ör. 100, 250, 500, 1000, 2500). "1.000" veya "1,5" geçersizdir. Ürünün en düşük tutarının altındaki düğmeler gösterilmez. "Önerilen" etiketi yalnız ürün kartındaki Önerilen tutar alanından gelir.', 'woo-donation-popup') . '</p>';
		echo '<p class="description" id="wdp-amount-presets-hint" data-lp-preset-hint></p>';
		echo '</td></tr></table></div></div>';
	}

	private static function render_normal_form_buttons_section(array $settings) {
		$checkout_color = isset($settings['button_checkout_color']) ? $settings['button_checkout_color'] : '#16a34a';
		$checkout_hover = isset($settings['button_checkout_hover']) ? $settings['button_checkout_hover'] : '#15803d';

		echo '<div id="wdp-normal-sec-form-buttons" class="wdp-settings-section"><h2>' . __('Buton Renkleri', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="button_primary_color">' . __('Birincil Buton Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_primary_color" name="button_primary_color" value="' . esc_attr($settings['button_primary_color']) . '" /></td></tr><tr><th scope="row"><label for="button_primary_hover">' . __('Buton Hover Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_primary_hover" name="button_primary_hover" value="' . esc_attr($settings['button_primary_hover']) . '" /></td></tr><tr><th scope="row"><label for="button_checkout_color">' . __('Ödeme Yap Butonu Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_checkout_color" name="button_checkout_color" value="' . esc_attr($checkout_color) . '" /></td></tr><tr><th scope="row"><label for="button_checkout_hover">' . __('Ödeme Yap Butonu Hover Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_checkout_hover" name="button_checkout_hover" value="' . esc_attr($checkout_hover) . '" /></td></tr></table>';

		echo '<h2>' . __('Buton gölgesi (yalnızca eklenti butonları)', 'woo-donation-popup') . '</h2>';
		echo '<p class="description" style="margin-top:0;">' . esc_html__('İki grup: (1) sayfadaki shortcode/tetikleyici düğmeler — CSS `--wdp-plugin-btn-shadow-sc`; (2) popup ve sayfa içi form içindeki Tüm diğer eklenti butonları — `--wdp-plugin-btn-shadow-modal`. Kapama (X) ve hızlı tutar düğmeleri hariç.', 'woo-donation-popup') . '</p>';

		self::render_button_shadow_settings_group($settings, 'sc', __('1) Shortcode / tetikleyici butonları', 'woo-donation-popup'), 'wdp-bs-sc');
		self::render_button_shadow_settings_group($settings, 'modal', __('2) Popup ve gömülü form içindeki butonlar', 'woo-donation-popup'), 'wdp-bs-modal');

		echo '<h2>' . __('Buton Metinleri', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="button_text_add_to_cart">' . __('Sepete Ekle Butonu', 'woo-donation-popup') . '</label></th><td><input type="text" id="button_text_add_to_cart" name="button_text_add_to_cart" value="' . esc_attr($settings['button_text_add_to_cart']) . '" class="regular-text" /></td></tr><tr><th scope="row"><label for="button_text_go_checkout">' . __('Ödemeye Git Butonu', 'woo-donation-popup') . '</label></th><td><input type="text" id="button_text_go_checkout" name="button_text_go_checkout" value="' . esc_attr($settings['button_text_go_checkout']) . '" class="regular-text" /></td></tr></table></div>';
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
		echo '<tr class="button-shadow-master-row"><th scope="row"><label for="' . esc_attr($id_en) . '">' . __('Buton gölgesini etkinleştir', 'woo-donation-popup') . '</label></th><td><label><input type="checkbox" id="' . esc_attr($id_en) . '" name="' . esc_attr($id_en) . '" value="1" ' . checked($shadow_enabled, '1', false) . ' /> ' . esc_html__('Açıksa bu gruptaki butonlar normal gölge alır.', 'woo-donation-popup') . '</label>';
		echo '<p class="description">' . esc_html__('Kapalıyken bu grup için box-shadow çıktısı üretilmez.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr class="button-shadow-rows"><th scope="row"><label for="' . esc_attr($pre) . 'color">' . __('Normal gölge rengi (hex)', 'woo-donation-popup') . '</label></th><td><input type="color" id="' . esc_attr($pre) . 'color" name="' . esc_attr($pre) . 'color" value="' . esc_attr($shadow_color) . '" /></td></tr>';
		echo '<tr class="button-shadow-rows"><th scope="row">' . __('Normal gölge: X/Y/bulanık/yayılım (px)', 'woo-donation-popup') . '</th><td>';
		echo '<label style="margin-right:12px">' . esc_html__('X', 'woo-donation-popup') . ' <input type="number" class="small-text" name="' . esc_attr($pre) . 'x" id="' . esc_attr($pre) . 'x" value="' . esc_attr($sx) . '" min="-24" max="24" step="1" /></label>';
		echo '<label style="margin-right:12px">' . esc_html__('Y', 'woo-donation-popup') . ' <input type="number" class="small-text" name="' . esc_attr($pre) . 'y" id="' . esc_attr($pre) . 'y" value="' . esc_attr($sy) . '" min="-24" max="24" step="1" /></label>';
		echo '<label style="margin-right:12px">' . esc_html__('Bulanık', 'woo-donation-popup') . ' <input type="number" class="small-text" name="' . esc_attr($pre) . 'blur" id="' . esc_attr($pre) . 'blur" value="' . esc_attr($sblur) . '" min="0" max="48" step="1" /></label>';
		echo '<label>' . esc_html__('Yayılım', 'woo-donation-popup') . ' <input type="number" class="small-text" name="' . esc_attr($pre) . 'spread" id="' . esc_attr($pre) . 'spread" value="' . esc_attr($sspread) . '" min="-8" max="12" step="1" /></label>';
		echo '<p class="description">' . esc_html__('Önerilen hafif değer: Y 8px / bulanık 20px.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr class="button-shadow-rows"><th scope="row">' . __('Hover gölgesini etkinleştir', 'woo-donation-popup') . '</th><td><label><input type="checkbox" id="' . esc_attr($id_hov) . '" name="' . esc_attr($id_hov) . '" value="1" ' . checked($hover_shadow_en, '1', false) . ' /> ' . sprintf(
			/* translators: %s: CSS custom property names */
			esc_html__('Açıksa hover/odakta ayrı gölge (%s); kapalıysa yalnızca normal gölge kalır.', 'woo-donation-popup'),
			esc_html($varcite)
		) . '</label></td></tr>';
		echo '<tr class="button-shadow-rows button-shadow-hover-extra"><th scope="row"><label for="' . esc_attr($pre) . 'hover_color">' . __('Hover gölge rengi (hex)', 'woo-donation-popup') . '</label></th><td><input type="color" id="' . esc_attr($pre) . 'hover_color" name="' . esc_attr($pre) . 'hover_color" value="' . esc_attr($hcolor) . '" /></td></tr>';
		echo '<tr class="button-shadow-rows button-shadow-hover-extra"><th scope="row">' . __('Hover gölge: X/Y/bulanık/yayılım (px)', 'woo-donation-popup') . '</th><td>';
		echo '<label style="margin-right:12px">' . esc_html__('X', 'woo-donation-popup') . ' <input type="number" class="small-text" id="' . esc_attr($pre) . 'hover_x" name="' . esc_attr($pre) . 'hover_x" value="' . esc_attr($hx) . '" min="-24" max="24" step="1" /></label>';
		echo '<label style="margin-right:12px">' . esc_html__('Y', 'woo-donation-popup') . ' <input type="number" class="small-text" id="' . esc_attr($pre) . 'hover_y" name="' . esc_attr($pre) . 'hover_y" value="' . esc_attr($hy) . '" min="-24" max="24" step="1" /></label>';
		echo '<label style="margin-right:12px">' . esc_html__('Bulanık', 'woo-donation-popup') . ' <input type="number" class="small-text" id="' . esc_attr($pre) . 'hover_blur" name="' . esc_attr($pre) . 'hover_blur" value="' . esc_attr($hblur) . '" min="0" max="48" step="1" /></label>';
		echo '<label>' . esc_html__('Yayılım', 'woo-donation-popup') . ' <input type="number" class="small-text" id="' . esc_attr($pre) . 'hover_spread" name="' . esc_attr($pre) . 'hover_spread" value="' . esc_attr($hspread) . '" min="-8" max="12" step="1" /></label></td></tr>';
		echo '</table>';
	}

	private static function render_normal_trigger_section(array $settings) {
		$popup_button_text = isset($settings['popup_button_text']) ? $settings['popup_button_text'] : 'Bağış Yap';
		$popup_button_color = isset($settings['popup_button_color']) ? $settings['popup_button_color'] : '#0f608b';
		$popup_button_hover = isset($settings['popup_button_hover']) ? $settings['popup_button_hover'] : '#0c4f72';
		$popup_button_text_color = isset($settings['popup_button_text_color']) ? $settings['popup_button_text_color'] : '#ffffff';
		$shortcode_button_size = isset($settings['shortcode_button_size']) ? strtolower((string) $settings['shortcode_button_size']) : 'medium';
		if (!in_array($shortcode_button_size, array('small', 'medium', 'large', 'xlarge'), true)) {
			$shortcode_button_size = 'medium';
		}
		echo '<div id="wdp-normal-sec-trigger" class="wdp-settings-section"><h2>' . __('Sayfadaki açan buton (shortcode)', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="popup_button_text">' . __('Buton Metni', 'woo-donation-popup') . '</label></th><td><input type="text" id="popup_button_text" name="popup_button_text" value="' . esc_attr($popup_button_text) . '" class="regular-text" /></td></tr><tr><th scope="row"><label for="popup_button_color">' . __('Buton Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="popup_button_color" name="popup_button_color" value="' . esc_attr($popup_button_color) . '" /></td></tr><tr><th scope="row"><label for="popup_button_hover">' . __('Buton Hover Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="popup_button_hover" name="popup_button_hover" value="' . esc_attr($popup_button_hover) . '" /></td></tr><tr><th scope="row"><label for="popup_button_text_color">' . __('Buton metin rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="popup_button_text_color" name="popup_button_text_color" value="' . esc_attr($popup_button_text_color) . '" /><p class="description">' . esc_html__('Yalnızca shortcode tetikleyicide; açık arka planda okunabilirlik için kullanın.', 'woo-donation-popup') . '</p></td></tr><tr><th scope="row"><label for="shortcode_button_size">' . __('Shortcode buton boyutu', 'woo-donation-popup') . '</label></th><td><select id="shortcode_button_size" name="shortcode_button_size"><option value="small" ' . selected($shortcode_button_size, 'small', false) . '>' . esc_html__('Küçük', 'woo-donation-popup') . '</option><option value="medium" ' . selected($shortcode_button_size, 'medium', false) . '>' . esc_html__('Orta', 'woo-donation-popup') . '</option><option value="large" ' . selected($shortcode_button_size, 'large', false) . '>' . esc_html__('Büyük', 'woo-donation-popup') . '</option><option value="xlarge" ' . selected($shortcode_button_size, 'xlarge', false) . '>' . esc_html__('Çok büyük', 'woo-donation-popup') . '</option></select><p class="description">' . esc_html__('Yalnızca shortcode ile eklenen tetikleyici butonu etkiler; popup veya form içi butonları etkilemez.', 'woo-donation-popup') . '</p></td></tr></table></div>';
	}
}

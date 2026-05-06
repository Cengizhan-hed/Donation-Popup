<?php
/**
 * Admin form tab renderers.
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
			'button_primary_color'              => '#1e73be',
			'button_primary_hover'              => '#185d98',
			'button_border_radius'              => '20',
			'button_text_add_to_cart'           => 'Sepete Ekle',
			'button_text_go_checkout'           => 'Ödemeye Git',
			'button_text_donate'                => 'Bağış Yap',
			'popup_button_text'                 => 'Bağış Yap',
			'popup_button_color'                => '#1e73be',
			'popup_button_hover'                => '#185d98',
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
			'popup_button_border_radius'        => '20',
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

		WDP_Admin_Renderer_Helpers::open_form_container('wdp-normal-form-settings-form');
		self::render_normal_tab_header();
		self::render_normal_chrome_section($settings);
		self::render_normal_modal_inner_section($settings);
		self::render_normal_fields_section($settings);
		self::render_normal_form_buttons_section($settings);
		self::render_normal_trigger_section($settings);
		WDP_Admin_Renderer_Helpers::close_form_container('wdp-save-normal-form-settings', true);
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
			'shareholder_card_radius'        => '20',
			'shareholder_card_shadow'        => '0 1px 3px rgba(0, 0, 0, 0.05)',
			'shareholder_header_bg'          => '#f9fafb',
			'shareholder_header_color'       => '#1f2937',
			'shareholder_content_padding'    => '12',
			'shareholders_area_bg'           => '#fafbfc',
			'shareholders_area_border'       => '#e1e5e9',
			'shareholders_area_radius'       => '20',
			'shareholders_scrollbar_color'   => '#4a90e2',
			'share_counter_border'           => '#d1d5db',
			'share_counter_bg'               => '#ffffff',
			'share_counter_button_color'     => '#888888',
			'shareholder_header_text'        => 'Hissedar Bilgileri',
			'shareholder_name_placeholder'   => 'Ad Soyad *',
			'shareholder_phone_placeholder'  => 'Telefon Numarası *',
			'shareholder_note_placeholder'   => 'Not (isteğe bağlı)',
			'shareholder_copy_button_text'   => '📋 Kopyasını Oluştur',
			'shareholder_enable_copy_button' => '1',
			'shareholder_layout'             => 'single',
			'shareholder_density'            => 'normal',
			'shareholder_enable_email'       => '0',
			'shareholder_email_placeholder'  => 'E-posta (isteğe bağlı)',
		);

		$settings = wp_parse_args($settings, $defaults);
		$shareholder_header_text       = isset($settings['shareholder_header_text']) ? $settings['shareholder_header_text'] : $defaults['shareholder_header_text'];
		$shareholder_name_placeholder  = isset($settings['shareholder_name_placeholder']) ? $settings['shareholder_name_placeholder'] : $defaults['shareholder_name_placeholder'];
		$shareholder_phone_placeholder = isset($settings['shareholder_phone_placeholder']) ? $settings['shareholder_phone_placeholder'] : $defaults['shareholder_phone_placeholder'];
		$shareholder_note_placeholder  = isset($settings['shareholder_note_placeholder']) ? $settings['shareholder_note_placeholder'] : $defaults['shareholder_note_placeholder'];
		$shareholder_copy_button_text  = isset($settings['shareholder_copy_button_text']) ? $settings['shareholder_copy_button_text'] : $defaults['shareholder_copy_button_text'];
		$enable_copy                   = isset($settings['shareholder_enable_copy_button']) ? (bool) $settings['shareholder_enable_copy_button'] : true;
		$shareholder_layout            = isset($settings['shareholder_layout']) ? $settings['shareholder_layout'] : 'single';
		$shareholder_density           = isset($settings['shareholder_density']) ? $settings['shareholder_density'] : 'normal';
		$enable_email                  = isset($settings['shareholder_enable_email']) ? (bool) $settings['shareholder_enable_email'] : false;
		$shareholder_email_placeholder = isset($settings['shareholder_email_placeholder']) ? $settings['shareholder_email_placeholder'] : $defaults['shareholder_email_placeholder'];
		$shareholders_area_bg = WDP_Utils::coerce_solid_hex_background(
			isset($settings['shareholders_area_bg']) ? $settings['shareholders_area_bg'] : '#fafbfc',
			'#fafbfc'
		);

		WDP_Admin_Renderer_Helpers::open_form_container('wdp-shareholder-form-settings-form');
		echo '<h2>' . __('Hisseli Form Metinleri', 'woo-donation-popup') . '</h2><table class="form-table">';
		echo '<tr><th scope="row"><label for="shareholder_header_text">' . __('Hissedar Başlık Metni', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_header_text" name="shareholder_header_text" value="' . esc_attr($shareholder_header_text) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_name_placeholder">' . __('Ad Soyad Placeholder', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_name_placeholder" name="shareholder_name_placeholder" value="' . esc_attr($shareholder_name_placeholder) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_phone_placeholder">' . __('Telefon Placeholder', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_phone_placeholder" name="shareholder_phone_placeholder" value="' . esc_attr($shareholder_phone_placeholder) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_note_placeholder">' . __('Not Placeholder', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_note_placeholder" name="shareholder_note_placeholder" value="' . esc_attr($shareholder_note_placeholder) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_copy_button_text">' . __('Kopya Oluştur Butonu Metni', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_copy_button_text" name="shareholder_copy_button_text" value="' . esc_attr($shareholder_copy_button_text) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_enable_copy_button">' . __('Kopya Butonunu Göster', 'woo-donation-popup') . '</label></th><td><label><input type="checkbox" id="shareholder_enable_copy_button" name="shareholder_enable_copy_button" value="1" ' . checked($enable_copy, true, false) . ' /> ' . __('Hissedar formunda "Kopyasını Oluştur" butonunu göster', 'woo-donation-popup') . '</label></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_layout">' . __('Alan Düzeni', 'woo-donation-popup') . '</label></th><td><select id="shareholder_layout" name="shareholder_layout"><option value="single" ' . selected($shareholder_layout, 'single', false) . '>' . __('Tek Sütun', 'woo-donation-popup') . '</option><option value="two-column" ' . selected($shareholder_layout, 'two-column', false) . '>' . __('İki Sütun', 'woo-donation-popup') . '</option></select></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_density">' . __('Kart Yoğunluğu', 'woo-donation-popup') . '</label></th><td><select id="shareholder_density" name="shareholder_density"><option value="compact" ' . selected($shareholder_density, 'compact', false) . '>' . __('Kompakt', 'woo-donation-popup') . '</option><option value="normal" ' . selected($shareholder_density, 'normal', false) . '>' . __('Normal', 'woo-donation-popup') . '</option><option value="spacious" ' . selected($shareholder_density, 'spacious', false) . '>' . __('Geniş', 'woo-donation-popup') . '</option></select></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_enable_email">' . __('E-posta Alanı', 'woo-donation-popup') . '</label></th><td><label><input type="checkbox" id="shareholder_enable_email" name="shareholder_enable_email" value="1" ' . checked($enable_email, true, false) . ' /> ' . __('E-posta alanını göster', 'woo-donation-popup') . '</label></td></tr>';
		echo '<tr><th scope="row"><label for="shareholder_email_placeholder">' . __('E-posta Placeholder', 'woo-donation-popup') . '</label></th><td><input type="text" id="shareholder_email_placeholder" name="shareholder_email_placeholder" value="' . esc_attr($shareholder_email_placeholder) . '" class="regular-text" /></td></tr>';
		echo '</table>';
		echo '<h2>' . __('Hissedarlar Alanı Ayarları', 'woo-donation-popup') . '</h2><table class="form-table">';
		echo '<tr><th scope="row"><label for="shareholders_area_bg">' . __('Alan Arka Plan Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholders_area_bg" name="shareholders_area_bg" value="' . esc_attr($shareholders_area_bg) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholders_area_border">' . __('Alan Border Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholders_area_border" name="shareholders_area_border" value="' . esc_attr($settings['shareholders_area_border']) . '" /></td></tr>';
		echo '</table>';
		WDP_Admin_Renderer_Helpers::close_form_container('wdp-save-shareholder-form-settings');
	}

	/**
	 * Render success screen customization tab.
	 *
	 * @return void
	 */
	public static function render_success_screen_tab() {
		$settings = get_option('wdp_success_settings', array());
		$defaults = array(
			'success_button_color'     => '#1e73be',
			'success_button_hover'     => '#185d98',
			'success_button_radius'    => '20',
			'success_text_view_cart'   => 'Sepeti Görüntüle',
			'success_text_go_checkout' => 'Ödemeye Git',
			'success_text_new_donation'=> 'Yeni Bağış Ekle',
			'success_message_bg'       => 'rgba(72, 187, 120, 0.1)',
			'success_message_color'    => '#48bb78',
			'success_message_border'   => 'rgba(72, 187, 120, 0.2)',
			'success_message_radius'   => '20',
			'mini_cart_bg'             => '#f9fafb',
			'mini_cart_border'         => '#e5e7eb',
			'mini_cart_radius'         => '20',
			'cart_item_name_color'     => '#1f2937',
			'cart_item_price_color'    => '#1e73be',
		);
		$settings = wp_parse_args($settings, $defaults);

		WDP_Admin_Renderer_Helpers::open_form_container('wdp-success-screen-settings-form');
		echo '<h2>' . __('Başarı Mesajı Ayarları', 'woo-donation-popup') . '</h2><table class="form-table">';
		echo '<tr><th scope="row"><label for="success_message_bg">' . __('Mesaj Arka Plan Rengi', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_message_bg" name="success_message_bg" value="' . esc_attr($settings['success_message_bg']) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_message_color">' . __('Mesaj Metin Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="success_message_color" name="success_message_color" value="' . esc_attr($settings['success_message_color']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_message_border">' . __('Mesaj Border Rengi', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_message_border" name="success_message_border" value="' . esc_attr($settings['success_message_border']) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_message_radius">' . __('Mesaj Border Radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="success_message_radius" name="success_message_radius" value="' . esc_attr($settings['success_message_radius']) . '" min="0" max="50" step="1" class="small-text" /></td></tr>';
		echo '</table>';
		echo '<h2>' . __('Başarı Ekranı Butonları', 'woo-donation-popup') . '</h2><table class="form-table">';
		echo '<tr><th scope="row"><label for="success_button_color">' . __('Buton Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="success_button_color" name="success_button_color" value="' . esc_attr($settings['success_button_color']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_button_hover">' . __('Buton Hover Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="success_button_hover" name="success_button_hover" value="' . esc_attr($settings['success_button_hover']) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_button_radius">' . __('Buton Border Radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="success_button_radius" name="success_button_radius" value="' . esc_attr($settings['success_button_radius']) . '" min="0" max="50" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_text_view_cart">' . __('Sepeti Görüntüle Butonu', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_text_view_cart" name="success_text_view_cart" value="' . esc_attr($settings['success_text_view_cart']) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_text_go_checkout">' . __('Ödemeye Git Butonu', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_text_go_checkout" name="success_text_go_checkout" value="' . esc_attr($settings['success_text_go_checkout']) . '" class="regular-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="success_text_new_donation">' . __('Yeni Bağış Ekle Butonu', 'woo-donation-popup') . '</label></th><td><input type="text" id="success_text_new_donation" name="success_text_new_donation" value="' . esc_attr($settings['success_text_new_donation']) . '" class="regular-text" /></td></tr>';
		echo '</table>';
		WDP_Admin_Renderer_Helpers::close_form_container('wdp-save-success-screen-settings');
	}

	/**
	 * Normal tab helper header.
	 *
	 * @return void
	 */
	private static function render_normal_tab_header() {
		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('Bu sekmede ne yaparsınız?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list"><li>' . esc_html__('Aşağıdaki sıra, popup’ta kullanıcının gördüğü akışa göredir: önce üst başlık ve kapat, sonra kutu ve alanlar, en sonda form butonları ve sayfadaki açan buton.', 'woo-donation-popup') . '</li><li>' . esc_html__('Pencere genişliği ve padding “Modal & Form Görünümü” sekmesindedir; bu sekme modalın iç rengi, yazılar ve butonları kapsar.', 'woo-donation-popup') . '</li><li>' . esc_html__('Ürün kartında “Çoklu Hisse” veya “Progress Bar” açıksa bir kısım ayar hisse/progress sekmelerindedir.', 'woo-donation-popup') . '</li></ul></div>';
		echo '<nav class="wdp-settings-toc" aria-label="' . esc_attr__('Normal form bölümleri', 'woo-donation-popup') . '"><span class="wdp-settings-toc__label">' . esc_html__('Bu sayfada:', 'woo-donation-popup') . '</span><a href="#wdp-normal-sec-chrome">' . esc_html__('Başlık ve kapat', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-modal-inner">' . esc_html__('Modal içi kutu', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-fields">' . esc_html__('Alanlar ve etiketler', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-form-buttons">' . esc_html__('Form altı butonları', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-trigger">' . esc_html__('Sayfadaki açan buton', 'woo-donation-popup') . '</a></nav>';
	}

	private static function render_normal_chrome_section(array $settings) {
		$title_color = isset($settings['title_color']) ? $settings['title_color'] : '#1f2937';
		$title_size = isset($settings['title_font_size']) ? $settings['title_font_size'] : '27';
		$title_size_mobile = isset($settings['title_font_size_mobile']) ? $settings['title_font_size_mobile'] : $title_size;
		$close_color = isset($settings['close_button_color']) ? $settings['close_button_color'] : '#6b7280';
		echo '<div id="wdp-normal-sec-chrome" class="wdp-settings-section"><h2>' . __('Başlık Ayarları', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="title_color">' . __('Başlık Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="title_color" name="title_color" value="' . esc_attr($title_color) . '" /></td></tr><tr><th scope="row"><label for="title_font_size">' . __('Başlık Font Boyutu (Masaüstü, px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="title_font_size" name="title_font_size" value="' . esc_attr($title_size) . '" min="14" max="48" step="1" class="small-text" /></td></tr><tr><th scope="row"><label for="title_font_size_mobile">' . __('Başlık Font Boyutu (Mobil, px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="title_font_size_mobile" name="title_font_size_mobile" value="' . esc_attr($title_size_mobile) . '" min="12" max="40" step="1" class="small-text" /></td></tr></table><h2>' . __('Kapat Butonu Ayarları', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="close_button_color">' . __('Kapat Butonu Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="close_button_color" name="close_button_color" value="' . esc_attr($close_color) . '" /></td></tr></table></div>';
	}

	private static function render_normal_modal_inner_section(array $settings) {
		$modal_bg = isset($settings['modal_background_color']) ? $settings['modal_background_color'] : '#ffffff';
		$modal_radius = isset($settings['modal_border_radius']) ? $settings['modal_border_radius'] : '20';
		echo '<div id="wdp-normal-sec-modal-inner" class="wdp-settings-section"><h2>' . __('Modal içi kutu (arka plan ve köşeler)', 'woo-donation-popup') . '</h2><p class="wdp-settings-section__hint">' . esc_html__('Pencere genişliği ve iç padding “Modal & Form Görünümü” sekmesindedir; burası yalnızca içerik kutusunun rengi ve köşe yuvarlaklığıdır.', 'woo-donation-popup') . '</p><table class="form-table"><tr><th scope="row"><label for="modal_background_color">' . __('Modal Arka Plan Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="modal_background_color" name="modal_background_color" value="' . esc_attr($modal_bg) . '" /></td></tr><tr><th scope="row"><label for="modal_border_radius">' . __('Modal Border Radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="modal_border_radius" name="modal_border_radius" value="' . esc_attr($modal_radius) . '" min="0" max="50" step="1" class="small-text" /></td></tr></table></div>';
	}

	private static function render_normal_fields_section(array $settings) {
		$input_border = isset($settings['input_border_color']) ? $settings['input_border_color'] : '#d1d5db';
		$input_radius = isset($settings['input_border_radius']) ? $settings['input_border_radius'] : '20';
		$label_color = isset($settings['label_color']) ? $settings['label_color'] : '#374151';
		$label_font_size = isset($settings['label_font_size']) ? $settings['label_font_size'] : 14;
		$label_font_weight = isset($settings['label_font_weight']) ? $settings['label_font_weight'] : '600';
		$placeholder_color = isset($settings['placeholder_color']) ? $settings['placeholder_color'] : '#6b7280';
		$form_gap = isset($settings['form_gap']) ? $settings['form_gap'] : 16;
		echo '<div id="wdp-normal-sec-fields" class="wdp-settings-section"><h2>' . __('Input Alanları Ayarları', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="input_border_color">' . __('Input Border Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="input_border_color" name="input_border_color" value="' . esc_attr($input_border) . '" /></td></tr><tr><th scope="row"><label for="input_border_radius">' . __('Input Border Radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="input_border_radius" name="input_border_radius" value="' . esc_attr($input_radius) . '" min="0" max="50" step="1" class="small-text" /></td></tr><tr><th scope="row"><label for="label_color">' . __('Label Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="label_color" name="label_color" value="' . esc_attr($label_color) . '" /></td></tr><tr><th scope="row"><label for="label_font_size">' . __('Label Font Boyutu (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="label_font_size" name="label_font_size" value="' . esc_attr($label_font_size) . '" min="10" max="24" step="1" class="small-text" /></td></tr><tr><th scope="row"><label for="label_font_weight">' . __('Label Font Kalınlığı', 'woo-donation-popup') . '</label></th><td><select id="label_font_weight" name="label_font_weight"><option value="400" ' . selected($label_font_weight, '400', false) . '>Normal (400)</option><option value="500" ' . selected($label_font_weight, '500', false) . '>Orta (500)</option><option value="600" ' . selected($label_font_weight, '600', false) . '>Yarı Kalın (600)</option><option value="700" ' . selected($label_font_weight, '700', false) . '>Kalın (700)</option></select></td></tr><tr><th scope="row"><label for="placeholder_color">' . __('Placeholder Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="placeholder_color" name="placeholder_color" value="' . esc_attr($placeholder_color) . '" /></td></tr><tr><th scope="row"><label for="form_gap">' . __('Form Elemanları Arası Boşluk (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="form_gap" name="form_gap" value="' . esc_attr($form_gap) . '" min="4" max="40" step="1" class="small-text" /></td></tr></table></div>';
	}

	private static function render_normal_form_buttons_section(array $settings) {
		$checkout_color = isset($settings['button_checkout_color']) ? $settings['button_checkout_color'] : '#48bb78';
		$checkout_hover = isset($settings['button_checkout_hover']) ? $settings['button_checkout_hover'] : '#38a169';

		echo '<div id="wdp-normal-sec-form-buttons" class="wdp-settings-section"><h2>' . __('Buton Renkleri', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="button_primary_color">' . __('Birincil Buton Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_primary_color" name="button_primary_color" value="' . esc_attr($settings['button_primary_color']) . '" /></td></tr><tr><th scope="row"><label for="button_primary_hover">' . __('Buton Hover Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_primary_hover" name="button_primary_hover" value="' . esc_attr($settings['button_primary_hover']) . '" /></td></tr><tr><th scope="row"><label for="button_checkout_color">' . __('Ödeme Yap Butonu Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_checkout_color" name="button_checkout_color" value="' . esc_attr($checkout_color) . '" /></td></tr><tr><th scope="row"><label for="button_checkout_hover">' . __('Ödeme Yap Butonu Hover Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_checkout_hover" name="button_checkout_hover" value="' . esc_attr($checkout_hover) . '" /></td></tr></table>';

		echo '<h2>' . __('Buton Border Radius', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="button_border_radius">' . __('Border Radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="button_border_radius" name="button_border_radius" value="' . esc_attr($settings['button_border_radius']) . '" min="0" max="50" step="1" class="small-text" /></td></tr></table>';

		echo '<h2>' . __('Buton gölgesi (yalnızca eklenti butonları)', 'woo-donation-popup') . '</h2>';
		echo '<p class="description" style="margin-top:0;">' . esc_html__('İki grup: (1) sayfadaki shortcode/tetikleyici düğmeler — CSS `--wdp-plugin-btn-shadow-sc`; (2) popup ve sayfa içi form içindeki Tüm diğer eklenti butonları — `--wdp-plugin-btn-shadow-modal`. Kapama (X) ve tutar çipleri hariç.', 'woo-donation-popup') . '</p>';

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
		$popup_button_color = isset($settings['popup_button_color']) ? $settings['popup_button_color'] : '#1e73be';
		$popup_button_hover = isset($settings['popup_button_hover']) ? $settings['popup_button_hover'] : '#185d98';
		$popup_button_text_color = isset($settings['popup_button_text_color']) ? $settings['popup_button_text_color'] : '#ffffff';
		$shortcode_button_size = isset($settings['shortcode_button_size']) ? strtolower((string) $settings['shortcode_button_size']) : 'medium';
		if (!in_array($shortcode_button_size, array('small', 'medium', 'large', 'xlarge'), true)) {
			$shortcode_button_size = 'medium';
		}
		echo '<div id="wdp-normal-sec-trigger" class="wdp-settings-section"><h2>' . __('Sayfadaki açan buton (shortcode)', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="popup_button_text">' . __('Buton Metni', 'woo-donation-popup') . '</label></th><td><input type="text" id="popup_button_text" name="popup_button_text" value="' . esc_attr($popup_button_text) . '" class="regular-text" /></td></tr><tr><th scope="row"><label for="popup_button_color">' . __('Buton Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="popup_button_color" name="popup_button_color" value="' . esc_attr($popup_button_color) . '" /></td></tr><tr><th scope="row"><label for="popup_button_hover">' . __('Buton Hover Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="popup_button_hover" name="popup_button_hover" value="' . esc_attr($popup_button_hover) . '" /></td></tr><tr><th scope="row"><label for="popup_button_text_color">' . __('Buton metin rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="popup_button_text_color" name="popup_button_text_color" value="' . esc_attr($popup_button_text_color) . '" /><p class="description">' . esc_html__('Yalnızca shortcode tetikleyicide; açık arka planda okunabilirlik için kullanın.', 'woo-donation-popup') . '</p></td></tr><tr><th scope="row"><label for="shortcode_button_size">' . __('Shortcode buton boyutu', 'woo-donation-popup') . '</label></th><td><select id="shortcode_button_size" name="shortcode_button_size"><option value="small" ' . selected($shortcode_button_size, 'small', false) . '>' . esc_html__('Küçük', 'woo-donation-popup') . '</option><option value="medium" ' . selected($shortcode_button_size, 'medium', false) . '>' . esc_html__('Orta', 'woo-donation-popup') . '</option><option value="large" ' . selected($shortcode_button_size, 'large', false) . '>' . esc_html__('Büyük', 'woo-donation-popup') . '</option><option value="xlarge" ' . selected($shortcode_button_size, 'xlarge', false) . '>' . esc_html__('Çok büyük', 'woo-donation-popup') . '</option></select><p class="description">' . esc_html__('Yalnızca shortcode ile eklenen tetikleyici butonu etkiler; popup veya form içi butonları etkilemez.', 'woo-donation-popup') . '</p></td></tr></table></div>';
	}
}

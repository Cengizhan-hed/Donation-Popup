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
		$button_settings = WDP_Utils::normalize_legacy_popup_button_text(
			get_option('wdp_button_settings', array())
		);

		$defaults = array(
			'button_primary_color'              => '#1e73be',
			'button_primary_hover'              => '#185d98',
			'button_border_radius'              => '10',
			'button_text_add_to_cart'           => 'Sepete Ekle',
			'button_text_go_checkout'           => 'Ödemeye Git',
			'button_text_donate'                => 'Bağış Yap',
			'popup_button_text'                 => 'Bağış Yap',
			'popup_button_color'                => '#1e73be',
			'popup_button_hover'                => '#185d98',
			'popup_button_font_size'            => '18',
			'popup_button_font_weight'          => '700',
			'popup_button_font_family'          => 'inherit',
			'popup_button_custom_font'          => '',
			'popup_button_size'                 => 'large',
			'popup_button_custom_min_width'     => '140',
			'popup_button_custom_min_height'    => '48',
			'popup_button_custom_padding_x'     => '24',
			'popup_button_border_radius'        => '10',
			'popup_button_border_size'          => '0',
			'popup_button_full_width'           => '0',
			'popup_button_use_gradient'         => '1',
			'popup_button_gradient_start'       => '#ff8244',
			'popup_button_gradient_end'         => '#ff9860',
			'popup_button_gradient_hover_start' => '#ff8244',
			'popup_button_gradient_hover_end'   => '#ff9860',
			'popup_button_gradient_start_stop'  => '0',
			'popup_button_gradient_end_stop'    => '100',
			'popup_button_gradient_type'        => 'linear',
			'popup_button_gradient_angle'       => '150',
		);

		$settings = wp_parse_args($button_settings, $defaults);

		WDP_Admin_Renderer_Helpers::open_form_container('wdp-normal-form-settings-form');
		self::render_normal_tab_header();
		self::render_normal_chrome_section($settings);
		self::render_normal_modal_inner_section($settings);
		self::render_normal_fields_section($settings);
		self::render_normal_errors_section($settings);
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
			'shareholder_card_radius'        => '10',
			'shareholder_card_shadow'        => '0 1px 3px rgba(0, 0, 0, 0.05)',
			'shareholder_header_bg'          => '#f9fafb',
			'shareholder_header_color'       => '#1f2937',
			'shareholder_content_padding'    => '12',
			'shareholders_area_bg'           => 'linear-gradient(to bottom, #ffffff 0%, #fafbfc 100%)',
			'shareholders_area_border'       => '#e1e5e9',
			'shareholders_area_radius'       => '10',
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
		$use_gradient                  = (strpos($settings['shareholders_area_bg'], 'gradient') !== false);
		$color1                        = '#ffffff';
		$color2                        = '#fafbfc';

		if (preg_match('/#([a-fA-F0-9]{6})/', $settings['shareholders_area_bg'], $matches)) {
			$color1 = '#' . $matches[1];
		}
		if (preg_match_all('/#([a-fA-F0-9]{6})/', $settings['shareholders_area_bg'], $matches) && isset($matches[1][1])) {
			$color2 = '#' . $matches[1][1];
		}

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
		echo '<tr><th scope="row"><label for="shareholders_area_use_gradient">' . __('Gradient Kullan', 'woo-donation-popup') . '</label></th><td><label><input type="checkbox" id="shareholders_area_use_gradient" name="shareholders_area_use_gradient" value="1" ' . checked($use_gradient, true, false) . ' /> ' . __('Gradient kullan', 'woo-donation-popup') . '</label></td></tr>';
		echo '<tr><th scope="row"><label for="shareholders_area_color1">' . __('Üst Renk', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholders_area_color1" name="shareholders_area_color1" value="' . esc_attr($color1) . '" /></td></tr>';
		echo '<tr><th scope="row"><label for="shareholders_area_color2">' . __('Alt Renk', 'woo-donation-popup') . '</label></th><td><input type="color" id="shareholders_area_color2" name="shareholders_area_color2" value="' . esc_attr($color2) . '" /></td></tr>';
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
			'success_button_radius'    => '10',
			'success_text_view_cart'   => 'Sepeti Görüntüle',
			'success_text_go_checkout' => 'Ödemeye Git',
			'success_text_new_donation'=> 'Yeni Bağış Ekle',
			'success_message_bg'       => 'rgba(72, 187, 120, 0.1)',
			'success_message_color'    => '#48bb78',
			'success_message_border'   => 'rgba(72, 187, 120, 0.2)',
			'success_message_radius'   => '10',
			'mini_cart_bg'             => '#f9fafb',
			'mini_cart_border'         => '#e5e7eb',
			'mini_cart_radius'         => '10',
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
		echo '<nav class="wdp-settings-toc" aria-label="' . esc_attr__('Normal form bölümleri', 'woo-donation-popup') . '"><span class="wdp-settings-toc__label">' . esc_html__('Bu sayfada:', 'woo-donation-popup') . '</span><a href="#wdp-normal-sec-chrome">' . esc_html__('Başlık ve kapat', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-modal-inner">' . esc_html__('Modal içi kutu', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-fields">' . esc_html__('Alanlar ve etiketler', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-errors">' . esc_html__('Hata renkleri', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-form-buttons">' . esc_html__('Form altı butonları', 'woo-donation-popup') . '</a><a href="#wdp-normal-sec-trigger">' . esc_html__('Sayfadaki açan buton', 'woo-donation-popup') . '</a></nav>';
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
		$modal_radius = isset($settings['modal_border_radius']) ? $settings['modal_border_radius'] : '10';
		echo '<div id="wdp-normal-sec-modal-inner" class="wdp-settings-section"><h2>' . __('Modal içi kutu (arka plan ve köşeler)', 'woo-donation-popup') . '</h2><p class="wdp-settings-section__hint">' . esc_html__('Pencere genişliği ve iç padding “Modal & Form Görünümü” sekmesindedir; burası yalnızca içerik kutusunun rengi ve köşe yuvarlaklığıdır.', 'woo-donation-popup') . '</p><table class="form-table"><tr><th scope="row"><label for="modal_background_color">' . __('Modal Arka Plan Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="modal_background_color" name="modal_background_color" value="' . esc_attr($modal_bg) . '" /></td></tr><tr><th scope="row"><label for="modal_border_radius">' . __('Modal Border Radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="modal_border_radius" name="modal_border_radius" value="' . esc_attr($modal_radius) . '" min="0" max="50" step="1" class="small-text" /></td></tr></table></div>';
	}

	private static function render_normal_fields_section(array $settings) {
		$input_border = isset($settings['input_border_color']) ? $settings['input_border_color'] : '#d1d5db';
		$input_radius = isset($settings['input_border_radius']) ? $settings['input_border_radius'] : '10';
		$label_color = isset($settings['label_color']) ? $settings['label_color'] : '#374151';
		$label_font_size = isset($settings['label_font_size']) ? $settings['label_font_size'] : 14;
		$label_font_weight = isset($settings['label_font_weight']) ? $settings['label_font_weight'] : '600';
		$placeholder_color = isset($settings['placeholder_color']) ? $settings['placeholder_color'] : '#6b7280';
		$form_gap = isset($settings['form_gap']) ? $settings['form_gap'] : 16;
		echo '<div id="wdp-normal-sec-fields" class="wdp-settings-section"><h2>' . __('Input Alanları Ayarları', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="input_border_color">' . __('Input Border Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="input_border_color" name="input_border_color" value="' . esc_attr($input_border) . '" /></td></tr><tr><th scope="row"><label for="input_border_radius">' . __('Input Border Radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="input_border_radius" name="input_border_radius" value="' . esc_attr($input_radius) . '" min="0" max="50" step="1" class="small-text" /></td></tr><tr><th scope="row"><label for="label_color">' . __('Label Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="label_color" name="label_color" value="' . esc_attr($label_color) . '" /></td></tr><tr><th scope="row"><label for="label_font_size">' . __('Label Font Boyutu (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="label_font_size" name="label_font_size" value="' . esc_attr($label_font_size) . '" min="10" max="24" step="1" class="small-text" /></td></tr><tr><th scope="row"><label for="label_font_weight">' . __('Label Font Kalınlığı', 'woo-donation-popup') . '</label></th><td><select id="label_font_weight" name="label_font_weight"><option value="400" ' . selected($label_font_weight, '400', false) . '>Normal (400)</option><option value="500" ' . selected($label_font_weight, '500', false) . '>Orta (500)</option><option value="600" ' . selected($label_font_weight, '600', false) . '>Yarı Kalın (600)</option><option value="700" ' . selected($label_font_weight, '700', false) . '>Kalın (700)</option></select></td></tr><tr><th scope="row"><label for="placeholder_color">' . __('Placeholder Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="placeholder_color" name="placeholder_color" value="' . esc_attr($placeholder_color) . '" /></td></tr><tr><th scope="row"><label for="form_gap">' . __('Form Elemanları Arası Boşluk (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="form_gap" name="form_gap" value="' . esc_attr($form_gap) . '" min="4" max="40" step="1" class="small-text" /></td></tr></table></div>';
	}

	private static function render_normal_errors_section(array $settings) {
		$error_bg = isset($settings['error_bg_color']) ? $settings['error_bg_color'] : '#fed7d7';
		$error_border = isset($settings['error_border_color']) ? $settings['error_border_color'] : '#feb2b2';
		$error_text = isset($settings['error_text_color']) ? $settings['error_text_color'] : '#c53030';
		$input_error_bg = isset($settings['input_error_bg_color']) ? $settings['input_error_bg_color'] : '#fed7d7';
		$input_error_border = isset($settings['input_error_border_color']) ? $settings['input_error_border_color'] : '#feb2b2';
		$input_error_text = isset($settings['input_error_text_color']) ? $settings['input_error_text_color'] : '#c53030';
		echo '<div id="wdp-normal-sec-errors" class="wdp-settings-section"><h2>' . __('Hata / Uyarı Mesajı Renkleri', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="error_bg_color">' . __('Form Hata Arka Plan Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="error_bg_color" name="error_bg_color" value="' . esc_attr($error_bg) . '" /></td></tr><tr><th scope="row"><label for="error_border_color">' . __('Form Hata Border Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="error_border_color" name="error_border_color" value="' . esc_attr($error_border) . '" /></td></tr><tr><th scope="row"><label for="error_text_color">' . __('Form Hata Metin Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="error_text_color" name="error_text_color" value="' . esc_attr($error_text) . '" /></td></tr><tr><th scope="row"><label for="input_error_bg_color">' . __('Input Hata Balonu Arka Plan Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="input_error_bg_color" name="input_error_bg_color" value="' . esc_attr($input_error_bg) . '" /></td></tr><tr><th scope="row"><label for="input_error_border_color">' . __('Input Hata Balonu Border Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="input_error_border_color" name="input_error_border_color" value="' . esc_attr($input_error_border) . '" /></td></tr><tr><th scope="row"><label for="input_error_text_color">' . __('Input Hata Balonu Metin Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="input_error_text_color" name="input_error_text_color" value="' . esc_attr($input_error_text) . '" /></td></tr></table></div>';
	}

	private static function render_normal_form_buttons_section(array $settings) {
		$checkout_color = isset($settings['button_checkout_color']) ? $settings['button_checkout_color'] : '#48bb78';
		$checkout_hover = isset($settings['button_checkout_hover']) ? $settings['button_checkout_hover'] : '#38a169';
		echo '<div id="wdp-normal-sec-form-buttons" class="wdp-settings-section"><h2>' . __('Buton Renkleri', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="button_primary_color">' . __('Birincil Buton Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_primary_color" name="button_primary_color" value="' . esc_attr($settings['button_primary_color']) . '" /></td></tr><tr><th scope="row"><label for="button_primary_hover">' . __('Buton Hover Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_primary_hover" name="button_primary_hover" value="' . esc_attr($settings['button_primary_hover']) . '" /></td></tr><tr><th scope="row"><label for="button_checkout_color">' . __('Ödeme Yap Butonu Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_checkout_color" name="button_checkout_color" value="' . esc_attr($checkout_color) . '" /></td></tr><tr><th scope="row"><label for="button_checkout_hover">' . __('Ödeme Yap Butonu Hover Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="button_checkout_hover" name="button_checkout_hover" value="' . esc_attr($checkout_hover) . '" /></td></tr></table><h2>' . __('Buton Border Radius', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="button_border_radius">' . __('Border Radius (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="button_border_radius" name="button_border_radius" value="' . esc_attr($settings['button_border_radius']) . '" min="0" max="50" step="1" class="small-text" /></td></tr></table><h2>' . __('Buton Metinleri', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="button_text_add_to_cart">' . __('Sepete Ekle Butonu', 'woo-donation-popup') . '</label></th><td><input type="text" id="button_text_add_to_cart" name="button_text_add_to_cart" value="' . esc_attr($settings['button_text_add_to_cart']) . '" class="regular-text" /></td></tr><tr><th scope="row"><label for="button_text_go_checkout">' . __('Ödemeye Git Butonu', 'woo-donation-popup') . '</label></th><td><input type="text" id="button_text_go_checkout" name="button_text_go_checkout" value="' . esc_attr($settings['button_text_go_checkout']) . '" class="regular-text" /></td></tr></table></div>';
	}

	private static function render_normal_trigger_section(array $settings) {
		$popup_button_text = isset($settings['popup_button_text']) ? $settings['popup_button_text'] : 'Bağış Yap';
		$popup_button_color = isset($settings['popup_button_color']) ? $settings['popup_button_color'] : '#1e73be';
		$popup_button_hover = isset($settings['popup_button_hover']) ? $settings['popup_button_hover'] : '#185d98';
		$popup_button_use_gradient = isset($settings['popup_button_use_gradient']) ? $settings['popup_button_use_gradient'] : '1';
		echo '<div id="wdp-normal-sec-trigger" class="wdp-settings-section"><h2>' . __('Sayfadaki açan buton (shortcode)', 'woo-donation-popup') . '</h2><table class="form-table"><tr><th scope="row"><label for="popup_button_text">' . __('Buton Metni', 'woo-donation-popup') . '</label></th><td><input type="text" id="popup_button_text" name="popup_button_text" value="' . esc_attr($popup_button_text) . '" class="regular-text" /></td></tr><tr><th scope="row"><label for="popup_button_color">' . __('Buton Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="popup_button_color" name="popup_button_color" value="' . esc_attr($popup_button_color) . '" /></td></tr><tr><th scope="row"><label for="popup_button_hover">' . __('Buton Hover Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="popup_button_hover" name="popup_button_hover" value="' . esc_attr($popup_button_hover) . '" /></td></tr><tr><th scope="row"><label for="popup_button_use_gradient">' . __('Gradient Kullan', 'woo-donation-popup') . '</label></th><td><label class="wdp-switch"><input type="checkbox" id="popup_button_use_gradient" name="popup_button_use_gradient" value="1" ' . checked($popup_button_use_gradient, '1', false) . ' /><span class="wdp-slider"></span></label></td></tr></table></div>';
	}
}

<?php
/**
 * Formlar ve metinler sekmesi — görsel olmayan ayarlar + buton/alan metinleri.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Admin_Forms_Texts_Tab_Renderer
 */
class WDP_Admin_Forms_Texts_Tab_Renderer {

	/**
	 * @return void
	 */
	public static function render_tab() {
		$button = get_option('wdp_button_settings', array());
		$button = is_array($button) ? $button : array();
		$button = WDP_Utils::normalize_legacy_popup_button_text($button);

		$share = get_option('wdp_shareholder_settings', array());
		$share = is_array($share) ? $share : array();

		$success = get_option('wdp_success_settings', array());
		$success = is_array($success) ? $success : array();

		$progress = get_option('wdp_progress_bar_settings', array());
		$progress = is_array($progress) ? $progress : array();

		echo '<div class="wdp-settings-container wdp-forms-texts-tab">';
		echo '<div class="wdp-forms-texts-layout" style="display:flex;gap:24px;align-items:flex-start">';
		echo '<nav class="wdp-forms-texts-nav" style="position:sticky;top:48px;min-width:180px" aria-label="' . esc_attr__('Alt bölümler', 'woo-donation-popup') . '">';
		$sections = array(
			'general'     => __('Genel metinler', 'woo-donation-popup'),
			'donor'       => __('Bağışçı alanları', 'woo-donation-popup'),
			'shares'      => __('Hisseli', 'woo-donation-popup'),
			'campaign'    => __('Hedefli kampanya', 'woo-donation-popup'),
			'sadaka'      => __('Sadaka', 'woo-donation-popup'),
			'trust'       => __('Güven rozetleri', 'woo-donation-popup'),
			'success'     => __('Başarı ekranı', 'woo-donation-popup'),
		);
		echo '<ul style="list-style:none;margin:0;padding:0">';
		foreach ($sections as $id => $label) {
			echo '<li style="margin:0 0 8px"><a href="#wdp-ft-' . esc_attr($id) . '">' . esc_html($label) . '</a></li>';
		}
		echo '</ul></nav>';

		echo '<div class="wdp-forms-texts-body" style="flex:1;min-width:0">';
		echo '<form id="wdp-forms-texts-settings-form" class="wdp-admin-settings-form" method="post" data-wdp-ajax-action="wdp_save_forms_texts_settings">';

		echo '<div id="wdp-ft-general" class="wdp-settings-section"><h2 class="wdp-section-title">' . esc_html__('Genel metinler', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		self::text_row('popup_button_text', isset($button['popup_button_text']) ? $button['popup_button_text'] : __('Bağış Yap', 'woo-donation-popup'), __('Bağış Yap butonu', 'woo-donation-popup'));
		self::text_row('button_text_add_to_cart', isset($button['button_text_add_to_cart']) ? $button['button_text_add_to_cart'] : __('Sepete Ekle', 'woo-donation-popup'), __('Sepete Ekle', 'woo-donation-popup'));
		self::text_row('button_text_go_checkout', isset($button['button_text_go_checkout']) ? $button['button_text_go_checkout'] : __('Ödemeye Git', 'woo-donation-popup'), __('Ödemeye Git', 'woo-donation-popup'));
		echo '<tr><th scope="row">' . esc_html__('Adım adım form', 'woo-donation-popup') . '</th><td><label><input type="checkbox" name="enable_multi_step" value="1"' . checked(!empty($button['enable_multi_step']) && (string) $button['enable_multi_step'] === '1', true, false) . '> ' . esc_html__('Sihirbaz modunu aç', 'woo-donation-popup') . '</label></td></tr>';
		echo '<tr><th scope="row">' . esc_html__('Hızlı tutarlar', 'woo-donation-popup') . '</th><td><label><input type="checkbox" name="enable_amount_presets" value="1"' . checked(!empty($button['enable_amount_presets']) && (string) $button['enable_amount_presets'] === '1', true, false) . '> ' . esc_html__('Çipleri göster', 'woo-donation-popup') . '</label>';
		echo '<p><input type="text" class="regular-text" name="amount_presets" value="' . esc_attr(isset($button['amount_presets']) ? (string) $button['amount_presets'] : '100, 250, 500, 1000') . '" />';
		echo '<span class="description">' . esc_html__('Virgülle ayrılmış tutarlar', 'woo-donation-popup') . '</span></p></td></tr>';
		echo '</tbody></table></div>';

		echo '<div id="wdp-ft-donor" class="wdp-settings-section"><h2 class="wdp-section-title">' . esc_html__('Bağışçı alanları', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		self::check_row('enable_donor_email', $button, __('E-posta alanı', 'woo-donation-popup'));
		self::check_row('enable_dedication', $button, __('İthaf alanı', 'woo-donation-popup'));
		self::check_row('enable_anonymous', $button, __('Anonim bağış', 'woo-donation-popup'));
		self::text_row('dedication_placeholder', isset($button['dedication_placeholder']) ? $button['dedication_placeholder'] : '', __('İthaf yer tutucu', 'woo-donation-popup'));
		echo '</tbody></table></div>';

		echo '<div id="wdp-ft-shares" class="wdp-settings-section"><h2 class="wdp-section-title">' . esc_html__('Hisseli', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		self::text_row('shareholder_header_text', isset($share['shareholder_header_text']) ? $share['shareholder_header_text'] : '', __('Başlık', 'woo-donation-popup'));
		self::text_row('shareholder_name_placeholder', isset($share['shareholder_name_placeholder']) ? $share['shareholder_name_placeholder'] : '', __('Ad soyad yer tutucu', 'woo-donation-popup'));
		self::text_row('shareholder_phone_placeholder', isset($share['shareholder_phone_placeholder']) ? $share['shareholder_phone_placeholder'] : '', __('Telefon yer tutucu', 'woo-donation-popup'));
		self::text_row('shareholder_note_placeholder', isset($share['shareholder_note_placeholder']) ? $share['shareholder_note_placeholder'] : '', __('Not yer tutucu', 'woo-donation-popup'));
		self::text_row('shareholder_copy_button_text', isset($share['shareholder_copy_button_text']) ? $share['shareholder_copy_button_text'] : '', __('Kopyala butonu', 'woo-donation-popup'));
		echo '<tr><th scope="row">' . esc_html__('Kopyala butonu', 'woo-donation-popup') . '</th><td><label><input type="checkbox" name="shareholder_enable_copy_button" value="1"' . checked(!empty($share['shareholder_enable_copy_button']) && (string) $share['shareholder_enable_copy_button'] !== '0', true, false) . '> ' . esc_html__('Etkin', 'woo-donation-popup') . '</label></td></tr>';
		echo '<tr><th scope="row">' . esc_html__('Hisse e-postası', 'woo-donation-popup') . '</th><td><label><input type="checkbox" name="shareholder_enable_email" value="1"' . checked(!empty($share['shareholder_enable_email']) && (string) $share['shareholder_enable_email'] === '1', true, false) . '> ' . esc_html__('Etkin', 'woo-donation-popup') . '</label></td></tr>';
		echo '</tbody></table></div>';

		echo '<div id="wdp-ft-campaign" class="wdp-settings-section"><h2 class="wdp-section-title">' . esc_html__('Hedefli kampanya', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		echo '<tr><th scope="row">' . esc_html__('Hedef kutlama animasyonu', 'woo-donation-popup') . '</th><td><label><input type="checkbox" name="enable_celebrate" value="1"' . checked(!isset($progress['enable_celebrate']) || (string) $progress['enable_celebrate'] === '1', true, false) . '> ' . esc_html__('Etkin', 'woo-donation-popup') . '</label></td></tr>';
		echo '</tbody></table></div>';

		echo '<div id="wdp-ft-sadaka" class="wdp-settings-section"><h2 class="wdp-section-title">' . esc_html__('Sadaka', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		self::text_row('sadaka_toggle_label', isset($success['sadaka_toggle_label']) ? $success['sadaka_toggle_label'] : __('Alt Bağış Ekle', 'woo-donation-popup'), __('Anahtar etiketi', 'woo-donation-popup'));
		echo '<tr><th scope="row"><label for="sadaka_wc_product_id">' . esc_html__('Sadaka ürün ID', 'woo-donation-popup') . '</label></th><td>';
		echo '<input type="number" min="0" id="sadaka_wc_product_id" name="sadaka_wc_product_id" value="' . esc_attr(isset($success['sadaka_wc_product_id']) ? (string) $success['sadaka_wc_product_id'] : '0') . '" />';
		echo '</td></tr></tbody></table></div>';

		echo '<div id="wdp-ft-trust" class="wdp-settings-section"><h2 class="wdp-section-title">' . esc_html__('Güven rozetleri', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		echo '<tr><th scope="row">' . esc_html__('Güven şeridi', 'woo-donation-popup') . '</th><td><label><input type="checkbox" name="trust_strip_enabled" value="1"' . checked(!isset($button['trust_strip_enabled']) || (string) $button['trust_strip_enabled'] === '1', true, false) . '> ' . esc_html__('Göster', 'woo-donation-popup') . '</label></td></tr>';
		self::text_row('trust_strip_text', isset($button['trust_strip_text']) ? $button['trust_strip_text'] : '', __('Varsayılan rozet metni', 'woo-donation-popup'));
		echo '</tbody></table></div>';

		echo '<div id="wdp-ft-success" class="wdp-settings-section"><h2 class="wdp-section-title">' . esc_html__('Başarı ekranı', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		self::text_row('success_text_view_cart', isset($success['success_text_view_cart']) ? $success['success_text_view_cart'] : '', __('Sepete Git', 'woo-donation-popup'));
		self::text_row('success_text_go_checkout', isset($success['success_text_go_checkout']) ? $success['success_text_go_checkout'] : '', __('Bağışı Tamamla', 'woo-donation-popup'));
		self::text_row('success_text_new_donation', isset($success['success_text_new_donation']) ? $success['success_text_new_donation'] : '', __('Yeni bağış', 'woo-donation-popup'));
		echo '</tbody></table></div>';

		echo '<p class="submit wdp-sticky-save">';
		echo '<span class="wdp-unsaved-hint" hidden>' . esc_html__('Kaydedilmemiş değişiklikler', 'woo-donation-popup') . '</span> ';
		submit_button(__('Kaydet', 'woo-donation-popup'), 'primary', 'submit', false, array('id' => 'wdp-save-forms-texts-settings'));
		echo '<span class="spinner"></span></p>';
		echo '</form></div></div></div>';
	}

	/**
	 * @param string $name  Field.
	 * @param string $value Value.
	 * @param string $label Label.
	 * @return void
	 */
	private static function text_row($name, $value, $label) {
		echo '<tr><th scope="row"><label for="' . esc_attr($name) . '">' . esc_html($label) . '</label></th><td>';
		echo '<input type="text" class="regular-text" id="' . esc_attr($name) . '" name="' . esc_attr($name) . '" value="' . esc_attr((string) $value) . '" />';
		echo '</td></tr>';
	}

	/**
	 * @param string $name   Field.
	 * @param array  $button Settings bag.
	 * @param string $label  Label.
	 * @return void
	 */
	private static function check_row($name, array $button, $label) {
		$on = !empty($button[ $name ]) && (string) $button[ $name ] === '1';
		echo '<tr><th scope="row">' . esc_html($label) . '</th><td><label><input type="checkbox" name="' . esc_attr($name) . '" value="1"' . checked($on, true, false) . '> ' . esc_html__('Etkin', 'woo-donation-popup') . '</label></td></tr>';
	}
}

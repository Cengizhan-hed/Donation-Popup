<?php
/**
 * Admin layout-focused tab renderers.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Renders modal layout and progress bar tabs.
 */
class WDP_Admin_Layout_Tabs_Renderer {
	/**
	 * Render progress bar customization tab.
	 *
	 * @return void
	 */
	public static function render_progress_bar_tab() {
		$settings = get_option('wdp_progress_bar_settings', array());

		$defaults = array(
			'container_bg'      => '#f8fafc',
			'container_border'  => '#e2e8f0',
			'track_bg'          => '#e2e8f0',
			'fill_color'        => '#2563eb',
			'preview_bg'        => '#64748b',
			'percentage_bg'     => '#ffffff',
			'percentage_text'   => '#1e293b',
		);

		$settings = wp_parse_args($settings, $defaults);
		$settings['fill_color'] = WDP_Utils::resolve_progress_bar_fill_color($settings);

		WDP_Admin_Renderer_Helpers::open_form_container('wdp-progress-bar-settings-form');
		self::render_progress_bar_help();
		self::render_progress_bar_fields($settings);
		WDP_Admin_Renderer_Helpers::close_form_container('wdp-save-progress-bar-settings');
	}

	/**
	 * Render modal layout customization tab.
	 *
	 * @return void
	 */
	public static function render_modal_layout_tab() {
		$settings = get_option('wdp_modal_layout_settings', array());
		$defaults = array(
			'side_panel_width_desktop_percent' => '50',
			'side_panel_width_desktop_min_px'  => '400',
			'side_panel_width_desktop_max_px'  => '720',
			'side_panel_width_tablet_percent'  => '55',
			'side_panel_width_tablet_min_px'   => '380',
			'side_panel_width_tablet_max_px'   => '600',
			'side_panel_width_mobile_percent'  => '92',
			'side_panel_width_mobile_min_px'   => '0',
			'side_panel_width_mobile_max_px'   => '100',
			'popup_modal_width_desktop'  => '540',
			'inpage_form_width_desktop'  => '480',
			'modal_padding_top_desktop'  => '32',
			'modal_padding_right_desktop'=> '24',
			'modal_padding_bottom_desktop'=> '24',
			'modal_padding_left_desktop' => '24',
			'popup_modal_width_mobile'   => '540',
			'inpage_form_width_mobile'   => '480',
			'modal_padding_top_mobile'   => '28',
			'modal_padding_right_mobile' => '20',
			'modal_padding_bottom_mobile'=> '20',
			'modal_padding_left_mobile'  => '20',
		);
		$settings = wp_parse_args($settings, $defaults);

		WDP_Admin_Renderer_Helpers::open_form_container('wdp-modal-layout-settings-form');
		self::render_modal_layout_help();
		self::render_side_panel_width_settings($settings);
		self::render_modal_layout_desktop_width($settings);
		self::render_modal_layout_desktop_padding($settings);
		self::render_modal_layout_mobile_width($settings);
		self::render_modal_layout_mobile_padding($settings);
		WDP_Admin_Renderer_Helpers::close_form_container('wdp-save-modal-layout-settings');
	}

	/**
	 * Render progress bar help section.
	 *
	 * @return void
	 */
	private static function render_progress_bar_help() {
		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('Bu sekmede ne yaparsınız?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list"><li>' . esc_html__('Ürün Ayarları’nda ilgili ürün için “Progress Bar” açıksa, hedefe doğru dolan çubuğun renkleri ve kutusu buradan yönetilir.', 'woo-donation-popup') . '</li><li>' . esc_html__('Hedef tutar ürün kartındaki “Üst Limit” alanından; bu sekme yalnızca görsel stildir.', 'woo-donation-popup') . '</li></ul></div>';
	}

	/**
	 * Render progress bar fields.
	 *
	 * @param array $settings Parsed progress settings.
	 * @return void
	 */
	private static function render_progress_bar_fields(array $settings) {
		echo '<h2>' . __('Progress Bar Görünüm Ayarları', 'woo-donation-popup') . '</h2><table class="form-table">';
		echo '<tr><th scope="row"><label for="progress_container_bg">' . __('Kapsayıcı Arka Plan Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_container_bg" name="progress_container_bg" value="' . esc_attr($settings['container_bg']) . '" /><p class="description">' . __('Progress bar kutusunun arka plan rengi.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="progress_container_border">' . __('Kapsayıcı Border Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_container_border" name="progress_container_border" value="' . esc_attr($settings['container_border']) . '" /><p class="description">' . __('Progress bar kutusunun kenarlık rengi.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="progress_track_bg">' . __('Boş Bar Arka Plan Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_track_bg" name="progress_track_bg" value="' . esc_attr($settings['track_bg']) . '" /><p class="description">' . __('İlerleme barının boş kısmının arka plan rengi.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="progress_fill_color">' . __('Dolu Bar Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_fill_color" name="progress_fill_color" value="' . esc_attr($settings['fill_color']) . '" /><p class="description">' . __('İlerlemenin dolduğu kısmın rengi.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="progress_preview_bg">' . __('Preview (Özel Fiyat) Bar Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_preview_bg" name="progress_preview_bg" value="' . esc_attr($settings['preview_bg']) . '" /><p class="description">' . __('Özel fiyat girildiğinde görünen ek bar renginin ana rengi.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="progress_percentage_bg">' . __('Yüzde Rozeti Arka Plan Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_percentage_bg" name="progress_percentage_bg" value="' . esc_attr($settings['percentage_bg']) . '" /><p class="description">' . __('Ortadaki yüzde kutusunun arka plan rengi.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="progress_percentage_text">' . __('Yüzde Rozeti Metin Rengi', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_percentage_text" name="progress_percentage_text" value="' . esc_attr($settings['percentage_text']) . '" /><p class="description">' . __('Ortadaki yüzde kutusunun metin rengi.', 'woo-donation-popup') . '</p></td></tr>';
		echo '</table>';
	}

	/**
	 * Render modal layout help section.
	 *
	 * @return void
	 */
	private static function render_modal_layout_help() {
		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('Bu sekmede ne yaparsınız?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list"><li>' . esc_html__('Popup penceresinin ve sayfa içi (inline) formun piksel genişliği; masaüstü ve mobil için ayrı ayrı.', 'woo-donation-popup') . '</li><li>' . esc_html__('Padding, modal içeriğinin kenarlardan boşluğudur; renk veya buton stilleri diğer görünüm sekmelerindedir.', 'woo-donation-popup') . '</li><li>' . esc_html__('Modal kutusunun iç arka plan rengi ve iç köşe yuvarlaklığı “Normal Form” sekmesinde “Modal içi kutu” bölümündedir (bu sekme yalnızca ölçüler).', 'woo-donation-popup') . '</li></ul></div>';
	}

	/**
	 * Sağ panel genişliği (yüzde + min/max px).
	 *
	 * @param array $settings Modal layout settings.
	 * @return void
	 */
	private static function render_side_panel_width_settings(array $settings) {
		echo '<h2>' . esc_html__('Sağ Panel Genişliği (Bağış Yap)', 'woo-donation-popup') . '</h2>';
		echo '<p class="description">' . esc_html__('Ekran genişliğinin yüzdesi olarak ayarlanır; min/max değerler taşmayı önler.', 'woo-donation-popup') . '</p>';
		echo '<table class="form-table">';
		echo '<tr><th colspan="2"><strong>' . esc_html__('Masaüstü (1200px ve üzeri)', 'woo-donation-popup') . '</strong></th></tr>';
		echo '<tr><th scope="row"><label for="side_panel_width_desktop_percent">' . esc_html__('Genişlik (%)', 'woo-donation-popup') . '</label></th><td><input type="number" id="side_panel_width_desktop_percent" name="side_panel_width_desktop_percent" value="' . esc_attr($settings['side_panel_width_desktop_percent']) . '" min="30" max="100" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="side_panel_width_desktop_min_px">' . esc_html__('En az (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="side_panel_width_desktop_min_px" name="side_panel_width_desktop_min_px" value="' . esc_attr($settings['side_panel_width_desktop_min_px']) . '" min="320" max="900" step="10" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="side_panel_width_desktop_max_px">' . esc_html__('En fazla (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="side_panel_width_desktop_max_px" name="side_panel_width_desktop_max_px" value="' . esc_attr($settings['side_panel_width_desktop_max_px']) . '" min="400" max="1200" step="10" class="small-text" /></td></tr>';
		echo '<tr><th colspan="2"><strong>' . esc_html__('Tablet (768px – 1199px)', 'woo-donation-popup') . '</strong></th></tr>';
		echo '<tr><th scope="row"><label for="side_panel_width_tablet_percent">' . esc_html__('Genişlik (%)', 'woo-donation-popup') . '</label></th><td><input type="number" id="side_panel_width_tablet_percent" name="side_panel_width_tablet_percent" value="' . esc_attr($settings['side_panel_width_tablet_percent']) . '" min="30" max="100" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="side_panel_width_tablet_min_px">' . esc_html__('En az (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="side_panel_width_tablet_min_px" name="side_panel_width_tablet_min_px" value="' . esc_attr($settings['side_panel_width_tablet_min_px']) . '" min="300" max="800" step="10" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="side_panel_width_tablet_max_px">' . esc_html__('En fazla (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="side_panel_width_tablet_max_px" name="side_panel_width_tablet_max_px" value="' . esc_attr($settings['side_panel_width_tablet_max_px']) . '" min="380" max="900" step="10" class="small-text" /></td></tr>';
		echo '<tr><th colspan="2"><strong>' . esc_html__('Mobil (767px ve altı)', 'woo-donation-popup') . '</strong></th></tr>';
		echo '<tr><th scope="row"><label for="side_panel_width_mobile_percent">' . esc_html__('Genişlik (%)', 'woo-donation-popup') . '</label></th><td><input type="number" id="side_panel_width_mobile_percent" name="side_panel_width_mobile_percent" value="' . esc_attr($settings['side_panel_width_mobile_percent']) . '" min="70" max="100" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="side_panel_width_mobile_min_px">' . esc_html__('En az (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="side_panel_width_mobile_min_px" name="side_panel_width_mobile_min_px" value="' . esc_attr($settings['side_panel_width_mobile_min_px']) . '" min="0" max="600" step="10" class="small-text" /><p class="description">' . esc_html__('0 = sınır yok', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="side_panel_width_mobile_max_px">' . esc_html__('En fazla (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="side_panel_width_mobile_max_px" name="side_panel_width_mobile_max_px" value="' . esc_attr($settings['side_panel_width_mobile_max_px']) . '" min="320" max="1200" step="10" class="small-text" /><p class="description">' . esc_html__('100 = tam genişlik (100vw)', 'woo-donation-popup') . '</p></td></tr>';
		echo '</table>';
	}

	/**
	 * Render desktop width fields.
	 *
	 * @param array $settings Modal layout settings.
	 * @return void
	 */
	private static function render_modal_layout_desktop_width(array $settings) {
		echo '<h2>' . __('Masaüstü Modal Genişlik Ayarları', 'woo-donation-popup') . '</h2><table class="form-table">';
		echo '<tr><th scope="row"><label for="popup_modal_width_desktop">' . __('Popup Modal Genişliği (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="popup_modal_width_desktop" name="popup_modal_width_desktop" value="' . esc_attr($settings['popup_modal_width_desktop']) . '" min="300" max="800" step="10" class="small-text" /><p class="description">' . __('Masaüstü için popup modal penceresinin genişliği (300-800px arası)', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="inpage_form_width_desktop">' . __('Sayfa İçi Form Genişliği (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="inpage_form_width_desktop" name="inpage_form_width_desktop" value="' . esc_attr($settings['inpage_form_width_desktop']) . '" min="300" max="800" step="10" class="small-text" /><p class="description">' . __('Masaüstü için sayfa içinde gösterilen formun genişliği (300-800px arası)', 'woo-donation-popup') . '</p></td></tr>';
		echo '</table>';
	}

	/**
	 * Render desktop padding fields.
	 *
	 * @param array $settings Modal layout settings.
	 * @return void
	 */
	private static function render_modal_layout_desktop_padding(array $settings) {
		echo '<h2>' . __('Masaüstü Modal İç Boşluk (Padding) Ayarları', 'woo-donation-popup') . '</h2><table class="form-table">';
		echo '<tr><th scope="row"><label for="modal_padding_top_desktop">' . __('Üst Boşluk (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="modal_padding_top_desktop" name="modal_padding_top_desktop" value="' . esc_attr($settings['modal_padding_top_desktop']) . '" min="0" max="100" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="modal_padding_right_desktop">' . __('Sağ Boşluk (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="modal_padding_right_desktop" name="modal_padding_right_desktop" value="' . esc_attr($settings['modal_padding_right_desktop']) . '" min="0" max="100" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="modal_padding_bottom_desktop">' . __('Alt Boşluk (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="modal_padding_bottom_desktop" name="modal_padding_bottom_desktop" value="' . esc_attr($settings['modal_padding_bottom_desktop']) . '" min="0" max="100" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="modal_padding_left_desktop">' . __('Sol Boşluk (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="modal_padding_left_desktop" name="modal_padding_left_desktop" value="' . esc_attr($settings['modal_padding_left_desktop']) . '" min="0" max="100" step="1" class="small-text" /></td></tr>';
		echo '</table>';
	}

	/**
	 * Render mobile width fields.
	 *
	 * @param array $settings Modal layout settings.
	 * @return void
	 */
	private static function render_modal_layout_mobile_width(array $settings) {
		echo '<h2>' . __('Mobil Modal Genişlik Ayarları', 'woo-donation-popup') . '</h2><table class="form-table">';
		echo '<tr><th scope="row"><label for="popup_modal_width_mobile">' . __('Popup Modal Genişliği (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="popup_modal_width_mobile" name="popup_modal_width_mobile" value="' . esc_attr($settings['popup_modal_width_mobile']) . '" min="300" max="800" step="10" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="inpage_form_width_mobile">' . __('Sayfa İçi Form Genişliği (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="inpage_form_width_mobile" name="inpage_form_width_mobile" value="' . esc_attr($settings['inpage_form_width_mobile']) . '" min="300" max="800" step="10" class="small-text" /></td></tr>';
		echo '</table>';
	}

	/**
	 * Render mobile padding fields.
	 *
	 * @param array $settings Modal layout settings.
	 * @return void
	 */
	private static function render_modal_layout_mobile_padding(array $settings) {
		echo '<h2>' . __('Mobil Modal İç Boşluk (Padding) Ayarları', 'woo-donation-popup') . '</h2><table class="form-table">';
		echo '<tr><th scope="row"><label for="modal_padding_top_mobile">' . __('Üst Boşluk (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="modal_padding_top_mobile" name="modal_padding_top_mobile" value="' . esc_attr($settings['modal_padding_top_mobile']) . '" min="0" max="100" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="modal_padding_right_mobile">' . __('Sağ Boşluk (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="modal_padding_right_mobile" name="modal_padding_right_mobile" value="' . esc_attr($settings['modal_padding_right_mobile']) . '" min="0" max="100" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="modal_padding_bottom_mobile">' . __('Alt Boşluk (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="modal_padding_bottom_mobile" name="modal_padding_bottom_mobile" value="' . esc_attr($settings['modal_padding_bottom_mobile']) . '" min="0" max="100" step="1" class="small-text" /></td></tr>';
		echo '<tr><th scope="row"><label for="modal_padding_left_mobile">' . __('Sol Boşluk (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="modal_padding_left_mobile" name="modal_padding_left_mobile" value="' . esc_attr($settings['modal_padding_left_mobile']) . '" min="0" max="100" step="1" class="small-text" /></td></tr>';
		echo '</table>';
	}
}

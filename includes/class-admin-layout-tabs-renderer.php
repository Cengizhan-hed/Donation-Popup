<?php
/**
 * Modal/form görünümü ve progress bar renk/stil özelleştirme sekmeleri.
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
			'container_bg'             => '#ffffff',
			'container_border'         => '#e5e9ec',
			'track_bg'                 => '#eef2f4',
			'fill_color'               => '#0f608b',
			'preview_bg'               => '#94a3b8',
			'pending_bg'               => '#0f608b',
			'percentage_bg'            => '#ffffff',
			'percentage_text'          => '#0f172a',
			'bar_height'               => '18',
			'enable_celebrate'         => '1',
		);

		$settings = wp_parse_args($settings, $defaults);
		$settings['fill_color'] = WDP_Utils::resolve_progress_bar_fill_color($settings);

		WDP_Admin_Renderer_Helpers::open_settings_split();
		WDP_Admin_Renderer_Helpers::open_form_container('wdp-progress-bar-settings-form');
		self::render_progress_bar_help();
		self::render_progress_bar_fields($settings);
		WDP_Admin_Renderer_Helpers::close_form_container('wdp-save-progress-bar-settings');
		WDP_Admin_Renderer_Helpers::begin_live_preview_aside('wdp-live-preview-progress', __('Progress bar önizlemesi', 'woo-donation-popup'));
		self::render_progress_bar_preview_card($settings);
		WDP_Admin_Renderer_Helpers::close_settings_split();
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

		WDP_Admin_Renderer_Helpers::open_settings_split();
		WDP_Admin_Renderer_Helpers::open_form_container('wdp-modal-layout-settings-form');
		self::render_modal_layout_help();
		self::render_side_panel_width_settings($settings);
		self::render_modal_layout_desktop_width($settings);
		self::render_modal_layout_desktop_padding($settings);
		self::render_modal_layout_mobile_width($settings);
		self::render_modal_layout_mobile_padding($settings);
		WDP_Admin_Renderer_Helpers::close_form_container('wdp-save-modal-layout-settings');
		WDP_Admin_Renderer_Helpers::begin_live_preview_aside('wdp-live-preview-layout', __('Modal ölçü önizlemesi', 'woo-donation-popup'));
		self::render_modal_layout_preview($settings);
		WDP_Admin_Renderer_Helpers::close_settings_split();
	}

	/**
	 * Render progress bar help section.
	 *
	 * @return void
	 */
	private static function render_progress_bar_help() {
		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('Bu sekmede ne yaparsınız?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list"><li>' . esc_html__('Ürün Ayarları’nda “Progress Bar” açıksa, hedefe doğru dolan çubuğun renkleri, yüksekliği ve etiketleri buradan yönetilir.', 'woo-donation-popup') . '</li><li>' . esc_html__('Üç katman: onaylı (ödeme sonrası), sepet bekleyen, yazılan tutar önizlemesi. Hedef tutar ürün kartındaki “Üst Limit” alanındadır.', 'woo-donation-popup') . '</li></ul></div>';
	}

	/**
	 * Live mini preview for progress layers.
	 *
	 * @param array $settings Parsed progress settings.
	 * @return void
	 */
	private static function render_progress_bar_preview_card(array $settings) {
		$h = max(12, min(28, absint($settings['bar_height'])));
		echo '<div class="wdp-admin-progress-preview" id="wdp-admin-progress-preview">';
		echo '<div class="wdp-admin-progress-preview__card" style="--wdp-ap-container-bg:' . esc_attr($settings['container_bg']) . ';--wdp-ap-container-border:' . esc_attr($settings['container_border']) . ';--wdp-ap-track:' . esc_attr($settings['track_bg']) . ';--wdp-ap-fill:' . esc_attr($settings['fill_color']) . ';--wdp-ap-pending:' . esc_attr($settings['pending_bg']) . ';--wdp-ap-preview:' . esc_attr($settings['preview_bg']) . ';--wdp-ap-pct-bg:' . esc_attr($settings['percentage_bg']) . ';--wdp-ap-pct-text:' . esc_attr($settings['percentage_text']) . ';--wdp-ap-h:' . esc_attr($h) . 'px;">';
		echo '<div class="wdp-admin-progress-preview__hdr"><span>' . esc_html__('Toplanan', 'woo-donation-popup') . '<strong>₺42.000</strong></span><span>' . esc_html__('Hedef', 'woo-donation-popup') . '<strong>₺100.000</strong></span></div>';
		echo '<div class="wdp-admin-progress-preview__track">';
		echo '<span class="wdp-admin-progress-preview__fill" style="width:42%"></span>';
		echo '<span class="wdp-admin-progress-preview__pending" style="left:42%;width:18%"></span>';
		echo '<span class="wdp-admin-progress-preview__draft" style="left:60%;width:12%"></span>';
		echo '<span class="wdp-admin-progress-preview__pct">72%</span>';
		echo '</div>';
		echo '</div></div>';
	}

	/**
	 * Render progress bar fields.
	 *
	 * @param array $settings Parsed progress settings.
	 * @return void
	 */
	private static function render_progress_bar_fields(array $settings) {
		WDP_Admin_Renderer_Helpers::render_section_heading(
			__('Renkler ve katmanlar', 'woo-donation-popup'),
			__('Onaylı / sepet / yazılan dilim renkleri ve kart yüzeyi.', 'woo-donation-popup')
		);
		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="progress_container_bg">' . esc_html__('Kapsayıcı Arka Plan', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_container_bg" name="progress_container_bg" value="' . esc_attr($settings['container_bg']) . '" class="wdp-progress-live-input" data-ap-var="--wdp-ap-container-bg" /><p class="description">' . esc_html__('Progress kartının arka plan rengi.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="progress_container_border">' . esc_html__('Kapsayıcı Border', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_container_border" name="progress_container_border" value="' . esc_attr($settings['container_border']) . '" class="wdp-progress-live-input" data-ap-var="--wdp-ap-container-border" /><p class="description">' . esc_html__('Kart kenarlık rengi.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="progress_track_bg">' . esc_html__('Boş Bar', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_track_bg" name="progress_track_bg" value="' . esc_attr($settings['track_bg']) . '" class="wdp-progress-live-input" data-ap-var="--wdp-ap-track" /><p class="description">' . esc_html__('Track (boş kısım) rengi.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="progress_fill_color">' . esc_html__('Onaylı (Dolu) Bar', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_fill_color" name="progress_fill_color" value="' . esc_attr($settings['fill_color']) . '" class="wdp-progress-live-input" data-ap-var="--wdp-ap-fill" /><p class="description">' . esc_html__('Ödeme sonrası onaylanan tutar.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="progress_pending_bg">' . esc_html__('Sepet Bekleyen Bar', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_pending_bg" name="progress_pending_bg" value="' . esc_attr($settings['pending_bg']) . '" class="wdp-progress-live-input" data-ap-var="--wdp-ap-pending" /><p class="description">' . esc_html__('Sepette duran, henüz ödenmemiş tutar dilimi.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="progress_preview_bg">' . esc_html__('Yazılan Tutar (Draft)', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_preview_bg" name="progress_preview_bg" value="' . esc_attr($settings['preview_bg']) . '" class="wdp-progress-live-input" data-ap-var="--wdp-ap-preview" /><p class="description">' . esc_html__('Frontend soft-ink dilim fill rengini kullanır; bu alan eski uyumluluk / yedek renktir.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="progress_percentage_bg">' . esc_html__('Yüzde Rozeti Arka Plan', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_percentage_bg" name="progress_percentage_bg" value="' . esc_attr($settings['percentage_bg']) . '" class="wdp-progress-live-input" data-ap-var="--wdp-ap-pct-bg" /><p class="description">' . esc_html__('Frontend’de yüzde arkaplansızdır; eski uyumluluk.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row"><label for="progress_percentage_text">' . esc_html__('Yüzde Rozeti Metin', 'woo-donation-popup') . '</label></th><td><input type="color" id="progress_percentage_text" name="progress_percentage_text" value="' . esc_attr($settings['percentage_text']) . '" class="wdp-progress-live-input" data-ap-var="--wdp-ap-pct-text" /></td></tr>';
		echo '</table>';

		WDP_Admin_Renderer_Helpers::render_section_heading(
			__('Boyut ve animasyon', 'woo-donation-popup'),
			__('Çubuk yüksekliği ve hedef kutlaması.', 'woo-donation-popup')
		);
		echo '<table class="form-table wdp-admin-field-cards">';
		echo '<tr><th scope="row"><label for="progress_bar_height">' . esc_html__('Bar Yüksekliği (px)', 'woo-donation-popup') . '</label></th><td><input type="number" id="progress_bar_height" name="progress_bar_height" min="12" max="28" step="1" value="' . esc_attr(min(28, max(12, (int) $settings['bar_height']))) . '" class="small-text wdp-progress-live-height" /><p class="description">' . esc_html__('12–28 px. Daha okunaklı bir çubuk için 16–20 önerilir.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row">' . esc_html__('Animasyon', 'woo-donation-popup') . '</th><td>';
		$celebrate = !isset($settings['enable_celebrate']) || (string) $settings['enable_celebrate'] !== '0';
		echo '<label style="display:block;"><input type="checkbox" name="progress_enable_celebrate" value="1" ' . checked($celebrate, true, false) . '> ' . esc_html__('Hedef dolunca kutlama animasyonu', 'woo-donation-popup') . '</label>';
		echo '</td></tr>';
		echo '</table>';
	}

	/**
	 * Scaled modal size preview (desktop width + padding).
	 *
	 * @param array $settings Layout settings.
	 * @return void
	 */
	private static function render_modal_layout_preview(array $settings) {
		$w = max(280, min(800, absint($settings['popup_modal_width_desktop'])));
		$scale = min(1, 320 / max(1, $w));
		$pt = absint($settings['modal_padding_top_desktop']);
		$pr = absint($settings['modal_padding_right_desktop']);
		$pb = absint($settings['modal_padding_bottom_desktop']);
		$pl = absint($settings['modal_padding_left_desktop']);
		$sp = absint($settings['side_panel_width_desktop_percent']);
		echo '<div class="wdp-admin-layout-preview" id="wdp-admin-layout-preview" style="--wdp-lp-modal-w:' . esc_attr((string) $w) . 'px;--wdp-lp-scale:' . esc_attr((string) $scale) . ';--wdp-lp-pad:' . esc_attr("{$pt}px {$pr}px {$pb}px {$pl}px") . ';--wdp-lp-sp:' . esc_attr((string) $sp) . '%;">';
		echo '<div class="wdp-admin-layout-preview__stage">';
		echo '<div class="wdp-admin-layout-preview__modal"><div class="wdp-admin-layout-preview__modal-inner"><span class="wdp-admin-layout-preview__title">' . esc_html__('Popup', 'woo-donation-popup') . '</span><span class="wdp-admin-layout-preview__line"></span><span class="wdp-admin-layout-preview__line short"></span></div></div>';
		echo '<div class="wdp-admin-layout-preview__panel" title="' . esc_attr__('Sağ panel genişliği', 'woo-donation-popup') . '"></div>';
		echo '</div>';
		echo '<p class="wdp-admin-layout-preview__caption"><span data-lp-width>' . esc_html((string) $w) . 'px</span> · <span data-lp-sp>' . esc_html((string) $sp) . '%</span></p>';
		echo '</div>';
	}

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

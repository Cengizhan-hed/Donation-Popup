<?php
/**
 * Görünüm sekmesi: token ayarları, hazır stiller, kategori renkleri, canlı önizleme.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Admin_Appearance_Tab_Renderer
 */
class WDP_Admin_Appearance_Tab_Renderer {

	/**
	 * Render Görünüm tab.
	 *
	 * @return void
	 */
	public static function render_tab() {
		$button = get_option('wdp_button_settings', array());
		if (!is_array($button)) {
			$button = array();
		}
		$button = wp_parse_args(
			$button,
			array(
				'brand_color'          => '#1d5fa8',
				'button_primary_color' => '#1d5fa8',
				'style_preset_id'      => 'sade',
				'ui_border_radius'     => '10',
				'form_density'         => 'normal',
				'body_font_family'     => 'inherit',
				'title_font_size'      => '22',
				'title_size'           => 'M',
				'enable_field_icons'   => '1',
				'note_field_mode'      => 'collapsed',
				'form_button_order'    => 'checkout_first',
				'shell_modal_width'    => '520',
				'shell_panel_width'    => '480',
				'use_category_color'   => '0',
				'button_icons_enabled' => '1',
			)
		);
		if (empty($button['brand_color']) && !empty($button['button_primary_color'])) {
			$button['brand_color'] = $button['button_primary_color'];
		}

		$matrix = class_exists('WDP_Form_Matrix') ? WDP_Form_Matrix::admin_url() : admin_url('admin.php?page=wdp-popup-settings');

		echo '<div class="wdp-settings-container wdp-appearance-tab">';
		echo '<div class="wdp-appearance-layout">';
		echo '<div class="wdp-appearance-settings">';

		echo '<form id="wdp-appearance-settings-form" class="wdp-admin-settings-form" method="post" data-wdp-ajax-action="wdp_save_appearance_settings">';

		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('Görünüm', 'woo-donation-popup') . '</p>';
		echo '<p>' . esc_html__('Tek ana renk ve tasarım jetonları. Hazır stil seçin, sonra ince ayar yapın. Önizleme ayar değiştikçe yalnızca CSS değişkenlerini günceller.', 'woo-donation-popup') . '</p></div>';

		self::render_presets($button);
		self::render_color($button);
		self::render_typography($button);
		self::render_shape($button);
		self::render_fields($button);
		self::render_buttons($button);

		echo '<div class="wdp-settings-section" id="wdp-appearance-categories">';
		echo '<h2 class="wdp-section-title">' . esc_html__('Kategori renkleri', 'woo-donation-popup') . '</h2>';
		if (class_exists('WDP_Admin_Category_Colors_Tab_Renderer')) {
			WDP_Admin_Category_Colors_Tab_Renderer::render_fields_only();
		}
		echo '</div>';

		echo '<p class="submit wdp-sticky-save">';
		echo '<span class="wdp-unsaved-hint" hidden>' . esc_html__('Kaydedilmemiş değişiklikler', 'woo-donation-popup') . '</span> ';
		submit_button(__('Kaydet', 'woo-donation-popup'), 'primary', 'submit', false, array('id' => 'wdp-save-appearance-settings'));
		echo '<span class="spinner"></span>';
		echo '</p>';
		echo '</form>';
		echo '</div>';

		echo '<aside class="wdp-appearance-preview" aria-label="' . esc_attr__('Canlı önizleme', 'woo-donation-popup') . '">';
		echo '<div class="wdp-preview-toolbar">';
		echo '<label>' . esc_html__('Cihaz', 'woo-donation-popup') . ' <select id="wdp-preview-device"><option value="1280">Masaüstü</option><option value="768">Tablet</option><option value="375">Mobil</option></select></label> ';
		echo '<label>' . esc_html__('Tip', 'woo-donation-popup') . ' <select id="wdp-preview-type"><option value="fixed">Sabit</option><option value="custom">Serbest</option><option value="shares">Hisseli</option><option value="campaign">Kampanya</option></select></label> ';
		echo '<label>' . esc_html__('Kabuk', 'woo-donation-popup') . ' <select id="wdp-preview-shell"><option value="modal">Modal</option><option value="panel">Panel</option><option value="inline">Sayfa içi</option></select></label>';
		echo '</div>';
		echo '<iframe id="wdp-appearance-preview-frame" class="wdp-appearance-preview__frame" title="' . esc_attr__('Form önizleme', 'woo-donation-popup') . '" src="' . esc_url(add_query_arg('wdp_preview', '1', $matrix)) . '" style="width:1280px;max-width:100%;height:640px;border:1px solid #d7dde5;border-radius:10px;background:#fff"></iframe>';
		echo '</aside>';

		echo '</div></div>';
	}

	/**
	 * @param array $button Button settings.
	 * @return void
	 */
	private static function render_presets(array $button) {
		$current = isset($button['style_preset_id']) ? (string) $button['style_preset_id'] : 'sade';
		$presets = array(
			'sade'       => __('Sade', 'woo-donation-popup'),
			'yumuşak'    => __('Yumuşak', 'woo-donation-popup'),
			'keskin'     => __('Keskin', 'woo-donation-popup'),
			'kurumsal'   => __('Kurumsal', 'woo-donation-popup'),
		);
		echo '<div class="wdp-settings-section" id="wdp-appearance-presets"><h2 class="wdp-section-title">' . esc_html__('Hazır stiller', 'woo-donation-popup') . '</h2>';
		echo '<div class="wdp-preset-cards" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">';
		foreach ($presets as $id => $label) {
			$checked = $current === $id || ($current === 'classic' && $id === 'sade');
			echo '<label class="wdp-preset-card" style="border:1px solid #d7dde5;border-radius:10px;padding:12px;cursor:pointer;background:' . ($checked ? '#f6f8fa' : '#fff') . '">';
			echo '<input type="radio" name="style_preset_id" value="' . esc_attr($id) . '"' . checked($checked, true, false) . '> ';
			echo '<strong>' . esc_html($label) . '</strong></label>';
		}
		echo '</div>';
		echo '<p><button type="button" class="button" id="wdp-appearance-reset-defaults">' . esc_html__('Varsayılana dön', 'woo-donation-popup') . '</button></p>';
		echo '</div>';
	}

	/**
	 * @param array $button Button settings.
	 * @return void
	 */
	private static function render_color(array $button) {
		$brand = isset($button['brand_color']) ? (string) $button['brand_color'] : '#1d5fa8';
		echo '<div class="wdp-settings-section" id="wdp-appearance-color"><h2 class="wdp-section-title">' . esc_html__('Renk', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		echo '<tr><th scope="row"><label for="wdp_brand_color">' . esc_html__('Ana renk', 'woo-donation-popup') . '</label></th><td>';
		echo '<input type="color" id="wdp_brand_color" name="brand_color" value="' . esc_attr($brand) . '" data-wdp-token="--wdp-primary" /> ';
		echo '<input type="text" name="brand_color_hex" value="' . esc_attr($brand) . '" pattern="^#([A-Fa-f0-9]{6})$" maxlength="7" style="width:7em" />';
		echo '<p class="description">' . esc_html__('Formda tek marka rengi. Hover/active otomatik hesaplanır.', 'woo-donation-popup') . '</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row">' . esc_html__('Kategori rengini kullan', 'woo-donation-popup') . '</th><td>';
		echo '<label><input type="checkbox" name="use_category_color" value="1"' . checked(!empty($button['use_category_color']) && (string) $button['use_category_color'] === '1', true, false) . '> ' . esc_html__('Ürün kategorisi rengi varsa primary yerine geçer', 'woo-donation-popup') . '</label>';
		echo '</td></tr></tbody></table></div>';
	}

	/**
	 * @param array $button Button settings.
	 * @return void
	 */
	private static function render_typography(array $button) {
		$font = isset($button['body_font_family']) ? (string) $button['body_font_family'] : 'inherit';
		$title = isset($button['title_size']) ? (string) $button['title_size'] : 'M';
		if (!in_array($title, array('S', 'M', 'L'), true)) {
			$px = isset($button['title_font_size']) ? (int) $button['title_font_size'] : 22;
			$title = $px <= 20 ? 'S' : ($px >= 26 ? 'L' : 'M');
		}
		echo '<div class="wdp-settings-section" id="wdp-appearance-type"><h2 class="wdp-section-title">' . esc_html__('Yazı', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		echo '<tr><th scope="row">' . esc_html__('Font kaynağı', 'woo-donation-popup') . '</th><td>';
		echo '<select name="body_font_family" data-wdp-token="--wdp-font">';
		echo '<option value="inherit"' . selected($font, 'inherit', false) . '>' . esc_html__('Tema fontu', 'woo-donation-popup') . '</option>';
		echo '<option value="system"' . selected($font, 'system', false) . '>' . esc_html__('Sistem fontu', 'woo-donation-popup') . '</option>';
		echo '</select></td></tr>';
		echo '<tr><th scope="row">' . esc_html__('Başlık boyutu', 'woo-donation-popup') . '</th><td>';
		echo '<select name="title_size" data-wdp-token="--wdp-fs-title">';
		echo '<option value="S"' . selected($title, 'S', false) . '>S (18px)</option>';
		echo '<option value="M"' . selected($title, 'M', false) . '>M (22px)</option>';
		echo '<option value="L"' . selected($title, 'L', false) . '>L (24px)</option>';
		echo '</select></td></tr></tbody></table></div>';
	}

	/**
	 * @param array $button Button settings.
	 * @return void
	 */
	private static function render_shape(array $button) {
		$radius = isset($button['ui_border_radius']) ? (int) $button['ui_border_radius'] : 10;
		$density = isset($button['form_density']) ? (string) $button['form_density'] : 'normal';
		if ($density === 'compact') {
			$density = 'tight';
		} elseif ($density === 'spacious') {
			$density = 'comfortable';
		}
		$modal_w = isset($button['shell_modal_width']) ? (int) $button['shell_modal_width'] : 520;
		$panel_w = isset($button['shell_panel_width']) ? (int) $button['shell_panel_width'] : 480;
		echo '<div class="wdp-settings-section" id="wdp-appearance-shape"><h2 class="wdp-section-title">' . esc_html__('Şekil', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		echo '<tr><th scope="row"><label for="ui_border_radius">' . esc_html__('Köşe yuvarlaklığı', 'woo-donation-popup') . '</label></th><td>';
		echo '<input type="range" id="ui_border_radius" name="ui_border_radius" min="0" max="24" value="' . esc_attr((string) $radius) . '" data-wdp-token="--wdp-radius-md" /> ';
		echo '<span class="description">0–24 px</span></td></tr>';
		echo '<tr><th scope="row">' . esc_html__('Yoğunluk', 'woo-donation-popup') . '</th><td><select name="form_density">';
		echo '<option value="tight"' . selected($density, 'tight', false) . '>' . esc_html__('Sıkı', 'woo-donation-popup') . '</option>';
		echo '<option value="normal"' . selected($density, 'normal', false) . '>' . esc_html__('Normal', 'woo-donation-popup') . '</option>';
		echo '<option value="comfortable"' . selected($density, 'comfortable', false) . '>' . esc_html__('Rahat', 'woo-donation-popup') . '</option>';
		echo '</select></td></tr>';
		echo '<tr><th scope="row">' . esc_html__('Modal genişliği', 'woo-donation-popup') . '</th><td><select name="shell_modal_width" data-wdp-token="--wdp-shell-w-modal">';
		foreach (array(480, 520, 600) as $w) {
			echo '<option value="' . esc_attr((string) $w) . '"' . selected($modal_w, $w, false) . '>' . esc_html((string) $w) . ' px</option>';
		}
		echo '</select></td></tr>';
		echo '<tr><th scope="row">' . esc_html__('Panel genişliği', 'woo-donation-popup') . '</th><td><select name="shell_panel_width" data-wdp-token="--wdp-shell-w-panel">';
		foreach (array(420, 480, 560) as $w) {
			echo '<option value="' . esc_attr((string) $w) . '"' . selected($panel_w, $w, false) . '>' . esc_html((string) $w) . ' px</option>';
		}
		echo '</select></td></tr></tbody></table></div>';
	}

	/**
	 * @param array $button Button settings.
	 * @return void
	 */
	private static function render_fields(array $button) {
		$icons = !isset($button['enable_field_icons']) || (string) $button['enable_field_icons'] === '1';
		$note = isset($button['note_field_mode']) ? (string) $button['note_field_mode'] : 'collapsed';
		echo '<div class="wdp-settings-section" id="wdp-appearance-fields"><h2 class="wdp-section-title">' . esc_html__('Alanlar', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		echo '<tr><th scope="row">' . esc_html__('İkonlar', 'woo-donation-popup') . '</th><td><label><input type="checkbox" name="enable_field_icons" value="1"' . checked($icons, true, false) . '> ' . esc_html__('Alan ikonlarını göster', 'woo-donation-popup') . '</label></td></tr>';
		echo '<tr><th scope="row">' . esc_html__('Not alanı', 'woo-donation-popup') . '</th><td><select name="note_field_mode">';
		echo '<option value="collapsed"' . selected($note, 'collapsed', false) . '>' . esc_html__('Kapalı başlar (+ Not ekle)', 'woo-donation-popup') . '</option>';
		echo '<option value="always"' . selected($note, 'always', false) . '>' . esc_html__('Her zaman açık', 'woo-donation-popup') . '</option>';
		echo '</select></td></tr></tbody></table></div>';
	}

	/**
	 * @param array $button Button settings.
	 * @return void
	 */
	private static function render_buttons(array $button) {
		$order = isset($button['form_button_order']) ? (string) $button['form_button_order'] : 'checkout_first';
		$icons = !isset($button['button_icons_enabled']) || (string) $button['button_icons_enabled'] === '1';
		echo '<div class="wdp-settings-section" id="wdp-appearance-buttons"><h2 class="wdp-section-title">' . esc_html__('Butonlar', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		echo '<tr><th scope="row">' . esc_html__('Birincil eylem', 'woo-donation-popup') . '</th><td><select name="form_button_order">';
		echo '<option value="checkout_first"' . selected($order, 'checkout_first', false) . '>' . esc_html__('Ödemeye Git', 'woo-donation-popup') . '</option>';
		echo '<option value="add_first"' . selected($order, 'add_first', false) . '>' . esc_html__('Sepete Ekle', 'woo-donation-popup') . '</option>';
		echo '</select>';
		echo '<p class="description">' . esc_html__('Hangisinin birincil (dolgu) olacağını belirler. Sıra her yerde aynıdır.', 'woo-donation-popup') . '</p></td></tr>';
		echo '<tr><th scope="row">' . esc_html__('Buton ikonları', 'woo-donation-popup') . '</th><td><label><input type="checkbox" name="button_icons_enabled" value="1"' . checked($icons, true, false) . '> ' . esc_html__('İkonları göster', 'woo-donation-popup') . '</label></td></tr>';
		echo '</tbody></table></div>';
	}
}

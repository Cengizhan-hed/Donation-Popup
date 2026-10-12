<?php
/**
 * Ayarlar sayfasında tek WooCommerce ürünü için bağış yapılandırma kartı.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Renders one product configuration card on the settings page.
 */
class WDP_Admin_Product_Row_Renderer {

	/**
	 * Render product settings row.
	 *
	 * @param WC_Product $product WooCommerce product.
	 * @return void
	 */
	public static function render($product) {
		if (!is_a($product, 'WC_Product')) {
			return;
		}

		$allow_custom_price    = get_post_meta($product->get_id(), '_allow_custom_price', true) === 'yes';
		$min_custom_price      = get_post_meta($product->get_id(), '_min_custom_price', true);
		$allow_multiple_shares = get_post_meta($product->get_id(), '_allow_multiple_shares', true) === 'yes';
		$max_shares            = get_post_meta($product->get_id(), '_max_shares', true);
		$enable_progress_bar   = get_post_meta($product->get_id(), '_enable_progress_bar', true) === 'yes';
		$progress_bar_limit    = get_post_meta($product->get_id(), '_progress_bar_limit', true);
		$enable_product_note   = get_post_meta($product->get_id(), '_enable_product_note', true) === 'yes';
		$product_note_text     = get_post_meta($product->get_id(), '_product_note_text', true);
		$enable_sadaka_donation = get_post_meta($product->get_id(), '_enable_sadaka_donation', true) === 'yes';
		$sadaka_min_price      = get_post_meta($product->get_id(), '_sadaka_min_price', true);
		$sadaka_fixed_price    = get_post_meta($product->get_id(), '_sadaka_fixed_price', true);
		$sadaka_wc_product_id  = get_post_meta($product->get_id(), '_sadaka_wc_product_id', true);
		$sadaka_donation_message = get_post_meta($product->get_id(), '_sadaka_donation_message', true);
		$sadaka_toggle_label   = get_post_meta($product->get_id(), '_sadaka_toggle_label', true);
		$default_sadaka_message = class_exists('WDP_Templates')
			? WDP_Templates::get_default_sadaka_donation_message()
			: '';

		if ($min_custom_price === '') {
			$min_custom_price = '0';
		}

		if ($max_shares === '') {
			$max_shares = '7';
		}

		if ($progress_bar_limit === '') {
			$progress_bar_limit = '100000';
		}

		$button_shortcode       = '[wdp_donation_button id="' . $product->get_id() . '"]';
		$panel_button_shortcode = '[wdp_donation_button_panel id="' . $product->get_id() . '"]';
		$form_shortcode         = '[wdp_donation_form id="' . $product->get_id() . '"]';

		echo '<div class="wdp-product-card" data-product-id="' . esc_attr($product->get_id()) . '">';

		echo '<div class="wdp-product-main">';
		echo '<div class="wdp-product-title">';
		echo '<a href="' . esc_url(get_edit_post_link($product->get_id())) . '" target="_blank">' . esc_html($product->get_name()) . '</a>';
		echo '</div>';
		echo '<input type="hidden" name="product_id" value="' . esc_attr($product->get_id()) . '">';
		echo '</div>';

		echo '<div class="wdp-product-settings-grid">';

		echo '<div class="wdp-field-group wdp-field-group-shortcodes">';
		echo '<div class="wdp-shortcode-compact">';
		echo '<label class="wdp-shortcode-label" for="wdp-shortcode-select-' . esc_attr($product->get_id()) . '">' . esc_html__('Kısa Kod', 'woo-donation-popup') . '</label>';
		echo '<select id="wdp-shortcode-select-' . esc_attr($product->get_id()) . '" class="wdp-shortcode-select">';
		echo '<option value="' . esc_attr($button_shortcode) . '">' . esc_html__('Buton', 'woo-donation-popup') . '</option>';
		echo '<option value="' . esc_attr($panel_button_shortcode) . '">' . esc_html__('Sağ Panel', 'woo-donation-popup') . '</option>';
		echo '<option value="' . esc_attr($form_shortcode) . '">' . esc_html__('Form', 'woo-donation-popup') . '</option>';
		echo '</select>';
		echo '<code class="wdp-shortcode wdp-shortcode-current">' . esc_html($button_shortcode) . '</code>';
		echo '<button type="button" class="button button-small wdp-copy-shortcode wdp-copy-shortcode-current" data-shortcode="' . esc_attr($button_shortcode) . '">' . esc_html__('Kopyala', 'woo-donation-popup') . '</button>';
		echo '</div>';
		echo '</div>';

		echo '<div class="wdp-product-settings-row-core">';

		echo '<div class="wdp-field-group wdp-field-group-core wdp-field-group-core--shares">';
		echo '<div class="wdp-field wdp-field-toggle">';
		echo '<div class="wdp-field-label">' . esc_html__('Çoklu Hisse', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-field-control">';
		echo '<label class="wdp-switch">';
		echo '<input type="checkbox" name="allow_multiple_shares" ' . checked($allow_multiple_shares, true, false) . '>';
		echo '<span class="wdp-slider"></span>';
		echo '</label>';
		echo '</div>';
		echo '</div>';
		echo '<div class="wdp-sub-field">';
		echo '<div class="wdp-sub-field-label">' . esc_html__('Maks. Hisse', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-field-control">';
		echo '<input type="number" name="max_shares" value="' . esc_attr($max_shares) . '" min="1" max="20" class="small-text">';
		echo '</div>';
		echo '</div>';
		echo '</div>';

		echo '<div class="wdp-field-group wdp-field-group-core wdp-field-group-core--price">';
		echo '<div class="wdp-field wdp-field-toggle">';
		echo '<div class="wdp-field-label">' . esc_html__('Özel Fiyat', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-field-control">';
		echo '<label class="wdp-switch">';
		echo '<input type="checkbox" name="allow_custom_price" ' . checked($allow_custom_price, true, false) . '>';
		echo '<span class="wdp-slider"></span>';
		echo '</label>';
		echo '</div>';
		echo '</div>';
		echo '<div class="wdp-sub-field">';
		echo '<div class="wdp-sub-field-label">' . esc_html__('Min. Fiyat (₺)', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-field-control">';
		echo '<input type="number" name="min_custom_price" value="' . esc_attr($min_custom_price) . '" min="0" step="1" class="small-text">';
		echo '</div>';
		echo '</div>';
		echo '</div>';

		echo '<div class="wdp-field-group wdp-field-group-core wdp-field-group-core--progress">';
		echo '<div class="wdp-field wdp-field-toggle">';
		echo '<div class="wdp-field-label">' . esc_html__('Progress Bar', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-field-control">';
		echo '<label class="wdp-switch">';
		echo '<input type="checkbox" name="enable_progress_bar" ' . checked($enable_progress_bar, true, false) . '>';
		echo '<span class="wdp-slider"></span>';
		echo '</label>';
		echo '</div>';
		echo '</div>';
		echo '<div class="wdp-sub-field">';
		echo '<div class="wdp-sub-field-label">' . esc_html__('Üst Limit (₺)', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-field-control">';
		echo '<input type="number" name="progress_bar_limit" value="' . esc_attr($progress_bar_limit) . '" min="0" step="1" class="small-text">';
		echo '</div>';
		echo '</div>';
		echo '</div>';

		echo '</div>'; // .wdp-product-settings-row-core

		echo '<div class="wdp-field-group wdp-field-group-modules">';
		echo '<button type="button" class="wdp-collapse-toggle" data-collapse-target=".wdp-product-modules-grid" aria-expanded="false">';
		echo '<span class="wdp-collapse-toggle__label">' . esc_html__('Özellik modülleri', 'woo-donation-popup') . '</span>';
		echo '<span class="wdp-collapse-toggle__icon" aria-hidden="true"></span>';
		echo '</button>';
		echo '<div class="wdp-product-modules-grid">';

		$module_flags = array(
			'enable_trust_strip'    => array('label' => __('Güven şeridi', 'woo-donation-popup'), 'default' => true),
			'enable_quantity'       => array('label' => __('Adet seçici', 'woo-donation-popup'), 'default' => true),
			'enable_amount_presets' => array('label' => __('Hızlı tutar chip’leri', 'woo-donation-popup'), 'default' => true),
			'enable_wizard'         => array('label' => __('Çok adımlı form (ürün)', 'woo-donation-popup'), 'default' => false),
			'enable_field_icons'    => array('label' => __('Alan ikonları', 'woo-donation-popup'), 'default' => true),
			'enable_impact_line'    => array('label' => __('Etki / kampanya satırı', 'woo-donation-popup'), 'default' => true),
			'progress_celebrate'    => array('label' => __('Progress kutlama animasyonu', 'woo-donation-popup'), 'default' => true),
		);

		foreach ($module_flags as $name => $meta) {
			$meta_key = '_' . $name;
			$raw      = get_post_meta($product->get_id(), $meta_key, true);
			$on       = ($raw === '') ? !empty($meta['default']) : ($raw === 'yes');
			echo '<div class="wdp-field wdp-field-toggle">';
			echo '<div class="wdp-field-label">' . esc_html($meta['label']) . '</div>';
			echo '<div class="wdp-field-control">';
			echo '<label class="wdp-switch">';
			echo '<input type="checkbox" name="' . esc_attr($name) . '" ' . checked($on, true, false) . '>';
			echo '<span class="wdp-slider"></span>';
			echo '</label>';
			echo '</div></div>';
		}

		echo '</div>';
		echo '</div>';

		echo '<div class="wdp-field-group wdp-field-group-details">';
		echo '<button type="button" class="wdp-collapse-toggle" data-collapse-target=".wdp-product-details-grid" aria-expanded="false">';
		echo '<span class="wdp-collapse-toggle__label">' . esc_html__('Detaylar', 'woo-donation-popup') . '</span>';
		echo '<span class="wdp-collapse-toggle__icon" aria-hidden="true"></span>';
		echo '</button>';
		echo '<div class="wdp-product-details-grid">';

		echo '<div class="wdp-field-group wdp-field-group-note">';
		echo '<button type="button" class="wdp-collapse-toggle" data-collapse-target=".wdp-note-fields-grid" aria-expanded="false">';
		echo '<span class="wdp-collapse-toggle__label">' . esc_html__('Not Ayarları', 'woo-donation-popup') . '</span>';
		echo '<span class="wdp-collapse-toggle__icon" aria-hidden="true"></span>';
		echo '</button>';
		echo '<div class="wdp-note-fields-grid">';
		echo '<div class="wdp-field wdp-field-toggle">';
		echo '<div class="wdp-field-label">' . esc_html__('Not Ekle', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-field-control">';
		echo '<label class="wdp-switch">';
		echo '<input type="checkbox" name="enable_product_note" ' . checked($enable_product_note, true, false) . '>';
		echo '<span class="wdp-slider"></span>';
		echo '</label>';
		echo '</div>';
		echo '</div>';
		echo '<div class="wdp-sub-field wdp-sub-field--wide">';
		echo '<div class="wdp-sub-field-label">' . esc_html__('Not metni', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-field-control">';
		echo '<textarea name="product_note_text" rows="3" maxlength="400" placeholder="' . esc_attr__('Örn: 24 saat içinde video ulaştırılmaktadır.', 'woo-donation-popup') . '">' . esc_textarea($product_note_text) . '</textarea>';
		echo '</div></div>';
		echo '</div>';
		echo '</div>';

		echo '<div class="wdp-field-group wdp-field-group-sadaka">';
		echo '<button type="button" class="wdp-collapse-toggle" data-collapse-target=".wdp-sadaka-settings-stack" aria-expanded="false">';
		echo '<span class="wdp-collapse-toggle__label">' . esc_html__('Alt Bağış Ayarları', 'woo-donation-popup') . '</span>';
		echo '<span class="wdp-collapse-toggle__icon" aria-hidden="true"></span>';
		echo '</button>';
		echo '<div class="wdp-sadaka-settings-stack">';
		echo '<div class="wdp-field wdp-field-toggle wdp-sadaka-toggle-row">';
		echo '<div class="wdp-field-label">' . esc_html__('Alt bağış ekle', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-field-control wdp-sadaka-toggle-row__inner">';
		echo '<label class="wdp-switch">';
		echo '<input type="checkbox" name="enable_sadaka_donation" ' . checked($enable_sadaka_donation, true, false) . '>';
		echo '<span class="wdp-slider"></span>';
		echo '</label>';
		echo '<input type="text" name="sadaka_toggle_label" value="' . esc_attr(is_string($sadaka_toggle_label) ? $sadaka_toggle_label : '') . '" class="wdp-sadaka-toggle-label-input" maxlength="80" placeholder="' . esc_attr__('Alt Bağış Ekle', 'woo-donation-popup') . '" aria-label="' . esc_attr__('Form buton metni', 'woo-donation-popup') . '">';
		echo '</div>';
		echo '</div>';
		echo '<div class="wdp-sub-field wdp-sub-field--min">';
		echo '<div class="wdp-sub-field-label">' . esc_html__('WC ürün ID', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-field-control">';
		$default_sadaka_wc_id = class_exists('WDP_Utils') ? WDP_Utils::get_default_sadaka_wc_product_id() : 0;
		echo '<input type="number" name="sadaka_wc_product_id" value="' . esc_attr($sadaka_wc_product_id !== '' && $sadaka_wc_product_id !== '0' ? $sadaka_wc_product_id : '') . '" min="1" step="1" class="small-text" placeholder="' . esc_attr((string) $default_sadaka_wc_id) . '">';
		echo '<p class="description">' . esc_html__('Boş bırakırsanız genel varsayılan kullanılır; genel varsayılan boş/0 ise alt bağış satırı eklenmez.', 'woo-donation-popup') . '</p>';
		echo '</div>';
		echo '</div>';
		echo '<div class="wdp-sadaka-price-grid">';
		echo '<div class="wdp-sub-field wdp-sub-field--min">';
		echo '<div class="wdp-sub-field-label">' . esc_html__('Min TL', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-field-control">';
		echo '<input type="number" name="sadaka_min_price" value="' . esc_attr($sadaka_min_price !== '' ? $sadaka_min_price : '0') . '" min="0" step="1" class="small-text">';
		echo '<p class="description">' . esc_html__('Özel tutar için minimum. Sabit fiyat doluysa yok sayılır.', 'woo-donation-popup') . '</p>';
		echo '</div>';
		echo '</div>';
		echo '<div class="wdp-sub-field wdp-sub-field--min">';
		echo '<div class="wdp-sub-field-label">' . esc_html__('Sabit fiyat', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-field-control">';
		echo '<input type="number" name="sadaka_fixed_price" value="' . esc_attr($sadaka_fixed_price !== '' && (float) $sadaka_fixed_price > 0 ? $sadaka_fixed_price : '') . '" min="0" step="1" class="small-text" placeholder="0">';
		echo '<p class="description">' . esc_html__('Doluysa bu tutarla WC ürün ID sepete eklenir.', 'woo-donation-popup') . '</p>';
		echo '</div>';
		echo '</div>';
		echo '</div>';
		echo '<div class="wdp-sub-field wdp-sub-field--wide">';
		echo '<div class="wdp-sub-field-label">' . esc_html__('Alt bağış notu', 'woo-donation-popup') . '</div>';
		echo '<div class="wdp-field-control">';
		echo '<textarea name="sadaka_donation_message" rows="3" maxlength="300" placeholder="' . esc_attr($default_sadaka_message) . '">' . esc_textarea($sadaka_donation_message) . '</textarea>';
		echo '</div>';
		echo '</div>';
		echo '</div>';
		echo '</div>';

		// Campaign / premium product modules
		$impact_line_text = (string) get_post_meta($product->get_id(), '_impact_line_text', true);
		$amount_presets_csv = (string) get_post_meta($product->get_id(), '_amount_presets', true);
		$enable_email = get_post_meta($product->get_id(), '_enable_email', true) === 'yes';
		$enable_dedication = get_post_meta($product->get_id(), '_enable_dedication', true) === 'yes';
		$enable_anonymous = get_post_meta($product->get_id(), '_enable_anonymous', true) === 'yes';
		$dedication_placeholder = (string) get_post_meta($product->get_id(), '_dedication_placeholder', true);
		$layout_mode = sanitize_key((string) get_post_meta($product->get_id(), '_layout_mode', true));
		if (!in_array($layout_mode, array('classic', 'campaign', 'story'), true)) {
			$layout_mode = 'classic';
		}
		$theme_primary = (string) get_post_meta($product->get_id(), '_theme_primary', true);
		$theme_primary_hover = (string) get_post_meta($product->get_id(), '_theme_primary_hover', true);
		$theme_radius = (string) get_post_meta($product->get_id(), '_theme_radius', true);
		$theme_density = (string) get_post_meta($product->get_id(), '_theme_density', true);
		$theme_modal_bg = (string) get_post_meta($product->get_id(), '_theme_modal_bg', true);
		$theme_inherit = get_post_meta($product->get_id(), '_theme_inherit_category_color', true) === 'yes';
		$enable_campaign_media = get_post_meta($product->get_id(), '_enable_campaign_media', true) === 'yes';
		$enable_urgency = get_post_meta($product->get_id(), '_enable_urgency', true) === 'yes';
		$urgency_text = (string) get_post_meta($product->get_id(), '_urgency_text', true);
		$urgency_ends_at = (string) get_post_meta($product->get_id(), '_urgency_ends_at', true);
		$enable_social_proof = get_post_meta($product->get_id(), '_enable_social_proof', true) === 'yes';
		$social_proof_text = (string) get_post_meta($product->get_id(), '_social_proof_text', true);
		$enable_faq = get_post_meta($product->get_id(), '_enable_faq', true) === 'yes';
		$faq_items = (string) get_post_meta($product->get_id(), '_faq_items', true);
		$enable_cover_fee = get_post_meta($product->get_id(), '_enable_cover_fee', true) === 'yes';
		$cover_fee_percent = (string) get_post_meta($product->get_id(), '_cover_fee_percent', true);
		$module_order = (string) get_post_meta($product->get_id(), '_wdp_module_order', true);
		$trust_badges = (string) get_post_meta($product->get_id(), '_trust_badges', true);

		echo '<div class="wdp-field-group wdp-field-group-campaign">';
		echo '<button type="button" class="wdp-collapse-toggle" data-collapse-target=".wdp-campaign-fields-grid" aria-expanded="false">';
		echo '<span class="wdp-collapse-toggle__label">' . esc_html__('Kampanya & görünüm', 'woo-donation-popup') . '</span>';
		echo '<span class="wdp-collapse-toggle__icon" aria-hidden="true"></span>';
		echo '</button>';
		echo '<div class="wdp-campaign-fields-grid">';

		echo '<div class="wdp-sub-field wdp-sub-field--wide"><div class="wdp-sub-field-label">' . esc_html__('Etki satırı metni', 'woo-donation-popup') . '</div><div class="wdp-field-control">';
		echo '<input type="text" name="impact_line_text" value="' . esc_attr($impact_line_text) . '" class="wdp-campaign-input" maxlength="160" placeholder="' . esc_attr__('Örn: Bir bağışınız bir aileyi ısıtır.', 'woo-donation-popup') . '" />';
		echo '</div></div>';

		echo '<div class="wdp-sub-field wdp-sub-field--wide"><div class="wdp-sub-field-label">' . esc_html__('Ürün tutar chip’leri', 'woo-donation-popup') . '</div><div class="wdp-field-control">';
		echo '<input type="text" name="amount_presets" value="' . esc_attr($amount_presets_csv) . '" class="wdp-campaign-input" placeholder="' . esc_attr__('Boş = global (örn. 100, 250, 500)', 'woo-donation-popup') . '" />';
		echo '</div></div>';

		echo '<div class="wdp-field wdp-field-toggle"><div class="wdp-field-label">' . esc_html__('E-posta alanı', 'woo-donation-popup') . '</div><div class="wdp-field-control"><label class="wdp-switch"><input type="checkbox" name="enable_email" ' . checked($enable_email, true, false) . '><span class="wdp-slider"></span></label></div></div>';
		echo '<div class="wdp-field wdp-field-toggle"><div class="wdp-field-label">' . esc_html__('İthaf alanı', 'woo-donation-popup') . '</div><div class="wdp-field-control"><label class="wdp-switch"><input type="checkbox" name="enable_dedication" ' . checked($enable_dedication, true, false) . '><span class="wdp-slider"></span></label></div></div>';
		echo '<div class="wdp-field wdp-field-toggle"><div class="wdp-field-label">' . esc_html__('Anonim bağış', 'woo-donation-popup') . '</div><div class="wdp-field-control"><label class="wdp-switch"><input type="checkbox" name="enable_anonymous" ' . checked($enable_anonymous, true, false) . '><span class="wdp-slider"></span></label></div></div>';
		echo '<div class="wdp-sub-field wdp-sub-field--wide"><div class="wdp-sub-field-label">' . esc_html__('İthaf placeholder', 'woo-donation-popup') . '</div><div class="wdp-field-control"><input type="text" name="dedication_placeholder" value="' . esc_attr($dedication_placeholder) . '" class="wdp-campaign-input" /></div></div>';

		echo '<div class="wdp-sub-field"><div class="wdp-sub-field-label">' . esc_html__('Layout modu', 'woo-donation-popup') . '</div><div class="wdp-field-control">';
		echo '<select name="layout_mode" class="wdp-campaign-input">';
		foreach (array('classic' => __('Klasik', 'woo-donation-popup'), 'campaign' => __('Kampanya', 'woo-donation-popup'), 'story' => __('Hikâye (split)', 'woo-donation-popup')) as $k => $lab) {
			echo '<option value="' . esc_attr($k) . '" ' . selected($layout_mode, $k, false) . '>' . esc_html($lab) . '</option>';
		}
		echo '</select></div></div>';

		echo '<div class="wdp-field wdp-field-toggle"><div class="wdp-field-label">' . esc_html__('Kampanya medyası (ürün görseli)', 'woo-donation-popup') . '</div><div class="wdp-field-control"><label class="wdp-switch"><input type="checkbox" name="enable_campaign_media" ' . checked($enable_campaign_media, true, false) . '><span class="wdp-slider"></span></label></div></div>';
		echo '<div class="wdp-field wdp-field-toggle"><div class="wdp-field-label">' . esc_html__('Kategori rengini primary yap', 'woo-donation-popup') . '</div><div class="wdp-field-control"><label class="wdp-switch"><input type="checkbox" name="theme_inherit_category_color" ' . checked($theme_inherit, true, false) . '><span class="wdp-slider"></span></label></div></div>';

		echo '<div class="wdp-sub-field"><div class="wdp-sub-field-label">' . esc_html__('Primary (hex)', 'woo-donation-popup') . '</div><div class="wdp-field-control"><input type="text" name="theme_primary" value="' . esc_attr($theme_primary) . '" class="wdp-campaign-input" placeholder="#036a37" /></div></div>';
		echo '<div class="wdp-sub-field"><div class="wdp-sub-field-label">' . esc_html__('Primary hover', 'woo-donation-popup') . '</div><div class="wdp-field-control"><input type="text" name="theme_primary_hover" value="' . esc_attr($theme_primary_hover) . '" class="wdp-campaign-input" placeholder="#025a2e" /></div></div>';
		echo '<div class="wdp-sub-field"><div class="wdp-sub-field-label">' . esc_html__('Radius', 'woo-donation-popup') . '</div><div class="wdp-field-control"><input type="number" name="theme_radius" value="' . esc_attr($theme_radius) . '" min="0" max="32" class="small-text" placeholder="—" /></div></div>';
		echo '<div class="wdp-sub-field"><div class="wdp-sub-field-label">' . esc_html__('Yoğunluk', 'woo-donation-popup') . '</div><div class="wdp-field-control"><select name="theme_density" class="wdp-campaign-input"><option value="">' . esc_html__('Global', 'woo-donation-popup') . '</option>';
		foreach (array('compact', 'normal', 'spacious') as $d) {
			echo '<option value="' . esc_attr($d) . '" ' . selected($theme_density, $d, false) . '>' . esc_html($d) . '</option>';
		}
		echo '</select></div></div>';
		echo '<div class="wdp-sub-field"><div class="wdp-sub-field-label">' . esc_html__('Modal bg (hex)', 'woo-donation-popup') . '</div><div class="wdp-field-control"><input type="text" name="theme_modal_bg" value="' . esc_attr($theme_modal_bg) . '" class="wdp-campaign-input" placeholder="#ffffff" /></div></div>';

		echo '<div class="wdp-field wdp-field-toggle"><div class="wdp-field-label">' . esc_html__('Aciliyet şeridi', 'woo-donation-popup') . '</div><div class="wdp-field-control"><label class="wdp-switch"><input type="checkbox" name="enable_urgency" ' . checked($enable_urgency, true, false) . '><span class="wdp-slider"></span></label></div></div>';
		echo '<div class="wdp-sub-field wdp-sub-field--wide"><div class="wdp-sub-field-label">' . esc_html__('Aciliyet metni', 'woo-donation-popup') . '</div><div class="wdp-field-control"><input type="text" name="urgency_text" value="' . esc_attr($urgency_text) . '" class="wdp-campaign-input" maxlength="140" /></div></div>';
		echo '<div class="wdp-sub-field"><div class="wdp-sub-field-label">' . esc_html__('Bitiş (opsiyonel)', 'woo-donation-popup') . '</div><div class="wdp-field-control"><input type="text" name="urgency_ends_at" value="' . esc_attr($urgency_ends_at) . '" class="wdp-campaign-input" placeholder="YYYY-MM-DD" /></div></div>';

		echo '<div class="wdp-field wdp-field-toggle"><div class="wdp-field-label">' . esc_html__('Sosyal kanıt', 'woo-donation-popup') . '</div><div class="wdp-field-control"><label class="wdp-switch"><input type="checkbox" name="enable_social_proof" ' . checked($enable_social_proof, true, false) . '><span class="wdp-slider"></span></label></div></div>';
		echo '<div class="wdp-sub-field wdp-sub-field--wide"><div class="wdp-sub-field-label">' . esc_html__('Sosyal kanıt metni', 'woo-donation-popup') . '</div><div class="wdp-field-control"><input type="text" name="social_proof_text" value="' . esc_attr($social_proof_text) . '" class="wdp-campaign-input" placeholder="' . esc_attr__('Bugün 128 kişi bağış yaptı', 'woo-donation-popup') . '" /></div></div>';

		echo '<div class="wdp-field wdp-field-toggle"><div class="wdp-field-label">' . esc_html__('SSS', 'woo-donation-popup') . '</div><div class="wdp-field-control"><label class="wdp-switch"><input type="checkbox" name="enable_faq" ' . checked($enable_faq, true, false) . '><span class="wdp-slider"></span></label></div></div>';
		echo '<div class="wdp-sub-field wdp-sub-field--wide"><div class="wdp-sub-field-label">' . esc_html__('SSS satırları (Soru|Cevap)', 'woo-donation-popup') . '</div><div class="wdp-field-control"><textarea name="faq_items" rows="3" placeholder="' . esc_attr__('Soru|Cevap — her satıra bir madde', 'woo-donation-popup') . '">' . esc_textarea($faq_items) . '</textarea></div></div>';

		echo '<div class="wdp-field wdp-field-toggle"><div class="wdp-field-label">' . esc_html__('İşlem ücreti (cover fee)', 'woo-donation-popup') . '</div><div class="wdp-field-control"><label class="wdp-switch"><input type="checkbox" name="enable_cover_fee" ' . checked($enable_cover_fee, true, false) . '><span class="wdp-slider"></span></label></div></div>';
		echo '<div class="wdp-sub-field"><div class="wdp-sub-field-label">' . esc_html__('Ücret %', 'woo-donation-popup') . '</div><div class="wdp-field-control"><input type="number" name="cover_fee_percent" value="' . esc_attr($cover_fee_percent) . '" min="0" max="15" step="0.1" class="small-text" /></div></div>';

		echo '<div class="wdp-sub-field wdp-sub-field--wide"><div class="wdp-sub-field-label">' . esc_html__('Modül sırası (virgülle)', 'woo-donation-popup') . '</div><div class="wdp-field-control">';
		echo '<input type="text" name="module_order" value="' . esc_attr($module_order) . '" class="wdp-campaign-input" placeholder="media,impact,urgency,social_proof,progress,faq,sadaka,trust" />';
		echo '<p class="description" style="margin:.35em 0 0;">' . esc_html__('Üst kampanya bloklarının sırası (virgülle). Form gövdesi her zaman bağışçı → ithaf → tutar sırasındadır; donor/amount burada değiştirilmez. Boşsa Design Studio varsayılanı kullanılır.', 'woo-donation-popup') . '</p>';
		echo '</div></div>';

		echo '<div class="wdp-sub-field wdp-sub-field--wide"><div class="wdp-sub-field-label">' . esc_html__('Güven rozetleri JSON', 'woo-donation-popup') . '</div><div class="wdp-field-control">';
		echo '<textarea name="trust_badges" rows="2" placeholder="' . esc_attr__('[{"icon":"builtin:shield","text":"SSL"}]', 'woo-donation-popup') . '">' . esc_textarea($trust_badges) . '</textarea>';
		echo '</div></div>';

		echo '</div>'; // .wdp-campaign-fields-grid
		echo '</div>'; // .wdp-field-group-campaign

		echo '</div>'; // .wdp-product-details-grid
		echo '</div>'; // .wdp-field-group-details
		echo '</div>'; // .wdp-product-settings-grid

		echo '<div class="wdp-product-actions">';
		echo '<button type="button" class="button wdp-save-product" data-product-id="' . esc_attr($product->get_id()) . '">' . esc_html__('Kaydet', 'woo-donation-popup') . '</button>';
		echo '<span class="spinner"></span>';
		$stored_total = get_post_meta($product->get_id(), '_wdp_total_donation_amount', true);
		$total_label  = ($stored_total !== '' && is_numeric($stored_total) && class_exists('WDP_Utils'))
			? WDP_Utils::format_price_plain((float) $stored_total)
			: __('henüz hesaplanmadı', 'woo-donation-popup');
		echo '<button type="button" class="button wdp-recalculate-total" data-product-id="' . esc_attr($product->get_id()) . '" title="' . esc_attr__('Ödemesi alınmış tüm siparişleri tarar ve progress bar toplamını yeniden yazar.', 'woo-donation-popup') . '">' . esc_html__('Toplamı yeniden hesapla', 'woo-donation-popup') . '</button>';
		echo '<span class="spinner wdp-recalculate-spinner"></span>';
		echo '<span class="wdp-product-total" aria-live="polite">' . esc_html__('Toplam:', 'woo-donation-popup') . ' <strong class="wdp-product-total__value">' . esc_html($total_label) . '</strong></span>';
		echo '</div>';

		echo '</div>'; // .wdp-product-card
	}
}

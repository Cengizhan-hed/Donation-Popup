<?php
/**
 * Admin settings: single product card row.
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
		$default_sadaka_wc_id = class_exists('WDP_Utils') ? WDP_Utils::get_default_sadaka_wc_product_id() : 10721;
		echo '<input type="number" name="sadaka_wc_product_id" value="' . esc_attr($sadaka_wc_product_id !== '' && $sadaka_wc_product_id !== '0' ? $sadaka_wc_product_id : '') . '" min="1" step="1" class="small-text" placeholder="' . esc_attr((string) $default_sadaka_wc_id) . '">';
		echo '<p class="description">' . esc_html__('Boş bırakırsanız varsayılan WC ürün ID (10721) kullanılır.', 'woo-donation-popup') . '</p>';
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

		echo '</div>';
		echo '</div>';
		echo '</div>';

		echo '<div class="wdp-product-actions">';
		echo '<button type="button" class="button wdp-save-product" data-product-id="' . esc_attr($product->get_id()) . '">' . esc_html__('Kaydet', 'woo-donation-popup') . '</button>';
		echo '<span class="spinner"></span>';
		echo '</div>';

		echo '</div>';
	}
}

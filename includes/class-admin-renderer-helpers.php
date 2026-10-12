<?php
/**
 * Admin formları için ortak aç/kapa sarmalayıcı ve kaydet butonu markup'ı.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Provides shared helper markup for admin renderer classes.
 */
class WDP_Admin_Renderer_Helpers {
	/**
	 * Open form container wrapper.
	 *
	 * @param string $form_id Form id.
	 * @return void
	 */
	public static function open_form_container($form_id) {
		echo '<div class="wdp-button-settings-container"><form id="' . esc_attr($form_id) . '" class="wdp-admin-settings-form" novalidate>';
	}

	/**
	 * Close form container wrapper with submit button.
	 *
	 * @param string $button_id           Button id.
	 * @param bool   $with_inline_message Show inline message span.
	 * @return void
	 */
	public static function close_form_container($button_id, $with_inline_message = false) {
		echo '<p class="submit"><button type="submit" id="' . esc_attr($button_id) . '" class="button button-primary">' . __('Ayarları Kaydet', 'woo-donation-popup') . '</button><span class="spinner"></span>';
		if ($with_inline_message) {
			echo '<span class="wdp-inline-save-message" aria-live="polite"></span>';
		}
		echo '</p></form></div>';
	}

	/**
	 * Open two-column settings + live preview shell.
	 *
	 * @return void
	 */
	public static function open_settings_split() {
		echo '<div class="wdp-admin-settings-split">';
		echo '<div class="wdp-admin-settings-split__fields">';
	}

	/**
	 * Close fields column and open sticky live preview aside.
	 *
	 * @param string $preview_id Aside element id.
	 * @param string $label      Accessible label.
	 * @return void
	 */
	public static function begin_live_preview_aside($preview_id, $label) {
		echo '</div>'; // fields
		echo '<aside class="wdp-admin-live-preview" id="' . esc_attr($preview_id) . '" aria-label="' . esc_attr($label) . '">';
		echo '<div class="wdp-admin-live-preview__badge">' . esc_html__('Canlı önizleme', 'woo-donation-popup') . '</div>';
	}

	/**
	 * Close live preview aside and split shell.
	 *
	 * @return void
	 */
	public static function close_settings_split() {
		echo '</aside></div>';
	}

	/**
	 * Section title + short description (settings forms).
	 *
	 * @param string $title Section title.
	 * @param string $desc  Short description.
	 * @return void
	 */
	public static function render_section_heading($title, $desc = '') {
		echo '<div class="wdp-admin-section-head">';
		echo '<h2 class="wdp-admin-section-head__title">' . esc_html($title) . '</h2>';
		if ($desc !== '') {
			echo '<p class="wdp-admin-section-head__desc">' . esc_html($desc) . '</p>';
		}
		echo '</div>';
	}
}

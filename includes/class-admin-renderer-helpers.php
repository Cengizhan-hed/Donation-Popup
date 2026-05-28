<?php
/**
 * Shared admin renderer helpers.
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
}

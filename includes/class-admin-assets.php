<?php
/**
 * Admin assets manager.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Handles admin enqueue logic for plugin page.
 */
class WDP_Admin_Assets {
	/**
	 * Plugin settings page hook.
	 */
	const PAGE_HOOK = 'woocommerce_page_wdp-popup-settings';

	/**
	 * Enqueue admin assets.
	 *
	 * @param string $hook Current admin page hook.
	 * @return void
	 */
	public static function enqueue($hook) {
		if ($hook !== self::PAGE_HOOK) {
			return;
		}

		wp_enqueue_style('dashicons');
		wp_enqueue_style(
			'wdp-admin-css',
			WDP_PLUGIN_URL . 'assets/css/admin-style.css',
			array(),
			WDP_VERSION
		);

		wp_enqueue_script(
			'wdp-admin-js',
			WDP_PLUGIN_URL . 'assets/js/admin-script.js',
			array('jquery'),
			WDP_VERSION,
			true
		);

		wp_localize_script(
			'wdp-admin-js',
			'wdp_admin',
			array(
				'ajax_url'     => admin_url('admin-ajax.php'),
				'nonce'        => wp_create_nonce('wdp_admin_nonce'),
				'save_success' => __('Ayarlar başarıyla kaydedildi.', 'woo-donation-popup'),
				'save_error'   => __('Ayarlar kaydedilirken bir hata oluştu.', 'woo-donation-popup'),
			)
		);
	}
}

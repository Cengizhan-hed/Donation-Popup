<?php
/**
 * Admin hook registrar.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Registers admin hooks for legacy admin class.
 */
class WDP_Admin_Hooks {
	/**
	 * Register hooks for admin controller.
	 *
	 * @param Woo_Donation_Popup_Admin $admin Admin class instance.
	 * @return void
	 */
	public static function register($admin) {
		add_action('admin_menu', array($admin, 'add_admin_menu'));
		add_action('admin_enqueue_scripts', array($admin, 'enqueue_admin_assets'));

		add_action('wp_ajax_wdp_save_product_settings', array($admin, 'save_product_settings'));
		add_action('wp_ajax_wdp_get_product_settings', array($admin, 'get_product_settings'));
		add_action('wp_ajax_wdp_save_normal_form_settings', array($admin, 'save_normal_form_settings'));
		add_action('wp_ajax_wdp_save_shareholder_form_settings', array($admin, 'save_shareholder_form_settings'));
		add_action('wp_ajax_wdp_save_success_screen_settings', array($admin, 'save_success_screen_settings'));
		add_action('wp_ajax_wdp_save_modal_layout_settings', array($admin, 'save_modal_layout_settings'));
		add_action('wp_ajax_wdp_save_progress_bar_settings', array($admin, 'save_progress_bar_settings'));
		add_action('wp_ajax_wdp_save_meta_tracking_settings', array($admin, 'save_meta_tracking_settings'));
	}
}

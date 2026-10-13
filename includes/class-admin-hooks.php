<?php
/**
 * Admin menüsü, asset enqueue ve ayar kaydetme AJAX eylemlerini bağlar.
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

		WDP_Admin_Product_Data_Tab::register();
		WDP_Admin_Bulk_Actions::init();

		add_action('wp_ajax_wdp_recalculate_product_total', array('WDP_Admin_Product_Settings_Ajax', 'recalculate_total'));
		add_action('wp_ajax_wdp_save_placement_settings', array($admin, 'save_placement_settings'));
		add_action('wp_ajax_wdp_save_advanced_settings', array($admin, 'save_advanced_settings'));
		add_action('wp_ajax_wdp_save_normal_form_settings', array($admin, 'save_normal_form_settings'));
		add_action('wp_ajax_wdp_save_design_studio_settings', array($admin, 'save_design_studio_settings'));
		add_action('wp_ajax_wdp_save_shareholder_form_settings', array($admin, 'save_shareholder_form_settings'));
		add_action('wp_ajax_wdp_save_success_screen_settings', array($admin, 'save_success_screen_settings'));
		add_action('wp_ajax_wdp_save_modal_layout_settings', array($admin, 'save_modal_layout_settings'));
		add_action('wp_ajax_wdp_save_category_colors_settings', array($admin, 'save_category_colors_settings'));
		add_action('wp_ajax_wdp_save_progress_bar_settings', array($admin, 'save_progress_bar_settings'));
		add_action('wp_ajax_wdp_save_meta_tracking_settings', array($admin, 'save_meta_tracking_settings'));
		add_action('wp_ajax_wdp_apply_style_preset', array($admin, 'apply_style_preset'));
		add_action('wp_ajax_wdp_export_style_preset', array($admin, 'export_style_preset'));
		add_action('wp_ajax_wdp_import_style_preset', array($admin, 'import_style_preset'));
	}
}

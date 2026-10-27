<?php
/**
 * WooCommerce ürün düzenleme ekranındaki "Bağış" sekmesi, toplu işlemler ve toplam yeniden hesaplama AJAX'ını bağlar.
 * Eklenti menüsü ve ayar ekranları `src/Admin` altındadır.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers admin hooks for the product data tab.
 */
class WDP_Admin_Hooks {
	/**
	 * Register hooks for admin controller.
	 *
	 * @param Woo_Donation_Popup_Admin $admin Admin class instance.
	 * @return void
	 */
	public static function register( $admin ) {
		add_action( 'admin_enqueue_scripts', array( $admin, 'enqueue_admin_assets' ) );

		WDP_Admin_Product_Data_Tab::register();
		WDP_Admin_Bulk_Actions::init();

		add_action( 'wp_ajax_wdp_recalculate_product_total', array( 'WDP_Admin_Product_Settings_Ajax', 'recalculate_total' ) );
	}
}

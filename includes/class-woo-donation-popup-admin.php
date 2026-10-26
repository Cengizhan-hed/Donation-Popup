<?php
/**
 * Ürün düzenleme ekranındaki "Bağış" sekmesinin yönetici girişi. Eklenti menüsü ve ayar ekranları `src/Admin` altındadır.
 *
 * @package WooCommerce\Donation_Popup
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Woo_Donation_Popup_Admin {
	/**
	 * Constructor
	 */
	public function __construct() {
		WDP_Admin_Hooks::register( $this );
	}

	/**
	 * Ürün düzenleme ekranı varlıkları.
	 *
	 * @param string $hook Geçerli yönetici ekranı.
	 * @return void
	 */
	public function enqueue_admin_assets( $hook ) {
		WDP_Admin_Assets::enqueue( $hook );
	}
}

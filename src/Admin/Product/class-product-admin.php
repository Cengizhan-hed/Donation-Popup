<?php
/**
 * Ürün yönetimi girişi: ürün veri sekmesi, ürün listesi sütunu/toplu işlemleri ve sekmenin varlıkları.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin\Product;

defined( 'ABSPATH' ) || exit;

/**
 * Product_Admin.
 */
final class Product_Admin {

	/**
	 * Tekrar kurulumu önler.
	 *
	 * @var bool
	 */
	private static $booted = false;

	/**
	 * WooCommerce standart kancalarını bağlar (yalnız yönetim alanında çağrılır).
	 *
	 * @return void
	 */
	public static function init() {
		if ( self::$booted ) {
			return;
		}
		self::$booted = true;
		Product_Data_Tab::register();
		Product_List::register();
		Product_Assets::register();
	}
}

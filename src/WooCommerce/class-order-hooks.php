<?php
/**
 * Ödeme sırasında bağış/hisse verisini sipariş satırı meta alanlarına yazar.
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce;

use DonationPanel\Privacy\Order_Privacy;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Order_Hooks
 */
class Order_Hooks {

	/**
	 * Sipariş kancalarını bağlar.
	 *
	 * @return void
	 */
	public static function init() {
		// Sipariş kalemine bağış verisi: tek yazıcı (Donation_Order_Meta), modül açık/kapalı olsun olmasın çalışır.
		( new Donation_Order_Meta() )->register();

		Order_Meta_Keys::init();
		Order_Privacy::init();
	}

	/**
	 * Eski ad (geriye dönük uyum): yazımı tek yazıcıya devreder; aynı anahtar tekrar yazılmaz.
	 *
	 * @param \WC_Order_Item_Product $item          Order item.
	 * @param string                 $cart_item_key Cart item key.
	 * @param array<string, mixed>   $values        Cart item values.
	 * @param \WC_Order|null         $order         Order.
	 * @return void
	 */
	public static function add_donation_meta_to_order( $item, $cart_item_key, $values, $order ) {
		( new Donation_Order_Meta() )->write_item( $item, $cart_item_key, $values, $order );
	}
}

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
	 * Initialize order hooks
	 */
	public static function init() {
		// Sipariş oluşturulurken, bağış verilerini sipariş öğe metalarına ekle
		add_action( 'woocommerce_checkout_create_order_line_item', array( __CLASS__, 'add_donation_meta_to_order' ), 10, 4 );

		Order_Meta_Keys::init();
		Order_Privacy::init();
	}

	/**
	 * Add donation meta to order item
	 *
	 * @param \WC_Order_Item_Product $item         Order item.
	 * @param string                $cart_item_key Cart item key.
	 * @param array<string, mixed>                 $values       Cart item values.
	 * @param \WC_Order              $order        Order.
	 */
	public static function add_donation_meta_to_order( $item, $cart_item_key, $values, $order ) {
		unset( $cart_item_key, $order );
		// Özel fiyat varsa order item meta'ya ekle (progress bar için gerekli)
		if ( isset( $values['custom_price'] ) && $values['custom_price'] > 0 ) {
			$item->add_meta_data( '_custom_price', floatval( $values['custom_price'] ) );
			if ( ! empty( $values['wdp_input_currency'] ) ) {
				$item->add_meta_data( '_wdp_input_currency', strtoupper( sanitize_text_field( (string) $values['wdp_input_currency'] ) ) );
			}
		}

		if ( isset( $values['donation_data'] ) && is_array( $values['donation_data'] ) ) {
			// Dilden bağımsız sabit anahtarlar; etiketler Order_Meta_Keys display filtresiyle gösterilir.
			foreach ( Order_Meta_Keys::build_item_meta( $values['donation_data'] ) as $meta_key => $meta_value ) {
				$item->add_meta_data( $meta_key, $meta_value );
			}
		}
	}
}

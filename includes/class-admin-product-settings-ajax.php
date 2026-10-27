<?php
/**
 * Ürün ilerleme toplamının yeniden hesabını ÖNİZLEYEN (yazmayan) AJAX ucu.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles product settings CRUD endpoints for admin.
 */
class WDP_Admin_Product_Settings_Ajax {
	/**
	 * Preview a product's progress total from paid orders (read-only).
	 *
	 * @return void
	 */
	public static function recalculate_total() {
		try {
			WDP_Admin_Request::guard();

			$product_id = isset( $_POST['product_id'] ) ? absint( wp_unslash( $_POST['product_id'] ) ) : 0;
			if ( ! $product_id ) {
				WDP_Admin_Request::json_error( __( 'Invalid product ID.', 'woo-donation-popup' ), 'invalid_product' );
			}

			$product = wc_get_product( $product_id );
			if ( ! $product ) {
				WDP_Admin_Request::json_error( __( 'Product not found.', 'woo-donation-popup' ), 'not_found', 404 );
			}

			if ( function_exists( 'wc_set_time_limit' ) ) {
				wc_set_time_limit( 0 );
			}

			// 12.0.0: bu uç YAZMAZ. Yalnız önizleme verir; toplamı değiştirmek Kampanyalar ekranında onayla yapılır.
			$preview    = \DonationPanel\Domain\Campaign_Formula::preview( $product_id );
			$shown      = (float) \DonationPanel\Domain\Campaign_Totals::get_total_donation_amount( $product_id );
			$total_text = WDP_Utils::format_price_plain( $shown );

			WDP_Admin_Request::json_success(
				sprintf(
				/* translators: 1: product name, 2: calculated total, 3: order count */
					__( 'Preview for "%1$s": the orders add up to %2$s (%3$d orders). Nothing was changed. To apply it, open Donation Panel > Campaigns.', 'woo-donation-popup' ),
					wp_strip_all_tags( $product->get_name() ),
					WDP_Utils::format_price_plain( (float) $preview['computed'] ),
					(int) $preview['orders']
				),
				array(
					'total'      => $shown,
					'total_text' => $total_text,
					'orders'     => (int) $preview['orders'],
				)
			);
		} catch ( \Throwable $e ) {
			if ( function_exists( 'wdp_debug_log' ) ) {
				wdp_debug_log( 'WDP recalculate: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
			}
			WDP_Admin_Request::json_error( __( 'The total could not be calculated. Details are in the error log.', 'woo-donation-popup' ), 'error', 500 );
		}
	}
}

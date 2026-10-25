<?php
/**
 * Taze nonce üretimi ve benzersiz gönderim anahtarı doğrulaması.
 *
 * @package WooCommerce\Donation_Popup
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

trait WDP_Ajax_Cart_Session_Trait {
	/**
	 * Mevcut oturum için güncel AJAX nonce değerlerini döndürür.
	 *
	 * Sayfa uzun süre açık kaldığında veya başarısız ekleme sonrası yeniden deneme için kullanılır.
	 */
	public static function get_fresh_nonces() {
		try {
			self::require_post_method();
			if ( ! WDP_Security::validate_request_origin( true ) ) {
				throw new WDP_Security_Exception( __( 'Invalid request origin', 'woo-donation-popup' ), 'origin' );
			}

			self::enforce_rate_limit( 'fresh_nonces', 60, 60 );
			self::enforce_capability( 'read' );

			$cart = self::get_wc_cart();
			if ( ! $cart ) {
				throw new WDP_Security_Exception( __( 'No valid cart session was found', 'woo-donation-popup' ) );
			}

			WDP_Utils::json_success(
				array(
					'nonces' => array(
						'ajax_add_to_cart'  => wp_create_nonce( 'wdp_ajax_add_to_cart' ),
						'get_cart_count'    => wp_create_nonce( 'wdp_get_cart_count' ),
						'get_cart_contents' => wp_create_nonce( 'wdp_get_cart_contents' ),
						'remove_cart_item'  => wp_create_nonce( 'wdp_remove_cart_item' ),
						'get_product_info'  => wp_create_nonce( 'wdp_get_product_info' ),
						'render_modal'      => wp_create_nonce( 'wdp_render_modal' ),
					),
				)
			);
		} catch ( WDP_Security_Exception $e ) {
			WDP_Utils::json_error( $e );
		} catch ( Exception $e ) {
			WDP_Utils::handle_exception( $e, true );
		}
	}

	/**
	 * Benzersiz gönderim anahtarının sepette olup olmadığını kontrol eder.
	 *
	 * Ağ kopması sonrası çift ekleme / yanlış hata mesajını önlemek için kullanılır.
	 */
	public static function verify_submission_in_cart() {
		try {
			self::run_secured_ajax( 'wdp_ajax_add_to_cart', 'verify_submission', 40, 60 );

			$key = isset( $_POST['unique_submission_key'] ) ? WDP_Security::sanitize_text( wp_unslash( $_POST['unique_submission_key'] ), 100 ) : '';

			$cart = self::get_wc_cart();
			if ( '' === $key || ! $cart ) {
				WDP_Utils::json_success(
					array(
						'in_cart' => false,
					)
				);
			}

			foreach ( $cart->get_cart() as $cart_item_key => $cart_item ) {
				if ( ! empty( $cart_item['unique_submission_key'] ) && $cart_item['unique_submission_key'] === $key ) {
					self::clear_cart_cache();

					$v_pid = isset( $cart_item['product_id'] ) ? (int) $cart_item['product_id'] : 0;

					WDP_Utils::json_success(
						array(
							'in_cart'        => true,
							'message'        => __( 'Product added to cart.', 'woo-donation-popup' ),
							'cart_count'     => (int) $cart->get_cart_contents_count(),
							'checkout_url'   => wc_get_checkout_url(),
							'items'          => self::get_cart_items(),
							'cart_item_key'  => $cart_item_key,
							'product_id'     => $v_pid,
							'meta_cart_line' => self::build_meta_cart_line_from_cart_item( $cart_item, $v_pid ),
						)
					);
				}
			}

			WDP_Utils::json_success(
				array(
					'in_cart' => false,
				)
			);
		} catch ( WDP_Security_Exception $e ) {
			WDP_Utils::json_error( $e );
		} catch ( Exception $e ) {
			WDP_Utils::handle_exception( $e, true );
		}
	}
}

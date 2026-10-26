<?php
/**
 * REST: `GET /side-cart` — çekmece gövdesini sunucuda çizip döndürür (kalem sayısı, ara toplam, HTML).
 *
 * Sepet değişiklikleri (kaldır, miktar) WooCommerce Store API ile yapılır; bu uç yalnız okur ve yeniden çizer.
 * Yanıt oturumdaki sepete özeldir: `Cache-Control: no-store`, hız sınırlı.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\SideCart;

use DonationPanel\Http\Rest_Controller;

defined( 'ABSPATH' ) || exit;

/**
 * Side_Cart_Controller.
 */
class Side_Cart_Controller extends Rest_Controller {

	/**
	 * Rotaları kaydeder.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			self::REST_NAMESPACE,
			'/side-cart',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'show' ),
				'permission_callback' => array( $this, 'permission_public' ),
			)
		);
	}

	/**
	 * Çekmece gövdesi.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function show() {
		$limited = $this->throttle( 'side_cart', 600 );
		if ( is_wp_error( $limited ) ) {
			return $limited;
		}
		if ( ! function_exists( 'WC' ) || ! WC() ) {
			return $this->error( 'donation_panel_no_woocommerce', 'WooCommerce is not available.', 503 );
		}
		$cart = WC()->cart;
		if ( ! $cart && function_exists( 'wc_load_cart' ) ) {
			wc_load_cart();
			$cart = WC()->cart;
		}
		if ( ! $cart ) {
			return $this->error( 'donation_panel_no_cart', 'Cart is not available.', 503 );
		}

		$lines    = Side_Cart_Lines::from_cart( $cart );
		$subtotal = (string) $cart->get_cart_subtotal();
		$response = rest_ensure_response(
			array(
				'count'    => count( $lines ),
				'subtotal' => $subtotal,
				'sub'      => $lines ? Side_Cart_Renderer::count_text( count( $lines ) ) : '',
				'html'     => Side_Cart_Renderer::body( $lines, $subtotal, function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '', Side_Cart_Suggestion::current( $lines ) ),
			)
		);
		$response->header( 'Cache-Control', 'no-store, private' );
		return $response;
	}
}

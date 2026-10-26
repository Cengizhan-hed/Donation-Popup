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
use DonationPanel\Modules\Experiences\Form_Controller;
use DonationPanel\WooCommerce\Cart;

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
		register_rest_route(
			self::REST_NAMESPACE,
			'/side-cart/suggestion',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'add_suggestion' ),
				'permission_callback' => array( $this, 'permission_public' ),
			)
		);
	}

	/**
	 * Ek bağış önerisini sepete ekler. Ürün ve tutarlar sunucudaki öneriden gelir (istemciden yalnız tutar seçilir);
	 * bağışçı bilgisi (ad, telefon, e-posta) sepetteki mevcut bağış satırından devralınır, yoksa istek reddedilir.
	 *
	 * @param \WP_REST_Request $request Istek (`amount`).
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function add_suggestion( $request ) {
		$limited = $this->throttle( 'side_cart_suggest', 20 );
		if ( is_wp_error( $limited ) ) {
			return $limited;
		}
		if ( ! function_exists( 'WC' ) || ! WC() ) {
			return $this->error( 'donation_panel_no_woocommerce', 'WooCommerce is not available.', 503 );
		}
		if ( null === WC()->cart && function_exists( 'wc_load_cart' ) ) {
			wc_load_cart();
		}
		$cart = WC()->cart;
		if ( ! $cart ) {
			return $this->error( 'donation_panel_no_cart', 'Cart is not available.', 503 );
		}
		$lines      = Side_Cart_Lines::from_cart( $cart );
		$suggestion = Side_Cart_Suggestion::current( $lines );
		$amount     = (float) $request->get_param( 'amount' );
		if ( ! $suggestion || ! in_array( round( $amount, 6 ), $suggestion['amounts'], true ) ) {
			return $this->error( 'donation_panel_suggestion_invalid', 'This suggestion is not available.', 400 );
		}
		$donor = Side_Cart_Suggestion::donor_from_cart( (array) $cart->get_cart() );
		if ( empty( $donor['donation_full_name'] ) || empty( $donor['donation_phone'] ) ) {
			return $this->error( 'donation_panel_suggestion_no_donor', 'Please add this gift from its donation form.', 422 );
		}
		$product_id = (int) $suggestion['product_id'];
		$model      = Form_Controller::model_for_id( $product_id );
		$product    = function_exists( 'wc_get_product' ) ? wc_get_product( $product_id ) : null;
		if ( empty( $model ) || ! is_object( $product ) ) {
			return $this->error( 'donation_panel_product_not_found', 'Donation form not found for this product.', 404 );
		}
		$input  = array_merge(
			$donor,
			array(
				'amount'         => $amount,
				'submission_key' => 'sc-' . wp_generate_password( 12, false ),
			)
		);
		$result = ( new Cart() )->add_item( $cart, $product, $model, $input );
		if ( empty( $result['ok'] ) ) {
			return $this->error( 'donation_panel_cart_rejected', (string) $result['message'], (int) $result['status'] );
		}
		$response = rest_ensure_response(
			array(
				'success'    => true,
				'cart_count' => $result['cart_count'],
			)
		);
		$response->header( 'Cache-Control', 'no-store, private' );
		return $response;
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

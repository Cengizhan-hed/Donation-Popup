<?php
/**
 * REST: `POST /cart/add` (bağışı sepete ekler) ve `GET /nonce` (önbellekten bağımsız taze nonce).
 *
 * - `cart/add` JSON ister (başka site biçimli/form gönderimiyle sepet doldurmasın); girişli kullanıcıda
 *   WordPress çerez kimliği için `X-WP-Nonce` gerekir. Bayat nonce 403 verir; istemci `GET /nonce` ile tazeler.
 * - `nonce` yanıtı `Cache-Control: no-store`; girişli kullanıcı kimliği oturum çerezinden okunur
 *   (başlıksız REST isteği kullanıcıyı çıkış yapmış sayar; `admin-ajax rest-nonce` ile aynı mantık).
 * - Yanıtlar kişi verisi içermez.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Experiences;

use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Http\Rest_Controller;
use DonationPanel\WooCommerce\Cart;

defined( 'ABSPATH' ) || exit;

/**
 * Cart_Controller.
 */
class Cart_Controller extends Rest_Controller {

	/**
	 * Sepet köprüsü.
	 *
	 * @var Cart
	 */
	private $cart_bridge;

	/**
	 * Ürün kimliğinden model: function ( int $id ): array.
	 *
	 * @var callable
	 */
	private $model_provider;

	/**
	 * Ürün kimliğinden ürün: function ( int $id ): object|null.
	 *
	 * @var callable
	 */
	private $product_provider;

	/**
	 * WooCommerce sepeti: function (): object|null.
	 *
	 * @var callable
	 */
	private $cart_provider;

	/**
	 * Kurucu.
	 *
	 * @param Rate_Limiter  $limiter          Hız sınırlayıcı.
	 * @param Cart          $cart_bridge      Sepet köprüsü.
	 * @param callable|null $model_provider   Model üretici.
	 * @param callable|null $product_provider Ürün üretici.
	 * @param callable|null $cart_provider    Sepet üretici.
	 */
	public function __construct( Rate_Limiter $limiter, Cart $cart_bridge, $model_provider = null, $product_provider = null, $cart_provider = null ) {
		parent::__construct( $limiter );
		$this->cart_bridge      = $cart_bridge;
		$this->model_provider   = is_callable( $model_provider ) ? $model_provider : array( Form_Controller::class, 'model_for_id' );
		$this->product_provider = is_callable( $product_provider ) ? $product_provider : array( __CLASS__, 'product_for_id' );
		$this->cart_provider    = is_callable( $cart_provider ) ? $cart_provider : array( __CLASS__, 'woocommerce_cart' );
	}

	/**
	 * Rotaları kaydeder.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			self::REST_NAMESPACE,
			'/cart/add',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'add' ),
				'permission_callback' => array( $this, 'permission_public' ),
			)
		);
		register_rest_route(
			self::REST_NAMESPACE,
			'/nonce',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'nonce' ),
				'permission_callback' => array( $this, 'permission_public' ),
			)
		);
	}

	/**
	 * Bağışı sepete ekler.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function add( $request ) {
		$throttled = $this->throttle( 'experiences_cart_add', 20 );
		if ( is_wp_error( $throttled ) ) {
			return $throttled;
		}
		if ( false === stripos( (string) $request->get_header( 'Content-Type' ), 'application/json' ) ) {
			return $this->error( 'donation_panel_json_required', 'The request must be sent as JSON.', 415 );
		}

		$product_id = absint( $request->get_param( 'product_id' ) );
		if ( $product_id < 1 ) {
			return $this->error( 'donation_panel_product_id_required', 'A product ID is required.', 400 );
		}
		$model   = call_user_func( $this->model_provider, $product_id );
		$product = call_user_func( $this->product_provider, $product_id );
		if ( empty( $model ) || ! is_array( $model ) || ! is_object( $product ) ) {
			return $this->error( 'donation_panel_product_not_found', 'Donation form not found for this product.', 404 );
		}
		$cart = call_user_func( $this->cart_provider );
		if ( ! is_object( $cart ) ) {
			return $this->error( 'donation_panel_cart_unavailable', 'The cart is not available.', 503 );
		}

		$result = $this->cart_bridge->add_item( $cart, $product, $model, $this->input( $request, $model ) );
		if ( empty( $result['ok'] ) ) {
			$data = array( 'errors' => (object) $result['errors'] );
			return $this->error( 'donation_panel_cart_rejected', (string) $result['message'], (int) $result['status'], $data );
		}

		$response = rest_ensure_response(
			array(
				'success'       => true,
				'cart_item_key' => $result['cart_item_key'],
				'cart_count'    => $result['cart_count'],
				'checkout_url'  => function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '',
				'cart_url'      => function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : '',
			)
		);
		return $this->no_store( $response );
	}

	/**
	 * Taze REST nonce (salt okunur; önbelleğe alınmaz).
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function nonce() {
		$throttled = $this->throttle( 'experiences_nonce', 30 );
		if ( is_wp_error( $throttled ) ) {
			return $throttled;
		}
		$this->adopt_cookie_user();
		return $this->no_store( rest_ensure_response( array( 'nonce' => wp_create_nonce( 'wp_rest' ) ) ) );
	}

	/**
	 * Başlıksız REST isteğinde kullanıcı 0'dır; oturum çerezi geçerliyse kimliği o çerezden alır.
	 *
	 * @return void
	 */
	private function adopt_cookie_user() {
		if ( get_current_user_id() > 0 || ! function_exists( 'wp_validate_auth_cookie' ) || ! function_exists( 'wp_set_current_user' ) ) {
			return;
		}
		$user_id = (int) wp_validate_auth_cookie( '', 'logged_in' );
		if ( $user_id > 0 ) {
			wp_set_current_user( $user_id );
		}
	}

	/**
	 * `Cache-Control: no-store` ekler.
	 *
	 * @param mixed $response Yanıt.
	 * @return mixed
	 */
	private function no_store( $response ) {
		if ( is_object( $response ) && method_exists( $response, 'header' ) ) {
			$response->header( 'Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0' );
		}
		return $response;
	}

	/**
	 * İstek girdisi (yalnız tanınan alanlar).
	 *
	 * @param \WP_REST_Request     $request Istek.
	 * @param array<string, mixed> $model   Model.
	 * @return array<string, mixed>
	 */
	private function input( $request, array $model ) {
		$input = array(
			'amount'             => $request->get_param( 'amount' ),
			'quantity'           => $request->get_param( 'quantity' ),
			'share_count'        => $request->get_param( 'share_count' ),
			'shareholders'       => $request->get_param( 'shareholders' ),
			'donation_cover_fee' => $request->get_param( 'donation_cover_fee' ),
			'addon_active'       => $request->get_param( 'addon_active' ),
			'addon_amount'       => $request->get_param( 'addon_amount' ),
			'donation_type'      => $request->get_param( 'donation_type' ),
			'submission_key'     => $request->get_param( 'submission_key' ),
		);
		foreach ( (array) $model['fields'] as $field ) {
			if ( is_array( $field ) && ! empty( $field['name'] ) ) {
				$input[ $field['name'] ] = $request->get_param( (string) $field['name'] );
			}
		}
		return $input;
	}

	/**
	 * Ürünü alır.
	 *
	 * @param int $product_id Ürün.
	 * @return object|null
	 */
	public static function product_for_id( $product_id ) {
		if ( ! function_exists( 'wc_get_product' ) || self::is_hidden_product( (int) $product_id ) ) {
			return null;
		}
		$product = wc_get_product( (int) $product_id );
		return is_object( $product ) && Form_Controller::is_open_donation_product( $product ) ? $product : null;
	}

	/**
	 * WooCommerce sepetini (gerekirse REST isteğinde yükleyerek) verir.
	 *
	 * @return object|null
	 */
	public static function woocommerce_cart() {
		if ( ! function_exists( 'WC' ) || ! WC() ) {
			return null;
		}
		if ( null === WC()->cart && function_exists( 'wc_load_cart' ) ) {
			wc_load_cart();
		}
		return WC()->cart;
	}
}

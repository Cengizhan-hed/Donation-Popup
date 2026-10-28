<?php
/**
 * REST: `POST donation-panel/v1/direct` — doğrudan (sepetsiz) bağış: bekleyen sipariş üretir, ödeme adresini döndürür.
 *
 * - JSON ister; girişli kullanıcıda WordPress çerez kimliği için `X-WP-Nonce` (bayat nonce 403, istemci tazeler).
 * - Hız sınırı: dakikada 30, saatte 300 (IP/hesap başına; ortak IP'deki bağışçılar için cömert; asıl sınır istemci belirteçli bekleyen sipariş sınırıdır); yanıt `Cache-Control: no-store`.
 * - Sepete DOKUNMAZ. Yanıt kişi verisi içermez: yalnız `redirect_url` (order-pay ya da teşekkür), `reused`, `order_status`.
 * - İdempotency `submission_key` ile (Direct_Order_Factory); aynı anahtar ikinci sipariş üretmez.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Http\Rest;

use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Http\Rest_Controller;
use DonationPanel\Modules\Experiences\Cart_Controller;
use DonationPanel\Modules\Experiences\Form_Controller;
use DonationPanel\WooCommerce\Direct\Direct_Order_Factory;
use DonationPanel\WooCommerce\Direct\Direct_Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Direct_Donation_Controller.
 */
class Direct_Donation_Controller extends Rest_Controller {

	/**
	 * Sipariş üreticisi.
	 *
	 * @var Direct_Order_Factory
	 */
	private $factory;

	/**
	 * Kurucu.
	 *
	 * @param Rate_Limiter              $limiter Hız sınırlayıcı.
	 * @param Direct_Order_Factory|null $factory Sipariş üreticisi.
	 */
	public function __construct( Rate_Limiter $limiter, $factory = null ) {
		parent::__construct( $limiter );
		$this->factory = $factory instanceof Direct_Order_Factory ? $factory : new Direct_Order_Factory();
	}

	/**
	 * Rotayı kaydeder.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			self::REST_NAMESPACE,
			'/direct',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'create' ),
				'permission_callback' => array( $this, 'permission_public' ),
			)
		);
	}

	/**
	 * Bağış siparişini başlatır.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function create( $request ) {
		$throttled = $this->throttle( 'direct', 30 );
		if ( is_wp_error( $throttled ) ) {
			return $throttled;
		}
		$throttled = $this->throttle( 'direct_hour', 300, 3600 );
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
		$model   = Form_Controller::model_for_id( $product_id );
		$product = Cart_Controller::product_for_id( $product_id );
		if ( empty( $model ) || ! is_object( $product ) ) {
			return $this->error( 'donation_panel_product_not_found', 'Donation form not found for this product.', 404 );
		}
		if ( ! Direct_Settings::enabled_for( $product ) ) {
			return $this->error( 'donation_panel_direct_disabled', 'Direct donation is not enabled for this product.', 409 );
		}

		$result = $this->factory->submit( $product, $model, $this->input( $request, $model ) );
		if ( empty( $result['ok'] ) || ! $result['order'] instanceof \WC_Order ) {
			$data = array( 'errors' => (object) $result['errors'] );
			return $this->error( '' !== $result['code'] ? $result['code'] : 'donation_panel_direct_failed', (string) $result['message'], (int) $result['status'], $data );
		}

		$order    = $result['order'];
		$response = rest_ensure_response(
			array(
				'success'      => true,
				'reused'       => (bool) $result['reused'],
				'order_status' => $order->get_status(),
				'redirect_url' => $order->needs_payment() ? $order->get_checkout_payment_url() : $order->get_checkout_order_received_url(),
			)
		);
		if ( is_object( $response ) && method_exists( $response, 'header' ) ) {
			$response->header( 'Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0' );
		}
		return $response;
	}

	/**
	 * İstek girdisi (yalnız tanınan alanlar; cart/add ile aynı).
	 *
	 * @param \WP_REST_Request     $request Istek.
	 * @param array<string, mixed> $model   Model.
	 * @return array<string, mixed>
	 */
	private function input( $request, array $model ) {
		$input = array();
		foreach ( array( 'amount', 'quantity', 'share_count', 'shareholders', 'donation_cover_fee', 'addon_active', 'addon_amount', 'donation_type', 'submission_key', 'client_token' ) as $name ) {
			$input[ $name ] = $request->get_param( $name );
		}
		foreach ( (array) $model['fields'] as $field ) {
			if ( is_array( $field ) && ! empty( $field['name'] ) ) {
				$input[ $field['name'] ] = $request->get_param( (string) $field['name'] );
			}
		}
		// Doğrudan akışta ek bağış satırı yok (tek kalemlik sipariş).
		$input['addon_active'] = '';
		return $input;
	}
}

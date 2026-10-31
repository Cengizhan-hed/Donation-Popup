<?php
/**
 * REST: `GET /product/{id}/form` (render parçası + veri; salt okunur) ve `POST /validate` (alan doğrulama).
 *
 * Yanıtlar kişi verisi içermez; doğrulama yanıtı girilen değerleri geri yazmaz.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Experiences;

use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Domain\Product_Context;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Http\Rest_Controller;

defined( 'ABSPATH' ) || exit;

/**
 * Form_Controller.
 */
class Form_Controller extends Rest_Controller {

	/**
	 * Form çıktısı üretici.
	 *
	 * @var Form_Renderer
	 */
	private $renderer;

	/**
	 * Ürün kimliğinden form modeli üretici: function ( int $product_id ): array.
	 *
	 * @var callable
	 */
	private $model_provider;

	/**
	 * Kurucu.
	 *
	 * @param Rate_Limiter  $limiter        Hız sınırlayıcı.
	 * @param Form_Renderer $renderer       Form çıktısı üretici.
	 * @param callable|null $model_provider Model üretici; yoksa WooCommerce ürününden.
	 */
	public function __construct( Rate_Limiter $limiter, Form_Renderer $renderer, $model_provider = null ) {
		parent::__construct( $limiter );
		$this->renderer       = $renderer;
		$this->model_provider = is_callable( $model_provider ) ? $model_provider : array( __CLASS__, 'model_for_id' );
	}

	/**
	 * Rotaları kaydeder.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			self::REST_NAMESPACE,
			'/product(?:/(?P<id>\d+))?/form',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_form' ),
				'permission_callback' => array( $this, 'permission_public' ),
			)
		);
		register_rest_route(
			self::REST_NAMESPACE,
			'/validate',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'validate' ),
				'permission_callback' => array( $this, 'permission_public' ),
			)
		);
	}

	/**
	 * Form parçası + model.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_form( $request ) {
		$throttled = $this->throttle( 'experiences_form', 60 );
		if ( is_wp_error( $throttled ) ) {
			return $throttled;
		}

		$product_id = absint( $request->get_param( 'id' ) );
		if ( $product_id < 1 ) {
			return $this->error( 'donation_panel_product_id_required', 'A product ID is required.', 400 );
		}

		$model = $this->model( $product_id );
		if ( empty( $model ) ) {
			return $this->error( 'donation_panel_product_not_found', 'Donation form not found for this product.', 404 );
		}

		return rest_ensure_response(
			array(
				'product_id' => $product_id,
				'model'      => $model,
				'html'       => $this->renderer->render_form( $model, 'dp-' . $product_id . '-rest' ),
			)
		);
	}

	/**
	 * Alan doğrulama.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function validate( $request ) {
		$nonce = $this->verify_nonce( $request );
		if ( is_wp_error( $nonce ) ) {
			return $nonce;
		}
		$throttled = $this->throttle( 'experiences_validate', 30 );
		if ( is_wp_error( $throttled ) ) {
			return $throttled;
		}

		$product_id = absint( $request->get_param( 'product_id' ) );
		if ( $product_id < 1 ) {
			return $this->error( 'donation_panel_product_id_required', 'A product ID is required.', 400 );
		}
		$model = $this->model( $product_id );
		if ( empty( $model ) ) {
			return $this->error( 'donation_panel_product_not_found', 'Donation form not found for this product.', 404 );
		}

		$input = array();
		foreach ( array( 'amount', 'quantity', 'share_count', 'shareholders', 'addon_active', 'addon_amount' ) as $param ) {
			$input[ $param ] = $request->get_param( $param );
		}
		foreach ( (array) $model['fields'] as $field ) {
			if ( is_array( $field ) && ! empty( $field['name'] ) ) {
				$input[ $field['name'] ] = $request->get_param( (string) $field['name'] );
			}
		}
		$input['donation_type'] = $request->get_param( 'donation_type' );

		return rest_ensure_response( Field_Validator::validate( $model, $input ) );
	}

	/**
	 * Model üretir.
	 *
	 * @param int $product_id Ürün.
	 * @return array<string, mixed>
	 */
	private function model( $product_id ) {
		$model = call_user_func( $this->model_provider, $product_id );
		return is_array( $model ) ? $model : array();
	}

	/**
	 * Varsayılan model üretici.
	 *
	 * @param int $product_id Ürün.
	 * @return array<string, mixed>
	 */
	public static function model_for_id( $product_id ) {
		if ( ! function_exists( 'wc_get_product' ) ) {
			return array();
		}
		if ( self::is_hidden_product( (int) $product_id ) ) {
			return array();
		}
		$product = wc_get_product( (int) $product_id );
		if ( ! $product || ! self::is_open_donation_product( $product ) ) {
			return array();
		}
		return Form_Context::for_product( $product );
	}

	/**
	 * Ürün bağış hattı mı ve tutarı belirlenebilir mi?
	 *
	 * Bağış ürünü değilse (kapsam/işaret/tip) ya da fiyatı 0/boş olup "bağışçı belirler"
	 * (serbest tutar, kampanya) türünde değilse form çizilmez ve sepete eklenmez.
	 *
	 * @param object $product \WC_Product.
	 * @return bool
	 */
	public static function is_open_donation_product( $product ) {
		if ( ! Donation_Scope::is_donation_product( $product ) ) {
			return false;
		}
		$context = Product_Context::build_form_context( $product );
		$price   = isset( $context['product_price'] ) && is_numeric( $context['product_price'] ) ? (float) $context['product_price'] : 0.0;
		return $price > 0 || ! empty( $context['allow_custom_price'] );
	}
}

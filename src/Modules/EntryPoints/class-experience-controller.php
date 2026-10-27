<?php
/**
 * REST: `GET /experience/{id}?kind=popup|side_panel|bottom_sheet` — bir ürünün bağış formunu (kap + form) döndürür.
 *
 * Bağış listesi ve döngü/arşiv kartları formu sayfa yüklenirken basmaz; kullanıcı düğmeye basınca bu uçtan alır.
 * Salt okunur: sipariş/sepet yazmaz, kişi verisi döndürmez. Hız sınırlıdır; yanıt önbelleğe alınmaz (nonce taze).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Http\Rest_Controller;
use DonationPanel\Modules\Experiences\Experience_Container;
use DonationPanel\Modules\Experiences\Form_Controller;
use DonationPanel\Modules\Experiences\Form_Renderer;

defined( 'ABSPATH' ) || exit;

/**
 * Experience_Controller.
 */
class Experience_Controller extends Rest_Controller {

	/**
	 * Form çıktısı üretici.
	 *
	 * @var Form_Renderer
	 */
	private $renderer;

	/**
	 * Kurucu.
	 *
	 * @param Rate_Limiter  $limiter  Hız sınırlayıcı.
	 * @param Form_Renderer $renderer Form çıktısı üretici.
	 */
	public function __construct( Rate_Limiter $limiter, Form_Renderer $renderer ) {
		parent::__construct( $limiter );
		$this->renderer = $renderer;
	}

	/**
	 * Rotayı kaydeder.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			self::REST_NAMESPACE,
			'/experience/(?P<id>\d+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_experience' ),
				'permission_callback' => array( $this, 'permission_public' ),
				'args'                => array(
					'kind' => array(
						'type'              => 'string',
						'default'           => 'popup',
						'sanitize_callback' => 'sanitize_key',
					),
				),
			)
		);
	}

	/**
	 * Kap + form HTML'i.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_experience( $request ) {
		$throttled = $this->throttle( 'entry_experience', 60 );
		if ( is_wp_error( $throttled ) ) {
			return $throttled;
		}

		$product_id = absint( $request->get_param( 'id' ) );
		$model      = Form_Controller::model_for_id( $product_id );
		if ( $product_id < 1 || empty( $model ) ) {
			return $this->error( 'donation_panel_product_not_found', 'Donation form not found for this product.', 404 );
		}

		$kind = (string) $request->get_param( 'kind' );
		if ( ! in_array( $kind, array( 'popup', 'side_panel', 'bottom_sheet' ), true ) ) {
			$kind = 'popup';
		}
		// Katman olmayan kap (sayfa içi) bu uçtan istenmez.
		if ( ! Experience_Container::make( $kind )->is_layer() ) {
			$kind = 'popup';
		}

		$html = $this->renderer->render(
			$model,
			$kind,
			array(
				'rest_url'     => esc_url_raw( rest_url( 'donation-panel/v1/' ) ),
				'nonce'        => wp_create_nonce( 'wp_rest' ),
				'checkout_url' => function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '',
			)
		);
		if ( '' === $html ) {
			return $this->error( 'donation_panel_product_not_found', 'Donation form not found for this product.', 404 );
		}

		$response = rest_ensure_response(
			array(
				'product_id' => $product_id,
				'kind'       => $kind,
				'html'       => $html,
			)
		);
		$response->header( 'Cache-Control', 'no-store, private' );
		return $response;
	}
}

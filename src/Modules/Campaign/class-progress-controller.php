<?php
/**
 * REST: `GET donation-panel/v1/progress/{id}` — salt okunur, önbellekli, kişisel veri yok.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Campaign;

use DonationPanel\Http\Rest_Controller;

defined( 'ABSPATH' ) || exit;

/**
 * Progress_Controller.
 */
class Progress_Controller extends Rest_Controller {

	/**
	 * Rotayı kaydeder.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			self::REST_NAMESPACE,
			'/progress/(?P<id>\d+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_progress' ),
				'permission_callback' => array( $this, 'permission_public' ),
			)
		);
	}

	/**
	 * Yanıt.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_progress( $request ) {
		$throttled = $this->throttle( 'campaign_progress', 120 );
		if ( is_wp_error( $throttled ) ) {
			return $throttled;
		}
		$data = Progress_Data::for_product( absint( $request->get_param( 'id' ) ) );
		if ( null === $data ) {
			return $this->error( 'donation_panel_no_campaign', 'No campaign found for this product.', 404 );
		}
		$response = rest_ensure_response( $data );
		if ( is_object( $response ) && method_exists( $response, 'header' ) ) {
			$response->header( 'Cache-Control', 'public, max-age=' . Progress_Data::CACHE_TTL );
		}
		return $response;
	}
}

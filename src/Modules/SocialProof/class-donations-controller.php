<?php
/**
 * REST: `GET donation-panel/v1/donations` (sayfalı) ve `GET donation-panel/v1/donations/stats` (toplu sayılar).
 *
 * Yalnız ad izni verenlerin ad + soyad baş harfi; başka kişi verisi yok.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\SocialProof;

use DonationPanel\Http\Rest_Controller;

defined( 'ABSPATH' ) || exit;

/**
 * Donations_Controller.
 */
class Donations_Controller extends Rest_Controller {

	/**
	 * Rotaları kaydeder.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			self::REST_NAMESPACE,
			'/donations',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_donations' ),
				'permission_callback' => array( $this, 'permission_public' ),
			)
		);
		register_rest_route(
			self::REST_NAMESPACE,
			'/donations/stats',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_stats' ),
				'permission_callback' => array( $this, 'permission_public' ),
			)
		);
	}

	/**
	 * Sayfalı liste.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_donations( $request ) {
		$throttled = $this->throttle( 'social_donations', 60 );
		if ( is_wp_error( $throttled ) ) {
			return $throttled;
		}
		if ( self::is_unavailable_product( absint( $request->get_param( 'product_id' ) ), true ) ) {
			return $this->error( 'donation_panel_product_not_found', 'Product not found.', 404 );
		}
		return $this->cached(
			rest_ensure_response(
				Donation_Feed::page(
					absint( $request->get_param( 'product_id' ) ),
					absint( $request->get_param( 'page' ) ),
					Donation_Feed::clamp_per_page( $request->get_param( 'per_page' ) )
				)
			)
		);
	}

	/**
	 * Toplu sayılar.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_stats( $request ) {
		$throttled = $this->throttle( 'social_stats', 60 );
		if ( is_wp_error( $throttled ) ) {
			return $throttled;
		}
		if ( self::is_unavailable_product( absint( $request->get_param( 'product_id' ) ), true ) ) {
			return $this->error( 'donation_panel_product_not_found', 'Product not found.', 404 );
		}
		return $this->cached( rest_ensure_response( Donation_Feed::stats( absint( $request->get_param( 'product_id' ) ) ) ) );
	}

	/**
	 * Kısa süreli ortak önbellek başlığı.
	 *
	 * @param mixed $response Yanıt.
	 * @return mixed
	 */
	private function cached( $response ) {
		if ( is_object( $response ) && method_exists( $response, 'header' ) ) {
			$response->header( 'Cache-Control', 'public, max-age=60' );
		}
		return $response;
	}
}

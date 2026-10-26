<?php
/**
 * GET donation-panel/v1/modal: liste/döngü bağış formunun HTML'i (herkese açık, salt okunur, nonce gerektirmez).
 *
 * Yalnız yayında, görünür bağış ürünleri; kişi verisi yok. Tam sayfa önbelleğinde süresi geçen nonce
 * sorununu ortadan kaldırır. İstek sınırı ve ürün doğrulaması AJAX yoluyla aynıdır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Http\Rest;

use DonationPanel\Http\Rest_Controller;

defined( 'ABSPATH' ) || exit;

/**
 * Modal_Controller.
 */
class Modal_Controller extends Rest_Controller {

	/**
	 * Rotayı kaydeder.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			self::REST_NAMESPACE,
			'/modal',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'handle' ),
				'permission_callback' => array( $this, 'permission_public' ),
				'args'                => array(
					'product_id' => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
					'mode'       => array(
						'type'    => 'string',
						'default' => 'popup',
						'enum'    => array( 'popup', 'side_panel' ),
					),
				),
			)
		);
	}

	/**
	 * Yanıt.
	 *
	 * @param \WP_REST_Request $request İstek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function handle( $request ) {
		$throttled = $this->throttle( 'modal', 60 );
		if ( is_wp_error( $throttled ) ) {
			return $throttled;
		}
		if ( ! class_exists( 'WDP_Lazy_Modal' ) ) {
			return $this->error( 'donation_panel_unavailable', 'Unavailable.', 503 );
		}

		$result = \WDP_Lazy_Modal::build( absint( $request->get_param( 'product_id' ) ), (string) $request->get_param( 'mode' ) );
		if ( ! isset( $result['html'] ) ) {
			return $this->error( 'donation_panel_modal_unavailable', (string) $result['message'], (int) $result['status'] );
		}

		$response = rest_ensure_response(
			array(
				'html'       => $result['html'],
				'product_id' => absint( $request->get_param( 'product_id' ) ),
			)
		);
		$response->header( 'Cache-Control', 'no-store, private' );
		return $response;
	}
}

<?php
/**
 * REST: `GET donation-panel/v1/impact/{id}` — kademeler + hazır tutar ifadeleri (kişi verisi yok).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Impact;

use DonationPanel\Core\Settings;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Http\Rest_Controller;
use DonationPanel\Modules\Experiences\Form_Context;

defined( 'ABSPATH' ) || exit;

/**
 * Impact_Controller.
 */
class Impact_Controller extends Rest_Controller {

	/**
	 * Ayarlar.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Kurucu.
	 *
	 * @param Rate_Limiter $limiter  Hız sınırlayıcı.
	 * @param Settings     $settings Ayarlar.
	 */
	public function __construct( Rate_Limiter $limiter, Settings $settings ) {
		parent::__construct( $limiter );
		$this->settings = $settings;
	}

	/**
	 * Rotayı kaydeder.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			self::REST_NAMESPACE,
			'/impact/(?P<id>\d+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_impact' ),
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
	public function get_impact( $request ) {
		$throttled = $this->throttle( 'impact', 120 );
		if ( is_wp_error( $throttled ) ) {
			return $throttled;
		}
		$product_id = absint( $request->get_param( 'id' ) );
		$tiers      = Impact_Map::tiers_for_product( $product_id, (string) $this->settings->get( 'impact.map', '' ) );
		if ( $product_id < 1 || ! $tiers || self::is_hidden_product( $product_id ) ) {
			return $this->error( 'donation_panel_no_impact', 'No impact phrases for this product.', 404 );
		}

		$presets = array();
		if ( class_exists( Form_Context::class ) && function_exists( 'wc_get_product' ) ) {
			$product = wc_get_product( $product_id );
			$model   = $product ? Form_Context::for_product( $product ) : array();
			$presets = isset( $model['presets'] ) ? (array) $model['presets'] : array();
		}

		return rest_ensure_response(
			array(
				'product_id' => $product_id,
				'tiers'      => $tiers,
				'presets'    => Impact_Map::for_amounts( array_map( 'floatval', $presets ), $tiers ),
			)
		);
	}
}

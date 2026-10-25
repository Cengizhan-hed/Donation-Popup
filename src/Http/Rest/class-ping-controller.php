<?php
/**
 * GET donation-panel/v1/ping: yalnız sürüm + modül listesi (kişisel veri yok).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Http\Rest;

use DonationPanel\Core\Module_Registry;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Http\Rest_Controller;

defined( 'ABSPATH' ) || exit;

/**
 * Ping_Controller.
 */
class Ping_Controller extends Rest_Controller {

	/**
	 * Modül kayıt defteri.
	 *
	 * @var Module_Registry
	 */
	private $registry;

	/**
	 * Kurucu.
	 *
	 * @param Rate_Limiter    $limiter  Hız sınırlayıcı.
	 * @param Module_Registry $registry Modül kayıt defteri.
	 */
	public function __construct( Rate_Limiter $limiter, Module_Registry $registry ) {
		parent::__construct( $limiter );
		$this->registry = $registry;
	}

	/**
	 * Rotayı kaydeder.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			self::REST_NAMESPACE,
			'/ping',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'handle' ),
				'permission_callback' => array( $this, 'permission_public' ),
			)
		);
	}

	/**
	 * Yanıt.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function handle() {
		$throttled = $this->throttle( 'ping', 120 );
		if ( is_wp_error( $throttled ) ) {
			return $throttled;
		}

		return rest_ensure_response( self::payload( $this->registry ) );
	}

	/**
	 * Yanıt gövdesi (saf; test edilebilir).
	 *
	 * @param Module_Registry $registry Modül kayıt defteri.
	 * @return array{version: string, modules: array<int, array{slug: string, enabled: bool}>}
	 */
	public static function payload( Module_Registry $registry ) {
		return array(
			'version' => defined( 'WDP_VERSION' ) ? (string) WDP_VERSION : '',
			'modules' => $registry->summary(),
		);
	}
}

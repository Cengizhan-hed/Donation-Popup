<?php
/**
 * Yönetici REST uçları: ayar kaydı (modül anahtarları dahil), sihirbaz ilerlemesi, ayar dışa/içe aktarma.
 *
 * Tümü `manage_woocommerce` yetkisi + REST nonce (X-WP-Nonce) ister; yazma uçları ayrıca hız sınırlıdır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

use DonationPanel\Core\Settings;
use DonationPanel\Http\Rest_Controller;

defined( 'ABSPATH' ) || exit;

/**
 * Admin_Controller.
 */
final class Admin_Controller extends Rest_Controller {

	/**
	 * Ayar deposu.
	 *
	 * @var Settings_Store
	 */
	private $store;

	/**
	 * Ayarlar.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Kurucu.
	 *
	 * @param \DonationPanel\Http\Rate_Limiter $limiter  Hız sınırlayıcı.
	 * @param Settings                         $settings Ayarlar.
	 * @param Settings_Store                   $store    Ayar deposu.
	 */
	public function __construct( $limiter, Settings $settings, Settings_Store $store ) {
		parent::__construct( $limiter );
		$this->settings = $settings;
		$this->store    = $store;
	}

	/**
	 * Rotalar.
	 *
	 * @return void
	 */
	public function register_routes() {
		$permission = $this->permission_for( Admin_Bootstrap::CAPABILITY );

		register_rest_route(
			self::REST_NAMESPACE,
			'/admin/settings',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'save_settings' ),
				'permission_callback' => $permission,
			)
		);
		register_rest_route(
			self::REST_NAMESPACE,
			'/admin/wizard',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'save_wizard' ),
				'permission_callback' => $permission,
			)
		);
		register_rest_route(
			self::REST_NAMESPACE,
			'/admin/export',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'export_settings' ),
				'permission_callback' => $permission,
			)
		);
		register_rest_route(
			self::REST_NAMESPACE,
			'/admin/import',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'import_settings' ),
				'permission_callback' => $permission,
			)
		);
	}

	/**
	 * Ortak denetimler: nonce + hız sınırı.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return true|\WP_Error
	 */
	private function guard( $request ) {
		$nonce = $this->verify_nonce( $request );
		if ( is_wp_error( $nonce ) ) {
			return $nonce;
		}
		$limit = $this->throttle( 'admin_write', 60 );
		return is_wp_error( $limit ) ? $limit : true;
	}

	/**
	 * POST /admin/settings { fields: {id: value}, modules: {slug: bool} }.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function save_settings( $request ) {
		$guard = $this->guard( $request );
		if ( is_wp_error( $guard ) ) {
			return $guard;
		}
		$fields  = $request->get_param( 'fields' );
		$modules = $request->get_param( 'modules' );
		$saved   = $this->store->save( is_array( $fields ) ? $fields : array(), is_array( $modules ) ? $modules : array() );
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}
		return rest_ensure_response(
			array(
				'saved'    => array_keys( $saved ),
				'progress' => ( new Status( $this->settings ) )->progress(),
			)
		);
	}

	/**
	 * POST /admin/wizard { step, result: ''|done|skipped, fields, modules }: her adımda ilerleme kalıcı yazılır.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function save_wizard( $request ) {
		$guard = $this->guard( $request );
		if ( is_wp_error( $guard ) ) {
			return $guard;
		}
		$fields  = $request->get_param( 'fields' );
		$modules = $request->get_param( 'modules' );
		$saved   = $this->store->save( is_array( $fields ) ? $fields : array(), is_array( $modules ) ? $modules : array() );
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}
		$result = sanitize_key( (string) $request->get_param( 'result' ) );
		$step   = max( 1, min( Setup_Wizard::STEP_COUNT, absint( $request->get_param( 'step' ) ) ) );
		$admin  = array( 'wizard_step' => $step );
		if ( 'done' === $result || 'skipped' === $result ) {
			$admin['wizard'] = $result;
		}
		$this->settings->update( array( 'admin' => $admin ) );
		return rest_ensure_response(
			array(
				'step'   => $step,
				'result' => $result,
			)
		);
	}

	/**
	 * GET /admin/export: yalnız eklenti ayarları (kişi verisi, sipariş ya da ürün verisi yok).
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response
	 */
	public function export_settings( $request ) {
		unset( $request );
		$all = $this->settings->all();
		unset( $all['admin'] );
		return rest_ensure_response(
			array(
				'plugin'   => 'donation-panel',
				'schema'   => Settings::SCHEMA_VERSION,
				'settings' => $all,
			)
		);
	}

	/**
	 * POST /admin/import { settings: {...} }: yalnız şemadaki anahtarlar, tipleri zorlanarak içe alınır.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function import_settings( $request ) {
		$guard = $this->guard( $request );
		if ( is_wp_error( $guard ) ) {
			return $guard;
		}
		$incoming = $request->get_param( 'settings' );
		if ( ! is_array( $incoming ) ) {
			return $this->error( 'donation_panel_bad_import', __( 'The file does not look like a Donation Panel settings export.', 'woo-donation-popup' ), 400 );
		}
		unset( $incoming['admin'], $incoming['version'] );
		$normalized = Settings::normalize( $incoming );
		$patch      = array();
		foreach ( array_keys( Settings::schema() ) as $group ) {
			if ( 'admin' === $group || ! isset( $incoming[ $group ] ) || ! is_array( $incoming[ $group ] ) ) {
				continue;
			}
			foreach ( array_keys( $incoming[ $group ] ) as $key ) {
				if ( isset( $normalized[ $group ][ $key ] ) || array_key_exists( $key, $normalized[ $group ] ) ) {
					$patch[ $group ][ $key ] = $normalized[ $group ][ $key ];
				}
			}
		}
		if ( isset( $incoming['modules'] ) && is_array( $incoming['modules'] ) ) {
			$allowed = Settings_Store::module_definitions();
			foreach ( $incoming['modules'] as $slug => $state ) {
				if ( isset( $allowed[ sanitize_key( (string) $slug ) ] ) ) {
					$patch['modules'][ sanitize_key( (string) $slug ) ] = (bool) $state;
				}
			}
		}
		$this->settings->update( $patch );
		$ids = array();
		foreach ( array_keys( Field_Registry::fields() ) as $id ) {
			list( $group, $key ) = explode( '.', $id, 2 );
			if ( isset( $patch[ $group ] ) && array_key_exists( $key, $patch[ $group ] ) ) {
				$ids[] = $id;
			}
		}
		$this->store->mirror( $ids );
		return rest_ensure_response( array( 'imported' => array_keys( $patch ) ) );
	}
}

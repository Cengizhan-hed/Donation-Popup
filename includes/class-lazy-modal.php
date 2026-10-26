<?php
/**
 * Liste ve döngü butonları için gecikmeli modal HTML (AJAX wdp_render_modal).
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Lazy-loads donation modal markup for loop/list CTAs.
 */
class WDP_Lazy_Modal {

	/**
	 * @return void
	 */
	public static function init() {
		add_action( 'wp_ajax_wdp_render_modal', array( __CLASS__, 'ajax_render' ) );
		add_action( 'wp_ajax_nopriv_wdp_render_modal', array( __CLASS__, 'ajax_render' ) );
		// Önbellek dostu, nonce gerektirmeyen salt okunur yol (REST GET /donation-panel/v1/modal).
		add_filter( 'donation_panel_rest_controllers', array( __CLASS__, 'add_rest_controller' ) );
	}

	/**
	 * REST denetleyici listesine genel okuma uç noktasını ekler.
	 *
	 * @param mixed $controllers Denetleyici listesi.
	 * @return mixed
	 */
	public static function add_rest_controller( $controllers ) {
		if ( is_array( $controllers ) && class_exists( '\\DonationPanel\\Http\\Rest\\Modal_Controller' ) ) {
			$controllers[] = new \DonationPanel\Http\Rest\Modal_Controller( new \DonationPanel\Http\Rate_Limiter() );
		}
		return $controllers;
	}

	/**
	 * Modal HTML'ini üretir (AJAX ve REST ortak; yalnız herkese açık bağış ürünleri).
	 *
	 * @param int    $product_id Ürün.
	 * @param string $mode       popup|side_panel.
	 * @return array{html?: string, message?: string, status?: int}
	 */
	public static function build( $product_id, $mode ) {
		$product_id = absint( $product_id );
		$mode       = 'side_panel' === $mode ? 'side_panel' : 'popup';

		$product = null;
		if ( ! WDP_Security::validate_product_id( $product_id, $product ) || ! $product ) {
			return array(
				'message' => __( 'Product not found or cannot be displayed.', 'woo-donation-popup' ),
				'status'  => 404,
			);
		}
		if ( ! WDP_Donation_Scope::is_donation_product( $product ) ) {
			return array(
				'message' => __( 'This product is not marked as a donation product.', 'woo-donation-popup' ),
				'status'  => 403,
			);
		}

		$html = WDP_Templates::render_donation_modal( $product_id, '', '', '', $mode );
		if ( ! is_string( $html ) || '' === $html ) {
			return array(
				'message' => __( 'The donation form cannot be shown right now.', 'woo-donation-popup' ),
				'status'  => 500,
			);
		}
		return array( 'html' => $html );
	}

	/**
	 * @return void
	 */
	public static function ajax_render() {
		// Güvenlik kapıları try dışında: kendi yanıtını gönderip çıkar.
		if ( ! WDP_Security::validate_request_origin() ) {
			wp_send_json_error( array( 'message' => __( 'Invalid request origin', 'woo-donation-popup' ) ), 403 );
		}
		// Nonce (Faz 8): tam sayfa önbelleğinde süresi geçen nonce 403 + `code: nonce` döner; istemci
		// (assets/js/src/lazy-modal.js) yeni nonce alıp bir kez yeniden dener. Nonce'suz, önbellek dostu
		// okuma için REST GET /donation-panel/v1/modal vardır. Süzgeç yalnız geriye dönük uyum içindir.
		if ( (bool) apply_filters( 'wdp_render_modal_require_nonce', true ) && ! check_ajax_referer( 'wdp_render_modal', 'security', false ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Security check failed. Please refresh and try again.', 'woo-donation-popup' ),
					'code'    => 'nonce',
				),
				403
			);
		}
		if ( ! WDP_Security::check_action_rate_limit( 'render_modal', 60, 60, true ) ) {
			if ( ! headers_sent() ) {
				header( 'Retry-After: 60', true );
			}
			wp_send_json_error(
				array(
					'message'     => __( 'Too many requests were sent. Please try again shortly.', 'woo-donation-popup' ),
					'code'        => 'rate_limit',
					'retry_after' => 60,
				),
				429
			);
		}

		$product_id = isset( $_REQUEST['product_id'] ) ? absint( wp_unslash( $_REQUEST['product_id'] ) ) : 0;
		$mode       = isset( $_REQUEST['mode'] ) ? sanitize_key( wp_unslash( $_REQUEST['mode'] ) ) : 'popup';

		try {
			$result = self::build( $product_id, $mode );
		} catch ( \Throwable $e ) {
			if ( function_exists( 'wdp_debug_log' ) ) {
				wdp_debug_log( 'WDP lazy modal: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
			}
			$result = array(
				'message' => __( 'The donation form cannot be shown right now.', 'woo-donation-popup' ),
				'status'  => 500,
			);
		}

		if ( isset( $result['html'] ) ) {
			wp_send_json_success(
				array(
					'html'       => $result['html'],
					'product_id' => $product_id,
					'mode'       => 'side_panel' === $mode ? 'side_panel' : 'popup',
				)
			);
		}
		wp_send_json_error( array( 'message' => (string) $result['message'] ), (int) $result['status'] );
	}
}

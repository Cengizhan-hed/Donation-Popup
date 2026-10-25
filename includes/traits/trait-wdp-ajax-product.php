<?php
/**
 * get_product_info AJAX; önbellekli ürün meta ve addon blok verisi.
 *
 * @package WooCommerce\Donation_Popup
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit; }

trait WDP_Ajax_Product_Trait {
	/**
	 * POST/istek gövdesinden ürün ID (0 = eksik/geçersiz).
	 *
	 * @param mixed $raw Ham product_id.
	 * @return int
	 */
	public static function parse_product_info_id( $raw ) {
		return absint( wp_unslash( $raw ) );
	}

	/**
	 * get_product_info için ürün: yayımlı (veya düzenlenebilir) yeterli.
	 * Katalog gizliliği / is_visible bu uçta formu düşürmez (döngü/kısa kod).
	 *
	 * @param int             $product_id  Ürün ID.
	 * @param WC_Product|null $product_out Çözülen ürün.
	 * @return bool
	 */
	public static function resolve_product_for_info( $product_id, &$product_out = null ) {
		$product_id  = absint( $product_id );
		$product_out = null;
		if ( $product_id <= 0 ) {
			return false;
		}

		$product = function_exists( 'wc_get_product' ) ? wc_get_product( $product_id ) : null;
		if ( ! $product ) {
			return false;
		}

		if ( function_exists( 'current_user_can' ) && current_user_can( 'edit_post', $product_id ) ) {
			$product_out = $product;
			return true;
		}

		$status = method_exists( $product, 'get_status' ) ? (string) $product->get_status() : '';
		if ( $status !== 'publish' ) {
			return false;
		}

		$password = '';
		if ( method_exists( $product, 'get_post_password' ) ) {
			$password = (string) $product->get_post_password();
		}
		if ( $password !== '' ) {
			return false;
		}

		$product_out = $product;
		return true;
	}

	/** Ürün meta verilerini önbellekleyerek ön yüze JSON döndürür. */
	public static function get_product_info() {
		try {
			self::run_secured_ajax( 'wdp_get_product_info', 'get_product_info', 60, 60, false );

			$product_id = isset( $_POST['product_id'] ) ? self::parse_product_info_id( $_POST['product_id'] ) : 0;

			if ( ! $product_id ) {
				wp_send_json_error(
					array( 'message' => __( 'Invalid product ID', 'woo-donation-popup' ) ),
					400
				);
			}

			$product = null;
			if ( ! self::resolve_product_for_info( $product_id, $product ) || ! $product ) {
				wp_send_json_error(
					array( 'message' => __( 'Invalid product ID', 'woo-donation-popup' ) ),
					400
				);
			}

			// PERFORMANCE: Use object cache if available (faster than transient)
			$cache_key   = 'wdp_product_info_' . $product_id;
			$cached_data = wp_cache_get( $cache_key, 'wdp_product_info' );

			if ( false === $cached_data ) {
				// Fallback to transient if object cache not available
				$cached_data = get_transient( $cache_key );
			}

			if ( false !== $cached_data ) {
				// Use cached data
				$allow_custom_price    = $cached_data['allow_custom_price'];
				$min_price             = $cached_data['min_price'];
				$allow_multiple_shares = $cached_data['allow_multiple_shares'];
				$max_shares            = $cached_data['max_shares'];
				$enable_progress_bar   = ! empty( $cached_data['enable_progress_bar'] );
				$enable_addon_donation = ! empty( $cached_data['enable_sadaka_donation'] );
			} else {
				// PERFORMANCE: Read only required keys (avoids hydrating full meta collection).
				$allow_custom_price    = $product->get_meta( '_allow_custom_price' ) === 'yes';
				$min_price             = $product->get_meta( '_min_custom_price' );
				$allow_multiple_shares = $product->get_meta( '_allow_multiple_shares' ) === 'yes';
				$max_shares            = $product->get_meta( '_max_shares' );
				$enable_progress_bar   = $product->get_meta( '_enable_progress_bar' ) === 'yes';
				$enable_addon_donation = WDP_Addon_Product_Visibility::get_meta( $product, '_enable_addon_donation' ) === 'yes';

				$cache_data = array(
					'allow_custom_price'     => $allow_custom_price,
					'min_price'              => $min_price,
					'allow_multiple_shares'  => $allow_multiple_shares,
					'max_shares'             => $max_shares,
					'enable_progress_bar'    => $enable_progress_bar,
					'enable_sadaka_donation' => $enable_addon_donation,
				);

				// PERFORMANCE: Cache in both object cache and transient (fallback)
				wp_cache_set( $cache_key, $cache_data, 'wdp_product_info', HOUR_IN_SECONDS );
				set_transient( $cache_key, $cache_data, HOUR_IN_SECONDS );
			}

			if ( $enable_progress_bar ) {
				$allow_custom_price = true;
			}

			if ( $allow_custom_price && '' === $min_price ) {
				$min_price = '0';
			}

			$progress_min_price = $min_price;
			if ( $enable_progress_bar ) {
				$progress_min_price = ( $min_price !== '' && (float) $min_price > 0 ) ? (string) $min_price : '0';
				if ( (float) $progress_min_price > 0 ) {
					$min_price = $progress_min_price;
				}
			}

			if ( $allow_multiple_shares && '' === $max_shares ) {
				$max_shares = '7';
			}

			$show_addon_donation = $enable_addon_donation && ! $enable_progress_bar;
			$addon_block_html    = '';
			if ( $show_addon_donation && class_exists( 'WDP_Donation_Product_Context_Service' ) && class_exists( 'WDP_Templates' ) ) {
				$addon_context    = WDP_Donation_Product_Context_Service::build_form_context( $product );
				$addon_block_html = WDP_Templates::render_addon_donation_block( $addon_context );
			}
			// Yalnızca gerçek UI (toggle) varsa etkin say; yalnızca admin uyarısı ise kapalı.
			$addon_ui_ready = $addon_block_html !== '' && strpos( $addon_block_html, 'data-wdp-sadaka-donation' ) !== false;

			$raw_price           = $product->get_price();
			$min_for_placeholder = $enable_progress_bar ? $progress_min_price : $min_price;
			$response            = array(
				'product_name'             => $product->get_name(),
				'is_custom_price'          => $allow_custom_price,
				'min_price'                => $min_price,
				'progress_min_price'       => $progress_min_price,
				'custom_price_placeholder' => ( (float) $min_for_placeholder > 0 )
					? WDP_Utils::format_min_placeholder( $min_for_placeholder )
					: '',
				'enable_progress_bar'      => $enable_progress_bar,
				'regular_price'            => $product->get_regular_price(),
				'price'                    => $raw_price,
				'price_html'               => ( $raw_price !== '' && $raw_price !== null ) ? WDP_Utils::format_price_html( $raw_price ) : '',
				'is_multiple_shares'       => $allow_multiple_shares,
				'max_shares'               => $max_shares,
				'enable_sadaka_donation'   => $addon_ui_ready,
				'sadaka_block_html'        => $addon_ui_ready ? $addon_block_html : '',
			);

			WDP_Utils::log(
				array(
					'event'    => 'get_product_info',
					'response' => $response,
				)
			);
			WDP_Utils::json_success( $response );
		} catch ( WDP_Exception $e ) {
			WDP_Utils::json_error( $e );
		} catch ( Exception $e ) {
			WDP_Utils::handle_exception( $e, true );
		}
	}

	/**
	 * Get product name via AJAX.
	 *
	 * @since 10.0
	 * @return never Sends JSON response and terminates.
	 * @throws WDP_Security_Exception      If nonce verification fails.
	 * @throws WDP_Validation_Exception    If product ID is invalid.
	 * @throws WDP_Product_Not_Found_Exception If product doesn't exist.
	 */
	public static function get_product_name() {
		if ( function_exists( 'wdp_track_deprecated_ajax_usage' ) ) {
			wdp_track_deprecated_ajax_usage( 'wdp_get_product_name' );
		}

		try {
			self::run_secured_ajax( 'wdp_get_product_name', 'get_product_name', 60, 60, false );
		} catch ( WDP_Security_Exception $e ) {
			WDP_Utils::json_error( $e );
		}

		$product_id = isset( $_POST['product_id'] ) ? absint( wp_unslash( $_POST['product_id'] ) ) : 0;

		if ( ! $product_id ) {
			WDP_Utils::json_error( __( 'Invalid product ID', 'woo-donation-popup' ) );
		}

		$product = null;
		// SECURITY: Validate product ID and reuse resolved product instance.
		if ( ! WDP_Security::validate_product_id( $product_id, $product ) ) {
			WDP_Utils::json_error( __( 'Invalid product ID', 'woo-donation-popup' ) );
		}

		if ( ! $product ) {
			WDP_Utils::json_error( __( 'Product not found', 'woo-donation-popup' ) );
		}

		WDP_Utils::json_success(
			array(
				'product_name' => $product->get_name(),
				'deprecated'   => true,
				'use_instead'  => 'wdp_get_product_info',
			)
		);
	}
}

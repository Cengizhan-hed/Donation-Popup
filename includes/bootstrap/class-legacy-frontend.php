<?php
/**
 * wdp_render_donation_button/form geriye dönük PHP yardımcıları ve eski AJAX uçları.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'wdp_render_donation_button' ) ) {
	/**
	 * Render donation button for a product.
	 *
	 * @deprecated 10.2.5 Prefer shortcodes `wdp_donation_button` or `wdp_donation_button_panel`.
	 * @param int    $product_id  Product ID.
	 * @param string $button_text Button label.
	 * @return string
	 */
	function wdp_render_donation_button( $product_id, $button_text = '' ) {
		if ( '' === $button_text ) {
			$button_text = __( 'Donate', 'woo-donation-popup' );
		}
		if ( ! class_exists( 'WDP_Templates' ) ) {
			return '<p style="color:red;">' . esc_html__( 'The WooCommerce Donation Popup plugin is not active.', 'woo-donation-popup' ) . '</p>';
		}
		if ( ! function_exists( 'wc_get_product' ) ) {
			return '<p style="color:red;">' . esc_html__( 'WooCommerce is not active.', 'woo-donation-popup' ) . '</p>';
		}

		$product_id = intval( $product_id );
		$product    = wc_get_product( $product_id );
		if ( ! $product ) {
			wdp_debug_log( 'WDP: Product not found - ID: ' . $product_id );
			/* translators: %d: product ID. */
			return '<p style="color:red;">' . esc_html( sprintf( __( 'Product not found (ID: %d). Please check the product ID.', 'woo-donation-popup' ), $product_id ) ) . '</p>';
		}

		return WDP_Templates::render_donation_modal( $product_id, $button_text );
	}
}

if ( ! function_exists( 'wdp_render_donation_form' ) ) {
	/**
	 * Render direct donation form shortcode output.
	 *
	 * @param int   $product_id Product ID.
	 * @param array $args       Shortcode args.
	 * @return string
	 */
	function wdp_render_donation_form( $product_id, $args = array() ) {
		if ( ! class_exists( 'WDP_Templates' ) ) {
			return '<p style="color:red;">' . esc_html__( 'The WooCommerce Donation Popup plugin is not active.', 'woo-donation-popup' ) . '</p>';
		}
		if ( ! function_exists( 'wc_get_product' ) ) {
			return '<p style="color:red;">' . esc_html__( 'WooCommerce is not active.', 'woo-donation-popup' ) . '</p>';
		}

		$product_id = intval( $product_id );
		$product    = wc_get_product( $product_id );
		if ( ! $product ) {
			wdp_debug_log( 'WDP: Product not found - ID: ' . $product_id );
			/* translators: %d: product ID. */
			return '<p style="color:red;">' . esc_html( sprintf( __( 'Product not found (ID: %d). Please check the product ID.', 'woo-donation-popup' ), $product_id ) ) . '</p>';
		}

		return WDP_Templates::render_donation_form( $product_id, is_array( $args ) ? $args : array() );
	}
}

if ( ! function_exists( 'wdp_track_deprecated_ajax_usage' ) ) {
	/**
	 * Record deprecated AJAX action usage (removal planning).
	 *
	 * @param string $action AJAX action name.
	 * @return void
	 */
	function wdp_track_deprecated_ajax_usage( $action ) {
		$action = sanitize_key( (string) $action );
		if ( $action === '' ) {
			return;
		}
		$option_key = 'wdp_deprecated_ajax_' . $action;
		$count      = (int) get_option( $option_key, 0 );
		update_option( $option_key, $count + 1, false );
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG && function_exists( 'wdp_debug_log' ) ) {
			wdp_debug_log( 'WDP deprecated AJAX used: ' . $action . ' (count: ' . ( $count + 1 ) . ')' );
		}
	}
}

// 10.33.0: unused nopriv AJAX `wdp_render_donation_button` and window.WDP.renderDonationButton
// helper removed (no JS/PHP/template/block callers). PHP helpers above remain for themes.

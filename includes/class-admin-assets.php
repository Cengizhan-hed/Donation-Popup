<?php
/**
 * WooCommerce ürün düzenleme ekranındaki "Bağış" sekmesi için CSS/JS yükler.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles admin enqueue logic for the product data tab.
 */
class WDP_Admin_Assets {
	/**
	 * Enqueue admin assets.
	 *
	 * @param string $hook Current admin page hook.
	 * @return void
	 */
	public static function enqueue( $hook ) {
		if ( $hook === 'post.php' || $hook === 'post-new.php' ) {
			$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
			if ( $screen && $screen->post_type === 'product' && current_user_can( 'manage_woocommerce' ) ) {
				wp_enqueue_style( 'wp-color-picker' );
				self::enqueue_products_assets( array( 'wp-color-picker' ), array( 'wp-color-picker' ) );
			}
			return;
		}
	}

	/**
	 * Product "Bağış" tab assets.
	 *
	 * @param string[] $style_deps  Style dependencies.
	 * @param string[] $script_deps Script dependencies.
	 * @return void
	 */
	private static function enqueue_products_assets( array $style_deps = array(), array $script_deps = array() ) {
		$css_rel = 'assets/css/admin/products.css';
		$js_rel  = 'assets/js/admin/products.js';

		// Alt bağış ürün seçici (wc-product-search / selectWoo).
		wp_enqueue_script( 'wc-enhanced-select' );
		wp_enqueue_style( 'woocommerce_admin_styles' );
		$script_deps[] = 'wc-enhanced-select';

		wp_enqueue_style( 'wdp-admin-products', WDP_PLUGIN_URL . $css_rel, $style_deps, self::asset_version( $css_rel ) );
		wp_enqueue_script( 'wdp-admin-products', WDP_PLUGIN_URL . $js_rel, $script_deps, self::asset_version( $js_rel ), true );

		wp_localize_script(
			'wdp-admin-products',
			'wdpProductsAdmin',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'wdp_admin_nonce' ),
				'tabKey'  => WDP_Admin_Product_Data_Tab::TAB_KEY,
				'i18n'    => array(
					'copied'        => __( 'Copied', 'woo-donation-popup' ),
					'copyFailed'    => __( 'Could not copy; select the text and copy it manually.', 'woo-donation-popup' ),
					'recalculating' => __( 'Recalculating the total…', 'woo-donation-popup' ),
					'error'         => __( 'The action could not be completed. Please try again.', 'woo-donation-popup' ),
					'rowAdded'      => __( 'Row added.', 'woo-donation-popup' ),
					'rowRemoved'    => __( 'Row removed.', 'woo-donation-popup' ),
				),
			)
		);
	}

	/**
	 * @param string $relative_path Path from plugin root.
	 * @return string
	 */
	private static function asset_version( $relative_path ) {
		$path = WDP_PLUGIN_DIR . $relative_path;
		return WDP_VERSION . '.' . (string) ( file_exists( $path ) ? filemtime( $path ) : 0 );
	}
}

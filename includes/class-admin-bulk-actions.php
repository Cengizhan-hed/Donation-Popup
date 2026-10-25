<?php
/**
 * Ayarlar tablosu ve WooCommerce ürün listesi için bağış ürünü toplu işlemleri.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Bulk-mark products as donation / normal / follow-global.
 */
class WDP_Admin_Bulk_Actions {

	const ACTIONS = array(
		'wdp_mark_donation' => 'yes',
		'wdp_mark_normal'   => 'no',
		'wdp_mark_global'   => '',
	);

	/**
	 * @return void
	 */
	public static function init() {
		add_filter( 'bulk_actions-edit-product', array( __CLASS__, 'register_wc_actions' ) );
		add_filter( 'handle_bulk_actions-edit-product', array( __CLASS__, 'handle_wc_actions' ), 10, 3 );
		add_action( 'admin_notices', array( __CLASS__, 'wc_notice' ) );
		add_action( 'admin_init', array( __CLASS__, 'handle_settings_table' ) );
	}

	/**
	 * @param array $actions Bulk actions.
	 * @return array
	 */
	public static function register_wc_actions( $actions ) {
		$actions                      = is_array( $actions ) ? $actions : array();
		$actions['wdp_mark_donation'] = __( 'Make donation product', 'woo-donation-popup' );
		$actions['wdp_mark_normal']   = __( 'Make regular product', 'woo-donation-popup' );
		$actions['wdp_mark_global']   = __( 'Revert to the global setting', 'woo-donation-popup' );
		return $actions;
	}

	/**
	 * @param string $redirect Redirect URL.
	 * @param string $action   Action id.
	 * @param int[]  $ids      Post IDs.
	 * @return string
	 */
	public static function handle_wc_actions( $redirect, $action, $ids ) {
		if ( ! isset( self::ACTIONS[ $action ] ) || ! current_user_can( 'manage_woocommerce' ) ) {
			return $redirect;
		}
		$n = self::apply( $ids, self::ACTIONS[ $action ] );
		return add_query_arg( 'wdp_bulk_marked', $n, $redirect );
	}

	/**
	 * @return void
	 */
	public static function wc_notice() {
		if ( ! isset( $_GET['wdp_bulk_marked'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}
		$n = absint( wp_unslash( $_GET['wdp_bulk_marked'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		echo '<div class="notice notice-success is-dismissible"><p>';
		echo esc_html(
			sprintf(
			/* translators: %d: product count */
				__( 'Updated the donation flag for %d products.', 'woo-donation-popup' ),
				$n
			)
		);
		echo '</p></div>';
	}

	/**
	 * Settings → Ürünler table bulk (POST).
	 *
	 * @return void
	 */
	public static function handle_settings_table() {
		if ( ! is_admin() || ! isset( $_POST['page'] ) || (string) wp_unslash( $_POST['page'] ) !== 'wdp-popup-settings' ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			return;
		}
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		$action = isset( $_POST['action'] ) ? sanitize_key( wp_unslash( $_POST['action'] ) ) : '';
		if ( $action === '-1' && isset( $_POST['action2'] ) ) {
			$action = sanitize_key( wp_unslash( $_POST['action2'] ) );
		}
		if ( ! isset( self::ACTIONS[ $action ] ) ) {
			return;
		}
		check_admin_referer( 'bulk-wdp_products' );
		$ids = isset( $_POST['wdp_product'] ) ? array_map( 'absint', (array) wp_unslash( $_POST['wdp_product'] ) ) : array();
		self::apply( $ids, self::ACTIONS[ $action ] );
		wp_safe_redirect( admin_url( 'admin.php?page=wdp-popup-settings#products' ) );
		exit;
	}

	/**
	 * @param int[]  $ids  Product IDs.
	 * @param string $flag ''|yes|no.
	 * @return int Updated count.
	 */
	public static function apply( array $ids, $flag ) {
		$flag    = in_array( $flag, array( 'yes', 'no', '' ), true ) ? $flag : '';
		$updated = 0;
		foreach ( $ids as $id ) {
			$id = absint( $id );
			if ( $id <= 0 || ! current_user_can( 'edit_post', $id ) ) {
				continue;
			}
			$product = function_exists( 'wc_get_product' ) ? wc_get_product( $id ) : null;
			if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
				continue;
			}
			$product->update_meta_data( WDP_Donation_Scope::META, $flag );
			$product->save();
			WDP_Donation_Scope::flush( $id );
			++$updated;
		}
		if ( $updated && class_exists( 'WDP_Donations_List' ) ) {
			WDP_Donations_List::bump_cache();
		}
		return $updated;
	}
}

<?php
/**
 * Meta Pixel eşlik ayarları sekmesi form alanları.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Renders Meta tracking settings form.
 */
class WDP_Admin_Meta_Tracking_Tab_Renderer {

	/**
	 * Echo tab panel markup.
	 *
	 * @return void
	 */
	public static function render() {
		$s = class_exists( 'WDP_Meta_Tracking' ) ? WDP_Meta_Tracking::get_settings() : array();

		$on = static function ( $key ) use ( $s ) {
			return isset( $s[ $key ] ) && '1' === (string) $s[ $key ];
		};

		echo '<div class="wdp-settings-container">';
		echo '<div class="wdp-tab-help" role="note">';
		echo '<p class="wdp-tab-help__title">' . esc_html__( 'Meta Pixel (WDP)', 'woo-donation-popup' ) . '</p>';
		echo '<p>' . esc_html__( 'This section uses the site’s existing pixel (for example the WooCommerce / Meta integration); by default it does not add a second pixel or PageView. ViewContent and AddToCart are sent from this plugin; InitiateCheckout and Purchase are left to WooCommerce / Meta by default.', 'woo-donation-popup' ) . '</p>';
		echo '</div>';

		$wc_meta_purchase = class_exists( 'WDP_Meta_Tracking' ) && WDP_Meta_Tracking::is_woocommerce_meta_purchase_integration_active();

		echo '<form id="wdp-meta-tracking-settings-form" class="wdp-admin-settings-form" method="post" data-wdp-ajax-action="wdp_save_meta_tracking_settings">';
		self::row_toggle( 'meta_enabled', __( 'Enable Meta tracking', 'woo-donation-popup' ), $on( 'enabled' ) );
		$consent_api = class_exists( 'WDP_Meta_Tracking' ) && WDP_Meta_Tracking::is_consent_api_available();
		self::row_toggle(
			'meta_require_consent',
			__( 'Require cookie consent', 'woo-donation-popup' ),
			$on( 'require_consent' ),
			$consent_api
				? __( 'When on, the Pixel and events run only after marketing consent is given. WP Consent API was detected; if consent is granted later, the Pixel starts at that moment.', 'woo-donation-popup' )
				: __( 'When on, the Pixel and events run only when marketing consent is present. WP Consent API is not loaded: consent must be reported with the “wdp_meta_pixel_has_consent” filter (default: no consent). When off, the previous behavior is kept.', 'woo-donation-popup' )
		);
		self::row_toggle( 'meta_view_content', __( 'Send ViewContent when the form opens', 'woo-donation-popup' ), $on( 'view_content' ) );
		self::row_toggle( 'meta_add_to_cart', __( 'Send AddToCart after adding to the cart', 'woo-donation-popup' ), $on( 'add_to_cart' ) );
		self::row_toggle(
			'meta_purchase',
			__( 'Send Purchase from the donation plugin', 'woo-donation-popup' ),
			$on( 'purchase' ),
			$wc_meta_purchase
				? __( 'WooCommerce / Meta integration detected (for example facebook-for-woocommerce). Keep this off by default; otherwise two Purchase events can fire on the thank-you page. Turn it on only if WooCommerce is not sending Purchase.', 'woo-donation-popup' )
				: __( 'Sends Purchase from this plugin on the thank-you / order received page. Leave it off if WooCommerce / Meta already sends Purchase.', 'woo-donation-popup' )
		);
		self::row_toggle( 'meta_custom_debug', __( 'Custom debug events (DonationFormOpen, etc.)', 'woo-donation-popup' ), $on( 'custom_debug' ) );
		self::row_toggle( 'meta_debug', __( 'Console debug log (no personal data)', 'woo-donation-popup' ), $on( 'debug' ) );
		self::row_toggle( 'meta_load_base_pixel', __( 'Load the base Meta pixel from this plugin (off by default)', 'woo-donation-popup' ), $on( 'load_base_pixel' ) );
		self::row_toggle( 'meta_initiate_checkout', __( 'Send InitiateCheckout from the plugin (off by default; may conflict with WooCommerce)', 'woo-donation-popup' ), $on( 'initiate_checkout' ) );
		self::row_toggle( 'meta_purchase_include_on_hold', __( 'Purchase: also allow on-hold orders (bank transfer, etc.)', 'woo-donation-popup' ), $on( 'purchase_include_on_hold' ) );

		$pixel_val = isset( $s['optional_pixel_id'] ) ? esc_attr( (string) $s['optional_pixel_id'] ) : '';
		echo '<table class="form-table" role="presentation"><tbody>';
		echo '<tr><th scope="row"><label for="optional_pixel_id">' . esc_html__( 'Optional Pixel ID', 'woo-donation-popup' ) . '</label></th><td>';
		echo '<input type="text" id="optional_pixel_id" name="optional_pixel_id" class="regular-text" value="' . $pixel_val . '" inputmode="numeric" pattern="[0-9]*" autocomplete="off" />';
		echo '<p class="description">' . esc_html__( 'Used only when “load the base pixel” is on. Leave empty if the site already loads a pixel.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr></tbody></table>';

		echo '<p class="submit">';
		submit_button( __( 'Save Meta settings', 'woo-donation-popup' ), 'primary', 'submit', false, array( 'id' => 'wdp-save-meta-tracking-settings' ) );
		echo '<span class="spinner"></span>';
		echo '</p>';
		echo '</form>';
		echo '</div>';
	}

	/**
	 * One checkbox row.
	 *
	 * @param string      $name        Input name.
	 * @param string      $label       Label.
	 * @param bool        $checked     Checked.
	 * @param string|null $description Optional help under the control.
	 * @return void
	 */
	private static function row_toggle( $name, $label, $checked, $description = null ) {
		echo '<table class="form-table" role="presentation"><tbody><tr>';
		echo '<th scope="row">' . esc_html( $label ) . '</th><td>';
		echo '<label><input type="checkbox" name="' . esc_attr( $name ) . '" value="1"' . checked( $checked, true, false ) . ' /> ';
		echo esc_html__( 'Enabled', 'woo-donation-popup' ) . '</label>';
		if ( null !== $description && '' !== $description ) {
			echo '<p class="description">' . esc_html( $description ) . '</p>';
		}
		echo '</td></tr></tbody></table>';
	}
}

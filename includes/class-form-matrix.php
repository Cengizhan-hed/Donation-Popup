<?php
/**
 * Form test sayfası (?wdp_form_matrix=1): dört tipi ve dar kapsayıcıları yan yana gösterir.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Admin-only form matrix for visual regression of all donation types × placements.
 */
class WDP_Form_Matrix {

	/**
	 * @return void
	 */
	public static function init() {
		add_action( 'template_redirect', array( __CLASS__, 'maybe_render' ), 0 );
	}

	/**
	 * @return void
	 */
	public static function maybe_render() {
		if ( ! isset( $_GET['wdp_form_matrix'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You are not allowed to view this page.', 'woo-donation-popup' ), '', array( 'response' => 403 ) );
		}
		$nonce = isset( $_GET['wdp_matrix_nonce'] ) ? sanitize_text_field( wp_unslash( $_GET['wdp_matrix_nonce'] ) ) : '';
		if ( $nonce === '' || ! wp_verify_nonce( $nonce, 'wdp_form_matrix' ) ) {
			wp_die( esc_html__( 'Invalid link.', 'woo-donation-popup' ), '', array( 'response' => 403 ) );
		}

		nocache_headers();
		header( 'X-Robots-Tag: noindex, nofollow', true );

		try {
			self::render_page();
		} catch ( \Throwable $e ) {
			if ( function_exists( 'wdp_debug_log' ) ) {
				wdp_debug_log( 'WDP form matrix: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
			}
			wp_die( esc_html__( 'The form test page could not be rendered. See the error log for details.', 'woo-donation-popup' ) );
		}
		exit;
	}

	/**
	 * @return void
	 */
	private static function render_page() {
		$product_id = isset( $_GET['product_id'] ) ? absint( $_GET['product_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$product    = $product_id ? wc_get_product( $product_id ) : null;
		if ( ! $product ) {
			$product = class_exists( 'WDP_Builder_Detect' ) ? WDP_Builder_Detect::preview_product() : null;
		}
		if ( ! $product && function_exists( 'wc_get_products' ) ) {
			$list    = wc_get_products(
				array(
					'status'  => 'publish',
					'limit'   => 1,
					'type'    => 'simple',
					'orderby' => 'modified',
					'order'   => 'DESC',
				)
			);
			$product = ! empty( $list[0] ) ? $list[0] : null;
		}
		if ( ! $product ) {
			wp_die( esc_html__( 'No published product was found for testing.', 'woo-donation-popup' ) );
		}

		$width = isset( $_GET['wdp_width'] ) ? absint( $_GET['wdp_width'] ) : 450;
		if ( ! in_array( $width, array( 300, 450, 700, 0 ), true ) ) {
			$width = 450;
		}

		WDP_Assets::force_enqueue();
		add_action( 'wp_enqueue_scripts', array( 'WDP_Assets', 'enqueue_assets_now' ), 99 );

		status_header( 200 );
		echo '<!DOCTYPE html><html ' . get_language_attributes() . '><head><meta charset="' . esc_attr( get_bloginfo( 'charset' ) ) . '">';
		echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
		echo '<meta name="robots" content="noindex,nofollow">';
		echo '<title>' . esc_html__( 'Form test page', 'woo-donation-popup' ) . '</title>';
		wp_head();
		echo '<style>
			body.wdp-form-matrix{margin:0;padding:24px;background:#f4f4f5;font-family:system-ui,sans-serif}
			.wdp-matrix__bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:24px}
			.wdp-matrix__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:24px}
			.wdp-matrix__card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;min-width:0}
			.wdp-matrix__box{container-type:inline-size;width:100%;max-width:var(--wdp-matrix-w,100%);overflow:auto}
			.wdp-matrix__actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
		</style></head><body class="wdp-form-matrix">';

		$base = wp_nonce_url( home_url( '/?wdp_form_matrix=1&product_id=' . (int) $product->get_id() ), 'wdp_form_matrix', 'wdp_matrix_nonce' );
		echo '<div class="wdp-matrix__bar">';
		echo '<strong>' . esc_html__( 'Container width', 'woo-donation-popup' ) . '</strong>';
		foreach ( array(
			300 => '300',
			450 => '450',
			700 => '700',
			0   => __( 'Full', 'woo-donation-popup' ),
		) as $px => $label ) {
			echo ' <a class="button' . ( $width === (int) $px ? ' button-primary' : '' ) . '" href="' . esc_url( add_query_arg( 'wdp_width', (string) $px, $base ) ) . '">' . esc_html( $label ) . '</a>';
		}
		echo '<span>' . esc_html( $product->get_name() ) . '</span>';
		echo '</div>';

		$types = array(
			WDP_Donation_Type::FIXED    => __( 'Fixed amount', 'woo-donation-popup' ),
			WDP_Donation_Type::CUSTOM   => __( 'Custom amount', 'woo-donation-popup' ),
			WDP_Donation_Type::SHARES   => __( 'Share-based', 'woo-donation-popup' ),
			WDP_Donation_Type::CAMPAIGN => __( 'Goal-based campaign', 'woo-donation-popup' ),
		);

		echo '<div class="wdp-matrix__grid">';
		foreach ( $types as $type => $label ) {
			echo '<section class="wdp-matrix__card">';
			echo '<h2>' . esc_html( $label ) . '</h2>';
			$style = $width > 0 ? '--wdp-matrix-w:' . (int) $width . 'px' : '--wdp-matrix-w:100%';
			echo '<div class="wdp-matrix__box" style="' . esc_attr( $style ) . '">';
			echo WDP_Render_Guard::html(
				static function () use ( $product, $type ) {
					$cb = static function ( $context, $ctx_product ) use ( $type, $product ) {
						if ( ! is_object( $ctx_product ) || (int) $ctx_product->get_id() !== (int) $product->get_id() ) {
							return $context;
						}
						$flags                            = WDP_Donation_Type::to_meta( $type );
						$context['allow_custom_price']    = ! empty( $flags['_allow_custom_price'] ) && $flags['_allow_custom_price'] === 'yes';
						$context['allow_multiple_shares'] = ! empty( $flags['_allow_multiple_shares'] ) && $flags['_allow_multiple_shares'] === 'yes';
						$context['enable_progress_bar']   = ! empty( $flags['_enable_progress_bar'] ) && $flags['_enable_progress_bar'] === 'yes';
						if ( $context['allow_custom_price'] && (string) $context['min_price'] === '' ) {
							$context['min_price'] = '0';
						}
						if ( $context['allow_multiple_shares'] && (string) $context['max_shares'] === '' ) {
							$context['max_shares'] = WDP_Donation_Type::DEFAULT_MAX_SHARES;
						}
						return $context;
					};
					add_filter( 'wdp_form_context', $cb, 5, 2 );
					$html = WDP_Templates::render_donation_form( (int) $product->get_id(), array( 'show_title' => 'yes' ) );
					remove_filter( 'wdp_form_context', $cb, 5 );
					return $html;
				},
				(int) $product->get_id(),
				'form_matrix'
			);
			echo '</div>';
			echo '<div class="wdp-matrix__actions">';
			echo '<button type="button" class="button wdp-open-modal" data-product-id="' . esc_attr( (string) $product->get_id() ) . '" data-wdp-mode="popup" data-wdp-lazy="1">' . esc_html__( 'Open popup', 'woo-donation-popup' ) . '</button>';
			echo '<button type="button" class="button wdp-open-modal wdp-open-side-panel" data-product-id="' . esc_attr( (string) $product->get_id() ) . '" data-wdp-mode="side_panel" data-wdp-lazy="1">' . esc_html__( 'Open panel', 'woo-donation-popup' ) . '</button>';
			echo '</div></section>';
		}
		echo '</div>';

		echo '<script>
		document.addEventListener("submit", function(e) {
			if (e.target && e.target.closest && e.target.closest(".wdp-form-matrix")) {
				e.preventDefault();
				alert(' . wp_json_encode( __( 'Test page — adding to cart is disabled.', 'woo-donation-popup' ) ) . ');
			}
		}, true);
		</script>';
		wp_footer();
		echo '</body></html>';
	}
}

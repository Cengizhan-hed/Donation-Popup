<?php
/**
 * Yerleşik rehber (E7): Rehber alt sayfası + WordPress bağlamsal yardım sekmeleri. Metinler çevrilebilir.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Guide.
 */
final class Guide {

	/**
	 * Rehber bölümleri: kimlik => [ başlık, paragraflar[], kod (isteğe bağlı) ].
	 *
	 * @return array<string, array{title: string, body: string[], code: string}>
	 */
	public static function sections() {
		return array(
			'placing'  => array(
				'title' => __( 'Placing the donate button', 'woo-donation-popup' ),
				'body'  => array(
					__( 'Automatic: on product pages the button appears in the standard WooCommerce spots. You do not need to do anything.', 'woo-donation-popup' ),
					__( 'Shortcode: works in every page editor. Without an ID it finds the product it is placed in. Add id to point at a specific product.', 'woo-donation-popup' ),
					__( 'Block: in the block editor, add the "Donation Panel" block. Like the shortcode, it finds its own product when you give no ID.', 'woo-donation-popup' ),
				),
				'code'  => '[wdp_donation_button_panel]',
			),
			'modules'  => array(
				'title' => __( 'What each module does', 'woo-donation-popup' ),
				'body'  => array(
					__( 'Campaign: goal, amount raised and donor count. Impact: short equivalents next to amounts. Social proof: totals only, never personal details.', 'woo-donation-popup' ),
					__( 'Thank-you screen: a warm confirmation after the order. Tax relief: one question; a yes saves name and address on the order. Donor account: sign-in, My donations and give again. Side cart: a slide-in cart.', 'woo-donation-popup' ),
					__( 'A module that is switched off loads no code and no styles.', 'woo-donation-popup' ),
				),
				'code'  => '',
			),
			'trouble'  => array(
				'title' => __( 'Troubleshooting: the button does not show', 'woo-donation-popup' ),
				'body'  => array(
					__( 'Check that the product is set up as a donation product (the Donation tab in the product data box) and that it is published.', 'woo-donation-popup' ),
					__( 'If your theme does not use the standard WooCommerce hooks, a fallback button is drawn for you. If you place the shortcode or block yourself, only that one appears: never two on the same page.', 'woo-donation-popup' ),
					__( 'Still stuck? Place the shortcode in the product description or in a text block. It works in any page editor.', 'woo-donation-popup' ),
				),
				'code'  => '',
			),
			'currency' => array(
				'title' => __( 'Multi-currency stores', 'woo-donation-popup' ),
				'body'  => array(
					__( 'By default amounts are shown and charged in the active WooCommerce currency; nothing is converted.', 'woo-donation-popup' ),
					__( 'If you use a multi-currency plugin that needs conversion, a small adapter snippet connects it through the documented donation_panel_convert_amount filter. Ready-made snippets are in the plugin folder docs/site-snippets.', 'woo-donation-popup' ),
				),
				'code'  => '',
			),
			'privacy'  => array(
				'title' => __( 'Privacy and data protection', 'woo-donation-popup' ),
				'body'  => array(
					__( 'Donor details (dedication, on-behalf-of name, phone, email) are saved on the order exactly as typed. Orders, exports and erasure are handled by WooCommerce and the WordPress privacy tools.', 'woo-donation-popup' ),
					__( 'Write your privacy text on your own site. The plugin only shows a link under the form.', 'woo-donation-popup' ),
				),
				'code'  => '',
			),
		);
	}

	/**
	 * Rehber sayfasını çizer.
	 *
	 * @return void
	 */
	public function render() {
		if ( ! current_user_can( Admin_Bootstrap::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to open this page.', 'woo-donation-popup' ), '', array( 'response' => 403 ) );
		}
		echo '<div class="wrap dpa" id="dpa-guide"><h1 class="dpa-title">' . esc_html__( 'Donation Panel guide', 'woo-donation-popup' ) . '</h1>';
		echo '<p class="dpa-sub">' . esc_html__( 'Short answers to the questions people ask most.', 'woo-donation-popup' ) . '</p>';
		echo '<nav class="dpa-toc" aria-label="' . esc_attr__( 'Guide sections', 'woo-donation-popup' ) . '"><ul>';
		foreach ( self::sections() as $id => $section ) {
			echo '<li><a href="#dpa-g-' . esc_attr( $id ) . '">' . esc_html( $section['title'] ) . '</a></li>';
		}
		echo '</ul></nav>';
		foreach ( self::sections() as $id => $section ) {
			echo '<section class="dpa-card" id="dpa-g-' . esc_attr( $id ) . '"><h2>' . esc_html( $section['title'] ) . '</h2>';
			foreach ( $section['body'] as $paragraph ) {
				echo '<p>' . esc_html( $paragraph ) . '</p>';
			}
			if ( '' !== $section['code'] ) {
				echo Admin_View::code( $section['code'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Admin_View kaçışlıdır.
			}
			echo '</section>';
		}
		echo '<p><a class="button" href="' . esc_url( Admin_View::url( Admin_Bootstrap::SLUG_SETTINGS ) ) . '">' . esc_html__( 'Back to settings', 'woo-donation-popup' ) . '</a></p></div>';
	}

	/**
	 * WordPress "Yardım" sekmelerini ekler (ekran yüklenirken).
	 *
	 * @return void
	 */
	public function add_help_tabs() {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! is_object( $screen ) || ! method_exists( $screen, 'add_help_tab' ) ) {
			return;
		}
		foreach ( self::sections() as $id => $section ) {
			$content = '';
			foreach ( $section['body'] as $paragraph ) {
				$content .= '<p>' . esc_html( $paragraph ) . '</p>';
			}
			$screen->add_help_tab(
				array(
					'id'      => 'donation-panel-' . $id,
					'title'   => $section['title'],
					'content' => $content,
				)
			);
		}
		$screen->set_help_sidebar( '<p><a href="' . esc_url( Admin_View::url( Admin_Bootstrap::SLUG_GUIDE ) ) . '">' . esc_html__( 'Open the full guide', 'woo-donation-popup' ) . '</a></p>' );
	}
}

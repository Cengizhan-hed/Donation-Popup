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
	 * Rehber bölümleri: kimlik => [ başlık, paragraflar[], kod (isteğe bağlı), figure (isteğe bağlı şema),
	 * link (isteğe bağlı: [ sayfa slug'ı, bölüm çapası, etiket ]) ].
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function sections() {
		return array(
			'placing'    => array(
				'title' => __( 'Placing the donate button', 'woo-donation-popup' ),
				'body'  => array(
					__( 'Automatic: on product pages the button appears in the standard WooCommerce spots. You do not need to do anything.', 'woo-donation-popup' ),
					__( 'Shortcode: works in every page editor. Without an ID it finds the product it is placed in. Add id to point at a specific product.', 'woo-donation-popup' ),
					__( 'Block: in the block editor, add the "Donation Panel" block. Like the shortcode, it finds its own product when you give no ID.', 'woo-donation-popup' ),
				),
				'code'  => '[wdp_donation_button_panel]',
			),
			'shortcodes' => array(
				'title' => __( 'Shortcodes and block', 'woo-donation-popup' ),
				'body'  => array(
					__( 'Side panel button: [wdp_donation_button_panel]. Centered window button: [wdp_donation_button]. Form that stays on the page: [wdp_donation_form]. List of donation products: [wdp_donations].', 'woo-donation-popup' ),
					__( 'Add id="123" to point at a specific product. Without an ID the shortcode finds the product it is placed in. The "Donation Panel" block does the same in the block editor.', 'woo-donation-popup' ),
				),
				'code'  => '[wdp_donation_button_panel id="123"]',
			),
			'compact'    => array(
				'title'  => __( 'Adding the compact card to a slider', 'woo-donation-popup' ),
				'body'   => array(
					__( '1. Open Donation Panel → Forms and appearance → Compact card (slider/hero). Choose the donation product and press Copy.', 'woo-donation-popup' ),
					__( '2. In your slider or page editor, add a Shortcode widget (or any text block) to the slide and paste the shortcode. No special widget is needed. In the block editor you can also add the "Donation form" block and choose Layout: Compact.', 'woo-donation-popup' ),
					__( '3. Finding a product ID: go to Products → All products and point at the product name; the ID is shown under it. The shortcode builder also lists every donation product with its ID.', 'woo-donation-popup' ),
					__( '4. Slide height: make the slide at least as tall as the card. The Compact card screen shows the card heights for desktop, tablet and phone. To give every card one height, set --dp-compact-h (and --dp-compact-h-md, --dp-compact-h-sm) on the slide.', 'woo-donation-popup' ),
					__( '5. Colors: Forms and appearance → Colors → Custom colors. Each color field accepts a hex value or a CSS variable from your theme or page editor, for example var(--brand), so the card follows your site palette.', 'woo-donation-popup' ),
					__( '6. If the slider moves on while a donor is halfway through, switch on "Start over when the card is hidden". The compact card is only a look: how the donor pays is set under Cart and checkout.', 'woo-donation-popup' ),
				),
				'code'   => '[wdp_donation_form id="123" layout="compact"]',
				'figure' => 'compact',
				'link'   => array( Admin_Bootstrap::SLUG_FORMS, 'dpa-s-compact', __( 'Open the Compact card settings', 'woo-donation-popup' ) ),
			),
			'direct'     => array(
				'title'  => __( 'Turning on direct donation', 'woo-donation-popup' ),
				'body'   => array(
					__( 'Direct donation is how the donor pays, not how the form looks: nothing is added to the cart and the donor pays on WooCommerce\'s own payment page for the order. It works with the centered window, side panel, bottom sheet, in-page form and compact card.', 'woo-donation-popup' ),
					__( 'For every product: Donation Panel → Cart and checkout → How donors pay → switch on "Skip the cart (direct donation)".', 'woo-donation-popup' ),
					__( 'For one donation type: on the same screen choose "Through the cart" or "Direct (skip the cart)" next to Fixed amount, Custom amount, Share-based, Goal-based campaign or Products that offer an add-on donation. "Use the general setting" follows the switch above.', 'woo-donation-popup' ),
					__( 'For one product: Products → edit the product → Product data → Donation → "Skip the cart (direct donation)". The line under it shows the current value and where it comes from.', 'woo-donation-popup' ),
					__( 'Order: the product setting wins, then the donation type, then the general setting. A direct donation is a single-line order, so the add-on donation choice is not shown when the result is direct.', 'woo-donation-popup' ),
					__( 'On the compact card the payment page opens in a secure window. If a payment method cannot work inside the window, the donor taps "Open the payment page instead". Unpaid direct donations are cancelled automatically after the WooCommerce stock hold time.', 'woo-donation-popup' ),
				),
				'code'   => '',
				'figure' => 'direct',
				'link'   => array( Admin_Bootstrap::SLUG_CHECKOUT, 'dpa-s-payment', __( 'Open How donors pay', 'woo-donation-popup' ) ),
			),
			'hooks'      => array(
				'title' => __( 'For developers: filters', 'woo-donation-popup' ),
				'body'  => array(
					__( 'donation_panel_convert_amount converts amounts for a multi-currency plugin. donation_panel_amount_presets changes the quick amounts. donation_panel_rest_controllers adds REST controllers. The full list with examples is in docs/HOOKS.md in the plugin folder.', 'woo-donation-popup' ),
				),
				'code'  => '',
			),
			'modules'    => array(
				'title' => __( 'What each module does', 'woo-donation-popup' ),
				'body'  => array(
					__( 'Campaign: goal, amount raised and donor count. Impact: short equivalents next to amounts. Social proof: totals only, never personal details.', 'woo-donation-popup' ),
					__( 'Thank-you screen: a warm confirmation after the order. Tax relief: one question; a yes saves name and address on the order. Donor account: sign-in, My donations and give again. Side cart: a slide-in cart.', 'woo-donation-popup' ),
					__( 'A module that is switched off loads no code and no styles.', 'woo-donation-popup' ),
				),
				'code'  => '',
			),
			'trouble'    => array(
				'title' => __( 'Troubleshooting: the button does not show', 'woo-donation-popup' ),
				'body'  => array(
					__( 'Check that the product is set up as a donation product (the Donation tab in the product data box) and that it is published.', 'woo-donation-popup' ),
					__( 'If your theme does not use the standard WooCommerce hooks, a fallback button is drawn for you. If you place the shortcode or block yourself, only that one appears: never two on the same page.', 'woo-donation-popup' ),
					__( 'Still stuck? Place the shortcode in the product description or in a text block. It works in any page editor.', 'woo-donation-popup' ),
				),
				'code'  => '',
			),
			'currency'   => array(
				'title' => __( 'Multi-currency stores', 'woo-donation-popup' ),
				'body'  => array(
					__( 'By default amounts are shown and charged in the active WooCommerce currency; nothing is converted.', 'woo-donation-popup' ),
					__( 'If you use a multi-currency plugin that needs conversion, a small adapter snippet connects it through the documented donation_panel_convert_amount filter. Ready-made snippets are in the plugin folder docs/site-snippets.', 'woo-donation-popup' ),
				),
				'code'  => '',
			),
			'privacy'    => array(
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
		$html  = Admin_View::open( Admin_Bootstrap::SLUG_GUIDE, __( 'Guide', 'woo-donation-popup' ), __( 'Short answers to the questions people ask most.', 'woo-donation-popup' ), false );
		$html .= '<nav class="dpa-toc dpa-card" aria-label="' . esc_attr__( 'Guide sections', 'woo-donation-popup' ) . '"><ul>';
		foreach ( self::sections() as $id => $section ) {
			$html .= '<li><a href="#dpa-g-' . esc_attr( $id ) . '">' . esc_html( $section['title'] ) . '</a></li>';
		}
		$html .= '</ul></nav>';
		foreach ( self::sections() as $id => $section ) {
			$body = '';
			foreach ( $section['body'] as $paragraph ) {
				$body .= '<p>' . esc_html( $paragraph ) . '</p>';
			}
			if ( '' !== $section['code'] ) {
				$body .= Admin_View::code( $section['code'] );
			}
			if ( ! empty( $section['figure'] ) ) {
				$body .= self::figure( (string) $section['figure'] );
			}
			if ( ! empty( $section['link'] ) ) {
				list( $slug, $anchor, $label ) = $section['link'];
				$body                         .= '<p><a class="dpa-btn dpa-btn--small" href="' . esc_url( Admin_View::url( $slug ) . '#' . $anchor ) . '">' . esc_html( $label ) . '</a></p>';
			}
			$html .= '<div id="dpa-g-' . esc_attr( $id ) . '">' . Admin_View::card( $section['title'], $body ) . '</div>';
		}
		$html .= '<p><a class="dpa-btn dpa-btn--ghost" href="' . esc_url( Admin_View::url( Admin_Bootstrap::SLUG_OVERVIEW ) ) . '">' . esc_html__( 'Back to overview', 'woo-donation-popup' ) . '</a></p>' . Admin_View::close();
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Admin_View kaçışlıdır.
	}

	/**
	 * Rehber görseli: satır içi SVG şema (metinler çevrilir; dosya/istek yok).
	 *
	 * @param string $name compact|direct.
	 * @return string
	 */
	public static function figure( $name ) {
		$box   = static function ( $x, $y, $w, $h, $label, $strong = false ) {
			return '<rect x="' . (int) $x . '" y="' . (int) $y . '" width="' . (int) $w . '" height="' . (int) $h . '" rx="10" fill="' . ( $strong ? '#12305a' : '#ffffff' ) . '" stroke="#12305a" stroke-width="1.5"/>'
				. '<text x="' . (int) ( $x + $w / 2 ) . '" y="' . (int) ( $y + $h / 2 + 5 ) . '" text-anchor="middle" font-size="13" fill="' . ( $strong ? '#ffffff' : '#1d2327' ) . '">' . esc_html( $label ) . '</text>';
		};
		$arrow = static function ( $x1, $y, $x2 ) {
			return '<path d="M' . (int) $x1 . ' ' . (int) $y . 'H' . (int) ( $x2 - 6 ) . '" stroke="#646970" stroke-width="1.5"/><path d="M' . (int) ( $x2 - 8 ) . ' ' . (int) ( $y - 5 ) . 'L' . (int) $x2 . ' ' . (int) $y . 'L' . (int) ( $x2 - 8 ) . ' ' . (int) ( $y + 5 ) . '" fill="none" stroke="#646970" stroke-width="1.5"/>';
		};
		$label = static function ( $x, $y, $text ) {
			return '<text x="' . (int) $x . '" y="' . (int) $y . '" font-size="12" font-weight="700" fill="#50575e">' . esc_html( $text ) . '</text>';
		};

		if ( 'direct' === $name ) {
			$aria = __( 'Through the cart: form, cart, checkout, thank you. Direct: form, payment page, thank you.', 'woo-donation-popup' );
			$svg  = $label( 8, 18, __( 'Through the cart', 'woo-donation-popup' ) )
				. $box( 8, 28, 120, 40, __( 'Form', 'woo-donation-popup' ) ) . $arrow( 128, 48, 168 )
				. $box( 168, 28, 120, 40, __( 'Cart', 'woo-donation-popup' ) ) . $arrow( 288, 48, 328 )
				. $box( 328, 28, 120, 40, __( 'Checkout', 'woo-donation-popup' ) ) . $arrow( 448, 48, 488 )
				. $box( 488, 28, 120, 40, __( 'Thank you', 'woo-donation-popup' ) )
				. $label( 8, 100, __( 'Direct (skip the cart)', 'woo-donation-popup' ) )
				. $box( 8, 110, 120, 40, __( 'Form', 'woo-donation-popup' ) ) . $arrow( 128, 130, 168 )
				. $box( 168, 110, 280, 40, __( 'Payment page', 'woo-donation-popup' ), true ) . $arrow( 448, 130, 488 )
				. $box( 488, 110, 120, 40, __( 'Thank you', 'woo-donation-popup' ) );
			$h    = 160;
		} else {
			$aria = __( 'A slide with a compact donation card placed through a Shortcode widget.', 'woo-donation-popup' );
			$svg  = '<rect x="4" y="4" width="608" height="196" rx="14" fill="#f6f7f7" stroke="#c3c4c7" stroke-width="1.5"/>'
				. $label( 20, 30, __( 'Slide', 'woo-donation-popup' ) )
				. '<text x="20" y="62" font-size="20" font-weight="700" fill="#1d2327">' . esc_html__( 'Your headline', 'woo-donation-popup' ) . '</text>'
				. '<rect x="20" y="76" width="220" height="10" rx="5" fill="#dcdcde"/><rect x="20" y="94" width="170" height="10" rx="5" fill="#dcdcde"/>'
				. '<rect x="360" y="20" width="236" height="164" rx="14" fill="#ffffff" stroke="#12305a" stroke-width="2"/>'
				. $label( 376, 44, __( 'Shortcode widget', 'woo-donation-popup' ) )
				. '<rect x="376" y="56" width="64" height="32" rx="8" fill="#ffffff" stroke="#c3c4c7"/><rect x="448" y="56" width="64" height="32" rx="8" fill="#ffffff" stroke="#c3c4c7"/><rect x="520" y="56" width="60" height="32" rx="8" fill="#ffffff" stroke="#c3c4c7"/>'
				. '<rect x="376" y="96" width="204" height="32" rx="8" fill="#ffffff" stroke="#c3c4c7"/>'
				. '<rect x="376" y="140" width="204" height="32" rx="16" fill="#12305a"/>'
				. '<text x="478" y="161" text-anchor="middle" font-size="13" fill="#ffffff">' . esc_html__( 'Donate', 'woo-donation-popup' ) . '</text>'
				. '<path d="M250 140c40 0 70-10 100-24" fill="none" stroke="#646970" stroke-width="1.5" stroke-dasharray="4 4"/>'
				. '<text x="20" y="150" font-size="12" fill="#50575e">--dp-compact-h</text>';
			$h    = 204;
		}
		return '<figure class="dpa-figure" data-dpa-figure="' . esc_attr( $name ) . '"><svg width="616" height="' . (int) $h . '" viewBox="0 0 616 ' . (int) $h . '" role="img" aria-label="' . esc_attr( $aria ) . '">' . $svg . '</svg></figure>';
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

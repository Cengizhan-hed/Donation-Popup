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
					__( '4. Slide height: make the slide at least as tall as the card (about 384 px on every screen). The Compact card screen shows the card heights for desktop, tablet and phone. To give every card one height, set --dp-compact-h (and --dp-compact-h-md, --dp-compact-h-sm) on the slide.', 'woo-donation-popup' ),
					__( '5. Colors: Forms and appearance → Colors → Choose my own colors. Each color field accepts a hex value or a CSS variable from your theme or page editor, for example var(--brand), so the card follows your site palette.', 'woo-donation-popup' ),
					__( '6. If the slider moves on while a donor is halfway through, switch on "Start over when the card is hidden". The compact card is only a look: how the donor pays is set under Cart and checkout.', 'woo-donation-popup' ),
					__( '7. What the donor sees: through the cart the card has 2 steps (amount, then details with "Continue to checkout · amount"); with direct donation it has 3 (amount, details, payment) and a thank-you. The step counter shows the real number. A small lock line ("Secure payment") sits above the button; you can switch it off under Compact card. With the Impact phrases module the chosen amount\'s impact appears next to the amount; with the Tax relief module the declaration shows its title and a short line, and "Details" opens the full text inside the card.', 'woo-donation-popup' ),
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
					__( 'Email: the form asks for an email only with direct donation, and there it is required (the payment page does not ask for billing details, and card payments and order emails need the address). A signed-in donor is not asked: the account email is used. Through the cart the form has no email field; WooCommerce asks for it on the checkout page. There is no email setting any more.', 'woo-donation-popup' ),
				),
				'code'   => '',
				'figure' => 'direct',
				'link'   => array( Admin_Bootstrap::SLUG_CHECKOUT, 'dpa-s-payment', __( 'Open How donors pay', 'woo-donation-popup' ) ),
			),
			'progress'   => array(
				'title'  => __( 'Campaign progress bar', 'woo-donation-popup' ),
				'body'   => array(
					__( '1. Give the product a goal: Products → edit the product → Product data → Donation → goal amount. From then on the bar appears by itself in the centered window, side panel, bottom sheet, in-page form and on the compact card.', 'woo-donation-popup' ),
					__( '2. To show the bar on its own anywhere (a page, a sidebar, a slider), use the shortcode below. Without an ID it finds the product it is placed in. Add milestones="no" or donors="no" to hide those parts.', 'woo-donation-popup' ),
					__( '3. The real total only grows with paid orders and goes down after refunds or cancellations. Items in a cart never change it.', 'woo-donation-popup' ),
					__( '4. Donor\'s own gift: when a donor picks or types an amount, a lighter striped part shows how far their gift would take the campaign, together with the new total. After "Add to cart" it stays as "in your cart"; removing it from the cart makes it disappear. Only that visitor sees it.', 'woo-donation-popup' ),
					__( '5. After payment on the compact card the bar fetches the new total once, and the donor\'s part becomes part of the real bar.', 'woo-donation-popup' ),
					__( '6. Settings: Donation Panel → Campaigns → Campaign progress bar. Switch off the donor\'s own gift, the fill and count-up animation, or the small celebration at the goal. Visitors who ask their device for less motion always see the final values without animation.', 'woo-donation-popup' ),
					__( '7. Milestones on the shortcode bar (optional): a product custom field named _donation_panel_milestones, one per line as percent = label, for example 50 = Halfway. Developers can also use the donation_panel_milestones filter.', 'woo-donation-popup' ),
					__( '8. Shop, category and donation list cards: when the "Donate" button on a card opens the form, the bar inside it works the same way (the donor\'s own gift, cart, new total after payment). Nothing extra to set up; the bar files load only when the donor reaches for the card of a product with a goal.', 'woo-donation-popup' ),
				),
				'code'   => '[donation_panel_progress id="123"]',
				'figure' => 'progress',
				'link'   => array( Admin_Bootstrap::SLUG_CAMPAIGNS, 'dpa-s-progress', __( 'Open the progress bar settings', 'woo-donation-popup' ) ),
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
			'phone'      => array(
				'title' => __( 'Phone number field', 'woo-donation-popup' ),
				'body'  => array(
					__( '1. Where it is: the phone number is part of the donor details step of the donation form and of the compact card. There is nothing to set: the check works for every country and language, on phones and computers.', 'woo-donation-popup' ),
					__( '2. What donors see: the country code list starts with your WooCommerce store country. While typing, the number is spaced the way that country writes it (for Turkey: 530 307 15 93) and no extra digits can be typed. A leading 0, 00 or country code (+90, +44) that is typed or pasted is removed by itself and the country code list follows it.', 'woo-donation-popup' ),
					__( '3. Wrong numbers: if the number is too short, a clear line appears under the field when the donor leaves it, and the Continue button stays dimmed until the number is complete. A number that does not look like a mobile number (Turkey: not starting with 5, United Kingdom: not starting with 7) only shows a hint and never blocks the gift. The same goes for countries whose number lengths vary: a number of unusual length only shows a hint, and only clearly impossible lengths are stopped.', 'woo-donation-popup' ),
					__( '4. What is saved: the donor details on the order keep the number exactly as typed with its country code. The WooCommerce billing phone receives the same number in international format (for example +905303071593), which payment, SMS and shipping tools expect. The server checks the number again with the same rules.', 'woo-donation-popup' ),
				),
				'code'  => '[wdp_donation_form]',
			),
			'email'      => array(
				'title' => __( 'Donor e-mails', 'woo-donation-popup' ),
				'body'  => array(
					__( '1. Nothing to install: the donation details appear in the standard WooCommerce order e-mails (Processing, Completed, New order). Customize their colors and logo under WooCommerce → Settings → Emails.', 'woo-donation-popup' ),
					__( '2. Thank-you above the order table: Donation Panel → Cart and checkout → Thank-you screen → "Thank-you in donor e-mails" (on by default). Donors get your thank-you message in the Processing and Completed e-mails, so it is sent only for donations whose payment has been received. The WooCommerce "On hold" e-mail (for example with bank transfer details) is left exactly as it is, without a thank-you. For a campaign product one extra line shows the amount raised and the goal at the time the e-mail is sent. It is never added to the e-mails you receive, and it works even when the Thank-you screen module is off.', 'woo-donation-popup' ),
					__( '3. Change the wording: the same "Thank-you message" field under Thank-you screen is used on the page and in the e-mail. Leave it empty for the built-in wording. Only links, bold, italic and line breaks are kept.', 'woo-donation-popup' ),
					__( '4. Privacy: in e-mails to donors the phone number is left out (WooCommerce already shows the billing phone); donation type, names and note stay. In e-mails to you every field stays. Internal plugin data is never shown in any e-mail, and the order itself is not changed.', 'woo-donation-popup' ),
					__( '5. Language: e-mails to donors use the site language and the labels are translated when the e-mail is sent, so a Turkish label never appears in an English e-mail and the other way round.', 'woo-donation-popup' ),
					__( '6. WooCommerce block e-mail editor: if you turn on WooCommerce\'s block-based e-mail editor (WooCommerce → Settings → Advanced → Features), everything above keeps working, also in an e-mail template you customized and published in that editor: the thank-you, translated labels, hidden phone number and hidden internal data all appear in the e-mails. The thank-you looks the same in the classic and the block e-mail editor: a small box with its own styling that works in e-mail apps, using the text and accent colors from WooCommerce → Settings → Emails. It is placed with the order content, just above the order table.', 'woo-donation-popup' ),
				),
				'code'  => '',
				'link'  => array( Admin_Bootstrap::SLUG_CHECKOUT, 'dpa-s-thanks', __( 'Open the Thank-you settings', 'woo-donation-popup' ) ),
			),
			'colors'     => array(
				'title'  => __( 'Setting the colors', 'woo-donation-popup' ),
				'body'   => array(
					__( '1. Open Donation Panel → Forms and appearance → Colors. Under "Use my theme colors" you see the two colors in use and where each one comes from: "Theme palette: primary", "Default" or "Follows the main color".', 'woo-donation-popup' ),
					__( '2. Which theme colors are used: only colors the theme names primary, brand, accent, secondary, contrast or foreground (also numbered ones such as accent-3). The main color must be readable on white; the button color must keep its text readable. Nothing is guessed from other colors.', 'woo-donation-popup' ),
					__( '3. If the theme has no such names you see "Colors could not be read from your theme" here and on the Overview. The form then uses a calm neutral ink color until you choose your own.', 'woo-donation-popup' ),
					__( '4. To choose your own: select "Choose my own colors" and fill in Main color and Button color. Each field takes a hex value (#12305A) or a CSS variable from your theme or page editor, for example var(--brand). The line under each field says what is used: "Source: your choice." or, when empty, the color that applies instead.', 'woo-donation-popup' ),
					__( '5. Button text turns black or white by itself so it stays readable (contrast at least 4.5:1). Colors you choose are never changed by theme or plugin updates.', 'woo-donation-popup' ),
				),
				'code'   => 'var(--wp--preset--color--primary, #12305a)',
				'figure' => 'colors',
				'link'   => array( Admin_Bootstrap::SLUG_FORMS, 'dpa-s-colors', __( 'Open the Colors settings', 'woo-donation-popup' ) ),
			),
			'side_cart'  => array(
				'title'  => __( 'Side cart', 'woo-donation-popup' ),
				'body'   => array(
					__( '1. Turn it on: Donation Panel → Cart and checkout → Modules → Side cart. After a gift is added, a basket slides in (a bottom sheet on phones) with the gifts, the total and "Complete donation".', 'woo-donation-popup' ),
					__( '2. Floating basket button: on the same screen under Side cart. It appears only when the basket has a gift. Choose Bottom right or Bottom left so it does not cover your chat or back-to-top button, or switch it off if your theme shows its own cart icon.', 'woo-donation-popup' ),
					__( '3. A basket icon in your header: place the shortcode below in a header widget or menu block. It shows the number of gifts and opens the same basket.', 'woo-donation-popup' ),
					__( '4. Extra gift suggestion: switch on "Suggest an extra gift in the basket", enter the product ID (0 uses the add-on product) and up to three amounts such as 50, 100. Donors add it with one tap; their details are taken from the gift already in the basket.', 'woo-donation-popup' ),
					__( '5. The side cart never opens on the cart and checkout pages, and pages without a donation form load none of its files.', 'woo-donation-popup' ),
				),
				'code'   => '[donation_panel_side_cart]',
				'figure' => 'side-cart',
				'link'   => array( Admin_Bootstrap::SLUG_CHECKOUT, 'dpa-s-basket', __( 'Open the Side cart settings', 'woo-donation-popup' ) ),
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
	 * @param string $name compact|direct|colors|side-cart.
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
		} elseif ( 'colors' === $name ) {
			$aria = __( 'Theme palette names lead to the colors used: primary or brand becomes the main color, accent or secondary becomes the button color; without these names a neutral default is used and you are asked to choose.', 'woo-donation-popup' );
			$svg  = $label( 8, 18, __( 'Theme palette', 'woo-donation-popup' ) )
				. $box( 8, 28, 150, 40, 'primary / brand' ) . $arrow( 158, 48, 208 )
				. $box( 208, 28, 180, 40, __( 'Main color', 'woo-donation-popup' ), true )
				. $box( 8, 80, 150, 40, 'accent / secondary' ) . $arrow( 158, 100, 208 )
				. $box( 208, 80, 180, 40, __( 'Button color', 'woo-donation-popup' ), true )
				. $label( 8, 148, __( 'No such names', 'woo-donation-popup' ) )
				. $box( 8, 158, 150, 40, __( 'Neutral default', 'woo-donation-popup' ) ) . $arrow( 158, 178, 208 )
				. $box( 208, 158, 180, 40, __( 'Choose your colors', 'woo-donation-popup' ) )
				. $arrow( 388, 178, 428 ) . $box( 428, 158, 180, 40, __( 'Your choice wins', 'woo-donation-popup' ), true );
			$h    = 206;
		} elseif ( 'side-cart' === $name ) {
			$aria = __( 'A page with the side cart open on the right: gifts, an extra gift suggestion, the total and the Complete donation button. The floating basket button sits in a bottom corner.', 'woo-donation-popup' );
			$svg  = '<rect x="4" y="4" width="608" height="232" rx="14" fill="#f6f7f7" stroke="#c3c4c7" stroke-width="1.5"/>'
				. $label( 20, 30, __( 'Your page', 'woo-donation-popup' ) )
				. '<rect x="20" y="44" width="240" height="10" rx="5" fill="#dcdcde"/><rect x="20" y="62" width="200" height="10" rx="5" fill="#dcdcde"/>'
				. '<circle cx="44" cy="200" r="20" fill="#12305a"/><text x="76" y="205" font-size="12" fill="#50575e">' . esc_html__( 'Bottom left', 'woo-donation-popup' ) . '</text>'
				. '<rect x="376" y="12" width="228" height="216" rx="12" fill="#ffffff" stroke="#12305a" stroke-width="2"/>'
				. $label( 392, 38, __( 'Your donation basket', 'woo-donation-popup' ) )
				. '<rect x="392" y="50" width="196" height="26" rx="8" fill="#f6f7f7"/><rect x="392" y="82" width="196" height="26" rx="8" fill="#f6f7f7"/>'
				. '<rect x="392" y="116" width="196" height="40" rx="10" fill="#f6f2ec"/><text x="402" y="140" font-size="11" fill="#50575e">' . esc_html__( 'Extra gift suggestion', 'woo-donation-popup' ) . '</text>'
				. '<text x="392" y="178" font-size="12" font-weight="700" fill="#1d2327">' . esc_html__( 'Total', 'woo-donation-popup' ) . '</text>'
				. '<rect x="392" y="188" width="196" height="30" rx="10" fill="#12305a"/><text x="490" y="208" text-anchor="middle" font-size="12" fill="#ffffff">' . esc_html__( 'Complete donation', 'woo-donation-popup' ) . '</text>'
				. '<circle cx="336" cy="200" r="20" fill="#ffffff" stroke="#12305a" stroke-width="1.5" stroke-dasharray="4 3"/><text x="336" y="166" text-anchor="middle" font-size="12" fill="#50575e">' . esc_html__( 'Bottom right', 'woo-donation-popup' ) . '</text>';
			$h    = 240;
		} elseif ( 'progress' === $name ) {
			$aria  = __( 'Campaign bar: the solid part is the real total from paid orders; the lighter striped part after it is the donor\'s own gift, seen only by that donor.', 'woo-donation-popup' );
			$money = static function ( $amount ) {
				return \DonationPanel\Modules\Campaign\Progress_Live::money( $amount );
			};
			$svg   = '<defs><pattern id="dpa-g-stripe" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="10" fill="#7d93b5"/><rect x="5" width="5" height="10" fill="#b5c3d8"/></pattern></defs>'
				. '<text x="8" y="30" font-size="20" font-weight="700" fill="#1d2327">' . esc_html( $money( 1500 ) ) . '</text>'
				/* translators: %s: goal amount. */
				. '<text x="608" y="30" text-anchor="end" font-size="13" fill="#50575e">' . esc_html( sprintf( __( 'Goal %s', 'woo-donation-popup' ), $money( 3000 ) ) ) . '</text>'
				. '<rect x="8" y="44" width="600" height="14" rx="7" fill="#e8ebef"/>'
				. '<rect x="8" y="44" width="380" height="14" rx="7" fill="url(#dpa-g-stripe)"/>'
				. '<rect x="8" y="44" width="300" height="14" rx="7" fill="#12305a"/>'
				/* translators: 1: the donor's own gift, 2: campaign total including that gift. */
				. '<text x="8" y="82" font-size="13" font-weight="700" fill="#12305a">' . esc_html( sprintf( __( 'With your %1$s it reaches %2$s', 'woo-donation-popup' ), $money( 400 ), $money( 1900 ) ) ) . '</text>'
				. $label( 8, 116, __( 'Real total (paid orders)', 'woo-donation-popup' ) ) . '<path d="M150 112H300V62" fill="none" stroke="#646970" stroke-width="1.5" stroke-dasharray="4 4"/>'
				. $label( 400, 116, __( 'Donor\'s own gift', 'woo-donation-popup' ) ) . '<path d="M396 112H350V62" fill="none" stroke="#646970" stroke-width="1.5" stroke-dasharray="4 4"/>';
			$h = 128;
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

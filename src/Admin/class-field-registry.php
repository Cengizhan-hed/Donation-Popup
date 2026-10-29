<?php
/**
 * Yönetici ayar alanlarının tek kaynağı: sayfa, bölüm, etiket, açıklama, tip, doğrulama ve eski seçenek eşlemesi.
 *
 * Alanlar `donation_panel_settings` (Core ayarı) içine yazılır. `legacy` eşlemesi olan alanlar, form motoru eski
 * `wdp_*` seçeneklerini okuduğu sürece onlara da yansıtılır (anahtar sözleşmesi korunur; hiçbir eski anahtar silinmez).
 * Envanter tablosu (`12-adm-ayar-envanteri.md`) bu kayıttan türetilir.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Field_Registry.
 */
final class Field_Registry {

	/**
	 * Alt sayfa kimlikleri (menü sırası).
	 *
	 * @return array<string, string> slug => etiket.
	 */
	public static function pages() {
		return array(
			Admin_Bootstrap::SLUG_OVERVIEW  => __( 'Overview', 'woo-donation-popup' ),
			Admin_Bootstrap::SLUG_CAMPAIGNS => __( 'Campaigns', 'woo-donation-popup' ),
			Admin_Bootstrap::SLUG_FORMS     => __( 'Forms and appearance', 'woo-donation-popup' ),
			Admin_Bootstrap::SLUG_CHECKOUT  => __( 'Cart and checkout', 'woo-donation-popup' ),
			Admin_Bootstrap::SLUG_ACCOUNT   => __( 'Donor account', 'woo-donation-popup' ),
			Admin_Bootstrap::SLUG_PRIVACY   => __( 'Privacy', 'woo-donation-popup' ),
			Admin_Bootstrap::SLUG_TOOLS     => __( 'Tools', 'woo-donation-popup' ),
			Admin_Bootstrap::SLUG_GUIDE     => __( 'Guide', 'woo-donation-popup' ),
		);
	}

	/**
	 * Bir sayfanın bölümleri: bölüm kimliği => [ başlık, açıklama ].
	 *
	 * @param string $page Sayfa slug'ı.
	 * @return array<string, array{0: string, 1: string}>
	 */
	public static function sections( $page ) {
		$all = array(
			Admin_Bootstrap::SLUG_CAMPAIGNS => array(
				'impact' => array( __( 'Impact phrases', 'woo-donation-popup' ), __( 'Short equivalents shown next to amounts. Only used when the Impact phrases module is on.', 'woo-donation-popup' ) ),
			),
			Admin_Bootstrap::SLUG_FORMS     => array(
				'open'      => array( __( 'How should the form open?', 'woo-donation-popup' ), __( 'Choose how the donation form appears when a donor taps the donate button. On phones it always opens as a bottom sheet. You can override this for each product later.', 'woo-donation-popup' ) ),
				'colors'    => array( __( 'Colors', 'woo-donation-popup' ), __( 'By default the form follows your theme. Pick your own colors only if you need to.', 'woo-donation-popup' ) ),
				'amounts'   => array( __( 'Amounts', 'woo-donation-popup' ), __( 'Quick amount buttons shown above the free amount field.', 'woo-donation-popup' ) ),
				'fields'    => array( __( 'Form fields', 'woo-donation-popup' ), __( 'Optional fields the donor can fill in. Whatever donors type is saved on the order exactly as typed.', 'woo-donation-popup' ) ),
				'shares'    => array( __( 'Share-based donations', 'woo-donation-popup' ), __( 'Wording for products where donors buy shares and enter shareholder names.', 'woo-donation-popup' ) ),
				'placement' => array( __( 'Product pages and lists', 'woo-donation-popup' ), __( 'Where the donate button appears. Shortcodes and blocks always work anywhere.', 'woo-donation-popup' ) ),
			),
			Admin_Bootstrap::SLUG_CHECKOUT  => array(
				'cart'   => array( __( 'Add-on donation', 'woo-donation-popup' ), __( 'Offer one extra donation product next to the main gift.', 'woo-donation-popup' ) ),
				'thanks' => array( __( 'Thank-you screen', 'woo-donation-popup' ), __( 'Shown after the order. Only used when the Thank-you screen module is on.', 'woo-donation-popup' ) ),
				'tax'    => array( __( 'Tax relief declaration', 'woo-donation-popup' ), __( 'One question at checkout. Only used when the Tax relief module is on.', 'woo-donation-popup' ) ),
			),
			Admin_Bootstrap::SLUG_TOOLS     => array(
				'data'    => array( __( 'Data', 'woo-donation-popup' ), __( 'What happens to plugin data when you delete the plugin.', 'woo-donation-popup' ) ),
				'network' => array( __( 'Visitor address', 'woo-donation-popup' ), __( 'Only needed when your site sits behind a proxy or CDN.', 'woo-donation-popup' ) ),
			),
			Admin_Bootstrap::SLUG_PRIVACY   => array(
				'notice' => array( __( 'Privacy link under the form', 'woo-donation-popup' ), __( 'The plugin does not write privacy text. It only shows a short link to the page you wrote on your site.', 'woo-donation-popup' ) ),
			),
		);
		return isset( $all[ $page ] ) ? $all[ $page ] : array();
	}

	/**
	 * Tüm alanlar.
	 *
	 * Alan: page, section, label, help, type (switch|text|textarea|select|color|int|presets), default (Core şemasından),
	 * options (select), legacy [ option, key, kind (raw|flag01|yesno|map), map ], only_when [ alan, değer ].
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function fields() {
		$f = array();

		$f['impact.map'] = array(
			'page'    => Admin_Bootstrap::SLUG_CAMPAIGNS,
			'section' => 'impact',
			'label'   => __( 'Impact phrases', 'woo-donation-popup' ),
			'help'    => __( 'One per line: amount = phrase. Add "singular|plural" for two forms. Example: 25 = 1 food parcel|food parcels', 'woo-donation-popup' ),
			'type'    => 'textarea',
		);

		$f['display.mode'] = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'open',
			'label'   => __( 'Form style', 'woo-donation-popup' ),
			'help'    => __( 'Side panel is recommended: it opens from the right on desktop and from the bottom on phones.', 'woo-donation-popup' ),
			'type'    => 'cards',
			'options' => array(
				'panel'  => array( __( 'Side panel', 'woo-donation-popup' ), __( 'Recommended. Opens from the bottom on phones.', 'woo-donation-popup' ) ),
				'popup'  => array( __( 'Centered window', 'woo-donation-popup' ), __( 'For short forms.', 'woo-donation-popup' ) ),
				'inline' => array( __( 'In the page', 'woo-donation-popup' ), __( 'The form stays open on the page.', 'woo-donation-popup' ) ),
			),
			'legacy'  => array(
				'option' => 'wdp_placement_settings',
				'key'    => 'display',
				'kind'   => 'map',
				'map'    => array(
					'panel'  => 'button_panel',
					'popup'  => 'button_popup',
					'inline' => 'inline',
				),
			),
		);

		$f['design.colors']      = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'colors',
			'label'   => __( 'Colors', 'woo-donation-popup' ),
			'help'    => __( 'Use my theme colors: the form follows your site colors and font automatically.', 'woo-donation-popup' ),
			'type'    => 'select',
			'options' => array(
				'theme'  => __( 'Use my theme colors', 'woo-donation-popup' ),
				'custom' => __( 'Choose my own colors', 'woo-donation-popup' ),
			),
		);
		$f['design.brand']       = array(
			'page'          => Admin_Bootstrap::SLUG_FORMS,
			'section'       => 'colors',
			'label'         => __( 'Main color', 'woo-donation-popup' ),
			'help'          => __( 'Headings, selected amounts and progress bars. Used only when you choose your own colors.', 'woo-donation-popup' ) . ' ' . self::color_hint(),
			'type'          => 'color',
			'text_contrast' => true,
			'only_when'     => array( 'design.colors', 'custom' ),
			'legacy'        => array(
				'option' => 'wdp_button_settings',
				'key'    => 'brand_color',
				'kind'   => 'raw',
			),
		);
		$f['design.accent']      = array(
			'page'      => Admin_Bootstrap::SLUG_FORMS,
			'section'   => 'colors',
			'label'     => __( 'Button color', 'woo-donation-popup' ),
			'help'      => __( 'The main donate button. Choose a color that keeps white text easy to read.', 'woo-donation-popup' ) . ' ' . self::color_hint(),
			'type'      => 'color',
			'only_when' => array( 'design.colors', 'custom' ),
			'legacy'    => array(
				'option' => 'wdp_button_settings',
				'key'    => 'popup_button_color',
				'kind'   => 'raw',
			),
		);
		$f['design.button_text'] = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'colors',
			'label'   => __( 'Donate button text', 'woo-donation-popup' ),
			'help'    => __( 'Leave empty to use the built-in, translated wording.', 'woo-donation-popup' ),
			'type'    => 'text',
			'legacy'  => array(
				'option' => 'wdp_button_settings',
				'key'    => 'popup_button_text',
				'kind'   => 'raw',
			),
		);

		$f['design.button_full_width'] = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'colors',
			'label'   => __( 'Full-width donate button', 'woo-donation-popup' ),
			'help'    => __( 'Makes the shortcode donate button as wide as its container. Handy on phones.', 'woo-donation-popup' ),
			'type'    => 'switch',
			'legacy'  => array(
				'option' => 'wdp_button_settings',
				'key'    => 'popup_button_full_width',
				'kind'   => 'flag01',
			),
		);
		$f['form.presets_enabled']     = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'amounts',
			'label'   => __( 'Quick amount buttons', 'woo-donation-popup' ),
			'help'    => __( 'Shows ready-made amounts. A product can switch them off for itself.', 'woo-donation-popup' ),
			'type'    => 'switch',
			'legacy'  => array(
				'option' => 'wdp_button_settings',
				'key'    => 'enable_amount_presets',
				'kind'   => 'flag01',
			),
		);
		$f['form.presets']             = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'amounts',
			'label'   => __( 'Amounts', 'woo-donation-popup' ),
			'help'    => __( 'Numbers separated by commas, for example 25, 50, 100. At most six; leave empty for the store default.', 'woo-donation-popup' ),
			'type'    => 'text',
			'legacy'  => array(
				'option' => 'wdp_button_settings',
				'key'    => 'amount_presets',
				'kind'   => 'raw',
			),
		);

		$optional = array(
			'form.donor_email'   => array( 'donor_email', 'enable_donor_email', __( 'Email field', 'woo-donation-popup' ), __( 'Asks for an email address so the donor can get a receipt.', 'woo-donation-popup' ) ),
			'form.dedication'    => array( 'dedication', 'enable_dedication', __( 'On behalf of / dedication', 'woo-donation-popup' ), __( 'Lets donors give in someone\'s name or memory.', 'woo-donation-popup' ) ),
			'form.anonymous'     => array( 'anonymous', 'enable_anonymous', __( 'Anonymous option', 'woo-donation-popup' ), __( 'Hides the donor name on public lists. The order keeps the real name.', 'woo-donation-popup' ) ),
			'form.multi_step'    => array( 'multi_step', 'enable_multi_step', __( 'Two steps', 'woo-donation-popup' ), __( 'Splits the form into amount first, details second.', 'woo-donation-popup' ) ),
			'form.trust_enabled' => array( 'trust_enabled', 'trust_strip_enabled', __( 'Trust line', 'woo-donation-popup' ), __( 'A short reassurance line under the donate button.', 'woo-donation-popup' ) ),
		);
		foreach ( $optional as $id => $def ) {
			$f[ $id ] = array(
				'page'    => Admin_Bootstrap::SLUG_FORMS,
				'section' => 'fields',
				'label'   => $def[2],
				'help'    => $def[3],
				'type'    => 'switch',
				'legacy'  => array(
					'option' => 'wdp_button_settings',
					'key'    => $def[1],
					'kind'   => 'flag01',
				),
			);
		}
		$f['form.dedication_label'] = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'fields',
			'label'   => __( 'Dedication field hint', 'woo-donation-popup' ),
			'help'    => __( 'The hint inside the dedication field. Leave empty for the built-in wording.', 'woo-donation-popup' ),
			'type'    => 'text',
			'legacy'  => array(
				'option' => 'wdp_button_settings',
				'key'    => 'dedication_placeholder',
				'kind'   => 'raw',
			),
		);
		$f['form.trust_text']       = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'fields',
			'label'   => __( 'Trust line wording', 'woo-donation-popup' ),
			'help'    => __( 'Leave empty for the built-in secure payment sentence.', 'woo-donation-popup' ),
			'type'    => 'text',
			'legacy'  => array(
				'option' => 'wdp_button_settings',
				'key'    => 'trust_strip_text',
				'kind'   => 'raw',
			),
		);

		$f['shares.header_text'] = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'shares',
			'label'   => __( 'Shareholder heading', 'woo-donation-popup' ),
			'help'    => __( 'Title above the shareholder name fields. Leave empty for the built-in wording.', 'woo-donation-popup' ),
			'type'    => 'text',
			'legacy'  => array(
				'option' => 'wdp_shareholder_settings',
				'key'    => 'shareholder_header_text',
				'kind'   => 'raw',
			),
		);
		$f['shares.copy_button'] = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'shares',
			'label'   => __( 'Copy shareholder button', 'woo-donation-popup' ),
			'help'    => __( 'Lets donors repeat the first shareholder\'s details quickly.', 'woo-donation-popup' ),
			'type'    => 'switch',
			'legacy'  => array(
				'option' => 'wdp_shareholder_settings',
				'key'    => 'shareholder_enable_copy_button',
				'kind'   => 'flag01',
			),
		);
		$f['shares.email']       = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'shares',
			'label'   => __( 'Shareholder email', 'woo-donation-popup' ),
			'help'    => __( 'Adds an optional email field for each shareholder.', 'woo-donation-popup' ),
			'type'    => 'switch',
			'legacy'  => array(
				'option' => 'wdp_shareholder_settings',
				'key'    => 'shareholder_enable_email',
				'kind'   => 'flag01',
			),
		);

		$yesno                      = array( 'kind' => 'yesno' );
		$f['placement.auto_place']  = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'placement',
			'label'   => __( 'Replace "Add to cart" with the donate button', 'woo-donation-popup' ),
			'help'    => __( 'Uses the standard WooCommerce spots on product pages. If your page layout has no such spot, a fallback button is drawn.', 'woo-donation-popup' ),
			'type'    => 'switch',
			'legacy'  => array_merge(
				array(
					'option' => 'wdp_placement_settings',
					'key'    => 'auto_place',
				),
				$yesno
			),
		);
		$f['placement.position']    = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'placement',
			'label'   => __( 'Position', 'woo-donation-popup' ),
			'help'    => __( 'Where on the product page the donate button goes.', 'woo-donation-popup' ),
			'type'    => 'select',
			'options' => array(
				'replace_cart'  => __( 'Where the add-to-cart button was', 'woo-donation-popup' ),
				'after_excerpt' => __( 'After the short description', 'woo-donation-popup' ),
				'below_summary' => __( 'Below the product summary', 'woo-donation-popup' ),
			),
			'legacy'  => array(
				'option' => 'wdp_placement_settings',
				'key'    => 'position',
				'kind'   => 'raw',
			),
		);
		$f['placement.hide_price']  = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'placement',
			'label'   => __( 'Hide the product price', 'woo-donation-popup' ),
			'help'    => __( 'Donation products usually have no fixed price to show.', 'woo-donation-popup' ),
			'type'    => 'switch',
			'legacy'  => array_merge(
				array(
					'option' => 'wdp_placement_settings',
					'key'    => 'hide_price',
				),
				$yesno
			),
		);
		$f['placement.show_title']  = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'placement',
			'label'   => __( 'Show a title above the in-page form', 'woo-donation-popup' ),
			'help'    => __( 'Only for the "In the page" style.', 'woo-donation-popup' ),
			'type'    => 'switch',
			'legacy'  => array_merge(
				array(
					'option' => 'wdp_placement_settings',
					'key'    => 'show_form_title',
				),
				$yesno
			),
		);
		$f['placement.loop_button'] = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'placement',
			'label'   => __( 'Button in product lists', 'woo-donation-popup' ),
			'help'    => __( 'What the button does in shop and category lists.', 'woo-donation-popup' ),
			'type'    => 'select',
			'options' => array(
				'panel' => __( 'Opens the form panel', 'woo-donation-popup' ),
				'popup' => __( 'Opens a centered window', 'woo-donation-popup' ),
				'link'  => __( 'Links to the product page', 'woo-donation-popup' ),
				'off'   => __( 'No button', 'woo-donation-popup' ),
			),
			'legacy'  => array(
				'option' => 'wdp_placement_settings',
				'key'    => 'loop_button',
				'kind'   => 'raw',
			),
		);
		$f['placement.scope']       = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'placement',
			'label'   => __( 'Which products are donation products', 'woo-donation-popup' ),
			'help'    => __( 'All products, only chosen categories, or only products you mark on the product page.', 'woo-donation-popup' ),
			'type'    => 'select',
			'options' => array(
				'all'        => __( 'All products', 'woo-donation-popup' ),
				'categories' => __( 'Products in chosen categories', 'woo-donation-popup' ),
				'marked'     => __( 'Only products I mark', 'woo-donation-popup' ),
			),
			'legacy'  => array(
				'option' => 'wdp_placement_settings',
				'key'    => 'donation_scope',
				'kind'   => 'raw',
			),
		);
		$f['placement.categories']  = array(
			'page'    => Admin_Bootstrap::SLUG_FORMS,
			'section' => 'placement',
			'label'   => __( 'Category IDs', 'woo-donation-popup' ),
			'help'    => __( 'Used with "chosen categories". Category IDs separated by commas (see Products > Categories).', 'woo-donation-popup' ),
			'type'    => 'text',
			'legacy'  => array(
				'option' => 'wdp_placement_settings',
				'key'    => 'donation_categories',
				'kind'   => 'idlist',
			),
		);

		$f['checkout.addon_product_id'] = array(
			'page'    => Admin_Bootstrap::SLUG_CHECKOUT,
			'section' => 'cart',
			'label'   => __( 'Add-on product ID', 'woo-donation-popup' ),
			'help'    => __( 'The WooCommerce product ID of the extra donation. Leave 0 to offer none. A product can set its own add-on.', 'woo-donation-popup' ),
			'type'    => 'int',
			'legacy'  => array(
				'option' => 'wdp_success_settings',
				'key'    => 'sadaka_wc_product_id',
				'kind'   => 'raw',
			),
		);
		$f['checkout.addon_label']      = array(
			'page'    => Admin_Bootstrap::SLUG_CHECKOUT,
			'section' => 'cart',
			'label'   => __( 'Add-on label', 'woo-donation-popup' ),
			'help'    => __( 'The wording of the switch donors see. Leave empty for the built-in wording.', 'woo-donation-popup' ),
			'type'    => 'text',
			'legacy'  => array(
				'option' => 'wdp_success_settings',
				'key'    => 'sadaka_toggle_label',
				'kind'   => 'raw',
			),
		);

		$f['thanks.message']   = array(
			'page'    => Admin_Bootstrap::SLUG_CHECKOUT,
			'section' => 'thanks',
			'label'   => __( 'Thank-you message', 'woo-donation-popup' ),
			'help'    => __( 'Shown on the thank-you screen after a donation. Leave empty for the built-in wording.', 'woo-donation-popup' ),
			'type'    => 'textarea',
		);
		$f['thanks.celebrate'] = array(
			'page'    => Admin_Bootstrap::SLUG_CHECKOUT,
			'section' => 'thanks',
			'label'   => __( 'Celebration animation', 'woo-donation-popup' ),
			'help'    => __( 'A short, gentle animation. It switches off by itself for visitors who prefer reduced motion.', 'woo-donation-popup' ),
			'type'    => 'switch',
		);
		$f['thanks.share']     = array(
			'page'    => Admin_Bootstrap::SLUG_CHECKOUT,
			'section' => 'thanks',
			'label'   => __( 'Share button', 'woo-donation-popup' ),
			'help'    => __( 'Lets donors share the campaign after giving.', 'woo-donation-popup' ),
			'type'    => 'switch',
		);

		$tax = array(
			'step_label'     => array( __( 'Step title', 'woo-donation-popup' ), __( 'Short label for the step.', 'woo-donation-popup' ), 'text' ),
			'title'          => array( __( 'Heading', 'woo-donation-popup' ), __( 'The question heading the donor sees.', 'woo-donation-popup' ), 'text' ),
			'text'           => array( __( 'Explanation', 'woo-donation-popup' ), __( 'A sentence or two explaining the declaration.', 'woo-donation-popup' ), 'textarea' ),
			'checkbox_label' => array( __( 'Checkbox wording', 'woo-donation-popup' ), __( 'The sentence next to the tick box. It is never ticked in advance.', 'woo-donation-popup' ), 'text' ),
		);
		foreach ( $tax as $key => $def ) {
			$f[ 'tax_relief.' . $key ] = array(
				'page'    => Admin_Bootstrap::SLUG_CHECKOUT,
				'section' => 'tax',
				'label'   => $def[0],
				'help'    => $def[1],
				'type'    => $def[2],
			);
		}

		$f['general.trusted_proxies'] = array(
			'page'    => Admin_Bootstrap::SLUG_TOOLS,
			'section' => 'network',
			'label'   => __( 'Trusted proxy addresses', 'woo-donation-popup' ),
			'help'    => __( 'Leave empty unless your site runs behind a proxy or CDN. One address or range per line (for example 10.0.0.0/8). Visitor addresses sent by these proxies are then used to tell visitors apart for rate limits. Never list addresses you do not control.', 'woo-donation-popup' ),
			'type'    => 'textarea',
		);

		$f['direct.enabled'] = array(
			'page'    => Admin_Bootstrap::SLUG_CHECKOUT,
			'section' => 'cart',
			'label'   => __( 'Skip the cart (direct donation)', 'woo-donation-popup' ),
			'help'    => __( 'The donor goes from the form straight to payment. Nothing is added to the cart, so a cart the donor already has stays untouched. You can override this for each product. If your site runs behind a proxy or CDN, set the trusted proxy addresses under Tools so visitors can be told apart.', 'woo-donation-popup' ),
			'type'    => 'switch',
		);

		$f['side_cart.floating'] = array(
			'page'    => Admin_Bootstrap::SLUG_CHECKOUT,
			'section' => 'cart',
			'label'   => __( 'Floating basket button', 'woo-donation-popup' ),
			'help'    => __( 'A round basket button in the bottom corner. It appears only after a gift is added and disappears when the basket is empty. Switch it off if your theme already shows its own cart icon.', 'woo-donation-popup' ),
			'type'    => 'switch',
		);

		$f['form.privacy_notice'] = array(
			'page'    => Admin_Bootstrap::SLUG_PRIVACY,
			'section' => 'notice',
			'label'   => __( 'Show a privacy link under the form', 'woo-donation-popup' ),
			'help'    => __( 'Shown only when the form asks for email, dedication or shareholder details.', 'woo-donation-popup' ),
			'type'    => 'switch',
			'legacy'  => array(
				'option' => 'wdp_button_settings',
				'key'    => 'enable_privacy_notice',
				'kind'   => 'flag01',
			),
		);
		$f['form.privacy_text']   = array(
			'page'    => Admin_Bootstrap::SLUG_PRIVACY,
			'section' => 'notice',
			'label'   => __( 'Link text', 'woo-donation-popup' ),
			'help'    => __( 'Leave empty for the built-in wording.', 'woo-donation-popup' ),
			'type'    => 'text',
			'legacy'  => array(
				'option' => 'wdp_button_settings',
				'key'    => 'privacy_notice_text',
				'kind'   => 'raw',
			),
		);
		$f['form.privacy_url']    = array(
			'page'    => Admin_Bootstrap::SLUG_PRIVACY,
			'section' => 'notice',
			'label'   => __( 'Link address', 'woo-donation-popup' ),
			'help'    => __( 'Leave empty to use the privacy policy page set in WordPress.', 'woo-donation-popup' ),
			'type'    => 'url',
			'legacy'  => array(
				'option' => 'wdp_button_settings',
				'key'    => 'privacy_notice_url',
				'kind'   => 'raw',
			),
		);

		$f['general.delete_data_on_uninstall'] = array(
			'page'    => Admin_Bootstrap::SLUG_TOOLS,
			'section' => 'data',
			'label'   => __( 'Delete plugin data when the plugin is deleted', 'woo-donation-popup' ),
			'help'    => __( 'Removes the plugin\'s settings and product options. Orders and order records are never touched. This cannot be undone.', 'woo-donation-popup' ),
			'type'    => 'switch',
			'confirm' => __( 'All plugin settings and product options will be deleted when the plugin is deleted. Orders are not affected. This cannot be undone. Have you made a backup?', 'woo-donation-popup' ),
			'legacy'  => array(
				'option' => 'wdp_delete_data_on_uninstall',
				'key'    => '',
				'kind'   => 'flag01',
			),
		);

		return $f;
	}

	/**
	 * Bir sayfanın alanları.
	 *
	 * @param string $page Sayfa slug'ı.
	 * @return array<string, array<string, mixed>>
	 */
	public static function fields_for( $page ) {
		$out = array();
		foreach ( self::fields() as $id => $spec ) {
			if ( $spec['page'] === $page ) {
				$out[ $id ] = $spec;
			}
		}
		return $out;
	}

	/**
	 * Renk alanlarının ortak ipucu: hex ya da CSS değişkeni (tema/sayfa oluşturucu renkleri eklentiye özel kod olmadan bağlanır).
	 *
	 * @return string
	 */
	private static function color_hint() {
		return __( 'Hex or CSS variable (e.g. var(--e-global-color-primary)).', 'woo-donation-popup' );
	}
}

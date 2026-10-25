<?php
/**
 * Ayarlar → Ürün sayfası ve liste sekmesi: kapsam, WooCommerce sayfaları, schema ve kurulum rehberi.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Renders and (via AJAX) saves wdp_placement_settings.
 */
class WDP_Admin_Placement_Tab_Renderer {

	/**
	 * @return void
	 */
	public static function render_tab() {
		$s      = WDP_Placement_Settings::get();
		$count  = class_exists( 'WDP_Donation_Scope' ) ? WDP_Donation_Scope::count() : 0;
		$cats   = self::product_categories();
		$rank   = defined( 'RANK_MATH_VERSION' ) || class_exists( 'RankMath' );
		$matrix = wp_nonce_url( home_url( '/?wdp_form_matrix=1' ), 'wdp_form_matrix', 'wdp_matrix_nonce' );

		echo '<div class="wdp-settings-container">';
		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__( 'Product page and list', 'woo-donation-popup' ) . '</p><ul class="wdp-tab-help__list">';
		echo '<li>' . esc_html__( 'From here you manage which products count as donation products and the “Donate” behavior on WooCommerce shop / product pages.', 'woo-donation-popup' ) . '</li>';
		echo '</ul></div>';

		echo '<form id="wdp-placement-settings-form" class="wdp-admin-settings-form" method="post" data-wdp-ajax-action="wdp_save_placement_settings">';

		echo '<h2 class="wdp-section-title">' . esc_html__( 'Donation products', 'woo-donation-popup' ) . '</h2>';
		echo '<p class="description">' . esc_html(
			sprintf(
			/* translators: %d: live count */
				__( '%d products are currently donation products.', 'woo-donation-popup' ),
				$count
			)
		) . '</p>';
		echo '<table class="form-table" role="presentation"><tbody>';
		self::select_row(
			'donation_scope',
			$s['donation_scope'],
			__( 'Scope', 'woo-donation-popup' ),
			__( 'Which simple products use the donation form.', 'woo-donation-popup' ),
			array(
				'all'        => __( 'All simple products', 'woo-donation-popup' ),
				'categories' => __( 'Selected categories (including children)', 'woo-donation-popup' ),
				'marked'     => __( 'Marked products only', 'woo-donation-popup' ),
			)
		);
		echo '<tr><th scope="row"><label for="wdp_donation_categories">' . esc_html__( 'Categories', 'woo-donation-popup' ) . '</label></th><td>';
		echo '<select id="wdp_donation_categories" name="donation_categories[]" multiple size="6" style="min-width:240px">';
		foreach ( $cats as $id => $name ) {
			echo '<option value="' . esc_attr( (string) $id ) . '"' . selected( in_array( (int) $id, (array) $s['donation_categories'], true ), true, false ) . '>' . esc_html( $name ) . '</option>';
		}
		echo '</select>';
		echo '<p class="description">' . esc_html__( 'Used when scope is “selected categories”. Child categories are included automatically.', 'woo-donation-popup' ) . '</p>';
		echo '</td></tr>';
		echo '</tbody></table>';

		echo '<h2 class="wdp-section-title">' . esc_html__( 'WooCommerce pages', 'woo-donation-popup' ) . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		self::select_row(
			'auto_place',
			$s['auto_place'],
			__( 'Use “Donate” instead of “Add to cart” on WooCommerce pages', 'woo-donation-popup' ),
			__( 'When on, the add-to-cart area on shop and product pages becomes a donate button or form.', 'woo-donation-popup' ),
			array(
				'yes' => __( 'On', 'woo-donation-popup' ),
				'no'  => __( 'Off', 'woo-donation-popup' ),
			)
		);
		self::select_row(
			'display',
			$s['display'],
			__( 'Display on the product page', 'woo-donation-popup' ),
			'',
			array(
				'inline'       => __( 'Inline form', 'woo-donation-popup' ),
				'button_popup' => __( 'Button + popup', 'woo-donation-popup' ),
				'button_panel' => __( 'Button + side panel', 'woo-donation-popup' ),
			)
		);
		self::select_row(
			'loop_button',
			$s['loop_button'],
			__( 'Button on shop and category pages', 'woo-donation-popup' ),
			'',
			array(
				'link'  => __( 'Go to the product page', 'woo-donation-popup' ),
				'popup' => __( 'Centered popup', 'woo-donation-popup' ),
				'panel' => __( 'Side panel', 'woo-donation-popup' ),
			)
		);
		self::select_row(
			'hide_price',
			$s['hide_price'],
			__( 'Price display', 'woo-donation-popup' ),
			__( 'Prices in the cart, checkout, and emails do not change.', 'woo-donation-popup' ),
			array(
				'yes' => __( 'Show on fixed-amount and share-based products, hide on others', 'woo-donation-popup' ),
				'no'  => __( 'Always show', 'woo-donation-popup' ),
			)
		);
		self::select_row(
			'show_form_title',
			$s['show_form_title'],
			__( 'Show the form heading', 'woo-donation-popup' ),
			__( 'Off by default because the product page already has a title.', 'woo-donation-popup' ),
			array(
				'yes' => __( 'Yes', 'woo-donation-popup' ),
				'no'  => __( 'No', 'woo-donation-popup' ),
			)
		);
		echo '</tbody></table>';

		echo '<h2 class="wdp-section-title">' . esc_html__( 'Structured data (schema)', 'woo-donation-popup' ) . '</h2>';
		if ( $rank ) {
			echo '<p class="description">' . esc_html__( 'Rank Math detected, compatibility is on.', 'woo-donation-popup' ) . '</p>';
		}
		echo '<table class="form-table" role="presentation"><tbody>';
		self::select_row(
			'schema',
			$s['schema'],
			__( 'Product markup', 'woo-donation-popup' ),
			__( 'Automatic: Product markup is not printed on donor-entered and campaign products that have no price. A wdp_product_schema filter is provided for Yoast / SEOPress / AIOSEO.', 'woo-donation-popup' ),
			array(
				'auto' => __( 'Automatic', 'woo-donation-popup' ),
				'off'  => __( 'Off', 'woo-donation-popup' ),
			)
		);
		echo '</tbody></table>';

		echo '<h2 class="wdp-section-title">' . esc_html__( 'Setup guide', 'woo-donation-popup' ) . '</h2>';
		echo '<ol class="wdp-tab-help__list">';
		echo '<li><strong>' . esc_html__( 'I am using WooCommerce pages', 'woo-donation-popup' ) . '</strong><br>';
		echo esc_html__( 'Leave the setting above On. You do not need to do anything else; the Shop page and product pages become donation pages automatically.', 'woo-donation-popup' );
		echo '</li>';
		echo '<li><strong>' . esc_html__( 'My product page uses a custom page builder template', 'woo-donation-popup' ) . '</strong><br>';
		echo esc_html__( 'If the template has WooCommerce’s Add to cart element, it is converted to Donate automatically. Otherwise add this shortcode to the template once:', 'woo-donation-popup' );
		echo ' ';
		self::copy_inline( '[wdp_donation_button_panel]' );
		echo '<br>' . esc_html__( 'Page builder: open the product template, add a Shortcode (or Code) element, paste it, and save.', 'woo-donation-popup' );
		echo '</li>';
		echo '<li><strong>' . esc_html__( 'I am building my own donation page', 'woo-donation-popup' ) . '</strong><br>';
		echo esc_html__( 'For a list:', 'woo-donation-popup' ) . ' ';
		self::copy_inline( '[wdp_donations]' );
		echo ' ' . esc_html__( '(or the “Donation list” block in the block editor). For a single product:', 'woo-donation-popup' ) . ' ';
		self::copy_inline( '[wdp_donation_button_panel slug="urun-kisa-adi"]' );
		echo '</li>';
		echo '</ol>';
		echo '<p><a class="button" href="' . esc_url( $matrix ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Open the form test page', 'woo-donation-popup' ) . '</a></p>';

		echo '<p class="submit">';
		submit_button( __( 'Save placement settings', 'woo-donation-popup' ), 'primary', 'submit', false, array( 'id' => 'wdp-save-placement-settings' ) );
		echo '<span class="spinner"></span>';
		echo '</p>';
		echo '</form>';
		echo '</div>';
	}

	/**
	 * @param string               $key     Field.
	 * @param string               $value   Value.
	 * @param string               $label   Label.
	 * @param string               $help    Description.
	 * @param array<string,string> $options Options.
	 * @return void
	 */
	private static function select_row( $key, $value, $label, $help, array $options ) {
		echo '<tr><th scope="row"><label for="wdp_' . esc_attr( $key ) . '">' . esc_html( $label ) . '</label></th><td>';
		echo '<select name="' . esc_attr( $key ) . '" id="wdp_' . esc_attr( $key ) . '">';
		foreach ( $options as $opt => $text ) {
			echo '<option value="' . esc_attr( $opt ) . '"' . selected( $value, $opt, false ) . '>' . esc_html( $text ) . '</option>';
		}
		echo '</select>';
		if ( $help !== '' ) {
			echo '<p class="description">' . esc_html( $help ) . '</p>';
		}
		echo '</td></tr>';
	}

	/**
	 * @param string $code Shortcode.
	 * @return void
	 */
	private static function copy_inline( $code ) {
		echo '<code>' . esc_html( $code ) . '</code> ';
		echo '<button type="button" class="button button-small" data-wdp-copy="' . esc_attr( $code ) . '">' . esc_html__( 'Copy', 'woo-donation-popup' ) . '</button>';
	}

	/**
	 * @return array<int, string>
	 */
	private static function product_categories() {
		if ( ! function_exists( 'get_terms' ) ) {
			return array();
		}
		$terms = get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'hide_empty' => false,
			)
		);
		if ( is_wp_error( $terms ) || ! is_array( $terms ) ) {
			return array();
		}
		$out = array();
		foreach ( $terms as $term ) {
			$out[ (int) $term->term_id ] = $term->name;
		}
		return $out;
	}
}

<?php
/**
 * Otomatik yerleşim: Woo standart kancalarıyla ürün sayfasında bağış girişi (şablon, özet kancaları, blok, gizleme).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Domain\Placement_Settings;

defined( 'ABSPATH' ) || exit;

/**
 * WooCommerce standart kancalarıyla otomatik yerleşim.
 */
class Auto_Placement {

	/** Relative WooCommerce template we override. */
	const SIMPLE_ATC_TEMPLATE = 'single-product/add-to-cart/simple.php';

	/** @var bool */
	private static $css_printed = false;

	/** @var bool Template filter returned our file at least once this request. */
	private static $template_override_used = false;

	/** @var bool Filters registered for this request. */
	private static $hooks_added = false;

	/**
	 * Front-end only. WooCommerce filters are registered only when the setting is on.
	 *
	 * @return void
	 */
	public static function init() {
		if ( is_admin() && ! ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() ) ) {
			return;
		}

		if ( Placement_Settings::value( 'auto_place' ) !== 'yes' ) {
			return;
		}

		self::$hooks_added = true;

		add_action( 'wp', array( __CLASS__, 'on_wp' ), 20 );
		add_filter( 'body_class', array( __CLASS__, 'body_class' ) );
		add_filter( 'post_class', array( __CLASS__, 'post_class' ), 10, 3 );
		add_action( 'wp_head', array( __CLASS__, 'print_hide_cart_css' ), 30 );

		add_filter( 'wc_get_template', array( __CLASS__, 'filter_wc_get_template' ), 20, 2 );
		add_filter( 'woocommerce_locate_template', array( __CLASS__, 'filter_locate_template' ), 20, 2 );

		add_filter( 'woocommerce_get_price_html', array( Loop_Price_Filters::class, 'filter_price_html' ), 20, 2 );
		add_filter( 'woocommerce_loop_add_to_cart_link', array( Loop_Price_Filters::class, 'filter_loop_add_to_cart' ), 10, 3 );
		add_filter( 'woocommerce_product_add_to_cart_text', array( Loop_Price_Filters::class, 'filter_add_to_cart_text' ), 20, 2 );
		add_filter( 'woocommerce_product_add_to_cart_url', array( Loop_Price_Filters::class, 'filter_add_to_cart_url' ), 20, 2 );
		add_filter( 'woocommerce_product_supports', array( Loop_Price_Filters::class, 'filter_product_supports' ), 20, 3 );

		add_filter( 'render_block_woocommerce/add-to-cart-form', array( __CLASS__, 'filter_block_add_to_cart' ), 10, 3 );
		add_filter( 'render_block_woocommerce/add-to-cart-with-options', array( __CLASS__, 'filter_block_add_to_cart' ), 10, 3 );
		add_filter( 'render_block_woocommerce/product-price', array( Loop_Price_Filters::class, 'filter_block_price' ), 10, 3 );
		add_filter( 'render_block_woocommerce/product-button', array( Loop_Price_Filters::class, 'filter_block_product_button' ), 10, 3 );

		// Late on purpose: any shortcode/block/widget/snippet entry drawn earlier on the page wins.
		add_action( 'woocommerce_after_single_product', array( Fallback_Button::class, 'render_builder_fallback' ), Fallback_Button::FALLBACK_PRIORITY );
		add_action( 'wp_footer', array( Fallback_Button::class, 'render_builder_fallback' ), 4 );
	}

	/**
	 * @return bool
	 */
	public static function hooks_added() {
		return self::$hooks_added;
	}

	/**
	 * @return bool
	 */
	public static function template_override_used() {
		return self::$template_override_used;
	}

	/**
	 * Register fallback summary placement after we know the queried product.
	 *
	 * @return void
	 */
	public static function on_wp() {
		if ( ! function_exists( 'is_product' ) || ! is_product() ) {
			return;
		}
		$product = Product_Resolver::current_product();
		if ( ! $product || ! Donation_Scope::is_donation_product( $product ) ) {
			return;
		}

		self::unhook_native_single_add_to_cart();

		if ( ! self::should_auto_place( $product ) ) {
			return;
		}

		// Backup only: if the template filter never runs, still try summary hooks.
		$position = (string) Placement_Settings::value( 'position', 'replace_cart' );
		if ( 'below_summary' === $position ) {
			add_action( 'woocommerce_after_single_product_summary', array( Fallback_Button::class, 'render_fallback_placed_form' ), 5 );
			return;
		}
		$priority = ( 'after_excerpt' === $position ) ? 21 : 30;
		add_action( 'woocommerce_single_product_summary', array( Fallback_Button::class, 'render_fallback_placed_form' ), $priority );
	}

	/**
	 * Swap the simple add-to-cart template for donation products.
	 *
	 * @param string $template      Located path.
	 * @param string $template_name Relative name.
	 * @return string
	 */
	public static function filter_wc_get_template( $template, $template_name ) {
		if ( self::SIMPLE_ATC_TEMPLATE !== (string) $template_name ) {
			return $template;
		}
		if ( ! self::should_override_current_product() ) {
			return $template;
		}
		$path = self::plugin_simple_template_path();
		if ( '' === $path || ! is_readable( $path ) ) {
			return $template;
		}
		self::$template_override_used = true;
		return $path;
	}

	/**
	 * Secondary locate filter for themes that bypass wc_get_template.
	 *
	 * @param string $template      Located path.
	 * @param string $template_name Relative name.
	 * @return string
	 */
	public static function filter_locate_template( $template, $template_name ) {
		if ( self::SIMPLE_ATC_TEMPLATE !== (string) $template_name ) {
			return $template;
		}
		if ( ! self::should_override_current_product() ) {
			return $template;
		}
		$path = self::plugin_simple_template_path();
		if ( '' === $path || ! is_readable( $path ) ) {
			return $template;
		}
		self::$template_override_used = true;
		return $path;
	}

	/**
	 * Absolute path to the plugin's simple add-to-cart override.
	 *
	 * @return string
	 */
	public static function plugin_simple_template_path() {
		if ( ! defined( 'WDP_PLUGIN_DIR' ) ) {
			return '';
		}
		return WDP_PLUGIN_DIR . 'templates/woocommerce/' . self::SIMPLE_ATC_TEMPLATE;
	}

	/**
	 * Echo donation UI from the overridden WooCommerce template.
	 *
	 * @return void
	 */
	public static function render_template_override() {
		echo Render_Guard::html( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			static function () {
				return self::template_override_markup();
			},
			Product_Resolver::current_product_id(),
			'template_override'
		);
	}

	/**
	 * @return string
	 */
	public static function template_override_markup() {
		$product = Product_Resolver::current_product();
		if ( ! $product || ! Donation_Scope::is_donation_product( $product ) ) {
			return '';
		}
		$id = (int) $product->get_id();
		if ( Render_Registry::has_product_ui( $id ) ) {
			return Render_Registry::duplicate_ui_notice( $id );
		}
		if ( ! self::should_auto_place( $product ) ) {
			return '';
		}
		return self::placed_markup();
	}

	/**
	 * @param string[] $classes Body classes.
	 * @return string[]
	 */
	public static function body_class( $classes ) {
		$classes = is_array( $classes ) ? $classes : array();
		if ( function_exists( 'is_product' ) && is_product() ) {
			$product = Product_Resolver::current_product();
			if ( $product && Donation_Scope::is_donation_product( $product ) ) {
				$classes[] = 'wdp-donation-product';
			}
		}
		return $classes;
	}

	/**
	 * @param string[] $classes CSS classes.
	 * @param string[] $extra   Extra classes.
	 * @param int      $post_id Post ID.
	 * @return string[]
	 */
	public static function post_class( $classes, $extra = array(), $post_id = 0 ) {
		$classes = is_array( $classes ) ? $classes : array();
		$post_id = absint( $post_id );
		if ( $post_id <= 0 ) {
			return $classes;
		}
		if ( Donation_Scope::is_donation_product( $post_id ) ) {
			$classes[] = 'wdp-donation-product';
		}
		return $classes;
	}

	/**
	 * Remove WooCommerce's native single-product add-to-cart output.
	 * Does not touch woocommerce_is_purchasable (plugin form still adds to cart).
	 * Sticky/clone callbacks matching add-to-cart + sticky are unhooked without theme CSS selectors.
	 *
	 * @return int Number of matching sticky callbacks removed from $wp_filter.
	 */
	public static function unhook_native_single_add_to_cart() {
		if ( ! function_exists( 'remove_action' ) ) {
			return 0;
		}
		remove_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_add_to_cart', 30 );
		remove_action( 'woocommerce_after_single_product_summary', 'woocommerce_template_single_add_to_cart', 30 );
		remove_action( 'woocommerce_before_single_product_summary', 'woocommerce_template_single_add_to_cart', 30 );
		remove_action( 'woocommerce_after_single_product', 'woocommerce_template_single_add_to_cart', 30 );
		return self::unhook_callbacks_matching( '/sticky.*add.?to.?cart|add.?to.?cart.*sticky/i' );
	}

	/**
	 * Drop any hook callback whose function name looks like a sticky add-to-cart clone.
	 *
	 * @param string $pattern PCRE against the callable name.
	 * @return int
	 */
	public static function unhook_callbacks_matching( $pattern ) {
		if ( ! function_exists( 'remove_action' ) || ! is_string( $pattern ) || '' === $pattern ) {
			return 0;
		}
		global $wp_filter;
		if ( ! isset( $wp_filter ) || ( ! is_array( $wp_filter ) && ! is_object( $wp_filter ) ) ) {
			return 0;
		}
		$removed = 0;
		foreach ( $wp_filter as $hook => $hook_obj ) {
			$by_priority = array();
			if ( is_object( $hook_obj ) && isset( $hook_obj->callbacks ) && is_array( $hook_obj->callbacks ) ) {
				$by_priority = $hook_obj->callbacks;
			} elseif ( is_array( $hook_obj ) ) {
				$by_priority = $hook_obj;
			}
			foreach ( $by_priority as $priority => $callbacks ) {
				if ( ! is_array( $callbacks ) ) {
					continue;
				}
				foreach ( $callbacks as $entry ) {
					$fn   = ( is_array( $entry ) && array_key_exists( 'function', $entry ) ) ? $entry['function'] : $entry;
					$name = '';
					if ( is_string( $fn ) ) {
						$name = $fn;
					} elseif ( is_array( $fn ) && isset( $fn[1] ) && is_string( $fn[1] ) ) {
						$name = $fn[1];
					}
					if ( '' === $name || ! preg_match( $pattern, $name ) ) {
						continue;
					}
					if ( remove_action( (string) $hook, $fn, (int) $priority ) ) {
						++$removed;
					}
				}
			}
		}
		return $removed;
	}

	/**
	 * Hide a theme-reintroduced native cart form (plugin form/button keep their classes).
	 *
	 * @return void
	 */
	public static function print_hide_cart_css() {
		if ( self::$css_printed ) {
			return;
		}
		if ( ! function_exists( 'is_product' ) || ! is_product() ) {
			return;
		}
		$product = Product_Resolver::current_product();
		if ( ! $product || ! Donation_Scope::is_donation_product( $product ) ) {
			return;
		}
		self::$css_printed = true;
		echo '<style id="wdp-hide-native-cart">' . self::hide_native_cart_css() . '</style>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Hide the main product native cart form and sticky clones; spare loop/related/upsell/collection.
	 * No theme-specific class names are used.
	 *
	 * @return string
	 */
	public static function hide_native_cart_css() {
		$loop_form = ':not(.related form.cart):not(.upsells form.cart):not(ul.products form.cart)'
			. ':not(.wdp-list form.cart):not(.wdp-donations form.cart)'
			. ':not(.wp-block-woocommerce-related-products form.cart)'
			. ':not(.wp-block-woocommerce-product-collection form.cart)';
		$form      = 'body.single-product form.cart:not(.wdp-form):not(.wdp-donation-form-fields)' . $loop_form;
		$loop_btn  = ':not(.related .single_add_to_cart_button):not(.upsells .single_add_to_cart_button)'
			. ':not(ul.products .single_add_to_cart_button)'
			. ':not(.wp-block-woocommerce-related-products .single_add_to_cart_button)'
			. ':not(.wp-block-woocommerce-product-collection .single_add_to_cart_button)';
		$btn       = 'body.single-product .single_add_to_cart_button:not(.wdp-donate-button):not(.wdp-open-modal):not(.wdp-loop-donate)' . $loop_btn;
		$sticky    = 'body.single-product [class*="sticky-add-to-cart"],body.single-product [class*="sticky"][class*="add-to-cart"]';
		return $form . ',' . $btn . ',' . $sticky . '{display:none!important}';
	}

	/**
	 * @return string
	 */
	public static function placed_markup() {
		$product = Product_Resolver::current_product();
		if ( ! $product || ! Donation_Scope::is_donation_product( $product ) ) {
			return '';
		}
		if ( self::content_already_has_shortcode( $product ) ) {
			return '';
		}
		$display = self::resolve_product_page_display( $product );
		$atts    = array(
			'show_title' => Placement_Settings::value( 'show_form_title' ) === 'yes' ? 'yes' : 'no',
		);
		$html    = '';
		if ( 'button_popup' === $display ) {
			$html = Shortcodes::render_button( $atts, 'wdp_donation_button', 'popup' );
		} elseif ( 'button_panel' === $display ) {
			$html = Shortcodes::render_button( $atts, 'wdp_donation_button_panel', 'side_panel' );
		} elseif ( 'inline' === $display ) {
			$html = Shortcodes::render_form( $atts );
		}
		if ( '' !== $html && Render_Registry::has_product_ui( (int) $product->get_id() ) ) {
			// Drawn by auto-placement: a later explicit entry for the same product is skipped (one entry per page).
			Render_Registry::mark_auto( (int) $product->get_id() );
		}
		return $html;
	}

	/**
	 * Product page UI: shortcode in content/excerpt wins, else placement display when auto-place is on.
	 *
	 * @param \WC_Product $product Product.
	 * @return string inline|button_popup|button_panel|''
	 */
	public static function resolve_product_page_display( $product ) {
		if ( ! Product_Resolver::is_wc_product( $product ) || ! Donation_Scope::is_donation_product( $product ) ) {
			return '';
		}
		$text = (string) $product->get_short_description() . "\n" . (string) $product->get_description();
		if ( self::text_has_named_shortcode( $text, 'wdp_donation_form' ) ) {
			return 'inline';
		}
		if ( self::text_has_named_shortcode( $text, 'wdp_donation_button_panel' ) ) {
			return 'button_panel';
		}
		if ( self::text_has_named_shortcode( $text, 'wdp_donation_button' ) ) {
			return 'button_popup';
		}
		if ( ! self::should_auto_place( $product ) ) {
			return '';
		}
		$display = (string) Placement_Settings::value( 'display', 'button_panel' );
		return in_array( $display, Placement_Settings::DISPLAYS, true ) ? $display : 'button_panel';
	}

	/**
	 * @param string $text HTML/content.
	 * @param string $tag  Shortcode tag.
	 * @return bool
	 */
	public static function text_has_named_shortcode( $text, $tag ) {
		if ( ! is_string( $text ) || '' === $text || ! is_string( $tag ) || '' === $tag || ! function_exists( 'has_shortcode' ) ) {
			return false;
		}
		return has_shortcode( $text, $tag );
	}

	/**
	 * Block themes: replace add-to-cart block with the donation form on donation products.
	 *
	 * @param string   $content Block HTML.
	 * @param array<string, mixed>    $block   Parsed block.
	 * @param \WP_Block $instance Block instance.
	 * @return string
	 */
	public static function filter_block_add_to_cart( $content, $block, $instance = null ) {
		return Render_Guard::value(
			static function () use ( $content, $instance ) {
				$product = Product_Resolver::product_from_block( $instance );
				if ( ! $product || ! Donation_Scope::is_donation_product( $product ) || ! self::should_auto_place( $product ) ) {
					return $content;
				}
				if ( self::content_already_has_shortcode( $product ) || Render_Registry::has_product_ui( $product->get_id() ) ) {
					// The block's own render already printed our entry through the template override: keep it.
					if ( ! self::content_already_has_shortcode( $product ) && self::html_has_entry( (string) $content, (int) $product->get_id() ) ) {
						return $content;
					}
					return Render_Registry::duplicate_ui_notice( (int) $product->get_id() );
				}
				return self::placed_markup();
			},
			$content,
			'block_add_to_cart'
		);
	}

	/**
	 * Auto-place unless the product override or a shortcode is already in the product content.
	 *
	 * @param \WC_Product $product Product.
	 * @return bool
	 */
	public static function should_auto_place( $product ) {
		if ( ! Product_Resolver::is_wc_product( $product ) || ! Donation_Scope::is_donation_product( $product ) ) {
			return false;
		}
		$override = $product->get_meta( '_wdp_auto_place', true );
		if ( 'no' === $override ) {
			return false;
		}
		if ( Placement_Settings::value( 'auto_place' ) !== 'yes' ) {
			return false;
		}
		return ! self::content_already_has_shortcode( $product );
	}

	/**
	 * @param \WC_Product $product Product.
	 * @return bool
	 */
	public static function content_already_has_shortcode( $product ) {
		$excerpt = (string) $product->get_short_description();
		$content = (string) $product->get_description();
		return self::text_has_wdp_shortcode( $excerpt ) || self::text_has_wdp_shortcode( $content );
	}

	/**
	 * Whether rendered HTML already holds this plugin's button or inline form for the product.
	 *
	 * @param string $html       Rendered HTML.
	 * @param int    $product_id Product ID.
	 * @return bool
	 */
	public static function html_has_entry( $html, $product_id ) {
		$product_id = absint( $product_id );
		if ( '' === $html || $product_id <= 0 ) {
			return false;
		}
		return false !== strpos( $html, 'id="wdp-modal-' . $product_id . '-direct"' )
			|| ( false !== strpos( $html, 'wdp-donate-button' ) && false !== strpos( $html, 'data-product-id="' . $product_id . '"' ) );
	}

	/**
	 * @param string $text HTML/content.
	 * @return bool
	 */
	public static function text_has_wdp_shortcode( $text ) {
		if ( ! is_string( $text ) || '' === $text || ! function_exists( 'has_shortcode' ) ) {
			return false;
		}
		return has_shortcode( $text, 'wdp_donation_form' )
			|| has_shortcode( $text, 'wdp_donation_button' )
			|| has_shortcode( $text, 'wdp_donation_button_panel' );
	}

	/**
	 * @return bool
	 */
	private static function should_override_current_product() {
		$product = Product_Resolver::current_product();
		if ( ! $product || ! Donation_Scope::is_donation_product( $product ) ) {
			return false;
		}
		$override = $product->get_meta( '_wdp_auto_place', true );
		if ( 'no' === $override ) {
			return false;
		}
		return Placement_Settings::value( 'auto_place' ) === 'yes';
	}

	/**
	 * Reset request flags (unit tests).
	 *
	 * @return void
	 */
	public static function reset_request_flags() {
		self::$css_printed            = false;
		self::$template_override_used = false;
		self::$hooks_added            = false;
	}
}

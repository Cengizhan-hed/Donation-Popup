<?php
/**
 * Mağaza döngüsü düğmesi, sepete ekle metni/bağlantısı ve fiyat gizleme (Woo standart filtreleri).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

use DonationPanel\Domain\Campaign_Goal;
use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Domain\Donation_Type;
use DonationPanel\Domain\Placement_Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Döngü + fiyat filtreleri.
 */
class Loop_Price_Filters {

	/**
	 * Hide price for open-amount and campaign donation products when hide_price=yes.
	 * Fixed and share products keep their price. Never blank in admin/cart/checkout/email/REST.
	 *
	 * @param string     $html    Price HTML.
	 * @param \WC_Product $product Product.
	 * @return string
	 */
	public static function filter_price_html( $html, $product ) {
		if ( Placement_Settings::value( 'hide_price' ) !== 'yes' ) {
			return $html;
		}
		if ( self::should_preserve_price_html_context() ) {
			return $html;
		}
		if ( ! Product_Resolver::is_wc_product( $product ) || ! Donation_Scope::is_donation_product( $product ) ) {
			return $html;
		}
		$type = Donation_Type::for_product( $product->get_id() );
		if ( in_array( $type, array( Donation_Type::CUSTOM, Donation_Type::CAMPAIGN ), true ) ) {
			return '';
		}
		return $html;
	}

	/**
	 * @param string     $html    Button HTML.
	 * @param \WC_Product $product Product.
	 * @return string
	 */
	public static function filter_loop_add_to_cart( $html, $product ) {
		return Render_Guard::value(
			static function () use ( $html, $product ) {
				return self::loop_button_html( $html, $product );
			},
			$html,
			'loop_button'
		);
	}

	/**
	 * @param string     $html    Original.
	 * @param \WC_Product $product Product.
	 * @return string
	 */
	public static function loop_button_html( $html, $product ) {
		if ( ! Product_Resolver::is_wc_product( $product ) || ! Donation_Scope::is_donation_product( $product ) ) {
			return $html;
		}
		$mode = (string) Placement_Settings::value( 'loop_button', 'panel' );
		if ( 'off' === $mode ) {
			return $html;
		}
		// Liste/arşiv kartlarında düğme ürün sayfasına götürür; form ürün sayfasında açılır (kartlarda ağır form basılmaz).
		$url         = method_exists( $product, 'get_permalink' ) ? $product->get_permalink() : get_permalink( $product->get_id() );
		$text        = Shortcodes::resolve_button_text( '' );
		$cls         = 'button wdp-loop-donate';
		$goal_closed = Campaign_Goal::should_block_new_donations( $product, false );
		if ( $goal_closed ) {
			$cls .= ' is-disabled wdp-goal-closed-trigger';
		}
		$attrs = ' href="' . esc_url( $url ) . '" class="' . esc_attr( $cls ) . '"';
		if ( $goal_closed ) {
			$attrs .= ' aria-disabled="true" title="' . esc_attr( Campaign_Goal::resolve_message( $product ) ) . '"';
		} elseif ( in_array( $mode, array( 'popup', 'panel' ), true ) ) {
			$product_id = (int) $product->get_id();
			// Gerçek bağlantı kalır (JS yokken ürün sayfasına gider); JS varken form katmanı açılır.
			// Aynı istekte bu ürün için başka bir giriş (form/düğme) çizildiyse yalnız bağlantı olarak kalır.
			if ( ! Render_Registry::has_product_ui( $product_id ) ) {
				Render_Registry::mark_trigger( $product_id );
				Donations_List::enqueue_trigger_assets();
				$attrs .= ' data-wdp-form="' . esc_attr( (string) $product_id ) . '"'
					. ' data-wdp-kind="' . esc_attr( 'popup' === $mode ? 'popup' : 'side_panel' ) . '"'
					. ' data-wdp-rest="' . esc_url( rest_url( 'donation-panel/v1/' ) ) . '"'
					. ' aria-haspopup="dialog"';
			}
		}
		return '<a' . $attrs . '>' . esc_html( $text ) . '</a>';
	}

	/**
	 * Themes that draw their own loop button text.
	 *
	 * @param string     $text    Default text.
	 * @param \WC_Product $product Product.
	 * @return string
	 */
	public static function filter_add_to_cart_text( $text, $product = null ) {
		if ( ! Product_Resolver::is_wc_product( $product ) || ! Donation_Scope::is_donation_product( $product ) ) {
			return $text;
		}
		if ( (string) Placement_Settings::value( 'loop_button', 'panel' ) === 'off' ) {
			return $text;
		}
		return Shortcodes::resolve_button_text( '' );
	}

	/**
	 * Point loop URLs at the product page (no direct add-to-cart).
	 *
	 * @param string     $url     URL.
	 * @param \WC_Product $product Product.
	 * @return string
	 */
	public static function filter_add_to_cart_url( $url, $product = null ) {
		if ( ! Product_Resolver::is_wc_product( $product ) || ! Donation_Scope::is_donation_product( $product ) ) {
			return $url;
		}
		if ( (string) Placement_Settings::value( 'loop_button', 'panel' ) === 'off' ) {
			return $url;
		}
		$permalink = method_exists( $product, 'get_permalink' ) ? $product->get_permalink() : get_permalink( $product->get_id() );
		return $permalink ? $permalink : $url;
	}

	/**
	 * Disable AJAX add-to-cart support on donation products in loops.
	 *
	 * @param bool       $supports Whether supported.
	 * @param string     $feature  Feature name.
	 * @param \WC_Product $product  Product.
	 * @return bool
	 */
	public static function filter_product_supports( $supports, $feature, $product = null ) {
		if ( 'ajax_add_to_cart' !== (string) $feature ) {
			return $supports;
		}
		if ( ! Product_Resolver::is_wc_product( $product ) || ! Donation_Scope::is_donation_product( $product ) ) {
			return $supports;
		}
		return false;
	}

	/**
	 * @param string   $content  HTML.
	 * @param array<string, mixed>    $block    Parsed block.
	 * @param \WP_Block $instance Instance.
	 * @return string
	 */
	public static function filter_block_price( $content, $block, $instance = null ) {
		if ( Placement_Settings::value( 'hide_price' ) !== 'yes' ) {
			return $content;
		}
		if ( self::should_preserve_price_html_context() ) {
			return $content;
		}
		$product = Product_Resolver::product_from_block( $instance );
		if ( ! $product || ! Donation_Scope::is_donation_product( $product ) ) {
			return $content;
		}
		$type = Donation_Type::for_product( $product->get_id() );
		if ( ! in_array( $type, array( Donation_Type::CUSTOM, Donation_Type::CAMPAIGN ), true ) ) {
			return $content;
		}
		return '';
	}

	/**
	 * @param string   $content  HTML.
	 * @param array<string, mixed>    $block    Parsed block.
	 * @param \WP_Block $instance Instance.
	 * @return string
	 */
	public static function filter_block_product_button( $content, $block, $instance = null ) {
		return Render_Guard::value(
			static function () use ( $content, $instance ) {
				$product = Product_Resolver::product_from_block( $instance );
				if ( ! $product ) {
					return $content;
				}
				return self::loop_button_html( $content, $product );
			},
			$content,
			'block_product_button'
		);
	}

	/**
	 * Contexts where price HTML must never be blanked.
	 *
	 * @return bool
	 */
	public static function should_preserve_price_html_context() {
		if ( function_exists( 'is_admin' ) && is_admin() && ! ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() ) ) {
			return true;
		}
		if ( function_exists( 'is_cart' ) && is_cart() ) {
			return true;
		}
		if ( function_exists( 'is_checkout' ) && is_checkout() ) {
			return true;
		}
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return true;
		}
		if ( function_exists( 'did_action' ) && did_action( 'woocommerce_email_header' ) ) {
			return true;
		}
		if ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() ) {
			$wc_ajax = isset( $_REQUEST['wc-ajax'] ) ? sanitize_key( wp_unslash( (string) $_REQUEST['wc-ajax'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( '' !== $wc_ajax && ( false !== strpos( $wc_ajax, 'fragment' ) || false !== strpos( $wc_ajax, 'cart' ) || 'get_refreshed_fragments' === $wc_ajax ) ) {
				return true;
			}
		}
		return false;
	}
}

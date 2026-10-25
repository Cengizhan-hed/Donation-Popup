<?php
/**
 * Yan sepet modülü (isteğe bağlı; varsayılan KAPALI): bağışlar için sepet çekmecesi (mobilde alttan panel).
 *
 * - Tetikleyici: kısa kod `[donation_panel_side_cart]` (sepet simgesi + sayaç); sayaç WooCommerce'in standart
 *   `woocommerce_add_to_cart_fragments` parçasıyla da yenilenir.
 * - Otomatik açılış: WooCommerce blok olayı `wc-blocks_added_to_cart`, klasik `added_to_cart` (jQuery varsa) ve
 *   `donation-panel:cart-added` olayı.
 * - Veri: Store API (kaldır / miktar) + sunucuda çizilen gövde (`GET donation-panel/v1/side-cart`). Tema özel kod yok.
 *
 * Ayar: `modules.side_cart` (kapalıyken bu dosya yüklenmez). Sepet ve ödeme sayfalarında çekmece yüklenmez.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\SideCart;

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Interface;
use DonationPanel\Frontend\Assets;
use DonationPanel\Http\Rate_Limiter;

defined( 'ABSPATH' ) || exit;

/**
 * Side_Cart_Module.
 */
final class Side_Cart_Module implements Module_Interface {

	/**
	 * Modül slug'ı.
	 */
	const SLUG = 'side_cart';

	/**
	 * Kısa kod adı.
	 */
	const SHORTCODE = 'donation_panel_side_cart';

	/**
	 * Bağımlılık kabı.
	 *
	 * @var Container|null
	 */
	private $container;

	/**
	 * Kancaları kaydeder.
	 *
	 * @param Container $container Bağımlılık kabı.
	 * @return void
	 */
	public function register( Container $container ) {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}
		$this->container = $container;
		$container->get( Assets::class )->define( self::SLUG, 'assets/build/side-cart/index.js', 'assets/build/side-cart/index.css' );

		add_action( 'init', array( $this, 'register_shortcode' ) );
		add_filter( 'donation_panel_rest_controllers', array( $this, 'add_rest_controller' ) );
		add_filter( 'woocommerce_add_to_cart_fragments', array( $this, 'add_fragments' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'maybe_enqueue' ), 20 );
		add_action( 'wp_footer', array( $this, 'print_drawer' ), 5 );
	}

	/**
	 * Kısa kodu kaydeder.
	 *
	 * @return void
	 */
	public function register_shortcode() {
		add_shortcode( self::SHORTCODE, array( $this, 'shortcode' ) );
	}

	/**
	 * Kısa kod: sepet simgesi + sayaç düğmesi.
	 *
	 * @return string
	 */
	public function shortcode() {
		return Side_Cart_Renderer::trigger( $this->cart_count(), '' );
	}

	/**
	 * REST denetleyicisini listeye ekler.
	 *
	 * @param array<int, mixed> $controllers Denetleyiciler.
	 * @return array<int, mixed>
	 */
	public function add_rest_controller( $controllers ) {
		$controllers   = (array) $controllers;
		$controllers[] = new Side_Cart_Controller( $this->container->get( Rate_Limiter::class ) );
		return $controllers;
	}

	/**
	 * WooCommerce sepet parçaları: sayaç rozeti.
	 *
	 * @param array<string, string> $fragments Parçalar.
	 * @return array<string, string>
	 */
	public function add_fragments( $fragments ) {
		$fragments                      = (array) $fragments;
		$fragments['span.dp-sc__count'] = Side_Cart_Renderer::count_badge( $this->cart_count() );
		return $fragments;
	}

	/**
	 * Bu sayfada çekmece yüklensin mi: yalnız ön yüz; sepet ve ödeme sayfaları hariç (kendi sepetleri var).
	 *
	 * @return bool
	 */
	public function should_load() {
		$load = ! is_admin();
		if ( $load && function_exists( 'is_cart' ) && function_exists( 'is_checkout' ) && ( is_cart() || is_checkout() ) ) {
			$load = false;
		}
		/**
		 * Yan sepet çekmecesinin bu sayfada yüklenip yüklenmeyeceği.
		 *
		 * @param bool $load Varsayılan karar.
		 */
		return (bool) apply_filters( 'donation_panel_side_cart_load', $load );
	}

	/**
	 * Varlıkları yalnız gereken sayfada kuyruğa alır.
	 *
	 * @return void
	 */
	public function maybe_enqueue() {
		if ( $this->should_load() ) {
			$this->container->get( Assets::class )->enqueue( self::SLUG );
		}
	}

	/**
	 * Çekmece kabuğunu sayfa sonunda bir kez basar.
	 *
	 * @return void
	 */
	public function print_drawer() {
		static $printed = false;
		if ( $printed || ! $this->should_load() ) {
			return;
		}
		$printed = true;

		$lines    = array();
		$subtotal = '';
		$cart     = $this->cart();
		if ( $cart ) {
			$lines    = Side_Cart_Lines::from_cart( $cart );
			$subtotal = (string) $cart->get_cart_subtotal();
		}
		$checkout = function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '';
		$body     = Side_Cart_Renderer::body( $lines, $subtotal, $checkout );

		$html = Side_Cart_Renderer::drawer(
			$body,
			array(
				'rest'     => esc_url_raw( rest_url( 'donation-panel/v1/side-cart' ) ),
				'store'    => esc_url_raw( rest_url( 'wc/store/v1/' ) ),
				'checkout' => $checkout,
				'failed'   => __( 'Something went wrong. Please try again.', 'woo-donation-popup' ),
				'removed'  => __( 'Removed from your basket.', 'woo-donation-popup' ),
			)
		);
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Side_Cart_Renderer tüm değerleri kaçışlar.
	}

	/**
	 * WooCommerce sepeti (yoksa yükler).
	 *
	 * @return object|null
	 */
	private function cart() {
		if ( ! function_exists( 'WC' ) || ! WC() ) {
			return null;
		}
		if ( null === WC()->cart && function_exists( 'wc_load_cart' ) ) {
			wc_load_cart();
		}
		return WC()->cart;
	}

	/**
	 * Kalem sayısı.
	 *
	 * @return int
	 */
	private function cart_count() {
		$cart = $this->cart();
		return $cart && method_exists( $cart, 'get_cart' ) ? count( (array) $cart->get_cart() ) : 0;
	}
}

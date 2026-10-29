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
use DonationPanel\Core\Settings;
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
	 * Bu istekte tetikleyici (kısa kod/blok) çizildi mi.
	 *
	 * @var bool
	 */
	private $wanted = false;

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
		// Koşulsuz `wp_enqueue_scripts` yok (sıfır yük): çekmece ve varlıkları yalnız sayfa sonunda, sayfada bir yüzey varsa.
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
		$this->wanted = true;
		// Stilsiz kare yok (CLAUDE.md §25): simge düğmesinin CSS'i çıktının hemen önünde (betik çekmeceyle altbilgide).
		$assets = $this->container->get( Assets::class );
		$assets->require_style( self::SLUG );
		// Önbellek sözleşmesi: sayfa HTML'i kullanıcıya özel değildir; sayaç istemcide (sepet çerezi + REST) yazılır.
		return $assets->inline_styles() . Side_Cart_Renderer::trigger( 0, '' );
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
		$fragments                                  = (array) $fragments;
		$fragments['span.donation-panel-sc__count'] = Side_Cart_Renderer::count_badge( $this->cart_count() );
		return $fragments;
	}

	/**
	 * Bu sayfada çekmece yüklensin mi (sayfa sonunda sorulur): yalnız sayfada bir yüzey varsa (sepet düğmesi
	 * kısa kodu/bloğu çizildi ya da bağış formu çizildi — form sepete eklenince çekmece açılır); sepet ve ödeme
	 * sayfaları hariç (kendi sepetleri var). Yüzeyi olmayan sayfada 0 CSS/JS/HTML. Her sayfada istenirse
	 * `donation_panel_side_cart_load` filtresi true döner.
	 *
	 * @return bool
	 */
	public function should_load() {
		$load = ! is_admin() && ( $this->wanted || wp_script_is( Assets::handle( 'experiences' ), 'enqueued' ) );
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
	 * Yüzen düğme ayarı (`side_cart.floating`, varsayılan açık): tema kendi sepet simgesini gösteriyorsa kapatılabilir.
	 *
	 * @return bool
	 */
	private function floating_enabled() {
		$enabled = (bool) $this->container->get( Settings::class )->get( 'side_cart.floating', true );
		/**
		 * Yüzen yan sepet düğmesi bu istekte gösterilsin mi.
		 *
		 * @param bool $enabled Ayara göre karar.
		 */
		return (bool) apply_filters( 'donation_panel_side_cart_floating', $enabled );
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
		// Geç kuyruk: WordPress, `wp_footer` içinde kuyruğa alınan betiği sayfa sonunda basar (defer). Stil satır içi,
		// çekmece/yüzen düğme HTML'inin hemen önünde (CLAUDE.md §25).
		$assets = $this->container->get( Assets::class );
		$assets->enqueue( self::SLUG );
		echo $assets->inline_styles(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Eklentinin kendi derlenmiş CSS'i.

		// Önbellek sözleşmesi: kabuk tüm ziyaretçiler için aynıdır (boş durum iskeleti). Satırlar, toplam, sayaç ve
		// ek bağış önerisi yalnız istemcide, Woo sepet çerezi varsa `GET donation-panel/v1/side-cart` ile gelir.
		$checkout = function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '';
		$body     = Side_Cart_Renderer::body( array(), '', $checkout );

		$html = Side_Cart_Renderer::drawer(
			$body,
			array(
				'rest'     => esc_url_raw( rest_url( 'donation-panel/v1/side-cart' ) ),
				'store'    => esc_url_raw( rest_url( 'wc/store/v1/' ) ),
				'checkout' => $checkout,
				'add'      => esc_url_raw( rest_url( 'donation-panel/v1/side-cart/suggestion' ) ),
				'nonce'    => esc_url_raw( rest_url( 'donation-panel/v1/nonce' ) ),
				'failed'   => __( 'Something went wrong. Please try again.', 'woo-donation-popup' ),
				'removed'  => __( 'Removed from your basket.', 'woo-donation-popup' ),
			),
			'',
			$this->floating_enabled() ? Side_Cart_Renderer::floating_button( 0 ) : ''
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

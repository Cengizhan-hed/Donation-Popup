<?php
/**
 * Yeni nesil form deneyimi modülü: tek form çekirdeği + 4 kap, REST ve tembel varlıklar.
 *
 * Tek form deneyimi: modül varsayılan açıktır (`modules.experiences` ya da `donation_panel_module_enabled` ile kapanır).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Experiences;

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Interface;
use DonationPanel\Frontend\Assets;
use DonationPanel\Frontend\Template_Loader;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Modules\EntryPoints\Product_Resolver;
use DonationPanel\WooCommerce\Cart;

defined( 'ABSPATH' ) || exit;

/**
 * Experiences_Module.
 */
final class Experiences_Module implements Module_Interface {

	/**
	 * Modül slug'ı.
	 */
	const SLUG = 'experiences';

	/**
	 * Kısa kod adı (yeni; eski kısa kodlar değişmez).
	 */
	const SHORTCODE = 'donation_panel_experience';

	/**
	 * Bağımlılık kabı.
	 *
	 * @var Container|null
	 */
	private $container;

	/**
	 * Sayfada form çizildi mi (varlıklar yalnız o zaman kuyruğa girer).
	 *
	 * @var bool
	 */
	private $rendered = false;

	/**
	 * Sepet köprüsü (Store API uzantısı + REST ekleme).
	 *
	 * @var Cart|null
	 */
	private $cart;

	/**
	 * Kancaları kaydeder.
	 *
	 * @param Container $container Bağımlılık kabı.
	 * @return void
	 */
	public function register( Container $container ) {
		$this->container = $container;

		$container->get( Assets::class )->define( self::SLUG, 'assets/build/experiences/index.js', 'assets/build/experiences/index.css' );

		$this->cart = new Cart();
		$this->cart->register();

		add_filter( 'donation_panel_rest_controllers', array( $this, 'add_rest_controller' ) );
		add_action( 'init', array( $this, 'register_shortcode' ) );
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
	 * REST denetleyicisini listeye ekler.
	 *
	 * @param array<int, mixed> $controllers Denetleyiciler.
	 * @return array<int, mixed>
	 */
	public function add_rest_controller( $controllers ) {
		$controllers   = (array) $controllers;
		$limiter       = $this->container->get( Rate_Limiter::class );
		$controllers[] = new Form_Controller( $limiter, $this->renderer() );
		$controllers[] = new Cart_Controller( $limiter, $this->cart ? $this->cart : new Cart() );
		return $controllers;
	}

	/**
	 * Kısa kod: `[donation_panel_experience id="" kind="popup|side_panel|inline|bottom_sheet" button_text=""]`.
	 * `id` yoksa bulunduğu ürünü kendisi bulur.
	 *
	 * @param array<string, mixed>|string $atts Öznitelikler.
	 * @return string
	 */
	public function shortcode( $atts ) {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return '';
		}
		$atts = shortcode_atts(
			array(
				'id'          => '',
				'kind'        => 'popup',
				'button_text' => '',
			),
			(array) $atts,
			self::SHORTCODE
		);

		$product = Product_Resolver::resolve( array( 'id' => $atts['id'] ) );
		if ( ! $product ) {
			return '';
		}
		$model = Form_Context::for_product( $product );
		if ( empty( $model ) ) {
			return '';
		}

		$args = array(
			'rest_url'     => esc_url_raw( rest_url( 'donation-panel/v1/' ) ),
			'nonce'        => wp_create_nonce( 'wp_rest' ),
			'checkout_url' => function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '',
		);
		if ( '' !== trim( (string) $atts['button_text'] ) ) {
			$args['button_text'] = sanitize_text_field( (string) $atts['button_text'] );
		}

		$html = $this->renderer()->render( $model, (string) $atts['kind'], $args );
		if ( '' !== $html ) {
			$this->rendered = true;
			$this->container->get( Assets::class )->enqueue( self::SLUG );
		}
		return $html;
	}

	/**
	 * Form çıktısı üretici.
	 *
	 * @return Form_Renderer
	 */
	private function renderer() {
		return new Form_Renderer( $this->container->get( Template_Loader::class ) );
	}

	/**
	 * Sayfada form çizildi mi.
	 *
	 * @return bool
	 */
	public function has_rendered() {
		return $this->rendered;
	}
}

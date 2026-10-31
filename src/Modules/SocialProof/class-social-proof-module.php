<?php
/**
 * Sosyal kanıt modülü (K3): isteğe bağlı, VARSAYILAN KAPALI; yalnız toplu gerçek veri, kişi bilgisi yok.
 *
 * Kısa kod: `[donation_panel_social_proof id="" variant="line|counters|feed" per_page="5"]`.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\SocialProof;

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Interface;
use DonationPanel\Frontend\Assets;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Modules\EntryPoints\Product_Resolver;

defined( 'ABSPATH' ) || exit;

/**
 * Social_Proof_Module.
 */
final class Social_Proof_Module implements Module_Interface {

	/**
	 * Modül slug'ı.
	 */
	const SLUG = 'social_proof';

	/**
	 * Kısa kod adı.
	 */
	const SHORTCODE = 'donation_panel_social_proof';

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
		$this->container = $container;
		$container->get( Assets::class )->define( 'campaign', 'assets/build/campaign/index.js', 'assets/build/campaign/index.css' );

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
	 * REST denetleyicisini ekler.
	 *
	 * @param array<int, mixed> $controllers Denetleyiciler.
	 * @return array<int, mixed>
	 */
	public function add_rest_controller( $controllers ) {
		$controllers   = (array) $controllers;
		$controllers[] = new Donations_Controller( $this->container->get( Rate_Limiter::class ) );
		return $controllers;
	}

	/**
	 * Kısa kod. `id` verilmezse (ya da ürün sayfası dışındaysa) tüm bağışlar sayılır.
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
				'id'       => '',
				'variant'  => 'line',
				'per_page' => '5',
			),
			(array) $atts,
			self::SHORTCODE
		);

		$product_id = 0;
		if ( '' !== trim( (string) $atts['id'] ) || ( function_exists( 'is_product' ) && is_product() ) ) {
			$product = Product_Resolver::resolve( array( 'id' => $atts['id'] ) );
			if ( $product ) {
				$product_id = (int) $product->get_id();
			}
		}

		$variant = Social_Proof_Renderer::sanitize_variant( $atts['variant'] );
		$stats   = 'feed' === $variant ? array( 'donors' => 0 ) : Donation_Feed::stats( $product_id );
		$feed    = 'feed' === $variant ? Donation_Feed::page( $product_id, 1, Donation_Feed::clamp_per_page( $atts['per_page'] ) ) : array();
		$html    = Social_Proof_Renderer::render( $variant, $product_id, $stats, $feed );
		if ( '' !== $html ) {
			$assets = $this->container->get( Assets::class );
			$assets->enqueue( 'campaign' );
			$html = $assets->inline_styles() . $html;
		}
		return $html;
	}
}

<?php
/**
 * Kampanya modülü: ilerleme çubuğu, ara hedefler, bağışçı sayısı (REST + kısa kod + tembel ön yüz).
 *
 * Mevcut kısa kod/öznitelik sözleşmesi değişmez; bu modül YENİ `[donation_panel_progress]` ekler.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Campaign;

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Interface;
use DonationPanel\Frontend\Assets;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Modules\EntryPoints\Product_Resolver;

defined( 'ABSPATH' ) || exit;

/**
 * Campaign_Module.
 */
final class Campaign_Module implements Module_Interface {

	/**
	 * Modül slug'ı.
	 */
	const SLUG = 'campaign';

	/**
	 * Kısa kod adı.
	 */
	const SHORTCODE = 'donation_panel_progress';

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
		$controllers[] = new Progress_Controller( $this->container->get( Rate_Limiter::class ) );
		return $controllers;
	}

	/**
	 * Kısa kod: `[donation_panel_progress id="" milestones="yes" donors="yes"]` (id yoksa bulunduğu ürün).
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
				'id'         => '',
				'milestones' => 'yes',
				'donors'     => 'yes',
			),
			(array) $atts,
			self::SHORTCODE
		);

		$product = Product_Resolver::resolve( array( 'id' => $atts['id'] ) );
		if ( ! $product ) {
			return '';
		}
		$data = Progress_Data::for_product( (int) $product->get_id() );
		if ( null === $data ) {
			return '';
		}

		$no   = static function ( $value ) {
			return in_array( strtolower( (string) $value ), array( 'no', 'false', '0', 'off' ), true );
		};
		$html = Progress_Renderer::render(
			$data,
			array(
				'milestones' => ! $no( $atts['milestones'] ),
				'donors'     => ! $no( $atts['donors'] ),
			)
		);
		$this->container->get( Assets::class )->enqueue( 'campaign' );
		return $html;
	}
}

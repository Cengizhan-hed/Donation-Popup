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
		// Canlı çubuk (tüm yüzeyler): stil satır içi (çubuğu çizen yüzeyin önünde), betik defer.
		$container->get( Assets::class )->define( Progress_Live::ASSET, Progress_Live::SCRIPT, Progress_Live::STYLE );

		add_filter( 'donation_panel_rest_controllers', array( $this, 'add_rest_controller' ) );
		add_filter( 'donation_panel_form_model', array( $this, 'filter_model' ), 15, 2 );
		add_action( 'init', array( $this, 'register_shortcode' ) );
	}

	/**
	 * Form modeline `campaign` (form üstündeki ilerleme özeti) ekler; kampanya verisi yoksa eklemez.
	 *
	 * Metinler sunucuda WooCommerce biçimiyle hazırlanır; kişi verisi yoktur.
	 * Kalan gün: `donation_panel_campaign_days_left` filtresi tam sayı döndürürse gösterilir (varsayılan: yok).
	 *
	 * @param array<string, mixed> $model  Form modeli.
	 * @param array<string, mixed> $legacy Eski bağlam.
	 * @return array<string, mixed>
	 */
	public function filter_model( $model, $legacy = array() ) {
		unset( $legacy );
		$model      = (array) $model;
		$product_id = isset( $model['product_id'] ) ? (int) $model['product_id'] : 0;
		if ( $product_id < 1 || ! empty( $model['closed'] ) ) {
			return $model;
		}
		$data = Progress_Data::for_product( $product_id );
		if ( null === $data ) {
			return $model;
		}
		/**
		 * Kampanyanın kalan gün sayısı (bitiş tarihi yoksa null).
		 *
		 * @param int|null $days       Kalan gün.
		 * @param int      $product_id Ürün.
		 */
		$days = apply_filters( 'donation_panel_campaign_days_left', null, $product_id );

		$model['campaign'] = array(
			'raised'        => Progress_Renderer::money( (float) $data['raised'] ),
			'goal'          => Progress_Renderer::money( (float) $data['goal'] ),
			// Tam sayı yüzde aşağı yuvarlanır: hedefe ulaşılmadan "100%" yazılmaz.
			'percent'       => (int) floor( Progress_Live::exact_percent( $data ) + 1e-9 ),
			'percent_exact' => round( Progress_Live::exact_percent( $data ), 2 ),
			'percent_text'  => Progress_Live::percent_text( Progress_Live::exact_percent( $data ), 0 ),
			'value_text'    => Progress_Live::value_text( $data, 0 ),
			'donors'        => (int) $data['donors'],
			'days_left'     => is_numeric( $days ) ? max( 0, (int) $days ) : null,
			'reached'       => ! empty( $data['reached'] ),
			'zero'          => ! ( (float) $data['raised'] > 0 ),
			'first_text'    => Progress_Live::first_text(),
			// Canlı çubuk yapılandırması (herkese açık veri + ayarlar + çevrilmiş kalıplar; kişi verisi yok).
			'live'          => Progress_Live::config( $data ),
		);
		// Form sayfada çiziliyorsa çubuk stili (yüzeyin satır içi stilinden önce) ve betiği kuyruğa girer; REST'le gelen
		// formda etkisizdir, orada form paketindeki yükleyici getirir.
		if ( $this->container ) {
			$this->container->get( Assets::class )->enqueue( Progress_Live::ASSET );
		}
		return $model;
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

		$no     = static function ( $value ) {
			return in_array( strtolower( (string) $value ), array( 'no', 'false', '0', 'off' ), true );
		};
		$html   = Progress_Renderer::render(
			$data,
			array(
				'milestones' => ! $no( $atts['milestones'] ),
				'donors'     => ! $no( $atts['donors'] ),
			)
		);
		$assets = $this->container->get( Assets::class );
		$assets->enqueue( 'campaign' );
		$assets->enqueue( Progress_Live::ASSET );
		return $assets->inline_styles() . $html;
	}
}

<?php
/**
 * Etki ifadeleri modülü: tutarın somut karşılığını form modeline ekler ve ön yüzde gösterir.
 *
 * Experiences dosyalarına dokunmaz: `donation_panel_form_model` filtresiyle model alanı ekler;
 * ön yüz (kampanya paketi) `[data-dp-form]` formlarını REST ile zenginleştirir.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Impact;

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Interface;
use DonationPanel\Core\Settings;
use DonationPanel\Frontend\Assets;
use DonationPanel\Http\Rate_Limiter;

defined( 'ABSPATH' ) || exit;

/**
 * Impact_Module.
 */
final class Impact_Module implements Module_Interface {

	/**
	 * Modül slug'ı.
	 */
	const SLUG = 'impact';

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

		add_filter( 'donation_panel_form_model', array( $this, 'filter_model' ), 20, 2 );
		add_filter( 'donation_panel_rest_controllers', array( $this, 'add_rest_controller' ) );
	}

	/**
	 * REST denetleyicisini ekler.
	 *
	 * @param array<int, mixed> $controllers Denetleyiciler.
	 * @return array<int, mixed>
	 */
	public function add_rest_controller( $controllers ) {
		$controllers   = (array) $controllers;
		$controllers[] = new Impact_Controller( $this->container->get( Rate_Limiter::class ), $this->container->get( Settings::class ) );
		return $controllers;
	}

	/**
	 * Form modeline `impact` ekler (ifadesi olan ürünlerde) ve ön yüz paketini kuyruğa alır.
	 *
	 * @param array<string, mixed> $model  Form modeli.
	 * @param array<string, mixed> $legacy Eski bağlam.
	 * @return array<string, mixed>
	 */
	public function filter_model( $model, $legacy = array() ) {
		unset( $legacy );
		$model      = (array) $model;
		$product_id = isset( $model['product_id'] ) ? (int) $model['product_id'] : 0;
		if ( $product_id < 1 ) {
			return $model;
		}
		$tiers = Impact_Map::tiers_for_product( $product_id, (string) $this->container->get( Settings::class )->get( 'impact.map', '' ) );
		if ( ! $tiers ) {
			return $model;
		}
		$presets         = isset( $model['presets'] ) ? array_map( 'floatval', (array) $model['presets'] ) : array();
		$model['impact'] = array(
			'tiers'   => $tiers,
			'presets' => Impact_Map::for_amounts( $presets, $tiers ),
		);
		$this->container->get( Assets::class )->enqueue( 'campaign' );
		return $model;
	}
}

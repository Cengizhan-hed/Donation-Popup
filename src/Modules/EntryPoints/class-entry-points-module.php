<?php
/**
 * Giriş noktaları modülü: otomatik yerleşim + yedek düğme (ayarla açılır/kapanır).
 *
 * Kısa kodlar, bloklar ve Elementor ince katmanı her zaman kayıtlıdır (sözleşme); kapatılan yalnız
 * WooCommerce kancalarıyla otomatik yerleşim ve yedek düğmedir.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Interface;
use DonationPanel\Frontend\Assets;
use DonationPanel\Frontend\Template_Loader;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Modules\Experiences\Form_Renderer;

defined( 'ABSPATH' ) || exit;

/**
 * Entry_Points_Module.
 */
final class Entry_Points_Module implements Module_Interface {

	/**
	 * Modül slug'ı.
	 */
	const SLUG = 'entry_points';

	/**
	 * Otomatik yerleşim kancalarını bağlar (WooCommerce yoksa hiçbir şey yapmaz).
	 *
	 * @param Container $container Bağımlılık kabı.
	 * @return void
	 */
	public function register( Container $container ) {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}
		Auto_Placement::init();

		$container->get( Assets::class )->define( Donations_List::ASSET_SLUG, 'assets/build/list/index.js', 'assets/build/list/index.css' );
		add_filter(
			'donation_panel_rest_controllers',
			static function ( $controllers ) use ( $container ) {
				$controllers   = (array) $controllers;
				$controllers[] = new Experience_Controller(
					$container->get( Rate_Limiter::class ),
					new Form_Renderer( $container->get( Template_Loader::class ) )
				);
				return $controllers;
			}
		);
	}
}

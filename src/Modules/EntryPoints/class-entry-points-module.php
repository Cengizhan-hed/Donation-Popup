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
		unset( $container );
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}
		Auto_Placement::init();
	}
}

<?php
/**
 * Yönetici köprüsü yükleyicisi (GEÇİCİ): `includes/` altında kalan yönetici sınıflarının (WDP_*) bulduğu eski sınıf
 * adlarını, taşınan ad alanlı sınıflara takma adla (`class_alias`) bağlar ve kalan dosyaları yükler.
 * Yönetici dosyaları kaldırıldığında bu dizinle birlikte silinir (Bootstrap dosya yoksa köprüyü atlar).
 *
 * @package DonationPanel
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class WDP_Autoloader
 */
class WDP_Autoloader {

	/**
	 * Eski ad => yeni sınıf (tam ad).
	 */
	const MOVED = array(
		'WDP_Donation_Scope'                   => 'DonationPanel\\Domain\\Donation_Scope',
		'WDP_Donation_Type'                    => 'DonationPanel\\Domain\\Donation_Type',
		'WDP_Campaign_Goal'                    => 'DonationPanel\\Domain\\Campaign_Goal',
		'WDP_Placement_Settings'               => 'DonationPanel\\Domain\\Placement_Settings',
		'WDP_Progress_Currency'                => 'DonationPanel\\Domain\\Progress_Currency',
		'WDP_Donation_Product_Context_Service' => 'DonationPanel\\Domain\\Product_Context',
		'WDP_Addon_Product_Visibility'         => 'DonationPanel\\Domain\\Addon_Product_Visibility',
		'WDP_Order_Meta_Keys'                  => 'DonationPanel\\WooCommerce\\Order_Meta_Keys',
		'WDP_Donations_List'                   => 'DonationPanel\\Modules\\EntryPoints\\Donations_List',
		'WDP_Security'                         => 'DonationPanel\\Support\\Security',
	);

	/**
	 * Yükleyiciyi kaydeder.
	 *
	 * @return void
	 */
	public static function register() {
		spl_autoload_register( array( __CLASS__, 'autoload' ) );
	}

	/**
	 * Sınıfı yükler.
	 *
	 * @param string $class_name Sınıf adı.
	 * @return void
	 */
	public static function autoload( $class_name ) {
		if ( 0 !== strpos( $class_name, 'WDP_' ) ) {
			return;
		}
		if ( isset( self::MOVED[ $class_name ] ) ) {
			class_alias( self::MOVED[ $class_name ], $class_name );
			return;
		}
		$file = __DIR__ . '/class-' . strtolower( str_replace( '_', '-', substr( $class_name, 4 ) ) ) . '.php';
		if ( is_file( $file ) ) {
			require_once $file;
		}
	}
}

WDP_Autoloader::register();

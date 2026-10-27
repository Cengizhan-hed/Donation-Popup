<?php
/**
 * Yönetici köprüsü (GEÇİCİ): yönetici kaydının çağırdığı önbellek temizliği.
 *
 * @package DonationPanel
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class WDP_Assets
 */
class WDP_Assets {

	/**
	 * Bilinen sayfa önbelleklerini temizler (varlık sürümü değişince).
	 *
	 * @return void
	 */
	public static function purge_known_page_caches() {
		if ( function_exists( 'sg_cachepress_purge_cache' ) ) {
			sg_cachepress_purge_cache();
		}
		do_action( 'litespeed_purge_all' );
		do_action( 'rocket_clean_domain' );
		do_action( 'autoptimize_action_cachepurged' );
	}
}

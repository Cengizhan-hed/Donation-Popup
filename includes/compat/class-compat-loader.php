<?php
/**
 * Uyumluluk kaydı. Çoklu para birimi bağdaştırıcıları çekirdekte YOKTUR (K8); yalnız oluşturucu tespiti includes/compat/ altındadır.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Çekirdek yalnız filtre ve WooCommerce verisi kullanır; eklenti adları yalnız bu klasörde geçer.
 */
class WDP_Compat_Loader {

	/**
	 * Bağdaştırıcıları kaydet (yalnız filtre ekler, hiçbir şey çağırmaz).
	 *
	 * @return void
	 */
	public static function init() {
		// Para birimi bağdaştırıcıları (K8) çekirdekten kaldırıldı: site koduyla docs/site-snippets/ üzerinden bağlanır.
	}
}

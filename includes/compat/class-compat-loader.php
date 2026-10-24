<?php
/**
 * Üçüncü taraf eklenti bağdaştırıcılarını (yalnız includes/compat/) çekirdeğin filtrelerine bağlar.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
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
		WDP_Compat_Currency::init();
		WDP_Compat_Builders::init();
	}
}

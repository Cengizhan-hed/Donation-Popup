<?php
/**
 * E0 test modülü (kapalı): yüklenirse genel işaret konur.
 *
 * @package E0Fixture
 */

namespace E0Fixture\Modules\Sample;

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Interface;

$GLOBALS['wdp_e0_disabled_module_loaded'] = true;

/**
 * Disabled_Module.
 */
class Disabled_Module implements Module_Interface {

	/**
	 * Kaydet.
	 *
	 * @param Container $container Kap.
	 * @return void
	 */
	public function register( Container $container ) {
		$GLOBALS['wdp_e0_disabled_module_registered'] = true;
	}
}

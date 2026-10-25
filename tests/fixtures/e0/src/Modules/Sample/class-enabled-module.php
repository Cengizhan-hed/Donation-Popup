<?php
/**
 * E0 test modülü (açık).
 *
 * @package E0Fixture
 */

namespace E0Fixture\Modules\Sample;

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Interface;

/**
 * Enabled_Module.
 */
class Enabled_Module implements Module_Interface {

	/**
	 * Kaydedildi mi (test gözlemi).
	 *
	 * @var int
	 */
	public static $registered = 0;

	/**
	 * Kaydet.
	 *
	 * @param Container $container Kap.
	 * @return void
	 */
	public function register( Container $container ) {
		++self::$registered;
	}
}

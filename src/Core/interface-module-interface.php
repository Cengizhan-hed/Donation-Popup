<?php
/**
 * Modül sözleşmesi: ayarla açılıp kapanan, kapalıyken dosyası yüklenmeyen özellik birimi.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Core;

defined( 'ABSPATH' ) || exit;

/**
 * Module_Interface.
 */
interface Module_Interface {

	/**
	 * Kancaları ve hizmetleri kaydeder (yalnız modül açıkken çağrılır).
	 *
	 * @param Container $container Bağımlılık kabı.
	 * @return void
	 */
	public function register( Container $container );
}

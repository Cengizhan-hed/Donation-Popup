<?php
/**
 * Yönetici köprüsü (GEÇİCİ): eski yönetici ekranının gösterdiği varsayılan gizlilik bağlantısı metni.
 *
 * @package DonationPanel
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class WDP_Donation_Optional_Fields
 */
class WDP_Donation_Optional_Fields {

	/**
	 * Varsayılan kısa gizlilik bağlantısı metni.
	 *
	 * @return string
	 */
	public static function default_privacy_link_label() {
		return \DonationPanel\Domain\Privacy_Notice::default_link_label();
	}
}

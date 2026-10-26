<?php
/**
 * Yönetici köprüsü (GEÇİCİ): yönetici ekranının gösterdiği varsayılan ek bağış açıklaması.
 *
 * @package DonationPanel
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class WDP_Templates
 */
class WDP_Templates {

	/**
	 * Varsayılan ek bağış açıklama metni (ürün özel metni boşken).
	 *
	 * @return string
	 */
	public static function get_default_addon_donation_message() {
		return (string) apply_filters(
			'wdp_sadaka_inspirational_message',
			__( 'You can also add a charity donation if you wish. Every kindness quietly reaches someone; your intention can bring hope to those in need.', 'woo-donation-popup' )
		);
	}
}

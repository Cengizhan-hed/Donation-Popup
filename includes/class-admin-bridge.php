<?php
/**
 * Yönetici köprüsü (GEÇİCİ): eski yönetici dosyalarının çalışması için yükleyiciyi kaydeder.
 *
 * @package DonationPanel
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-autoloader.php';

if ( is_file( __DIR__ . '/class-woo-donation-popup-admin.php' ) ) {
	require_once __DIR__ . '/class-woo-donation-popup-admin.php';
}

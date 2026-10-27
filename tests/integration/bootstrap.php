<?php
/**
 * Entegrasyon testleri bootstrap: gerçek WordPress + WooCommerce + eklenti (SQLite), uzak bağlantı yok.
 *
 * `npm run test:integration` WDP_INTEGRATION_WP_DIR değerini (build/integration-wp/wordpress) ayarlar ve WP'yi hazırlar.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

$wdp_wp_dir = getenv( 'WDP_INTEGRATION_WP_DIR' );
if ( ! is_string( $wdp_wp_dir ) || '' === $wdp_wp_dir || ! is_file( rtrim( $wdp_wp_dir, '/' ) . '/wp-load.php' ) ) {
	fwrite( STDERR, "WDP_INTEGRATION_WP_DIR yok: npm run test:integration kullanın.\n" );
	exit( 2 );
}
// Güvenlik: yalnız proje altındaki build/ dizini (gerçek bir siteye asla bağlanma).
$wdp_root = dirname( __DIR__, 2 );
$wdp_real = (string) realpath( $wdp_wp_dir );
if ( 0 !== strpos( $wdp_real, (string) realpath( $wdp_root . '/build' ) ) ) {
	fwrite( STDERR, "Entegrasyon WP'si build/ dışında olamaz.\n" );
	exit( 2 );
}

if ( empty( $_SERVER['HTTP_HOST'] ) ) {
	$_SERVER['HTTP_HOST']   = '127.0.0.1';
	$_SERVER['SERVER_NAME'] = '127.0.0.1';
	$_SERVER['REQUEST_URI'] = '/';
	$_SERVER['REMOTE_ADDR'] = '203.0.113.10';
}
require $wdp_real . '/wp-load.php';

if ( ! class_exists( 'WooCommerce' ) || ! defined( 'WDP_VERSION' ) ) {
	fwrite( STDERR, "WooCommerce ve eklenti etkin değil; hazırlık betiği çalışmadı.\n" );
	exit( 2 );
}
require_once __DIR__ . '/class-integration-test-case.php';

<?php
/**
 * Entegrasyon WP'sini hazırlar (idempotent): WooCommerce + eklenti etkin, HPOS açık ve tabloları var.
 * Yalnız yerel kopyada (build/integration-wp) çalışır; uzak bağlantı yok.
 *
 *   WDP_INTEGRATION_WP_DIR=... php tests/integration/prepare.php
 *
 * @package DonationPanel
 */

$wp_dir = (string) getenv( 'WDP_INTEGRATION_WP_DIR' );
$root   = dirname( __DIR__, 2 );
if ( '' === $wp_dir || ! is_file( rtrim( $wp_dir, '/' ) . '/wp-load.php' ) || 0 !== strpos( (string) realpath( $wp_dir ), (string) realpath( $root . '/build' ) ) ) {
	fwrite( STDERR, "WDP_INTEGRATION_WP_DIR build/ altında olmalı.\n" );
	exit( 2 );
}
$_SERVER['HTTP_HOST']   = '127.0.0.1';
$_SERVER['SERVER_NAME'] = '127.0.0.1';
$_SERVER['REQUEST_URI'] = '/';
require rtrim( (string) realpath( $wp_dir ), '/' ) . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
require_once ABSPATH . 'wp-admin/includes/upgrade.php';

foreach ( array( 'woocommerce/woocommerce.php', 'woo-donation-popup/woo-donation-popup.php' ) as $plugin ) {
	if ( ! is_plugin_active( $plugin ) ) {
		$result = activate_plugin( $plugin, '', false, false );
		if ( is_wp_error( $result ) ) {
			fwrite( STDERR, $plugin . ': ' . $result->get_error_message() . "\n" );
			exit( 1 );
		}
	}
}
if ( class_exists( 'WC_Install' ) ) {
	WC_Install::install();
}

// HPOS: sipariş silme/çöp kancaları HPOS'ta farklıdır; entegrasyon testi bunu kapsar.
update_option( 'woocommerce_custom_orders_table_enabled', 'yes', true );
update_option( 'woocommerce_feature_custom_order_tables_enabled', 'yes', true );
update_option( 'woocommerce_custom_orders_table_data_sync_enabled', 'no', true );
try {
	$sync = wc_get_container()->get( \Automattic\WooCommerce\Internal\DataStores\Orders\DataSynchronizer::class );
	if ( ! $sync->check_orders_table_exists() ) {
		$sync->create_database_tables();
	}
} catch ( Throwable $e ) {
	fwrite( STDERR, 'HPOS tabloları: ' . $e->getMessage() . "\n" );
	exit( 1 );
}
update_option( 'woocommerce_custom_orders_table_enabled', 'yes', true );

$hpos = class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) && \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
echo wp_json_encode(
	array(
		'ok'      => true,
		'wc'      => defined( 'WC_VERSION' ) ? WC_VERSION : '',
		'plugin'  => defined( 'WDP_VERSION' ) ? WDP_VERSION : '',
		'hpos'    => $hpos,
	)
) . "\n";

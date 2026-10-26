<?php
/**
 * Plugin Name: Donation Panel for WooCommerce
 * Description: Adds a donation form to WooCommerce products as a popup, side panel or inline form, with fixed, custom, shared and campaign donation types.
 * Author: Cengizhan Çoban
 * Version: 11.0.0
 * Requires at least: 6.3
 * Requires PHP: 7.4
 * Requires Plugins: woocommerce
 * Tested up to: 7.1
 * WC requires at least: 8.0
 * WC tested up to: 11.2
 * License: GPLv2 or later
 * Text Domain: woo-donation-popup
 * Domain Path: /languages
 *
 * Dosya: WordPress eklenti giriş dosyası; sabitleri tanımlar, ad alanlı sınıf yükleyiciyi kaydeder ve başlatır.
 *
 * @package DonationPanel
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WDP_PLUGIN_FILE', __FILE__ );
define( 'WDP_VERSION', '11.0.0' );
define( 'WDP_PLUGIN_DIR', plugin_dir_path( WDP_PLUGIN_FILE ) );
define( 'WDP_PLUGIN_URL', plugin_dir_url( WDP_PLUGIN_FILE ) );
define( 'WDP_ASSET_VERSION', get_option( 'wdp_cache_version', WDP_VERSION ) );

require_once WDP_PLUGIN_DIR . 'src/Core/class-autoloader.php';
\DonationPanel\Core\Autoloader::register( WDP_PLUGIN_DIR . 'src' );

register_activation_hook( __FILE__, array( \DonationPanel\Core\Bootstrap::class, 'activate' ) );
register_deactivation_hook( __FILE__, array( \DonationPanel\Core\Bootstrap::class, 'deactivate' ) );

\DonationPanel\Core\Bootstrap::run();

<?php
/**
 * Plugin Name: Donation Panel for WooCommerce
 * Description: Adds a donation form to WooCommerce products as a popup, side panel or inline form, with fixed, custom, shared and campaign donation types.
 * Author: Cengizhan Çoban
 * Version: 12.3.0
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

// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WDP_* sabitleri dışa açık sözleşmedir (geriye dönük uyum), yeniden adlandırılamaz.
define( 'WDP_PLUGIN_FILE', __FILE__ );
define( 'WDP_VERSION', '12.3.0' );
define( 'WDP_PLUGIN_DIR', plugin_dir_path( WDP_PLUGIN_FILE ) );
define( 'WDP_PLUGIN_URL', plugin_dir_url( WDP_PLUGIN_FILE ) );
define( 'WDP_ASSET_VERSION', get_option( 'wdp_cache_version', WDP_VERSION ) );
// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound

require_once WDP_PLUGIN_DIR . 'src/Core/class-autoloader.php';
\DonationPanel\Core\Autoloader::register( WDP_PLUGIN_DIR . 'src' );

register_activation_hook( __FILE__, array( \DonationPanel\Core\Bootstrap::class, 'activate' ) );
register_deactivation_hook( __FILE__, array( \DonationPanel\Core\Bootstrap::class, 'deactivate' ) );

// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- geriye dönük uyumluluk: eski dışa açık işlev adları değişmez (sözleşme: src/Compat/class-public-contract.php).

if ( ! function_exists( 'wdp_render_donation_button' ) ) {
	/**
	 * Bağış düğmesini (açılır form) çizer.
	 *
	 * @param int    $product_id  Ürün kimliği.
	 * @param string $button_text Düğme metni.
	 * @return string
	 */
	function wdp_render_donation_button( $product_id, $button_text = '' ) {
		return \DonationPanel\Compat\Public_Contract::render_for_product( 'wdp_donation_button', (int) $product_id, array( 'text' => (string) $button_text ) );
	}
}

if ( ! function_exists( 'wdp_render_donation_form' ) ) {
	/**
	 * Sayfa içi bağış formunu çizer.
	 *
	 * @param int                  $product_id Ürün kimliği.
	 * @param mixed $args       Öznitelikler dizisi (`class`, `title`, `show_title`); dizi değilse yok sayılır.
	 * @return string
	 */
	function wdp_render_donation_form( $product_id, $args = array() ) {
		return \DonationPanel\Compat\Public_Contract::render_for_product( 'wdp_donation_form', (int) $product_id, is_array( $args ) ? $args : array() );
	}
}

// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound

\DonationPanel\Core\Bootstrap::run();

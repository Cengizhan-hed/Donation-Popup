<?php
/**
 * Plugin Name: WooCommerce Donation Panel
 * Description: WooCommerce ürünleri için bağış formu açılır penceresi oluşturur (Tüm temalarla uyumlu). Bu eklenti Hedef Derneği tarafından hazırlanmaktadır.
 * Author: Hedef Derneği
 * Version: 10.3.1
 * Requires at least: 5.0
 * Tested up to: 6.7
 * WC requires at least: 3.0
 * WC tested up to: 9.0
 * License: GPLv2 or later
 * Text Domain: woo-donation-popup
 * 
 * Woo: 12345:342928dfsfhsf8429842374wdf4234sfd
 * WooCommerce: true
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

define('WDP_PLUGIN_FILE', __FILE__);
define('WDP_VERSION', '10.3.1');
define('WDP_PLUGIN_DIR', plugin_dir_path(WDP_PLUGIN_FILE));
define('WDP_PLUGIN_URL', plugin_dir_url(WDP_PLUGIN_FILE));
define('WDP_ASSET_VERSION', get_option('wdp_cache_version', WDP_VERSION));

if (!function_exists('wdp_debug_log')) {
	/**
	 * Plugin scoped logger helper.
	 *
	 * @param mixed $message Message payload.
	 * @return void
	 */
	function wdp_debug_log($message) {
		if (!defined('WP_DEBUG') || WP_DEBUG !== true) {
			return;
		}
		if (is_array($message) || is_object($message)) {
			error_log(print_r($message, true)); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_print_r
			return;
		}
		error_log((string) $message); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
	}
}

register_activation_hook(__FILE__, array('Woo_Donation_Popup', 'activate'));
register_deactivation_hook(__FILE__, array('Woo_Donation_Popup', 'deactivate'));

require_once WDP_PLUGIN_DIR . 'includes/class-woo-donation-popup.php';
require_once WDP_PLUGIN_DIR . 'includes/bootstrap/class-plugin-bootstrap.php';

WDP_Plugin_Bootstrap::run();

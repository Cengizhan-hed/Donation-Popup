<?php
/**
 * PHPStan bootstrap — eklenti sabitleri. WordPress çekirdeği yüklenmez.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	define('ABSPATH', dirname(__DIR__) . '/');
}
if (!defined('WDP_PLUGIN_FILE')) {
	define('WDP_PLUGIN_FILE', dirname(__DIR__) . '/woo-donation-popup.php');
}
if (!defined('WDP_VERSION')) {
	define('WDP_VERSION', '10.35.1');
}
if (!defined('WDP_PLUGIN_DIR')) {
	define('WDP_PLUGIN_DIR', dirname(__DIR__) . '/');
}
if (!defined('WDP_PLUGIN_URL')) {
	define('WDP_PLUGIN_URL', 'https://example.test/wp-content/plugins/woo-donation-popup/');
}
if (!defined('WDP_ASSET_VERSION')) {
	define('WDP_ASSET_VERSION', '10.35.1');
}

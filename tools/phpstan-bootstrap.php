<?php
/**
 * PHPStan bootstrap — eklenti sabitleri. WordPress çekirdeği yüklenmez.
 *
 * @package DonationPanel
 */

if (!defined('ABSPATH')) {
	define('ABSPATH', dirname(__DIR__) . '/');
}
if (!defined('WDP_PLUGIN_FILE')) {
	define('WDP_PLUGIN_FILE', dirname(__DIR__) . '/woo-donation-popup.php');
}
if (!defined('WDP_VERSION')) {
	define('WDP_VERSION', '12.2.0');
}
if (!defined('WDP_PLUGIN_DIR')) {
	define('WDP_PLUGIN_DIR', dirname(__DIR__) . '/');
}
if (!defined('WDP_PLUGIN_URL')) {
	define('WDP_PLUGIN_URL', 'https://example.test/wp-content/plugins/woo-donation-popup/');
}
if (!defined('WDP_ASSET_VERSION')) {
	define('WDP_ASSET_VERSION', '12.2.0');
}

require_once dirname(__DIR__) . '/src/Core/class-autoloader.php';
\DonationPanel\Core\Autoloader::register(dirname(__DIR__) . '/src');

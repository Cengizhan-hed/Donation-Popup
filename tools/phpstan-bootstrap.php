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
	define('WDP_VERSION', '12.0.0');
}
if (!defined('WDP_PLUGIN_DIR')) {
	define('WDP_PLUGIN_DIR', dirname(__DIR__) . '/');
}
if (!defined('WDP_PLUGIN_URL')) {
	define('WDP_PLUGIN_URL', 'https://example.test/wp-content/plugins/woo-donation-popup/');
}
if (!defined('WDP_ASSET_VERSION')) {
	define('WDP_ASSET_VERSION', '12.0.0');
}

// Yönetici köprüsü: eski küresel sınıf adları taşınan ad alanlı sınıflara takma ad olur (statik analiz için).
require_once dirname(__DIR__) . '/src/Core/class-autoloader.php';
\DonationPanel\Core\Autoloader::register(dirname(__DIR__) . '/src');
if (is_file(dirname(__DIR__) . '/includes/class-autoloader.php')) {
	require_once dirname(__DIR__) . '/includes/class-autoloader.php';
	foreach (array_keys(WDP_Autoloader::MOVED) as $wdp_old_class) {
		class_exists($wdp_old_class);
	}
}

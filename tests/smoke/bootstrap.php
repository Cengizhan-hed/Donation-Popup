<?php
/**
 * Smoke test başlatıcı — WordPress olmadan eklenti sınıflarını yükler.
 *
 * Görev: Test ortamında ABSPATH, WDP_PLUGIN_DIR ve autoloader tanımlar.
 */

declare(strict_types=1);

$root = dirname(__DIR__, 2);

if (!defined('ABSPATH')) {
    define('ABSPATH', $root . '/');
}
if (!defined('WDP_PLUGIN_DIR')) {
    define('WDP_PLUGIN_DIR', $root . '/');
}
if (!defined('WDP_PLUGIN_FILE')) {
    define('WDP_PLUGIN_FILE', $root . '/woo-donation-popup.php');
}
if (!defined('WDP_VERSION')) {
    define('WDP_VERSION', '10.28.0');
}

require_once WDP_PLUGIN_DIR . 'includes/class-exceptions.php';
require_once WDP_PLUGIN_DIR . 'includes/class-autoloader.php';
WDP_Autoloader::register();

<?php
/**
 * Autoloader for WDP classes
 * 
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Class WDP_Autoloader
 */
class WDP_Autoloader {

    /**
     * Register autoloader
     */
    public static function register() {
        spl_autoload_register(array(__CLASS__, 'autoload'));
    }

    /**
     * Autoload classes
     *
     * @param string $class_name Class name to load.
     */
    public static function autoload($class_name) {
        // Only load WDP classes
        if (strpos($class_name, 'WDP_') !== 0) {
            return;
        }

        // Convert class name to file path
        // WDP_Assets -> class-assets.php
        // WDP_Ajax -> class-ajax.php
        $class_name = str_replace('WDP_', '', $class_name);
        $file_name = 'class-' . strtolower(str_replace('_', '-', $class_name)) . '.php';
        $file_path = WDP_PLUGIN_DIR . 'includes/classes/' . $file_name;

        if (file_exists($file_path)) {
            require_once $file_path;
        }
    }
}

// Register autoloader
WDP_Autoloader::register();


<?php
/**
 * Autoloader for WDP_* classes (flat includes/ + traits/).
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
     * Register autoloader.
     *
     * @return void
     */
    public static function register() {
        spl_autoload_register(array(__CLASS__, 'autoload'));
    }

    /**
     * Convert WDP class name to class-{kebab}.php filename.
     *
     * @param string $class_name Full class name.
     * @return string
     */
    private static function class_name_to_file_name($class_name) {
        $suffix = str_replace('WDP_', '', $class_name);
        return 'class-' . strtolower(str_replace('_', '-', $suffix)) . '.php';
    }

    /**
     * Try require_once if file exists.
     *
     * @param string $file_path Absolute path.
     * @return bool
     */
    private static function require_if_exists($file_path) {
        if ($file_path && file_exists($file_path)) {
            require_once $file_path;
            return true;
        }
        return false;
    }

    /**
     * Autoload classes.
     *
     * @param string $class_name Class name to load.
     * @return void
     */
    public static function autoload($class_name) {
        if (strpos($class_name, 'WDP_') !== 0) {
            return;
        }

        $exception_classes = array(
            'WDP_Exception',
            'WDP_Product_Not_Found_Exception',
            'WDP_Validation_Exception',
            'WDP_Security_Exception',
            'WDP_Cart_Exception',
        );
        if (in_array($class_name, $exception_classes, true)) {
            self::require_if_exists(WDP_PLUGIN_DIR . 'includes/class-exceptions.php');
            return;
        }

        $file_name = self::class_name_to_file_name($class_name);
        $root      = WDP_PLUGIN_DIR . 'includes/';

        self::require_if_exists($root . $file_name);
    }
}

WDP_Autoloader::register();

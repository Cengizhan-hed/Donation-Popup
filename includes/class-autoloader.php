<?php
/**
 * ============================================================================
 * WDP AUTOLOADER - OTOMATIK SINIF YÜKLEME SİSTEMİ
 * ============================================================================
 * 
 * DOSYA: class-autoloader.php
 * KONUM: /includes/class-autoloader.php
 * 
 * AMAÇ:
 * WDP_ ile başlayan sınıfları otomatik olarak yükler.
 * PSR-4 benzeri bir autoloading sistemi sağlar.
 * 
 * NASIL ÇALIŞIR:
 * 1. PHP'de bir sınıf çağrıldığında (örn: new WDP_Assets())
 * 2. PHP autoload sistemine kayıtlı olan bu fonksiyon çalışır
 * 3. Sınıf adını dosya yoluna çevirir
 * 4. Dosyayı yükler
 * 
 * DÖNÜŞÜM KURALLARI:
 * - WDP_Assets → class-assets.php
 * - WDP_Ajax → class-ajax.php
 * - WDP_Cart → class-cart.php
 * 
 * DOSYA YOLU:
 * /includes/classes/class-{küçük-harfli-sınıf-adı}.php
 * 
 * ÖRNEK:
 * new WDP_Assets() çağrıldığında
 * → /includes/classes/class-assets.php dosyası yüklenir
 * 
 * GÜVENLİK:
 * - Sadece WDP_ ile başlayan sınıfları yükler
 * - Dosya var mı kontrol eder
 * - ABSPATH kontrolü ile güvenlik
 * 
 * PERFORMANS:
 * - Sadece gerektiğinde yükler (lazy loading)
 * - Her sınıf için sadece bir kez yükler
 * 
 * ============================================================================
 * 
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

        $exception_classes = array(
            'WDP_Exception',
            'WDP_Product_Not_Found_Exception',
            'WDP_Validation_Exception',
            'WDP_Security_Exception',
            'WDP_Cart_Exception',
        );
        if (in_array($class_name, $exception_classes, true)) {
            $exceptions_file = WDP_PLUGIN_DIR . 'includes/classes/class-exceptions.php';
            if (file_exists($exceptions_file)) {
                require_once $exceptions_file;
            }
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


<?php
/**
 * ============================================================================
 * WOOCOMMERCE DONATION POPUP - ANA EKLENTI SINIFI
 * ============================================================================
 * 
 * DOSYA: class-woo-donation-popup.php
 * KONUM: /includes/class-woo-donation-popup.php
 * 
 * AMAÇ:
 * Ana eklenti sınıfı - tüm modülleri başlatır ve koordine eder.
 * Bu sınıf bir orchestrator görevi görür.
 * 
 * ROL:
 * - Modül başlatma sistemi
 * - Activation/deactivation hooks
 * - Hata yönetimi
 * - Modül bağımlılık yönetimi
 * 
 * MODÜL BAŞLATMA SIRASI:
 * 1. WDP_Utils - Yardımcı fonksiyonlar (diğer modüller için gerekli)
 * 2. WDP_Assets - CSS/JS yükleme sistemi
 * 3. WDP_Ajax - AJAX endpoint'leri
 * 4. WDP_Cart - Sepet işlemleri
 * 5. WDP_Order - Sipariş işlemleri
 * 6. WDP_Shortcodes - Shortcode'lar (en son, diğer modüllere bağımlı)
 * 
 * GÜVENLİK:
 * - Try-catch ile hata yönetimi
 * - Modül yoksa diğerlerini etkilemez
 * - Debug modunda hata loglama
 * 
 * ============================================================================
 * 
 * WooCommerce Donation Modal Popup main class
 * 
 * @package WooCommerce\Donation_Popup
*/
if (!defined('ABSPATH')) {
    exit;
}

class Woo_Donation_Popup {
 
 /**
     * Eklenti etkinleştirildiğinde çalışacak fonksiyon
  */
 public static function activate() {
     // Önbellek versiyonunu güncelle
     update_option('wdp_cache_version', time());
 }

 /**
  * Eklenti devre dışı bırakıldığında çalışacak fonksiyon
  */
 public static function deactivate() {
     // Temizlik işlemleri
 }
 
 /**
  * Constructor
  */
 public function __construct() {
        // Modülleri güvenli bir şekilde başlat (autoloader tarafından yüklenirler)
        $this->init_modules();
    }
    
    /**
     * Initialize all modules safely
     * 
     * @return void
     */
    private function init_modules() {
        // Modül başlatma sırası (bağımlılıklara göre)
        $modules = array(
            'WDP_Utils',
            'WDP_Assets',
            'WDP_Meta_Tracking',
            'WDP_Ajax',
            'WDP_Cart',
            'WDP_Order',
            // WDP_Templates - init() metodu yok, statik metodlar kullanılıyor
            'WDP_Shortcodes', // Shortcodes en son (diğer modüllere bağımlı)
        );
        
        foreach ($modules as $module_class) {
            try {
                // Class'ın varlığını kontrol et (autoloader çalışır ve class'ı yükler)
                if (class_exists($module_class)) {
                    // Static init() metodu varsa çağır
                    if (method_exists($module_class, 'init')) {
                        call_user_func(array($module_class, 'init'));
                    }
                    // init() metodu yoksa sorun değil (örneğin WDP_Templates)
                } else {
                    // Class yüklenemedi (autoloader hatası veya dosya yok)
                    if (defined('WP_DEBUG') && WP_DEBUG) {
                        error_log(sprintf('WDP Error: Class %s not found', $module_class));
                    }
                }
            } catch (Exception $e) {
                // Hata olsa bile diğer modülleri başlatmaya devam et
                if (defined('WP_DEBUG') && WP_DEBUG) {
                    error_log(sprintf('WDP Error: %s::init() failed: %s', $module_class, $e->getMessage()));
                }
            } catch (Throwable $e) {
                // PHP 7+ Throwable interface (Error ve Exception'ın üst sınıfı)
                if (defined('WP_DEBUG') && WP_DEBUG) {
                    error_log(sprintf('WDP Fatal Error: %s - %s', $module_class, $e->getMessage()));
                }
            }
        }
    }
}

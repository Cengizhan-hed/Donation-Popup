# 📚 WooCommerce Donation Popup - Detaylı Kod Dokümantasyonu

Bu dokümantasyon, eklentinin tüm dosyalarını ve kod satırlarını detaylıca açıklar.

---

## 📁 DOSYA YAPISI

### Ana Dizin
```
Donation Popup/
├── woo-donation-popup.php          # Ana plugin dosyası (WordPress entry point)
├── includes/                        # PHP sınıf dosyaları
│   ├── class-autoloader.php        # Otomatik sınıf yükleme sistemi
│   ├── class-woo-donation-popup.php # Ana eklenti sınıfı
│   ├── class-woo-donation-popup-admin.php # Admin panel sınıfı
│   └── classes/                     # Modüler sınıf dosyaları
├── assets/                          # CSS ve JavaScript dosyaları
│   ├── css/                         # Stil dosyaları
│   └── js/                          # JavaScript dosyaları
└── README.md                        # Kullanım kılavuzu
```

---

## 📄 DOSYA DETAYLARI

### 1. woo-donation-popup.php
**Konum:** `/woo-donation-popup.php`  
**Amaç:** WordPress plugin sistemine eklentiyi tanıtan ana dosya  
**Rol:** Entry point - WordPress bu dosyayı yükler ve eklentiyi başlatır

#### Satır Satır Açıklama:

**Satır 1-18: Plugin Header**
```php
<?php
/**
* Plugin Name: WooCommerce Donation Modal Popup
* Description: WooCommerce ürünleri için bağış formu açılır penceresi oluşturur
* ...
*/
```
- **Amaç:** WordPress plugin sistemine eklenti bilgilerini verir
- **İşlev:** WordPress admin panelinde görünen bilgiler
- **Önemli:** Version, requirements, license bilgileri

**Satır 20-22: Güvenlik Kontrolü**
```php
if (!defined('ABSPATH')) {
   exit; // Güvenlik önlemi, doğrudan erişimi engelle
}
```
- **Amaç:** Dosyanın doğrudan URL'den erişilmesini engeller
- **İşlev:** Sadece WordPress içinden çalışmasını sağlar
- **Güvenlik:** XSS ve doğrudan dosya erişimini önler

**Satır 24-29: WooCommerce HPOS Uyumluluğu**
```php
add_action('before_woocommerce_init', function() {
   if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
       \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
   }
});
```
- **Amaç:** WooCommerce'in yeni High-Performance Order Storage (HPOS) sistemine uyumluluğu bildirir
- **İşlev:** WooCommerce 8.0+ için gerekli uyumluluk bildirimi
- **Önemli:** Eklentinin WooCommerce'in yeni order storage sisteminde çalışmasını sağlar

**Satır 31-35: Sabitler (Constants)**
```php
define('WDP_VERSION', '10.0');
define('WDP_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WDP_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WDP_ASSET_VERSION', get_option('wdp_cache_version', WDP_VERSION));
```
- **WDP_VERSION:** Eklenti versiyonu (cache busting için kullanılır)
- **WDP_PLUGIN_DIR:** Eklenti dizininin fiziksel yolu
- **WDP_PLUGIN_URL:** Eklenti dosyalarının URL'i
- **WDP_ASSET_VERSION:** Asset cache versiyonu (CSS/JS dosyaları için)

**Satır 37-42: Dosya Dahil Etme**
```php
require_once WDP_PLUGIN_DIR . 'includes/class-autoloader.php';
require_once WDP_PLUGIN_DIR . 'includes/class-woo-donation-popup.php';
require_once WDP_PLUGIN_DIR . 'includes/class-woo-donation-popup-admin.php';
```
- **Amaç:** Gerekli sınıf dosyalarını yükler
- **Sıra:** Autoloader önce, sonra ana sınıflar
- **Not:** Autoloader diğer sınıfları otomatik yükler

**Satır 44-53: Plugin Başlatma Fonksiyonu**
```php
function wdp_launch_plugin() {
   if (class_exists('WooCommerce')) {
       $GLOBALS['woo_donation_popup'] = new Woo_Donation_Popup();
       $GLOBALS['woo_donation_popup_admin'] = new Woo_Donation_Popup_Admin();
   } else {
       add_action('admin_notices', 'wdp_woocommerce_missing_notice');
   }
}
add_action('plugins_loaded', 'wdp_launch_plugin');
```
- **Amaç:** Eklentiyi başlatır
- **Kontrol:** WooCommerce'in yüklü olup olmadığını kontrol eder
- **Global:** Ana sınıfları global değişkene atar (diğer dosyalardan erişim için)
- **Hook:** `plugins_loaded` - Tüm eklentiler yüklendikten sonra çalışır

**Satır 55-64: WooCommerce Eksik Uyarısı**
```php
function wdp_woocommerce_missing_notice() {
   ?>
   <div class="notice notice-error">
       <p><?php _e('WooCommerce Donation Modal Popup eklentisi için WooCommerce eklentisinin yüklü ve aktif olması gerekiyor.', 'woo-donation-popup'); ?></p>
   </div>
   <?php
}
```
- **Amaç:** WooCommerce yoksa admin panelinde uyarı gösterir
- **Görünüm:** Kırmızı hata mesajı
- **Çeviri:** `_e()` fonksiyonu ile çeviri desteği

**Satır 66-68: Activation/Deactivation Hooks**
```php
register_activation_hook(__FILE__, array('Woo_Donation_Popup', 'activate'));
register_deactivation_hook(__FILE__, array('Woo_Donation_Popup', 'deactivate'));
```
- **Amaç:** Eklenti etkinleştirildiğinde/devre dışı bırakıldığında çalışacak fonksiyonları kaydeder
- **activate:** İlk kurulum işlemleri (cache temizleme, versiyon güncelleme)
- **deactivate:** Temizlik işlemleri

**Satır 70-88: Versiyon Güncelleme Sistemi**
```php
function wdp_update_version() {
   $current_version = get_option('wdp_version', '1.0');
   
   if ($current_version !== WDP_VERSION) {
       update_option('wdp_version', WDP_VERSION);
       update_option('wdp_cache_version', time());
       set_transient('wdp_flush_rewrite', true, 30);
       wdp_clear_all_caches();
   }
}
```
- **Amaç:** Eklenti güncellendiğinde otomatik işlemler yapar
- **Kontrol:** Mevcut versiyon ile yeni versiyonu karşılaştırır
- **İşlemler:** 
  - Versiyon kaydını günceller
  - Cache versiyonunu günceller (asset cache busting)
  - Önbellekleri temizler

**Satır 90-103: Cache Temizleme Fonksiyonu**
```php
function wdp_clear_all_caches() {
    delete_transient('wdp_flush_rewrite');
    
    if (function_exists('wc_delete_product_transients')) {
        wc_delete_product_transients();
    }
    
    if (function_exists('wp_cache_flush')) {
        wp_cache_flush();
    }
}
```
- **Amaç:** Tüm önbellekleri temizler
- **İşlemler:**
  - Transient'ları siler
  - WooCommerce product cache'ini temizler
  - WordPress object cache'ini temizler

**Satır 108-129: Bağış Butonu Render Fonksiyonu**
```php
function wdp_render_donation_button($product_id, $button_text = 'Bağış Yap') {
   global $woo_donation_popup;
   
   if (!isset($woo_donation_popup)) {
       return '<p style="color:red;">WooCommerce Donation Popup eklentisi aktif değil.</p>';
   }
   
   $product_id = intval($product_id);
   $product = wc_get_product($product_id);
   if (!$product) {
       error_log('WDP: Ürün bulunamadı - ID: ' . $product_id);
       return '<p style="color:red;">Ürün bulunamadı...</p>';
   }
   
   return $woo_donation_popup->render_donation_modal($product_id, $button_text);
}
```
- **Amaç:** PHP'den doğrudan bağış butonu render etmek için
- **Parametreler:** 
  - `$product_id`: Ürün ID'si
  - `$button_text`: Buton metni (varsayılan: 'Bağış Yap')
- **Kontroller:** 
  - Eklenti aktif mi?
  - Ürün var mı?
- **Kullanım:** `<?php echo wdp_render_donation_button(123, 'Bağış Yap'); ?>`

**Satır 131-165: Form Render Fonksiyonu**
```php
function wdp_render_donation_form($product_id, $args = array()) {
   // ... ürün kontrolü ...
   
   $default_args = array(
       'id' => $product_id,
       'button_text' => 'Bağış Yap',
       'title' => '',
       'show_title' => 'yes',
       'class' => ''
   );
   
   $args = wp_parse_args($args, $default_args);
   return $woo_donation_popup->donation_form_shortcode($args);
}
```
- **Amaç:** PHP'den doğrudan form render etmek için
- **Parametreler:** Ürün ID ve özelleştirme argümanları
- **Varsayılanlar:** Güvenli varsayılan değerler
- **Kullanım:** `<?php echo wdp_render_donation_form(123, array('title' => 'Özel Başlık')); ?>`

**Satır 167-314: JavaScript Helper Fonksiyonları**
```php
add_action('wp_footer', 'wdp_add_js_helpers');

function wdp_add_js_helpers() {
   ?>
   <script>
   // Global WDP namespace
   if (typeof window.WDP === 'undefined') {
       window.WDP = {};
   }
   
   // AJAX ile buton render etme
   window.WDP.renderDonationButton = function(productId, containerId) {
       // ... AJAX isteği ...
   };
   
   // Hata mesajlarını gizleme
   window.WDP.hideErrorMessages = function() {
       // ... WooCommerce hata mesajlarını gizle ...
   };
   
   // DOM ready event listener
   document.addEventListener('DOMContentLoaded', function() {
       // ... hata mesajı gizleme ve form izleme ...
   });
   </script>
   <?php
}
```
- **Amaç:** Frontend'de kullanılacak JavaScript helper fonksiyonları
- **renderDonationButton:** AJAX ile dinamik buton render etme
- **hideErrorMessages:** WooCommerce hata mesajlarını gizleme
- **MutationObserver:** DOM değişikliklerini izleme

**Satır 316-342: AJAX Endpoint**
```php
add_action('wp_ajax_wdp_render_donation_button', 'wdp_ajax_render_donation_button');
add_action('wp_ajax_nopriv_wdp_render_donation_button', 'wdp_ajax_render_donation_button');

function wdp_ajax_render_donation_button() {
   check_ajax_referer('wdp_render_donation_button', 'security');
   
   $product_id = isset($_POST['product_id']) ? absint($_POST['product_id']) : 0;
   // ... validasyon ve render ...
}
```
- **Amaç:** AJAX ile buton render etme endpoint'i
- **Güvenlik:** Nonce kontrolü
- **Validasyon:** Ürün ID kontrolü
- **Response:** JSON formatında HTML döner

**Satır 344-355: Debug Log Fonksiyonu**
```php
if (!function_exists('wdp_debug_log')) {
   function wdp_debug_log($message) {
       if (defined('WP_DEBUG') && WP_DEBUG === true) {
           if (is_array($message) || is_object($message)) {
               error_log(print_r($message, true));
           } else {
               error_log($message);
           }
       }
   }
}
```
- **Amaç:** Debug modunda log kaydetme
- **Kontrol:** Sadece `WP_DEBUG` aktifse çalışır
- **Format:** Array/object'leri düzgün formatlar

---

### 2. includes/class-woo-donation-popup.php
**Konum:** `/includes/class-woo-donation-popup.php`  
**Amaç:** Ana eklenti sınıfı - modülleri başlatır  
**Rol:** Orchestrator - tüm modülleri koordine eder

#### Satır Satır Açıklama:

**Satır 1-7: Sınıf Tanımı**
```php
<?php
/**
* WooCommerce Donation Modal Popup main class
* @package WooCommerce\Donation_Popup
*/
class Woo_Donation_Popup {
```
- **Amaç:** Ana eklenti sınıfı
- **Namespace:** WooCommerce\Donation_Popup
- **Rol:** Tüm modülleri başlatır ve koordine eder

**Satır 9-18: Activation Hook**
```php
public static function activate() {
    set_transient('wdp_flush_rewrite', true, 30);
    update_option('wdp_cache_version', time());
}
```
- **Amaç:** Eklenti etkinleştirildiğinde çalışır
- **İşlemler:**
  - Rewrite rules flush için transient oluşturur
  - Cache versiyonunu günceller (asset cache busting)

**Satır 20-25: Deactivation Hook**
```php
public static function deactivate() {
    // Temizlik işlemleri
}
```
- **Amaç:** Eklenti devre dışı bırakıldığında çalışır
- **Not:** Şu an boş, gelecekte temizlik işlemleri eklenebilir

**Satır 27-33: Constructor**
```php
public function __construct() {
    $this->init_modules();
}
```
- **Amaç:** Sınıf oluşturulduğunda modülleri başlatır
- **İşlev:** `init_modules()` metodunu çağırır

**Satır 35-79: Modül Başlatma Sistemi**
```php
private function init_modules() {
    $modules = array(
        'WDP_Utils',      // Yardımcı fonksiyonlar
        'WDP_Assets',    // CSS/JS yükleme
        'WDP_Ajax',      // AJAX işlemleri
        'WDP_Cart',      // Sepet işlemleri
        'WDP_Order',     // Sipariş işlemleri
        'WDP_Shortcodes', // Shortcode'lar
    );
    
    foreach ($modules as $module_class) {
        try {
            if (class_exists($module_class)) {
                if (method_exists($module_class, 'init')) {
                    call_user_func(array($module_class, 'init'));
                }
            }
        } catch (Exception $e) {
            // Hata loglama
        }
    }
}
```
- **Amaç:** Tüm modülleri sırayla başlatır
- **Sıra:** Bağımlılıklara göre sıralanmış
- **Güvenlik:** Try-catch ile hata yönetimi
- **Esneklik:** Modül yoksa diğerlerini etkilemez

---

### 3. includes/class-autoloader.php
**Konum:** `/includes/class-autoloader.php`  
**Amaç:** Otomatik sınıf yükleme sistemi  
**Rol:** PSR-4 benzeri autoloading

#### Satır Satır Açıklama:

**Satır 1-10: Güvenlik ve Sınıf Tanımı**
```php
<?php
/**
 * Autoloader for WDP classes
 */
if (!defined('ABSPATH')) {
    exit;
}

class WDP_Autoloader {
```
- **Amaç:** WDP_ ile başlayan sınıfları otomatik yükler
- **Güvenlik:** ABSPATH kontrolü

**Satır 17-22: Autoloader Kayıt**
```php
public static function register() {
    spl_autoload_register(array(__CLASS__, 'autoload'));
}
```
- **Amaç:** PHP'nin autoload sistemine kaydeder
- **İşlev:** Sınıf çağrıldığında otomatik `autoload()` metodunu çağırır

**Satır 24-45: Autoload Metodu**
```php
public static function autoload($class_name) {
    // Sadece WDP_ ile başlayan sınıfları yükle
    if (strpos($class_name, 'WDP_') !== 0) {
        return;
    }
    
    // WDP_Assets -> class-assets.php
    $class_name = str_replace('WDP_', '', $class_name);
    $file_name = 'class-' . strtolower(str_replace('_', '-', $class_name)) . '.php';
    $file_path = WDP_PLUGIN_DIR . 'includes/classes/' . $file_name;
    
    if (file_exists($file_path)) {
        require_once $file_path;
    }
}
```
- **Amaç:** Sınıf adını dosya yoluna çevirir
- **Dönüşüm:** 
  - `WDP_Assets` → `class-assets.php`
  - `WDP_Ajax` → `class-ajax.php`
- **Kontrol:** Dosya var mı kontrol eder
- **Yükleme:** Varsa dosyayı yükler

**Satır 48-49: Otomatik Kayıt**
```php
WDP_Autoloader::register();
```
- **Amaç:** Dosya yüklendiğinde autoloader'ı otomatik kaydeder
- **Not:** Bu satır dosyanın sonunda çalışır

---

## 📋 TÜM DOSYALAR LİSTESİ

### PHP Dosyaları (13 dosya)

1. **woo-donation-popup.php** ✅ (Detaylı açıklama eklendi)
   - Ana plugin dosyası
   - WordPress entry point
   - Helper fonksiyonlar
   - AJAX endpoint'leri

2. **includes/class-autoloader.php** ✅ (Detaylı açıklama eklendi)
   - Otomatik sınıf yükleme sistemi
   - WDP_ prefix kontrolü
   - Dosya yolu dönüşümü

3. **includes/class-woo-donation-popup.php** ✅ (Detaylı açıklama eklendi)
   - Ana eklenti sınıfı
   - Modül başlatma sistemi
   - Activation/deactivation hooks

4. **includes/class-woo-donation-popup-admin.php**
   - Admin panel sınıfı
   - Settings page
   - Form kaydetme işlemleri

5. **includes/classes/class-assets.php** ✅ (Detaylı açıklama eklendi)
   - CSS/JS yükleme sistemi
   - Asset versioning
   - Cache busting
   - Inline CSS

6. **includes/classes/class-ajax.php** ✅ (Detaylı açıklama eklendi)
   - AJAX endpoint'leri
   - Product info, cart, add to cart
   - Güvenlik kontrolleri

7. **includes/classes/class-templates.php** ✅ (Detaylı açıklama eklendi)
   - HTML şablon render
   - Modal ve form HTML
   - Template generation

8. **includes/classes/class-cart.php**
   - Sepet işlemleri
   - Cart manipulation
   - WooCommerce cart integration

9. **includes/classes/class-order.php**
   - Sipariş işlemleri
   - Order creation
   - Order meta handling

10. **includes/classes/class-shortcodes.php**
    - Shortcode tanımları
    - [wdp_donation_form] shortcode
    - Shortcode rendering

11. **includes/classes/class-utils.php**
    - Yardımcı fonksiyonlar
    - Utility methods
    - Helper functions

12. **includes/classes/class-exceptions.php**
    - Custom exception sınıfları
    - Error handling
    - Exception types

13. **includes/classes/class-security.php**
    - Güvenlik kontrolleri
    - Rate limiting
    - Security checks

### JavaScript Dosyaları (15 dosya)

1. **assets/js/src/init.js** ✅ (Detaylı açıklama eklendi)
   - Plugin başlatma orkestratörü
   - Modül koordinasyonu
   - DOM ready handling

2. **assets/js/src/utils.js** ✅ (Detaylı açıklama eklendi)
   - Yardımcı fonksiyonlar
   - Format, log, ajax, accessibility
   - Debounce, throttle

3. **assets/js/src/form.js** ✅ (Detaylı açıklama eklendi)
   - Form işlemleri
   - Validation, submission
   - Error handling

4. **assets/js/src/modal.js** ✅ (Detaylı açıklama eklendi)
   - Modal açma/kapama
   - Focus trap
   - Keyboard navigation

5. **assets/js/src/constants.js**
   - Sabitler
   - Configuration values
   - Default settings

6. **assets/js/src/state.js**
   - State management
   - Global state
   - State updates

7. **assets/js/src/dom.js**
   - DOM manipülasyonu
   - Element queries
   - DOM utilities

8. **assets/js/src/alerts.js**
   - Alert mesajları
   - Success/error notifications
   - Toast messages

9. **assets/js/src/cart.js**
   - Sepet işlemleri
   - Cart updates
   - Side cart management

10. **assets/js/src/product.js**
    - Ürün işlemleri
    - Product data
    - Product info fetching

11. **assets/js/src/shareholder.js**
    - Hissedar form işlemleri
    - Collapse/expand
    - Shareholder management

12. **assets/js/src/event-manager.js**
    - Event yönetimi
    - Event delegation
    - Event handlers

13. **assets/js/src/form-initializer.js**
    - Form başlatma
    - Form initialization
    - Form setup

14. **assets/js/src/module-loader.js**
    - Modül yükleme
    - Dependency management
    - Module loading

15. **assets/js/admin-script.js**
    - Admin panel JavaScript
    - Admin functionality
    - Settings page JS

### CSS Dosyaları (16 dosya)

1. **assets/css/donation-modal.css** ✅ (Detaylı açıklama eklendi)
   - Ana CSS dosyası
   - Modüler import'lar
   - CSS aggregation

2. **assets/css/src/tokens.css** ✅ (Detaylı açıklama eklendi)
   - Design tokens
   - CSS variables
   - Design system

3. **assets/css/src/base.css** ✅ (Detaylı açıklama eklendi)
   - Temel reset
   - Normalize
   - Theme isolation

4. **assets/css/src/layout.css**
   - Layout kuralları
   - Modal genişlikleri
   - Responsive layout

5. **assets/css/src/forms/shared.css**
   - Paylaşılan form stilleri
   - Common form styles
   - Form base styles

6. **assets/css/src/forms/hisseli.css** ✅ (Detaylı açıklama eklendi)
   - Hissedar form stilleri
   - Collapse/expand
   - Icon styles

7. **assets/css/src/components/buttons.css**
   - Buton stilleri
   - Button variants
   - Button states

8. **assets/css/src/components/feedback.css**
   - Form feedback
   - Error/success messages
   - Validation styles

9. **assets/css/src/components/loading.css**
   - Loading states
   - Spinners
   - Skeleton loaders

10. **assets/css/src/components/motion.css**
    - Animasyonlar
    - Transitions
    - Keyframes

11. **assets/css/src/components/accessibility.css**
    - Erişilebilirlik
    - Focus states
    - ARIA styles

12. **assets/css/src/components/alerts.css**
    - Alert mesajları
    - Notification styles
    - Alert variants

13. **assets/css/src/components/quantity.css**
    - Miktar sayacı
    - Quantity selector
    - Counter styles

14. **assets/css/src/components/success.css**
    - Başarı ekranı
    - Success screen
    - Completion styles

15. **assets/css/src/components/toast.css**
    - Toast bildirimleri
    - Toast notifications
    - Toast animations

16. **assets/css/admin-style.css**
    - Admin panel stilleri
    - Settings page CSS
    - Admin UI

---

## 📝 NOTLAR

- ✅ İşareti olan dosyalar detaylı açıklamalarla güncellenmiştir
- Her dosyanın başına detaylı başlık ve açıklama eklenmiştir
- Kod satırları için inline yorumlar dosyaların içinde mevcuttur
- Tüm dosyalar için dokümantasyon devam etmektedir

---

## 🔍 NASIL KULLANILIR?

1. **Dosya Açıklamaları:** Her dosyanın başında detaylı açıklama bulunur
2. **Satır Açıklamaları:** Önemli kod satırlarında inline yorumlar vardır
3. **Dokümantasyon:** Bu dosya genel bakış sağlar
4. **Kod İnceleme:** Her dosyayı açarak detaylı açıklamaları görebilirsiniz

---

## 📚 EK KAYNAKLAR

- **README.md:** Kullanım kılavuzu
- **CHANGELOG.md:** Versiyon geçmişi
- **PERFORMANS_VE_GORUNUM_ANALIZI.md:** Performans analizi


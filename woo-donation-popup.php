<?php
/**
 * ============================================================================
 * WOOCOMMERCE DONATION MODAL POPUP - ANA PLUGIN DOSYASI
 * ============================================================================
 * 
 * DOSYA: woo-donation-popup.php
 * KONUM: /woo-donation-popup.php (Plugin root dizini)
 * 
 * AMAÇ:
 * Bu dosya WordPress plugin sistemine eklentiyi tanıtan ana entry point'tir.
 * WordPress bu dosyayı yükler ve eklentiyi başlatır.
 * 
 * ROL:
 * - Plugin header bilgileri (WordPress admin panelinde görünür)
 * - Güvenlik kontrolleri
 * - Sabitler (constants) tanımlama
 * - Sınıf dosyalarını dahil etme
 * - Plugin başlatma fonksiyonları
 * - Activation/deactivation hooks
 * - Versiyon güncelleme sistemi
 * - Cache yönetimi
 * - PHP helper fonksiyonları
 * - JavaScript helper fonksiyonları
 * - AJAX endpoint'leri
 * 
 * BAĞIMLILIKLAR:
 * - WordPress 5.0+
 * - WooCommerce 3.0+
 * - PHP 7.4+
 * 
 * KULLANIM:
 * Bu dosya WordPress tarafından otomatik yüklenir.
 * Manuel olarak çağrılmamalıdır.
 * 
 * GÜVENLİK:
 * - ABSPATH kontrolü ile doğrudan erişim engellenir
 * - Nonce doğrulaması AJAX isteklerinde
 * - Input sanitization tüm kullanıcı girdilerinde
 * 
 * ============================================================================
 * 
 * Plugin Name: WooCommerce Donation Modal Popup
 * Description: WooCommerce ürünleri için bağış formu açılır penceresi oluşturur (Tüm temalarla uyumlu).
 * Author: Your Name
 * Version: 10.0
 * Requires at least: 5.0
 * Tested up to: 6.4
 * WC requires at least: 3.0
 * WC tested up to: 8.5
 * License: GPLv2 or later
 * Text Domain: woo-donation-popup
 * 
 * Woo: 12345:342928dfsfhsf8429842374wdf4234sfd
 * WooCommerce: true
 *
 * @package WooCommerce\Donation_Popup
*/

if (!defined('ABSPATH')) {
   exit; // Güvenlik önlemi, doğrudan erişimi engelle
}

// WooCommerce HPOS uyumluluğunu belirt
add_action('before_woocommerce_init', function() {
   if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
       \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
   }
});

// Eklenti versiyonunu güncelle
define('WDP_VERSION', '10.0');
define('WDP_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WDP_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WDP_ASSET_VERSION', get_option('wdp_cache_version', WDP_VERSION));

// Autoloader'ı dahil et (modüller için)
require_once WDP_PLUGIN_DIR . 'includes/class-autoloader.php';

// Eklenti sınıf dosyasını dahil et
require_once WDP_PLUGIN_DIR . 'includes/class-woo-donation-popup.php';
require_once WDP_PLUGIN_DIR . 'includes/class-woo-donation-popup-admin.php'; // Admin sınıfını dahil et

// Eklenti ana sınıfını başlat
function wdp_launch_plugin() {
   if (class_exists('WooCommerce')) {
       $GLOBALS['woo_donation_popup'] = new Woo_Donation_Popup();
       $GLOBALS['woo_donation_popup_admin'] = new Woo_Donation_Popup_Admin();
   } else {
       add_action('admin_notices', 'wdp_woocommerce_missing_notice');
   }
}
add_action('plugins_loaded', 'wdp_launch_plugin');

/**
* WooCommerce eksik olduğunda admin panelinde uyarı göster
*/
function wdp_woocommerce_missing_notice() {
   ?>
   <div class="notice notice-error">
       <p><?php _e('WooCommerce Donation Modal Popup eklentisi için WooCommerce eklentisinin yüklü ve aktif olması gerekiyor.', 'woo-donation-popup'); ?></p>
   </div>
   <?php
}

// Eklenti etkinleştirildiğinde ve devre dışı bırakıldığında çalışacak fonksiyonlar
register_activation_hook(__FILE__, array('Woo_Donation_Popup', 'activate'));
register_deactivation_hook(__FILE__, array('Woo_Donation_Popup', 'deactivate'));

// Eklenti versiyonunu güncelle
add_action('plugins_loaded', 'wdp_update_version');

/**
* Eklenti versiyonunu güncelle
*/
function wdp_update_version() {
   $current_version = get_option('wdp_version', '1.0');
   
   // Eğer versiyon değiştiyse
   if ($current_version !== WDP_VERSION) {
       update_option('wdp_version', WDP_VERSION);
       update_option('wdp_cache_version', time()); // Önbellek versiyonunu güncelle
       set_transient('wdp_flush_rewrite', true, 30); // Bildirim göster
       
       // Önbelleği temizle
       wdp_clear_all_caches();
   }
}

/**
 * Eklenti ile ilişkili temel önbellekleri temizle
 */
function wdp_clear_all_caches() {
    delete_transient('wdp_flush_rewrite');

    if (function_exists('wc_delete_product_transients')) {
        wc_delete_product_transients();
    }

    if (function_exists('wp_cache_flush')) {
        wp_cache_flush();
    }
}

// Shortcode'u doğrudan çağırmak için yardımcı fonksiyon ekleyin
// Bu fonksiyon, woo-donation-popup.php dosyasının sonuna eklenmelidir

/**
* Shortcode'u doğrudan çağırmak için yardımcı fonksiyon
*/
function wdp_render_donation_button($product_id, $button_text = 'Bağış Yap') {
   global $woo_donation_popup;
   
   if (!isset($woo_donation_popup)) {
       return '<p style="color:red;">WooCommerce Donation Popup eklentisi aktif değil.</p>';
   }
   
   // Ürün ID'sini integer'a çevir
   $product_id = intval($product_id);
   
   // Ürünün varlığını kontrol et
   $product = wc_get_product($product_id);
   if (!$product) {
       error_log('WDP: Ürün bulunamadı - ID: ' . $product_id);
       return '<p style="color:red;">Ürün bulunamadı (ID: ' . esc_html($product_id) . '). Lütfen ürün ID\'sini kontrol edin.</p>';
   }
   
   return $woo_donation_popup->render_donation_modal($product_id, $button_text);
}

/**
* Doğrudan form shortcode'unu çağırmak için yardımcı fonksiyon
*/
function wdp_render_donation_form($product_id, $args = array()) {
   global $woo_donation_popup;
   
   if (!isset($woo_donation_popup)) {
       return '<p style="color:red;">WooCommerce Donation Popup eklentisi aktif değil.</p>';
   }
   
   // Ürün ID'sini integer'a çevir
   $product_id = intval($product_id);
   
   // Ürünün varlığını kontrol et
   $product = wc_get_product($product_id);
   if (!$product) {
       error_log('WDP: Ürün bulunamadı - ID: ' . $product_id);
       return '<p style="color:red;">Ürün bulunamadı (ID: ' . esc_html($product_id) . '). Lütfen ürün ID\'sini kontrol edin.</p>';
   }
   
   // Varsayılan argümanları ayarla
   $default_args = array(
       'id' => $product_id,
       'button_text' => 'Bağış Yap',
       'title' => '',
       'show_title' => 'yes',
       'class' => ''
   );
   
   // Argümanları birleştir
   $args = wp_parse_args($args, $default_args);
   
   // Shortcode'u çağır
   return $woo_donation_popup->donation_form_shortcode($args);
}

// JavaScript için global fonksiyon ekle
add_action('wp_footer', 'wdp_add_js_helpers');

function wdp_add_js_helpers() {
   ?>
   <script>
   if (typeof window.WDP === 'undefined') {
       window.WDP = {};
   }
   
   // Bağış butonunu render etmek için JavaScript fonksiyonu
   window.WDP.renderDonationButton = function(productId, containerId) {
       var container = document.getElementById(containerId);
       if (!container) return;
       
       // AJAX ile HTML'i al
       var xhr = new XMLHttpRequest();
       xhr.open('POST', '<?php echo admin_url('admin-ajax.php'); ?>', true);
       xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
       xhr.onreadystatechange = function() {
           if (xhr.readyState === 4 && xhr.status === 200) {
               try {
                   var response = JSON.parse(xhr.responseText);
                   if (response.success && response.html) {
                       container.innerHTML = response.html;
                       // Olay dinleyicilerini yeniden bağla
                       if (typeof window.WDP.refresh === 'function') {
                           window.WDP.refresh();
                       }
                   }
               } catch (e) {
                   console.error('Error parsing donation button response:', e);
               }
           }
       };
      xhr.send('action=wdp_render_donation_button&product_id=' + productId + '&security=<?php echo wp_create_nonce('wdp_render_donation_button'); ?>');
   };
   
   // Hata mesajlarını gizlemek için yardımcı fonksiyon
   window.WDP.hideErrorMessages = function() {
    var baseSelectors = ['.woocommerce-error', '.woocommerce-message', '.woocommerce-info', '.wc-block-components-notice-banner'];
    var combinedSelector = baseSelectors.concat(['.wdp-form-error']).join(', ');
    var errorMessages = document.querySelectorAll(combinedSelector);

    if (errorMessages.length > 0) {
        errorMessages.forEach(function(errorMsg) {
            if (!errorMsg || errorMsg.closest('[data-wdp-alert="true"]')) {
                return;
            }

            if (errorMsg.dataset && errorMsg.dataset.wdpProtected === 'true') {
                return;
            }

            if (errorMsg.classList.contains('woocommerce-error') || 
                errorMsg.classList.contains('woocommerce-message') ||
                errorMsg.classList.contains('woocommerce-info') ||
                errorMsg.classList.contains('wc-block-components-notice-banner')) {
                errorMsg.style.display = 'none';
            }

            if (errorMsg.classList.contains('wdp-form-error')) {
                errorMsg.style.display = 'none';
                errorMsg.textContent = '';
            }
        });
    }

    function checkAndHideErrors() {
        var allErrors = document.querySelectorAll(baseSelectors.join(', '));
        allErrors.forEach(function(error) {
            if (!error || error.closest('[data-wdp-alert="true"]')) {
                return;
            }

            if (window.getComputedStyle(error).display !== 'none') {
                error.style.display = 'none';
            }
        });
    }

    checkAndHideErrors();

    setTimeout(checkAndHideErrors, 50);
    setTimeout(checkAndHideErrors, 100);
    setTimeout(checkAndHideErrors, 300);
    setTimeout(checkAndHideErrors, 500);
};

// Sayfa yüklendiğinde ve form gönderildiğinde hata mesajlarını gizle
document.addEventListener('DOMContentLoaded', function() {
    // Sayfa yüklendiğinde hata mesajlarını gizle
    window.WDP.hideErrorMessages();
    
    // Form gönderimlerini izle
    document.addEventListener('submit', function(e) {
        // Eğer form bir bağış formu ise
        if (e.target.classList.contains('wdp-direct-form') || 
            e.target.closest('.wdp-modal') !== null) {
            // Hata mesajlarını hemen gizle
            window.WDP.hideErrorMessages();
            
            // Form gönderilmeden önce WooCommerce mesajlarını gizle
            var wooMessages = document.querySelectorAll('.woocommerce-error, .woocommerce-message, .woocommerce-info');
            wooMessages.forEach(function(msg) {
                msg.style.display = 'none';
            });
            
            // Farklı zamanlarda tekrar kontrol et
            setTimeout(window.WDP.hideErrorMessages, 10);
            setTimeout(window.WDP.hideErrorMessages, 100);
            setTimeout(window.WDP.hideErrorMessages, 500);
            setTimeout(window.WDP.hideErrorMessages, 1000);
            setTimeout(window.WDP.hideErrorMessages, 2000);
        }
    });
    
    // AJAX tamamlandığında da kontrol et
    if (typeof jQuery !== 'undefined') {
        jQuery(document).ajaxComplete(function() {
            window.WDP.hideErrorMessages();
        });
        
        // AJAX başladığında da kontrol et
        jQuery(document).ajaxSend(function() {
            window.WDP.hideErrorMessages();
        });
    }
    
    // MutationObserver kullanarak DOM değişikliklerini izle
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                // Yeni eklenen elementler arasında hata mesajı olabilir
                window.WDP.hideErrorMessages();
            }
        });
    });
    
    // Tüm body'yi izle
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});
   </script>
   <?php
}

// AJAX endpoint ekle
add_action('wp_ajax_wdp_render_donation_button', 'wdp_ajax_render_donation_button');
add_action('wp_ajax_nopriv_wdp_render_donation_button', 'wdp_ajax_render_donation_button');

function wdp_ajax_render_donation_button() {
   check_ajax_referer('wdp_render_donation_button', 'security');
   
   $product_id = isset($_POST['product_id']) ? absint($_POST['product_id']) : 0;
   $button_text = isset($_POST['button_text']) ? sanitize_text_field($_POST['button_text']) : 'Bağış Yap';
   
   if (!$product_id) {
       wp_send_json(array(
           'success' => false,
           'message' => 'Geçersiz ürün ID'
       ));
       wp_die();
   }
   
   $html = wdp_render_donation_button($product_id, $button_text);
   
   wp_send_json(array(
       'success' => true,
       'html' => $html
   ));
   
   wp_die();
}

// Debug log fonksiyonu ekle
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

<?php
/**
* WooCommerce Donation Modal Popup main class
*/
class Woo_Donation_Popup {
 
 /**
  * Debug logging enabled flag.
  *
  * @var bool
  */
 private $debug_enabled = false;
 
 /**
  * Eklenti etkinleştirildiğinde çalışacak fonksiyon
  */
 public static function activate() {
     // Transient oluştur, bu sayede eklenti etkinleştirildiğinde bir kerelik çalışacak
     set_transient('wdp_flush_rewrite', true, 30);
     
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
     $this->debug_enabled = (bool) (defined('WP_DEBUG') && WP_DEBUG);
     // Kullanılacak stil ve script dosyalarını sıraya al
     add_action('wp_enqueue_scripts', array($this, 'enqueue_assets'));
     
     // Sepete ürün eklenirken özel bağış verilerini alma
     add_filter('woocommerce_add_cart_item_data', array($this, 'add_donation_item_data'), 10, 3);
     
     // Sepete ekleme öncesi doğrulama (zorunlu alanlar kontrolü)
     add_filter('woocommerce_add_to_cart_validation', array($this, 'validate_donation_fields'), 10, 5);
     
     // Sipariş oluşturulurken, bağış verilerini sipariş öğe metalarına ekle
     add_action('woocommerce_checkout_create_order_line_item', array($this, 'add_donation_meta_to_order'), 10, 4);
     
     // Sepet sayısını almak için AJAX endpoint ekle
     add_action('wp_ajax_wdp_get_cart_count', array($this, 'get_cart_count'));
     add_action('wp_ajax_nopriv_wdp_get_cart_count', array($this, 'get_cart_count'));
     
     // Sepet içeriğini almak için AJAX endpoint ekle
     add_action('wp_ajax_wdp_get_cart_contents', array($this, 'get_cart_contents'));
     add_action('wp_ajax_nopriv_wdp_get_cart_contents', array($this, 'get_cart_contents'));
     
     // AJAX ile sepete ekleme endpoint'i
     add_action('wp_ajax_wdp_ajax_add_to_cart', array($this, 'ajax_add_to_cart'));
     add_action('wp_ajax_nopriv_wdp_ajax_add_to_cart', array($this, 'ajax_add_to_cart'));

    // Ürün adını almak için endpoint
    add_action('wp_ajax_wdp_get_product_name', array($this, 'get_product_name'));
    add_action('wp_ajax_nopriv_wdp_get_product_name', array($this, 'get_product_name'));
     
     // Sepet sayfasında bağış bilgilerini göster
     add_filter('woocommerce_get_item_data', array($this, 'display_donation_data_in_cart'), 10, 2);
     
     // Ödeme sayfasında bağış bilgilerini göster
     // add_filter('woocommerce_checkout_cart_item_quantity', array($this, 'display_donation_data_in_checkout'), 10, 3);
     
     // Shortcode ekle
     add_shortcode('wdp_donation_button', array($this, 'donation_button_shortcode'));
     
     // Yeni shortcode ekle - doğrudan form için
     add_shortcode('wdp_donation_form', array($this, 'donation_form_shortcode'));
     
     // Ürün bilgilerini almak için AJAX endpoint ekle
     add_action('wp_ajax_wdp_get_product_info', array($this, 'get_product_info'));
     add_action('wp_ajax_nopriv_wdp_get_product_info', array($this, 'get_product_info'));
     
     // Özel fiyat uygulaması için gerekli hook'lar
     add_filter('woocommerce_before_calculate_totals', array($this, 'apply_custom_price_to_cart'), 99);
     add_filter('woocommerce_cart_item_price', array($this, 'custom_cart_item_price'), 10, 3);
     add_filter('woocommerce_cart_item_subtotal', array($this, 'custom_cart_item_subtotal'), 10, 3);

     // Ürün düzenleme sayfasına özel fiyat seçeneği ekle
     // Bu fonksiyonu kaldırıyoruz çünkü artık merkezi ayarlar sayfasından yönetilecek
     // Ancak geriye dönük uyumluluk için meta verileri okumaya devam edeceğiz
     // add_action('woocommerce_product_options_pricing', array($this, 'add_custom_price_option'));

     // Ürün verilerini kaydet
     // Bu fonksiyonu da kaldırıyoruz
     // add_action('woocommerce_process_product_meta', array($this, 'save_custom_price_option'));

     // Sepet sayfasında hisseli ürünlerin miktar kontrollerini devre dışı bırak
     add_filter('woocommerce_cart_item_quantity', array($this, 'disable_quantity_input_for_share_items'), 10, 3);

     // Sepet sayfasında hisseli ürünlerin miktarını güncelleme işlemini engelle
     add_filter('woocommerce_update_cart_validation', array($this, 'prevent_share_items_quantity_update'), 10, 4);
 }
 
 /**
  * Debug logger helper.
  *
  * @param mixed $message Message to log when debug mode is on.
  * @return void
  */
 private function log($message) {
     if (!$this->debug_enabled) {
         return;
     }

     if (function_exists('wdp_debug_log')) {
         wdp_debug_log($message);
         return;
     }

     if (is_array($message) || is_object($message)) {
         error_log(print_r($message, true));
         return;
     }

     error_log((string) $message);
 }

 /**
  * Send JSON error response and terminate execution.
  *
  * @param string $message
  * @param array  $extra
  * @return never
  */
 private function json_error($message, array $extra = array()) {
     wp_send_json(array_merge(
         array(
             'success' => false,
             'message' => $message,
         ),
         $extra
         ));
         wp_die();
     }
     
 /**
  * Send JSON success response and terminate execution.
  *
  * @param array $data
  * @return never
  */
 private function json_success(array $data = array()) {
     wp_send_json(array_merge(
         array(
             'success' => true,
         ),
         $data
         ));
         wp_die();
     }
     
 /**
  * Ürün bilgilerini almak için AJAX endpoint
  */
 public function get_product_info() {
     // Güvenlik kontrolü
     check_ajax_referer('wdp_ajax_nonce', 'security');
     
    $product_id = isset($_POST['product_id']) ? absint(wp_unslash($_POST['product_id'])) : 0;

    if (!$product_id) {
        $this->log('get_product_info: invalid product ID received.');
        $this->json_error(__('Geçersiz ürün ID', 'woo-donation-popup'));
    }

    $product = wc_get_product($product_id);

    if (!$product) {
        $this->log('get_product_info: product not found for ID ' . $product_id);
        $this->json_error(sprintf(__('Ürün bulunamadı. ID: %d', 'woo-donation-popup'), $product_id));
    }

    $allow_custom_price    = get_post_meta($product_id, '_allow_custom_price', true) === 'yes';
    $min_price             = get_post_meta($product_id, '_min_custom_price', true);
         $allow_multiple_shares = get_post_meta($product_id, '_allow_multiple_shares', true) === 'yes';
    $max_shares            = get_post_meta($product_id, '_max_shares', true);

    if ($allow_custom_price && '' === $min_price) {
        $min_price = '0';
    }

    if ($allow_multiple_shares && '' === $max_shares) {
             $max_shares = '7';
         }
         
         $response = array(
        'product_name'       => $product->get_name(),
        'is_custom_price'    => $allow_custom_price,
        'min_price'          => $min_price,
        'regular_price'      => $product->get_regular_price(),
        'price'              => $product->get_price(),
             'is_multiple_shares' => $allow_multiple_shares,
        'max_shares'         => $max_shares,
    );

    $this->log(array('event' => 'get_product_info', 'response' => $response));

    $this->json_success($response);
 }
 
 /**
  * Ürün adını almak için AJAX endpoint
  */
 public function get_product_name() {
     // Güvenlik kontrolü
     check_ajax_referer('wdp_ajax_nonce', 'security');
     
    $product_id = isset($_POST['product_id']) ? absint(wp_unslash($_POST['product_id'])) : 0;
     
     if (!$product_id) {
        $this->json_error(__('Geçersiz ürün ID', 'woo-donation-popup'));
     }
     
     $product = wc_get_product($product_id);
     
     if (!$product) {
        $this->json_error(__('Ürün bulunamadı', 'woo-donation-popup'));
    }

    $this->json_success(array(
        'product_name' => $product->get_name(),
    ));
 }
 
 
 /**
  * AJAX ile sepete ekleme işlemi
  */
public function ajax_add_to_cart() {
  if (!check_ajax_referer('wdp_ajax_nonce', 'security', false)) {
      $this->log('Security check failed for ajax_add_to_cart.');
      $this->json_error(__('Güvenlik doğrulaması başarısız oldu. Lütfen sayfayı yenileyip tekrar deneyin.', 'woo-donation-popup'));
  }

  $product_id            = isset($_POST['add-to-cart']) ? absint(wp_unslash($_POST['add-to-cart'])) : 0;
  $quantity              = isset($_POST['quantity']) ? wc_stock_amount(wp_unslash($_POST['quantity'])) : 1;
  $variation_id          = isset($_POST['variation_id']) ? absint(wp_unslash($_POST['variation_id'])) : 0;
  $custom_price_raw      = isset($_POST['custom_price']) ? wc_clean(wp_unslash($_POST['custom_price'])) : '';
  $unique_submission_key = isset($_POST['unique_submission_key']) ? sanitize_text_field(wp_unslash($_POST['unique_submission_key'])) : '';
  $timestamp             = isset($_POST['timestamp']) ? absint(wp_unslash($_POST['timestamp'])) : 0;
  $is_direct_share_form  = !empty($_POST['is_direct_share_form']) && '1' === wp_unslash($_POST['is_direct_share_form']);
  $custom_price_type     = isset($_POST['custom_price_type']) ? sanitize_text_field(wp_unslash($_POST['custom_price_type'])) : '';

  $this->log(array(
      'event'                  => 'ajax_add_to_cart_request',
      'product_id'             => $product_id,
      'quantity'               => $quantity,
      'custom_price'           => $custom_price_raw,
      'share_count'            => isset($_POST['share_count']) ? wp_unslash($_POST['share_count']) : null,
      'unique_submission_key'  => $unique_submission_key,
  ));

  if (!$product_id) {
      $this->json_error(__('Geçersiz ürün ID.', 'woo-donation-popup'));
  }

  if (!function_exists('WC') || !isset(WC()->cart)) {
      $this->log('WooCommerce cart object not available.');
      $this->json_error(__('WooCommerce sepet nesnesi bulunamadı.', 'woo-donation-popup'));
  }

  $product = wc_get_product($product_id);

  if (!$product) {
      $this->log('Product not found for ajax_add_to_cart: ' . $product_id);
      $this->json_error(__('Ürün bulunamadı. Lütfen ürün ID\'sini kontrol edin.', 'woo-donation-popup'));
  }

       $donation_data = array();
  $share_count   = isset($_POST['share_count']) ? absint(wp_unslash($_POST['share_count'])) : 0;
       
       if ($share_count > 0) {
           $donation_data['share_count'] = $share_count;
           
      $shareholders   = array();
           $missing_fields = array();
           
           for ($i = 1; $i <= $share_count; $i++) {
          $name  = isset($_POST['shareholder_name_' . $i]) ? sanitize_text_field(wp_unslash($_POST['shareholder_name_' . $i])) : '';
          $phone = isset($_POST['shareholder_phone_' . $i]) ? sanitize_text_field(wp_unslash($_POST['shareholder_phone_' . $i])) : '';
          $note  = isset($_POST['shareholder_note_' . $i]) ? sanitize_textarea_field(wp_unslash($_POST['shareholder_note_' . $i])) : '';

          if ('' === $name) {
              $missing_fields[] = sprintf(__('%d. Hissedar Adı', 'woo-donation-popup'), $i);
          }

          if ('' === $phone) {
              $missing_fields[] = sprintf(__('%d. Hissedar Telefonu', 'woo-donation-popup'), $i);
          }

               $shareholder = array();
               
          if ('' !== $name) {
              $shareholder['name'] = $name;
          }

          if ('' !== $phone) {
              $shareholder['phone'] = $phone;
          }

          if ('' !== $note) {
              $shareholder['note'] = $note;
               }
               
               if (!empty($shareholder)) {
                   $shareholders[$i] = $shareholder;
               }
           }

      if (!empty($missing_fields)) {
          $this->json_error(__('Lütfen tüm zorunlu alanları doldurun: ', 'woo-donation-popup') . implode(', ', $missing_fields));
           }
           
           if (!empty($shareholders)) {
               $donation_data['shareholders'] = $shareholders;
           }
           
      $quantity = max(1, $share_count);
       } else {
      $full_name = isset($_POST['donation_full_name']) ? sanitize_text_field(wp_unslash($_POST['donation_full_name'])) : '';
      $phone     = isset($_POST['donation_phone']) ? sanitize_text_field(wp_unslash($_POST['donation_phone'])) : '';
      $note      = isset($_POST['donation_note']) ? sanitize_textarea_field(wp_unslash($_POST['donation_note'])) : '';

      if ('' === $full_name) {
          $this->json_error(__('Lütfen Ad Soyad bilginizi giriniz.', 'woo-donation-popup'));
      }

      if ('' === $phone) {
          $this->json_error(__('Lütfen Telefon bilginizi giriniz.', 'woo-donation-popup'));
      }

      $donation_data['full_name'] = $full_name;
      $donation_data['phone']     = $phone;

      if ('' !== $note) {
          $donation_data['note'] = $note;
      }
  }

       $allow_custom_price = get_post_meta($product_id, '_allow_custom_price', true) === 'yes';
  $custom_price_value = null;

  if ($allow_custom_price) {
      if ($custom_price_raw === '') {
          $this->json_error(__('Lütfen bağış miktarını giriniz.', 'woo-donation-popup'));
      }

      $custom_price_value = (float) wc_format_decimal($custom_price_raw);
      $min_price          = get_post_meta($product_id, '_min_custom_price', true);

      if ($min_price !== '' && $custom_price_value < (float) $min_price) {
          $this->json_error(sprintf(__('Lütfen %s TL ve üstü değerler girin.', 'woo-donation-popup'), wc_format_decimal($min_price)));
      }
  }

  if ($unique_submission_key && $timestamp) {
      $current_time = time();

      if (($current_time - $timestamp) < 30) {
          foreach (WC()->cart->get_cart() as $cart_item) {
              if (isset($cart_item['unique_submission_key']) && $cart_item['unique_submission_key'] === $unique_submission_key) {
                  $this->json_success(array(
                      'message'      => __('Ürün zaten sepete eklenmiş', 'woo-donation-popup'),
                      'cart_count'   => (int) WC()->cart->get_cart_contents_count(),
                      'checkout_url' => wc_get_checkout_url(),
                      'items'        => $this->get_cart_items(),
                  ));
              }
          }
      }
  }

       foreach (WC()->cart->get_cart() as $cart_item_key => $cart_item) {
      if ((int) $cart_item['product_id'] === $product_id && isset($cart_item['donation_data']) && $this->is_same_donation_data($cart_item['donation_data'], $donation_data)) {
          WC()->cart->remove_cart_item($cart_item_key);
               break;
           }
       }
       
  $cart_item_data = array(
      'donation_data' => $donation_data,
      'unique_key'    => md5(serialize(array($product_id, microtime(true), wp_rand()))),
  );

  if ($unique_submission_key) {
      $cart_item_data['unique_submission_key'] = $unique_submission_key;
  }

  if ($allow_custom_price && null !== $custom_price_value) {
      $cart_item_data['custom_price'] = $custom_price_value;
  }

  if ($is_direct_share_form) {
      $cart_item_data['is_direct_share_form'] = true;

      if ('' !== $custom_price_type) {
          $cart_item_data['custom_price_type'] = $custom_price_type;
      }
  }

  $cart_item_key = WC()->cart->add_to_cart($product_id, $quantity, $variation_id, array(), $cart_item_data);

  if (!$cart_item_key) {
      $this->log('Failed to add product to cart: ' . $product_id);
      $this->json_error(__('Ürün sepete eklenirken bir hata oluştu.', 'woo-donation-popup'));
  }

  $this->json_success(array(
      'message'       => __('Ürün sepete eklendi.', 'woo-donation-popup'),
               'cart_item_key' => $cart_item_key,
      'cart_count'    => (int) WC()->cart->get_cart_contents_count(),
      'checkout_url'  => wc_get_checkout_url(),
      'items'         => $this->get_cart_items(),
  ));
}

 /**
  * İki bağış verisinin aynı olup olmadığını kontrol et
  */
 private function is_same_donation_data($data1, $data2) {
     // Eğer her iki veri de boşsa, aynı kabul et
     if (empty($data1) && empty($data2)) {
         return true;
     }
     
     // Eğer birisi boş diğeri doluysa, farklı kabul et
     if (empty($data1) || empty($data2)) {
         return false;
     }
     
     // Hisse sayısı kontrolü
     if (isset($data1['share_count']) && isset($data2['share_count'])) {
         if ($data1['share_count'] !== $data2['share_count']) {
             return false;
         }
         
         // Hissedar bilgilerini karşılaştır
         if (isset($data1['shareholders']) && isset($data2['shareholders'])) {
             if (count($data1['shareholders']) !== count($data2['shareholders'])) {
                 return false;
             }
             
             foreach ($data1['shareholders'] as $key => $shareholder1) {
                 if (!isset($data2['shareholders'][$key])) {
                     return false;
                 }
                 
                 $shareholder2 = $data2['shareholders'][$key];
                 
                 if ($shareholder1['name'] !== $shareholder2['name'] || 
                     $shareholder1['phone'] !== $shareholder2['phone']) {
                     return false;
                 }
                 
                 // Not alanı opsiyonel
                 if (isset($shareholder1['note']) && isset($shareholder2['note']) && 
                     $shareholder1['note'] !== $shareholder2['note']) {
                     return false;
                 }
             }
             
             return true;
         }
     } else {
         // Normal bağış verilerini karşılaştır
         $same_name = isset($data1['full_name']) && isset($data2['full_name']) && 
                      $data1['full_name'] === $data2['full_name'];
                      
         $same_phone = isset($data1['phone']) && isset($data2['phone']) && 
                       $data1['phone'] === $data2['phone'];
         
         // Not alanı opsiyonel olduğu için, sadece her ikisi de varsa karşılaştır
         $same_note = true;
         if (isset($data1['note']) && isset($data2['note'])) {
             $same_note = $data1['note'] === $data2['note'];
         }
         
         return $same_name && $same_phone && $same_note;
     }
     
     return false;
 }
 
 /**
  * Sepet sayısını döndüren AJAX fonksiyonu
  */
 public function get_cart_count() {
     // Güvenlik kontrolü
     check_ajax_referer('wdp_ajax_nonce', 'security');
     
    if (!function_exists('WC') || !isset(WC()->cart)) {
        $this->json_error(__('WooCommerce cart not available', 'woo-donation-popup'));
    }

    $this->json_success(array(
        'count' => (int) WC()->cart->get_cart_contents_count(),
    ));
 }
 
 /**
  * Sepet içeriğini döndüren AJAX fonksiyonu
  */
 public function get_cart_contents() {
     // Güvenlik kontrolü
     check_ajax_referer('wdp_ajax_nonce', 'security');
     
    if (!function_exists('WC') || !isset(WC()->cart)) {
        $this->json_error(__('WooCommerce cart not available', 'woo-donation-popup'));
    }

    $this->json_success(array(
        'items' => $this->get_cart_items(),
    ));
 }
 
 /**
  * Eklenti CSS ve JS dosyalarını kaydet ve yükle.
  */
 public function enqueue_assets() {
    // Conditional enqueue: Sadece shortcode veya modal trigger varsa yükle
    global $post;
    $should_enqueue = false;
    
    // Shortcode kontrolü
    if (is_a($post, 'WP_Post')) {
        if (has_shortcode($post->post_content, 'wdp_donation_button') || 
            has_shortcode($post->post_content, 'wdp_donation_form')) {
            $should_enqueue = true;
        }
    }
    
    // WooCommerce ürün sayfalarında yükle
    if (!$should_enqueue && function_exists('is_product') && is_product()) {
        $should_enqueue = true;
    }
    
    // Eğer hiçbir koşul sağlanmazsa, yine de yükle (geriye dönük uyumluluk için)
    // Ama gelecekte bu kısım kaldırılabilir
    if (!$should_enqueue) {
        $should_enqueue = true; // Geçici olarak her zaman yükle
    }
    
    if (!$should_enqueue) {
        return;
    }
    
    // Asset base path/url (constants fallback)
    $plugin_dir = defined('WDP_PLUGIN_PATH') ? WDP_PLUGIN_PATH : plugin_dir_path(dirname(__FILE__));
    $plugin_url = defined('WDP_PLUGIN_URL') ? WDP_PLUGIN_URL : plugin_dir_url(dirname(__FILE__));

    // Asset versioning: filemtime kullan (cache busting için)
    $js_file = $plugin_dir . 'assets/js/donation-modal.js';
    $css_file = $plugin_dir . 'assets/css/donation-modal.css';
    
    $js_version = file_exists($js_file) ? filemtime($js_file) : WDP_ASSET_VERSION;
    $css_version = file_exists($css_file) ? filemtime($css_file) : WDP_ASSET_VERSION;
    
    // Debug modunda her zaman yeni versiyon
    if (defined('SCRIPT_DEBUG') && SCRIPT_DEBUG) {
        $js_version = time();
        $css_version = time();
    }
    
     wp_deregister_script('wdp-donation-modal-js');
     wp_deregister_style('wdp-donation-modal-css');
    
     // Sadece ana JS ve CSS dosyalarını yükle
     $dependencies = array();
     if (!wp_script_is('jquery', 'enqueued')) {
         wp_enqueue_script('jquery');
     }
     $dependencies[] = 'jquery';
     if (wp_script_is('wc-add-to-cart', 'enqueued')) {
         $dependencies[] = 'wc-add-to-cart';
     }
     wp_enqueue_script(
         'wdp-donation-modal-js', 
        $plugin_url . 'assets/js/donation-modal.js', 
         $dependencies, 
        $js_version, 
         true
     );
     wp_localize_script('wdp-donation-modal-js', 'wdp_ajax', array(
         'ajax_url' => admin_url('admin-ajax.php'),
         'nonce' => wp_create_nonce('wdp_ajax_nonce'),
         'checkout_url' => wc_get_checkout_url(),
         'cart_url' => wc_get_cart_url(),
         'version' => WDP_VERSION,
         'debug' => defined('WP_DEBUG') && WP_DEBUG,
         'jquery_loaded' => wp_script_is('jquery', 'enqueued'),
         'wc_loaded' => class_exists('WooCommerce'),
         'home_url' => home_url(),
         'site_url' => site_url(),
         'ajax_nonce' => wp_create_nonce('wdp_ajax_nonce'),
         'strings' => array(
             'loading' => __('Yükleniyor...', 'woo-donation-popup'),
             'error' => __('Bir hata oluştu', 'woo-donation-popup'),
             'success' => __('Başarılı', 'woo-donation-popup'),
             'required_field' => __('Bu alan zorunludur', 'woo-donation-popup'),
             'invalid_price' => __('Geçersiz fiyat', 'woo-donation-popup'),
             'min_price_error' => __('Minimum fiyat: ', 'woo-donation-popup'),
             'max_shares_error' => __('Maksimum hisse sayısı: ', 'woo-donation-popup')
         )
     ));
     wp_enqueue_style(
         'wdp-donation-modal-css', 
         $plugin_url . 'assets/css/donation-modal.css', 
         array(), 
         $css_version
     );
     // Temaya özel CSS/JS yükleme ve theme_slug, theme_name gibi değişkenler kaldırıldı
     $inline_css = "
     .wdp-modal { z-index: 999999 !important; }
     .wdp-modal-content { z-index: 1000000 !important; }
     .wdp-modal-close { z-index: 1000001 !important; }
     .wdp-modal * { box-sizing: border-box !important; }
     .wdp-modal-content * { box-sizing: border-box !important; }
     .wdp-donation-form * { box-sizing: border-box !important; }
     @media (max-width: 768px) {
         .wdp-modal-content { width: 95% !important; max-width: 95% !important; margin: 10px auto !important; }
     }
     ";
     wp_add_inline_style('wdp-donation-modal-css', $inline_css);
 }
 
 /**
  * Bağış formu verilerini, ürün sepete eklenirken cart item data'ya ekle.
  */
 public function add_donation_item_data($cart_item_data, $product_id, $variation_id) {
   // Sadece bağış formundan gelen istekleri işleme al
   if (isset($_POST['donation_modal']) && $_POST['donation_modal'] == '1') {
       $donation_data = array();
       
       // Çoklu hisse kontrolü
       $share_count = isset($_POST['share_count']) ? absint($_POST['share_count']) : 0;
       
       if ($share_count > 0) {
           $donation_data['share_count'] = $share_count;
           
           // Hissedar bilgilerini al
           $shareholders = array();
           
           for ($i = 1; $i <= $share_count; $i++) {
               $shareholder = array();
               
               if (isset($_POST['shareholder_name_' . $i])) {
                   $shareholder['name'] = sanitize_text_field($_POST['shareholder_name_' . $i]);
               }
               
               if (isset($_POST['shareholder_phone_' . $i])) {
                   $shareholder['phone'] = sanitize_text_field($_POST['shareholder_phone_' . $i]);
               }
               
               if (isset($_POST['shareholder_note_' . $i])) {
                   $shareholder['note'] = sanitize_textarea_field($_POST['shareholder_note_' . $i]);
               }
               
               if (!empty($shareholder)) {
                   $shareholders[$i] = $shareholder;
               }
           }
           
           if (!empty($shareholders)) {
               $donation_data['shareholders'] = $shareholders;
           }

           // Hisse adedini ayrı bir alanda sakla, quantity'yi değiştirme
           if ($share_count > 0) {
              $cart_item_data['share_count_hidden'] = $share_count;
           }
       } else {
           // Normal bağış verilerini al
           if (!empty($_POST['donation_full_name'])) {
               $donation_data['full_name'] = sanitize_text_field($_POST['donation_full_name']);
           }
           
           if (!empty($_POST['donation_phone'])) {
               $donation_data['phone'] = sanitize_text_field($_POST['donation_phone']);
           }
           
           if (isset($_POST['donation_note'])) {
               // Not alanı boş olabilir, bu yüzden sadece sanitize edelim
               $donation_data['note'] = sanitize_textarea_field($_POST['donation_note']);
           }
       }
       
       if (!empty($donation_data)) {
           // Bu verileri sepette ürünün yanına ekle
           $cart_item_data['donation_data'] = $donation_data;
           
           // Benzersiz gönderim anahtarını ekle (eğer varsa)
           if (isset($_POST['unique_submission_key']) && !empty($_POST['unique_submission_key'])) {
               $cart_item_data['unique_submission_key'] = sanitize_text_field($_POST['unique_submission_key']);
           }
           
           // Her sepete ekleme işlemine özgü benzersiz bir anahtar oluştur (tekrarlı eklemelerde birleştirilmesin)
           // Daha karmaşık ve benzersiz bir anahtar oluştur - form verilerini de dahil et
           $unique_data = [
               'time' => microtime(),
               'rand' => rand(),
               'product_id' => $product_id,
               'ip' => isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '',
               'form_data' => $donation_data, // Form verilerini de dahil et
               'custom_price' => isset($_POST['custom_price']) ? $_POST['custom_price'] : '' // Fiyat bilgisini de dahil et
           ];
           
           // Benzersiz anahtarı oluştur
           $cart_item_data['unique_key'] = md5(serialize($unique_data));
       }

       // Özel fiyat değerini ekle
       if (isset($_POST['custom_price']) && !empty($_POST['custom_price'])) {
           $cart_item_data['custom_price'] = floatval($_POST['custom_price']);
       }
   }
   
   return $cart_item_data;
}

/**
 * Sepete ekleme öncesi doğrulama
 */
public function validate_donation_fields($passed, $product_id, $quantity, $variation_id = '', $variations = array()) {
    // Sadece bağış formundan gelen istekleri işleme al
    if (isset($_POST['donation_modal']) && $_POST['donation_modal'] == '1') {
        // Çoklu hisse kontrolü
        $share_count = isset($_POST['share_count']) ? absint($_POST['share_count']) : 0;
        
        if ($share_count > 0) {
            // Hissedar bilgilerini kontrol et
            $valid = true;
            $missing_fields = array();
            
            for ($i = 1; $i <= $share_count; $i++) {
                // Ad kontrolü
                if (!isset($_POST['shareholder_name_' . $i]) || empty($_POST['shareholder_name_' . $i])) {
                    $valid = false;
                    $missing_fields[] = $i . '. Hissedar Adı';
                }
                
                // Telefon kontrolü
                if (!isset($_POST['shareholder_phone_' . $i]) || empty($_POST['shareholder_phone_' . $i])) {
                    $valid = false;
                    $missing_fields[] = $i . '. Hissedar Telefonu';
                }
            }
            
            if (!$valid) {
                wc_add_notice(__('Lütfen tüm zorunlu alanları doldurun: ', 'woo-donation-popup') . implode(', ', $missing_fields), 'error');
                return false;
            }
        } else {
            // Normal bağış verilerini kontrol et
            if (!isset($_POST['donation_full_name']) || empty($_POST['donation_full_name'])) {
                wc_add_notice(__('Lütfen Ad Soyad bilginizi giriniz.', 'woo-donation-popup'), 'error');
                return false;
            }
            
            if (!isset($_POST['donation_phone']) || empty($_POST['donation_phone'])) {
                wc_add_notice(__('Lütfen Telefon bilginizi giriniz.', 'woo-donation-popup'), 'error');
                return false;
            }
        }
        
        // Özel fiyat kontrolü
        $allow_custom_price = get_post_meta($product_id, '_allow_custom_price', true) === 'yes';
        
        if ($allow_custom_price) {
            if (!isset($_POST['custom_price']) || empty($_POST['custom_price'])) {
                wc_add_notice(__('Lütfen bağış miktarını giriniz.', 'woo-donation-popup'), 'error');
                return false;
            }
            
            // Minimum fiyat kontrolü
            $min_price = get_post_meta($product_id, '_min_custom_price', true);
            if ($min_price !== '' && floatval($_POST['custom_price']) < floatval($min_price)) {
                wc_add_notice(sprintf(__('Lütfen %s TL ve üstü değerler girin.', 'woo-donation-popup'), wc_format_decimal($min_price)), 'error');
                return false;
            }
        }
    }
    
    return $passed;
}

/**
 * Sipariş oluşturulurken, bağış verilerini sipariş öğe metalarına ekle
 */
public function add_donation_meta_to_order($item, $cart_item_key, $values, $order) {
    if (isset($values['donation_data'])) {
        $donation_data = $values['donation_data'];
        
        // Çoklu hisse kontrolü
        if (isset($donation_data['share_count']) && $donation_data['share_count'] > 0) {
            $item->add_meta_data(__('Hisse Sayısı', 'woo-donation-popup'), $donation_data['share_count']);
            
            // Hissedar bilgilerini ekle
            if (isset($donation_data['shareholders'])) {
                foreach ($donation_data['shareholders'] as $key => $shareholder) {
                    if (!empty($shareholder['name'])) {
                        $item->add_meta_data(sprintf(__('%d. Hissedar Adı', 'woo-donation-popup'), $key), $shareholder['name']);
                    }
                    
                    if (!empty($shareholder['phone'])) {
                        $item->add_meta_data(sprintf(__('%d. Hissedar Telefonu', 'woo-donation-popup'), $key), $shareholder['phone']);
                    }
                    
                    if (isset($shareholder['note']) && $shareholder['note'] !== '') {
                        $item->add_meta_data(sprintf(__('%d. Hissedar Notu', 'woo-donation-popup'), $key), $shareholder['note']);
                    }
                }
            }
        } else {
            // Normal bağış verilerini ekle
            if (!empty($donation_data['full_name'])) {
                $item->add_meta_data(__('Bağışçı Adı', 'woo-donation-popup'), $donation_data['full_name']);
            }
            
            if (!empty($donation_data['phone'])) {
                $item->add_meta_data(__('Bağışçı Telefonu', 'woo-donation-popup'), $donation_data['phone']);
            }
            
            if (isset($donation_data['note']) && $donation_data['note'] !== '') {
                $item->add_meta_data(__('Bağış Notu', 'woo-donation-popup'), $donation_data['note']);
            }
        }
    }
}

/**
 * Sepet sayfasında bağış bilgilerini göster
 */
public function display_donation_data_in_cart($item_data, $cart_item) {
    if (isset($cart_item['donation_data'])) {
        $donation_data = $cart_item['donation_data'];
        
        // Çoklu hisse kontrolü
        if (isset($donation_data['share_count']) && $donation_data['share_count'] > 0) {
            $item_data[] = array(
                'key' => __('Hisse Sayısı', 'woo-donation-popup'),
                'value' => $donation_data['share_count']
            );
            
            // Hissedar bilgilerini ekle
            if (isset($donation_data['shareholders'])) {
                foreach ($donation_data['shareholders'] as $key => $shareholder) {
                    if (!empty($shareholder['name'])) {
                        $item_data[] = array(
                            'key' => sprintf(__('%d. Hissedar', 'woo-donation-popup'), $key),
                            'value' => $shareholder['name'] . (isset($shareholder['phone']) ? ' - ' . $shareholder['phone'] : '')
                        );
                    }
                }
            }
        } else {
            // Normal bağış verilerini ekle
            if (!empty($donation_data['full_name'])) {
                $item_data[] = array(
                    'key' => __('Bağışçı Adı', 'woo-donation-popup'),
                    'value' => $donation_data['full_name']
                );
            }
            
            if (!empty($donation_data['phone'])) {
                $item_data[] = array(
                    'key' => __('Bağışçı Telefonu', 'woo-donation-popup'),
                    'value' => $donation_data['phone']
                );
            }
            
            if (isset($donation_data['note']) && $donation_data['note'] !== '') {
                $item_data[] = array(
                    'key' => __('Bağış Notu', 'woo-donation-popup'),
                    'value' => $donation_data['note']
                );
            }
        }
    }
    
    return $item_data;
}

/**
 * Özel fiyatı sepet öğesine uygula
 */
public function apply_custom_price_to_cart($cart) {
    if (is_admin() && !defined('DOING_AJAX')) {
        return;
    }
    
    if (did_action('woocommerce_before_calculate_totals') >= 2) {
        return;
    }
    
    foreach ($cart->get_cart() as $cart_item_key => $cart_item) {
        if (isset($cart_item['custom_price'])) {
            // Hem popup hem doğrudan form için aynı mantık - birim fiyat kullan
            $cart_item['data']->set_price((float) $cart_item['custom_price']);
            
            $this->log('Setting custom price in cart to ' . $cart_item['custom_price']);
        }
    }
}

/**
 * Özel fiyatı sepet sayfasında göster
 */
public function custom_cart_item_price($price, $cart_item, $cart_item_key) {
    if (isset($cart_item['custom_price'])) {
        $price = wc_price($cart_item['custom_price']);
    }
    
    return $price;
}

/**
 * Özel fiyatı sepet sayfasında ara toplam olarak göster
 */
public function custom_cart_item_subtotal($subtotal, $cart_item, $cart_item_key) {
    if (isset($cart_item['custom_price'])) {
        $subtotal = wc_price($cart_item['custom_price'] * $cart_item['quantity']);
    }
    
    return $subtotal;
}

/**
 * Sepet sayfasında hisseli ürünlerin miktar kontrollerini devre dışı bırak
 */
public function disable_quantity_input_for_share_items($product_quantity, $cart_item_key, $cart_item) {
    if (isset($cart_item['donation_data']) && isset($cart_item['donation_data']['share_count'])) {
        $quantity = $cart_item['quantity'];
        $product_quantity = sprintf('<span class="quantity">%s</span>', $quantity);
    }
    
    return $product_quantity;
}

/**
 * Sepet sayfasında hisseli ürünlerin miktarını güncelleme işlemini engelle
 */
public function prevent_share_items_quantity_update($valid, $cart_item_key, $values, $quantity) {
    if (isset($values['donation_data']) && isset($values['donation_data']['share_count'])) {
        // Hisseli ürünlerin miktarını değiştirmeye çalışıyorsa engelle
        if ($values['quantity'] != $quantity) {
            wc_add_notice(__('Hisseli bağış ürünlerinin miktarı değiştirilemez. Lütfen ürünü sepetten çıkarıp tekrar ekleyin.', 'woo-donation-popup'), 'error');
            return false;
        }
    }
    
    return $valid;
}

 /**
  * WooCommerce sepetindeki ürünleri standart bir veri yapısında döndür.
  *
  * @return array
  */
 private function get_cart_items() {
     $cart_items = array();

     if (!function_exists('WC') || !isset(WC()->cart)) {
         return $cart_items;
     }

     foreach (WC()->cart->get_cart() as $cart_item_key => $cart_item) {
         if (!isset($cart_item['data']) || ! $cart_item['data'] instanceof WC_Product) {
             continue;
         }

         $product = $cart_item['data'];
         $meta_data = array();

         if (isset($cart_item['donation_data'])) {
             $donation_data = $cart_item['donation_data'];

             if (!empty($donation_data['share_count'])) {
                 $meta_data[] = array(
                     'key' => __('Hisse Sayısı', 'woo-donation-popup'),
                     'value' => (int) $donation_data['share_count'],
                 );

                 if (!empty($donation_data['shareholders'])) {
                     foreach ($donation_data['shareholders'] as $index => $shareholder) {
                         if (!empty($shareholder['name'])) {
                             $meta_data[] = array(
                                 'key'   => sprintf(__('%d. Hissedar Adı', 'woo-donation-popup'), $index),
                                 'value' => $shareholder['name'],
                             );
                         }

                         if (!empty($shareholder['phone'])) {
                             $meta_data[] = array(
                                 'key'   => sprintf(__('%d. Hissedar Telefonu', 'woo-donation-popup'), $index),
                                 'value' => $shareholder['phone'],
                             );
                         }

                         if (isset($shareholder['note']) && $shareholder['note'] !== '') {
                             $meta_data[] = array(
                                 'key'   => sprintf(__('%d. Hissedar Notu', 'woo-donation-popup'), $index),
                                 'value' => $shareholder['note'],
                             );
                         }
                     }
                 }
             } else {
                 if (!empty($donation_data['full_name'])) {
                     $meta_data[] = array(
                         'key'   => __('Bağışçı Adı', 'woo-donation-popup'),
                         'value' => $donation_data['full_name'],
                     );
                 }

                 if (!empty($donation_data['phone'])) {
                     $meta_data[] = array(
                         'key'   => __('Bağışçı Telefonu', 'woo-donation-popup'),
                         'value' => $donation_data['phone'],
                     );
                 }

                 if (isset($donation_data['note']) && $donation_data['note'] !== '') {
                     $meta_data[] = array(
                         'key'   => __('Bağış Notu', 'woo-donation-popup'),
                         'value' => $donation_data['note'],
                     );
                 }
             }
         }

         $price = isset($cart_item['custom_price'])
             ? (float) $cart_item['custom_price']
             : (float) $product->get_price();

         $cart_items[] = array(
             'key'        => $cart_item_key,
             'product_id' => (int) $cart_item['product_id'],
             'name'       => $product->get_name(),
             'price'      => $price,
             'quantity'   => (int) $cart_item['quantity'],
             'meta'       => $meta_data,
         );
     }

     return $cart_items;
}

/**
 * Bağış butonu shortcode'u
 * 
 * @param array $atts Shortcode parametreleri
 * @return string Bağış butonu HTML'i
 */
public function donation_button_shortcode($atts) {
    // Shortcode parametrelerini al ve güvenli hale getir
    $atts = shortcode_atts(array(
        'id' => 0,
        'text' => __('Bağış Yap', 'woo-donation-popup'),
        'class' => '',
        'style' => ''
    ), $atts, 'wdp_donation_button');
    
    // Ürün ID'sini integer'a çevir ve güvenlik kontrolü yap
    $product_id = absint($atts['id']);
    
    // Buton metni
    $button_text = sanitize_text_field($atts['text']);
    
    // Özel sınıf ve stil
    $custom_class = sanitize_html_class($atts['class']);
    $custom_style = sanitize_text_field($atts['style']);
    
    // Ürünün varlığını kontrol et
    $product = wc_get_product($product_id);
    if (!$product) {
        if (current_user_can('manage_options')) {
            return '<p style="color:red;">Ürün bulunamadı (ID: ' . esc_html($product_id) . '). Lütfen ürün ID\'sini kontrol edin.</p>';
        }
        return '';
    }
    
    // Ürünün satın alınabilir olup olmadığını kontrol et
    if (!$product->is_purchasable()) {
        if (current_user_can('manage_options')) {
            return '<p style="color:red;">Bu ürün satın alınamaz (ID: ' . esc_html($product_id) . ').</p>';
        }
        return '';
    }
    
    // Ürünün stok durumunu kontrol et
    if (!$product->is_in_stock()) {
        if (current_user_can('manage_options')) {
            return '<p style="color:red;">Bu ürün stokta yok (ID: ' . esc_html($product_id) . ').</p>';
        }
        return '';
    }
    
    // Sadece buton oluştur, modal ayrı oluşturulacak
    ob_start();
    ?>
    <!-- Bağış Butonu -->
    <button type="button" class="wdp-donate-button wdp-open-modal <?php echo esc_attr($custom_class); ?>" 
            data-product-id="<?php echo esc_attr($product_id); ?>" 
            style="<?php echo esc_attr($custom_style); ?>">
        <?php echo esc_html($button_text); ?>
    </button>
    
    <!-- Modal - Ayrı oluşturuluyor -->
    <?php echo $this->render_donation_modal($product_id, $button_text, $custom_class, $custom_style); ?>
    <?php
    return ob_get_clean();
}

/**
 * Bağış formu shortcode'u - popup olmadan doğrudan form gösterir
 * 
 * @param array $atts Shortcode parametreleri
 * @return string Bağış formu HTML'i
 */
public function donation_form_shortcode($atts) {
    // Shortcode parametrelerini al
    $atts = shortcode_atts(array(
        'id' => 0,
        'button_text' => __('Bağış Yap', 'woo-donation-popup'),
        'title' => '', // Özel başlık
        'show_title' => 'yes', // Başlığı göster/gizle
        'class' => '' // Özel CSS sınıfı
    ), $atts, 'wdp_donation_form');
    
    // Ürün ID'sini integer'a çevir
    $product_id = intval($atts['id']);
    
    // Buton metni
    $button_text = sanitize_text_field($atts['button_text']);
    
    // Özel sınıf
    $custom_class = sanitize_text_field($atts['class']);
    
    // Ürünün varlığını kontrol et
    $product = wc_get_product($product_id);
    if (!$product) {
        if (current_user_can('manage_options')) {
            return '<p style="color:red;">Ürün bulunamadı (ID: ' . esc_html($product_id) . '). Lütfen ürün ID\'sini kontrol edin.</p>';
        }
        return '';
    }
    
    // Ürün adını al
    $product_name = $product->get_name();
    
    // Özel başlık varsa onu kullan
    $title = !empty($atts['title']) ? sanitize_text_field($atts['title']) : $product_name;
    $show_title = ($atts['show_title'] === 'yes');
    
    // Benzersiz bir ID oluştur - popup ile aynı format
    $form_id = 'wdp-modal-' . $product_id . '-direct';

    // Özel fiyat seçeneğinin aktif olup olmadığını kontrol et
    $allow_custom_price = get_post_meta($product_id, '_allow_custom_price', true) === 'yes';
    $min_price = get_post_meta($product_id, '_min_custom_price', true);
    
    // Eğer minimum fiyat yoksa ve özel fiyat aktifse, varsayılan olarak 0 kullan
    if ($allow_custom_price && $min_price === '') {
        $min_price = '0';
    }
    
    // Çoklu hisse seçeneğinin aktif olup olmadığını kontrol et
    $allow_multiple_shares = get_post_meta($product_id, '_allow_multiple_shares', true) === 'yes';
    $max_shares = get_post_meta($product_id, '_max_shares', true);
    
    // Eğer maksimum hisse sayısı yoksa ve çoklu hisse aktifse, varsayılan olarak 7 kullan
    if ($allow_multiple_shares && $max_shares === '') {
        $max_shares = '7';
    }
    
    // Form HTML'ini oluştur - popup ile aynı yapıyı kullan
    ob_start();
    ?>
    <div id="<?php echo esc_attr($form_id); ?>" class="wdp-donation-form <?php echo esc_attr($custom_class); ?>" data-product-id="<?php echo esc_attr($product_id); ?>">
        <div class="wdp-modal-content">
            <?php if ($show_title): ?>
            <h2 class="wdp-form-title"><?php echo esc_html($title); ?></h2>
            <?php endif; ?>
            
            <form method="post" action="">
                <div class="wdp-form-error" style="display: none;"></div>
                
                <?php if ($allow_multiple_shares): ?>
                <!-- Çoklu Hisse Alanı -->
                <div class="wdp-shares-section">
                    <div class="wdp-shares-header">
                        <label>Hisse Adedi:</label>
                        <div class="wdp-share-counter">
                            <button type="button" class="wdp-share-btn decrease"><span>-</span></button>
                            <input type="number" name="share_count" value="1" min="1" max="<?php echo esc_attr($max_shares); ?>" readonly>
                            <button type="button" class="wdp-share-btn increase"><span>+</span></button>
                        </div>
                    </div>
                    <div class="wdp-shareholders-container">
                        <!-- Hissedar formları JavaScript ile eklenecek -->
                    </div>
                </div>
                <?php else: ?>
                <!-- Bağışçı Bilgileri -->
                <input type="text" name="donation_full_name" placeholder="Ad Soyad *" required autocomplete="name">
                <input type="tel" name="donation_phone" placeholder="Telefon Numarası *" required autocomplete="tel">
                <textarea name="donation_note" rows="2" placeholder="Not (isteğe bağlı)"></textarea>
                <?php endif; ?>

                <!-- Fiyat ve Adet Alanları -->
                <div class="wdp-price-quantity-row">
                    <?php if ($allow_custom_price): ?>
                    <input type="number" name="custom_price" placeholder="Fiyat (TL)" min="<?php echo esc_attr($min_price); ?>" step="1" required>
                    <?php endif; ?>
                    
                    <?php if (!$allow_multiple_shares): // Sadece hisse özelliği olmayan formlarda göster ?>
                    <div class="wdp-quantity-counter">
                        <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-decrease" aria-label="Azalt">-</button>
                        <input type="number" name="quantity" value="1" min="1" max="99" readonly>
                        <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-increase" aria-label="Arttır">+</button>
                    </div>
                    <?php else: // Hisse özelliği olan formlarda gizli input ekle ?>
                    <input type="hidden" name="quantity" value="1">
                    <?php endif; ?>
                </div>
                
                <!-- Butonlar -->
                <div class="wdp-button-group">
                    <button type="submit" name="donation_add_to_cart">Sepete Ekle</button>
                    <button type="submit" name="donation_go_checkout">Ödemeye Git</button>
                </div>
                
                <!-- Gizli Alanlar -->
                <input type="hidden" name="add-to-cart" value="<?php echo esc_attr($product_id); ?>">
                <input type="hidden" name="donation_modal" value="1">
            </form>
        </div>
    </div>
    
    <script>
    document.addEventListener('DOMContentLoaded', function() {
        // Form elementini bul
        var formContainer = document.getElementById('<?php echo esc_js($form_id); ?>');
        if (!formContainer) return;
        
        var form = formContainer.querySelector('form');
        if (!form) return;
        
        // Ürün bilgilerini al
        var productId = formContainer.getAttribute('data-product-id');
        
        // Popup ile aynı JavaScript işleme mantığını kullan
        if (typeof setupShareholderForms === 'function') {
            setupShareholderForms(formContainer, productId);
        }
        
        // Form gönderim olayını ayarla - popup ile aynı
        if (typeof setupFormSubmission === 'function') {
            setupFormSubmission(form);
        }
    });
    </script>
    <?php
    return ob_get_clean();
}

/**
 * Bağış modal'ını oluştur
 * 
 * @param int $product_id Ürün ID'si
 * @param string $button_text Buton metni
 * @param string $custom_class Özel CSS sınıfı
 * @param string $custom_style Özel CSS stili
 * @return string Modal HTML'i
 */
public function render_donation_modal($product_id, $button_text = '', $custom_class = '', $custom_style = '') {
    // Ürün ID'sini integer'a çevir
    $product_id = intval($product_id);
    
    // Ürünün varlığını kontrol et
    $product = wc_get_product($product_id);
    if (!$product) {
        if (current_user_can('manage_options')) {
            return '<p style="color:red;">Ürün bulunamadı (ID: ' . esc_html($product_id) . '). Lütfen ürün ID\'sini kontrol edin.</p>';
        }
        return '';
    }
    
    // Buton metni boşsa varsayılan değeri kullan
    if (empty($button_text)) {
        $button_text = __('Bağış Yap', 'woo-donation-popup');
    }
    
    // Ürün adını al
    $product_name = $product->get_name();
    
    // Benzersiz bir ID oluştur
    $modal_id = 'wdp-modal-' . $product_id;

    // Özel fiyat seçeneğinin aktif olup olmadığını kontrol et
    $allow_custom_price = get_post_meta($product_id, '_allow_custom_price', true) === 'yes';
    $min_price = get_post_meta($product_id, '_min_custom_price', true);
    
    // Eğer minimum fiyat yoksa ve özel fiyat aktifse, varsayılan olarak 0 kullan
    if ($allow_custom_price && $min_price === '') {
        $min_price = '0';
    }
    
    // Çoklu hisse seçeneğinin aktif olup olmadığını kontrol et
    $allow_multiple_shares = get_post_meta($product_id, '_allow_multiple_shares', true) === 'yes';
    $max_shares = get_post_meta($product_id, '_max_shares', true);
    
    // Eğer maksimum hisse sayısı yoksa ve çoklu hisse aktifse, varsayılan olarak 7 kullan
    if ($allow_multiple_shares && $max_shares === '') {
        $max_shares = '7';
    }
    
    // Modal HTML'ini oluştur
    ob_start();
    ?>
    <!-- Modal -->
    <div id="<?php echo esc_attr($modal_id); ?>" class="wdp-modal <?php echo esc_attr($custom_class); ?>" role="dialog" aria-modal="true" aria-labelledby="<?php echo esc_attr($modal_id); ?>-title" aria-describedby="<?php echo esc_attr($modal_id); ?>-description">
        <div class="wdp-modal-content">
            <div class="wdp-modal-header">
                <span id="<?php echo esc_attr($modal_id); ?>-title" class="wdp-modal-title"><?php echo esc_html($product_name); ?></span>
                <button type="button" class="wdp-modal-close" aria-label="<?php echo esc_attr__('Modalı Kapat', 'woo-donation-popup'); ?>">&times;</button>
            </div>
            <div id="<?php echo esc_attr($modal_id); ?>-description" class="screen-reader-text"><?php echo esc_html(sprintf(__('%s için bağış formu', 'woo-donation-popup'), $product_name)); ?></div>
            <form method="post" action="">
                <div class="wdp-form-error" style="display: none;"></div>
                
                <?php if ($allow_multiple_shares): ?>
                <!-- Çoklu Hisse Alanı -->
                <div class="wdp-shares-section">
                    <div class="wdp-shares-header">
                        <label>Hisse Adedi:</label>
                        <div class="wdp-share-counter">
                            <button type="button" class="wdp-share-btn decrease"><span>-</span></button>
                            <input type="number" name="share_count" value="1" min="1" max="<?php echo esc_attr($max_shares); ?>" readonly>
                            <button type="button" class="wdp-share-btn increase"><span>+</span></button>
                        </div>
                    </div>
                    <div class="wdp-shareholders-container">
                        <!-- Hissedar formları JavaScript ile eklenecek -->
                    </div>
                </div>
                <?php else: ?>
                <!-- Bağışçı Bilgileri -->
                <input type="text" name="donation_full_name" placeholder="Ad Soyad *" required autocomplete="name">
                <input type="tel" name="donation_phone" placeholder="Telefon Numarası *" required autocomplete="tel">
                <textarea name="donation_note" rows="2" placeholder="Not (isteğe bağlı)"></textarea>
                <?php endif; ?>

                <!-- Fiyat ve Adet Alanları -->
                <div class="wdp-price-quantity-row">
                    <?php if ($allow_custom_price): ?>
                    <input type="number" name="custom_price" placeholder="Fiyat (TL)" min="<?php echo esc_attr($min_price); ?>" step="1" required>
                    <?php endif; ?>
                    
                    <?php if (!$allow_multiple_shares): // Sadece hisse özelliği olmayan formlarda göster ?>
                    <div class="wdp-quantity-counter">
                        <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-decrease" aria-label="Azalt">-</button>
                        <input type="number" name="quantity" value="1" min="1" max="99" readonly>
                        <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-increase" aria-label="Arttır">+</button>
                    </div>
                    <?php else: // Hisse özelliği olan formlarda gizli input ekle ?>
                    <input type="hidden" name="quantity" value="1">
                    <?php endif; ?>
                </div>
                
                <!-- Butonlar -->
                <div class="wdp-button-group">
                    <button type="submit" name="donation_add_to_cart">Sepete Ekle</button>
                    <button type="submit" name="donation_go_checkout">Ödemeye Git</button>
                </div>
                
                <!-- Gizli Alanlar -->
                <input type="hidden" name="add-to-cart" value="<?php echo esc_attr($product_id); ?>">
                <input type="hidden" name="donation_modal" value="1">
            </form>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

}

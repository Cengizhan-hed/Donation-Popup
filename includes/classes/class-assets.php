<?php
/**
 * ============================================================================
 * WDP_ASSETS - ASSET YÖNETİM SINIFI
 * ============================================================================
 * 
 * DOSYA: class-assets.php
 * KONUM: /includes/classes/class-assets.php
 * 
 * AMAÇ:
 * CSS ve JavaScript dosyalarını WordPress'e yükler (enqueue).
 * Asset versioning, cache busting ve conditional loading yönetir.
 * 
 * ANA İŞLEVLER:
 * 1. CSS/JS dosyalarını register etme
 * 2. Dependency yönetimi (jQuery, WooCommerce)
 * 3. Asset versioning (cache busting)
 * 4. Conditional loading (sadece gerektiğinde yükle)
 * 5. Inline CSS ekleme (critical CSS)
 * 6. Font preload
 * 7. Footer'da yükleme desteği
 * 
 * MODÜL YAPISI:
 * - 13+ JavaScript modülü (modüler yapı)
 * - 1 ana CSS dosyası (modüler import'lar)
 * - Inline CSS (critical styles)
 * 
 * PERFORMANS OPTİMİZASYONLARI:
 * - Transient cache ile version kontrolü (5 dakika)
 * - File modification time kullanımı
 * - Conditional enqueuing (shortcode kontrolü)
 * - Force enqueue desteği (dinamik içerik için)
 * 
 * CACHE BUSTING:
 * - CSS: donation-modal.css ve tüm src dosyalarının mtime'ı
 * - JS: Tüm src dosyalarının mtime'ı
 * - Transient cache: 5 dakika (performans için)
 * 
 * DEPENDENCY SIRASI (JavaScript):
 * 1. wdp-constants-js (bağımlılık yok)
 * 2. wdp-utils-js (jQuery bağımlı)
 * 3. wdp-state-js (utils bağımlı)
 * 4. wdp-dom-js (state bağımlı)
 * 5. wdp-alerts-js (utils bağımlı)
 * 6. wdp-product-js (utils, state bağımlı)
 * 7. wdp-cart-js (utils, state bağımlı)
 * 8. wdp-form-js (utils, state, alerts, cart bağımlı)
 * 9. wdp-shareholder-js (utils, state, dom, product, form bağımlı)
 * 10. wdp-modal-js (utils, state, form, shareholder bağımlı)
 * 11. wdp-form-initializer-js (utils, form, shareholder bağımlı)
 * 12. wdp-event-manager-js (utils, modal, form bağımlı)
 * 13. wdp-module-loader-js (utils bağımlı)
 * 14. wdp-init-js (tüm modüller bağımlı - son yüklenen)
 * 
 * CSS YAPISI:
 * - donation-modal.css (ana dosya)
 *   - @import tokens.css (design tokens)
 *   - @import base.css (temel reset)
 *   - @import layout.css (layout kuralları)
 *   - @import forms/shared.css (form stilleri)
 *   - @import forms/hisseli.css (hissedar form stilleri)
 *   - @import components/*.css (bileşen stilleri)
 * 
 * INLINE CSS:
 * - Critical CSS: Head'de inline (render blocking önlemek için)
 * - Customization CSS: Ana stylesheet'e inline (CSS variables)
 * 
 * FONT PRELOAD:
 * - Google Fonts preconnect
 * - Font-display: swap (FOUT önleme)
 * 
 * ============================================================================
 * 
 * Assets management class
 * Handles CSS and JS enqueuing
 * 
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Class WDP_Assets
 */
class WDP_Assets {

    /**
     * Flag indicating that assets must be enqueued regardless of shortcode detection.
     *
     * @var bool
     */
    private static $force_enqueue_assets = false;

    /**
     * Track whether inline styles were already attached to the main stylesheet.
     *
     * @var bool
     */
    private static $inline_style_attached = false;

    /**
     * Initialize
     */
    public static function init() {
        add_action('wp_enqueue_scripts', array(__CLASS__, 'enqueue_assets'));
        // wp_footer'da da kontrol et (eğer shortcode render edildiyse)
        add_action('wp_footer', array(__CLASS__, 'maybe_enqueue_in_footer'), 1);
    }
    
    /**
     * Maybe enqueue assets in footer (if force_enqueue was called)
     */
    public static function maybe_enqueue_in_footer() {
        // Eğer force_enqueue çağrıldıysa ve assets henüz yüklenmediyse yükle
        if (self::$force_enqueue_assets) {
            // Script'ler yüklenmiş mi kontrol et
            if (!wp_script_is('wdp-utils-js', 'enqueued')) {
                self::enqueue_assets_now();
            }
        }
    }

    /**
     * Force enqueue assets
     */
    public static function force_enqueue() {
        self::$force_enqueue_assets = true;
        
        // Eğer wp_enqueue_scripts hook'u geçtiyse, wp_footer'da yükle
        if (did_action('wp_enqueue_scripts')) {
            // wp_footer hook'una ekle (priority 1 - erken)
            // Script'ler zaten register edilmiş olmalı, sadece enqueue et
            if (!has_action('wp_footer', array(__CLASS__, 'enqueue_assets_now'))) {
                add_action('wp_footer', array(__CLASS__, 'enqueue_assets_now'), 1);
            }
        }
        // wp_enqueue_scripts geçmediyse, enqueue_assets() metodunda zaten kontrol edilecek
    }
    
    /**
     * Enqueue assets immediately (called by force_enqueue or wp_enqueue_scripts)
     */
    public static function enqueue_assets_now() {
        // Script'ler zaten register edilmiş olmalı (enqueue_assets metodunda)
        // Sadece enqueue et
        
        // Script'leri register et (eğer register edilmemişse)
        if (!wp_script_is('wdp-utils-js', 'registered')) {
            // Tüm script'leri register et (enqueue_assets metodundaki gibi)
            global $post;
            
            // Plugin path/url
            $plugin_dir = defined('WDP_PLUGIN_PATH') ? WDP_PLUGIN_PATH : plugin_dir_path(dirname(dirname(__FILE__)));
            $plugin_url = defined('WDP_PLUGIN_URL') ? WDP_PLUGIN_URL : plugin_dir_url(dirname(dirname(__FILE__)));
            
            // CSS ve JS versiyonlarını al
            $css_cache_key = 'wdp_css_version_' . md5($plugin_dir . 'assets/css/donation-modal.css');
            $css_version = get_transient($css_cache_key);
            if (false === $css_version) {
                $css_version = WDP_ASSET_VERSION;
            }
            
            $js_cache_key = 'wdp_js_version_' . md5($plugin_dir . 'assets/js/src/');
            $js_module_version = get_transient($js_cache_key);
            if (false === $js_module_version) {
                $js_module_version = WDP_ASSET_VERSION;
            }
            
            // Dependencies
            $dependencies = array('jquery');
            if (wp_script_is('wc-add-to-cart', 'enqueued')) {
                $dependencies[] = 'wc-add-to-cart';
            }
            
            // Tüm script'leri register et
            wp_register_script('wdp-utils-js', $plugin_url . 'assets/js/src/utils.js', $dependencies, $js_module_version, true);
            wp_register_script('wdp-state-js', $plugin_url . 'assets/js/src/state.js', array('wdp-utils-js'), $js_module_version, true);
            wp_register_script('wdp-dom-js', $plugin_url . 'assets/js/src/dom.js', array('wdp-state-js'), $js_module_version, true);
            wp_register_script('wdp-alerts-js', $plugin_url . 'assets/js/src/alerts.js', array('wdp-utils-js'), $js_module_version, true);
            wp_register_script('wdp-product-js', $plugin_url . 'assets/js/src/product.js', array('wdp-utils-js', 'wdp-state-js'), $js_module_version, true);
            wp_register_script('wdp-cart-js', $plugin_url . 'assets/js/src/cart.js', array('wdp-utils-js', 'wdp-state-js'), $js_module_version, true);
            wp_register_script('wdp-form-js', $plugin_url . 'assets/js/src/form.js', array('wdp-utils-js', 'wdp-state-js', 'wdp-alerts-js', 'wdp-cart-js'), $js_module_version, true);
            wp_register_script('wdp-shareholder-js', $plugin_url . 'assets/js/src/shareholder.js', array('wdp-utils-js', 'wdp-state-js', 'wdp-dom-js', 'wdp-product-js', 'wdp-form-js'), $js_module_version, true);
            wp_register_script('wdp-modal-js', $plugin_url . 'assets/js/src/modal.js', array('wdp-utils-js', 'wdp-state-js', 'wdp-form-js', 'wdp-shareholder-js'), $js_module_version, true);
                wp_register_script('wdp-form-initializer-js', $plugin_url . 'assets/js/src/form-initializer.js', array('wdp-utils-js', 'wdp-form-js', 'wdp-shareholder-js'), $js_module_version, true);
                wp_register_script('wdp-event-manager-js', $plugin_url . 'assets/js/src/event-manager.js', array('wdp-utils-js', 'wdp-modal-js', 'wdp-form-js'), $js_module_version, true);
                wp_register_script('wdp-module-loader-js', $plugin_url . 'assets/js/src/module-loader.js', array('wdp-utils-js'), $js_module_version, true);
                wp_register_script('wdp-constants-js', $plugin_url . 'assets/js/src/constants.js', array(), $js_module_version, true);
                wp_register_script('wdp-init-js', $plugin_url . 'assets/js/src/init.js', array('wdp-utils-js', 'wdp-state-js', 'wdp-dom-js', 'wdp-modal-js', 'wdp-form-js', 'wdp-shareholder-js', 'wdp-cart-js', 'wdp-form-initializer-js', 'wdp-event-manager-js', 'wdp-module-loader-js', 'wdp-constants-js'), $js_module_version, true);
            wp_register_style('wdp-donation-modal-css', $plugin_url . 'assets/css/donation-modal.css', array(), $css_version);
            
            // Localize script (sadece bir kez)
            if (!did_action('wp_localize_script_wdp-utils-js')) {
                // Get current currency (supports Currency switcher plugins)
                $current_currency = function_exists('get_woocommerce_currency') ? get_woocommerce_currency() : 'TRY';
                $currency_symbol = function_exists('get_woocommerce_currency_symbol') ? get_woocommerce_currency_symbol($current_currency) : '₺';
                
                wp_localize_script('wdp-utils-js', 'wdp_ajax', array(
                    'ajax_url' => admin_url('admin-ajax.php'),
                    'plugin_url' => $plugin_url,
                    'nonces' => array(
                        'ajax_add_to_cart' => wp_create_nonce('wdp_ajax_add_to_cart'),
                        'get_product_info' => wp_create_nonce('wdp_get_product_info'),
                        'get_product_name' => wp_create_nonce('wdp_get_product_name'),
                        'get_cart_count' => wp_create_nonce('wdp_get_cart_count'),
                        'get_cart_contents' => wp_create_nonce('wdp_get_cart_contents'),
                        'render_button' => wp_create_nonce('wdp_render_donation_button'),
                    ),
                    'nonce' => wp_create_nonce('wdp_ajax_add_to_cart'),
                    'checkout_url' => function_exists('wc_get_checkout_url') ? wc_get_checkout_url() : '',
                    'cart_url' => function_exists('wc_get_cart_url') ? wc_get_cart_url() : '',
                    'version' => WDP_VERSION,
                    'debug' => defined('WP_DEBUG') && WP_DEBUG,
                    'jquery_loaded' => wp_script_is('jquery', 'enqueued'),
                    'wc_loaded' => class_exists('WooCommerce'),
                    'home_url' => home_url(),
                    'site_url' => site_url(),
                    'currency' => array(
                        'code' => $current_currency,
                        'symbol' => $currency_symbol,
                    ),
                    'strings' => array(
                        'loading' => __('Yükleniyor...', 'woo-donation-popup'),
                        'error' => __('Bir hata oluştu', 'woo-donation-popup'),
                        'success' => __('Başarılı', 'woo-donation-popup'),
                        'required_field' => __('Bu alan zorunludur', 'woo-donation-popup'),
                        'invalid_price' => __('Geçersiz fiyat', 'woo-donation-popup'),
                        'min_price_error' => __('Minimum fiyat: ', 'woo-donation-popup'),
                        'max_shares_error' => __('Maksimum hisse sayısı: ', 'woo-donation-popup'),
                    ),
                    'button_texts' => self::get_button_texts(),
                    'shareholder_texts' => self::get_shareholder_texts(),
                ));
            }
        }
        
        // Script'leri enqueue et (WordPress dependency sistemine güven)
        wp_enqueue_script('wdp-constants-js'); // Load first (no dependencies)
        wp_enqueue_script('wdp-utils-js');
        wp_enqueue_script('wdp-state-js');
        wp_enqueue_script('wdp-dom-js');
        wp_enqueue_script('wdp-alerts-js');
        wp_enqueue_script('wdp-product-js');
        wp_enqueue_script('wdp-cart-js');
        wp_enqueue_script('wdp-form-js');
        wp_enqueue_script('wdp-shareholder-js');
        wp_enqueue_script('wdp-progress-bar-js');
        wp_enqueue_script('wdp-modal-js');
        wp_enqueue_script('wdp-form-initializer-js');
        wp_enqueue_script('wdp-event-manager-js');
        wp_enqueue_script('wdp-module-loader-js');
        wp_enqueue_script('wdp-init-js');
        
        // Style'ı enqueue et
        if (!wp_style_is('wdp-donation-modal-css', 'enqueued')) {
            wp_enqueue_style('wdp-donation-modal-css');
        }
        
        // Inline style ekle
        self::maybe_enqueue_inline_style();
    }

    /**
     * Get button texts from settings
     *
     * @return array Button texts.
     */
    private static function get_button_texts() {
        // Buton ayarlarını al
        $button_settings = get_option('wdp_button_settings', array());
        
        // Varsayılan değerler
        $defaults = array(
            'button_text_donate'      => __('Bağış Yap', 'woo-donation-popup'),
            'button_text_add_to_cart' => __('Sepete Ekle', 'woo-donation-popup'),
            'button_text_go_checkout' => __('Ödemeye Git', 'woo-donation-popup'),
        );
        
        $settings = wp_parse_args($button_settings, $defaults);
        
        $result = array(
            'donate'      => $settings['button_text_donate'],
            'add_to_cart' => $settings['button_text_add_to_cart'],
            'go_checkout' => $settings['button_text_go_checkout'],
        );
        
        // Başarı ekranı buton metinleri (başarı ekranı ayarlarından al)
        $success_settings = get_option('wdp_success_settings', array());
        if (isset($success_settings['success_text_view_cart'])) {
            $result['success_view_cart'] = $success_settings['success_text_view_cart'];
        } else {
            $result['success_view_cart'] = __('Sepeti Görüntüle', 'woo-donation-popup');
        }
        
        if (isset($success_settings['success_text_go_checkout'])) {
            $result['success_go_checkout'] = $success_settings['success_text_go_checkout'];
        } else {
            $result['success_go_checkout'] = __('Ödemeye Git', 'woo-donation-popup');
        }
        
        if (isset($success_settings['success_text_new_donation'])) {
            $result['success_new_donation'] = $success_settings['success_text_new_donation'];
        } else {
            $result['success_new_donation'] = __('Yeni Bağış Ekle', 'woo-donation-popup');
        }
        
        return $result;
    }

    /**
     * Get shareholder text customization settings for JS
     *
     * @return array
     */
    private static function get_shareholder_texts() {
        $settings = get_option('wdp_shareholder_settings', array());
        $defaults = array(
            'shareholder_header_text'      => 'Hissedar Bilgileri',
            'shareholder_name_placeholder' => 'Ad Soyad *',
            'shareholder_phone_placeholder'=> 'Telefon Numarası *',
            'shareholder_note_placeholder' => 'Not (isteğe bağlı)',
            'shareholder_copy_button_text' => '📋 Kopyasını Oluştur',
            'shareholder_enable_copy_button' => '1',
            'shareholder_layout'           => 'single',
            'shareholder_density'          => 'normal',
            'shareholder_enable_email'     => '0',
            'shareholder_email_placeholder'=> 'E-posta (isteğe bağlı)',
        );

        $settings = wp_parse_args($settings, $defaults);

        return array(
            'header'            => $settings['shareholder_header_text'],
            'name_placeholder'  => $settings['shareholder_name_placeholder'],
            'phone_placeholder' => $settings['shareholder_phone_placeholder'],
            'note_placeholder'  => $settings['shareholder_note_placeholder'],
            'copy_button'       => $settings['shareholder_copy_button_text'],
            'enable_copy_button'=> !empty($settings['shareholder_enable_copy_button']) && $settings['shareholder_enable_copy_button'] !== '0',
            'layout'            => !empty($settings['shareholder_layout']) ? $settings['shareholder_layout'] : 'single',
            'density'           => !empty($settings['shareholder_density']) ? $settings['shareholder_density'] : 'normal',
            'enable_email'      => !empty($settings['shareholder_enable_email']) && $settings['shareholder_enable_email'] !== '0',
            'email_placeholder' => $settings['shareholder_email_placeholder'],
        );
    }
    
    /**
     * Get button customization CSS variables
     *
     * @return string CSS variables.
     */
    private static function get_button_customization_css() {
        // Normal form ayarlarını al
        $button_settings = get_option('wdp_button_settings', array());
        
        // Varsayılan değerler
        $defaults = array(
            'button_primary_color' => '#1e73be',
            'button_primary_hover' => '#185d98',
            'button_border_radius' => '10',
            'modal_background_color' => '#ffffff',
            'modal_border_radius' => '12',
            'input_border_color' => '#d1d5db',
            'input_border_radius' => '8',
            'title_color' => '#1f2937',
            'title_font_size' => '27',
            'title_font_size_mobile' => '22',
            'close_button_color' => '#6b7280',
            'button_checkout_color' => '#48bb78',
            'button_checkout_hover' => '#38a169',
            'popup_button_text' => 'Bağış Yap',
            'popup_button_color' => '#1e73be',
            'popup_button_hover' => '#185d98',
            'popup_button_font_size' => '18',
            'popup_button_font_weight' => '700',
            'popup_button_font_family' => 'inherit',
            'popup_button_custom_font' => '',
            'popup_button_border_radius' => '10',
            'label_color' => '#374151',
            'label_font_size' => 14,
            'label_font_weight' => '600',
            'placeholder_color' => '#6b7280',
            'form_gap' => 16,
            'error_bg_color' => '#fed7d7',
            'error_border_color' => '#feb2b2',
            'error_text_color' => '#c53030',
            'input_error_bg_color' => '#fed7d7',
            'input_error_border_color' => '#feb2b2',
            'input_error_text_color' => '#c53030',
        );
        
        $settings = wp_parse_args($button_settings, $defaults);
        
        // CSS değişkenlerini oluştur
        $css = ":root {\n";
        
        // Popup butonu değişkenleri
        if (isset($settings['popup_button_color'])) {
            $css .= "  --wdp-primary: " . esc_attr($settings['popup_button_color']) . ";\n";
        } else {
            $css .= "  --wdp-primary: #1e73be;\n";
        }
        if (isset($settings['popup_button_hover'])) {
            $css .= "  --wdp-primary-hover: " . esc_attr($settings['popup_button_hover']) . ";\n";
        } else {
            $css .= "  --wdp-primary-hover: #185d98;\n";
        }
        if (isset($settings['popup_button_font_size'])) {
            $css .= "  --wdp-popup-button-font-size: " . esc_attr($settings['popup_button_font_size']) . "px;\n";
        } else {
            $css .= "  --wdp-popup-button-font-size: 18px;\n";
        }
        if (isset($settings['popup_button_font_weight'])) {
            $css .= "  --wdp-popup-button-font-weight: " . esc_attr($settings['popup_button_font_weight']) . ";\n";
        } else {
            $css .= "  --wdp-popup-button-font-weight: 700;\n";
        }
        // Popup buton font-family
        if (isset($settings['popup_button_font_family'])) {
            if ($settings['popup_button_font_family'] === 'custom' && !empty($settings['popup_button_custom_font'])) {
                $css .= "  --wdp-popup-button-font-family: " . esc_attr($settings['popup_button_custom_font']) . ";\n";
            } elseif ($settings['popup_button_font_family'] !== 'inherit' && $settings['popup_button_font_family'] !== 'custom') {
                $css .= "  --wdp-popup-button-font-family: " . esc_attr($settings['popup_button_font_family']) . ", sans-serif;\n";
            } else {
                $css .= "  --wdp-popup-button-font-family: inherit;\n";
            }
        } else {
            $css .= "  --wdp-popup-button-font-family: inherit;\n";
        }
        // Popup buton border radius
        if (isset($settings['popup_button_border_radius'])) {
            $css .= "  --wdp-popup-button-radius: " . esc_attr($settings['popup_button_border_radius']) . "px;\n";
        } else {
            $css .= "  --wdp-popup-button-radius: 10px;\n";
        }
        
        // Normal form değişkenleri
        $css .= "  --wdp-button-primary: " . esc_attr($settings['button_primary_color']) . ";\n";
        $css .= "  --wdp-button-primary-hover: " . esc_attr($settings['button_primary_hover']) . ";\n";
        $css .= "  --wdp-button-radius: " . esc_attr($settings['button_border_radius']) . "px;\n";
        $css .= "  --wdp-modal-bg: " . esc_attr($settings['modal_background_color']) . ";\n";
        $css .= "  --wdp-modal-radius: " . esc_attr($settings['modal_border_radius']) . "px;\n";
        $css .= "  --wdp-input-border: " . esc_attr($settings['input_border_color']) . ";\n";
        $css .= "  --wdp-input-radius: " . esc_attr($settings['input_border_radius']) . "px;\n";
        $css .= "  --wdp-title-color: " . esc_attr($settings['title_color']) . ";\n";
        $css .= "  --wdp-title-size: " . esc_attr($settings['title_font_size']) . "px;\n";
        if (!empty($settings['title_font_size_mobile'])) {
            $css .= "  --wdp-title-size-mobile: " . esc_attr($settings['title_font_size_mobile']) . "px;\n";
        }
        $css .= "  --wdp-close-color: " . esc_attr($settings['close_button_color']) . ";\n";
        $css .= "  --wdp-label-color: " . esc_attr($settings['label_color']) . ";\n";
        $css .= "  --wdp-label-font-size: " . esc_attr($settings['label_font_size']) . "px;\n";
        $css .= "  --wdp-label-font-weight: " . esc_attr($settings['label_font_weight']) . ";\n";
        $css .= "  --wdp-placeholder-color: " . esc_attr($settings['placeholder_color']) . ";\n";
        $css .= "  --wdp-form-gap: " . esc_attr($settings['form_gap']) . "px;\n";
        $css .= "  --wdp-form-error-bg: " . esc_attr($settings['error_bg_color']) . ";\n";
        $css .= "  --wdp-form-error-border: " . esc_attr($settings['error_border_color']) . ";\n";
        $css .= "  --wdp-form-error-text: " . esc_attr($settings['error_text_color']) . ";\n";
        $css .= "  --wdp-input-error-bg: " . esc_attr($settings['input_error_bg_color']) . ";\n";
        $css .= "  --wdp-input-error-border: " . esc_attr($settings['input_error_border_color']) . ";\n";
        $css .= "  --wdp-input-error-text: " . esc_attr($settings['input_error_text_color']) . ";\n";

        // Progress bar ayarlarını al
        $progress_settings = get_option('wdp_progress_bar_settings', array());
        $progress_defaults = array(
            'container_bg' => '#f8fafc',
            'container_border' => '#e2e8f0',
            'track_bg' => '#e2e8f0',
            'fill_start' => '#3b82f6',
            'fill_mid' => '#2563eb',
            'fill_end' => '#1d4ed8',
            'preview_bg' => '#64748b',
            'percentage_bg' => '#ffffff',
            'percentage_text' => '#1e293b',
        );
        $progress_settings = wp_parse_args($progress_settings, $progress_defaults);

        $css .= "  --wdp-progress-container-bg: " . esc_attr($progress_settings['container_bg']) . ";\n";
        $css .= "  --wdp-progress-container-border: " . esc_attr($progress_settings['container_border']) . ";\n";
        $css .= "  --wdp-progress-track-bg: " . esc_attr($progress_settings['track_bg']) . ";\n";
        $css .= "  --wdp-progress-fill-start: " . esc_attr($progress_settings['fill_start']) . ";\n";
        $css .= "  --wdp-progress-fill-mid: " . esc_attr($progress_settings['fill_mid']) . ";\n";
        $css .= "  --wdp-progress-fill-end: " . esc_attr($progress_settings['fill_end']) . ";\n";
        $css .= "  --wdp-progress-preview-bg: " . esc_attr($progress_settings['preview_bg']) . ";\n";
        $css .= "  --wdp-progress-percentage-bg: " . esc_attr($progress_settings['percentage_bg']) . ";\n";
        $css .= "  --wdp-progress-percentage-text: " . esc_attr($progress_settings['percentage_text']) . ";\n";
        
        // Ödeme Yap butonu renkleri
        if (isset($settings['button_checkout_color'])) {
            $css .= "  --wdp-accent: " . esc_attr($settings['button_checkout_color']) . ";\n";
        } else {
            $css .= "  --wdp-accent: #48bb78;\n";
        }
        if (isset($settings['button_checkout_hover'])) {
            $css .= "  --wdp-accent-hover: " . esc_attr($settings['button_checkout_hover']) . ";\n";
        } else {
            $css .= "  --wdp-accent-hover: #38a169;\n";
        }
        
        // Hisseli form ayarlarını al
        $shareholder_settings = get_option('wdp_shareholder_settings', array());
        $shareholder_defaults = array(
            'shareholder_card_bg' => '#ffffff',
            'shareholder_card_border' => '#f0f2f5',
            'shareholder_card_radius' => '10',
            'shareholder_card_shadow' => '0 1px 3px rgba(0, 0, 0, 0.05)',
            'shareholder_header_bg' => '#f9fafb',
            'shareholder_header_color' => '#1f2937',
            'shareholder_content_padding' => '12',
            'shareholders_area_bg' => 'linear-gradient(to bottom, #ffffff 0%, #fafbfc 100%)',
            'shareholders_area_border' => '#e1e5e9',
            'shareholders_area_radius' => '16',
            'shareholders_scrollbar_color' => '#4a90e2',
            'share_counter_border' => '#d1d5db',
            'share_counter_bg' => '#ffffff',
            'share_counter_button_color' => '#888888',
        );
        $shareholder_settings = wp_parse_args($shareholder_settings, $shareholder_defaults);
        
        // Hisseli form değişkenleri
        $css .= "  --wdp-shareholder-card-bg: " . esc_attr($shareholder_settings['shareholder_card_bg']) . ";\n";
        $css .= "  --wdp-shareholder-card-border: " . esc_attr($shareholder_settings['shareholder_card_border']) . ";\n";
        $css .= "  --wdp-shareholder-card-radius: " . esc_attr($shareholder_settings['shareholder_card_radius']) . "px;\n";
        $css .= "  --wdp-shareholder-card-shadow: " . esc_attr($shareholder_settings['shareholder_card_shadow']) . ";\n";
        $css .= "  --wdp-shareholder-header-bg: " . esc_attr($shareholder_settings['shareholder_header_bg']) . ";\n";
        $css .= "  --wdp-shareholder-header-color: " . esc_attr($shareholder_settings['shareholder_header_color']) . ";\n";
        $css .= "  --wdp-shareholder-content-padding: " . esc_attr($shareholder_settings['shareholder_content_padding']) . "px;\n";
        $css .= "  --wdp-shareholders-area-bg: " . esc_attr($shareholder_settings['shareholders_area_bg']) . ";\n";
        $css .= "  --wdp-shareholders-area-border: " . esc_attr($shareholder_settings['shareholders_area_border']) . ";\n";
        $css .= "  --wdp-shareholders-area-radius: " . esc_attr($shareholder_settings['shareholders_area_radius']) . "px;\n";
        $css .= "  --wdp-shareholders-scrollbar-color: " . esc_attr($shareholder_settings['shareholders_scrollbar_color']) . ";\n";
        $css .= "  --wdp-share-counter-border: " . esc_attr($shareholder_settings['share_counter_border']) . ";\n";
        $css .= "  --wdp-share-counter-bg: " . esc_attr($shareholder_settings['share_counter_bg']) . ";\n";
        $css .= "  --wdp-share-counter-button-color: " . esc_attr($shareholder_settings['share_counter_button_color']) . ";\n";
        
        // Başarı ekranı ayarlarını al
        $success_settings = get_option('wdp_success_settings', array());
        $success_defaults = array(
            'success_button_color' => '#1e73be',
            'success_button_hover' => '#185d98',
            'success_button_radius' => '24',
            'success_message_bg' => 'rgba(72, 187, 120, 0.1)',
            'success_message_color' => '#48bb78',
            'success_message_border' => 'rgba(72, 187, 120, 0.2)',
            'success_message_radius' => '8',
            'mini_cart_bg' => '#f9fafb',
            'mini_cart_border' => '#e5e7eb',
            'mini_cart_radius' => '8',
            'cart_item_name_color' => '#1f2937',
            'cart_item_price_color' => '#1e73be',
        );
        $success_settings = wp_parse_args($success_settings, $success_defaults);
        
        // Başarı ekranı değişkenleri
        $css .= "  --wdp-success-button-color: " . esc_attr($success_settings['success_button_color']) . ";\n";
        $css .= "  --wdp-success-button-hover: " . esc_attr($success_settings['success_button_hover']) . ";\n";
        $css .= "  --wdp-success-button-radius: " . esc_attr($success_settings['success_button_radius']) . "px;\n";
        $css .= "  --wdp-success-message-bg: " . esc_attr($success_settings['success_message_bg']) . ";\n";
        $css .= "  --wdp-success-message-color: " . esc_attr($success_settings['success_message_color']) . ";\n";
        $css .= "  --wdp-success-message-border: " . esc_attr($success_settings['success_message_border']) . ";\n";
        $css .= "  --wdp-success-message-radius: " . esc_attr($success_settings['success_message_radius']) . "px;\n";
        $css .= "  --wdp-mini-cart-bg: " . esc_attr($success_settings['mini_cart_bg']) . ";\n";
        $css .= "  --wdp-mini-cart-border: " . esc_attr($success_settings['mini_cart_border']) . ";\n";
        $css .= "  --wdp-mini-cart-radius: " . esc_attr($success_settings['mini_cart_radius']) . "px;\n";
        $css .= "  --wdp-cart-item-name-color: " . esc_attr($success_settings['cart_item_name_color']) . ";\n";
        $css .= "  --wdp-cart-item-price-color: " . esc_attr($success_settings['cart_item_price_color']) . ";\n";
        
        // Modal görünüm ayarlarını al
        $modal_layout_settings = get_option('wdp_modal_layout_settings', array());
        $modal_layout_defaults = array(
            // Desktop
            'popup_modal_width_desktop' => '540',
            'inpage_form_width_desktop' => '480',
            'modal_padding_top_desktop' => '32',
            'modal_padding_right_desktop' => '24',
            'modal_padding_bottom_desktop' => '24',
            'modal_padding_left_desktop' => '24',
            // Mobile
            'popup_modal_width_mobile' => '540',
            'inpage_form_width_mobile' => '480',
            'modal_padding_top_mobile' => '28',
            'modal_padding_right_mobile' => '20',
            'modal_padding_bottom_mobile' => '20',
            'modal_padding_left_mobile' => '20',
        );
        $modal_layout_settings = wp_parse_args($modal_layout_settings, $modal_layout_defaults);
        
        // Modal görünüm değişkenleri - Desktop
        $css .= "  --wdp-popup-modal-width-desktop: " . esc_attr($modal_layout_settings['popup_modal_width_desktop']) . "px;\n";
        $css .= "  --wdp-inpage-form-width-desktop: " . esc_attr($modal_layout_settings['inpage_form_width_desktop']) . "px;\n";
        $css .= "  --wdp-modal-padding-top-desktop: " . esc_attr($modal_layout_settings['modal_padding_top_desktop']) . "px;\n";
        $css .= "  --wdp-modal-padding-right-desktop: " . esc_attr($modal_layout_settings['modal_padding_right_desktop']) . "px;\n";
        $css .= "  --wdp-modal-padding-bottom-desktop: " . esc_attr($modal_layout_settings['modal_padding_bottom_desktop']) . "px;\n";
        $css .= "  --wdp-modal-padding-left-desktop: " . esc_attr($modal_layout_settings['modal_padding_left_desktop']) . "px;\n";
        // Modal görünüm değişkenleri - Mobile
        $css .= "  --wdp-popup-modal-width-mobile: " . esc_attr($modal_layout_settings['popup_modal_width_mobile']) . "px;\n";
        $css .= "  --wdp-inpage-form-width-mobile: " . esc_attr($modal_layout_settings['inpage_form_width_mobile']) . "px;\n";
        $css .= "  --wdp-modal-padding-top-mobile: " . esc_attr($modal_layout_settings['modal_padding_top_mobile']) . "px;\n";
        $css .= "  --wdp-modal-padding-right-mobile: " . esc_attr($modal_layout_settings['modal_padding_right_mobile']) . "px;\n";
        $css .= "  --wdp-modal-padding-bottom-mobile: " . esc_attr($modal_layout_settings['modal_padding_bottom_mobile']) . "px;\n";
        $css .= "  --wdp-modal-padding-left-mobile: " . esc_attr($modal_layout_settings['modal_padding_left_mobile']) . "px;\n";
        
        $css .= "}\n";

        // Mobil için tipografi değişkenlerini override et
        $css .= "@media (max-width: 600px) {\n";
        $css .= "  :root {\n";
        $css .= "    --wdp-title-size: var(--wdp-title-size-mobile, " . esc_attr($settings['title_font_size']) . "px);\n";
        $css .= "  }\n";
        $css .= "}\n";
        
        return $css;
    }
    
    /**
     * Get inline CSS for modal visibility
     *
     * @return string Inline CSS.
     */
    private static function get_inline_css() {
        // Buton özelleştirme CSS'ini ekle
        $button_css = self::get_button_customization_css();
        
        return $button_css . "
        /* CRITICAL: Prevent font flash - apply font-size immediately before CSS loads */
        /* IMPORTANT: Respect dynamic title size set via --wdp-title-size */
        html body .wdp-modal-title,
        html body .wdp-form-title,
        html body .wdp-modal .wdp-modal-content h2,
        html body .wdp-donation-form .wdp-modal-content h2,
        html body .wdp-modal .wdp-modal-content .wdp-form-title,
        html body .wdp-donation-form .wdp-modal-content .wdp-form-title,
        html body .wdp-modal .wdp-modal-content h2.wdp-form-title,
        html body .wdp-donation-form .wdp-modal-content h2.wdp-form-title {
            font-size: var(--wdp-title-size, 27px);
            line-height: 1.2;
        }
        /* Modal kapalıyken kesinlikle sayfa düzenini etkilememeli */
        .wdp-modal:not(.show) { 
            position: static; 
            z-index: auto; 
            left: auto; 
            top: auto; 
            right: auto; 
            bottom: auto; 
            width: 0; 
            height: 0; 
            min-width: 0; 
            min-height: 0; 
            max-width: 0; 
            max-height: 0; 
            visibility: hidden; 
            opacity: 0; 
            pointer-events: none; 
            clip: rect(0, 0, 0, 0); 
            clip-path: inset(100%); 
        }
        /* Modal açıkken normal görünüm */
        .wdp-modal.show { 
            position: fixed; 
            z-index: 999999; 
            left: 0; 
            top: 0; 
            right: 0; 
            bottom: 0; 
            width: 100vw; 
            height: 100vh; 
            clip: auto; 
            clip-path: none; 
        }
        .wdp-modal-content { 
            z-index: 1000000; 
        }
        .wdp-modal-close { 
            z-index: 1000001; 
        }
        .wdp-modal * { 
            box-sizing: border-box; 
        }
        .wdp-modal-content * { 
            box-sizing: border-box; 
        }
        .wdp-donation-form * { 
            box-sizing: border-box; 
        }
        @media (max-width: 768px) {
            .wdp-modal.show .wdp-modal-content { 
                width: 95%; 
                max-width: 95%; 
                margin: 10px auto; 
            }
        }
        ";
    }

    /**
     * Get critical CSS for inline rendering (above-the-fold content)
     * PERFORMANCE: Minimal CSS for faster initial render
     * 
     * @return string Critical CSS
     */
    private static function get_critical_css() {
        // PERFORMANCE: Critical CSS - only essential styles for initial render
        // Minimize size for faster page load
        return "
        /* PERFORMANCE: Critical CSS - Modal visibility only */
        html body .wdp-modal:not(.show) { 
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
        html body .wdp-modal.show { 
            display: flex !important;
            position: fixed !important;
            z-index: 2147483645 !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            visibility: visible !important;
            opacity: 1 !important;
        }
        html body .wdp-modal-content {
            z-index: 2147483646 !important;
            position: relative !important;
        }
        html body.wdp-modal-open {
            overflow: hidden !important;
        }
        ";
    }
    
    /**
     * Attach inline CSS once per request.
     */
    private static function maybe_enqueue_inline_style() {
        if (self::$inline_style_attached) {
            return;
        }

        $inline_css = self::get_inline_css();
        
        // PERFORMANCE: Critical CSS'i head'e ekle (inline, blocking)
        $critical_css = self::get_critical_css();
        add_action('wp_head', function() use ($critical_css) {
            echo '<style id="wdp-critical-css">' . $critical_css . '</style>' . "\n";
        }, 1);
        
        // PERFORMANCE: Font preload for better performance (only if needed)
        add_action('wp_head', function() {
            // Preconnect to Google Fonts (only if Inter font is used)
            // PERFORMANCE: Use dns-prefetch for non-critical resources
            echo '<link rel="dns-prefetch" href="https://fonts.googleapis.com">' . "\n";
            echo '<link rel="dns-prefetch" href="https://fonts.gstatic.com">' . "\n";
            // Preconnect only when actually needed (lazy)
            echo '<link rel="preconnect" href="https://fonts.googleapis.com">' . "\n";
            echo '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' . "\n";
        }, 0);
        
        // Cache busting için ayarların hash'ini ekle
        $button_settings = get_option('wdp_button_settings', array());
        $settings_hash = md5(serialize($button_settings));
        
        // Inline CSS'i ekle (non-critical, async)
        wp_add_inline_style('wdp-donation-modal-css', $inline_css);
        
        // Cache'i temizlemek için style tag'ine data attribute ekle (debug için)
        add_action('wp_head', function() use ($settings_hash) {
            echo "<!-- WDP Button Settings Hash: " . esc_attr($settings_hash) . " -->\n";
        }, 999);
        
        self::$inline_style_attached = true;
    }

    /**
     * Enqueue plugin CSS and JS files
     */
    public static function enqueue_assets() {
        global $post;

        // Asset base path/url (constants fallback)
        $plugin_dir = defined('WDP_PLUGIN_PATH') ? WDP_PLUGIN_PATH : plugin_dir_path(dirname(dirname(__FILE__)));
        $plugin_url = defined('WDP_PLUGIN_URL') ? WDP_PLUGIN_URL : plugin_dir_url(dirname(dirname(__FILE__)));

        // PERFORMANCE: Cache asset versions to avoid repeated file operations
        // Use static variables to cache within same request
        static $css_version = null;
        static $js_module_version = null;
        
        // PERFORMANCE: Use object cache for asset versions (persistent across requests)
        $asset_cache_group = 'wdp_assets';

        // PERFORMANCE: Asset versioning with object cache (faster than transient)
        $css_file = $plugin_dir . 'assets/css/donation-modal.css';
        
        // CSS versioning: Ana CSS dosyası ve tüm src dosyalarının en yeni modification time'ını kullan
        // PERFORMANCE: Use object cache first, then transient as fallback
        $css_cache_key = 'wdp_css_version_' . md5($css_file);
        
        if (null === $css_version) {
            $cached_css_version = wp_cache_get($css_cache_key, $asset_cache_group);
            
            if (false === $cached_css_version) {
                // Fallback to transient
                $cached_css_version = get_transient($css_cache_key);
            }

            if (false === $cached_css_version) {
                $css_version = file_exists($css_file) ? filemtime($css_file) : WDP_ASSET_VERSION;
                
                // PERFORMANCE: Only check src files if main file exists
                if (file_exists($css_file)) {
                    $css_src_dir = $plugin_dir . 'assets/css/src/';
                    if (is_dir($css_src_dir)) {
                        $css_files = new RecursiveIteratorIterator(
                            new RecursiveDirectoryIterator($css_src_dir),
                            RecursiveIteratorIterator::SELF_FIRST
                        );

                        foreach ($css_files as $file) {
                            if ($file->isFile() && $file->getExtension() === 'css') {
                                $file_mtime = filemtime($file->getRealPath());
                                if ($file_mtime > $css_version) {
                                    $css_version = $file_mtime;
                                }
                            }
                        }
                    }
                }

                // PERFORMANCE: Cache in both object cache and transient
                wp_cache_set($css_cache_key, $css_version, $asset_cache_group, 300);
                set_transient($css_cache_key, $css_version, 300);
            } else {
                $css_version = $cached_css_version;
            }
        }

        $js_version = WDP_ASSET_VERSION;

        if (defined('SCRIPT_DEBUG') && SCRIPT_DEBUG) {
            $js_version = time();
            $css_version = time();
        }

        $dependencies = array('jquery');
        if (wp_script_is('wc-add-to-cart', 'enqueued')) {
            $dependencies[] = 'wc-add-to-cart';
        }

        // PERFORMANCE: JS modül versiyonları with object cache
        // Use object cache first, then transient as fallback
        if (null === $js_module_version) {
            $cache_key = 'wdp_js_version_' . md5($plugin_dir . 'assets/js/src/');
            $cached_js_version = wp_cache_get($cache_key, $asset_cache_group);
            
            if (false === $cached_js_version) {
                // Fallback to transient
                $cached_js_version = get_transient($cache_key);
            }

            if (false === $cached_js_version) {
                $js_module_version = WDP_ASSET_VERSION;
                $js_src_dir = $plugin_dir . 'assets/js/src/';
                
                if (is_dir($js_src_dir)) {
                    $js_files = new RecursiveIteratorIterator(
                        new RecursiveDirectoryIterator($js_src_dir),
                        RecursiveIteratorIterator::SELF_FIRST
                    );

                    foreach ($js_files as $file) {
                        if ($file->isFile() && $file->getExtension() === 'js') {
                            $file_mtime = filemtime($file->getRealPath());
                            if ($file_mtime > $js_module_version) {
                                $js_module_version = $file_mtime;
                            }
                        }
                    }
                }

                // PERFORMANCE: Cache in both object cache and transient
                wp_cache_set($cache_key, $js_module_version, $asset_cache_group, 300);
                set_transient($cache_key, $js_module_version, 300);
            } else {
                $js_module_version = $cached_js_version;
            }
        }

        // Modülleri WordPress'te sırayla kaydet (dependency order)
        // PERFORMANCE: Script'leri footer'da yükle (true) - WordPress handles this automatically
        wp_register_script(
            'wdp-utils-js',
            $plugin_url . 'assets/js/src/utils.js',
            $dependencies,
            $js_module_version,
            true
        );

        wp_register_script(
            'wdp-state-js',
            $plugin_url . 'assets/js/src/state.js',
            array('wdp-utils-js'),
            $js_module_version,
            true
        );

        wp_register_script(
            'wdp-dom-js',
            $plugin_url . 'assets/js/src/dom.js',
            array('wdp-state-js'),
            $js_module_version,
            true
        );

        wp_register_script(
            'wdp-alerts-js',
            $plugin_url . 'assets/js/src/alerts.js',
            array('wdp-utils-js'),
            $js_module_version,
            true
        );

        wp_register_script(
            'wdp-product-js',
            $plugin_url . 'assets/js/src/product.js',
            array('wdp-utils-js', 'wdp-state-js'),
            $js_module_version,
            true
        );

        wp_register_script(
            'wdp-cart-js',
            $plugin_url . 'assets/js/src/cart.js',
            array('wdp-utils-js', 'wdp-state-js'),
            $js_module_version,
            true
        );

        wp_register_script(
            'wdp-form-js',
            $plugin_url . 'assets/js/src/form.js',
            array('wdp-utils-js', 'wdp-state-js', 'wdp-alerts-js', 'wdp-cart-js'),
            $js_module_version,
            true
        );

        wp_register_script(
            'wdp-shareholder-js',
            $plugin_url . 'assets/js/src/shareholder.js',
            array('wdp-utils-js', 'wdp-state-js', 'wdp-dom-js', 'wdp-product-js', 'wdp-form-js'),
            $js_module_version,
            true
        );

        wp_register_script(
            'wdp-progress-bar-js',
            $plugin_url . 'assets/js/src/progress-bar.js',
            array('wdp-utils-js'),
            $js_module_version,
            true
        );

        wp_register_script(
            'wdp-modal-js',
            $plugin_url . 'assets/js/src/modal.js',
            array('wdp-utils-js', 'wdp-state-js', 'wdp-form-js', 'wdp-shareholder-js'),
            $js_module_version,
            true
        );

            wp_register_script(
                'wdp-form-initializer-js',
                $plugin_url . 'assets/js/src/form-initializer.js',
                array('wdp-utils-js', 'wdp-form-js', 'wdp-shareholder-js'),
                $js_module_version,
                true
            );

            wp_register_script(
                'wdp-event-manager-js',
                $plugin_url . 'assets/js/src/event-manager.js',
                array('wdp-utils-js', 'wdp-modal-js', 'wdp-form-js'),
                $js_module_version,
                true
            );

            wp_register_script(
                'wdp-module-loader-js',
                $plugin_url . 'assets/js/src/module-loader.js',
                array('wdp-utils-js'),
                $js_module_version,
                true
            );

            wp_register_script(
                'wdp-init-js',
                $plugin_url . 'assets/js/src/init.js',
                array('wdp-utils-js', 'wdp-state-js', 'wdp-dom-js', 'wdp-modal-js', 'wdp-form-js', 'wdp-shareholder-js', 'wdp-cart-js', 'wdp-form-initializer-js', 'wdp-event-manager-js', 'wdp-module-loader-js'),
                $js_module_version,
                true
            );

        wp_register_style(
            'wdp-donation-modal-css',
            $plugin_url . 'assets/css/donation-modal.css',
            array(),
            $css_version
        );

        // Get current currency (supports Currency switcher plugins)
        $current_currency = function_exists('get_woocommerce_currency') ? get_woocommerce_currency() : 'TRY';
        $currency_symbol = function_exists('get_woocommerce_currency_symbol') ? get_woocommerce_currency_symbol($current_currency) : '₺';
        
        wp_localize_script('wdp-utils-js', 'wdp_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'plugin_url' => $plugin_url,
            'nonces' => array(
                'ajax_add_to_cart' => wp_create_nonce('wdp_ajax_add_to_cart'),
                'get_product_info' => wp_create_nonce('wdp_get_product_info'),
                'get_product_name' => wp_create_nonce('wdp_get_product_name'),
                'get_cart_count' => wp_create_nonce('wdp_get_cart_count'),
                'get_cart_contents' => wp_create_nonce('wdp_get_cart_contents'),
                'render_button' => wp_create_nonce('wdp_render_donation_button'),
            ),
            'nonce' => wp_create_nonce('wdp_ajax_add_to_cart'),
            'checkout_url' => wc_get_checkout_url(),
            'cart_url' => wc_get_cart_url(),
            'version' => WDP_VERSION,
            'debug' => defined('WP_DEBUG') && WP_DEBUG,
            'jquery_loaded' => wp_script_is('jquery', 'enqueued'),
            'wc_loaded' => class_exists('WooCommerce'),
            'home_url' => home_url(),
            'site_url' => site_url(),
            'currency' => array(
                'code' => $current_currency,
                'symbol' => $currency_symbol,
            ),
                    'strings' => array(
                        'loading' => __('Yükleniyor...', 'woo-donation-popup'),
                        'error' => __('Bir hata oluştu', 'woo-donation-popup'),
                        'success' => __('Başarılı', 'woo-donation-popup'),
                        'required_field' => __('Bu alan zorunludur', 'woo-donation-popup'),
                        'invalid_price' => __('Geçersiz fiyat', 'woo-donation-popup'),
                        'min_price_error' => __('Minimum fiyat: ', 'woo-donation-popup'),
                        'max_shares_error' => __('Maksimum hisse sayısı: ', 'woo-donation-popup'),
                    ),
                    'button_texts' => self::get_button_texts(),
                    'shareholder_texts' => self::get_shareholder_texts(),
                ));

        // Önce force flag'i kontrol et
        $should_enqueue = self::$force_enqueue_assets;

        // Shortcode kontrolü - sayfa içeriğinde shortcode var mı?
        if (!$should_enqueue && is_a($post, 'WP_Post')) {
            if (has_shortcode($post->post_content, 'wdp_donation_button') || has_shortcode($post->post_content, 'wdp_donation_form')) {
                $should_enqueue = true;
            }
        }

        // Widget'lar ve diğer içerik alanları için kontrol
        if (!$should_enqueue) {
            // Sidebar widget'ları, footer, header vb. kontrol et
            if (is_active_widget(false, false, 'text', true)) {
                // Widget içeriğinde shortcode olabilir
                $widget_content = get_option('widget_text');
                if (is_array($widget_content)) {
                    foreach ($widget_content as $widget) {
                        if (isset($widget['text']) && (has_shortcode($widget['text'], 'wdp_donation_button') || has_shortcode($widget['text'], 'wdp_donation_form'))) {
                            $should_enqueue = true;
                            break;
                        }
                    }
                }
            }
        }

        // WooCommerce ürün sayfası kontrolü
        if (!$should_enqueue && function_exists('is_product') && is_product()) {
            $should_enqueue = true;
        }

        // Tüm sayfalarda yükle (kullanıcı deneyimi için)
        // Alternatif: Sadece shortcode varsa yükle (performans için)
        // Şimdilik her zaman yükleyelim çünkü shortcode dinamik olarak eklenebilir
        if (!$should_enqueue) {
            // Sayfa içeriğinde wdp-donate-button class'ı veya data-product-id attribute'u var mı?
            if (is_a($post, 'WP_Post')) {
                // Content içinde button veya form class'ları var mı?
                if (strpos($post->post_content, 'wdp-donate-button') !== false || 
                    strpos($post->post_content, 'wdp-donation-form') !== false ||
                    strpos($post->post_content, 'wdp-open-modal') !== false) {
                    $should_enqueue = true;
                }
            }
        }

        /**
         * Allow third-parties to force asset loading.
         */
        $should_enqueue = apply_filters('wdp_should_enqueue_assets', $should_enqueue, $post);

        // Force flag set edilmişse her zaman yükle
        if (self::$force_enqueue_assets) {
            $should_enqueue = true;
        }

        // KRİTİK: Eğer shortcode render edildiyse (force_enqueue çağrıldıysa), kesinlikle yükle
        // Ayrıca, her zaman yüklemeyi deneyelim (debug için)
        if ($should_enqueue || self::$force_enqueue_assets) {
            // enqueue_assets_now() metodunu kullan (aynı kod)
            self::enqueue_assets_now();
        }
    }
}

// Note: init() is called by Woo_Donation_Popup::__construct()


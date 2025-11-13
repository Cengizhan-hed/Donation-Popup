<?php
/**
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
            wp_register_script('wdp-init-js', $plugin_url . 'assets/js/src/init.js', array('wdp-utils-js', 'wdp-state-js', 'wdp-dom-js', 'wdp-modal-js', 'wdp-form-js', 'wdp-shareholder-js', 'wdp-cart-js'), $js_module_version, true);
            wp_register_style('wdp-donation-modal-css', $plugin_url . 'assets/css/donation-modal.css', array(), $css_version);
            
            // Localize script (sadece bir kez)
            if (!did_action('wp_localize_script_wdp-utils-js')) {
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
                    'strings' => array(
                        'loading' => __('Yükleniyor...', 'woo-donation-popup'),
                        'error' => __('Bir hata oluştu', 'woo-donation-popup'),
                        'success' => __('Başarılı', 'woo-donation-popup'),
                        'required_field' => __('Bu alan zorunludur', 'woo-donation-popup'),
                        'invalid_price' => __('Geçersiz fiyat', 'woo-donation-popup'),
                        'min_price_error' => __('Minimum fiyat: ', 'woo-donation-popup'),
                        'max_shares_error' => __('Maksimum hisse sayısı: ', 'woo-donation-popup'),
                    ),
                ));
            }
        }
        
        // Script'leri enqueue et (WordPress dependency sistemine güven)
        wp_enqueue_script('wdp-utils-js');
        wp_enqueue_script('wdp-state-js');
        wp_enqueue_script('wdp-dom-js');
        wp_enqueue_script('wdp-alerts-js');
        wp_enqueue_script('wdp-product-js');
        wp_enqueue_script('wdp-cart-js');
        wp_enqueue_script('wdp-form-js');
        wp_enqueue_script('wdp-shareholder-js');
        wp_enqueue_script('wdp-modal-js');
        wp_enqueue_script('wdp-init-js');
        
        // Style'ı enqueue et
        if (!wp_style_is('wdp-donation-modal-css', 'enqueued')) {
            wp_enqueue_style('wdp-donation-modal-css');
        }
        
        // Inline style ekle
        self::maybe_enqueue_inline_style();
    }

    /**
     * Get inline CSS for modal visibility
     *
     * @return string Inline CSS.
     */
    private static function get_inline_css() {
        return "
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
     * Attach inline CSS once per request.
     */
    private static function maybe_enqueue_inline_style() {
        if (self::$inline_style_attached) {
            return;
        }

        wp_add_inline_style('wdp-donation-modal-css', self::get_inline_css());
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

        // Cache asset versions to avoid repeated file operations
        static $css_version = null;
        static $js_module_version = null;

        // Asset versioning: filemtime kullan (cache busting için)
        $css_file = $plugin_dir . 'assets/css/donation-modal.css';
        
        // CSS versioning: Ana CSS dosyası ve tüm src dosyalarının en yeni modification time'ını kullan
        // Use transient cache for performance (5 minutes cache)
        $css_cache_key = 'wdp_css_version_' . md5($css_file);
        $cached_css_version = get_transient($css_cache_key);

        if (false === $cached_css_version) {
            $css_version = file_exists($css_file) ? filemtime($css_file) : WDP_ASSET_VERSION;
            
            // Tüm CSS src dosyalarını kontrol et ve en yeni modification time'ı bul
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

            // Cache for 5 minutes
            set_transient($css_cache_key, $css_version, 300);
        } else {
            $css_version = $cached_css_version;
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

        // JS modül versiyonları (CSS'teki gibi, tüm src dosyalarını kontrol et)
        // Use transient cache for performance (5 minutes cache)
        if (null === $js_module_version) {
            $cache_key = 'wdp_js_version_' . md5($plugin_dir . 'assets/js/src/');
            $cached_js_version = get_transient($cache_key);

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

                // Cache for 5 minutes
                set_transient($cache_key, $js_module_version, 300);
            } else {
                $js_module_version = $cached_js_version;
            }
        }

        // Modülleri WordPress'te sırayla kaydet (dependency order)
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
            'wdp-modal-js',
            $plugin_url . 'assets/js/src/modal.js',
            array('wdp-utils-js', 'wdp-state-js', 'wdp-form-js', 'wdp-shareholder-js'),
            $js_module_version,
            true
        );

        wp_register_script(
            'wdp-init-js',
            $plugin_url . 'assets/js/src/init.js',
            array('wdp-utils-js', 'wdp-state-js', 'wdp-dom-js', 'wdp-modal-js', 'wdp-form-js', 'wdp-shareholder-js', 'wdp-cart-js'),
            $js_module_version,
            true
        );

        wp_register_style(
            'wdp-donation-modal-css',
            $plugin_url . 'assets/css/donation-modal.css',
            array(),
            $css_version
        );

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
            'strings' => array(
                'loading' => __('Yükleniyor...', 'woo-donation-popup'),
                'error' => __('Bir hata oluştu', 'woo-donation-popup'),
                'success' => __('Başarılı', 'woo-donation-popup'),
                'required_field' => __('Bu alan zorunludur', 'woo-donation-popup'),
                'invalid_price' => __('Geçersiz fiyat', 'woo-donation-popup'),
                'min_price_error' => __('Minimum fiyat: ', 'woo-donation-popup'),
                'max_shares_error' => __('Maksimum hisse sayısı: ', 'woo-donation-popup'),
            ),
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


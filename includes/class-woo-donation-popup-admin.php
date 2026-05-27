<?php
/**
 * WooCommerce Donation Modal Popup Admin Class
 */
if (!defined('ABSPATH')) {
    exit;
}

class Woo_Donation_Popup_Admin {
    /**
     * Store settings in a non-autoload option to keep front bootstrap lean.
     *
     * @param string $option_name Option key.
     * @param mixed  $value       Option value.
     * @return bool
     */
    private function update_non_autoload_option($option_name, $value) {
        if (false === get_option($option_name, false)) {
            return add_option($option_name, $value, '', 'no');
        }

        return update_option($option_name, $value, false);
    }

    /**
     * Ön yüz CSS/JS query string ve object cache anahtarlarını tazelemek için (CDN / SG vb.).
     */
    private function bump_wdp_asset_cache_version() {
        update_option('wdp_cache_version', time());
        if (class_exists('WDP_Assets') && method_exists('WDP_Assets', 'purge_known_page_caches')) {
            WDP_Assets::purge_known_page_caches();
        }
    }

    /**
     * Constructor
     */
    public function __construct() {
        WDP_Admin_Hooks::register($this);
    }
    
    /**
     * Admin menüsüne "Popup Ayarları" sayfasını ekle
     */
    public function add_admin_menu() {
        add_submenu_page(
            'woocommerce', // WooCommerce menüsü altına ekle
            __('Bağış Popup Ayarları', 'woo-donation-popup'),
            __('Bağış Popup Ayarları', 'woo-donation-popup'),
            'manage_woocommerce', // WooCommerce yönetme yetkisi olan kullanıcılar görebilir
            'wdp-popup-settings',
            array($this, 'render_settings_page')
        );
    }
    
    /**
     * Admin sayfası için stil ve script dosyalarını ekle
     */
    public function enqueue_admin_assets($hook) {
        WDP_Admin_Assets::enqueue($hook);
    }

    /**
     * Ayarlar sayfasını render et
     */
    public function render_settings_page() {
        $products = $this->get_products();

        WDP_Admin_Page_Renderer::render_settings_page(
            $products,
            array($this, 'render_product_row'),
            function() { $this->render_modal_layout_customization_tab(); },
            function() { $this->render_normal_form_customization_tab(); },
            function() { $this->render_shareholder_form_customization_tab(); },
            function() { $this->render_progress_bar_customization_tab(); },
            function() { $this->render_success_screen_customization_tab(); },
            function() { $this->render_meta_tracking_tab(); },
            function() { $this->render_category_colors_tab(); }
        );
    }
    
    /**
     * Ürün satırını render et
     *
     * @param WC_Product $product Product.
     * @return void
     */
    public function render_product_row($product) {
        WDP_Admin_Product_Row_Renderer::render($product);
    }
    
    /**
     * Tüm ürünleri al
     */
    private function get_products() {
        $cache_key = 'wdp_admin_products_list';
        $cached_ids = get_transient($cache_key);
        if (is_array($cached_ids) && !empty($cached_ids)) {
            $cached_products = array();
            foreach ($cached_ids as $cached_id) {
                $product = wc_get_product((int) $cached_id);
                if ($product) {
                    $cached_products[] = $product;
                }
            }
            if (!empty($cached_products)) {
                return $cached_products;
            }
        }

        $args = array(
            'status' => 'publish',
            'limit' => -1,
            'orderby' => 'title',
            'order' => 'ASC',
            'return' => 'ids',
        );

        $product_ids = wc_get_products($args);
        if (!is_array($product_ids)) {
            return array();
        }

        set_transient($cache_key, $product_ids, MINUTE_IN_SECONDS);

        $products = array();
        foreach ($product_ids as $product_id) {
            $product = wc_get_product((int) $product_id);
            if ($product) {
                $products[] = $product;
            }
        }

        return $products;
    }
    
    /**
     * Ürün ayarlarını kaydet (AJAX)
     */
    public function save_product_settings() {
        WDP_Admin_Product_Settings_Ajax::save();
    }
    
    /**
     * Ürün ayarlarını al (AJAX)
     */
    public function get_product_settings() {
        WDP_Admin_Product_Settings_Ajax::get();
    }
    
    /**
     * Normal form özelleştirme tab'ını render et
     */
    private function render_normal_form_customization_tab() {
        WDP_Admin_Form_Tabs_Renderer::render_normal_form_tab();
    }
    
    /**
     * Hisseli form özelleştirme tab'ını render et
     */
    private function render_shareholder_form_customization_tab() {
        WDP_Admin_Form_Tabs_Renderer::render_shareholder_form_tab();
    }
    
    /**
     * Başarı ekranı özelleştirme tab'ını render et
     */
    private function render_success_screen_customization_tab() {
        WDP_Admin_Form_Tabs_Renderer::render_success_screen_tab();
    }

    /**
     * Progress bar özelleştirme tab'ını render et
     */
    private function render_progress_bar_customization_tab() {
        WDP_Admin_Layout_Tabs_Renderer::render_progress_bar_tab();
    }

    /**
     * Meta Pixel companion tab.
     *
     * @return void
     */
    private function render_meta_tracking_tab() {
        WDP_Admin_Meta_Tracking_Tab_Renderer::render();
    }
    
    /**
     * Normal form özelleştirme ayarlarını kaydet (AJAX)
     */
    public function save_normal_form_settings() {
        $this->guard_admin_settings_ajax();
        $request_data = $this->get_admin_request_data();
        
        $settings = WDP_Admin_Settings_Normalizer::normalize_normal_form_settings($request_data);
        
        // Ayarları kaydet
        $this->update_non_autoload_option('wdp_button_settings', $settings);
        $this->bump_wdp_asset_cache_version();
        
        // Başarılı yanıt döndür
        $this->send_admin_settings_success(__('Normal form ayarları başarıyla kaydedildi.', 'woo-donation-popup'));
    }
    
    /**
     * Hisseli form özelleştirme ayarlarını kaydet (AJAX)
     */
    public function save_shareholder_form_settings() {
        $this->guard_admin_settings_ajax();
        $request_data = $this->get_admin_request_data();
        
        $settings = WDP_Admin_Settings_Normalizer::normalize_shareholder_settings($request_data);
        
        // Ayarları kaydet
        $this->update_non_autoload_option('wdp_shareholder_settings', $settings);
        $this->bump_wdp_asset_cache_version();
        
        // Başarılı yanıt döndür
        $this->send_admin_settings_success(__('Hisseli form ayarları başarıyla kaydedildi.', 'woo-donation-popup'));
    }
    
    /**
     * Başarı ekranı özelleştirme ayarlarını kaydet (AJAX)
     */
    public function save_success_screen_settings() {
        $this->guard_admin_settings_ajax();
        $request_data = $this->get_admin_request_data();
        
        $settings = WDP_Admin_Settings_Normalizer::normalize_success_screen_settings($request_data);
        
        // Ayarları kaydet
        $this->update_non_autoload_option('wdp_success_settings', $settings);
        $this->bump_wdp_asset_cache_version();
        
        // Başarılı yanıt döndür
        $this->send_admin_settings_success(__('Başarı ekranı ayarları başarıyla kaydedildi.', 'woo-donation-popup'));
    }

    /**
     * Progress bar özelleştirme ayarlarını kaydet (AJAX)
     */
    public function save_progress_bar_settings() {
        $this->guard_admin_settings_ajax();
        $request_data = $this->get_admin_request_data();

        $settings = WDP_Admin_Settings_Normalizer::normalize_progress_bar_settings($request_data);

        $this->update_non_autoload_option('wdp_progress_bar_settings', $settings);
        $this->bump_wdp_asset_cache_version();

        $this->send_admin_settings_success(__('Progress bar ayarları başarıyla kaydedildi.', 'woo-donation-popup'));
    }

    /**
     * Meta Pixel companion ayarlarını kaydet (AJAX).
     *
     * @return void
     */
    public function save_meta_tracking_settings() {
        try {
            $this->guard_admin_settings_ajax();
            $request_data = $this->get_admin_request_data();

            $settings = WDP_Admin_Settings_Normalizer::normalize_meta_tracking_settings($request_data);

            if (! class_exists('WDP_Meta_Tracking')) {
                $this->send_admin_settings_error(__('Meta izleme modülü yüklenemedi.', 'woo-donation-popup'));
                return;
            }

            WDP_Meta_Tracking::update_settings($settings);
            $this->bump_wdp_asset_cache_version();

            $this->send_admin_settings_success(__('Meta Pixel ayarları başarıyla kaydedildi.', 'woo-donation-popup'));
        } catch (Exception $e) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log('WDP meta tracking save error: ' . $e->getMessage());
            }
            $this->send_admin_settings_error(__('Bir hata oluştu. Lütfen tekrar deneyin.', 'woo-donation-popup'));
        }
    }
    
    /**
     * Modal görünüm ayarları tab'ını render et
     */
    private function render_modal_layout_customization_tab() {
        WDP_Admin_Layout_Tabs_Renderer::render_modal_layout_tab();
    }

    /**
     * Kategori başlık renkleri sekmesi.
     *
     * @return void
     */
    private function render_category_colors_tab() {
        WDP_Admin_Category_Colors_Tab_Renderer::render_tab();
    }

    /**
     * Kategori başlık renklerini kaydet (AJAX).
     *
     * @return void
     */
    public function save_category_colors_settings() {
        try {
            $this->guard_admin_settings_ajax();
            $request_data = $this->get_admin_request_data();

            $colors = WDP_Category_Title_Color_Service::normalize_from_request($request_data);
            $saved = $this->update_non_autoload_option(WDP_Category_Title_Color_Service::OPTION_KEY, $colors);

            if ($saved === false) {
                $this->send_admin_settings_error(__('Ayarlar kaydedilirken bir hata oluştu.', 'woo-donation-popup'));
            }

            $this->bump_wdp_asset_cache_version();
            $this->send_admin_settings_success(__('Kategori renkleri kaydedildi.', 'woo-donation-popup'));
        } catch (Exception $e) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log('WDP category colors save error: ' . $e->getMessage());
            }
            $this->send_admin_settings_error(__('Bir hata oluştu. Lütfen tekrar deneyin.', 'woo-donation-popup'));
        }
    }
    
    /**
     * Modal görünüm ayarlarını kaydet (AJAX)
     */
    public function save_modal_layout_settings() {
        try {
            $this->guard_admin_settings_ajax();
            $request_data = $this->get_admin_request_data();
            
            $settings = WDP_Admin_Settings_Normalizer::normalize_modal_layout_settings($request_data);
        
            // Ayarları kaydet
            $saved = $this->update_non_autoload_option('wdp_modal_layout_settings', $settings);
            
            if ($saved === false) {
                $this->send_admin_settings_error(__('Ayarlar kaydedilirken bir hata oluştu.', 'woo-donation-popup'));
            }

            $this->bump_wdp_asset_cache_version();
            
            // Başarılı yanıt döndür
            $this->send_admin_settings_success(__('Modal görünüm ayarları başarıyla kaydedildi.', 'woo-donation-popup'));
            
        } catch (Exception $e) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log('WDP modal layout save error: ' . $e->getMessage());
            }
            $this->send_admin_settings_error(__('Bir hata oluştu. Lütfen tekrar deneyin.', 'woo-donation-popup'));
        }
    }

    /**
     * Guard admin settings AJAX requests.
     *
     * @return void
     */
    private function guard_admin_settings_ajax() {
        check_ajax_referer('wdp_admin_nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            $this->send_admin_settings_error(__('Bu işlem için yetkiniz yok.', 'woo-donation-popup'));
        }
    }

    /**
     * Send standard admin settings success response.
     *
     * @param string $message Success message.
     * @return void
     */
    private function send_admin_settings_success($message) {
        wp_send_json_success(array('message' => $message));
        wp_die();
    }

    /**
     * Send standard admin settings error response.
     *
     * @param string $message Error message.
     * @return void
     */
    private function send_admin_settings_error($message) {
        wp_send_json_error(array('message' => $message));
        wp_die();
    }

    /**
     * Return unslashed request data for admin AJAX save handlers.
     *
     * @return array
     */
    private function get_admin_request_data() {
        if (!isset($_POST) || !is_array($_POST)) {
            return array();
        }

        return wp_unslash($_POST);
    }
}

<?php
/**
 * WooCommerce Donation Modal Popup Admin Class
 */
class Woo_Donation_Popup_Admin {

    /**
     * Constructor
     */
    public function __construct() {
        // Admin menüsüne "Popup Ayarları" sayfasını ekle
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Admin sayfası için stil ve script dosyalarını ekle
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'));
        
        // Ayarları kaydetmek için AJAX işleyicisi
        add_action('wp_ajax_wdp_save_product_settings', array($this, 'save_product_settings'));
        
        // Ürün ayarlarını almak için AJAX işleyicisi
        add_action('wp_ajax_wdp_get_product_settings', array($this, 'get_product_settings'));
        
        // Normal form özelleştirme ayarlarını kaydetmek için AJAX işleyicisi
        add_action('wp_ajax_wdp_save_normal_form_settings', array($this, 'save_normal_form_settings'));
        
        // Hisseli form özelleştirme ayarlarını kaydetmek için AJAX işleyicisi
        add_action('wp_ajax_wdp_save_shareholder_form_settings', array($this, 'save_shareholder_form_settings'));
        
        // Başarı ekranı özelleştirme ayarlarını kaydetmek için AJAX işleyicisi
        add_action('wp_ajax_wdp_save_success_screen_settings', array($this, 'save_success_screen_settings'));
        
        // Modal görünüm ayarlarını kaydetmek için AJAX işleyicisi
        add_action('wp_ajax_wdp_save_modal_layout_settings', array($this, 'save_modal_layout_settings'));

        // Progress bar görünüm ayarlarını kaydetmek için AJAX işleyicisi
        add_action('wp_ajax_wdp_save_progress_bar_settings', array($this, 'save_progress_bar_settings'));
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
        // Sadece bizim sayfamızda yükle
        if ($hook != 'woocommerce_page_wdp-popup-settings') {
            return;
        }
        
        // Admin stil dosyasını yükle
        wp_enqueue_style(
            'wdp-admin-css',
            WDP_PLUGIN_URL . 'assets/css/admin-style.css',
            array(),
            WDP_VERSION
        );
        
        // Admin script dosyasını yükle
        wp_enqueue_script(
            'wdp-admin-js',
            WDP_PLUGIN_URL . 'assets/js/admin-script.js',
            array('jquery'),
            WDP_VERSION,
            true
        );
        
        // AJAX URL ve nonce değerlerini JS'e aktar
        wp_localize_script(
            'wdp-admin-js',
            'wdp_admin',
            array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('wdp_admin_nonce'),
                'save_success' => __('Ayarlar başarıyla kaydedildi.', 'woo-donation-popup'),
                'save_error' => __('Ayarlar kaydedilirken bir hata oluştu.', 'woo-donation-popup')
            )
        );
    }
    
    /**
     * Ayarlar sayfasını render et
     */
    public function render_settings_page() {
        // Ürünleri al
        $products = $this->get_products();
        
        // Sayfa başlığı ve açıklama
        echo '<div class="wrap">';
        echo '<h1>' . __('Bağış Popup Ayarları', 'woo-donation-popup') . '</h1>';
        echo '<p>' . __('Bu sayfadan bağış popup\'ları için ürün ayarlarını ve buton özelleştirmelerini yönetebilirsiniz.', 'woo-donation-popup') . '</p>';
        
        // Başarı/hata mesajları için alan
        echo '<div id="wdp-admin-notices" class="notice" style="display:none;"></div>';
        
        // Tab navigasyonu - mantıksal gruplama ile yeniden sıralandı
        echo '<nav class="nav-tab-wrapper">';
        // 1) Ürün bazlı fonksiyonellik
        echo '<a href="#wdp-products-tab" class="nav-tab nav-tab-active" data-tab="products">' . __('Ürün Ayarları', 'woo-donation-popup') . '</a>';
        // 2) Global görünüm / layout
        echo '<a href="#wdp-modal-layout-tab" class="nav-tab" data-tab="modal-layout">' . __('Modal & Form Görünümü', 'woo-donation-popup') . '</a>';
        // 3) Form tipleri
        echo '<a href="#wdp-normal-form-tab" class="nav-tab" data-tab="normal-form">' . __('Normal Form', 'woo-donation-popup') . '</a>';
        echo '<a href="#wdp-shareholder-form-tab" class="nav-tab" data-tab="shareholder-form">' . __('Hisseli Form', 'woo-donation-popup') . '</a>';
        echo '<a href="#wdp-progress-bar-tab" class="nav-tab" data-tab="progress-bar">' . __('Progress Bar Form', 'woo-donation-popup') . '</a>';
        // 4) İşlem sonrası ekran
        echo '<a href="#wdp-success-screen-tab" class="nav-tab" data-tab="success-screen">' . __('Başarı & Mini Sepet', 'woo-donation-popup') . '</a>';
        echo '</nav>';
        
        // Ürün Ayarları Tab - kompakt, kart tabanlı modern görünüm
        echo '<div id="wdp-products-tab" class="wdp-tab-content wdp-tab-active">';
        echo '<div class="wdp-settings-container">';
        // Ürün arama alanı
        echo '<div class="wdp-products-toolbar">';
        echo '<div class="wdp-products-search">';
        echo '<span class="dashicons dashicons-search" aria-hidden="true"></span>';
        echo '<input type="search" id="wdp-product-search" placeholder="' . esc_attr__('Ürün ara...', 'woo-donation-popup') . '" />';
        echo '</div>';
        echo '</div>';

        // Ürün kartları grid'i
        echo '<div class="wdp-products-grid">';

        if (empty($products)) {
            echo '<div class="wdp-products-empty">';
            echo '<p>' . __('Hiç ürün bulunamadı.', 'woo-donation-popup') . '</p>';
            echo '</div>';
        } else {
            foreach ($products as $product) {
                $this->render_product_row($product);
            }
        }

        echo '</div>'; // .wdp-products-grid

        // Toplu güncelleme butonu
        echo '<div class="wdp-bulk-actions">';
        echo '<button id="wdp-save-all" class="button button-primary">' . __('Tüm Değişiklikleri Kaydet', 'woo-donation-popup') . '</button>';
        echo '<span class="spinner"></span>';
        echo '</div>';

        echo '</div>'; // .wdp-settings-container
        echo '</div>'; // #wdp-products-tab
        
        // Normal Form Özelleştirme Tab
        echo '<div id="wdp-normal-form-tab" class="wdp-tab-content">';
        $this->render_normal_form_customization_tab();
        echo '</div>'; // #wdp-normal-form-tab
        
        // Hisseli Form Özelleştirme Tab
        echo '<div id="wdp-shareholder-form-tab" class="wdp-tab-content">';
        $this->render_shareholder_form_customization_tab();
        echo '</div>'; // #wdp-shareholder-form-tab
        
        // Başarı Ekranı Özelleştirme Tab
        echo '<div id="wdp-success-screen-tab" class="wdp-tab-content">';
        $this->render_success_screen_customization_tab();
        echo '</div>'; // #wdp-success-screen-tab
        
        // Modal Görünüm Ayarları Tab
        echo '<div id="wdp-modal-layout-tab" class="wdp-tab-content">';
        $this->render_modal_layout_customization_tab();
        echo '</div>'; // #wdp-modal-layout-tab

        // Progress Bar Özelleştirme Tab
        echo '<div id="wdp-progress-bar-tab" class="wdp-tab-content">';
        $this->render_progress_bar_customization_tab();
        echo '</div>'; // #wdp-progress-bar-tab
        
        echo '</div>'; // .wrap
    }
    
    /**
     * Ürün satırını render et
     */
    public function render_product_row($product) {
        // Ürün ayarlarını al
        $allow_custom_price = get_post_meta($product->get_id(), '_allow_custom_price', true) === 'yes';
        $min_custom_price = get_post_meta($product->get_id(), '_min_custom_price', true);
        $allow_multiple_shares = get_post_meta($product->get_id(), '_allow_multiple_shares', true) === 'yes';
        $max_shares = get_post_meta($product->get_id(), '_max_shares', true);
        $enable_progress_bar = get_post_meta($product->get_id(), '_enable_progress_bar', true) === 'yes';
        $progress_bar_limit = get_post_meta($product->get_id(), '_progress_bar_limit', true);
        
        // Varsayılan değerler
        if ($min_custom_price === '') {
            $min_custom_price = '0';
        }
        
        if ($max_shares === '') {
            $max_shares = '7';
        }
        
        if ($progress_bar_limit === '') {
            $progress_bar_limit = '100000';
        }
        
        // Shortcode'lar
        $button_shortcode = '[wdp_donation_button id="' . $product->get_id() . '"]';
        $form_shortcode = '[wdp_donation_form id="' . $product->get_id() . '"]';

        // Grid/kart tabanlı ürün bloğu
        echo '<div class="wdp-product-card" data-product-id="' . $product->get_id() . '">';

        // Üst kısım: Ürün adı
        echo '<div class="wdp-product-main">';
        echo '<div class="wdp-product-title">';
        echo '<a href="' . get_edit_post_link($product->get_id()) . '" target="_blank">' . $product->get_name() . '</a>';
        echo '</div>';
        echo '<input type="hidden" name="product_id" value="' . $product->get_id() . '">';
        echo '</div>'; // .wdp-product-main

        // Orta kısım: ayar grid'i (her kolon altında ilgili alt ayar)
        echo '<div class="wdp-product-settings-grid">';

        // Çoklu hisse + Maks. hisse
        echo '<div class="wdp-field-group">';
        echo '<div class="wdp-field wdp-field-toggle">';
        echo '<div class="wdp-field-label">' . __('Çoklu Hisse', 'woo-donation-popup') . '</div>';
        echo '<div class="wdp-field-control">';
        echo '<label class="wdp-switch">';
        echo '<input type="checkbox" name="allow_multiple_shares" ' . checked($allow_multiple_shares, true, false) . '>';
        echo '<span class="wdp-slider"></span>';
        echo '</label>';
        echo '</div>';
        echo '</div>';
        echo '<div class="wdp-sub-field">';
        echo '<div class="wdp-sub-field-label">' . __('Maks. Hisse', 'woo-donation-popup') . '</div>';
        echo '<div class="wdp-field-control">';
        echo '<input type="number" name="max_shares" value="' . esc_attr($max_shares) . '" min="1" max="20" class="small-text">';
        echo '</div>';
        echo '</div>';
        echo '</div>';

        // Özel fiyat + Min. fiyat
        echo '<div class="wdp-field-group">';
        echo '<div class="wdp-field wdp-field-toggle">';
        echo '<div class="wdp-field-label">' . __('Özel Fiyat', 'woo-donation-popup') . '</div>';
        echo '<div class="wdp-field-control">';
        echo '<label class="wdp-switch">';
        echo '<input type="checkbox" name="allow_custom_price" ' . checked($allow_custom_price, true, false) . '>';
        echo '<span class="wdp-slider"></span>';
        echo '</label>';
        echo '</div>';
        echo '</div>';
        echo '<div class="wdp-sub-field">';
        echo '<div class="wdp-sub-field-label">' . __('Min. Fiyat (₺)', 'woo-donation-popup') . '</div>';
        echo '<div class="wdp-field-control">';
        echo '<input type="number" name="min_custom_price" value="' . esc_attr($min_custom_price) . '" min="0" step="1" class="small-text">';
        echo '</div>';
        echo '</div>';
        echo '</div>';

        // Progress Bar + Üst Limit
        echo '<div class="wdp-field-group">';
        echo '<div class="wdp-field wdp-field-toggle">';
        echo '<div class="wdp-field-label">' . __('Progress Bar', 'woo-donation-popup') . '</div>';
        echo '<div class="wdp-field-control">';
        echo '<label class="wdp-switch">';
        echo '<input type="checkbox" name="enable_progress_bar" ' . checked($enable_progress_bar, true, false) . '>';
        echo '<span class="wdp-slider"></span>';
        echo '</label>';
        echo '</div>';
        echo '</div>';
        echo '<div class="wdp-sub-field">';
        echo '<div class="wdp-sub-field-label">' . __('Üst Limit (₺)', 'woo-donation-popup') . '</div>';
        echo '<div class="wdp-field-control">';
        echo '<input type="number" name="progress_bar_limit" value="' . esc_attr($progress_bar_limit) . '" min="0" step="1" class="small-text">';
        echo '</div>';
        echo '</div>';
        echo '</div>';

        echo '</div>'; // .wdp-product-settings-grid

        // Shortcode alanı
        echo '<div class="wdp-product-shortcodes">';
        echo '<div class="wdp-shortcodes">';

        // Buton Shortcode
        echo '<div class="wdp-shortcode-item">';
        echo '<label class="wdp-shortcode-label">Buton</label>';
        echo '<code class="wdp-shortcode">' . $button_shortcode . '</code>';
        echo '<button type="button" class="button button-small wdp-copy-shortcode" data-shortcode="' . esc_attr($button_shortcode) . '">' . __('Kopyala', 'woo-donation-popup') . '</button>';
        echo '</div>';

        // Form Shortcode
        echo '<div class="wdp-shortcode-item">';
        echo '<label class="wdp-shortcode-label">Form</label>';
        echo '<code class="wdp-shortcode">' . $form_shortcode . '</code>';
        echo '<button type="button" class="button button-small wdp-copy-shortcode" data-shortcode="' . esc_attr($form_shortcode) . '">' . __('Kopyala', 'woo-donation-popup') . '</button>';
        echo '</div>';

        echo '</div>'; // .wdp-shortcodes
        echo '</div>'; // .wdp-product-shortcodes

        // Alt kısım: işlem butonu
        echo '<div class="wdp-product-actions">';
        echo '<button type="button" class="button wdp-save-product" data-product-id="' . $product->get_id() . '">' . __('Kaydet', 'woo-donation-popup') . '</button>';
        echo '<span class="spinner"></span>';
        echo '</div>'; // .wdp-product-actions

        echo '</div>'; // .wdp-product-card
    }
    
    /**
     * Tüm ürünleri al
     */
    private function get_products() {
        $args = array(
            'status' => 'publish',
            'limit' => -1,
            'orderby' => 'title',
            'order' => 'ASC',
        );
        
        return wc_get_products($args);
    }
    
    /**
     * Ürün ayarlarını kaydet (AJAX)
     */
    public function save_product_settings() {
        // Güvenlik kontrolü
        check_ajax_referer('wdp_admin_nonce', 'nonce');
        
        // Yetki kontrolü
        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Bu işlem için yetkiniz yok.', 'woo-donation-popup')));
            wp_die();
        }
        
        // Ürün ID'sini al
        $product_id = isset($_POST['product_id']) ? absint($_POST['product_id']) : 0;
        
        if (!$product_id) {
            wp_send_json_error(array('message' => __('Geçersiz ürün ID.', 'woo-donation-popup')));
            wp_die();
        }
        
        // Ürünün varlığını kontrol et
        $product = wc_get_product($product_id);
        
        if (!$product) {
            wp_send_json_error(array('message' => __('Ürün bulunamadı.', 'woo-donation-popup')));
            wp_die();
        }
        
        // Ayarları al
        $allow_custom_price = isset($_POST['allow_custom_price']) && $_POST['allow_custom_price'] === 'true' ? 'yes' : 'no';
        $min_custom_price = isset($_POST['min_custom_price']) ? wc_format_decimal($_POST['min_custom_price']) : '';
        $allow_multiple_shares = isset($_POST['allow_multiple_shares']) && $_POST['allow_multiple_shares'] === 'true' ? 'yes' : 'no';
        $max_shares = isset($_POST['max_shares']) ? absint($_POST['max_shares']) : '';
        $enable_progress_bar = isset($_POST['enable_progress_bar']) && $_POST['enable_progress_bar'] === 'true' ? 'yes' : 'no';
        $progress_bar_limit = isset($_POST['progress_bar_limit']) ? wc_format_decimal($_POST['progress_bar_limit']) : '';
        
        // Ayarları kaydet
        update_post_meta($product_id, '_allow_custom_price', $allow_custom_price);
        update_post_meta($product_id, '_min_custom_price', $min_custom_price);
        update_post_meta($product_id, '_allow_multiple_shares', $allow_multiple_shares);
        update_post_meta($product_id, '_max_shares', $max_shares);
        update_post_meta($product_id, '_enable_progress_bar', $enable_progress_bar);
        update_post_meta($product_id, '_progress_bar_limit', $progress_bar_limit);
        
        // Başarılı yanıt döndür
        wp_send_json_success(array(
            'message' => sprintf(__('"%s" ürünü için ayarlar başarıyla kaydedildi.', 'woo-donation-popup'), $product->get_name())
        ));
        
        wp_die();
    }
    
    /**
     * Ürün ayarlarını al (AJAX)
     */
    public function get_product_settings() {
        // Güvenlik kontrolü
        check_ajax_referer('wdp_admin_nonce', 'nonce');
        
        // Yetki kontrolü
        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Bu işlem için yetkiniz yok.', 'woo-donation-popup')));
            wp_die();
        }
        
        // Ürün ID'sini al
        $product_id = isset($_POST['product_id']) ? absint($_POST['product_id']) : 0;
        
        if (!$product_id) {
            wp_send_json_error(array('message' => __('Geçersiz ürün ID.', 'woo-donation-popup')));
            wp_die();
        }
        
        // Ürünün varlığını kontrol et
        $product = wc_get_product($product_id);
        
        if (!$product) {
            wp_send_json_error(array('message' => __('Ürün bulunamadı.', 'woo-donation-popup')));
            wp_die();
        }
        
        // Ayarları al
        $allow_custom_price = get_post_meta($product_id, '_allow_custom_price', true) === 'yes';
        $min_custom_price = get_post_meta($product_id, '_min_custom_price', true);
        $allow_multiple_shares = get_post_meta($product_id, '_allow_multiple_shares', true) === 'yes';
        $max_shares = get_post_meta($product_id, '_max_shares', true);
        $enable_progress_bar = get_post_meta($product_id, '_enable_progress_bar', true) === 'yes';
        $progress_bar_limit = get_post_meta($product_id, '_progress_bar_limit', true);
        
        // Varsayılan değerler
        if ($min_custom_price === '') {
            $min_custom_price = '0';
        }
        
        if ($max_shares === '') {
            $max_shares = '7';
        }
        
        if ($progress_bar_limit === '') {
            $progress_bar_limit = '100000';
        }
        
        // Başarılı yanıt döndür
        wp_send_json_success(array(
            'allow_custom_price' => $allow_custom_price,
            'min_custom_price' => $min_custom_price,
            'allow_multiple_shares' => $allow_multiple_shares,
            'max_shares' => $max_shares,
            'enable_progress_bar' => $enable_progress_bar,
            'progress_bar_limit' => $progress_bar_limit
        ));
        
        wp_die();
    }
    
    /**
     * Normal form özelleştirme tab'ını render et
     */
    private function render_normal_form_customization_tab() {
        // Mevcut ayarları al
        $button_settings = get_option('wdp_button_settings', array());
        
        // Varsayılan değerler
        $defaults = array(
            'button_primary_color' => '#1e73be',
            'button_primary_hover' => '#185d98',
            'button_border_radius' => '10',
            'button_text_add_to_cart' => 'Sepete Ekle',
            'button_text_go_checkout' => 'Ödemeye Git',
            'button_text_donate' => 'Bağış Yap',
            'popup_button_text' => 'Bağış Yap',
            'popup_button_color' => '#1e73be',
            'popup_button_hover' => '#185d98',
            'popup_button_font_size' => '18',
            'popup_button_font_weight' => '700',
            'popup_button_font_family' => 'inherit',
            'popup_button_custom_font' => '',
            'popup_button_border_radius' => '10',
        );
        
        $settings = wp_parse_args($button_settings, $defaults);
        
        echo '<div class="wdp-button-settings-container">';
        echo '<form id="wdp-normal-form-settings-form">';
        
        // Popup Butonu
        echo '<h2>' . __('Popup Butonu', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="popup_button_text">' . __('Buton Metni', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $popup_button_text = isset($settings['popup_button_text']) ? $settings['popup_button_text'] : 'Bağış Yap';
        echo '<input type="text" id="popup_button_text" name="popup_button_text" value="' . esc_attr($popup_button_text) . '" class="regular-text" />';
        echo '<p class="description">' . __('Shortcode ile kopyalanan popup açan butonun metni', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="popup_button_color">' . __('Buton Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $popup_button_color = isset($settings['popup_button_color']) ? $settings['popup_button_color'] : '#1e73be';
        echo '<input type="color" id="popup_button_color" name="popup_button_color" value="' . esc_attr($popup_button_color) . '" />';
        echo '<p class="description">' . __('Popup açan butonun ana rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="popup_button_hover">' . __('Buton Hover Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $popup_button_hover = isset($settings['popup_button_hover']) ? $settings['popup_button_hover'] : '#185d98';
        echo '<input type="color" id="popup_button_hover" name="popup_button_hover" value="' . esc_attr($popup_button_hover) . '" />';
        echo '<p class="description">' . __('Popup açan butonun hover rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="popup_button_font_size">' . __('Font Boyutu (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $popup_button_font_size = isset($settings['popup_button_font_size']) ? $settings['popup_button_font_size'] : '18';
        echo '<input type="number" id="popup_button_font_size" name="popup_button_font_size" value="' . esc_attr($popup_button_font_size) . '" min="12" max="32" step="1" class="small-text" />';
        echo '<p class="description">' . __('Popup butonunun font boyutu (12-32px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="popup_button_font_weight">' . __('Font Kalınlığı', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $popup_button_font_weight = isset($settings['popup_button_font_weight']) ? $settings['popup_button_font_weight'] : '700';
        echo '<select id="popup_button_font_weight" name="popup_button_font_weight">';
        echo '<option value="400" ' . selected($popup_button_font_weight, '400', false) . '>Normal (400)</option>';
        echo '<option value="500" ' . selected($popup_button_font_weight, '500', false) . '>Orta (500)</option>';
        echo '<option value="600" ' . selected($popup_button_font_weight, '600', false) . '>Yarı Kalın (600)</option>';
        echo '<option value="700" ' . selected($popup_button_font_weight, '700', false) . '>Kalın (700)</option>';
        echo '<option value="800" ' . selected($popup_button_font_weight, '800', false) . '>Çok Kalın (800)</option>';
        echo '</select>';
        echo '<p class="description">' . __('Popup butonunun font kalınlığı', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="popup_button_font_family">' . __('Font Tipi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $popup_button_font_family = isset($settings['popup_button_font_family']) ? $settings['popup_button_font_family'] : 'inherit';
        $popup_button_custom_font = isset($settings['popup_button_custom_font']) ? $settings['popup_button_custom_font'] : '';
        
        // Eğer özel font varsa, font_family'yi "custom" yap
        if (!empty($popup_button_custom_font) && $popup_button_font_family !== 'custom') {
            $popup_button_font_family = 'custom';
        }
        
        echo '<select id="popup_button_font_family" name="popup_button_font_family">';
        echo '<option value="inherit" ' . selected($popup_button_font_family, 'inherit', false) . '>Tema Varsayılanı</option>';
        echo '<option value="Arial" ' . selected($popup_button_font_family, 'Arial', false) . '>Arial</option>';
        echo '<option value="Helvetica" ' . selected($popup_button_font_family, 'Helvetica', false) . '>Helvetica</option>';
        echo '<option value="Georgia" ' . selected($popup_button_font_family, 'Georgia', false) . '>Georgia</option>';
        echo '<option value="Times New Roman" ' . selected($popup_button_font_family, 'Times New Roman', false) . '>Times New Roman</option>';
        echo '<option value="Courier New" ' . selected($popup_button_font_family, 'Courier New', false) . '>Courier New</option>';
        echo '<option value="Verdana" ' . selected($popup_button_font_family, 'Verdana', false) . '>Verdana</option>';
        echo '<option value="Tahoma" ' . selected($popup_button_font_family, 'Tahoma', false) . '>Tahoma</option>';
        echo '<option value="Trebuchet MS" ' . selected($popup_button_font_family, 'Trebuchet MS', false) . '>Trebuchet MS</option>';
        echo '<option value="Impact" ' . selected($popup_button_font_family, 'Impact', false) . '>Impact</option>';
        echo '<option value="Comic Sans MS" ' . selected($popup_button_font_family, 'Comic Sans MS', false) . '>Comic Sans MS</option>';
        echo '<option value="Roboto" ' . selected($popup_button_font_family, 'Roboto', false) . '>Roboto</option>';
        echo '<option value="Open Sans" ' . selected($popup_button_font_family, 'Open Sans', false) . '>Open Sans</option>';
        echo '<option value="Lato" ' . selected($popup_button_font_family, 'Lato', false) . '>Lato</option>';
        echo '<option value="Montserrat" ' . selected($popup_button_font_family, 'Montserrat', false) . '>Montserrat</option>';
        echo '<option value="Poppins" ' . selected($popup_button_font_family, 'Poppins', false) . '>Poppins</option>';
        echo '<option value="custom" ' . selected($popup_button_font_family, 'custom', false) . '>Özel Font</option>';
        echo '</select>';
        echo '<p class="description">' . __('Popup butonunun font tipi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr id="popup_button_custom_font_row" style="' . ($popup_button_font_family === 'custom' ? '' : 'display:none;') . '">';
        echo '<th scope="row"><label for="popup_button_custom_font">' . __('Özel Font Adı', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="text" id="popup_button_custom_font" name="popup_button_custom_font" value="' . esc_attr($popup_button_custom_font) . '" class="regular-text" placeholder="Örn: \'Inter\', sans-serif" />';
        echo '<p class="description">' . __('Özel font adını girin (CSS font-family formatında, örn: \'Inter\', sans-serif)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="popup_button_border_radius">' . __('Border Radius (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $popup_button_border_radius = isset($settings['popup_button_border_radius']) ? $settings['popup_button_border_radius'] : '10';
        echo '<input type="number" id="popup_button_border_radius" name="popup_button_border_radius" value="' . esc_attr($popup_button_border_radius) . '" min="0" max="50" step="1" class="small-text" />';
        echo '<p class="description">' . __('Popup butonunun köşe yuvarlaklığı (0-50px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Buton Renkleri
        echo '<h2>' . __('Buton Renkleri', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="button_primary_color">' . __('Birincil Buton Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="button_primary_color" name="button_primary_color" value="' . esc_attr($settings['button_primary_color']) . '" />';
        echo '<p class="description">' . __('Form içindeki butonların ana rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="button_primary_hover">' . __('Buton Hover Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="button_primary_hover" name="button_primary_hover" value="' . esc_attr($settings['button_primary_hover']) . '" />';
        echo '<p class="description">' . __('Butonların üzerine gelindiğinde görünecek renk', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="button_checkout_color">' . __('Ödeme Yap Butonu Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $checkout_color = isset($settings['button_checkout_color']) ? $settings['button_checkout_color'] : '#48bb78';
        echo '<input type="color" id="button_checkout_color" name="button_checkout_color" value="' . esc_attr($checkout_color) . '" />';
        echo '<p class="description">' . __('"Ödeme Yap" butonunun rengi (yeşil buton)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="button_checkout_hover">' . __('Ödeme Yap Butonu Hover Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $checkout_hover = isset($settings['button_checkout_hover']) ? $settings['button_checkout_hover'] : '#38a169';
        echo '<input type="color" id="button_checkout_hover" name="button_checkout_hover" value="' . esc_attr($checkout_hover) . '" />';
        echo '<p class="description">' . __('"Ödeme Yap" butonunun hover rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Buton Border Radius
        echo '<h2>' . __('Buton Border Radius', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="button_border_radius">' . __('Border Radius (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="button_border_radius" name="button_border_radius" value="' . esc_attr($settings['button_border_radius']) . '" min="0" max="50" step="1" class="small-text" />';
        echo '<p class="description">' . __('Butonların köşe yuvarlaklığı (0-50px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';

        // Form Buton Düzeni
        echo '<h2>' . __('Form Buton Düzeni', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';

        // Sıra
        echo '<tr>';
        echo '<th scope="row"><label for="form_button_order">' . __('Buton Sırası', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $form_button_order = isset($settings['form_button_order']) ? $settings['form_button_order'] : 'add_first';
        echo '<select id="form_button_order" name="form_button_order">';
        echo '<option value="add_first" ' . selected($form_button_order, 'add_first', false) . '>' . __('Solda "Sepete Ekle", sağda "Ödemeye Git"', 'woo-donation-popup') . '</option>';
        echo '<option value="checkout_first" ' . selected($form_button_order, 'checkout_first', false) . '>' . __('Solda "Ödemeye Git", sağda "Sepete Ekle"', 'woo-donation-popup') . '</option>';
        echo '</select>';
        echo '<p class="description">' . __('Form altındaki iki butonun yerleşim sırasını belirler.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        // Hizalama
        echo '<tr>';
        echo '<th scope="row"><label for="form_button_alignment">' . __('Buton Hizalama', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $form_button_alignment = isset($settings['form_button_alignment']) ? $settings['form_button_alignment'] : 'left';
        echo '<select id="form_button_alignment" name="form_button_alignment">';
        echo '<option value="left" ' . selected($form_button_alignment, 'left', false) . '>' . __('Sola hizalı', 'woo-donation-popup') . '</option>';
        echo '<option value="center" ' . selected($form_button_alignment, 'center', false) . '>' . __('Ortalanmış', 'woo-donation-popup') . '</option>';
        echo '<option value="right" ' . selected($form_button_alignment, 'right', false) . '>' . __('Sağa hizalı', 'woo-donation-popup') . '</option>';
        echo '</select>';
        echo '<p class="description">' . __('Form butonlarının genel hizalamasını belirler.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '</table>';
        
        // Buton Metinleri
        echo '<h2>' . __('Buton Metinleri', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="button_text_add_to_cart">' . __('Sepete Ekle Butonu', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="text" id="button_text_add_to_cart" name="button_text_add_to_cart" value="' . esc_attr($settings['button_text_add_to_cart']) . '" class="regular-text" />';
        echo '<p class="description">' . __('Form içindeki "Sepete Ekle" butonunun metni', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="button_text_go_checkout">' . __('Ödemeye Git Butonu', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="text" id="button_text_go_checkout" name="button_text_go_checkout" value="' . esc_attr($settings['button_text_go_checkout']) . '" class="regular-text" />';
        echo '<p class="description">' . __('Form içindeki "Ödemeye Git" butonunun metni', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Modal Görünüm Ayarları
        echo '<h2>' . __('Modal Görünüm Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="modal_background_color">' . __('Modal Arka Plan Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $modal_bg = isset($settings['modal_background_color']) ? $settings['modal_background_color'] : '#ffffff';
        echo '<input type="color" id="modal_background_color" name="modal_background_color" value="' . esc_attr($modal_bg) . '" />';
        echo '<p class="description">' . __('Modal içeriğinin arka plan rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="modal_border_radius">' . __('Modal Border Radius (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $modal_radius = isset($settings['modal_border_radius']) ? $settings['modal_border_radius'] : '10';
        echo '<input type="number" id="modal_border_radius" name="modal_border_radius" value="' . esc_attr($modal_radius) . '" min="0" max="50" step="1" class="small-text" />';
        echo '<p class="description">' . __('Modal köşe yuvarlaklığı (0-50px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Input Alanları Ayarları
        echo '<h2>' . __('Input Alanları Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="input_border_color">' . __('Input Border Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $input_border = isset($settings['input_border_color']) ? $settings['input_border_color'] : '#d1d5db';
        echo '<input type="color" id="input_border_color" name="input_border_color" value="' . esc_attr($input_border) . '" />';
        echo '<p class="description">' . __('Input alanlarının kenarlık rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="input_border_radius">' . __('Input Border Radius (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $input_radius = isset($settings['input_border_radius']) ? $settings['input_border_radius'] : '10';
        echo '<input type="number" id="input_border_radius" name="input_border_radius" value="' . esc_attr($input_radius) . '" min="0" max="50" step="1" class="small-text" />';
        echo '<p class="description">' . __('Input alanlarının köşe yuvarlaklığı (0-50px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="label_color">' . __('Label Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $label_color = isset($settings['label_color']) ? $settings['label_color'] : '#374151';
        echo '<input type="color" id="label_color" name="label_color" value="' . esc_attr($label_color) . '" />';
        echo '<p class="description">' . __('Form label (alan başlığı) metin rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="label_font_size">' . __('Label Font Boyutu (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $label_font_size = isset($settings['label_font_size']) ? $settings['label_font_size'] : 14;
        echo '<input type="number" id="label_font_size" name="label_font_size" value="' . esc_attr($label_font_size) . '" min="10" max="24" step="1" class="small-text" />';
        echo '<p class="description">' . __('Form label metin boyutu (10-24px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="label_font_weight">' . __('Label Font Kalınlığı', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $label_font_weight = isset($settings['label_font_weight']) ? $settings['label_font_weight'] : '600';
        echo '<select id="label_font_weight" name="label_font_weight">';
        echo '<option value="400" ' . selected($label_font_weight, '400', false) . '>Normal (400)</option>';
        echo '<option value="500" ' . selected($label_font_weight, '500', false) . '>Orta (500)</option>';
        echo '<option value="600" ' . selected($label_font_weight, '600', false) . '>Yarı Kalın (600)</option>';
        echo '<option value="700" ' . selected($label_font_weight, '700', false) . '>Kalın (700)</option>';
        echo '</select>';
        echo '<p class="description">' . __('Form label metin kalınlığı', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="placeholder_color">' . __('Placeholder Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $placeholder_color = isset($settings['placeholder_color']) ? $settings['placeholder_color'] : '#6b7280';
        echo '<input type="color" id="placeholder_color" name="placeholder_color" value="' . esc_attr($placeholder_color) . '" />';
        echo '<p class="description">' . __('Input ve textarea placeholder metin rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="form_gap">' . __('Form Elemanları Arası Boşluk (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $form_gap = isset($settings['form_gap']) ? $settings['form_gap'] : 16;
        echo '<input type="number" id="form_gap" name="form_gap" value="' . esc_attr($form_gap) . '" min="4" max="40" step="1" class="small-text" />';
        echo '<p class="description">' . __('Form alanları arasındaki dikey boşluk (4-40px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';

        // Hata Mesajı ve Uyarı Renkleri
        echo '<h2>' . __('Hata / Uyarı Mesajı Renkleri', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';

        echo '<tr>';
        echo '<th scope="row"><label for="error_bg_color">' . __('Form Hata Arka Plan Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $error_bg = isset($settings['error_bg_color']) ? $settings['error_bg_color'] : '#fed7d7';
        echo '<input type="color" id="error_bg_color" name="error_bg_color" value="' . esc_attr($error_bg) . '" />';
        echo '<p class="description">' . __('Form üstündeki genel hata kutusunun arka plan rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="error_border_color">' . __('Form Hata Border Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $error_border = isset($settings['error_border_color']) ? $settings['error_border_color'] : '#feb2b2';
        echo '<input type="color" id="error_border_color" name="error_border_color" value="' . esc_attr($error_border) . '" />';
        echo '<p class="description">' . __('Form üstündeki genel hata kutusunun kenarlık rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="error_text_color">' . __('Form Hata Metin Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $error_text = isset($settings['error_text_color']) ? $settings['error_text_color'] : '#c53030';
        echo '<input type="color" id="error_text_color" name="error_text_color" value="' . esc_attr($error_text) . '" />';
        echo '<p class="description">' . __('Form üstündeki genel hata metninin rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="input_error_bg_color">' . __('Input Hata Balonu Arka Plan Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $input_error_bg = isset($settings['input_error_bg_color']) ? $settings['input_error_bg_color'] : '#fed7d7';
        echo '<input type="color" id="input_error_bg_color" name="input_error_bg_color" value="' . esc_attr($input_error_bg) . '" />';
        echo '<p class="description">' . __('Tek tek alanların altında çıkan küçük hata balonunun arka plan rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="input_error_border_color">' . __('Input Hata Balonu Border Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $input_error_border = isset($settings['input_error_border_color']) ? $settings['input_error_border_color'] : '#feb2b2';
        echo '<input type="color" id="input_error_border_color" name="input_error_border_color" value="' . esc_attr($input_error_border) . '" />';
        echo '<p class="description">' . __('Tek tek alanların altında çıkan küçük hata balonunun kenarlık rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="input_error_text_color">' . __('Input Hata Balonu Metin Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $input_error_text = isset($settings['input_error_text_color']) ? $settings['input_error_text_color'] : '#c53030';
        echo '<input type="color" id="input_error_text_color" name="input_error_text_color" value="' . esc_attr($input_error_text) . '" />';
        echo '<p class="description">' . __('Tek tek alanların altında çıkan küçük hata balonu metin rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Başlık Ayarları
        echo '<h2>' . __('Başlık Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="title_color">' . __('Başlık Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $title_color = isset($settings['title_color']) ? $settings['title_color'] : '#1f2937';
        echo '<input type="color" id="title_color" name="title_color" value="' . esc_attr($title_color) . '" />';
        echo '<p class="description">' . __('Modal başlığının rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="title_font_size">' . __('Başlık Font Boyutu (Masaüstü, px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $title_size = isset($settings['title_font_size']) ? $settings['title_font_size'] : '27';
        echo '<input type="number" id="title_font_size" name="title_font_size" value="' . esc_attr($title_size) . '" min="14" max="48" step="1" class="small-text" />';
        echo '<p class="description">' . __('Modal başlığının masaüstü font boyutu (14-48px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="title_font_size_mobile">' . __('Başlık Font Boyutu (Mobil, px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $title_size_mobile = isset($settings['title_font_size_mobile']) ? $settings['title_font_size_mobile'] : $title_size;
        echo '<input type="number" id="title_font_size_mobile" name="title_font_size_mobile" value="' . esc_attr($title_size_mobile) . '" min="12" max="40" step="1" class="small-text" />';
        echo '<p class="description">' . __('Mobil cihazlarda modal başlığının font boyutu (12-40px arası). Boş bırakılırsa masaüstü değeri kullanılır.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Kapat Butonu Ayarları
        echo '<h2>' . __('Kapat Butonu Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="close_button_color">' . __('Kapat Butonu Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $close_color = isset($settings['close_button_color']) ? $settings['close_button_color'] : '#6b7280';
        echo '<input type="color" id="close_button_color" name="close_button_color" value="' . esc_attr($close_color) . '" />';
        echo '<p class="description">' . __('Modal kapat butonunun rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Kaydet butonu
        echo '<p class="submit">';
        echo '<button type="submit" id="wdp-save-normal-form-settings" class="button button-primary">' . __('Ayarları Kaydet', 'woo-donation-popup') . '</button>';
        echo '<span class="spinner"></span>';
        echo '<span class="wdp-inline-save-message" aria-live="polite"></span>';
        echo '</p>';
        
        echo '</form>';
        echo '</div>';
    }
    
    /**
     * Hisseli form özelleştirme tab'ını render et
     */
    private function render_shareholder_form_customization_tab() {
        // Mevcut ayarları al
        $settings = get_option('wdp_shareholder_settings', array());
        
        // Varsayılan değerler
        $defaults = array(
            'shareholder_card_bg' => '#ffffff',
            'shareholder_card_border' => '#f0f2f5',
            'shareholder_card_radius' => '10',
            'shareholder_card_shadow' => '0 1px 3px rgba(0, 0, 0, 0.05)',
            'shareholder_header_bg' => '#f9fafb',
            'shareholder_header_color' => '#1f2937',
            'shareholder_content_padding' => '12',
            'shareholders_area_bg' => 'linear-gradient(to bottom, #ffffff 0%, #fafbfc 100%)',
            'shareholders_area_border' => '#e1e5e9',
            'shareholders_area_radius' => '10',
            'shareholders_scrollbar_color' => '#4a90e2',
            'share_counter_border' => '#d1d5db',
            'share_counter_bg' => '#ffffff',
            'share_counter_button_color' => '#888888',
            // Metin özelleştirme varsayılanları
            'shareholder_header_text' => 'Hissedar Bilgileri',
            'shareholder_name_placeholder' => 'Ad Soyad *',
            'shareholder_phone_placeholder' => 'Telefon Numarası *',
            'shareholder_note_placeholder' => 'Not (isteğe bağlı)',
            'shareholder_copy_button_text' => '📋 Kopyasını Oluştur',
            'shareholder_enable_copy_button' => '1',
            // Düzen ve ek alanlar
            'shareholder_layout' => 'single',
            'shareholder_density' => 'normal',
            'shareholder_enable_email' => '0',
            'shareholder_email_placeholder' => 'E-posta (isteğe bağlı)',
        );
        
        $settings = wp_parse_args($settings, $defaults);
        
        echo '<div class="wdp-button-settings-container">';
        echo '<form id="wdp-shareholder-form-settings-form">';
        
        // Hissedar Kartı Ayarları
        echo '<h2>' . __('Hissedar Kartı Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_card_bg">' . __('Kart Arka Plan Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="shareholder_card_bg" name="shareholder_card_bg" value="' . esc_attr($settings['shareholder_card_bg']) . '" />';
        echo '<p class="description">' . __('Hissedar kartının arka plan rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_card_border">' . __('Kart Border Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="shareholder_card_border" name="shareholder_card_border" value="' . esc_attr($settings['shareholder_card_border']) . '" />';
        echo '<p class="description">' . __('Hissedar kartının kenarlık rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_card_radius">' . __('Kart Border Radius (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="shareholder_card_radius" name="shareholder_card_radius" value="' . esc_attr($settings['shareholder_card_radius']) . '" min="0" max="50" step="1" class="small-text" />';
        echo '<p class="description">' . __('Hissedar kartının köşe yuvarlaklığı (0-50px)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_card_shadow">' . __('Kart Gölge', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="text" id="shareholder_card_shadow" name="shareholder_card_shadow" value="' . esc_attr($settings['shareholder_card_shadow']) . '" class="regular-text" placeholder="0 1px 3px rgba(0, 0, 0, 0.05)" />';
        echo '<p class="description">' . __('Hissedar kartının box-shadow değeri (CSS formatında)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';

        // Hisseli Form Metinleri
        echo '<h2>' . __('Hisseli Form Metinleri', 'woo-donation-popup') . '</h2>';
        echo '<p>' . __('Bu metinler sadece hisseli form yapısı için geçerlidir. Normal ve progress bar formlarındaki alanları etkilemez.', 'woo-donation-popup') . '</p>';
        echo '<table class="form-table">';

        // Hissedar başlık metni
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_header_text">' . __('Hissedar Başlık Metni', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $shareholder_header_text = isset($settings['shareholder_header_text']) ? $settings['shareholder_header_text'] : $defaults['shareholder_header_text'];
        echo '<input type="text" id="shareholder_header_text" name="shareholder_header_text" value="' . esc_attr($shareholder_header_text) . '" class="regular-text" />';
        echo '<p class="description">' . __('Her hissedar kartında görünen başlık metni (örn: "Hissedar Bilgileri").', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        // Ad Soyad placeholder
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_name_placeholder">' . __('Ad Soyad Placeholder', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $shareholder_name_placeholder = isset($settings['shareholder_name_placeholder']) ? $settings['shareholder_name_placeholder'] : $defaults['shareholder_name_placeholder'];
        echo '<input type="text" id="shareholder_name_placeholder" name="shareholder_name_placeholder" value="' . esc_attr($shareholder_name_placeholder) . '" class="regular-text" />';
        echo '<p class="description">' . __('Hissedar formundaki ad soyad alanı placeholder metni.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        // Telefon placeholder
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_phone_placeholder">' . __('Telefon Placeholder', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $shareholder_phone_placeholder = isset($settings['shareholder_phone_placeholder']) ? $settings['shareholder_phone_placeholder'] : $defaults['shareholder_phone_placeholder'];
        echo '<input type="text" id="shareholder_phone_placeholder" name="shareholder_phone_placeholder" value="' . esc_attr($shareholder_phone_placeholder) . '" class="regular-text" />';
        echo '<p class="description">' . __('Hissedar formundaki telefon alanı placeholder metni.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        // Not placeholder
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_note_placeholder">' . __('Not Placeholder', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $shareholder_note_placeholder = isset($settings['shareholder_note_placeholder']) ? $settings['shareholder_note_placeholder'] : $defaults['shareholder_note_placeholder'];
        echo '<input type="text" id="shareholder_note_placeholder" name="shareholder_note_placeholder" value="' . esc_attr($shareholder_note_placeholder) . '" class="regular-text" />';
        echo '<p class="description">' . __('Hissedar formundaki not alanı placeholder metni.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        // Kopya oluştur butonu metni
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_copy_button_text">' . __('Kopya Oluştur Butonu Metni', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $shareholder_copy_button_text = isset($settings['shareholder_copy_button_text']) ? $settings['shareholder_copy_button_text'] : $defaults['shareholder_copy_button_text'];
        echo '<input type="text" id="shareholder_copy_button_text" name="shareholder_copy_button_text" value="' . esc_attr($shareholder_copy_button_text) . '" class="regular-text" />';
        echo '<p class="description">' . __('Her hissedar formundaki "Kopyasını Oluştur" butonunun metni. İsterseniz emoji kullanabilirsiniz.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        // Kopya butonunu aktif/pasif etme
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_enable_copy_button">' . __('Kopya Butonunu Göster', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $enable_copy = isset($settings['shareholder_enable_copy_button']) ? (bool) $settings['shareholder_enable_copy_button'] : true;
        echo '<label><input type="checkbox" id="shareholder_enable_copy_button" name="shareholder_enable_copy_button" value="1" ' . checked($enable_copy, true, false) . ' /> ';
        echo __('Hissedar formunda \"Kopyasını Oluştur\" butonunu göster', 'woo-donation-popup') . '</label>';
        echo '<p class="description">' . __('Bu işaret kaldırılırsa hisseli formda kopya oluşturma butonu tamamen gizlenir.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        // Alan düzeni ve yoğunluğu
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_layout">' . __('Alan Düzeni', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $shareholder_layout = isset($settings['shareholder_layout']) ? $settings['shareholder_layout'] : 'single';
        echo '<select id="shareholder_layout" name="shareholder_layout">';
        echo '<option value="single" ' . selected($shareholder_layout, 'single', false) . '>' . __('Tek Sütun (tüm alanlar alt alta)', 'woo-donation-popup') . '</option>';
        echo '<option value="two-column" ' . selected($shareholder_layout, 'two-column', false) . '>' . __('İki Sütun (Ad + Telefon yan yana, Not altta tam genişlik)', 'woo-donation-popup') . '</option>';
        echo '</select>';
        echo '<p class="description">' . __('Hissedar formundaki alanların yerleşimini seçin.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_density">' . __('Kart Yoğunluğu', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $shareholder_density = isset($settings['shareholder_density']) ? $settings['shareholder_density'] : 'normal';
        echo '<select id="shareholder_density" name="shareholder_density">';
        echo '<option value="compact" ' . selected($shareholder_density, 'compact', false) . '>' . __('Kompakt (daha az boşluk, daha kısa kart)', 'woo-donation-popup') . '</option>';
        echo '<option value="normal" ' . selected($shareholder_density, 'normal', false) . '>' . __('Normal', 'woo-donation-popup') . '</option>';
        echo '<option value="spacious" ' . selected($shareholder_density, 'spacious', false) . '>' . __('Geniş (daha fazla boşluk, daha yüksek kart)', 'woo-donation-popup') . '</option>';
        echo '</select>';
        echo '<p class="description">' . __('Hissedar kartlarının genel yüksekliği ve iç boşluklarını belirler.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        // E-posta alanı
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_enable_email">' . __('E-posta Alanı', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $enable_email = isset($settings['shareholder_enable_email']) ? (bool) $settings['shareholder_enable_email'] : false;
        echo '<label><input type="checkbox" id="shareholder_enable_email" name="shareholder_enable_email" value="1" ' . checked($enable_email, true, false) . ' /> ';
        echo __('Her hissedar kartında isteğe bağlı bir e-posta alanı göster', 'woo-donation-popup') . '</label>';
        echo '<p class="description">' . __('E-posta alanı sadece hisseli form için eklenir, zorunlu değildir.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_email_placeholder">' . __('E-posta Placeholder', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $shareholder_email_placeholder = isset($settings['shareholder_email_placeholder']) ? $settings['shareholder_email_placeholder'] : $defaults['shareholder_email_placeholder'];
        echo '<input type="text" id="shareholder_email_placeholder" name="shareholder_email_placeholder" value="' . esc_attr($shareholder_email_placeholder) . '" class="regular-text" />';
        echo '<p class="description">' . __('Hissedar formundaki e-posta alanı placeholder metni (isteğe bağlı).', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '</table>';
        
        // Hissedar Başlık Ayarları
        echo '<h2>' . __('Hissedar Başlık Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_header_bg">' . __('Başlık Arka Plan Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="shareholder_header_bg" name="shareholder_header_bg" value="' . esc_attr($settings['shareholder_header_bg']) . '" />';
        echo '<p class="description">' . __('Hissedar başlığının arka plan rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_header_color">' . __('Başlık Metin Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="shareholder_header_color" name="shareholder_header_color" value="' . esc_attr($settings['shareholder_header_color']) . '" />';
        echo '<p class="description">' . __('Hissedar başlığının metin rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="shareholder_content_padding">' . __('İçerik Padding (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="shareholder_content_padding" name="shareholder_content_padding" value="' . esc_attr($settings['shareholder_content_padding']) . '" min="0" max="30" step="1" class="small-text" />';
        echo '<p class="description">' . __('Hissedar içeriğinin padding değeri (0-30px)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Hissedarlar Alanı Ayarları
        echo '<h2>' . __('Hissedarlar Alanı Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="shareholders_area_use_gradient">' . __('Gradient Kullan', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $use_gradient = (strpos($settings['shareholders_area_bg'], 'gradient') !== false);
        echo '<label><input type="checkbox" id="shareholders_area_use_gradient" name="shareholders_area_use_gradient" value="1" ' . checked($use_gradient, true, false) . ' /> ' . __('Gradient (geçişli renk) kullan', 'woo-donation-popup') . '</label>';
        echo '<p class="description">' . __('İşaretlenirse iki renk arasında geçişli arka plan kullanılır', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr class="shareholders-area-color-row">';
        echo '<th scope="row"><label for="shareholders_area_color1">' . __('Üst Renk', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        // Gradient'ten renkleri çıkar veya varsayılan kullan
        $color1 = '#ffffff';
        $color2 = '#fafbfc';
        if (preg_match('/#([a-fA-F0-9]{6})/', $settings['shareholders_area_bg'], $matches)) {
            $color1 = '#' . $matches[1];
        }
        if (preg_match_all('/#([a-fA-F0-9]{6})/', $settings['shareholders_area_bg'], $matches)) {
            if (isset($matches[1][1])) {
                $color2 = '#' . $matches[1][1];
            }
        }
        echo '<input type="color" id="shareholders_area_color1" name="shareholders_area_color1" value="' . esc_attr($color1) . '" />';
        echo '<p class="description">' . __('Gradient kullanılıyorsa üstteki renk', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr class="shareholders-area-color-row">';
        echo '<th scope="row"><label for="shareholders_area_color2">' . __('Alt Renk', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="shareholders_area_color2" name="shareholders_area_color2" value="' . esc_attr($color2) . '" />';
        echo '<p class="description">' . __('Gradient kullanılıyorsa alttaki renk', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr class="shareholders-area-solid-row" style="display:none;">';
        echo '<th scope="row"><label for="shareholders_area_solid_color">' . __('Arka Plan Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="shareholders_area_solid_color" name="shareholders_area_solid_color" value="' . esc_attr($color1) . '" />';
        echo '<p class="description">' . __('Gradient kullanılmıyorsa tek renk arka plan', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="shareholders_area_border">' . __('Alan Border Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="shareholders_area_border" name="shareholders_area_border" value="' . esc_attr($settings['shareholders_area_border']) . '" />';
        echo '<p class="description">' . __('Hissedarlar alanının kenarlık rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="shareholders_area_radius">' . __('Alan Border Radius (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="shareholders_area_radius" name="shareholders_area_radius" value="' . esc_attr($settings['shareholders_area_radius']) . '" min="0" max="50" step="1" class="small-text" />';
        echo '<p class="description">' . __('Hissedarlar alanının köşe yuvarlaklığı (0-50px)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="shareholders_scrollbar_color">' . __('Scrollbar Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="shareholders_scrollbar_color" name="shareholders_scrollbar_color" value="' . esc_attr($settings['shareholders_scrollbar_color']) . '" />';
        echo '<p class="description">' . __('Hissedarlar alanı scrollbar rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Hisse Sayaç Ayarları
        echo '<h2>' . __('Hisse Sayaç Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="share_counter_border">' . __('Sayaç Border Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="share_counter_border" name="share_counter_border" value="' . esc_attr($settings['share_counter_border']) . '" />';
        echo '<p class="description">' . __('Hisse sayacının kenarlık rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="share_counter_bg">' . __('Sayaç Arka Plan Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="share_counter_bg" name="share_counter_bg" value="' . esc_attr($settings['share_counter_bg']) . '" />';
        echo '<p class="description">' . __('Hisse sayacının arka plan rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="share_counter_button_color">' . __('Sayaç Buton Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="share_counter_button_color" name="share_counter_button_color" value="' . esc_attr($settings['share_counter_button_color']) . '" />';
        echo '<p class="description">' . __('Hisse sayacı butonlarının rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Kaydet butonu
        echo '<p class="submit">';
        echo '<button type="submit" id="wdp-save-shareholder-form-settings" class="button button-primary">' . __('Ayarları Kaydet', 'woo-donation-popup') . '</button>';
        echo '<span class="spinner"></span>';
        echo '</p>';
        
        echo '</form>';
        echo '</div>';
    }
    
    /**
     * Başarı ekranı özelleştirme tab'ını render et
     */
    private function render_success_screen_customization_tab() {
        // Mevcut ayarları al
        $settings = get_option('wdp_success_settings', array());
        
        // Varsayılan değerler
        $defaults = array(
            'success_button_color' => '#1e73be',
            'success_button_hover' => '#185d98',
            'success_button_radius' => '24',
            'success_text_view_cart' => 'Sepeti Görüntüle',
            'success_text_go_checkout' => 'Ödemeye Git',
            'success_text_new_donation' => 'Yeni Bağış Ekle',
            'success_message_bg' => 'rgba(72, 187, 120, 0.1)',
            'success_message_color' => '#48bb78',
            'success_message_border' => 'rgba(72, 187, 120, 0.2)',
            'success_message_radius' => '8',
            'mini_cart_bg' => '#f9fafb',
            'mini_cart_border' => '#e5e7eb',
            'mini_cart_radius' => '10',
            'cart_item_name_color' => '#1f2937',
            'cart_item_price_color' => '#1e73be',
        );
        
        $settings = wp_parse_args($settings, $defaults);
        
        echo '<div class="wdp-button-settings-container">';
        echo '<form id="wdp-success-screen-settings-form">';
        
        // Başarı Ekranı Butonları
        echo '<h2>' . __('Başarı Ekranı Butonları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="success_button_color">' . __('Buton Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="success_button_color" name="success_button_color" value="' . esc_attr($settings['success_button_color']) . '" />';
        echo '<p class="description">' . __('Başarı ekranı butonlarının ana rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="success_button_hover">' . __('Buton Hover Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="success_button_hover" name="success_button_hover" value="' . esc_attr($settings['success_button_hover']) . '" />';
        echo '<p class="description">' . __('Başarı ekranı butonlarının hover rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="success_button_radius">' . __('Buton Border Radius (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="success_button_radius" name="success_button_radius" value="' . esc_attr($settings['success_button_radius']) . '" min="0" max="50" step="1" class="small-text" />';
        echo '<p class="description">' . __('Başarı ekranı butonlarının köşe yuvarlaklığı (0-50px)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Başarı Ekranı Buton Metinleri
        echo '<h2>' . __('Başarı Ekranı Buton Metinleri', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="success_text_view_cart">' . __('Sepeti Görüntüle Butonu', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="text" id="success_text_view_cart" name="success_text_view_cart" value="' . esc_attr($settings['success_text_view_cart']) . '" class="regular-text" />';
        echo '<p class="description">' . __('Başarı ekranındaki "Sepeti Görüntüle" butonunun metni', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="success_text_go_checkout">' . __('Ödemeye Git Butonu', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="text" id="success_text_go_checkout" name="success_text_go_checkout" value="' . esc_attr($settings['success_text_go_checkout']) . '" class="regular-text" />';
        echo '<p class="description">' . __('Başarı ekranındaki "Ödemeye Git" butonunun metni', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="success_text_new_donation">' . __('Yeni Bağış Ekle Butonu', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="text" id="success_text_new_donation" name="success_text_new_donation" value="' . esc_attr($settings['success_text_new_donation']) . '" class="regular-text" />';
        echo '<p class="description">' . __('Başarı ekranındaki "Yeni Bağış Ekle" butonunun metni', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Başarı Mesajı Ayarları
        echo '<h2>' . __('Başarı Mesajı Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="success_message_bg">' . __('Mesaj Arka Plan Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="text" id="success_message_bg" name="success_message_bg" value="' . esc_attr($settings['success_message_bg']) . '" class="regular-text" placeholder="rgba(72, 187, 120, 0.1)" />';
        echo '<p class="description">' . __('Başarı mesajının arka plan rengi (renk veya rgba)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="success_message_color">' . __('Mesaj Metin Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="success_message_color" name="success_message_color" value="' . esc_attr($settings['success_message_color']) . '" />';
        echo '<p class="description">' . __('Başarı mesajının metin rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="success_message_border">' . __('Mesaj Border Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="text" id="success_message_border" name="success_message_border" value="' . esc_attr($settings['success_message_border']) . '" class="regular-text" placeholder="rgba(72, 187, 120, 0.2)" />';
        echo '<p class="description">' . __('Başarı mesajının kenarlık rengi (renk veya rgba)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="success_message_radius">' . __('Mesaj Border Radius (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="success_message_radius" name="success_message_radius" value="' . esc_attr($settings['success_message_radius']) . '" min="0" max="50" step="1" class="small-text" />';
        echo '<p class="description">' . __('Başarı mesajının köşe yuvarlaklığı (0-50px)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Mini Sepet Ayarları
        echo '<h2>' . __('Mini Sepet Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="mini_cart_bg">' . __('Sepet Arka Plan Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="mini_cart_bg" name="mini_cart_bg" value="' . esc_attr($settings['mini_cart_bg']) . '" />';
        echo '<p class="description">' . __('Mini sepetin arka plan rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="mini_cart_border">' . __('Sepet Border Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="mini_cart_border" name="mini_cart_border" value="' . esc_attr($settings['mini_cart_border']) . '" />';
        echo '<p class="description">' . __('Mini sepetin kenarlık rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="mini_cart_radius">' . __('Sepet Border Radius (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="mini_cart_radius" name="mini_cart_radius" value="' . esc_attr($settings['mini_cart_radius']) . '" min="0" max="50" step="1" class="small-text" />';
        echo '<p class="description">' . __('Mini sepetin köşe yuvarlaklığı (0-50px)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="cart_item_name_color">' . __('Ürün Adı Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="cart_item_name_color" name="cart_item_name_color" value="' . esc_attr($settings['cart_item_name_color']) . '" />';
        echo '<p class="description">' . __('Sepetteki ürün adının rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="cart_item_price_color">' . __('Ürün Fiyat Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="cart_item_price_color" name="cart_item_price_color" value="' . esc_attr($settings['cart_item_price_color']) . '" />';
        echo '<p class="description">' . __('Sepetteki ürün fiyatının rengi', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Kaydet butonu
        echo '<p class="submit">';
        echo '<button type="submit" id="wdp-save-success-screen-settings" class="button button-primary">' . __('Ayarları Kaydet', 'woo-donation-popup') . '</button>';
        echo '<span class="spinner"></span>';
        echo '</p>';
        
        echo '</form>';
        echo '</div>';
    }

    /**
     * Progress bar özelleştirme tab'ını render et
     */
    private function render_progress_bar_customization_tab() {
        // Mevcut ayarları al
        $settings = get_option('wdp_progress_bar_settings', array());

        // Varsayılanlar
        $defaults = array(
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

        $settings = wp_parse_args($settings, $defaults);

        echo '<div class="wdp-button-settings-container">';
        echo '<form id="wdp-progress-bar-settings-form">';

        echo '<h2>' . __('Progress Bar Görünüm Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<p>' . __('Bu ayarlar sadece progress barlı bağış formlarındaki barın görünümünü etkiler.', 'woo-donation-popup') . '</p>';

        echo '<table class="form-table">';

        // Container background
        echo '<tr>';
        echo '<th scope="row"><label for="progress_container_bg">' . __('Kapsayıcı Arka Plan Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="progress_container_bg" name="progress_container_bg" value="' . esc_attr($settings['container_bg']) . '" />';
        echo '<p class="description">' . __('Progress bar kutusunun arka plan rengi.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        // Container border
        echo '<tr>';
        echo '<th scope="row"><label for="progress_container_border">' . __('Kapsayıcı Border Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="progress_container_border" name="progress_container_border" value="' . esc_attr($settings['container_border']) . '" />';
        echo '<p class="description">' . __('Progress bar kutusunun kenarlık rengi.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        // Track background
        echo '<tr>';
        echo '<th scope="row"><label for="progress_track_bg">' . __('Boş Bar Arka Plan Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="progress_track_bg" name="progress_track_bg" value="' . esc_attr($settings['track_bg']) . '" />';
        echo '<p class="description">' . __('İlerleme barının boş kısmının arka plan rengi.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        // Fill gradient
        echo '<tr>';
        echo '<th scope="row"><label>' . __('Dolu Bar Gradient Renkleri', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<label>' . __('Başlangıç', 'woo-donation-popup') . ' ';
        echo '<input type="color" id="progress_fill_start" name="progress_fill_start" value="' . esc_attr($settings['fill_start']) . '" /></label><br />';
        echo '<label>' . __('Orta', 'woo-donation-popup') . ' ';
        echo '<input type="color" id="progress_fill_mid" name="progress_fill_mid" value="' . esc_attr($settings['fill_mid']) . '" /></label><br />';
        echo '<label>' . __('Bitiş', 'woo-donation-popup') . ' ';
        echo '<input type="color" id="progress_fill_end" name="progress_fill_end" value="' . esc_attr($settings['fill_end']) . '" /></label>';
        echo '<p class="description">' . __('Dolu bar kısmının gradient renkleri.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        // Preview bar color
        echo '<tr>';
        echo '<th scope="row"><label for="progress_preview_bg">' . __('Preview (Özel Fiyat) Bar Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="progress_preview_bg" name="progress_preview_bg" value="' . esc_attr($settings['preview_bg']) . '" />';
        echo '<p class="description">' . __('Özel fiyat girildiğinde görünen ek bar renginin ana rengi.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        // Percentage badge
        echo '<tr>';
        echo '<th scope="row"><label for="progress_percentage_bg">' . __('Yüzde Rozeti Arka Plan Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="progress_percentage_bg" name="progress_percentage_bg" value="' . esc_attr($settings['percentage_bg']) . '" />';
        echo '<p class="description">' . __('Ortadaki yüzde kutusunun arka plan rengi.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '<tr>';
        echo '<th scope="row"><label for="progress_percentage_text">' . __('Yüzde Rozeti Metin Rengi', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="color" id="progress_percentage_text" name="progress_percentage_text" value="' . esc_attr($settings['percentage_text']) . '" />';
        echo '<p class="description">' . __('Ortadaki yüzde kutusunun metin rengi.', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';

        echo '</table>';

        // Kaydet butonu
        echo '<p class="submit">';
        echo '<button type="submit" id="wdp-save-progress-bar-settings" class="button button-primary">' . __('Ayarları Kaydet', 'woo-donation-popup') . '</button>';
        echo '<span class="spinner"></span>';
        echo '</p>';

        echo '</form>';
        echo '</div>';
    }
    
    /**
     * Normal form özelleştirme ayarlarını kaydet (AJAX)
     */
    public function save_normal_form_settings() {
        // Güvenlik kontrolü
        check_ajax_referer('wdp_admin_nonce', 'nonce');
        
        // Yetki kontrolü
        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Bu işlem için yetkiniz yok.', 'woo-donation-popup')));
            wp_die();
        }
        
        // Ayarları al ve temizle
        $settings = array(
            'button_primary_color' => isset($_POST['button_primary_color']) ? sanitize_hex_color($_POST['button_primary_color']) : '#1e73be',
            'button_primary_hover' => isset($_POST['button_primary_hover']) ? sanitize_hex_color($_POST['button_primary_hover']) : '#185d98',
            'button_border_radius' => isset($_POST['button_border_radius']) ? absint($_POST['button_border_radius']) : 10,
            'button_text_donate' => isset($_POST['button_text_donate']) ? sanitize_text_field($_POST['button_text_donate']) : 'Bağış Yap',
            'button_text_add_to_cart' => isset($_POST['button_text_add_to_cart']) ? sanitize_text_field($_POST['button_text_add_to_cart']) : 'Sepete Ekle',
            'button_text_go_checkout' => isset($_POST['button_text_go_checkout']) ? sanitize_text_field($_POST['button_text_go_checkout']) : 'Ödemeye Git',
            'modal_background_color' => isset($_POST['modal_background_color']) ? sanitize_hex_color($_POST['modal_background_color']) : '#ffffff',
            'modal_border_radius' => isset($_POST['modal_border_radius']) ? absint($_POST['modal_border_radius']) : 10,
            'input_border_color' => isset($_POST['input_border_color']) ? sanitize_hex_color($_POST['input_border_color']) : '#d1d5db',
            'input_border_radius' => isset($_POST['input_border_radius']) ? absint($_POST['input_border_radius']) : 10,
            'title_color' => isset($_POST['title_color']) ? sanitize_hex_color($_POST['title_color']) : '#1f2937',
            'title_font_size' => isset($_POST['title_font_size']) ? absint($_POST['title_font_size']) : 27,
            'title_font_size_mobile' => isset($_POST['title_font_size_mobile']) && $_POST['title_font_size_mobile'] !== ''
                ? absint($_POST['title_font_size_mobile'])
                : 0,
            'close_button_color' => isset($_POST['close_button_color']) ? sanitize_hex_color($_POST['close_button_color']) : '#6b7280',
            'button_checkout_color' => isset($_POST['button_checkout_color']) ? sanitize_hex_color($_POST['button_checkout_color']) : '#48bb78',
            'button_checkout_hover' => isset($_POST['button_checkout_hover']) ? sanitize_hex_color($_POST['button_checkout_hover']) : '#38a169',
            'popup_button_text' => isset($_POST['popup_button_text']) ? sanitize_text_field($_POST['popup_button_text']) : 'Bağış Yap',
            'popup_button_color' => isset($_POST['popup_button_color']) ? sanitize_hex_color($_POST['popup_button_color']) : '#1e73be',
            'popup_button_hover' => isset($_POST['popup_button_hover']) ? sanitize_hex_color($_POST['popup_button_hover']) : '#185d98',
            'popup_button_font_size' => isset($_POST['popup_button_font_size']) ? absint($_POST['popup_button_font_size']) : 18,
            'popup_button_font_weight' => isset($_POST['popup_button_font_weight']) ? sanitize_text_field($_POST['popup_button_font_weight']) : '700',
            'popup_button_font_family' => isset($_POST['popup_button_font_family']) ? sanitize_text_field($_POST['popup_button_font_family']) : 'inherit',
            'popup_button_custom_font' => isset($_POST['popup_button_custom_font']) ? sanitize_text_field($_POST['popup_button_custom_font']) : '',
            'popup_button_border_radius' => isset($_POST['popup_button_border_radius']) ? absint($_POST['popup_button_border_radius']) : 10,
            'label_color' => isset($_POST['label_color']) ? sanitize_hex_color($_POST['label_color']) : '#374151',
            'label_font_size' => isset($_POST['label_font_size']) ? absint($_POST['label_font_size']) : 14,
            'label_font_weight' => isset($_POST['label_font_weight']) ? sanitize_text_field($_POST['label_font_weight']) : '600',
            'placeholder_color' => isset($_POST['placeholder_color']) ? sanitize_hex_color($_POST['placeholder_color']) : '#6b7280',
            'form_gap' => isset($_POST['form_gap']) ? absint($_POST['form_gap']) : 16,
            'error_bg_color' => isset($_POST['error_bg_color']) ? sanitize_hex_color($_POST['error_bg_color']) : '#fed7d7',
            'error_border_color' => isset($_POST['error_border_color']) ? sanitize_hex_color($_POST['error_border_color']) : '#feb2b2',
            'error_text_color' => isset($_POST['error_text_color']) ? sanitize_hex_color($_POST['error_text_color']) : '#c53030',
            'input_error_bg_color' => isset($_POST['input_error_bg_color']) ? sanitize_hex_color($_POST['input_error_bg_color']) : '#fed7d7',
            'input_error_border_color' => isset($_POST['input_error_border_color']) ? sanitize_hex_color($_POST['input_error_border_color']) : '#feb2b2',
            'input_error_text_color' => isset($_POST['input_error_text_color']) ? sanitize_hex_color($_POST['input_error_text_color']) : '#c53030',
            // Form buton düzeni
            'form_button_order' => (isset($_POST['form_button_order']) && $_POST['form_button_order'] === 'checkout_first') ? 'checkout_first' : 'add_first',
            'form_button_alignment' => in_array(isset($_POST['form_button_alignment']) ? $_POST['form_button_alignment'] : 'left', array('left', 'center', 'right'), true)
                ? sanitize_text_field($_POST['form_button_alignment'])
                : 'left',
        );
        
        // Border radius sınırlamaları
        if ($settings['button_border_radius'] > 50) {
            $settings['button_border_radius'] = 50;
        }
        if ($settings['modal_border_radius'] > 50) {
            $settings['modal_border_radius'] = 50;
        }
        if ($settings['input_border_radius'] > 50) {
            $settings['input_border_radius'] = 50;
        }

        if ($settings['form_gap'] < 4) {
            $settings['form_gap'] = 4;
        }
        if ($settings['form_gap'] > 40) {
            $settings['form_gap'] = 40;
        }
        
        // Font size sınırlamaları
        if ($settings['title_font_size'] < 14) {
            $settings['title_font_size'] = 14;
        }
        if ($settings['title_font_size'] > 48) {
            $settings['title_font_size'] = 48;
        }

        // Mobil başlık boyutu (opsiyonel) sınırları
        if (!empty($settings['title_font_size_mobile'])) {
            if ($settings['title_font_size_mobile'] < 12) {
                $settings['title_font_size_mobile'] = 12;
            }
            if ($settings['title_font_size_mobile'] > 40) {
                $settings['title_font_size_mobile'] = 40;
            }
        }
        // Popup buton font boyutu sınırlamaları
        if (isset($settings['popup_button_font_size'])) {
            if ($settings['popup_button_font_size'] < 12) {
                $settings['popup_button_font_size'] = 12;
            }
            if ($settings['popup_button_font_size'] > 32) {
                $settings['popup_button_font_size'] = 32;
            }
        }
        // Popup buton border radius sınırlamaları
        if (isset($settings['popup_button_border_radius'])) {
            if ($settings['popup_button_border_radius'] > 50) {
                $settings['popup_button_border_radius'] = 50;
            }
        }
        
        // Ayarları kaydet
        update_option('wdp_button_settings', $settings);
        
        // Başarılı yanıt döndür
        wp_send_json_success(array(
            'message' => __('Normal form ayarları başarıyla kaydedildi.', 'woo-donation-popup')
        ));
        
        wp_die();
    }
    
    /**
     * Hisseli form özelleştirme ayarlarını kaydet (AJAX)
     */
    public function save_shareholder_form_settings() {
        // Güvenlik kontrolü
        check_ajax_referer('wdp_admin_nonce', 'nonce');
        
        // Yetki kontrolü
        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Bu işlem için yetkiniz yok.', 'woo-donation-popup')));
            wp_die();
        }
        
        // Ayarları al ve temizle
        $settings = array(
            'shareholder_card_bg' => isset($_POST['shareholder_card_bg']) ? sanitize_hex_color($_POST['shareholder_card_bg']) : '#ffffff',
            'shareholder_card_border' => isset($_POST['shareholder_card_border']) ? sanitize_hex_color($_POST['shareholder_card_border']) : '#f0f2f5',
            'shareholder_card_radius' => isset($_POST['shareholder_card_radius']) ? absint($_POST['shareholder_card_radius']) : 10,
            'shareholder_card_shadow' => isset($_POST['shareholder_card_shadow']) ? sanitize_text_field($_POST['shareholder_card_shadow']) : '0 1px 3px rgba(0, 0, 0, 0.05)',
            'shareholder_header_bg' => isset($_POST['shareholder_header_bg']) ? sanitize_hex_color($_POST['shareholder_header_bg']) : '#f9fafb',
            'shareholder_header_color' => isset($_POST['shareholder_header_color']) ? sanitize_hex_color($_POST['shareholder_header_color']) : '#1f2937',
            'shareholder_content_padding' => isset($_POST['shareholder_content_padding']) ? absint($_POST['shareholder_content_padding']) : 12,
            'shareholders_area_bg' => isset($_POST['shareholders_area_use_gradient']) && $_POST['shareholders_area_use_gradient'] == '1' 
                ? 'linear-gradient(to bottom, ' . sanitize_hex_color($_POST['shareholders_area_color1']) . ' 0%, ' . sanitize_hex_color($_POST['shareholders_area_color2']) . ' 100%)'
                : sanitize_hex_color($_POST['shareholders_area_solid_color']),
            'shareholders_area_border' => isset($_POST['shareholders_area_border']) ? sanitize_hex_color($_POST['shareholders_area_border']) : '#e1e5e9',
            'shareholders_area_radius' => isset($_POST['shareholders_area_radius']) ? absint($_POST['shareholders_area_radius']) : 16,
            'shareholders_scrollbar_color' => isset($_POST['shareholders_scrollbar_color']) ? sanitize_hex_color($_POST['shareholders_scrollbar_color']) : '#4a90e2',
            'share_counter_border' => isset($_POST['share_counter_border']) ? sanitize_hex_color($_POST['share_counter_border']) : '#d1d5db',
            'share_counter_bg' => isset($_POST['share_counter_bg']) ? sanitize_hex_color($_POST['share_counter_bg']) : '#ffffff',
            'share_counter_button_color' => isset($_POST['share_counter_button_color']) ? sanitize_hex_color($_POST['share_counter_button_color']) : '#888888',
            // Metin ayarları
            'shareholder_header_text' => isset($_POST['shareholder_header_text']) ? sanitize_text_field($_POST['shareholder_header_text']) : 'Hissedar Bilgileri',
            'shareholder_name_placeholder' => isset($_POST['shareholder_name_placeholder']) ? sanitize_text_field($_POST['shareholder_name_placeholder']) : 'Ad Soyad *',
            'shareholder_phone_placeholder' => isset($_POST['shareholder_phone_placeholder']) ? sanitize_text_field($_POST['shareholder_phone_placeholder']) : 'Telefon Numarası *',
            'shareholder_note_placeholder' => isset($_POST['shareholder_note_placeholder']) ? sanitize_text_field($_POST['shareholder_note_placeholder']) : 'Not (isteğe bağlı)',
            'shareholder_copy_button_text' => isset($_POST['shareholder_copy_button_text']) ? sanitize_text_field($_POST['shareholder_copy_button_text']) : '📋 Kopyasını Oluştur',
            'shareholder_enable_copy_button' => isset($_POST['shareholder_enable_copy_button']) && $_POST['shareholder_enable_copy_button'] === '1' ? '1' : '0',
            // Düzen ve ek alanlar
            'shareholder_layout' => isset($_POST['shareholder_layout']) && $_POST['shareholder_layout'] === 'two-column' ? 'two-column' : 'single',
            'shareholder_density' => in_array(isset($_POST['shareholder_density']) ? $_POST['shareholder_density'] : 'normal', array('compact', 'normal', 'spacious'), true)
                ? sanitize_text_field($_POST['shareholder_density'])
                : 'normal',
            'shareholder_enable_email' => isset($_POST['shareholder_enable_email']) && $_POST['shareholder_enable_email'] === '1' ? '1' : '0',
            'shareholder_email_placeholder' => isset($_POST['shareholder_email_placeholder']) ? sanitize_text_field($_POST['shareholder_email_placeholder']) : 'E-posta (isteğe bağlı)',
        );
        
        // Sınırlamalar
        if ($settings['shareholder_card_radius'] > 50) {
            $settings['shareholder_card_radius'] = 50;
        }
        if ($settings['shareholders_area_radius'] > 50) {
            $settings['shareholders_area_radius'] = 50;
        }
        if ($settings['shareholder_content_padding'] > 30) {
            $settings['shareholder_content_padding'] = 30;
        }
        
        // Ayarları kaydet
        update_option('wdp_shareholder_settings', $settings);
        
        // Başarılı yanıt döndür
        wp_send_json_success(array(
            'message' => __('Hisseli form ayarları başarıyla kaydedildi.', 'woo-donation-popup')
        ));
        
        wp_die();
    }
    
    /**
     * Başarı ekranı özelleştirme ayarlarını kaydet (AJAX)
     */
    public function save_success_screen_settings() {
        // Güvenlik kontrolü
        check_ajax_referer('wdp_admin_nonce', 'nonce');
        
        // Yetki kontrolü
        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Bu işlem için yetkiniz yok.', 'woo-donation-popup')));
            wp_die();
        }
        
        // Ayarları al ve temizle
        $settings = array(
            'success_button_color' => isset($_POST['success_button_color']) ? sanitize_hex_color($_POST['success_button_color']) : '#1e73be',
            'success_button_hover' => isset($_POST['success_button_hover']) ? sanitize_hex_color($_POST['success_button_hover']) : '#185d98',
            'success_button_radius' => isset($_POST['success_button_radius']) ? absint($_POST['success_button_radius']) : 10,
            'success_text_view_cart' => isset($_POST['success_text_view_cart']) ? sanitize_text_field($_POST['success_text_view_cart']) : 'Sepeti Görüntüle',
            'success_text_go_checkout' => isset($_POST['success_text_go_checkout']) ? sanitize_text_field($_POST['success_text_go_checkout']) : 'Ödemeye Git',
            'success_text_new_donation' => isset($_POST['success_text_new_donation']) ? sanitize_text_field($_POST['success_text_new_donation']) : 'Yeni Bağış Ekle',
            'success_message_bg' => isset($_POST['success_message_bg']) ? sanitize_text_field($_POST['success_message_bg']) : 'rgba(72, 187, 120, 0.1)',
            'success_message_color' => isset($_POST['success_message_color']) ? sanitize_hex_color($_POST['success_message_color']) : '#48bb78',
            'success_message_border' => isset($_POST['success_message_border']) ? sanitize_text_field($_POST['success_message_border']) : 'rgba(72, 187, 120, 0.2)',
            'success_message_radius' => isset($_POST['success_message_radius']) ? absint($_POST['success_message_radius']) : 10,
            'mini_cart_bg' => isset($_POST['mini_cart_bg']) ? sanitize_hex_color($_POST['mini_cart_bg']) : '#f9fafb',
            'mini_cart_border' => isset($_POST['mini_cart_border']) ? sanitize_hex_color($_POST['mini_cart_border']) : '#e5e7eb',
            'mini_cart_radius' => isset($_POST['mini_cart_radius']) ? absint($_POST['mini_cart_radius']) : 10,
            'cart_item_name_color' => isset($_POST['cart_item_name_color']) ? sanitize_hex_color($_POST['cart_item_name_color']) : '#1f2937',
            'cart_item_price_color' => isset($_POST['cart_item_price_color']) ? sanitize_hex_color($_POST['cart_item_price_color']) : '#1e73be',
        );
        
        // Sınırlamalar
        if ($settings['success_button_radius'] > 50) {
            $settings['success_button_radius'] = 50;
        }
        if ($settings['success_message_radius'] > 50) {
            $settings['success_message_radius'] = 50;
        }
        if ($settings['mini_cart_radius'] > 50) {
            $settings['mini_cart_radius'] = 50;
        }
        
        // Ayarları kaydet
        update_option('wdp_success_settings', $settings);
        
        // Başarılı yanıt döndür
        wp_send_json_success(array(
            'message' => __('Başarı ekranı ayarları başarıyla kaydedildi.', 'woo-donation-popup')
        ));
        
        wp_die();
    }

    /**
     * Progress bar özelleştirme ayarlarını kaydet (AJAX)
     */
    public function save_progress_bar_settings() {
        // Güvenlik kontrolü
        check_ajax_referer('wdp_admin_nonce', 'nonce');

        // Yetki kontrolü
        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Bu işlem için yetkiniz yok.', 'woo-donation-popup')));
            wp_die();
        }

        $settings = array(
            'container_bg'    => isset($_POST['progress_container_bg']) ? sanitize_hex_color($_POST['progress_container_bg']) : '#f8fafc',
            'container_border'=> isset($_POST['progress_container_border']) ? sanitize_hex_color($_POST['progress_container_border']) : '#e2e8f0',
            'track_bg'        => isset($_POST['progress_track_bg']) ? sanitize_hex_color($_POST['progress_track_bg']) : '#e2e8f0',
            'fill_start'      => isset($_POST['progress_fill_start']) ? sanitize_hex_color($_POST['progress_fill_start']) : '#3b82f6',
            'fill_mid'        => isset($_POST['progress_fill_mid']) ? sanitize_hex_color($_POST['progress_fill_mid']) : '#2563eb',
            'fill_end'        => isset($_POST['progress_fill_end']) ? sanitize_hex_color($_POST['progress_fill_end']) : '#1d4ed8',
            'preview_bg'      => isset($_POST['progress_preview_bg']) ? sanitize_hex_color($_POST['progress_preview_bg']) : '#64748b',
            'percentage_bg'   => isset($_POST['progress_percentage_bg']) ? sanitize_hex_color($_POST['progress_percentage_bg']) : '#ffffff',
            'percentage_text' => isset($_POST['progress_percentage_text']) ? sanitize_hex_color($_POST['progress_percentage_text']) : '#1e293b',
        );

        update_option('wdp_progress_bar_settings', $settings);

        wp_send_json_success(array(
            'message' => __('Progress bar ayarları başarıyla kaydedildi.', 'woo-donation-popup'),
        ));

        wp_die();
    }
    
    /**
     * Modal görünüm ayarları tab'ını render et
     */
    private function render_modal_layout_customization_tab() {
        // Mevcut ayarları al
        $settings = get_option('wdp_modal_layout_settings', array());
        
        // Varsayılan değerler
        $defaults = array(
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
        
        $settings = wp_parse_args($settings, $defaults);
        
        echo '<div class="wdp-button-settings-container">';
        echo '<form id="wdp-modal-layout-settings-form">';
        
        // Masaüstü Modal Genişlik Ayarları
        echo '<h2>' . __('Masaüstü Modal Genişlik Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="popup_modal_width_desktop">' . __('Popup Modal Genişliği (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="popup_modal_width_desktop" name="popup_modal_width_desktop" value="' . esc_attr($settings['popup_modal_width_desktop']) . '" min="300" max="800" step="10" class="small-text" />';
        echo '<p class="description">' . __('Masaüstü için popup modal penceresinin genişliği (300-800px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="inpage_form_width_desktop">' . __('Sayfa İçi Form Genişliği (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="inpage_form_width_desktop" name="inpage_form_width_desktop" value="' . esc_attr($settings['inpage_form_width_desktop']) . '" min="300" max="800" step="10" class="small-text" />';
        echo '<p class="description">' . __('Masaüstü için sayfa içinde gösterilen formun genişliği (300-800px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Masaüstü Modal Padding Ayarları
        echo '<h2>' . __('Masaüstü Modal İç Boşluk (Padding) Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="modal_padding_top_desktop">' . __('Üst Boşluk (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="modal_padding_top_desktop" name="modal_padding_top_desktop" value="' . esc_attr($settings['modal_padding_top_desktop']) . '" min="0" max="100" step="1" class="small-text" />';
        echo '<p class="description">' . __('Masaüstü için modal içeriğinin üst boşluğu (0-100px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="modal_padding_right_desktop">' . __('Sağ Boşluk (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="modal_padding_right_desktop" name="modal_padding_right_desktop" value="' . esc_attr($settings['modal_padding_right_desktop']) . '" min="0" max="100" step="1" class="small-text" />';
        echo '<p class="description">' . __('Masaüstü için modal içeriğinin sağ boşluğu (0-100px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="modal_padding_bottom_desktop">' . __('Alt Boşluk (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="modal_padding_bottom_desktop" name="modal_padding_bottom_desktop" value="' . esc_attr($settings['modal_padding_bottom_desktop']) . '" min="0" max="100" step="1" class="small-text" />';
        echo '<p class="description">' . __('Masaüstü için modal içeriğinin alt boşluğu (0-100px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="modal_padding_left_desktop">' . __('Sol Boşluk (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="modal_padding_left_desktop" name="modal_padding_left_desktop" value="' . esc_attr($settings['modal_padding_left_desktop']) . '" min="0" max="100" step="1" class="small-text" />';
        echo '<p class="description">' . __('Masaüstü için modal içeriğinin sol boşluğu (0-100px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Mobil Modal Genişlik Ayarları
        echo '<h2>' . __('Mobil Modal Genişlik Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="popup_modal_width_mobile">' . __('Popup Modal Genişliği (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="popup_modal_width_mobile" name="popup_modal_width_mobile" value="' . esc_attr($settings['popup_modal_width_mobile']) . '" min="300" max="800" step="10" class="small-text" />';
        echo '<p class="description">' . __('Mobil için popup modal penceresinin genişliği (300-800px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="inpage_form_width_mobile">' . __('Sayfa İçi Form Genişliği (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="inpage_form_width_mobile" name="inpage_form_width_mobile" value="' . esc_attr($settings['inpage_form_width_mobile']) . '" min="300" max="800" step="10" class="small-text" />';
        echo '<p class="description">' . __('Mobil için sayfa içinde gösterilen formun genişliği (300-800px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Mobil Modal Padding Ayarları
        echo '<h2>' . __('Mobil Modal İç Boşluk (Padding) Ayarları', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="modal_padding_top_mobile">' . __('Üst Boşluk (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="modal_padding_top_mobile" name="modal_padding_top_mobile" value="' . esc_attr($settings['modal_padding_top_mobile']) . '" min="0" max="100" step="1" class="small-text" />';
        echo '<p class="description">' . __('Mobil için modal içeriğinin üst boşluğu (0-100px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="modal_padding_right_mobile">' . __('Sağ Boşluk (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="modal_padding_right_mobile" name="modal_padding_right_mobile" value="' . esc_attr($settings['modal_padding_right_mobile']) . '" min="0" max="100" step="1" class="small-text" />';
        echo '<p class="description">' . __('Mobil için modal içeriğinin sağ boşluğu (0-100px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="modal_padding_bottom_mobile">' . __('Alt Boşluk (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="modal_padding_bottom_mobile" name="modal_padding_bottom_mobile" value="' . esc_attr($settings['modal_padding_bottom_mobile']) . '" min="0" max="100" step="1" class="small-text" />';
        echo '<p class="description">' . __('Mobil için modal içeriğinin alt boşluğu (0-100px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '<tr>';
        echo '<th scope="row"><label for="modal_padding_left_mobile">' . __('Sol Boşluk (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="number" id="modal_padding_left_mobile" name="modal_padding_left_mobile" value="' . esc_attr($settings['modal_padding_left_mobile']) . '" min="0" max="100" step="1" class="small-text" />';
        echo '<p class="description">' . __('Mobil için modal içeriğinin sol boşluğu (0-100px arası)', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
        echo '</table>';
        
        // Kaydet butonu
        echo '<p class="submit">';
        echo '<button type="submit" id="wdp-save-modal-layout-settings" class="button button-primary">' . __('Ayarları Kaydet', 'woo-donation-popup') . '</button>';
        echo '<span class="spinner"></span>';
        echo '</p>';
        
        echo '</form>';
        echo '</div>';
    }
    
    /**
     * Modal görünüm ayarlarını kaydet (AJAX)
     */
    public function save_modal_layout_settings() {
        try {
            // Güvenlik kontrolü
            if (!check_ajax_referer('wdp_admin_nonce', 'nonce', false)) {
                wp_send_json_error(array('message' => __('Güvenlik kontrolü başarısız.', 'woo-donation-popup')));
                return;
            }
            
            // Yetki kontrolü
            if (!current_user_can('manage_woocommerce')) {
                wp_send_json_error(array('message' => __('Bu işlem için yetkiniz yok.', 'woo-donation-popup')));
                return;
            }
            
            // Ayarları al ve temizle - güvenli değer kontrolü
            $settings = array(
                // Desktop
                'popup_modal_width_desktop' => isset($_POST['popup_modal_width_desktop']) && $_POST['popup_modal_width_desktop'] !== '' ? absint($_POST['popup_modal_width_desktop']) : 540,
                'inpage_form_width_desktop' => isset($_POST['inpage_form_width_desktop']) && $_POST['inpage_form_width_desktop'] !== '' ? absint($_POST['inpage_form_width_desktop']) : 480,
                'modal_padding_top_desktop' => isset($_POST['modal_padding_top_desktop']) && $_POST['modal_padding_top_desktop'] !== '' ? absint($_POST['modal_padding_top_desktop']) : 32,
                'modal_padding_right_desktop' => isset($_POST['modal_padding_right_desktop']) && $_POST['modal_padding_right_desktop'] !== '' ? absint($_POST['modal_padding_right_desktop']) : 24,
                'modal_padding_bottom_desktop' => isset($_POST['modal_padding_bottom_desktop']) && $_POST['modal_padding_bottom_desktop'] !== '' ? absint($_POST['modal_padding_bottom_desktop']) : 24,
                'modal_padding_left_desktop' => isset($_POST['modal_padding_left_desktop']) && $_POST['modal_padding_left_desktop'] !== '' ? absint($_POST['modal_padding_left_desktop']) : 24,
                // Mobile
                'popup_modal_width_mobile' => isset($_POST['popup_modal_width_mobile']) && $_POST['popup_modal_width_mobile'] !== '' ? absint($_POST['popup_modal_width_mobile']) : 540,
                'inpage_form_width_mobile' => isset($_POST['inpage_form_width_mobile']) && $_POST['inpage_form_width_mobile'] !== '' ? absint($_POST['inpage_form_width_mobile']) : 480,
                'modal_padding_top_mobile' => isset($_POST['modal_padding_top_mobile']) && $_POST['modal_padding_top_mobile'] !== '' ? absint($_POST['modal_padding_top_mobile']) : 28,
                'modal_padding_right_mobile' => isset($_POST['modal_padding_right_mobile']) && $_POST['modal_padding_right_mobile'] !== '' ? absint($_POST['modal_padding_right_mobile']) : 20,
                'modal_padding_bottom_mobile' => isset($_POST['modal_padding_bottom_mobile']) && $_POST['modal_padding_bottom_mobile'] !== '' ? absint($_POST['modal_padding_bottom_mobile']) : 20,
                'modal_padding_left_mobile' => isset($_POST['modal_padding_left_mobile']) && $_POST['modal_padding_left_mobile'] !== '' ? absint($_POST['modal_padding_left_mobile']) : 20,
            );
        
        // Sınırlamalar - Desktop
        if ($settings['popup_modal_width_desktop'] < 300) {
            $settings['popup_modal_width_desktop'] = 300;
        }
        if ($settings['popup_modal_width_desktop'] > 800) {
            $settings['popup_modal_width_desktop'] = 800;
        }
        
        if ($settings['inpage_form_width_desktop'] < 300) {
            $settings['inpage_form_width_desktop'] = 300;
        }
        if ($settings['inpage_form_width_desktop'] > 800) {
            $settings['inpage_form_width_desktop'] = 800;
        }
        
        if ($settings['modal_padding_top_desktop'] > 100) {
            $settings['modal_padding_top_desktop'] = 100;
        }
        if ($settings['modal_padding_right_desktop'] > 100) {
            $settings['modal_padding_right_desktop'] = 100;
        }
        if ($settings['modal_padding_bottom_desktop'] > 100) {
            $settings['modal_padding_bottom_desktop'] = 100;
        }
        if ($settings['modal_padding_left_desktop'] > 100) {
            $settings['modal_padding_left_desktop'] = 100;
        }
        
        // Sınırlamalar - Mobile
        if ($settings['popup_modal_width_mobile'] < 300) {
            $settings['popup_modal_width_mobile'] = 300;
        }
        if ($settings['popup_modal_width_mobile'] > 800) {
            $settings['popup_modal_width_mobile'] = 800;
        }
        
        if ($settings['inpage_form_width_mobile'] < 300) {
            $settings['inpage_form_width_mobile'] = 300;
        }
        if ($settings['inpage_form_width_mobile'] > 800) {
            $settings['inpage_form_width_mobile'] = 800;
        }
        
        if ($settings['modal_padding_top_mobile'] > 100) {
            $settings['modal_padding_top_mobile'] = 100;
        }
        if ($settings['modal_padding_right_mobile'] > 100) {
            $settings['modal_padding_right_mobile'] = 100;
        }
        if ($settings['modal_padding_bottom_mobile'] > 100) {
            $settings['modal_padding_bottom_mobile'] = 100;
        }
        if ($settings['modal_padding_left_mobile'] > 100) {
            $settings['modal_padding_left_mobile'] = 100;
        }
        
            // Ayarları kaydet
            $saved = update_option('wdp_modal_layout_settings', $settings);
            
            if ($saved === false) {
                wp_send_json_error(array('message' => __('Ayarlar kaydedilirken bir hata oluştu.', 'woo-donation-popup')));
                return;
            }
            
            // Başarılı yanıt döndür
            wp_send_json_success(array(
                'message' => __('Modal görünüm ayarları başarıyla kaydedildi.', 'woo-donation-popup')
            ));
            
        } catch (Exception $e) {
            wp_send_json_error(array('message' => __('Bir hata oluştu: ', 'woo-donation-popup') . $e->getMessage()));
        }
    }
}

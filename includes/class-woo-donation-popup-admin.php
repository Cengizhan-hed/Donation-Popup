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
        
        // Tab navigasyonu
        echo '<nav class="nav-tab-wrapper">';
        echo '<a href="#wdp-products-tab" class="nav-tab nav-tab-active" data-tab="products">' . __('Ürün Ayarları', 'woo-donation-popup') . '</a>';
        echo '<a href="#wdp-normal-form-tab" class="nav-tab" data-tab="normal-form">' . __('Normal Form Özelleştirme', 'woo-donation-popup') . '</a>';
        echo '<a href="#wdp-shareholder-form-tab" class="nav-tab" data-tab="shareholder-form">' . __('Hisseli Form Özelleştirme', 'woo-donation-popup') . '</a>';
        echo '<a href="#wdp-success-screen-tab" class="nav-tab" data-tab="success-screen">' . __('Başarı Ekranı Özelleştirme', 'woo-donation-popup') . '</a>';
        echo '</nav>';
        
        // Ürün Ayarları Tab
        echo '<div id="wdp-products-tab" class="wdp-tab-content wdp-tab-active">';
        echo '<div class="wdp-settings-container">';
        echo '<table class="wp-list-table widefat fixed striped wdp-products-table">';
        echo '<thead>';
        echo '<tr>';
        echo '<th>' . __('Ürün', 'woo-donation-popup') . '</th>';
        echo '<th>' . __('Özel Fiyat', 'woo-donation-popup') . '</th>';
        echo '<th>' . __('Min. Fiyat (₺)', 'woo-donation-popup') . '</th>';
        echo '<th>' . __('Çoklu Hisse', 'woo-donation-popup') . '</th>';
        echo '<th>' . __('Maks. Hisse', 'woo-donation-popup') . '</th>';
        echo '<th>' . __('Shortcode', 'woo-donation-popup') . '</th>';
        echo '<th>' . __('İşlemler', 'woo-donation-popup') . '</th>';
        echo '</tr>';
        echo '</thead>';
        echo '<tbody>';
        
        if (empty($products)) {
            echo '<tr><td colspan="7">' . __('Hiç ürün bulunamadı.', 'woo-donation-popup') . '</td></tr>';
        } else {
            foreach ($products as $product) {
                $this->render_product_row($product);
            }
        }
        
        echo '</tbody>';
        echo '</table>';
        
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
        
        // Varsayılan değerler
        if ($min_custom_price === '') {
            $min_custom_price = '0';
        }
        
        if ($max_shares === '') {
            $max_shares = '7';
        }
        
        // Shortcode'lar
        $button_shortcode = '[wdp_donation_button id="' . $product->get_id() . '"]';
        $form_shortcode = '[wdp_donation_form id="' . $product->get_id() . '"]';
        
        echo '<tr data-product-id="' . $product->get_id() . '">';
        
        // Ürün adı
        echo '<td class="product-name">';
        echo '<a href="' . get_edit_post_link($product->get_id()) . '" target="_blank">' . $product->get_name() . '</a>';
        echo '<input type="hidden" name="product_id" value="' . $product->get_id() . '">';
        echo '</td>';
        
        // Özel fiyat
        echo '<td>';
        echo '<label class="wdp-switch">';
        echo '<input type="checkbox" name="allow_custom_price" ' . checked($allow_custom_price, true, false) . '>';
        echo '<span class="wdp-slider"></span>';
        echo '</label>';
        echo '</td>';
        
        // Minimum fiyat
        echo '<td>';
        echo '<input type="number" name="min_custom_price" value="' . esc_attr($min_custom_price) . '" min="0" step="1" class="small-text">';
        echo '</td>';
        
        // Çoklu hisse
        echo '<td>';
        echo '<label class="wdp-switch">';
        echo '<input type="checkbox" name="allow_multiple_shares" ' . checked($allow_multiple_shares, true, false) . '>';
        echo '<span class="wdp-slider"></span>';
        echo '</label>';
        echo '</td>';
        
        // Maksimum hisse
        echo '<td>';
        echo '<input type="number" name="max_shares" value="' . esc_attr($max_shares) . '" min="1" max="20" class="small-text">';
        echo '</td>';
        
        // Shortcode'lar - Burada değişiklik yapıyoruz
        echo '<td>';
        echo '<div class="wdp-shortcodes">';
        
        // Buton Shortcode
        echo '<div class="wdp-shortcode-item">';
        echo '<label>Buton:</label>';
        echo '<code class="wdp-shortcode">' . $button_shortcode . '</code>';
        echo '<button type="button" class="button button-small wdp-copy-shortcode" data-shortcode="' . esc_attr($button_shortcode) . '">' . __('Kopyala', 'woo-donation-popup') . '</button>';
        echo '</div>';
        
        // Form Shortcode
        echo '<div class="wdp-shortcode-item">';
        echo '<label>Form:</label>';
        echo '<code class="wdp-shortcode">' . $form_shortcode . '</code>';
        echo '<button type="button" class="button button-small wdp-copy-shortcode" data-shortcode="' . esc_attr($form_shortcode) . '">' . __('Kopyala', 'woo-donation-popup') . '</button>';
        echo '</div>';
        
        echo '</div>';
        echo '</td>';
        
        // İşlemler
        echo '<td>';
        echo '<button type="button" class="button wdp-save-product" data-product-id="' . $product->get_id() . '">' . __('Kaydet', 'woo-donation-popup') . '</button>';
        echo '<span class="spinner"></span>';
        echo '</td>';
        
        echo '</tr>';
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
        
        // Ayarları kaydet
        update_post_meta($product_id, '_allow_custom_price', $allow_custom_price);
        update_post_meta($product_id, '_min_custom_price', $min_custom_price);
        update_post_meta($product_id, '_allow_multiple_shares', $allow_multiple_shares);
        update_post_meta($product_id, '_max_shares', $max_shares);
        
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
        
        // Varsayılan değerler
        if ($min_custom_price === '') {
            $min_custom_price = '0';
        }
        
        if ($max_shares === '') {
            $max_shares = '7';
        }
        
        // Başarılı yanıt döndür
        wp_send_json_success(array(
            'allow_custom_price' => $allow_custom_price,
            'min_custom_price' => $min_custom_price,
            'allow_multiple_shares' => $allow_multiple_shares,
            'max_shares' => $max_shares
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
        );
        
        $settings = wp_parse_args($button_settings, $defaults);
        
        echo '<div class="wdp-button-settings-container">';
        echo '<form id="wdp-normal-form-settings-form">';
        
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
        
        // Buton Metinleri
        echo '<h2>' . __('Buton Metinleri', 'woo-donation-popup') . '</h2>';
        echo '<table class="form-table">';
        
        echo '<tr>';
        echo '<th scope="row"><label for="button_text_donate">' . __('Bağış Yap Butonu', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="text" id="button_text_donate" name="button_text_donate" value="' . esc_attr($settings['button_text_donate']) . '" class="regular-text" />';
        echo '<p class="description">' . __('Popup açan ana butonun metni', 'woo-donation-popup') . '</p>';
        echo '</td>';
        echo '</tr>';
        
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
        $modal_radius = isset($settings['modal_border_radius']) ? $settings['modal_border_radius'] : '12';
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
        $input_radius = isset($settings['input_border_radius']) ? $settings['input_border_radius'] : '8';
        echo '<input type="number" id="input_border_radius" name="input_border_radius" value="' . esc_attr($input_radius) . '" min="0" max="50" step="1" class="small-text" />';
        echo '<p class="description">' . __('Input alanlarının köşe yuvarlaklığı (0-50px arası)', 'woo-donation-popup') . '</p>';
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
        echo '<th scope="row"><label for="title_font_size">' . __('Başlık Font Boyutu (px)', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        $title_size = isset($settings['title_font_size']) ? $settings['title_font_size'] : '27';
        echo '<input type="number" id="title_font_size" name="title_font_size" value="' . esc_attr($title_size) . '" min="14" max="48" step="1" class="small-text" />';
        echo '<p class="description">' . __('Modal başlığının font boyutu (14-48px arası)', 'woo-donation-popup') . '</p>';
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
            'shareholders_area_radius' => '16',
            'shareholders_scrollbar_color' => '#4a90e2',
            'share_counter_border' => '#d1d5db',
            'share_counter_bg' => '#ffffff',
            'share_counter_button_color' => '#888888',
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
        echo '<th scope="row"><label for="shareholders_area_bg">' . __('Alan Arka Plan', 'woo-donation-popup') . '</label></th>';
        echo '<td>';
        echo '<input type="text" id="shareholders_area_bg" name="shareholders_area_bg" value="' . esc_attr($settings['shareholders_area_bg']) . '" class="regular-text" placeholder="linear-gradient(to bottom, #ffffff 0%, #fafbfc 100%)" />';
        echo '<p class="description">' . __('Hissedarlar alanının arka planı (renk veya gradient)', 'woo-donation-popup') . '</p>';
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
            'mini_cart_radius' => '8',
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
            'modal_border_radius' => isset($_POST['modal_border_radius']) ? absint($_POST['modal_border_radius']) : 12,
            'input_border_color' => isset($_POST['input_border_color']) ? sanitize_hex_color($_POST['input_border_color']) : '#d1d5db',
            'input_border_radius' => isset($_POST['input_border_radius']) ? absint($_POST['input_border_radius']) : 8,
            'title_color' => isset($_POST['title_color']) ? sanitize_hex_color($_POST['title_color']) : '#1f2937',
            'title_font_size' => isset($_POST['title_font_size']) ? absint($_POST['title_font_size']) : 27,
            'close_button_color' => isset($_POST['close_button_color']) ? sanitize_hex_color($_POST['close_button_color']) : '#6b7280',
            'button_checkout_color' => isset($_POST['button_checkout_color']) ? sanitize_hex_color($_POST['button_checkout_color']) : '#48bb78',
            'button_checkout_hover' => isset($_POST['button_checkout_hover']) ? sanitize_hex_color($_POST['button_checkout_hover']) : '#38a169',
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
        
        // Font size sınırlamaları
        if ($settings['title_font_size'] < 14) {
            $settings['title_font_size'] = 14;
        }
        if ($settings['title_font_size'] > 48) {
            $settings['title_font_size'] = 48;
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
            'shareholders_area_bg' => isset($_POST['shareholders_area_bg']) ? sanitize_text_field($_POST['shareholders_area_bg']) : 'linear-gradient(to bottom, #ffffff 0%, #fafbfc 100%)',
            'shareholders_area_border' => isset($_POST['shareholders_area_border']) ? sanitize_hex_color($_POST['shareholders_area_border']) : '#e1e5e9',
            'shareholders_area_radius' => isset($_POST['shareholders_area_radius']) ? absint($_POST['shareholders_area_radius']) : 16,
            'shareholders_scrollbar_color' => isset($_POST['shareholders_scrollbar_color']) ? sanitize_hex_color($_POST['shareholders_scrollbar_color']) : '#4a90e2',
            'share_counter_border' => isset($_POST['share_counter_border']) ? sanitize_hex_color($_POST['share_counter_border']) : '#d1d5db',
            'share_counter_bg' => isset($_POST['share_counter_bg']) ? sanitize_hex_color($_POST['share_counter_bg']) : '#ffffff',
            'share_counter_button_color' => isset($_POST['share_counter_button_color']) ? sanitize_hex_color($_POST['share_counter_button_color']) : '#888888',
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
            'success_button_radius' => isset($_POST['success_button_radius']) ? absint($_POST['success_button_radius']) : 24,
            'success_text_view_cart' => isset($_POST['success_text_view_cart']) ? sanitize_text_field($_POST['success_text_view_cart']) : 'Sepeti Görüntüle',
            'success_text_go_checkout' => isset($_POST['success_text_go_checkout']) ? sanitize_text_field($_POST['success_text_go_checkout']) : 'Ödemeye Git',
            'success_text_new_donation' => isset($_POST['success_text_new_donation']) ? sanitize_text_field($_POST['success_text_new_donation']) : 'Yeni Bağış Ekle',
            'success_message_bg' => isset($_POST['success_message_bg']) ? sanitize_text_field($_POST['success_message_bg']) : 'rgba(72, 187, 120, 0.1)',
            'success_message_color' => isset($_POST['success_message_color']) ? sanitize_hex_color($_POST['success_message_color']) : '#48bb78',
            'success_message_border' => isset($_POST['success_message_border']) ? sanitize_text_field($_POST['success_message_border']) : 'rgba(72, 187, 120, 0.2)',
            'success_message_radius' => isset($_POST['success_message_radius']) ? absint($_POST['success_message_radius']) : 8,
            'mini_cart_bg' => isset($_POST['mini_cart_bg']) ? sanitize_hex_color($_POST['mini_cart_bg']) : '#f9fafb',
            'mini_cart_border' => isset($_POST['mini_cart_border']) ? sanitize_hex_color($_POST['mini_cart_border']) : '#e5e7eb',
            'mini_cart_radius' => isset($_POST['mini_cart_radius']) ? absint($_POST['mini_cart_radius']) : 8,
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
}

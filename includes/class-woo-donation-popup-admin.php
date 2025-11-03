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
        echo '<p>' . __('Bu sayfadan bağış popup\'ları için ürün ayarlarını yönetebilirsiniz.', 'woo-donation-popup') . '</p>';
        
        // Başarı/hata mesajları için alan
        echo '<div id="wdp-admin-notices" class="notice" style="display:none;"></div>';
        
        // Ürün ayarları tablosu
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
}

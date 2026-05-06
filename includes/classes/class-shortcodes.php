<?php
/**
 * Shortcodes class
 * Handles shortcode registration and rendering
 * 
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Class WDP_Shortcodes
 */
class WDP_Shortcodes {

    /**
     * Initialize shortcodes
     */
    public static function init() {
        // Shortcode ekle
        add_shortcode('wdp_donation_button', array(__CLASS__, 'donation_button_shortcode'));

        // Yeni shortcode ekle - doğrudan form için
        add_shortcode('wdp_donation_form', array(__CLASS__, 'donation_form_shortcode'));
    }

    /**
     * Donation button shortcode
     *
     * @param array $atts Shortcode attributes.
     * @return string
     */
    public static function donation_button_shortcode($atts) {
        // Shortcode parametrelerini al ve güvenli hale getir
        $atts = shortcode_atts(array(
            'id' => 0,
            'text' => __('Bağış Yap', 'woo-donation-popup'),
            'class' => '',
            'style' => '',
        ), $atts, 'wdp_donation_button');

        // Ürün ID'sini integer'a çevir ve güvenlik kontrolü yap
        $product_id = absint($atts['id']);

        // Buton metni
        $button_text = sanitize_text_field($atts['text']);

        // Özel sınıf ve stil
        $custom_class = sanitize_html_class($atts['class']);
        $custom_style = sanitize_text_field($atts['style']);

        // Ürünün varlığını kontrol et
        $product = WDP_Donation_Product_Context_Service::get_product($product_id);
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

        // Assets'i zorla yükle
        WDP_Assets::force_enqueue();
        
        // Eğer wp_enqueue_scripts geçtiyse, direkt yükle (güvenlik için)
        if (did_action('wp_enqueue_scripts')) {
            // wp_footer'da yüklenecek ama emin olmak için şimdi de kontrol et
            if (class_exists('WDP_Assets')) {
                WDP_Assets::enqueue_assets_now();
            }
        }

        // Tetikleyici görünümü: renk / boyut / hover wp_add_inline_style ile :root + buttons.css üzerinden gelir.
        // Arka plan veya fontu burada inline vermek :hover renginin üstünü örter (inline > stylesheet).
        $inline_styles = array();
        if (!empty($custom_style)) {
            $inline_styles[] = $custom_style;
        }
        $combined_style = !empty($inline_styles) ? implode(' ', $inline_styles) : '';

        $button_settings = WDP_Utils::normalize_legacy_popup_button_text(
            get_option('wdp_button_settings', array())
        );

        // Full width ayarını kontrol et
        $is_full_width = isset($button_settings['popup_button_full_width']) && $button_settings['popup_button_full_width'] === '1';
        $button_classes = 'wdp-donate-button wdp-open-modal wdp-shortcode-trigger';
        if ($is_full_width) {
            $button_classes .= ' wdp-donate-button-full-width';
        }
        if (!empty($custom_class)) {
            $button_classes .= ' ' . esc_attr($custom_class);
        }
        
        // Sadece buton oluştur, modal ayrı oluşturulacak
        ob_start();
        ?>
        <!-- Bağış Butonu -->
        <button type="button" class="<?php echo esc_attr($button_classes); ?>"
                data-product-id="<?php echo esc_attr($product_id); ?>"
                style="<?php echo esc_attr($combined_style); ?>">
            <?php echo esc_html($button_text); ?>
        </button>

        <!-- Modal - Ayrı oluşturuluyor -->
        <?php echo WDP_Templates::render_donation_modal($product_id, $button_text, $custom_class, $custom_style); ?>
        <?php
        return ob_get_clean();
    }

    /**
     * Donation form shortcode
     *
     * @param array $atts Shortcode attributes.
     * @return string
     */
    public static function donation_form_shortcode($atts) {
        // Shortcode parametrelerini al
        $atts = shortcode_atts(array(
            'id' => 0,
            'button_text' => __('Bağış Yap', 'woo-donation-popup'),
            'title' => '', // Özel başlık
            'show_title' => 'yes', // Başlığı göster/gizle
            'class' => '', // Özel CSS sınıfı
        ), $atts, 'wdp_donation_form');

        // Ürün ID'sini integer'a çevir
        $product_id = absint($atts['id']);

        // Buton metni
        $button_text = sanitize_text_field($atts['button_text']);

        // Özel sınıf
        $custom_class = sanitize_text_field($atts['class']);

        // Ürünün varlığını kontrol et
        $product = WDP_Donation_Product_Context_Service::get_product($product_id);
        if (!$product) {
            if (current_user_can('manage_options')) {
                return '<p style="color:red;">Ürün bulunamadı (ID: ' . esc_html($product_id) . '). Lütfen ürün ID\'sini kontrol edin.</p>';
            }
            return '';
        }

        // Assets'i zorla yükle
        WDP_Assets::force_enqueue();
        
        // Eğer wp_enqueue_scripts geçtiyse, direkt yükle (güvenlik için)
        if (did_action('wp_enqueue_scripts')) {
            // wp_footer'da yüklenecek ama emin olmak için şimdi de kontrol et
            if (class_exists('WDP_Assets')) {
                WDP_Assets::enqueue_assets_now();
            }
        }

        // Form'u render et
        return WDP_Templates::render_donation_form($product_id, $atts);
    }
}

// Note: init() is called by Woo_Donation_Popup::__construct()


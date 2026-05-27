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
        add_shortcode('wdp_donation_button', array(__CLASS__, 'donation_button_shortcode'));
        add_shortcode('wdp_donation_button_panel', array(__CLASS__, 'donation_button_panel_shortcode'));
        add_shortcode('wdp_donation_form', array(__CLASS__, 'donation_form_shortcode'));
    }

    /**
     * Donation button shortcode (center popup).
     *
     * @param array $atts Shortcode attributes.
     * @return string
     */
    public static function donation_button_shortcode($atts) {
        return self::render_donation_button_markup($atts, 'wdp_donation_button', 'popup');
    }

    /**
     * Donation button shortcode (right side panel).
     *
     * @param array $atts Shortcode attributes.
     * @return string
     */
    public static function donation_button_panel_shortcode($atts) {
        return self::render_donation_button_markup($atts, 'wdp_donation_button_panel', 'side_panel');
    }

    /**
     * Shared button + modal renderer for popup and side panel triggers.
     *
     * @param array  $atts         Shortcode attributes.
     * @param string $shortcode_tag Shortcode tag name.
     * @param string $display_mode popup|side_panel.
     * @return string
     */
    private static function render_donation_button_markup($atts, $shortcode_tag, $display_mode) {
        $atts = shortcode_atts(
            array(
                'id'    => 0,
                'text'  => '',
                'class' => '',
                'style' => '',
            ),
            $atts,
            $shortcode_tag
        );

        $product_id = absint($atts['id']);
        $custom_class = sanitize_html_class($atts['class']);
        $custom_style = sanitize_text_field($atts['style']);

        $button_settings = WDP_Utils::normalize_legacy_popup_button_text(
            get_option('wdp_button_settings', array())
        );

        if ($atts['text'] !== '') {
            $button_text = sanitize_text_field($atts['text']);
        } elseif (!empty($button_settings['popup_button_text'])) {
            $button_text = sanitize_text_field($button_settings['popup_button_text']);
        } else {
            $button_text = __('Bağış Yap', 'woo-donation-popup');
        }

        $product = WDP_Donation_Product_Context_Service::get_product($product_id);
        if (!$product) {
            if (current_user_can('manage_options')) {
                return '<p style="color:red;">Ürün bulunamadı (ID: ' . esc_html($product_id) . '). Lütfen ürün ID\'sini kontrol edin.</p>';
            }
            return '';
        }

        if (!$product->is_purchasable()) {
            if (current_user_can('manage_options')) {
                return '<p style="color:red;">Bu ürün satın alınamaz (ID: ' . esc_html($product_id) . ').</p>';
            }
            return '';
        }

        if (!$product->is_in_stock()) {
            if (current_user_can('manage_options')) {
                return '<p style="color:red;">Bu ürün stokta yok (ID: ' . esc_html($product_id) . ').</p>';
            }
            return '';
        }

        WDP_Assets::force_enqueue();

        if (did_action('wp_enqueue_scripts') && class_exists('WDP_Assets')) {
            WDP_Assets::enqueue_assets_now();
        }

        $inline_styles = array();
        if (!empty($custom_style)) {
            $inline_styles[] = $custom_style;
        }
        $combined_style = !empty($inline_styles) ? implode(' ', $inline_styles) : '';

        $is_full_width = isset($button_settings['popup_button_full_width']) && $button_settings['popup_button_full_width'] === '1';
        $is_side_panel = ($display_mode === 'side_panel');

        $open_class = $is_side_panel ? 'wdp-open-modal wdp-open-side-panel' : 'wdp-open-modal';
        $button_classes = 'wdp-donate-button ' . $open_class . ' wdp-shortcode-trigger';
        if ($is_full_width) {
            $button_classes .= ' wdp-donate-button-full-width';
        }
        if (!empty($custom_class)) {
            $button_classes .= ' ' . esc_attr($custom_class);
        }

        ob_start();
        ?>
        <!-- Bağış Butonu -->
        <button type="button" class="<?php echo esc_attr($button_classes); ?>"
                data-product-id="<?php echo esc_attr($product_id); ?>"
                <?php if ($is_side_panel) : ?>data-wdp-modal-id="<?php echo esc_attr('wdp-side-panel-' . $product_id); ?>" <?php endif; ?>
                style="<?php echo esc_attr($combined_style); ?>">
            <?php echo esc_html($button_text); ?>
        </button>

        <!-- Modal -->
        <?php
        echo WDP_Templates::render_donation_modal($product_id, $button_text, $custom_class, $custom_style, $display_mode);
        return ob_get_clean();
    }

    /**
     * Donation form shortcode
     *
     * @param array $atts Shortcode attributes.
     * @return string
     */
    public static function donation_form_shortcode($atts) {
        $atts = shortcode_atts(array(
            'id' => 0,
            'button_text' => __('Bağış Yap', 'woo-donation-popup'),
            'title' => '',
            'show_title' => 'yes',
            'class' => '',
        ), $atts, 'wdp_donation_form');

        $product_id = absint($atts['id']);
        $button_text = sanitize_text_field($atts['button_text']);
        $custom_class = sanitize_text_field($atts['class']);

        $product = WDP_Donation_Product_Context_Service::get_product($product_id);
        if (!$product) {
            if (current_user_can('manage_options')) {
                return '<p style="color:red;">Ürün bulunamadı (ID: ' . esc_html($product_id) . '). Lütfen ürün ID\'sini kontrol edin.</p>';
            }
            return '';
        }

        WDP_Assets::force_enqueue();

        if (did_action('wp_enqueue_scripts') && class_exists('WDP_Assets')) {
            WDP_Assets::enqueue_assets_now();
        }

        return WDP_Templates::render_donation_form($product_id, $atts);
    }
}

// Note: init() is called by Woo_Donation_Popup::__construct()

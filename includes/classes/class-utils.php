<?php
/**
 * Utilities class
 * 
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Class WDP_Utils
 */
class WDP_Utils {

    /**
     * Debug logging enabled flag.
     *
     * @var bool
     */
    private static $debug_enabled = false;

    /**
     * Whether woocommerce_update_product cache hook was registered.
     *
     * @var bool
     */
    private static $wc_product_cache_invalidation_hook_registered = false;

    /**
     * Initialize the utility class.
     * 
     * @since 10.0
     * @return void
     */
    public static function init() {
        self::$debug_enabled = (bool) (defined('WP_DEBUG') && WP_DEBUG);

        // Progress bar toplamlarını artımlı güncelle (büyük sipariş hacminde tam taramayı azaltır).
        add_action('woocommerce_order_status_completed', array(__CLASS__, 'sync_order_donation_totals_on_complete'), 20, 1);
        add_action('woocommerce_order_refunded', array(__CLASS__, 'sync_order_donation_totals_on_refund'), 20, 2);

        // Ürün veya bağışa ilişkin ürün meta'sı değişince get_product_info / sepet AJAX önbelleğini tek merkezden temizle.
        add_action('updated_post_meta', array(__CLASS__, 'maybe_invalidate_product_donation_caches_on_meta'), 10, 4);
        add_action('added_post_meta', array(__CLASS__, 'maybe_invalidate_product_donation_caches_on_meta'), 10, 4);
        add_action('deleted_post_meta', array(__CLASS__, 'maybe_invalidate_product_donation_caches_on_meta'), 10, 4);
        add_action('save_post_product', array(__CLASS__, 'invalidate_product_donation_caches_on_product_save'), 10, 3);
        if (did_action('woocommerce_loaded')) {
            self::register_wc_product_cache_invalidation_hook();
        } else {
            add_action('woocommerce_loaded', array(__CLASS__, 'register_wc_product_cache_invalidation_hook'), 1);
        }

        // Ürün çöpe gider veya kalıcı silinirken önbellekte yetim anahtar kalmasın (object cache / Redis).
        add_action('before_delete_post', array(__CLASS__, 'purge_product_donation_caches_on_delete'), 10, 2);
        add_action('wp_trash_post', array(__CLASS__, 'purge_product_donation_caches_on_trash'), 10, 1);
    }

    /**
     * Register WC product save hook once (safe if called early or after woocommerce_loaded).
     *
     * @return void
     */
    public static function register_wc_product_cache_invalidation_hook() {
        if (self::$wc_product_cache_invalidation_hook_registered) {
            return;
        }
        self::$wc_product_cache_invalidation_hook_registered = true;
        add_action('woocommerce_update_product', array(__CLASS__, 'invalidate_product_donation_caches_on_wc_product'), 10, 1);
    }

    /**
     * WooCommerce fiyat HTML'i; gereksiz sondaki ondalıkları kaldırır (ör. tam sayılarda ",00" yok).
     *
     * @param float|string $amount Ham tutar.
     * @param array        $args   wc_price() için ek argümanlar.
     * @return string Güvenli HTML.
     */
    /**
     * Decode HTML entities to UTF-8 text (e.g. &#8378; → ₺).
     *
     * @param string $text Raw text.
     * @return string
     */
    public static function decode_text_entities($text) {
        $text = (string) $text;
        if ($text === '') {
            return '';
        }

        $charset = function_exists('get_bloginfo') ? (string) get_bloginfo('charset') : 'UTF-8';
        if ($charset === '') {
            $charset = 'UTF-8';
        }

        return html_entity_decode($text, ENT_QUOTES | ENT_HTML5, $charset);
    }

    /**
     * Currency symbol safe for plain text / esc_html output.
     *
     * @param string $symbol Optional symbol; defaults to WooCommerce currency.
     * @return string
     */
    public static function get_display_currency_symbol($symbol = '') {
        if ($symbol === '' && function_exists('get_woocommerce_currency_symbol')) {
            $symbol = get_woocommerce_currency_symbol();
        }
        if ($symbol === '') {
            $symbol = '₺';
        }

        return self::decode_text_entities($symbol);
    }

    public static function format_price_html($amount, array $args = array()) {
        if ($amount === '' || $amount === null) {
            return '';
        }
        if (!function_exists('wc_price')) {
            return '';
        }
        $numeric = floatval($amount);
        if (!is_finite($numeric)) {
            return '';
        }
        $args = array_merge(
            array(
                'trim_zeros' => true,
            ),
            $args
        );

        $html = wp_kses_post(wc_price($numeric, $args));

        return self::decode_text_entities($html);
    }

    /**
     * Placeholder / düz metin için fiyat (HTML etiketleri yok).
     *
     * @param float|string $amount Ham tutar.
     * @return string
     */
    public static function format_price_plain($amount) {
        $raw = wp_strip_all_tags(self::format_price_html($amount));
        if ($raw === '') {
            return '';
        }

        // wc_price() bazı para birimi sembollerini HTML entity olarak döndürebilir (örn: &#8378;).
        // Mini-cart tarafında düz metin beklediğimiz için entity'leri Unicode karaktere çözüyoruz.
        $charset = function_exists('get_bloginfo') ? (string) get_bloginfo('charset') : 'UTF-8';
        if ($charset === '') {
            $charset = 'UTF-8';
        }

        return html_entity_decode($raw, ENT_QUOTES | ENT_HTML5, $charset);
    }

    /**
     * Minimum tutarı placeholder için sayısal gösterim (para birimi simgesi yok; ayırıcılar Woo ayarlarına uygun).
     *
     * @param float|string $amount Ham tutar.
     * @return string
     */
    public static function format_amount_for_min_placeholder($amount) {
        if ($amount === '' || $amount === null) {
            return '';
        }
        $numeric = floatval($amount);
        if (!is_finite($numeric)) {
            return '';
        }
        if (!function_exists('wc_get_price_decimal_separator')) {
            return (string) (abs($numeric - round($numeric)) < 0.0000001 ? (int) round($numeric) : round($numeric, 2));
        }
        $dec = wc_get_price_decimal_separator();
        $thousands = wc_get_price_thousand_separator();
        $dp = absint(wc_get_price_decimals());
        $formatted = number_format($numeric, $dp, $dec, $thousands);
        if ($dp > 0 && strpos($formatted, $dec) !== false) {
            $parts = explode($dec, $formatted, 2);
            $whole = $parts[0];
            $frac = isset($parts[1]) ? rtrim($parts[1], '0') : '';
            $formatted = $frac !== '' ? $whole . $dec . $frac : $whole;
        }
        return $formatted;
    }

    /**
     * Alt bağış satırı için ürün meta'sındaki WooCommerce ürün ID'si.
     *
     * @param int|WC_Product $parent_product Ana bağış ürünü.
     * @return int Geçerli WC ürün ID veya 0.
     */
    public static function resolve_sadaka_wc_product_id($parent_product) {
        $configured = self::get_configured_sadaka_wc_product_id($parent_product);
        if ($configured <= 0) {
            return 0;
        }

        /**
         * Alt bağış sepet satırında kullanılacak WooCommerce ürün ID.
         *
         * @param int $configured Ürün meta _sadaka_wc_product_id.
         * @param int $parent_id  Ana bağış ürün ID.
         */
        $parent_id = $parent_product instanceof WC_Product
            ? (int) $parent_product->get_id()
            : absint($parent_product);
        $filtered = apply_filters('wdp_sadaka_wc_product_id', $configured, $parent_id);
        $product_id = absint($filtered);

        return self::is_valid_sadaka_wc_product($product_id) ? $product_id : 0;
    }

    /**
     * Sadaka sepet satırı için kullanılabilir WC ürünü (gizli/katalog ürünleri dahil).
     *
     * @param int $product_id Product ID.
     * @return bool
     */
    public static function is_valid_sadaka_wc_product($product_id) {
        $product_id = absint($product_id);
        if ($product_id <= 0) {
            return false;
        }

        $product = wc_get_product($product_id);
        if (!$product || !$product->exists()) {
            return false;
        }

        $status = $product->get_status();
        return in_array($status, array('publish', 'private'), true);
    }

    /**
     * Genel alt bağış WC ürün ID (Başarı & Mini Sepet). Varsayılan: 10721.
     *
     * @return int
     */
    public static function get_default_sadaka_wc_product_id() {
        $settings = get_option('wdp_success_settings', array());
        $id = 10721;
        if (is_array($settings) && !empty($settings['sadaka_wc_product_id'])) {
            $id = absint($settings['sadaka_wc_product_id']);
        }
        return $id > 0 ? $id : 10721;
    }

    /**
     * Alt bağış aç/kapa buton metni (ürün meta → genel ayar → varsayılan).
     *
     * @param WC_Product|int|null $parent_product Ana bağış ürünü.
     * @return string
     */
    public static function get_sadaka_toggle_label($parent_product = null) {
        if ($parent_product !== null) {
            $parent = $parent_product instanceof WC_Product ? $parent_product : wc_get_product((int) $parent_product);
            if ($parent) {
                $per_product = trim((string) $parent->get_meta('_sadaka_toggle_label'));
                if ($per_product !== '') {
                    return sanitize_text_field($per_product);
                }
            }
        }

        $settings = get_option('wdp_success_settings', array());
        if (is_array($settings) && !empty($settings['sadaka_toggle_label'])) {
            $label = sanitize_text_field($settings['sadaka_toggle_label']);
            if ($label !== '') {
                return $label;
            }
        }

        return __('Alt Bağış Ekle', 'woo-donation-popup');
    }

    /**
     * Ürün meta veya genel ayar alt bağış WC ürün ID'si.
     *
     * @param WC_Product|int $parent_product Ana bağış ürünü.
     * @return int
     */
    public static function get_configured_sadaka_wc_product_id($parent_product) {
        $parent = $parent_product instanceof WC_Product ? $parent_product : wc_get_product((int) $parent_product);
        if (!$parent) {
            return self::get_default_sadaka_wc_product_id();
        }

        $per_product = absint($parent->get_meta('_sadaka_wc_product_id'));
        if ($per_product > 0) {
            return $per_product;
        }

        return self::get_default_sadaka_wc_product_id();
    }

    /**
     * Alt bağış sabit fiyatı (ürün meta). 0 = özel tutar modu.
     *
     * @param WC_Product|int $parent_product Ana bağış ürünü.
     * @return float
     */
    public static function get_sadaka_fixed_price($parent_product) {
        $parent = $parent_product instanceof WC_Product ? $parent_product : wc_get_product((int) $parent_product);
        if (!$parent) {
            return 0.0;
        }

        $raw = $parent->get_meta('_sadaka_fixed_price');
        if ($raw === '' || $raw === null) {
            return 0.0;
        }

        $value = (float) wc_format_decimal($raw);
        return $value > 0 ? $value : 0.0;
    }

    /**
     * Log debug message.
     * 
     * Only logs if WP_DEBUG is enabled. Supports arrays, objects, and strings.
     *
     * @since 10.0
     * @param mixed $message Message to log. Can be string, array, or object.
     * @return void
     */
    public static function log($message) {
        if (!self::$debug_enabled) {
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
     * Handles both string messages and WDP_Exception objects.
     * Automatically logs exceptions and includes validation errors if available.
     *
     * @since 10.0
     * @param string|WDP_Exception $message Error message or exception object.
     * @param array                $extra   Extra data to include in response.
     * @return never
     * @throws Never Returns, always terminates execution.
     */
    public static function json_error($message, array $extra = array()) {
        $error_message = is_string($message) ? $message : '';
        $error_code = 500;
        $error_data = array();

        // Handle exception objects
        if ($message instanceof WDP_Exception) {
            $error_message = $message->getMessage();
            $error_code = $message->getCode();
            
            // Log the exception
            $message->log();
            
            // Include validation errors if available
            if ($message instanceof WDP_Validation_Exception) {
                $error_data['errors'] = $message->getErrors();
            }
        } elseif (is_string($message)) {
            $error_message = $message;
        }

        $response = array_merge(
            array(
                'success' => false,
                'message' => $error_message,
                'code' => $error_code,
            ),
            $error_data,
            $extra
        );

        wp_send_json($response);
        wp_die();
    }
    
    /**
     * Handle exception gracefully.
     * 
     * Logs the exception and optionally sends a JSON error response.
     *
     * @since 10.0
     * @param Exception $exception      Exception object to handle.
     * @param bool      $json_response  Whether to send JSON response. Default false.
     * @return void
     */
    public static function handle_exception(Exception $exception, $json_response = false) {
        self::log(array(
            'exception' => get_class($exception),
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $exception->getTraceAsString(),
        ));

        if ($json_response) {
            $message = __('Bir hata oluştu. Lütfen tekrar deneyin.', 'woo-donation-popup');
            
            if ($exception instanceof WDP_Exception) {
                $message = $exception->getMessage();
            } elseif (self::$debug_enabled) {
                $message = $exception->getMessage();
            }

            self::json_error($message);
        }
    }

    /**
     * Send JSON success response and terminate execution.
     *
     * @since 10.0
     * @param array $data Data to include in success response.
     * @return never
     * @throws Never Returns, always terminates execution.
     */
    public static function json_success(array $data = array()) {
        wp_send_json(array_merge(
            array(
                'success' => true,
            ),
            $data
        ));
        wp_die();
    }

    /**
     * Get total donation amount for a product from completed orders.
     * 
     * ÖNEMLİ: Bu fonksiyon SADECE belirtilen ürün ID'si için yapılan bağışları sayar.
     * Her ürün için ayrı progress bar olduğundan, ürünler birbirine karışmaz.
     *
     * @since 10.2.0
     * @param int $product_id Product ID. Sadece bu ürün için yapılan bağışlar sayılır.
     * @return float Total donation amount for this specific product only.
     */
    public static function get_total_donation_amount($product_id) {
        $product_id = absint($product_id);
        
        if (!$product_id) {
            return 0.0;
        }

        // Cache key - her ürün için ayrı cache
        $cache_key = 'wdp_total_donation_' . $product_id;
        
        // Try to get from cache first
        $cached = wp_cache_get($cache_key, 'wdp_donations');
        if (false !== $cached) {
            return floatval($cached);
        }

        $meta_total = get_post_meta($product_id, '_wdp_total_donation_amount', true);
        if ($meta_total !== '' && is_numeric($meta_total)) {
            $meta_total = max(0.0, floatval($meta_total));
            wp_cache_set($cache_key, $meta_total, 'wdp_donations', HOUR_IN_SECONDS);
            return $meta_total;
        }

        // Get total from completed orders ONLY (not from cart)
        // SADECE bu ürün için yapılan bağışları say
        $total = 0.0;

        // Büyük mağazalarda memory/CPU maliyetini azaltmak için siparişleri sayfalar halinde işle.
        $page = 1;
        $per_page = 200;

        do {
            $order_query = wc_get_orders(array(
                'status' => array('wc-completed'),
                'limit' => $per_page,
                'page' => $page,
                'paginate' => true,
                'return' => 'objects',
            ));

            if (empty($order_query) || empty($order_query->orders)) {
                break;
            }

            foreach ($order_query->orders as $order) {
                if (!$order) {
                    continue;
                }

                foreach ($order->get_items() as $item) {
                    $item_product_id = (int) $item->get_product_id();
                    if ($item_product_id !== $product_id) {
                        continue;
                    }

                    $custom_price = $item->get_meta('_custom_price');
                    if ($custom_price && floatval($custom_price) > 0) {
                        $total += floatval($custom_price) * $item->get_quantity();
                    } else {
                        $item_total = floatval($item->get_total());
                        if ($item_total > 0) {
                            $total += $item_total;
                        }
                    }
                }
            }

            $page++;
        } while ($page <= (int) $order_query->max_num_pages);

        update_post_meta($product_id, '_wdp_total_donation_amount', $total);

        // Cache for 1 hour - her ürün için ayrı cache
        wp_cache_set($cache_key, $total, 'wdp_donations', HOUR_IN_SECONDS);

        // ÖNEMLİ: Sadece bu ürün için yapılan bağışların toplamını döndür
        // Farklı ürünlerin bağışları birbirine karışmaz
        return floatval($total);
    }

    /**
     * Sipariş tamamlandığında artımlı bağış toplamlarını güncelle.
     *
     * @param int $order_id WooCommerce order id.
     * @return void
     */
    public static function sync_order_donation_totals_on_complete($order_id) {
        $order_id = absint($order_id);
        if (!$order_id) {
            return;
        }

        $already_applied = get_post_meta($order_id, '_wdp_donation_totals_applied', true);
        if ($already_applied === 'yes') {
            return;
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        foreach ($order->get_items() as $item) {
            $product_id = absint($item->get_product_id());
            if (!$product_id) {
                continue;
            }

            $line_total = self::resolve_donation_line_total($item);
            if ($line_total <= 0) {
                continue;
            }

            self::update_product_donation_total($product_id, $line_total);
        }

        update_post_meta($order_id, '_wdp_donation_totals_applied', 'yes');
    }

    /**
     * Refund oluştuğunda ürün bazlı bağış toplamını azalt.
     *
     * @param int $order_id  Parent order id.
     * @param int $refund_id Refund order id.
     * @return void
     */
    public static function sync_order_donation_totals_on_refund($order_id, $refund_id) {
        $refund_id = absint($refund_id);
        if (!$refund_id) {
            return;
        }

        $already_reverted = get_post_meta($refund_id, '_wdp_donation_totals_reverted', true);
        if ($already_reverted === 'yes') {
            return;
        }

        $refund = wc_get_order($refund_id);
        if (!$refund || !is_a($refund, 'WC_Order_Refund')) {
            return;
        }

        foreach ($refund->get_items() as $item) {
            $product_id = absint($item->get_product_id());
            if (!$product_id) {
                continue;
            }

            // Refund satır toplamı negatif gelir; mevcut toplama delta olarak uygula.
            $refund_total = floatval($item->get_total());
            if ($refund_total === 0.0) {
                continue;
            }

            self::update_product_donation_total($product_id, $refund_total);
        }

        update_post_meta($refund_id, '_wdp_donation_totals_reverted', 'yes');
    }

    /**
     * Resolve effective donation total for an order line.
     *
     * @param WC_Order_Item_Product $item Order line item.
     * @return float
     */
    private static function resolve_donation_line_total($item) {
        $custom_price = $item->get_meta('_custom_price');
        if ($custom_price !== '' && is_numeric($custom_price) && floatval($custom_price) > 0) {
            return floatval($custom_price) * max(1, intval($item->get_quantity()));
        }

        return max(0.0, floatval($item->get_total()));
    }

    /**
     * Update product donation total and invalidate relevant caches.
     *
     * @param int   $product_id Product id.
     * @param float $delta      Delta amount (positive/negative).
     * @return void
     */
    private static function update_product_donation_total($product_id, $delta) {
        $product_id = absint($product_id);
        if (!$product_id || !is_numeric($delta) || floatval($delta) == 0.0) {
            return;
        }

        $current_total = floatval(get_post_meta($product_id, '_wdp_total_donation_amount', true));
        $next_total = max(0.0, $current_total + floatval($delta));

        update_post_meta($product_id, '_wdp_total_donation_amount', $next_total);
        wp_cache_delete('wdp_total_donation_' . $product_id, 'wdp_donations');
    }

    /**
     * Clear transient/object caches used for product donation info and WC product objects (WDP_Ajax).
     *
     * @param int $product_id Product ID.
     * @return void
     */
    public static function invalidate_product_donation_caches($product_id) {
        $product_id = absint($product_id);
        if (!$product_id) {
            return;
        }
        $key = 'wdp_product_info_' . $product_id;
        delete_transient($key);
        wp_cache_delete($key, 'wdp_product_info');
        wp_cache_delete('wdp_product_object_' . $product_id, 'wdp_products');
    }

    /**
     * Ürün kaldırıldığında / çöpe gittiğinde ürün + progress bar ile ilgili tüm WDP önbellek anahtarlarını sil.
     *
     * @param int $product_id Product ID.
     * @return void
     */
    private static function purge_product_donation_caches_for_removal($product_id) {
        $product_id = absint($product_id);
        if (!$product_id) {
            return;
        }

        self::invalidate_product_donation_caches($product_id);
        wp_cache_delete('wdp_total_donation_' . $product_id, 'wdp_donations');
    }

    /**
     * Kalıcı silmeden hemen önce (ürün yazı tipi).
     *
     * @param int          $post_id Post ID.
     * @param WP_Post|null $post    Post object.
     * @return void
     */
    public static function purge_product_donation_caches_on_delete($post_id, $post = null) {
        $post_id = absint($post_id);
        if ($post_id <= 0) {
            return;
        }

        if ($post instanceof WP_Post) {
            if ($post->post_type !== 'product') {
                return;
            }
        } elseif (get_post_type($post_id) !== 'product') {
            return;
        }

        self::purge_product_donation_caches_for_removal($post_id);
    }

    /**
     * Ürün çöpe taşındığında.
     *
     * @param int $post_id Post ID.
     * @return void
     */
    public static function purge_product_donation_caches_on_trash($post_id) {
        $post_id = absint($post_id);
        if ($post_id <= 0 || get_post_type($post_id) !== 'product') {
            return;
        }

        self::purge_product_donation_caches_for_removal($post_id);
    }

    /**
     * Invalidate caches when a product post is saved (price, title, stock, etc.).
     *
     * @param int     $post_id Post ID.
     * @param WP_Post $post    Post object.
     * @param bool    $update  Whether this is an update.
     * @return void
     */
    public static function invalidate_product_donation_caches_on_product_save($post_id, $post, $update) {
        unset($post, $update);

        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }

        if (wp_is_post_revision($post_id)) {
            return;
        }

        if (function_exists('wp_is_post_autosave') && wp_is_post_autosave($post_id)) {
            return;
        }

        self::invalidate_product_donation_caches((int) $post_id);
    }

    /**
     * Invalidate caches after WooCommerce persists a product (CRUD / admin / REST).
     *
     * @param int $product_id Product ID.
     * @return void
     */
    public static function invalidate_product_donation_caches_on_wc_product($product_id) {
        self::invalidate_product_donation_caches(absint($product_id));
    }

    /**
     * Invalidate caches when donation-related product meta is added or updated.
     *
     * @param int    $meta_id    Meta row ID (unused).
     * @param int    $object_id  Post ID.
     * @param string $meta_key   Meta key.
     * @param mixed  $meta_value Meta value (unused).
     * @return void
     */
    public static function maybe_invalidate_product_donation_caches_on_meta($meta_id, $object_id, $meta_key, $meta_value) {
        unset($meta_id, $meta_value);

        $object_id = absint($object_id);
        if ($object_id <= 0 || $meta_key === '') {
            return;
        }

        if (get_post_type($object_id) !== 'product') {
            return;
        }

        if (!self::is_donation_popup_product_info_meta_key($meta_key)) {
            return;
        }

        self::invalidate_product_donation_caches($object_id);
    }

    /**
     * Whether this meta key is part of WDP product donation settings (see WDP_Product_Settings_Service).
     *
     * @param string $meta_key Meta key.
     * @return bool
     */
    private static function is_donation_popup_product_info_meta_key($meta_key) {
        if (!class_exists('WDP_Product_Settings_Service')) {
            return false;
        }

        static $lookup = null;

        if (null === $lookup) {
            $lookup = array_fill_keys(WDP_Product_Settings_Service::get_settings_meta_keys(), true);
        }

        return isset($lookup[$meta_key]);
    }

    /**
     * Arka plan seçeneği düz #hex veya eski gradient dizgesi olabilir; çıktıda yalnızca düz hex kullanılır.
     *
     * @param mixed  $value    Kayıtlı veya gönderilmiş değer.
     * @param string $fallback Geçersizse kullanılacak renk.
     * @return string
     */
    public static function coerce_solid_hex_background($value, $fallback = '#ffffff') {
        if (!is_string($value) || '' === $value) {
            return $fallback;
        }
        $trim = trim($value);
        $hex = sanitize_hex_color($trim);
        if ($hex) {
            return $hex;
        }
        if (preg_match_all('/#(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{6})\b/', $trim, $matches) && !empty($matches[0])) {
            foreach ($matches[0] as $candidate) {
                $san = sanitize_hex_color($candidate);
                if ($san) {
                    return $san;
                }
            }
        }
        return $fallback;
    }

    /**
     * Progress bar dolgu rengi (tek renk); eski fill_start / fill_mid / fill_end ile uyum.
     *
     * @param array $settings wdp_progress_bar_settings.
     * @return string
     */
    public static function resolve_progress_bar_fill_color(array $settings) {
        if (!empty($settings['fill_color']) && sanitize_hex_color($settings['fill_color'])) {
            return sanitize_hex_color($settings['fill_color']);
        }
        foreach (array('fill_mid', 'fill_start', 'fill_end') as $key) {
            if (!empty($settings[$key]) && sanitize_hex_color($settings[$key])) {
                return sanitize_hex_color($settings[$key]);
            }
        }
        return '#2563eb';
    }

    /**
     * Eski kurulumlar: sadece button_text_donate kayıtlıysa popup buton metnine yansıtır.
     *
     * @param array $settings get_option('wdp_button_settings') ham dizisi.
     * @return array
     */
    public static function normalize_legacy_popup_button_text( array $settings ) {
        if (!array_key_exists('popup_button_text', $settings) && !empty($settings['button_text_donate'])) {
            $settings['popup_button_text'] = $settings['button_text_donate'];
        }
        return $settings;
    }

    /**
     * Eski tek "button_shadow_*" anahtarlarını shortcode ('sc') ve modal içi ('modal') çiftleriyle doldurur.
     *
     * @param array $settings Ayar dizisi.
     * @return array
     */
    public static function migrate_button_shadow_to_sc_modal( array $settings ) {
        if (!is_array($settings)) {
            return $settings;
        }
        if (array_key_exists('button_shadow_sc_enabled', $settings) || array_key_exists('button_shadow_modal_enabled', $settings)) {
            return $settings;
        }
        if (!array_key_exists('button_shadow_enabled', $settings)) {
            return $settings;
        }

        $base = array(
            'enabled'           => isset($settings['button_shadow_enabled']) ? (string) $settings['button_shadow_enabled'] : '0',
            'color'             => isset($settings['button_shadow_color']) ? $settings['button_shadow_color'] : '#94a3b8',
            'x'                 => isset($settings['button_shadow_x']) ? $settings['button_shadow_x'] : 0,
            'y'                 => isset($settings['button_shadow_y']) ? $settings['button_shadow_y'] : 8,
            'blur'              => isset($settings['button_shadow_blur']) ? $settings['button_shadow_blur'] : 20,
            'spread'            => isset($settings['button_shadow_spread']) ? $settings['button_shadow_spread'] : 0,
            'hover_enhanced'    => isset($settings['button_shadow_hover_enhanced']) ? (string) $settings['button_shadow_hover_enhanced'] : '0',
            'hover_blur'        => isset($settings['button_shadow_hover_blur']) ? $settings['button_shadow_hover_blur'] : 24,
            'hover_color'       => isset($settings['button_shadow_hover_color']) ? $settings['button_shadow_hover_color'] : '',
            'hover_x'           => isset($settings['button_shadow_hover_x']) ? $settings['button_shadow_hover_x'] : 0,
            'hover_y'           => isset($settings['button_shadow_hover_y']) ? $settings['button_shadow_hover_y'] : 10,
            'hover_spread'      => isset($settings['button_shadow_hover_spread']) ? $settings['button_shadow_hover_spread'] : 0,
        );

        foreach (array('sc', 'modal') as $slot) {
            $p = 'button_shadow_' . $slot . '_';
            $settings[ $p . 'enabled' ]          = $base['enabled'];
            $settings[ $p . 'color' ]           = $base['color'];
            $settings[ $p . 'x' ]              = $base['x'];
            $settings[ $p . 'y' ]              = $base['y'];
            $settings[ $p . 'blur' ]           = $base['blur'];
            $settings[ $p . 'spread' ]         = $base['spread'];
            $settings[ $p . 'hover_enhanced' ] = $base['hover_enhanced'];
            $settings[ $p . 'hover_blur' ]     = $base['hover_blur'];
            $settings[ $p . 'hover_color' ]    = $base['hover_color'];
            $settings[ $p . 'hover_x' ]        = $base['hover_x'];
            $settings[ $p . 'hover_y' ]        = $base['hover_y'];
            $settings[ $p . 'hover_spread' ]   = $base['hover_spread'];
        }

        return $settings;
    }
}

// Note: init() is called by Woo_Donation_Popup::__construct()


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
}

// Note: init() is called by Woo_Donation_Popup::__construct()


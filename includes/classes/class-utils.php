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

        // Get total from completed orders ONLY (not from cart)
        // SADECE bu ürün için yapılan bağışları say
        $total = 0.0;

        // Query completed orders containing this product
        // Sadece tamamlanmış siparişlerden al (processing değil, sadece completed)
        $orders = wc_get_orders(array(
            'status' => array('wc-completed'), // Sadece completed orders
            'limit' => -1,
            'return' => 'ids',
        ));

        foreach ($orders as $order_id) {
            $order = wc_get_order($order_id);
            if (!$order) {
                continue;
            }

            foreach ($order->get_items() as $item) {
                // Product ID kontrolü - SADECE bu ürün için yapılan bağışları say
                $item_product_id = $item->get_product_id();
                
                // ÖNEMLİ: Sadece ana ürün ID'si eşleşiyorsa say
                // Variation varsa bile, ana ürün ID'si eşleşmeli (çünkü variation'lar aynı ana ürünün varyantlarıdır)
                if ($item_product_id === $product_id) {
                    // Get custom price if available (order item meta'dan)
                    $custom_price = $item->get_meta('_custom_price');
                    if ($custom_price && floatval($custom_price) > 0) {
                        $total += floatval($custom_price) * $item->get_quantity();
                    } else {
                        // Custom price yoksa, item total'ını kullan
                        $item_total = floatval($item->get_total());
                        if ($item_total > 0) {
                            $total += $item_total;
                        }
                    }
                }
            }
        }

        // Cache for 1 hour - her ürün için ayrı cache
        wp_cache_set($cache_key, $total, 'wdp_donations', HOUR_IN_SECONDS);

        // ÖNEMLİ: Sadece bu ürün için yapılan bağışların toplamını döndür
        // Farklı ürünlerin bağışları birbirine karışmaz
        return floatval($total);
    }
}

// Note: init() is called by Woo_Donation_Popup::__construct()


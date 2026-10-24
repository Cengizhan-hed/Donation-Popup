<?php
/**
 * AJAX trait temeli; sepet erişimi, nonce, rate limit ve yetki yardımcıları.
 *
 * @package WooCommerce\Donation_Popup
 */
if (!defined("ABSPATH")) { exit; }

trait WDP_Ajax_Base_Trait {
    /** WooCommerce sepet nesnesini güvenli şekilde döndürür; yoksa null. */
    private static function get_wc_cart() {
        if (!function_exists('WC')) {
            return null;
        }

        $wc = WC();
        if (!$wc || !isset($wc->cart)) {
            return null;
        }

        return $wc->cart;
    }

    /**
     * Belirli bir AJAX eylemi için istek hızını sınırlar.
     *
     * @param string $action         Limiter anahtarı için eylem adı.
     * @param int    $max_requests   Pencere içinde izin verilen maksimum istek.
     * @param int    $window_seconds Pencere süresi (saniye).
     * @throws WDP_Security_Exception Limit aşıldığında.
     */
    private static function enforce_rate_limit($action, $max_requests, $window_seconds) {
        $layered = ('get_product_info' === $action || 'render_modal' === $action);
        if (!WDP_Security::check_action_rate_limit($action, $max_requests, $window_seconds, $layered)) {
            throw new WDP_Security_Exception(
                __('Too many requests were sent. Please wait a while and try again.', 'woo-donation-popup'),
                'rate_limit',
                (int) $window_seconds
            );
        }
    }

    /**
     * Ziyaretçinin gerekli yetkiye sahip olduğunu doğrular.
     *
     * @param string $capability WordPress capability (varsayılan: read).
     * @throws WDP_Security_Exception Yetki yoksa.
     */
    private static function enforce_capability($capability = 'read') {
        if (!WDP_Security::check_capability($capability)) {
            throw new WDP_Security_Exception(__('You do not have permission', 'woo-donation-popup'), 'capability');
        }
    }

    /**
     * Nonce ve istek kaynağını doğrular; yalnızca POST kabul edilir.
     *
     * @param string $nonce_action Nonce eylem anahtarı.
     * @throws WDP_Security_Exception Doğrulama başarısızsa.
     */
    private static function validate_ajax_request($nonce_action) {
        self::require_post_method();

        if (!check_ajax_referer($nonce_action, 'security', false)) {
            throw new WDP_Security_Exception(null, 'nonce');
        }

        if (!WDP_Security::validate_request_origin()) {
            throw new WDP_Security_Exception(__('Invalid request origin', 'woo-donation-popup'), 'origin');
        }
    }

    /**
     * Değiştirici AJAX isteklerinde HTTP POST zorunluluğu.
     *
     * @throws WDP_Security_Exception POST değilse.
     */
    private static function require_post_method() {
        $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) wp_unslash($_SERVER['REQUEST_METHOD'])) : '';
        if ('POST' !== $method) {
            throw new WDP_Security_Exception(__('Invalid request method', 'woo-donation-popup'), 'method');
        }
    }

    /**
     * Nonce + rate limit + (opsiyonel) capability; başarısızsa JSON hata ile çıkar.
     *
     * @param string      $nonce_action    Nonce eylem anahtarı.
     * @param string      $rate_action     Rate limit anahtarı.
     * @param int         $max_requests    Pencere içi max istek.
     * @param int         $window_seconds  Pencere süresi.
     * @param string|false $capability     Capability; false ise atlanır.
     */
    private static function run_secured_ajax($nonce_action, $rate_action, $max_requests, $window_seconds = 60, $capability = 'read') {
        try {
            self::validate_ajax_request($nonce_action);
            self::enforce_rate_limit($rate_action, $max_requests, $window_seconds);
            if ($capability) {
                self::enforce_capability($capability);
            }
        } catch (WDP_Security_Exception $e) {
            WDP_Utils::json_error($e);
        }
    }

    /**
     * Aktif sepet oturumuna göre önbellek anahtarı soneki üretir.
     *
     * @return string Kullanıcı veya misafir oturumuna özgü sonek.
     */
    private static function get_cart_cache_suffix() {
        $user_id = get_current_user_id();
        if ($user_id > 0) {
            return 'user_' . $user_id;
        }

        if (function_exists('WC') && isset(WC()->session)) {
            $customer_id = WC()->session->get_customer_id();
            if (!empty($customer_id)) {
                return 'guest_' . sanitize_key((string) $customer_id);
            }
        }

        return 'guest_fallback_' . wp_hash(
            (isset($_SERVER['REMOTE_ADDR']) ? wp_unslash($_SERVER['REMOTE_ADDR']) : '0.0.0.0') .
            '|' .
            (isset($_SERVER['HTTP_USER_AGENT']) ? wp_unslash($_SERVER['HTTP_USER_AGENT']) : 'unknown')
        );
    }

    /**
     * Aktif oturum için kısa ömürlü sepet önbelleğini temizler.
     */
    private static function clear_cart_cache() {
        $suffix = self::get_cart_cache_suffix();
        wp_cache_delete('wdp_cart_contents_' . $suffix, 'wdp_cart');
        wp_cache_delete('wdp_cart_count_' . $suffix, 'wdp_cart');
    }
}

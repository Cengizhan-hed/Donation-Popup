<?php
if (!defined("ABSPATH")) { exit; }

trait WDP_Ajax_Base_Trait {
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
     * Enforce rate limit for a named action.
     *
     * @param string $action Action suffix for limiter key.
     * @param int    $max_requests Maximum requests.
     * @param int    $window_seconds Window in seconds.
     * @return void
     * @throws WDP_Security_Exception When rate limit exceeded.
     */
    private static function enforce_rate_limit($action, $max_requests, $window_seconds) {
        $rate_limit_key = WDP_Security::get_rate_limit_key($action);
        if (!WDP_Security::check_rate_limit($rate_limit_key, $max_requests, $window_seconds)) {
            throw new WDP_Security_Exception(__('Çok fazla istek gönderildi. Lütfen bir süre bekleyip tekrar deneyin.', 'woo-donation-popup'));
        }
    }

    /**
     * Ensure current visitor has required capability.
     *
     * @param string $capability Capability to enforce.
     * @return void
     * @throws WDP_Security_Exception If capability check fails.
     */
    private static function enforce_capability($capability = 'read') {
        if (!WDP_Security::check_capability($capability)) {
            throw new WDP_Security_Exception(__('Yetkiniz bulunmuyor', 'woo-donation-popup'));
        }
    }

    /**
     * Validate nonce and request origin.
     *
     * @param string $nonce_action Nonce action key.
     * @return void
     * @throws WDP_Security_Exception When validation fails.
     */
    private static function validate_ajax_request($nonce_action) {
        self::require_post_method();

        if (!check_ajax_referer($nonce_action, 'security', false)) {
            throw new WDP_Security_Exception();
        }

        if (!WDP_Security::validate_request_origin()) {
            throw new WDP_Security_Exception(__('Geçersiz istek kaynağı', 'woo-donation-popup'));
        }
    }

    /**
     * Require HTTP POST for mutating/ajax actions.
     *
     * @return void
     * @throws WDP_Security_Exception If request method is invalid.
     */
    private static function require_post_method() {
        $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) wp_unslash($_SERVER['REQUEST_METHOD'])) : '';
        if ('POST' !== $method) {
            throw new WDP_Security_Exception(__('Geçersiz istek metodu', 'woo-donation-popup'));
        }
    }

    /**
     * Build a cache suffix scoped to current cart session.
     *
     * @return string
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
     * Delete short-lived cart caches for the active session.
     *
     * @return void
     */
    private static function clear_cart_cache() {
        $suffix = self::get_cart_cache_suffix();
        wp_cache_delete('wdp_cart_contents_' . $suffix, 'wdp_cart');
        wp_cache_delete('wdp_cart_count_' . $suffix, 'wdp_cart');
    }
}

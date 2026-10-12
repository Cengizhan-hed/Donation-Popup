<?php
/**
 * Sanitizasyon, nonce, yetki, rate limit ve istek kaynağı doğrulaması.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Class WDP_Security
 */
class WDP_Security {

    /**
     * Sanitize text field with additional checks
     *
     * @param string $value Value to sanitize.
     * @param int    $max_length Maximum length.
     * @return string
     */
    public static function sanitize_text($value, $max_length = 255) {
        if (!is_string($value)) {
            return '';
        }

        $value = sanitize_text_field($value);
        
        if (strlen($value) > $max_length) {
            $value = substr($value, 0, $max_length);
        }

        return trim($value);
    }

    /**
     * Sanitize phone number
     *
     * @param string $phone Phone number.
     * @return string
     */
    public static function sanitize_phone($phone) {
        if (!is_string($phone)) {
            return '';
        }

        // Remove all non-numeric characters except + and spaces
        $phone = preg_replace('/[^0-9+\s\-()]/', '', $phone);
        $phone = sanitize_text_field($phone);
        
        // E.164 / formatted international numbers (libphonenumber-safe headroom)
        if (strlen($phone) > 28) {
            $phone = substr($phone, 0, 28);
        }

        return trim($phone);
    }

    /**
     * Sanitize numeric value
     *
     * @param mixed  $value Value to sanitize.
     * @param float  $min   Minimum value.
     * @param float  $max   Maximum value.
     * @return float|null
     */
    public static function sanitize_numeric($value, $min = null, $max = null) {
        if (!is_numeric($value)) {
            return null;
        }

        $value = floatval($value);

        if (null !== $min && $value < $min) {
            return null;
        }

        if (null !== $max && $value > $max) {
            return null;
        }

        return $value;
    }

    /**
     * Validate product ID
     *
     * @param int             $product_id Product ID.
     * @param WC_Product|null $product_out Optional product output reference.
     * @return bool
     */
    public static function validate_product_id($product_id, &$product_out = null) {
        $product_id = absint($product_id);
        
        if ($product_id <= 0) {
            return false;
        }

        // Check if product exists and is published
        $product = wc_get_product($product_id);
        
        if (!$product) {
            return false;
        }

        // Check if user can view this product
        if (!current_user_can('edit_post', $product_id)) {
            // For non-admins, check if product is published
            if ($product->get_status() !== 'publish') {
                return false;
            }
        }

        $product_out = $product;
        return true;
    }

    /**
     * Validate nonce
     *
     * @param string $action Action name.
     * @param string $nonce  Nonce value.
     * @return bool
     */
    public static function validate_nonce($action, $nonce) {
        if (empty($nonce)) {
            return false;
        }

        return wp_verify_nonce($nonce, $action);
    }

    /**
     * Rate limiting check (simple implementation)
     *
     * @param string $key     Unique key (e.g., IP address).
     * @param int    $limit   Request limit.
     * @param int    $period  Time period in seconds.
     * @return bool
     */
    public static function check_rate_limit($key, $limit = 10, $period = 60) {
        $key = (string) $key;
        if ($key === '') {
            $key = 'anonymous';
        }
        $transient_key = 'wdp_rate_limit_' . md5($key);
        $current = get_transient($transient_key);

        if (false === $current) {
            set_transient($transient_key, 1, $period);
            return true;
        }

        if ($current >= $limit) {
            return false;
        }

        set_transient($transient_key, $current + 1, $period);
        return true;
    }

    /**
     * Build a rate-limit key that is stable per visitor/session.
     *
     * @param string $action Action scope.
     * @return string
     */
    public static function get_rate_limit_key($action = 'default') {
        $action = sanitize_key((string) $action);

        if (is_user_logged_in()) {
            return 'u:' . get_current_user_id() . '|a:' . $action;
        }

        $session_id = '';
        if (function_exists('WC') && isset(WC()->session)) {
            $session_id = (string) WC()->session->get_customer_id();
        }

        $ip = self::get_client_ip();
        $ua = isset($_SERVER['HTTP_USER_AGENT']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_USER_AGENT'])) : 'unknown';

        return 'g:' . md5($session_id . '|' . $ip . '|' . $ua) . '|a:' . $action;
    }

    /**
     * Get client IP address.
     * Prefer REMOTE_ADDR; proxy headers are spoofable unless a trusted proxy is configured.
     *
     * @return string
     */
    public static function get_client_ip() {
        // Prefer REMOTE_ADDR first. Only trust X-Forwarded-For (etc.) when
        // apply_filters( 'wdp_trust_proxy_headers', false ) is true for known proxies.
        $remote = isset($_SERVER['REMOTE_ADDR']) ? trim((string) $_SERVER['REMOTE_ADDR']) : '';
        if ($remote !== '' && filter_var($remote, FILTER_VALIDATE_IP) !== false) {
            if (!(bool) apply_filters('wdp_trust_proxy_headers', false)) {
                return $remote;
            }
        }

        if ((bool) apply_filters('wdp_trust_proxy_headers', false)) {
            $proxy_keys = array(
                'HTTP_CLIENT_IP',
                'HTTP_X_FORWARDED_FOR',
                'HTTP_X_FORWARDED',
                'HTTP_X_CLUSTER_CLIENT_IP',
                'HTTP_FORWARDED_FOR',
                'HTTP_FORWARDED',
            );
            foreach ($proxy_keys as $key) {
                if (empty($_SERVER[ $key ])) {
                    continue;
                }
                foreach (explode(',', (string) $_SERVER[ $key ]) as $ip) {
                    $ip = trim($ip);
                    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false) {
                        return $ip;
                    }
                }
            }
        }

        if ($remote !== '' && filter_var($remote, FILTER_VALIDATE_IP) !== false) {
            return $remote;
        }

        return '0.0.0.0';
    }
    
    /**
     * Check user capability for AJAX operations
     * SECURITY: Verify user permissions
     *
     * @param string $capability Capability to check.
     * @return bool
     */
    public static function check_capability($capability = 'read') {
        if (!is_user_logged_in()) {
            // For non-logged-in users, only allow read operations
            return 'read' === $capability;
        }
        
        return current_user_can($capability);
    }
    
    /**
     * Validate and sanitize email address
     * SECURITY: Enhanced email validation
     *
     * @param string $email Email address.
     * @return string|false Sanitized email or false if invalid.
     */
    public static function sanitize_email($email) {
        if (!is_string($email)) {
            return false;
        }
        
        $email = trim($email);
        
        // SECURITY: Length check before validation
        if (strlen($email) > 254) {
            return false;
        }
        
        $email = sanitize_email($email);
        
        // SECURITY: Additional validation
        if (!is_email($email)) {
            return false;
        }
        
        return $email;
    }
    
    /**
     * Validate request origin
     * SECURITY: CSRF protection enhancement
     *
     * @param bool $credential_issuance True for endpoints that issue new nonces without a prior nonce (stricter: Sec-Fetch-Site "none" is not accepted).
     * @return bool
     */
    public static function validate_request_origin($credential_issuance = false) {
        $site_host = wp_parse_url(home_url(), PHP_URL_HOST);
        if (empty($site_host)) {
            return false;
        }

        $referer = isset($_SERVER['HTTP_REFERER']) ? esc_url_raw(wp_unslash($_SERVER['HTTP_REFERER'])) : '';
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? esc_url_raw(wp_unslash($_SERVER['HTTP_ORIGIN'])) : '';

        if (!empty($origin)) {
            $origin_host = wp_parse_url($origin, PHP_URL_HOST);
            if (empty($origin_host) || !hash_equals((string) $site_host, (string) $origin_host)) {
                return false;
            }
            return true;
        }

        if (!empty($referer)) {
            $referer_host = wp_parse_url($referer, PHP_URL_HOST);
            if (empty($referer_host) || !hash_equals((string) $site_host, (string) $referer_host)) {
                return false;
            }
            return true;
        }

        $fetch_site = isset($_SERVER['HTTP_SEC_FETCH_SITE']) ? strtolower(sanitize_text_field(wp_unslash($_SERVER['HTTP_SEC_FETCH_SITE']))) : '';
        if (in_array($fetch_site, array('same-origin', 'same-site'), true)) {
            return true;
        }

        // "none" is trivially spoofable outside a browser; allow only for nonce-protected AJAX (Referer/Origin often absent with strict policies).
        if (!$credential_issuance && 'none' === $fetch_site) {
            return true;
        }

        return false;
    }

    /**
     * Escape output for display
     *
     * @param string $value Value to escape.
     * @param string $context Context (html, attr, url, js).
     * @return string
     */
    public static function escape_output($value, $context = 'html') {
        switch ($context) {
            case 'html':
                return esc_html($value);
            case 'attr':
                return esc_attr($value);
            case 'url':
                return esc_url($value);
            case 'js':
                return esc_js($value);
            case 'textarea':
                return esc_textarea($value);
            default:
                return esc_html($value);
        }
    }
}


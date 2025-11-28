<?php
/**
 * Security class
 * Enhanced security checks and sanitization
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
        
        // Limit length
        if (strlen($phone) > 20) {
            $phone = substr($phone, 0, 20);
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
     * @param int $product_id Product ID.
     * @return bool
     */
    public static function validate_product_id($product_id) {
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
     * Get client IP address
     * SECURITY: Enhanced IP detection with validation
     *
     * @return string
     */
    public static function get_client_ip() {
        $ip_keys = array(
            'HTTP_CLIENT_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_FORWARDED',
            'HTTP_X_CLUSTER_CLIENT_IP',
            'HTTP_FORWARDED_FOR',
            'HTTP_FORWARDED',
            'REMOTE_ADDR',
        );

        foreach ($ip_keys as $key) {
            if (array_key_exists($key, $_SERVER) === true) {
                foreach (explode(',', $_SERVER[$key]) as $ip) {
                    $ip = trim($ip);
                    
                    // SECURITY: Validate IP and filter out private/reserved ranges
                    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false) {
                        return $ip;
                    }
                }
            }
        }

        // SECURITY: Fallback to REMOTE_ADDR with validation
        $fallback_ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
        return filter_var($fallback_ip, FILTER_VALIDATE_IP) !== false ? $fallback_ip : '0.0.0.0';
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
     * @return bool
     */
    public static function validate_request_origin() {
        // Check referer
        $referer = isset($_SERVER['HTTP_REFERER']) ? esc_url_raw($_SERVER['HTTP_REFERER']) : '';
        $home_url = home_url();
        
        if (!empty($referer) && strpos($referer, $home_url) !== 0) {
            return false;
        }
        
        return true;
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


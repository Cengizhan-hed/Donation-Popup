<?php
if (!defined('ABSPATH')) {
	exit;
}

trait WDP_Ajax_Cart_Session_Trait {
    /**
     * Return fresh AJAX nonces for the current session (no prior nonce required).
     *
     * Used when the page stayed open a long time or after a failed add-to-cart response
     * so the client can retry verification with valid credentials.
     *
     * @return never
     */
    public static function get_fresh_nonces() {
        try {
            if (!WDP_Security::validate_request_origin(true)) {
                throw new WDP_Security_Exception(__('Geçersiz istek kaynağı', 'woo-donation-popup'));
            }

            $rate_limit_key = WDP_Security::get_rate_limit_key('fresh_nonces');
            if (!WDP_Security::check_rate_limit($rate_limit_key, 60, 60)) {
                throw new WDP_Security_Exception(__('Çok fazla istek gönderildi. Lütfen bir süre bekleyip tekrar deneyin.', 'woo-donation-popup'));
            }

            WDP_Utils::json_success(array(
                'nonces' => array(
                    'ajax_add_to_cart' => wp_create_nonce('wdp_ajax_add_to_cart'),
                    'get_product_info' => wp_create_nonce('wdp_get_product_info'),
                    'get_product_name' => wp_create_nonce('wdp_get_product_name'),
                    'get_cart_count' => wp_create_nonce('wdp_get_cart_count'),
                    'get_cart_contents' => wp_create_nonce('wdp_get_cart_contents'),
                    'remove_cart_item' => wp_create_nonce('wdp_remove_cart_item'),
                ),
            ));
        } catch (WDP_Security_Exception $e) {
            WDP_Utils::json_error($e);
        } catch (Exception $e) {
            WDP_Utils::handle_exception($e, true);
        }
    }

    /**
     * Check whether a prior submission (unique_submission_key) is already in the cart.
     *
     * @return never
     */
    public static function verify_submission_in_cart() {
        try {
            self::validate_ajax_request('wdp_ajax_add_to_cart');

            $rate_limit_key = WDP_Security::get_rate_limit_key('verify_submission');
            if (!WDP_Security::check_rate_limit($rate_limit_key, 40, 60)) {
                throw new WDP_Security_Exception(__('Çok fazla istek gönderildi. Lütfen bir süre bekleyip tekrar deneyin.', 'woo-donation-popup'));
            }

            if (!WDP_Security::check_capability('read')) {
                throw new WDP_Security_Exception(__('Yetkiniz bulunmuyor', 'woo-donation-popup'));
            }

            $key = isset($_POST['unique_submission_key']) ? WDP_Security::sanitize_text(wp_unslash($_POST['unique_submission_key']), 100) : '';

            $cart = self::get_wc_cart();
            if ('' === $key || !$cart) {
                WDP_Utils::json_success(array(
                    'in_cart' => false,
                ));
            }

            foreach ($cart->get_cart() as $cart_item_key => $cart_item) {
                if (!empty($cart_item['unique_submission_key']) && $cart_item['unique_submission_key'] === $key) {
                    self::clear_cart_cache();

                    $v_pid = isset($cart_item['product_id']) ? (int) $cart_item['product_id'] : 0;

                    WDP_Utils::json_success(array(
                        'in_cart' => true,
                        'message' => __('Ürün sepete eklendi.', 'woo-donation-popup'),
                        'cart_count' => (int) $cart->get_cart_contents_count(),
                        'checkout_url' => wc_get_checkout_url(),
                        'items' => self::get_cart_items(),
                        'cart_item_key' => $cart_item_key,
                        'product_id' => $v_pid,
                        'meta_cart_line' => self::build_meta_cart_line_from_cart_item($cart_item, $v_pid),
                    ));
                }
            }

            WDP_Utils::json_success(array(
                'in_cart' => false,
            ));
        } catch (WDP_Security_Exception $e) {
            WDP_Utils::json_error($e);
        } catch (Exception $e) {
            WDP_Utils::handle_exception($e, true);
        }
    }
}

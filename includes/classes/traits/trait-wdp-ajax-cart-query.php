<?php
if (!defined('ABSPATH')) {
	exit;
}

trait WDP_Ajax_Cart_Query_Trait {
    /**
     * Get cart count via AJAX
     */
    public static function get_cart_count() {
        try {
            self::validate_ajax_request('wdp_get_cart_count');
            self::enforce_rate_limit('get_cart_count', 120, 60);
        } catch (WDP_Security_Exception $e) {
            WDP_Utils::json_error($e);
        }

        $cart = self::get_wc_cart();
        if (!$cart) {
            WDP_Utils::json_error(__('WooCommerce sepet nesnesi bulunamadı.', 'woo-donation-popup'));
            return;
        }

        // PERFORMANCE: Cache cart count for short period (5 seconds) to reduce database queries
        $cache_key = 'wdp_cart_count_' . self::get_cart_cache_suffix();
        $cached_count = wp_cache_get($cache_key, 'wdp_cart');
        
        if (false === $cached_count) {
            $cached_count = (int) $cart->get_cart_contents_count();
            // Cache for 5 seconds (cart changes frequently)
            wp_cache_set($cache_key, $cached_count, 'wdp_cart', 5);
        }

        WDP_Utils::json_success(array(
            'cart_count' => $cached_count,
        ));
    }

    /**
     * Get cart contents via AJAX
     */
    public static function get_cart_contents() {
        try {
            self::validate_ajax_request('wdp_get_cart_contents');
            self::enforce_rate_limit('get_cart_contents', 120, 60);
        } catch (WDP_Security_Exception $e) {
            WDP_Utils::json_error($e);
        }

        $cart = self::get_wc_cart();
        if (!$cart) {
            WDP_Utils::json_error(__('WooCommerce sepet nesnesi bulunamadı.', 'woo-donation-popup'));
            return;
        }

        // PERFORMANCE: Cache cart contents for short period (3 seconds)
        $cache_key = 'wdp_cart_contents_' . self::get_cart_cache_suffix();
        $cached_items = wp_cache_get($cache_key, 'wdp_cart');
        
        if (false === $cached_items) {
            $cached_items = self::get_cart_items();
            // Cache for 3 seconds (cart changes frequently)
            wp_cache_set($cache_key, $cached_items, 'wdp_cart', 3);
        }

        WDP_Utils::json_success(array(
            'items' => $cached_items,
            'cart_count' => (int) $cart->get_cart_contents_count(),
        ));
    }

    /**
     * Get cart items formatted for response
     *
     * @return array
     */
    private static function get_cart_items() {
        $cart = self::get_wc_cart();
        if (!$cart) {
            return array();
        }

        $items = array();
        
        // PERFORMANCE: Get cart items once (avoid multiple calls)
        $cart_items = $cart->get_cart();

        foreach ($cart_items as $cart_item_key => $cart_item) {
            $product = $cart_item['data'];

            if (!$product) {
                continue;
            }

            $quantity = max(1, (int) $cart_item['quantity']);
            $unit_price = class_exists('WDP_Cart') ? WDP_Cart::get_cart_line_unit_price($cart_item) : null;
            if (null === $unit_price) {
                $unit_price = (float) $product->get_price();
            }
            $line_total = $unit_price * $quantity;
            $is_sadaka_line = !empty($cart_item['wdp_sadaka_donation']);
            if ($is_sadaka_line && class_exists('WDP_Cart')) {
                $display_id = WDP_Cart::resolve_sadaka_line_wc_product_id($cart_item);
                $parent_id = !empty($cart_item['wdp_parent_product_id'])
                    ? (int) $cart_item['wdp_parent_product_id']
                    : (int) $cart_item['product_id'];
                if ($display_id > 0 && ($display_id !== $parent_id || !empty($cart_item['wdp_sadaka_linked_wc_product']))) {
                    $display_product = wc_get_product($display_id);
                    $product_name = ($display_product && $display_product->exists())
                        ? wp_strip_all_tags((string) $display_product->get_name())
                        : __('Sadaka Bağışı', 'woo-donation-popup');
                } else {
                    $product_name = __('Sadaka Bağışı', 'woo-donation-popup');
                }
            } else {
                $product_name = wp_strip_all_tags((string) $product->get_name());
            }

            $item_data = array(
                'key' => $cart_item_key,
                'product_id' => $cart_item['product_id'],
                'product_name' => $product_name,
                'quantity' => $quantity,
                'price' => $unit_price,
                'line_total' => $line_total,
                'price_html' => WDP_Utils::format_price_html($line_total),
                'price_plain' => WDP_Utils::format_price_plain($line_total),
                'is_sadaka_donation' => $is_sadaka_line,
                'line_kind' => $is_sadaka_line ? 'sadaka' : 'donation',
            );

            // Meta veriler (donation data vb.)
            if (isset($cart_item['donation_data'])) {
                $item_data['donation_data'] = $cart_item['donation_data'];
                
                // Meta verileri formatla (gösterim için)
                $meta = array();
                if (isset($cart_item['donation_data']['full_name'])) {
                    $meta[] = array(
                        'key' => __('Ad Soyad', 'woo-donation-popup'),
                        'value' => $cart_item['donation_data']['full_name'],
                    );
                }
                if (isset($cart_item['donation_data']['phone'])) {
                    $meta[] = array(
                        'key' => __('Telefon', 'woo-donation-popup'),
                        'value' => $cart_item['donation_data']['phone'],
                    );
                }
                if (isset($cart_item['donation_data']['note'])) {
                    $meta[] = array(
                        'key' => __('Not', 'woo-donation-popup'),
                        'value' => $cart_item['donation_data']['note'],
                    );
                }
                if (isset($cart_item['donation_data']['share_count'])) {
                    $meta[] = array(
                        'key' => __('Hisse Adedi', 'woo-donation-popup'),
                        'value' => $cart_item['donation_data']['share_count'],
                    );
                }
                if (isset($cart_item['donation_data']['shareholders']) && is_array($cart_item['donation_data']['shareholders'])) {
                    foreach ($cart_item['donation_data']['shareholders'] as $index => $shareholder) {
                        if (isset($shareholder['name'])) {
                            $meta[] = array(
                                'key' => sprintf(__('%d. Hissedar', 'woo-donation-popup'), $index),
                                'value' => $shareholder['name'] . (isset($shareholder['phone']) ? ' - ' . $shareholder['phone'] : ''),
                            );
                        }
                        if (isset($shareholder['email']) && $shareholder['email'] !== '') {
                            $meta[] = array(
                                'key' => sprintf(__('%d. Hissedar E-postası', 'woo-donation-popup'), $index),
                                'value' => $shareholder['email'],
                            );
                        }

                        if (isset($shareholder['note']) && $shareholder['note'] !== '') {
                            $meta[] = array(
                                'key' => sprintf(__('%d. Hissedar Notu', 'woo-donation-popup'), $index),
                                'value' => $shareholder['note'],
                            );
                        }
                    }
                }
                
                if (!empty($meta)) {
                    $item_data['meta'] = $meta;
                }
            }

            if (isset($cart_item['custom_price'])) {
                $item_data['custom_price'] = floatval($cart_item['custom_price']);
            }

            $items[] = $item_data;
        }

        return $items;
    }

    /**
     * Remove cart item via AJAX
     *
     * @since 10.0
     * @return void
     */
    public static function remove_cart_item() {
        try {
            self::validate_ajax_request('wdp_remove_cart_item');
            self::enforce_rate_limit('remove_cart_item', 40, 60);
        } catch (WDP_Security_Exception $e) {
            WDP_Utils::json_error($e);
        }

        $cart = self::get_wc_cart();
        if (!$cart) {
            WDP_Utils::json_error(__('WooCommerce sepet nesnesi bulunamadı.', 'woo-donation-popup'));
            return;
        }
        
        try {

            // Get cart item key
            $cart_item_key = isset($_POST['cart_item_key']) ? sanitize_text_field(wp_unslash($_POST['cart_item_key'])) : '';

            if (empty($cart_item_key)) {
                throw new WDP_Validation_Exception(__('Sepet öğesi anahtarı bulunamadı.', 'woo-donation-popup'));
            }

            $target_item = $cart->get_cart_item($cart_item_key);
            if (!$target_item) {
                throw new WDP_Exception(__('Sepet öğesi kaldırılamadı.', 'woo-donation-popup'));
            }

            if (empty($target_item['wdp_sadaka_donation'])) {
                foreach ($cart->get_cart() as $linked_key => $linked_item) {
                    if (empty($linked_item['wdp_sadaka_donation'])) {
                        continue;
                    }
                    if (isset($linked_item['wdp_parent_cart_item_key']) && $linked_item['wdp_parent_cart_item_key'] === $cart_item_key) {
                        $cart->remove_cart_item($linked_key);
                    }
                }
            }

            $removed = $cart->remove_cart_item($cart_item_key);

            if (!$removed) {
                throw new WDP_Exception(__('Sepet öğesi kaldırılamadı.', 'woo-donation-popup'));
            }

            if (method_exists($cart, 'calculate_totals')) {
                $cart->calculate_totals();
            }

            // Clear all cart cache variations
            self::clear_cart_cache();
            wp_cache_delete('wdp_cart_items_' . $cart->get_cart_hash(), 'wdp_cart');
            wp_cache_delete('wdp_cart_count_' . $cart->get_cart_hash(), 'wdp_cart');

            // Get updated cart items
            $items = self::get_cart_items();

            WDP_Utils::json_success(array(
                'message' => __('Sepet öğesi kaldırıldı.', 'woo-donation-popup'),
                'items' => $items,
                'cart_count' => (int) $cart->get_cart_contents_count(),
            ));

        } catch (WDP_Security_Exception $e) {
            WDP_Utils::json_error($e->getMessage(), array('code' => 'security_error'));
        } catch (WDP_Validation_Exception $e) {
            WDP_Utils::json_error($e->getMessage(), array('code' => 'validation_error'));
        } catch (WDP_Exception $e) {
            WDP_Utils::json_error($e->getMessage(), array('code' => 'general_error'));
        } catch (Exception $e) {
            WDP_Utils::json_error(__('Beklenmeyen bir hata oluştu.', 'woo-donation-popup'), array('code' => 'unknown_error'));
        }
    }
}

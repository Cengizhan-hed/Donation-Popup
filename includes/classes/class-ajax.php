<?php
/**
 * AJAX handlers class
 * 
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Class WDP_Ajax
 */
class WDP_Ajax {

    /**
     * Initialize AJAX handlers.
     * 
     * Registers all AJAX action hooks for both logged-in and non-logged-in users.
     *
     * @since 10.0
     * @return void
     */
    public static function init() {
        // Sepet sayısını almak için AJAX endpoint
        add_action('wp_ajax_wdp_get_cart_count', array(__CLASS__, 'get_cart_count'));
        add_action('wp_ajax_nopriv_wdp_get_cart_count', array(__CLASS__, 'get_cart_count'));

        // Sepet içeriğini almak için AJAX endpoint
        add_action('wp_ajax_wdp_get_cart_contents', array(__CLASS__, 'get_cart_contents'));
        add_action('wp_ajax_nopriv_wdp_get_cart_contents', array(__CLASS__, 'get_cart_contents'));

        // AJAX ile sepete ekleme endpoint'i
        add_action('wp_ajax_wdp_ajax_add_to_cart', array(__CLASS__, 'ajax_add_to_cart'));
        add_action('wp_ajax_nopriv_wdp_ajax_add_to_cart', array(__CLASS__, 'ajax_add_to_cart'));

        // Ürün adını almak için endpoint
        add_action('wp_ajax_wdp_get_product_name', array(__CLASS__, 'get_product_name'));
        add_action('wp_ajax_nopriv_wdp_get_product_name', array(__CLASS__, 'get_product_name'));

        // Ürün bilgilerini almak için AJAX endpoint
        add_action('wp_ajax_wdp_get_product_info', array(__CLASS__, 'get_product_info'));
        add_action('wp_ajax_nopriv_wdp_get_product_info', array(__CLASS__, 'get_product_info'));
    }

    /**
     * Get product info via AJAX.
     * 
     * Returns product details including custom price settings and multiple shares options.
     *
     * @since 10.0
     * @return never Sends JSON response and terminates.
     * @throws WDP_Security_Exception      If nonce verification fails.
     * @throws WDP_Validation_Exception    If product ID is invalid.
     * @throws WDP_Product_Not_Found_Exception If product doesn't exist.
     */
    public static function get_product_info() {
        try {
            if (!check_ajax_referer('wdp_get_product_info', 'security', false)) {
                throw new WDP_Security_Exception();
            }

            $product_id = isset($_POST['product_id']) ? absint(wp_unslash($_POST['product_id'])) : 0;

            if (!$product_id) {
                throw new WDP_Validation_Exception(__('Geçersiz ürün ID', 'woo-donation-popup'));
            }

            $product = wc_get_product($product_id);

            if (!$product) {
                throw new WDP_Product_Not_Found_Exception($product_id);
            }

        // OPTIMIZATION: WooCommerce get_meta() kullan (cache'lenmiş, daha hızlı)
        $allow_custom_price = $product->get_meta('_allow_custom_price') === 'yes';
        $min_price = $product->get_meta('_min_custom_price');
        $allow_multiple_shares = $product->get_meta('_allow_multiple_shares') === 'yes';
        $max_shares = $product->get_meta('_max_shares');

        if ($allow_custom_price && '' === $min_price) {
            $min_price = '0';
        }

        if ($allow_multiple_shares && '' === $max_shares) {
            $max_shares = '7';
        }

        $response = array(
            'product_name' => $product->get_name(),
            'is_custom_price' => $allow_custom_price,
            'min_price' => $min_price,
            'regular_price' => $product->get_regular_price(),
            'price' => $product->get_price(),
            'is_multiple_shares' => $allow_multiple_shares,
            'max_shares' => $max_shares,
        );

            WDP_Utils::log(array('event' => 'get_product_info', 'response' => $response));
            WDP_Utils::json_success($response);
        } catch (WDP_Exception $e) {
            WDP_Utils::json_error($e);
        } catch (Exception $e) {
            WDP_Utils::handle_exception($e, true);
        }
    }

    /**
     * Get product name via AJAX.
     *
     * @since 10.0
     * @return never Sends JSON response and terminates.
     * @throws WDP_Security_Exception      If nonce verification fails.
     * @throws WDP_Validation_Exception    If product ID is invalid.
     * @throws WDP_Product_Not_Found_Exception If product doesn't exist.
     */
    public static function get_product_name() {
        check_ajax_referer('wdp_get_product_name', 'security');

        $product_id = isset($_POST['product_id']) ? absint(wp_unslash($_POST['product_id'])) : 0;

        if (!$product_id) {
            WDP_Utils::json_error(__('Geçersiz ürün ID', 'woo-donation-popup'));
        }

        $product = wc_get_product($product_id);

        if (!$product) {
            WDP_Utils::json_error(__('Ürün bulunamadı', 'woo-donation-popup'));
        }

        WDP_Utils::json_success(array(
            'product_name' => $product->get_name(),
        ));
    }

    /**
     * Add product to cart via AJAX.
     * 
     * Handles both single donation and multiple shares (shareholder) donations.
     * Includes rate limiting, validation, and security checks.
     *
     * @since 10.0
     * @return never Sends JSON response and terminates.
     * @throws WDP_Security_Exception      If nonce verification fails or rate limit exceeded.
     * @throws WDP_Validation_Exception    If validation fails (missing fields, invalid price, etc.).
     * @throws WDP_Product_Not_Found_Exception If product doesn't exist.
     * @throws WDP_Cart_Exception          If cart operation fails.
     */
    public static function ajax_add_to_cart() {
        try {
            if (!check_ajax_referer('wdp_ajax_add_to_cart', 'security', false)) {
                throw new WDP_Security_Exception();
            }

            // Rate limiting check
            $client_ip = WDP_Security::get_client_ip();
            if (!WDP_Security::check_rate_limit($client_ip, 20, 60)) {
                throw new WDP_Security_Exception(__('Çok fazla istek gönderildi. Lütfen bir süre bekleyip tekrar deneyin.', 'woo-donation-popup'));
            }

            // Sanitize and validate inputs
            $product_id = isset($_POST['add-to-cart']) ? absint(wp_unslash($_POST['add-to-cart'])) : 0;
            $quantity = isset($_POST['quantity']) ? wc_stock_amount(wp_unslash($_POST['quantity'])) : 1;
            $variation_id = isset($_POST['variation_id']) ? absint(wp_unslash($_POST['variation_id'])) : 0;
            $custom_price_raw = isset($_POST['custom_price']) ? wc_clean(wp_unslash($_POST['custom_price'])) : '';
            $unique_submission_key = isset($_POST['unique_submission_key']) ? WDP_Security::sanitize_text(wp_unslash($_POST['unique_submission_key']), 100) : '';
            $timestamp = isset($_POST['timestamp']) ? absint(wp_unslash($_POST['timestamp'])) : 0;
            $is_direct_share_form = !empty($_POST['is_direct_share_form']) && '1' === wp_unslash($_POST['is_direct_share_form']);
            $custom_price_type = isset($_POST['custom_price_type']) ? WDP_Security::sanitize_text(wp_unslash($_POST['custom_price_type']), 50) : '';

        WDP_Utils::log(array(
            'event' => 'ajax_add_to_cart_request',
            'product_id' => $product_id,
            'quantity' => $quantity,
            'custom_price' => $custom_price_raw,
            'share_count' => isset($_POST['share_count']) ? wp_unslash($_POST['share_count']) : null,
            'unique_submission_key' => $unique_submission_key,
        ));

            if (!$product_id) {
                throw new WDP_Validation_Exception(__('Geçersiz ürün ID.', 'woo-donation-popup'));
            }

            if (!function_exists('WC') || !isset(WC()->cart)) {
                throw new WDP_Cart_Exception(__('WooCommerce sepet nesnesi bulunamadı.', 'woo-donation-popup'));
            }

            $product = wc_get_product($product_id);

            if (!$product) {
                throw new WDP_Product_Not_Found_Exception($product_id);
            }

        $donation_data = array();
        $share_count = isset($_POST['share_count']) ? absint(wp_unslash($_POST['share_count'])) : 0;

        if ($share_count > 0) {
            $donation_data['share_count'] = $share_count;
            $shareholders = array();
            $missing_fields = array();

            for ($i = 1; $i <= $share_count; $i++) {
                $name = isset($_POST['shareholder_name_' . $i]) ? WDP_Security::sanitize_text(wp_unslash($_POST['shareholder_name_' . $i]), 100) : '';
                $phone = isset($_POST['shareholder_phone_' . $i]) ? WDP_Security::sanitize_phone(wp_unslash($_POST['shareholder_phone_' . $i])) : '';
                $note = isset($_POST['shareholder_note_' . $i]) ? sanitize_textarea_field(wp_unslash($_POST['shareholder_note_' . $i])) : '';

                if ('' === $name) {
                    $missing_fields[] = sprintf(__('%d. Hissedar Adı', 'woo-donation-popup'), $i);
                }

                if ('' === $phone) {
                    $missing_fields[] = sprintf(__('%d. Hissedar Telefonu', 'woo-donation-popup'), $i);
                }

                $shareholder = array();

                if ('' !== $name) {
                    $shareholder['name'] = $name;
                }

                if ('' !== $phone) {
                    $shareholder['phone'] = $phone;
                }

                if ('' !== $note) {
                    $shareholder['note'] = $note;
                }

                if (!empty($shareholder)) {
                    $shareholders[$i] = $shareholder;
                }
            }

            if (!empty($missing_fields)) {
                throw new WDP_Validation_Exception(
                    __('Lütfen tüm zorunlu alanları doldurun: ', 'woo-donation-popup') . implode(', ', $missing_fields),
                    $missing_fields
                );
            }

            if (!empty($shareholders)) {
                $donation_data['shareholders'] = $shareholders;
            }

            $quantity = max(1, $share_count);
        } else {
            $full_name = isset($_POST['donation_full_name']) ? WDP_Security::sanitize_text(wp_unslash($_POST['donation_full_name']), 100) : '';
            $phone = isset($_POST['donation_phone']) ? WDP_Security::sanitize_phone(wp_unslash($_POST['donation_phone'])) : '';
            $note = isset($_POST['donation_note']) ? sanitize_textarea_field(wp_unslash($_POST['donation_note'])) : '';

            if ('' === $full_name) {
                throw new WDP_Validation_Exception(__('Lütfen Ad Soyad bilginizi giriniz.', 'woo-donation-popup'), array('donation_full_name'));
            }

            if ('' === $phone) {
                throw new WDP_Validation_Exception(__('Lütfen Telefon bilginizi giriniz.', 'woo-donation-popup'), array('donation_phone'));
            }

            $donation_data['full_name'] = $full_name;
            $donation_data['phone'] = $phone;

            if ('' !== $note) {
                $donation_data['note'] = $note;
            }
        }

        // OPTIMIZATION: WooCommerce get_meta() kullan (cache'lenmiş, daha hızlı)
        $product = wc_get_product($product_id);
        if (!$product) {
            throw new WDP_Product_Not_Found_Exception($product_id);
        }

        $allow_custom_price = $product->get_meta('_allow_custom_price') === 'yes';
        $custom_price_value = null;

            if ($allow_custom_price) {
                if ($custom_price_raw === '') {
                    throw new WDP_Validation_Exception(__('Lütfen bağış miktarını giriniz.', 'woo-donation-popup'), array('custom_price'));
                }

                // Sanitize and validate price
                $custom_price_value = WDP_Security::sanitize_numeric($custom_price_raw, 0, 999999);
                
                if (null === $custom_price_value) {
                    throw new WDP_Validation_Exception(__('Geçersiz fiyat değeri.', 'woo-donation-popup'), array('custom_price'));
                }

                // OPTIMIZATION: WooCommerce get_meta() kullan (cache'lenmiş, daha hızlı)
                $min_price = $product->get_meta('_min_custom_price');
                $max_price = 999999; // Reasonable maximum

                if ($min_price !== '' && $custom_price_value < (float) $min_price) {
                    throw new WDP_Validation_Exception(
                        sprintf(__('Lütfen %s TL ve üstü değerler girin.', 'woo-donation-popup'), wc_format_decimal($min_price)),
                        array('custom_price' => __('Minimum fiyat: ', 'woo-donation-popup') . wc_format_decimal($min_price))
                    );
                }

                if ($custom_price_value > $max_price) {
                    throw new WDP_Validation_Exception(
                        sprintf(__('Maksimum fiyat: %s TL', 'woo-donation-popup'), number_format($max_price, 2, ',', '.')),
                        array('custom_price')
                    );
                }
            }

        if ($unique_submission_key && $timestamp) {
            $current_time = time();

            if (($current_time - $timestamp) < 30) {
                foreach (WC()->cart->get_cart() as $cart_item) {
                    if (isset($cart_item['unique_submission_key']) && $cart_item['unique_submission_key'] === $unique_submission_key) {
                        WDP_Utils::json_success(array(
                            'message' => __('Ürün zaten sepete eklenmiş', 'woo-donation-popup'),
                            'cart_count' => (int) WC()->cart->get_cart_contents_count(),
                            'checkout_url' => wc_get_checkout_url(),
                            'items' => self::get_cart_items(),
                        ));
                    }
                }
            }
        }

        // Aynı bağış verilerine sahip öğeyi kaldır
        foreach (WC()->cart->get_cart() as $cart_item_key => $cart_item) {
            if ((int) $cart_item['product_id'] === $product_id && isset($cart_item['donation_data']) && self::is_same_donation_data($cart_item['donation_data'], $donation_data)) {
                WC()->cart->remove_cart_item($cart_item_key);
                break;
            }
        }

        $cart_item_data = array(
            'donation_data' => $donation_data,
            'unique_key' => md5(serialize(array($product_id, microtime(true), wp_rand()))),
        );

        if ($unique_submission_key) {
            $cart_item_data['unique_submission_key'] = $unique_submission_key;
        }

        if ($allow_custom_price && null !== $custom_price_value) {
            $cart_item_data['custom_price'] = $custom_price_value;
        }

        if ($is_direct_share_form) {
            $cart_item_data['is_direct_share_form'] = true;

            if ('' !== $custom_price_type) {
                $cart_item_data['custom_price_type'] = $custom_price_type;
            }
        }

            $cart_item_key = WC()->cart->add_to_cart($product_id, $quantity, $variation_id, array(), $cart_item_data);

            if (!$cart_item_key) {
                throw new WDP_Cart_Exception(__('Ürün sepete eklenirken bir hata oluştu.', 'woo-donation-popup'));
            }

            WDP_Utils::json_success(array(
                'message' => __('Ürün sepete eklendi.', 'woo-donation-popup'),
                'cart_item_key' => $cart_item_key,
                'cart_count' => (int) WC()->cart->get_cart_contents_count(),
                'checkout_url' => wc_get_checkout_url(),
                'items' => self::get_cart_items(),
            ));
        } catch (WDP_Validation_Exception $e) {
            WDP_Utils::json_error($e);
        } catch (WDP_Security_Exception $e) {
            WDP_Utils::json_error($e);
        } catch (WDP_Cart_Exception $e) {
            WDP_Utils::json_error($e);
        } catch (WDP_Exception $e) {
            WDP_Utils::json_error($e);
        } catch (Exception $e) {
            WDP_Utils::handle_exception($e, true);
        }
    }

    /**
     * Check if two donation data are the same
     *
     * @param array $data1 First donation data.
     * @param array $data2 Second donation data.
     * @return bool
     */
    private static function is_same_donation_data($data1, $data2) {
        if (empty($data1) && empty($data2)) {
            return true;
        }

        if (empty($data1) || empty($data2)) {
            return false;
        }

        // Check share count
        if (isset($data1['share_count']) && isset($data2['share_count'])) {
            if ($data1['share_count'] !== $data2['share_count']) {
                return false;
            }

            // If share counts match, check shareholders
            if (isset($data1['shareholders']) && isset($data2['shareholders'])) {
                if (count($data1['shareholders']) !== count($data2['shareholders'])) {
                    return false;
                }

                foreach ($data1['shareholders'] as $index => $shareholder1) {
                    if (!isset($data2['shareholders'][$index])) {
                        return false;
                    }

                    $shareholder2 = $data2['shareholders'][$index];

                    if ((isset($shareholder1['name']) ? $shareholder1['name'] : '') !== (isset($shareholder2['name']) ? $shareholder2['name'] : '')) {
                        return false;
                    }

                    if ((isset($shareholder1['phone']) ? $shareholder1['phone'] : '') !== (isset($shareholder2['phone']) ? $shareholder2['phone'] : '')) {
                        return false;
                    }
                }
            } elseif (isset($data1['shareholders']) || isset($data2['shareholders'])) {
                return false;
            }
        } else {
            // Check single donation data
            if ((isset($data1['full_name']) ? $data1['full_name'] : '') !== (isset($data2['full_name']) ? $data2['full_name'] : '')) {
                return false;
            }

            if ((isset($data1['phone']) ? $data1['phone'] : '') !== (isset($data2['phone']) ? $data2['phone'] : '')) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get cart count via AJAX
     */
    public static function get_cart_count() {
        check_ajax_referer('wdp_get_cart_count', 'security');

        if (!function_exists('WC') || !isset(WC()->cart)) {
            WDP_Utils::json_error(__('WooCommerce sepet nesnesi bulunamadı.', 'woo-donation-popup'));
        }

        WDP_Utils::json_success(array(
            'cart_count' => (int) WC()->cart->get_cart_contents_count(),
        ));
    }

    /**
     * Get cart contents via AJAX
     */
    public static function get_cart_contents() {
        check_ajax_referer('wdp_get_cart_contents', 'security');

        if (!function_exists('WC') || !isset(WC()->cart)) {
            WDP_Utils::json_error(__('WooCommerce sepet nesnesi bulunamadı.', 'woo-donation-popup'));
        }

        WDP_Utils::json_success(array(
            'items' => self::get_cart_items(),
            'cart_count' => (int) WC()->cart->get_cart_contents_count(),
        ));
    }

    /**
     * Get cart items formatted for response
     *
     * @return array
     */
    private static function get_cart_items() {
        if (!function_exists('WC') || !isset(WC()->cart)) {
            return array();
        }

        $items = array();

        foreach (WC()->cart->get_cart() as $cart_item_key => $cart_item) {
            $product = $cart_item['data'];

            if (!$product) {
                continue;
            }

            // Numeric fiyat hesapla (JavaScript için)
            $product_price = floatval($product->get_price());
            $quantity = intval($cart_item['quantity']);
            $line_total = $product_price * $quantity;

            // Custom price varsa onu kullan
            if (isset($cart_item['custom_price'])) {
                $custom_price = floatval($cart_item['custom_price']);
                $line_total = $custom_price * $quantity;
                $product_price = $custom_price;
            }

            $item_data = array(
                'key' => $cart_item_key,
                'product_id' => $cart_item['product_id'],
                'product_name' => $product->get_name(),
                'quantity' => $quantity,
                'price' => $product_price, // Numeric değer (JavaScript için)
                'line_total' => $line_total, // Toplam fiyat (JavaScript için)
                'price_html' => wc_price($line_total), // Formatlanmış HTML (isteğe bağlı)
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
}

// Note: init() is called by Woo_Donation_Popup::__construct()


<?php
/**
 * Cart operations class
 * Handles cart item data, validation, and display
 * 
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Class WDP_Cart
 */
class WDP_Cart {

    /**
     * Initialize cart hooks
     */
    public static function init() {
        // Sepete ürün eklenirken özel bağış verilerini alma
        add_filter('woocommerce_add_cart_item_data', array(__CLASS__, 'add_donation_item_data'), 10, 3);

        // Sepete ekleme öncesi doğrulama (zorunlu alanlar kontrolü)
        add_filter('woocommerce_add_to_cart_validation', array(__CLASS__, 'validate_donation_fields'), 10, 5);

        // Sepet sayfasında bağış bilgilerini göster
        add_filter('woocommerce_get_item_data', array(__CLASS__, 'display_donation_data_in_cart'), 10, 2);

        // Özel fiyat uygulaması için gerekli hook'lar
        add_filter('woocommerce_before_calculate_totals', array(__CLASS__, 'apply_custom_price_to_cart'), 99);
        add_filter('woocommerce_cart_item_price', array(__CLASS__, 'custom_cart_item_price'), 10, 3);
        add_filter('woocommerce_cart_item_subtotal', array(__CLASS__, 'custom_cart_item_subtotal'), 10, 3);

        // Hisseli ürünler için miktar girişini devre dışı bırak
        add_filter('woocommerce_cart_item_quantity', array(__CLASS__, 'disable_quantity_input_for_share_items'), 10, 3);
        add_filter('woocommerce_update_cart_validation', array(__CLASS__, 'prevent_share_items_quantity_update'), 10, 4);
    }

    /**
     * Add donation data to cart item
     *
     * @param array $cart_item_data Cart item data.
     * @param int   $product_id     Product ID.
     * @param int   $variation_id   Variation ID.
     * @return array
     */
    public static function add_donation_item_data($cart_item_data, $product_id, $variation_id) {
        // Sadece bağış formundan gelen istekleri işleme al
        if (isset($_POST['donation_modal']) && $_POST['donation_modal'] == '1') {
            $donation_data = array();

            // Çoklu hisse kontrolü
            $share_count = isset($_POST['share_count']) ? absint($_POST['share_count']) : 0;

            if ($share_count > 0) {
                $donation_data['share_count'] = $share_count;

                // Hissedar bilgilerini al
                $shareholders = array();

                for ($i = 1; $i <= $share_count; $i++) {
                    $shareholder = array();

                    if (isset($_POST['shareholder_name_' . $i])) {
                        $shareholder['name'] = sanitize_text_field($_POST['shareholder_name_' . $i]);
                    }

                    if (isset($_POST['shareholder_phone_' . $i])) {
                        $shareholder['phone'] = sanitize_text_field($_POST['shareholder_phone_' . $i]);
                    }

                    if (isset($_POST['shareholder_note_' . $i])) {
                        $shareholder['note'] = sanitize_textarea_field($_POST['shareholder_note_' . $i]);
                    }

                    if (!empty($shareholder)) {
                        $shareholders[$i] = $shareholder;
                    }
                }

                if (!empty($shareholders)) {
                    $donation_data['shareholders'] = $shareholders;
                }

                // Hisse adedini ayrı bir alanda sakla, quantity'yi değiştirme
                if ($share_count > 0) {
                    $cart_item_data['share_count_hidden'] = $share_count;
                }
            } else {
                // Normal bağış verilerini al
                if (!empty($_POST['donation_full_name'])) {
                    $donation_data['full_name'] = sanitize_text_field($_POST['donation_full_name']);
                }

                if (!empty($_POST['donation_phone'])) {
                    $donation_data['phone'] = sanitize_text_field($_POST['donation_phone']);
                }

                if (isset($_POST['donation_note'])) {
                    $donation_data['note'] = sanitize_textarea_field($_POST['donation_note']);
                }
            }

            if (!empty($donation_data)) {
                // Bu verileri sepette ürünün yanına ekle
                $cart_item_data['donation_data'] = $donation_data;

                // Benzersiz gönderim anahtarını ekle (eğer varsa)
                if (isset($_POST['unique_submission_key']) && !empty($_POST['unique_submission_key'])) {
                    $cart_item_data['unique_submission_key'] = sanitize_text_field($_POST['unique_submission_key']);
                }

                // Her sepete ekleme işlemine özgü benzersiz bir anahtar oluştur
                $unique_data = array(
                    'time' => microtime(),
                    'rand' => rand(),
                    'product_id' => $product_id,
                    'ip' => isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '',
                    'form_data' => $donation_data,
                    'custom_price' => isset($_POST['custom_price']) ? $_POST['custom_price'] : '',
                );

                $cart_item_data['unique_key'] = md5(serialize($unique_data));
            }

            // Özel fiyat değerini ekle
            if (isset($_POST['custom_price']) && !empty($_POST['custom_price'])) {
                $cart_item_data['custom_price'] = floatval($_POST['custom_price']);
            }
        }

        return $cart_item_data;
    }

    /**
     * Validate donation fields before adding to cart
     *
     * @param bool  $passed        Validation result.
     * @param int   $product_id    Product ID.
     * @param int   $quantity      Quantity.
     * @param int   $variation_id  Variation ID.
     * @param array $variations    Variations.
     * @return bool
     */
    public static function validate_donation_fields($passed, $product_id, $quantity, $variation_id = '', $variations = array()) {
        // Sadece bağış formundan gelen istekleri işleme al
        if (isset($_POST['donation_modal']) && $_POST['donation_modal'] == '1') {
            // Çoklu hisse kontrolü
            $share_count = isset($_POST['share_count']) ? absint($_POST['share_count']) : 0;

            if ($share_count > 0) {
                // Hissedar bilgilerini kontrol et
                $valid = true;
                $missing_fields = array();

                for ($i = 1; $i <= $share_count; $i++) {
                    if (!isset($_POST['shareholder_name_' . $i]) || empty($_POST['shareholder_name_' . $i])) {
                        $valid = false;
                        $missing_fields[] = $i . '. Hissedar Adı';
                    }

                    if (!isset($_POST['shareholder_phone_' . $i]) || empty($_POST['shareholder_phone_' . $i])) {
                        $valid = false;
                        $missing_fields[] = $i . '. Hissedar Telefonu';
                    }
                }

                if (!$valid) {
                    wc_add_notice(__('Lütfen tüm zorunlu alanları doldurun: ', 'woo-donation-popup') . implode(', ', $missing_fields), 'error');
                    return false;
                }
            } else {
                // Normal bağış verilerini kontrol et
                if (!isset($_POST['donation_full_name']) || empty($_POST['donation_full_name'])) {
                    wc_add_notice(__('Lütfen Ad Soyad bilginizi giriniz.', 'woo-donation-popup'), 'error');
                    return false;
                }

                if (!isset($_POST['donation_phone']) || empty($_POST['donation_phone'])) {
                    wc_add_notice(__('Lütfen Telefon bilginizi giriniz.', 'woo-donation-popup'), 'error');
                    return false;
                }
            }

            // Özel fiyat kontrolü
            $allow_custom_price = get_post_meta($product_id, '_allow_custom_price', true) === 'yes';

            if ($allow_custom_price) {
                if (!isset($_POST['custom_price']) || empty($_POST['custom_price'])) {
                    wc_add_notice(__('Lütfen bağış miktarını giriniz.', 'woo-donation-popup'), 'error');
                    return false;
                }

                // Minimum fiyat kontrolü
                $min_price = get_post_meta($product_id, '_min_custom_price', true);
                if ($min_price !== '' && floatval($_POST['custom_price']) < floatval($min_price)) {
                    wc_add_notice(sprintf(__('Lütfen %s TL ve üstü değerler girin.', 'woo-donation-popup'), wc_format_decimal($min_price)), 'error');
                    return false;
                }
            }
        }

        return $passed;
    }

    /**
     * Display donation data in cart
     *
     * @param array $item_data Item data.
     * @param array $cart_item  Cart item.
     * @return array
     */
    public static function display_donation_data_in_cart($item_data, $cart_item) {
        if (isset($cart_item['donation_data'])) {
            $donation_data = $cart_item['donation_data'];

            // Çoklu hisse kontrolü
            if (isset($donation_data['share_count']) && $donation_data['share_count'] > 0) {
                $item_data[] = array(
                    'key' => __('Hisse Sayısı', 'woo-donation-popup'),
                    'value' => $donation_data['share_count'],
                );

                // Hissedar bilgilerini göster
                if (isset($donation_data['shareholders'])) {
                    foreach ($donation_data['shareholders'] as $key => $shareholder) {
                        if (!empty($shareholder['name'])) {
                            $item_data[] = array(
                                'key' => sprintf(__('%d. Hissedar', 'woo-donation-popup'), $key),
                                'value' => $shareholder['name'] . (!empty($shareholder['phone']) ? ' (' . $shareholder['phone'] . ')' : ''),
                            );
                        }
                    }
                }
            } else {
                // Normal bağış verilerini göster
                if (!empty($donation_data['full_name'])) {
                    $item_data[] = array(
                        'key' => __('Bağışçı', 'woo-donation-popup'),
                        'value' => $donation_data['full_name'] . (!empty($donation_data['phone']) ? ' (' . $donation_data['phone'] . ')' : ''),
                    );
                }
            }
        }

        return $item_data;
    }

    /**
     * Apply custom price to cart items
     *
     * @param WC_Cart $cart Cart object.
     */
    public static function apply_custom_price_to_cart($cart) {
        foreach ($cart->get_cart() as $cart_item_key => $cart_item) {
            if (isset($cart_item['custom_price'])) {
                $product = $cart_item['data'];
                $custom_price = floatval($cart_item['custom_price']);
                $product->set_price($custom_price);
            }
        }
    }

    /**
     * Custom cart item price display
     *
     * @param string $price     Price HTML.
     * @param array  $cart_item Cart item.
     * @param string $cart_item_key Cart item key.
     * @return string
     */
    public static function custom_cart_item_price($price, $cart_item, $cart_item_key) {
        if (isset($cart_item['custom_price'])) {
            $custom_price = floatval($cart_item['custom_price']);
            return wc_price($custom_price);
        }

        return $price;
    }

    /**
     * Custom cart item subtotal display
     *
     * @param string $price     Subtotal HTML.
     * @param array  $cart_item Cart item.
     * @param string $cart_item_key Cart item key.
     * @return string
     */
    public static function custom_cart_item_subtotal($price, $cart_item, $cart_item_key) {
        if (isset($cart_item['custom_price'])) {
            $custom_price = floatval($cart_item['custom_price']);
            $quantity = $cart_item['quantity'];
            return wc_price($custom_price * $quantity);
        }

        return $price;
    }

    /**
     * Disable quantity input for share items
     *
     * @param string $product_quantity Product quantity HTML.
     * @param string $cart_item_key    Cart item key.
     * @param array  $cart_item        Cart item.
     * @return string
     */
    public static function disable_quantity_input_for_share_items($product_quantity, $cart_item_key, $cart_item) {
        if (isset($cart_item['donation_data']['share_count']) && $cart_item['donation_data']['share_count'] > 0) {
            return '<span>' . $cart_item['quantity'] . '</span>';
        }

        return $product_quantity;
    }

    /**
     * Prevent quantity update for share items
     *
     * @param bool  $passed       Validation result.
     * @param string $cart_item_key Cart item key.
     * @param array $values        Values.
     * @param int   $quantity      Quantity.
     * @return bool
     */
    public static function prevent_share_items_quantity_update($passed, $cart_item_key, $values, $quantity) {
        if (isset($values['donation_data']['share_count']) && $values['donation_data']['share_count'] > 0) {
            return false; // Prevent quantity update
        }

        return $passed;
    }
}

// Note: init() is called by Woo_Donation_Popup::__construct()


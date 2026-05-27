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
        add_action('woocommerce_before_calculate_totals', array(__CLASS__, 'apply_custom_price_to_cart'), 99);
        add_filter('woocommerce_cart_item_price', array(__CLASS__, 'custom_cart_item_price'), 10, 3);
        add_filter('woocommerce_cart_item_subtotal', array(__CLASS__, 'custom_cart_item_subtotal'), 10, 3);

        // Hisseli ürünler için miktar girişini devre dışı bırak
        add_filter('woocommerce_cart_item_quantity', array(__CLASS__, 'disable_quantity_input_for_share_items'), 10, 3);
        add_filter('woocommerce_update_cart_validation', array(__CLASS__, 'prevent_share_items_quantity_update'), 10, 4);

        add_filter('woocommerce_cart_item_class', array(__CLASS__, 'filter_cart_item_css_class'), 10, 3);
        add_filter('woocommerce_cart_item_name', array(__CLASS__, 'filter_cart_item_display_name'), 10, 3);
        add_filter('woocommerce_cart_item_thumbnail', array(__CLASS__, 'filter_cart_item_thumbnail'), 10, 3);
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
        $request_data = self::get_request_data();
        if (self::is_ajax_add_to_cart_flow($request_data)) {
            return $cart_item_data;
        }

        // Sadece bağış formundan gelen istekleri işleme al
        if (self::is_donation_modal_request($request_data)) {
            $donation_data = array();

            // Çoklu hisse kontrolü
            $share_count = isset($request_data['share_count']) ? absint($request_data['share_count']) : 0;
            $max_share_count = self::get_max_share_count($product_id);

            if ($share_count > 0) {
                $share_count = min($share_count, $max_share_count);
                $donation_data['share_count'] = $share_count;

                // Hissedar bilgilerini al
                $shareholders = array();

                for ($i = 1; $i <= $share_count; $i++) {
                    $shareholder = array();

                    if (isset($request_data['shareholder_name_' . $i])) {
                        $shareholder['name'] = sanitize_text_field($request_data['shareholder_name_' . $i]);
                    }

                    if (isset($request_data['shareholder_phone_' . $i])) {
                        $shareholder['phone'] = sanitize_text_field($request_data['shareholder_phone_' . $i]);
                    }

                    if (isset($request_data['shareholder_note_' . $i])) {
                        $shareholder['note'] = sanitize_textarea_field($request_data['shareholder_note_' . $i]);
                    }

                    if (isset($request_data['shareholder_email_' . $i])) {
                        $maybe_email = sanitize_email($request_data['shareholder_email_' . $i]);
                        if ('' !== $maybe_email) {
                            $shareholder['email'] = $maybe_email;
                        }
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
                if (!empty($request_data['donation_full_name'])) {
                    $donation_data['full_name'] = sanitize_text_field($request_data['donation_full_name']);
                }

                if (!empty($request_data['donation_phone'])) {
                    $donation_data['phone'] = sanitize_text_field($request_data['donation_phone']);
                }

                if (isset($request_data['donation_note'])) {
                    $donation_data['note'] = sanitize_textarea_field($request_data['donation_note']);
                }
            }

            if (!empty($donation_data)) {
                // Bu verileri sepette ürünün yanına ekle
                $cart_item_data['donation_data'] = $donation_data;

                // Benzersiz gönderim anahtarını ekle (eğer varsa)
                if (isset($request_data['unique_submission_key']) && !empty($request_data['unique_submission_key'])) {
                    $cart_item_data['unique_submission_key'] = sanitize_text_field($request_data['unique_submission_key']);
                }

                // Her sepete ekleme işlemine özgü benzersiz bir anahtar oluştur
                $unique_data = array(
                    'time' => microtime(),
                    'rand' => rand(),
                    'product_id' => $product_id,
                    'ip' => isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '',
                    'form_data' => $donation_data,
                    'custom_price' => isset($request_data['custom_price']) ? $request_data['custom_price'] : '',
                );

                $cart_item_data['unique_key'] = md5(serialize($unique_data));
            }

            // Özel fiyat değerini ekle
            if (isset($request_data['custom_price']) && '' !== $request_data['custom_price']) {
                $custom_price = self::sanitize_custom_price($request_data['custom_price']);
                if (null !== $custom_price) {
                    $cart_item_data['custom_price'] = $custom_price;
                }
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
        $request_data = self::get_request_data();
        if (self::is_ajax_add_to_cart_flow($request_data)) {
            return $passed;
        }

        // Sadece bağış formundan gelen istekleri işleme al
        if (self::is_donation_modal_request($request_data)) {
            if (!self::is_valid_donation_form_nonce($request_data)) {
                wc_add_notice(__('Güvenlik doğrulaması başarısız oldu. Lütfen sayfayı yenileyip tekrar deneyin.', 'woo-donation-popup'), 'error');
                return false;
            }

            // Çoklu hisse kontrolü
            $share_count = isset($request_data['share_count']) ? absint($request_data['share_count']) : 0;
            $max_share_count = self::get_max_share_count($product_id);

            if ($share_count > 0) {
                if ($share_count > $max_share_count) {
                    wc_add_notice(
                        sprintf(
                            __('Maksimum hisse sayısı: %d', 'woo-donation-popup'),
                            $max_share_count
                        ),
                        'error'
                    );
                    return false;
                }

                // Hissedar bilgilerini kontrol et
                $valid = true;
                $missing_fields = array();

                for ($i = 1; $i <= $share_count; $i++) {
                    if (!isset($request_data['shareholder_name_' . $i]) || empty($request_data['shareholder_name_' . $i])) {
                        $valid = false;
                        $missing_fields[] = $i . '. Hissedar Adı';
                    }

                    if (!isset($request_data['shareholder_phone_' . $i]) || empty($request_data['shareholder_phone_' . $i])) {
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
                if (!isset($request_data['donation_full_name']) || empty($request_data['donation_full_name'])) {
                    wc_add_notice(__('Lütfen Ad Soyad bilginizi giriniz.', 'woo-donation-popup'), 'error');
                    return false;
                }

                if (!isset($request_data['donation_phone']) || empty($request_data['donation_phone'])) {
                    wc_add_notice(__('Lütfen Telefon bilginizi giriniz.', 'woo-donation-popup'), 'error');
                    return false;
                }
            }

            // Özel fiyat kontrolü
            // OPTIMIZATION: WooCommerce get_meta() kullan (cache'lenmiş, daha hızlı)
            $product = wc_get_product($product_id);
            if (!$product) {
                return $passed;
            }
            $allow_custom_price = $product->get_meta('_allow_custom_price') === 'yes';

            if ($allow_custom_price) {
                if (!isset($request_data['custom_price']) || '' === $request_data['custom_price']) {
                    wc_add_notice(__('Lütfen bağış miktarını giriniz.', 'woo-donation-popup'), 'error');
                    return false;
                }

                $custom_price = self::sanitize_custom_price($request_data['custom_price']);
                if (null === $custom_price) {
                    wc_add_notice(__('Geçersiz bağış miktarı girdiniz.', 'woo-donation-popup'), 'error');
                    return false;
                }

                // Minimum fiyat kontrolü
                // OPTIMIZATION: WooCommerce get_meta() kullan (cache'lenmiş, daha hızlı)
                $min_price = $product->get_meta('_min_custom_price');
                if ($min_price !== '' && $custom_price < floatval($min_price)) {
                    wc_add_notice(sprintf(__('Lütfen %s TL ve üstü değerler girin.', 'woo-donation-popup'), wc_format_decimal($min_price)), 'error');
                    return false;
                }
            }
        }

        return $passed;
    }

    /**
     * Return unslashed request payload.
     *
     * @return array
     */
    private static function get_request_data() {
        if (!isset($_POST) || !is_array($_POST)) {
            return array();
        }

        return wp_unslash($_POST);
    }

    /**
     * Check if current request is donation modal submission.
     *
     * @param array $request_data Request payload.
     * @return bool
     */
    private static function is_donation_modal_request(array $request_data) {
        return isset($request_data['donation_modal']) && '1' == $request_data['donation_modal'];
    }

    /**
     * Detect internal AJAX add-to-cart flow to avoid duplicate processing.
     *
     * @param array $request_data Request payload.
     * @return bool
     */
    private static function is_ajax_add_to_cart_flow(array $request_data) {
        return isset($request_data['action'], $request_data['wdp_ajax_flow'])
            && $request_data['action'] === 'wdp_ajax_add_to_cart'
            && $request_data['wdp_ajax_flow'] === '1';
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

                        if (!empty($shareholder['email'])) {
                            $item_data[] = array(
                                'key' => sprintf(__('%d. Hissedar E-postası', 'woo-donation-popup'), $key),
                                'value' => $shareholder['email'],
                            );
                        }

                        if (isset($shareholder['note']) && $shareholder['note'] !== '') {
                            $item_data[] = array(
                                'key' => sprintf(__('%d. Hissedar Notu', 'woo-donation-popup'), $key),
                                'value' => $shareholder['note'],
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

                if (isset($donation_data['note']) && $donation_data['note'] !== '') {
                    $item_data[] = array(
                        'key' => __('Bağış Notu', 'woo-donation-popup'),
                        'value' => $donation_data['note'],
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
        if (!$cart || !is_a($cart, 'WC_Cart')) {
            return;
        }

        foreach ($cart->get_cart() as $cart_item_key => $cart_item) {
            if (!empty($cart_item['wdp_sadaka_donation'])) {
                $cart_item = self::sync_sadaka_line_wc_product($cart, $cart_item_key, $cart_item);
            }

            if (empty($cart_item['data']) || !is_a($cart_item['data'], 'WC_Product')) {
                continue;
            }

            $line_price = self::resolve_cart_line_unit_price($cart_item);
            if (null === $line_price) {
                continue;
            }

            $line_product = clone $cart_item['data'];
            $line_product->set_price($line_price);
            $cart->cart_contents[ $cart_item_key ]['data'] = $line_product;
        }
    }

    /**
     * Sadaka satırı için bağlı WC ürün ID'si (görsel / isim).
     *
     * @param array $cart_item Cart row.
     * @return int
     */
    public static function resolve_sadaka_line_wc_product_id(array $cart_item) {
        if (empty($cart_item['wdp_sadaka_donation'])) {
            return 0;
        }

        $line_product_id = isset($cart_item['product_id']) ? (int) $cart_item['product_id'] : 0;
        if (!empty($cart_item['wdp_sadaka_linked_wc_product']) && $line_product_id > 0) {
            return $line_product_id;
        }

        $parent_id = !empty($cart_item['wdp_parent_product_id'])
            ? (int) $cart_item['wdp_parent_product_id']
            : 0;

        if ($parent_id > 0 && class_exists('WDP_Utils')) {
            $resolved = (int) WDP_Utils::resolve_sadaka_wc_product_id($parent_id);
            if ($resolved > 0) {
                return $resolved;
            }
        }

        return $line_product_id;
    }

    /**
     * Sepet satırını bağlı Sadaka WC ürününe hizala (görsel + ürün adı).
     *
     * @param WC_Cart $cart          Cart.
     * @param string  $cart_item_key Key.
     * @param array   $cart_item     Row.
     * @return array
     */
    private static function sync_sadaka_line_wc_product($cart, $cart_item_key, array $cart_item) {
        $target_id = self::resolve_sadaka_line_wc_product_id($cart_item);
        $current_id = isset($cart_item['product_id']) ? (int) $cart_item['product_id'] : 0;

        if ($target_id <= 0 || $target_id === $current_id) {
            return $cart_item;
        }

        $sadaka_product = wc_get_product($target_id);
        if (!$sadaka_product || !$sadaka_product->exists()) {
            return $cart_item;
        }

        $cart_item['product_id'] = $target_id;
        $cart_item['data'] = $sadaka_product;
        $cart_item['wdp_sadaka_linked_wc_product'] = true;

        if (is_array($cart->cart_contents) && isset($cart->cart_contents[ $cart_item_key ])) {
            $cart->cart_contents[ $cart_item_key ]['product_id'] = $target_id;
            $cart->cart_contents[ $cart_item_key ]['data'] = $sadaka_product;
            $cart->cart_contents[ $cart_item_key ]['wdp_sadaka_linked_wc_product'] = true;
        }

        return $cart_item;
    }

    /**
     * Resolve per-line unit price (main donation vs optional sadaka line).
     *
     * @param array $cart_item Cart row.
     * @return float|null
     */
    /**
     * Public accessor for cart line unit price (used by AJAX cart payload).
     *
     * @param array $cart_item Cart row.
     * @return float|null
     */
    public static function get_cart_line_unit_price(array $cart_item) {
        return self::resolve_cart_line_unit_price($cart_item);
    }

    private static function resolve_cart_line_unit_price(array $cart_item) {
        if (!empty($cart_item['wdp_sadaka_donation'])) {
            if (!isset($cart_item['custom_price'])) {
                return null;
            }
            return self::sanitize_custom_price($cart_item['custom_price']);
        }

        if (isset($cart_item['custom_price'])) {
            return self::sanitize_custom_price($cart_item['custom_price']);
        }

        if (isset($cart_item['wdp_base_unit_price'])) {
            $stored = self::sanitize_custom_price($cart_item['wdp_base_unit_price']);
            if (null !== $stored && $stored > 0) {
                return $stored;
            }
        }

        $product_id = !empty($cart_item['product_id']) ? (int) $cart_item['product_id'] : 0;
        if ($product_id <= 0) {
            return null;
        }

        $catalog = wc_get_product($product_id);
        if (!$catalog) {
            return null;
        }

        $base = (float) $catalog->get_regular_price('edit');
        if ($base <= 0) {
            $base = (float) $catalog->get_price('edit');
        }

        return $base > 0 ? $base : null;
    }

    /**
     * CSS class for sadaka rows on cart/checkout tables.
     *
     * @param string $class        Classes.
     * @param array  $cart_item    Cart item.
     * @param string $cart_item_key Key.
     * @return string
     */
    public static function filter_cart_item_css_class($class, $cart_item, $cart_item_key) {
        unset($cart_item_key);
        if (!empty($cart_item['wdp_sadaka_donation'])) {
            $class .= ' wdp-cart-line--sadaka';
        }
        return trim($class);
    }

    /**
     * Display name suffix for sadaka cart lines.
     *
     * @param string $product_name Name HTML.
     * @param array  $cart_item    Cart item.
     * @param string $cart_item_key Key.
     * @return string
     */
    public static function filter_cart_item_display_name($product_name, $cart_item, $cart_item_key) {
        unset($cart_item_key);
        if (empty($cart_item['wdp_sadaka_donation'])) {
            return $product_name;
        }

        $display_id = self::resolve_sadaka_line_wc_product_id($cart_item);
        if ($display_id > 0) {
            $display_product = wc_get_product($display_id);
            if ($display_product && $display_product->exists()) {
                $parent_id = !empty($cart_item['wdp_parent_product_id'])
                    ? (int) $cart_item['wdp_parent_product_id']
                    : (int) ($cart_item['product_id'] ?? 0);
                if ($display_id !== $parent_id || !empty($cart_item['wdp_sadaka_linked_wc_product'])) {
                    return wp_kses_post($display_product->get_name());
                }
            }
        }

        return esc_html__('Alt Bağış', 'woo-donation-popup');
    }

    /**
     * Sadaka satırında WooCommerce ürün görseli (bağlı Sadaka ürünü).
     *
     * @param string $thumbnail     Default HTML.
     * @param array  $cart_item     Cart row.
     * @param string $cart_item_key Key.
     * @return string
     */
    public static function filter_cart_item_thumbnail($thumbnail, $cart_item, $cart_item_key) {
        unset($cart_item_key);
        if (empty($cart_item['wdp_sadaka_donation'])) {
            return $thumbnail;
        }

        $display_id = self::resolve_sadaka_line_wc_product_id($cart_item);
        if ($display_id <= 0) {
            return $thumbnail;
        }

        $display_product = wc_get_product($display_id);
        if (!$display_product || !$display_product->exists()) {
            return $thumbnail;
        }

        $parent_id = !empty($cart_item['wdp_parent_product_id'])
            ? (int) $cart_item['wdp_parent_product_id']
            : (int) ($cart_item['product_id'] ?? 0);

        if ($display_id === $parent_id && empty($cart_item['wdp_sadaka_linked_wc_product'])) {
            return $thumbnail;
        }

        $image = $display_product->get_image(
            apply_filters('wdp_sadaka_cart_thumbnail_size', 'woocommerce_thumbnail'),
            array(
                'class' => 'wdp-sadaka-cart-thumb',
            )
        );

        return $image ? $image : $thumbnail;
    }

    /**
     * Validate donation form nonce for non-AJAX add-to-cart requests.
     *
     * @param array $request_data Request payload.
     * @return bool
     */
    private static function is_valid_donation_form_nonce(array $request_data) {
        $nonce = isset($request_data['wdp_nonce']) ? sanitize_text_field($request_data['wdp_nonce']) : '';
        if ($nonce === '') {
            return false;
        }

        return (bool) wp_verify_nonce($nonce, 'wdp_nonajax_add_to_cart');
    }

    /**
     * Sanitize custom price to avoid negative or abusive values.
     *
     * @param mixed $value Raw value.
     * @return float|null
     */
    private static function sanitize_custom_price($value) {
        if (!class_exists('WDP_Security')) {
            $numeric = is_numeric($value) ? (float) $value : null;
            if (null === $numeric || $numeric < 0 || $numeric > 999999) {
                return null;
            }
            return $numeric;
        }

        return WDP_Security::sanitize_numeric($value, 0, 999999);
    }

    /**
     * Determine max share count for product with safety fallback.
     *
     * @param int $product_id Product ID.
     * @return int
     */
    private static function get_max_share_count($product_id) {
        $product = wc_get_product($product_id);
        if (!$product) {
            return 50;
        }

        $configured_max = absint($product->get_meta('_max_shares'));
        if ($configured_max < 1) {
            $configured_max = 7;
        }

        return min($configured_max, 50);
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
        unset($cart_item_key);
        $unit = self::resolve_cart_line_unit_price($cart_item);
        if (null !== $unit) {
            return WDP_Utils::format_price_html($unit);
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
        unset($cart_item_key);
        $unit = self::resolve_cart_line_unit_price($cart_item);
        if (null !== $unit) {
            $quantity = isset($cart_item['quantity']) ? max(1, (int) $cart_item['quantity']) : 1;
            return WDP_Utils::format_price_html($unit * $quantity);
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


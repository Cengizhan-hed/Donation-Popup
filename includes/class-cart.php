<?php
/**
 * WooCommerce sepet kancaları; bağış verisi, özel fiyat, hisse kilidi ve görünüm filtreleri.
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
        add_action('woocommerce_store_api_validate_add_to_cart', array(__CLASS__, 'validate_store_api_add_to_cart'), 10, 2);

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
                $parsed = self::parse_shareholders_from_request(
                    $request_data,
                    $share_count,
                    array(
                        'max_shares'      => $max_share_count,
                        'require_contact' => false,
                    )
                );
                $share_count = $parsed['share_count'];
                $donation_data['share_count'] = $share_count;

                if (!empty($parsed['shareholders'])) {
                    $donation_data['shareholders'] = $parsed['shareholders'];
                }

                // Hisse adedini ayrı bir alanda sakla, quantity'yi değiştirme
                if ($share_count > 0) {
                    $cart_item_data['share_count_hidden'] = $share_count;
                }
            } else {
                // Normal bağış verilerini al (legacy donation_modal=1 yolu; AJAX akışı bu filtreyi atlar).
                if (!empty($request_data['donation_full_name'])) {
                    $donation_data['full_name'] = WDP_Security::sanitize_text($request_data['donation_full_name'], WDP_Donation_Optional_Fields::NAME_MAX);
                }

                if (!empty($request_data['donation_phone'])) {
                    $donation_data['phone'] = WDP_Security::sanitize_phone($request_data['donation_phone']);
                }

                if (isset($request_data['donation_note'])) {
                    $donation_data['note'] = WDP_Security::sanitize_textarea($request_data['donation_note'], WDP_Donation_Optional_Fields::NOTE_MAX);
                }

                // 10.30.0: e-posta/ithaf/anonim — kapalıysa yok say; geçersiz e-posta sepete eklemeyi durdurur.
                try {
                    WDP_Donation_Optional_Fields::apply_from_request($product_id, $request_data, $donation_data);
                } catch (WDP_Validation_Exception $e) {
                    wc_add_notice($e->getMessage(), 'error');
                    // Sepet satırı oluşmasın: boş bırakıp validate aşamasına bırakılamaz; filtre veriyi yazmaz.
                    return $cart_item_data;
                }
            }

            // 10.29.0: işlem ücreti yüzdesi her zaman ürün meta'sından okunur (istemci yok sayılır).
            $cover_fee_pct = 0.0;
            if (!empty($request_data['donation_cover_fee'])) {
                $cover_fee_pct = self::get_product_cover_fee_percent($product_id);
                if ($cover_fee_pct > 0) {
                    $donation_data['cover_fee']         = '1';
                    $donation_data['cover_fee_percent'] = $cover_fee_pct;
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

            // Özel fiyat değerini ekle (aynı bağışçı kuralı; belirsiz sessiz dönüşmez)
            if (isset($request_data['custom_price']) && '' !== $request_data['custom_price']) {
                $parsed_line = class_exists('WDP_Utils')
                    ? WDP_Utils::parse_donor_amount($request_data['custom_price'])
                    : array('ok' => false, 'amount' => 0.0);
                $custom_price = (!empty($parsed_line['ok']))
                    ? self::sanitize_custom_price($parsed_line['amount'])
                    : null;
                if (null !== $custom_price) {
                    $cart_item_data['custom_price'] = self::apply_cover_fee_to_amount($custom_price, $cover_fee_pct);
                }
            } elseif ($cover_fee_pct > 0) {
                // Sabit / hisseli: birim fiyata ücret eklenir.
                $catalog = wc_get_product($product_id);
                $base    = $catalog ? (float) $catalog->get_price() : 0.0;
                if ($base > 0) {
                    $cart_item_data['wdp_base_unit_price'] = self::apply_cover_fee_to_amount($base, $cover_fee_pct);
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
        unset($quantity, $variation_id, $variations);

        // Hedef kapatıldıysa (close): yeni eklemeyi reddet (AJAX dışı WC yolu + sepette bekleyen dahil).
        if ($passed && class_exists('WDP_Campaign_Goal')) {
            $passed = WDP_Campaign_Goal::filter_add_to_cart_validation($passed, $product_id);
            if (!$passed) {
                return false;
            }
        }

        $request_data = self::get_request_data();
        if (self::is_ajax_add_to_cart_flow($request_data)) {
            return $passed;
        }

        // Native GET/POST ?add-to-cart= (bağış formu yok) — bağış ürününü sepete alma.
        if ($passed && !self::is_donation_modal_request($request_data) && self::should_reject_native_add_to_cart($product_id)) {
            if (function_exists('wc_add_notice')) {
                wc_add_notice(self::native_add_to_cart_notice(), 'error');
            }
            return false;
        }

        // Sadece bağış formundan gelen istekleri işleme al
        if (self::is_donation_modal_request($request_data)) {
            if (!self::is_valid_donation_form_nonce($request_data)) {
                wc_add_notice(__('Security verification failed. Please refresh the page and try again.', 'woo-donation-popup'), 'error');
                return false;
            }

            // Çoklu hisse kontrolü
            $share_count = isset($request_data['share_count']) ? absint($request_data['share_count']) : 0;
            $max_share_count = self::get_max_share_count($product_id);

            if ($share_count > 0) {
                if ($share_count > $max_share_count) {
                    wc_add_notice(
                        sprintf(
                            __('Maximum number of shares: %d', 'woo-donation-popup'),
                            $max_share_count
                        ),
                        'error'
                    );
                    return false;
                }

                // Hissedar bilgilerini kontrol et
                $parsed = self::parse_shareholders_from_request(
                    $request_data,
                    $share_count,
                    array(
                        'max_shares'      => $max_share_count,
                        'require_contact' => true,
                    )
                );

                if (!empty($parsed['missing_fields'])) {
                    wc_add_notice(__('Please fill in all required fields: ', 'woo-donation-popup') . implode(', ', $parsed['missing_fields']), 'error');
                    return false;
                }
            } else {
                // Normal bağış verilerini kontrol et
                if (!isset($request_data['donation_full_name']) || empty($request_data['donation_full_name'])) {
                    wc_add_notice(__('Please enter your full name.', 'woo-donation-popup'), 'error');
                    return false;
                }

                if (!isset($request_data['donation_phone']) || empty($request_data['donation_phone'])) {
                    wc_add_notice(__('Please enter your phone number.', 'woo-donation-popup'), 'error');
                    return false;
                }

                // 10.30.0: açık e-posta alanında geçersiz değer → sepete ekleme durur.
                try {
                    $probe = array();
                    WDP_Donation_Optional_Fields::apply_from_request($product_id, $request_data, $probe);
                } catch (WDP_Validation_Exception $e) {
                    wc_add_notice($e->getMessage(), 'error');
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
            if (!$allow_custom_price && $product->get_meta('_enable_progress_bar') === 'yes') {
                $allow_custom_price = true;
            }

            if ($allow_custom_price) {
                if (!isset($request_data['custom_price']) || '' === $request_data['custom_price']) {
                    wc_add_notice(__('Please enter the donation amount.', 'woo-donation-popup'), 'error');
                    return false;
                }

                $parsed_amount = class_exists('WDP_Utils')
                    ? WDP_Utils::parse_donor_amount($request_data['custom_price'])
                    : array('ok' => false, 'error' => __('You entered an invalid donation amount.', 'woo-donation-popup'));
                if (empty($parsed_amount['ok'])) {
                    $parse_error = isset($parsed_amount['error']) && $parsed_amount['error'] !== ''
                        ? (string) $parsed_amount['error']
                        : __('You entered an invalid donation amount.', 'woo-donation-popup');
                    wc_add_notice($parse_error, 'error');
                    return false;
                }
                $custom_price = self::sanitize_custom_price($parsed_amount['amount']);
                if (null === $custom_price) {
                    wc_add_notice(__('You entered an invalid donation amount.', 'woo-donation-popup'), 'error');
                    return false;
                }

                // Minimum fiyat kontrolü (ürün min'i boş/0 olsa bile tutar > 0 olmalı)
                $amount_error = self::get_donation_amount_error(
                    $custom_price,
                    $product->get_meta('_min_custom_price'),
                    (int) $product_id,
                    false
                );
                if ('' !== $amount_error) {
                    wc_add_notice($amount_error, 'error');
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
     * Notice when a donation product is added without the plugin form.
     *
     * @return string
     */
    public static function native_add_to_cart_notice() {
        return __('Please add to cart using the donation form. Donor details are required.', 'woo-donation-popup');
    }

    /**
     * Block Woo native add-to-cart (GET ?add-to-cart= / form.cart) for donation products.
     * Explicit product flag or auto_place=yes (plugin owns the add-to-cart UI).
     * Does not run for the plugin AJAX flow or donation_modal=1 POST.
     *
     * @param int $product_id Product ID.
     * @return bool
     */
    public static function should_reject_native_add_to_cart($product_id) {
        $product_id = absint($product_id);
        if ($product_id <= 0 || !class_exists('WDP_Donation_Scope')) {
            return false;
        }
        if (!WDP_Donation_Scope::is_donation_product($product_id)) {
            return false;
        }
        $product = function_exists('wc_get_product') ? wc_get_product($product_id) : null;
        $flag    = ($product && is_object($product)) ? WDP_Donation_Scope::product_flag($product) : '';
        if ($flag === 'yes') {
            return true;
        }
        return class_exists('WDP_Placement_Settings') && WDP_Placement_Settings::value('auto_place') === 'yes';
    }

    /**
     * Store API add-to-cart (blocks) — same rule as woocommerce_add_to_cart_validation.
     *
     * @param mixed $product Product being added.
     * @param mixed $request REST request (unused).
     * @return void
     */
    public static function validate_store_api_add_to_cart($product, $request = null) {
        unset($request);
        $request_data = self::get_request_data();
        if (self::is_ajax_add_to_cart_flow($request_data) || self::is_donation_modal_request($request_data)) {
            return;
        }
        $id = 0;
        if (is_object($product) && method_exists($product, 'get_id')) {
            $id = (int) $product->get_id();
        } elseif (is_numeric($product)) {
            $id = (int) $product;
        }
        if (!self::should_reject_native_add_to_cart($id)) {
            return;
        }
        $message = self::native_add_to_cart_notice();
        if (class_exists('\Automattic\WooCommerce\StoreApi\Exceptions\RouteException')) {
            throw new \Automattic\WooCommerce\StoreApi\Exceptions\RouteException(
                'woocommerce_rest_cart_invalid_product',
                $message,
                400
            );
        }
        throw new Exception($message); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- user-facing notice text.
    }

    /**
     * Cover-fee percent for a product. ALWAYS read from product meta (never from the client);
     * 0 when the product has the fee disabled. Runtime-clamped to 0.5–15.
     *
     * @param WC_Product|int $product Product or ID.
     * @return float
     */
    public static function get_product_cover_fee_percent($product) {
        if (is_numeric($product)) {
            $product = wc_get_product((int) $product);
        }
        if (!$product || !is_object($product) || !method_exists($product, 'get_meta')) {
            return 0.0;
        }
        if ('yes' !== $product->get_meta('_enable_cover_fee')) {
            return 0.0;
        }
        return WDP_Form_Modules::clamp_cover_fee_percent_for_runtime($product->get_meta('_cover_fee_percent'));
    }

    /**
     * Unit amount including the cover fee.
     *
     * @param float $amount  Base unit amount.
     * @param float $percent Fee percent (0 = none).
     * @return float
     */
    public static function apply_cover_fee_to_amount($amount, $percent) {
        $amount  = (float) $amount;
        $percent = (float) $percent;
        if ($percent <= 0 || $amount <= 0) {
            return $amount;
        }
        $dp = function_exists('wc_get_price_decimals') ? (int) wc_get_price_decimals() : 2;
        return round($amount * (1 + ($percent / 100)), max(0, $dp));
    }

    /**
     * Whether the product form has the quantity selector (fixed type only; default on).
     *
     * @param WC_Product $product Product.
     * @return bool
     */
    public static function product_allows_quantity($product) {
        if (!$product || !is_object($product) || !method_exists($product, 'get_meta')) {
            return true;
        }
        if ('no' === $product->get_meta('_enable_quantity')) {
            return false;
        }
        $type = WDP_Donation_Type::infer_from_meta(
            array(
                '_allow_custom_price'    => (string) $product->get_meta('_allow_custom_price'),
                '_allow_multiple_shares' => (string) $product->get_meta('_allow_multiple_shares'),
                '_enable_progress_bar'   => (string) $product->get_meta('_enable_progress_bar'),
            )
        );
        return WDP_Donation_Type::FIXED === $type;
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
                    'key' => __('Share count', 'woo-donation-popup'),
                    'value' => $donation_data['share_count'],
                );

                // Hissedar bilgilerini göster
                if (isset($donation_data['shareholders'])) {
                    foreach ($donation_data['shareholders'] as $key => $shareholder) {
                        if (!empty($shareholder['name'])) {
                            $item_data[] = array(
                                'key' => sprintf(__('Shareholder %d', 'woo-donation-popup'), $key),
                                'value' => $shareholder['name'] . (!empty($shareholder['phone']) ? ' (' . $shareholder['phone'] . ')' : ''),
                            );
                        }

                        if (!empty($shareholder['email'])) {
                            $item_data[] = array(
                                'key' => sprintf(__('Shareholder %d email', 'woo-donation-popup'), $key),
                                'value' => $shareholder['email'],
                            );
                        }

                        if (isset($shareholder['note']) && $shareholder['note'] !== '') {
                            $item_data[] = array(
                                'key' => sprintf(__('Shareholder %d note', 'woo-donation-popup'), $key),
                                'value' => $shareholder['note'],
                            );
                        }
                    }
                }
            } else {
                // Normal bağış verilerini göster (bağışçının kendi oturum sepeti — orijinal ad).
                if (!empty($donation_data['full_name'])) {
                    $item_data[] = array(
                        'key' => __('Donor', 'woo-donation-popup'),
                        'value' => $donation_data['full_name'] . (!empty($donation_data['phone']) ? ' (' . $donation_data['phone'] . ')' : ''),
                    );
                }

                if (!empty($donation_data['email'])) {
                    $item_data[] = array(
                        'key'   => __('Email', 'woo-donation-popup'),
                        'value' => $donation_data['email'],
                    );
                }

                if (!empty($donation_data['dedication'])) {
                    $item_data[] = array(
                        'key'   => __('Dedication', 'woo-donation-popup'),
                        'value' => $donation_data['dedication'],
                    );
                }

                if (!empty($donation_data['anonymous'])) {
                    $item_data[] = array(
                        'key'   => __('Keep my name private', 'woo-donation-popup'),
                        'value' => __('Yes', 'woo-donation-popup'),
                    );
                }

                if (isset($donation_data['note']) && $donation_data['note'] !== '') {
                    $item_data[] = array(
                        'key' => __('Donation note', 'woo-donation-popup'),
                        'value' => $donation_data['note'],
                    );
                }
            }
        }

        // 10.29.0 (Y1): işlem ücreti ayrı satır olarak gösterilir (tüm bağış tiplerinde).
        if (!empty($cart_item['donation_data']['cover_fee']) && !empty($cart_item['donation_data']['cover_fee_percent'])) {
            $pct   = (float) $cart_item['donation_data']['cover_fee_percent'];
            $value = sprintf('+%%%s', rtrim(rtrim(number_format($pct, 2, function_exists('wc_get_price_decimal_separator') ? wc_get_price_decimal_separator() : '.', ''), '0'), function_exists('wc_get_price_decimal_separator') ? wc_get_price_decimal_separator() : '.'));
            $unit  = self::resolve_cart_line_unit_price($cart_item);
            $qty   = max(1, (int) (isset($cart_item['quantity']) ? $cart_item['quantity'] : 1));
            if (null !== $unit && $unit > 0 && $pct > 0 && function_exists('wc_price')) {
                $fee_amount = ($unit - ($unit / (1 + ($pct / 100)))) * $qty;
                $value     .= ' (' . wp_strip_all_tags(wc_price($fee_amount)) . ')';
            }
            $item_data[] = array(
                'key'   => __('Processing fee', 'woo-donation-popup'),
                'value' => $value,
            );
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

        $removed_zero_lines = false;

        foreach ($cart->get_cart() as $cart_item_key => $cart_item) {
            if (!empty($cart_item['wdp_sadaka_donation'])) {
                $cart_item = self::sync_sadaka_line_wc_product($cart, $cart_item_key, $cart_item);
            }

            if (empty($cart_item['data']) || !is_a($cart_item['data'], 'WC_Product')) {
                continue;
            }

            $line_price = self::resolve_cart_line_unit_price($cart_item);

            if (self::is_zero_priced_donation_line($cart_item, $line_price)) {
                $cart->remove_cart_item($cart_item_key);
                $removed_zero_lines = true;
                continue;
            }

            if (null === $line_price) {
                continue;
            }

            $line_product = clone $cart_item['data'];
            $line_product->set_price($line_price);
            $cart->cart_contents[ $cart_item_key ]['data'] = $line_product;
        }

        if ($removed_zero_lines && function_exists('wc_add_notice')) {
            $notice = __('The donation line with amount 0 was removed from the cart. Please enter a valid donation amount.', 'woo-donation-popup');
            if (!function_exists('wc_has_notice') || !wc_has_notice($notice, 'error')) {
                wc_add_notice($notice, 'error');
            }
        }
    }

    /**
     * Whether a cart row is a plugin donation line (main, share or sadaka).
     *
     * @param array $cart_item Cart row.
     * @return bool
     */
    public static function is_donation_cart_line(array $cart_item) {
        return isset($cart_item['donation_data'])
            || isset($cart_item['custom_price'])
            || !empty($cart_item['wdp_sadaka_donation']);
    }

    /**
     * Donation line whose effective unit price is 0 (or not positive) — must not stay in the cart.
     *
     * @param array      $cart_item  Cart row.
     * @param float|null $line_price Resolved unit price (null = falls back to product price).
     * @return bool
     */
    public static function is_zero_priced_donation_line(array $cart_item, $line_price) {
        if (!self::is_donation_cart_line($cart_item)) {
            return false;
        }

        if (null === $line_price) {
            $product = isset($cart_item['data']) ? $cart_item['data'] : null;
            if (!is_object($product) || !method_exists($product, 'get_price')) {
                return false;
            }
            $line_price = (float) $product->get_price();
        }

        return (float) $line_price <= 0;
    }

    /**
     * Global minimum donation amount (filterable), never below the product minimum.
     *
     * @param mixed $product_min_meta Product `_min_custom_price` meta (may be '' or 0).
     * @param int   $product_id       Product ID (filter context).
     * @return float
     */
    public static function get_min_donation_amount($product_min_meta = '', $product_id = 0) {
        /**
         * Lowest accepted donation amount when the product has no (or a zero) minimum.
         *
         * @param float $min        Default 1.
         * @param int   $product_id Product ID.
         */
        $global_min = (float) apply_filters('wdp_min_donation_amount', 1.0, absint($product_id));
        if (!is_finite($global_min) || $global_min < 0) {
            $global_min = 0.0;
        }

        $product_min = ('' !== $product_min_meta && null !== $product_min_meta && is_numeric($product_min_meta))
            ? (float) $product_min_meta
            : 0.0;

        return max($global_min, $product_min);
    }

    /**
     * Validation message for a donation amount ('' when valid).
     *
     * @param float $amount           Sanitized amount.
     * @param mixed $product_min_meta Product `_min_custom_price` meta.
     * @param int   $product_id       Product ID.
     * @param bool  $plain_text       True for JSON/textContent consumers, false for HTML notices.
     * @return string
     */
    public static function get_donation_amount_error($amount, $product_min_meta = '', $product_id = 0, $plain_text = true) {
        $amount = (float) $amount;
        $min    = self::get_min_donation_amount($product_min_meta, $product_id);

        if ($amount > 0 && $amount >= $min) {
            return '';
        }

        if ($min <= 0) {
            return __('Please enter a donation amount greater than 0.', 'woo-donation-popup');
        }

        return sprintf(
            /* translators: %s: formatted minimum amount with currency */
            __('Please enter %s or more.', 'woo-donation-popup'),
            self::format_amount_for_message($min, $plain_text)
        );
    }

    /**
     * Currency-aware amount for user messages.
     *
     * @param float $amount     Amount.
     * @param bool  $plain_text Strip HTML (for JSON/textContent).
     * @return string
     */
    public static function format_amount_for_message($amount, $plain_text = true) {
        if (class_exists('WDP_Utils')) {
            $formatted = $plain_text ? WDP_Utils::format_price_plain($amount) : WDP_Utils::format_price_html($amount);
            if ('' !== $formatted) {
                return $formatted;
            }
        }

        $symbol = function_exists('get_woocommerce_currency_symbol') ? get_woocommerce_currency_symbol() : '';
        $number = function_exists('wc_format_decimal') ? wc_format_decimal($amount) : (string) $amount;
        return trim($number . ' ' . html_entity_decode((string) $symbol, ENT_QUOTES, 'UTF-8'));
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

    /**
     * Sum non-sadaka cart line totals for a progress-bar product (pending until paid).
     *
     * @param int $product_id Product ID.
     * @return float
     */
    public static function sum_cart_pending_for_product($product_id) {
        $product_id = absint($product_id);
        if ($product_id <= 0 || !function_exists('WC')) {
            return 0.0;
        }

        $cart = WC()->cart;
        if (!$cart) {
            return 0.0;
        }

        $pending = 0.0;
        foreach ($cart->get_cart() as $cart_item) {
            if (empty($cart_item['product_id']) || (int) $cart_item['product_id'] !== $product_id) {
                continue;
            }
            if (!empty($cart_item['wdp_sadaka_donation'])) {
                continue;
            }
            $quantity = max(1, (int) (isset($cart_item['quantity']) ? $cart_item['quantity'] : 1));
            $unit = self::resolve_cart_line_unit_price($cart_item);
            if (null === $unit) {
                $product = isset($cart_item['data']) ? $cart_item['data'] : null;
                $unit = $product ? (float) $product->get_price() : 0.0;
            }
            $pending += ((float) $unit) * $quantity;
        }

        return max(0.0, $pending);
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

        return esc_html__('Add-on donation', 'woo-donation-popup');
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
     * Parse shareholder fields from a request bag (AJAX POST or non-AJAX form).
     *
     * @param array $request     Request data.
     * @param int   $share_count Requested share count.
     * @param array $options {
     *     @type int  $max_shares       Cap (default 50).
     *     @type bool $require_contact  Require name+phone (default true).
     * }
     * @return array{
     *   shareholders: array<int,array>,
     *   missing_fields: string[],
     *   missing_field_keys: string[],
     *   share_count: int
     * }
     */
    public static function parse_shareholders_from_request(array $request, $share_count, array $options = array()) {
        $max_shares = isset($options['max_shares']) ? absint($options['max_shares']) : 50;
        if ($max_shares < 1) {
            $max_shares = 50;
        }
        $require_contact = !isset($options['require_contact']) || (bool) $options['require_contact'];

        $share_count = min(max(0, absint($share_count)), $max_shares);
        $shareholders = array();
        $missing_fields = array();
        $missing_field_keys = array();

        for ($i = 1; $i <= $share_count; $i++) {
            $name_key = 'shareholder_name_' . $i;
            $phone_key = 'shareholder_phone_' . $i;
            $note_key = 'shareholder_note_' . $i;
            $email_key = 'shareholder_email_' . $i;

            $name = isset($request[$name_key])
                ? WDP_Security::sanitize_text(wp_unslash($request[$name_key]), 100)
                : '';
            $phone = isset($request[$phone_key])
                ? WDP_Security::sanitize_phone(wp_unslash($request[$phone_key]))
                : '';

            $note_raw = isset($request[$note_key]) ? wp_unslash($request[$note_key]) : '';
            if (strlen($note_raw) > 500) {
                $note_raw = substr($note_raw, 0, 500);
            }
            $note = sanitize_textarea_field($note_raw);

            $email_raw = isset($request[$email_key]) ? wp_unslash($request[$email_key]) : '';
            if (strlen($email_raw) > 100) {
                $email_raw = substr($email_raw, 0, 100);
            }
            $email = sanitize_email($email_raw);

            if ($require_contact) {
                if ('' === $name) {
                    $missing_fields[] = sprintf(__('Shareholder %d name', 'woo-donation-popup'), $i);
                    $missing_field_keys[] = $name_key;
                }
                if ('' === $phone) {
                    $missing_fields[] = sprintf(__('Shareholder %d phone', 'woo-donation-popup'), $i);
                    $missing_field_keys[] = $phone_key;
                }
            }

            $shareholder = array();
            if ('' !== $name) {
                $shareholder['name'] = $name;
            }
            if ('' !== $phone) {
                $shareholder['phone'] = $phone;
            }
            if ('' !== $email) {
                $shareholder['email'] = $email;
            }
            if ('' !== $note) {
                $shareholder['note'] = $note;
            }

            if (!empty($shareholder)) {
                $shareholders[$i] = $shareholder;
            }
        }

        return array(
            'shareholders'       => $shareholders,
            'missing_fields'     => $missing_fields,
            'missing_field_keys' => $missing_field_keys,
            'share_count'        => $share_count,
        );
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


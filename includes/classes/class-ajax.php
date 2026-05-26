<?php
/**
 * ============================================================================
 * WDP_AJAX - AJAX İŞLEYİCİ SINIFI
 * ============================================================================
 * 
 * DOSYA: class-ajax.php
 * KONUM: /includes/classes/class-ajax.php
 * 
 * AMAÇ:
 * Tüm AJAX isteklerini işler. Frontend'den gelen AJAX çağrılarını
 * karşılar ve JSON response döner.
 * 
 * ANA İŞLEVLER:
 * 1. Ürün bilgilerini getirme (get_product_info)
 * 2. Ürün adını getirme (get_product_name)
 * 3. Sepet sayısını getirme (get_cart_count)
 * 4. Sepet içeriğini getirme (get_cart_contents)
 * 5. AJAX ile sepete ekleme (ajax_add_to_cart)
 * 
 * GÜVENLİK:
 * - Nonce doğrulaması (her istek için)
 * - Input sanitization
 * - Output escaping
 * - Exception handling
 * - Rate limiting (WDP_Security sınıfı ile)
 * 
 * PERFORMANS:
 * - Product info cache (1 saat transient)
 * - WooCommerce meta cache kullanımı
 * - Optimize edilmiş database sorguları
 * 
 * AJAX ENDPOINT'LERİ:
 * - wp_ajax_wdp_get_product_info (logged-in users)
 * - wp_ajax_nopriv_wdp_get_product_info (non-logged-in users)
 * - wp_ajax_wdp_get_product_name
 * - wp_ajax_wdp_get_cart_count
 * - wp_ajax_wdp_get_cart_contents
 * - wp_ajax_wdp_ajax_add_to_cart
 * 
 * RESPONSE FORMAT:
 * - Success: { success: true, data: {...} }
 * - Error: { success: false, message: "..." }
 * 
 * EXCEPTION HANDLING:
 * - WDP_Security_Exception: Nonce hatası
 * - WDP_Validation_Exception: Geçersiz input
 * - WDP_Product_Not_Found_Exception: Ürün bulunamadı
 * - WDP_Exception: Genel hatalar
 * 
 * ============================================================================
 * 
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
     * Return WooCommerce cart instance when available.
     *
     * @return object|null
     */
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
     * Validate nonce and request origin.
     *
     * @param string $nonce_action Nonce action key.
     * @return void
     * @throws WDP_Security_Exception When validation fails.
     */
    private static function validate_ajax_request($nonce_action) {
        if (!check_ajax_referer($nonce_action, 'security', false)) {
            throw new WDP_Security_Exception();
        }

        if (!WDP_Security::validate_request_origin()) {
            throw new WDP_Security_Exception(__('Geçersiz istek kaynağı', 'woo-donation-popup'));
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

        // Uzun süre açık sayfalarda nonce yenileme (referer + rate limit; CSRF için çerez gerekir)
        add_action('wp_ajax_wdp_get_fresh_nonces', array(__CLASS__, 'get_fresh_nonces'));
        add_action('wp_ajax_nopriv_wdp_get_fresh_nonces', array(__CLASS__, 'get_fresh_nonces'));

        // Ağ/proxy kopması sonrası: sunucu sepete eklediyse istemci bunu doğrular, sahte "bağlantı hatası" önlenir
        add_action('wp_ajax_wdp_verify_submission_in_cart', array(__CLASS__, 'verify_submission_in_cart'));
        add_action('wp_ajax_nopriv_wdp_verify_submission_in_cart', array(__CLASS__, 'verify_submission_in_cart'));

        // AJAX ile sepetteki öğeyi kaldırma endpoint'i
        add_action('wp_ajax_wdp_remove_cart_item', array(__CLASS__, 'remove_cart_item'));
        add_action('wp_ajax_nopriv_wdp_remove_cart_item', array(__CLASS__, 'remove_cart_item'));

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
            self::validate_ajax_request('wdp_get_product_info');
            self::enforce_rate_limit('get_product_info', 60, 60);

            $product_id = isset($_POST['product_id']) ? absint(wp_unslash($_POST['product_id'])) : 0;

            if (!$product_id) {
                throw new WDP_Validation_Exception(__('Geçersiz ürün ID', 'woo-donation-popup'));
            }
            
            // SECURITY: Validate product ID
            if (!WDP_Security::validate_product_id($product_id)) {
                throw new WDP_Validation_Exception(__('Geçersiz ürün ID', 'woo-donation-popup'));
            }

            // WC_Product nesnesini harici object cache'e yazmıyoruz (serileştirme / bayat nesne riski); hafif meta wdp_product_info önbelleğinde kalır.
            $product = wc_get_product($product_id);

            if (!$product) {
                throw new WDP_Product_Not_Found_Exception($product_id);
            }

        // PERFORMANCE: Use object cache if available (faster than transient)
        $cache_key = 'wdp_product_info_' . $product_id;
        $cached_data = wp_cache_get($cache_key, 'wdp_product_info');
        
        if (false === $cached_data) {
            // Fallback to transient if object cache not available
            $cached_data = get_transient($cache_key);
        }
        
        if (false !== $cached_data) {
            // Use cached data
            $allow_custom_price = $cached_data['allow_custom_price'];
            $min_price = $cached_data['min_price'];
            $allow_multiple_shares = $cached_data['allow_multiple_shares'];
            $max_shares = $cached_data['max_shares'];
            $enable_progress_bar = !empty($cached_data['enable_progress_bar']);
            $enable_sadaka_donation = !empty($cached_data['enable_sadaka_donation']);
        } else {
            // PERFORMANCE: WooCommerce get_meta() kullan (cache'lenmiş, daha hızlı)
            // PERFORMANCE: Single meta query instead of multiple
            $product_meta = $product->get_meta_data();
            $meta_array = array();
            foreach ($product_meta as $meta) {
                $meta_array[$meta->key] = $meta->value;
            }
            
            $allow_custom_price = isset($meta_array['_allow_custom_price']) && $meta_array['_allow_custom_price'] === 'yes';
            $min_price = isset($meta_array['_min_custom_price']) ? $meta_array['_min_custom_price'] : '';
            $allow_multiple_shares = isset($meta_array['_allow_multiple_shares']) && $meta_array['_allow_multiple_shares'] === 'yes';
            $max_shares = isset($meta_array['_max_shares']) ? $meta_array['_max_shares'] : '';
            $enable_progress_bar = isset($meta_array['_enable_progress_bar']) && $meta_array['_enable_progress_bar'] === 'yes';
            $enable_sadaka_donation = isset($meta_array['_enable_sadaka_donation']) && $meta_array['_enable_sadaka_donation'] === 'yes';
            
            $cache_data = array(
                'allow_custom_price' => $allow_custom_price,
                'min_price' => $min_price,
                'allow_multiple_shares' => $allow_multiple_shares,
                'max_shares' => $max_shares,
                'enable_progress_bar' => $enable_progress_bar,
                'enable_sadaka_donation' => $enable_sadaka_donation,
            );
            
            // PERFORMANCE: Cache in both object cache and transient (fallback)
            wp_cache_set($cache_key, $cache_data, 'wdp_product_info', HOUR_IN_SECONDS);
            set_transient($cache_key, $cache_data, HOUR_IN_SECONDS);
        }

        if ($allow_custom_price && '' === $min_price) {
            $min_price = '0';
        }

        if ($allow_multiple_shares && '' === $max_shares) {
            $max_shares = '7';
        }

        if (!isset($enable_progress_bar)) {
            $enable_progress_bar = $product->get_meta('_enable_progress_bar') === 'yes';
        }
        if (!isset($enable_sadaka_donation)) {
            $enable_sadaka_donation = $product->get_meta('_enable_sadaka_donation') === 'yes';
        }

        $show_sadaka_donation = $enable_sadaka_donation && !$enable_progress_bar;
        $sadaka_block_html = '';
        if ($show_sadaka_donation && class_exists('WDP_Donation_Product_Context_Service') && class_exists('WDP_Templates')) {
            $sadaka_context = WDP_Donation_Product_Context_Service::build_form_context($product);
            $sadaka_block_html = WDP_Templates::render_sadaka_donation_block($sadaka_context);
        }

        $raw_price = $product->get_price();
        $response = array(
            'product_name' => $product->get_name(),
            'is_custom_price' => $allow_custom_price,
            'min_price' => $min_price,
            'regular_price' => $product->get_regular_price(),
            'price' => $raw_price,
            'price_html' => ($raw_price !== '' && $raw_price !== null) ? WDP_Utils::format_price_html($raw_price) : '',
            'is_multiple_shares' => $allow_multiple_shares,
            'max_shares' => $max_shares,
            'enable_sadaka_donation' => $show_sadaka_donation,
            'sadaka_block_html' => $sadaka_block_html,
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
        try {
            self::validate_ajax_request('wdp_get_product_name');
            self::enforce_rate_limit('get_product_name', 60, 60);
        } catch (WDP_Security_Exception $e) {
            WDP_Utils::json_error($e);
        }

        $product_id = isset($_POST['product_id']) ? absint(wp_unslash($_POST['product_id'])) : 0;

        if (!$product_id) {
            WDP_Utils::json_error(__('Geçersiz ürün ID', 'woo-donation-popup'));
        }
        
        // SECURITY: Validate product ID
        if (!WDP_Security::validate_product_id($product_id)) {
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
            self::validate_ajax_request('wdp_ajax_add_to_cart');

            // SECURITY: Rate limiting check
            $rate_limit_key = WDP_Security::get_rate_limit_key('add_to_cart');
            if (!WDP_Security::check_rate_limit($rate_limit_key, 20, 60)) {
                throw new WDP_Security_Exception(__('Çok fazla istek gönderildi. Lütfen bir süre bekleyip tekrar deneyin.', 'woo-donation-popup'));
            }
            
            // SECURITY: Capability check (read permission for adding to cart)
            if (!WDP_Security::check_capability('read')) {
                throw new WDP_Security_Exception(__('Yetkiniz bulunmuyor', 'woo-donation-popup'));
            }

            // SECURITY: Sanitize and validate inputs with length limits
            $product_id = 0;
            if (isset($_POST['wdp_product_id'])) {
                $product_id = absint(wp_unslash($_POST['wdp_product_id']));
            }
            if (!$product_id && isset($_POST['add-to-cart'])) {
                $product_id = absint(wp_unslash($_POST['add-to-cart']));
            }
            $quantity = isset($_POST['quantity']) ? wc_stock_amount(wp_unslash($_POST['quantity'])) : 1;
            // SECURITY: Limit quantity to prevent abuse
            if ($quantity > 1000) {
                $quantity = 1000;
            }
            $variation_id = isset($_POST['variation_id']) ? absint(wp_unslash($_POST['variation_id'])) : 0;
            $custom_price_raw = isset($_POST['custom_price']) ? wc_clean(wp_unslash($_POST['custom_price'])) : '';
            // SECURITY: Limit custom price length
            if (strlen($custom_price_raw) > 20) {
                $custom_price_raw = substr($custom_price_raw, 0, 20);
            }
            $unique_submission_key = isset($_POST['unique_submission_key']) ? WDP_Security::sanitize_text(wp_unslash($_POST['unique_submission_key']), 100) : '';
            $timestamp = isset($_POST['timestamp']) ? absint(wp_unslash($_POST['timestamp'])) : 0;
            // SECURITY: Validate timestamp (not too old, not in future)
            $current_time = time();
            if ($timestamp > 0 && ($timestamp < ($current_time - 3600) || $timestamp > ($current_time + 60))) {
                $timestamp = $current_time;
            }
            $is_direct_share_form = !empty($_POST['is_direct_share_form']) && '1' === wp_unslash($_POST['is_direct_share_form']);
            $custom_price_type = isset($_POST['custom_price_type']) ? WDP_Security::sanitize_text(wp_unslash($_POST['custom_price_type']), 50) : '';

            if (!$product_id) {
                throw new WDP_Validation_Exception(__('Geçersiz ürün ID.', 'woo-donation-popup'));
            }

            $cart = self::get_wc_cart();
            if (!$cart) {
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
            $missing_field_keys = array();

            // SECURITY: Limit maximum share count to prevent abuse
            if ($share_count > 50) {
                throw new WDP_Validation_Exception(__('Maksimum hisse sayısı aşıldı', 'woo-donation-popup'));
            }
            
            for ($i = 1; $i <= $share_count; $i++) {
                $name = isset($_POST['shareholder_name_' . $i]) ? WDP_Security::sanitize_text(wp_unslash($_POST['shareholder_name_' . $i]), 100) : '';
                $phone = isset($_POST['shareholder_phone_' . $i]) ? WDP_Security::sanitize_phone(wp_unslash($_POST['shareholder_phone_' . $i])) : '';
                // SECURITY: Limit note length to prevent abuse
                $note_raw = isset($_POST['shareholder_note_' . $i]) ? wp_unslash($_POST['shareholder_note_' . $i]) : '';
                if (strlen($note_raw) > 500) {
                    $note_raw = substr($note_raw, 0, 500);
                }
                $note = sanitize_textarea_field($note_raw);

                if ('' === $name) {
                    $missing_fields[] = sprintf(__('%d. Hissedar Adı', 'woo-donation-popup'), $i);
                    $missing_field_keys[] = 'shareholder_name_' . $i;
                }

                if ('' === $phone) {
                    $missing_fields[] = sprintf(__('%d. Hissedar Telefonu', 'woo-donation-popup'), $i);
                    $missing_field_keys[] = 'shareholder_phone_' . $i;
                }

                $shareholder = array();

                if ('' !== $name) {
                    $shareholder['name'] = $name;
                }

                if ('' !== $phone) {
                    $shareholder['phone'] = $phone;
                }

                $email_raw = isset($_POST['shareholder_email_' . $i]) ? wp_unslash($_POST['shareholder_email_' . $i]) : '';
                if (strlen($email_raw) > 100) {
                    $email_raw = substr($email_raw, 0, 100);
                }
                $email = sanitize_email($email_raw);
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

            if (!empty($missing_fields)) {
                throw new WDP_Validation_Exception(
                    __('Lütfen tüm zorunlu alanları doldurun: ', 'woo-donation-popup') . implode(', ', $missing_fields),
                    $missing_field_keys
                );
            }

            if (!empty($shareholders)) {
                $donation_data['shareholders'] = $shareholders;
            }

            // CRITICAL: Quantity'yi share_count olarak ayarla (hissedar sayısı = sepetteki miktar)
            // Dinamik: Kaç hissedar bilgisi doldurulduysa, o kadar adet ürün sepete eklenecek
            // Örnek: 7 hissedar = 7 adet ürün, fiyat = base_price × 7
            $quantity = max(1, $share_count);
            
            WDP_Utils::log(array(
                'event' => 'ajax_add_to_cart_request_hisseli',
                'product_id' => $product_id,
                'quantity' => $quantity,
                'share_count' => $share_count,
                'custom_price' => $custom_price_raw,
                'unique_submission_key' => $unique_submission_key,
            ));
        } else {
            // Ad Soyad alanını al
            $full_name = isset($_POST['donation_full_name']) ? WDP_Security::sanitize_text(wp_unslash($_POST['donation_full_name']), 100) : '';
            $phone = isset($_POST['donation_phone']) ? WDP_Security::sanitize_phone(wp_unslash($_POST['donation_phone'])) : '';
            // SECURITY: Limit note length to prevent abuse
            $note_raw = isset($_POST['donation_note']) ? wp_unslash($_POST['donation_note']) : '';
            if (strlen($note_raw) > 500) {
                $note_raw = substr($note_raw, 0, 500);
            }
            $note = sanitize_textarea_field($note_raw);

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

        // PERFORMANCE: Use cached meta data ($product already loaded above).
        $cache_key_meta = 'wdp_product_info_' . $product_id;
        $cached_meta = wp_cache_get($cache_key_meta, 'wdp_product_info');
        
        if (false === $cached_meta) {
            $cached_meta = get_transient($cache_key_meta);
        }
        
        if (false !== $cached_meta) {
            $allow_custom_price = $cached_meta['allow_custom_price'];
        } else {
            $allow_custom_price = $product->get_meta('_allow_custom_price') === 'yes';
        }
        
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

                // PERFORMANCE: Use cached meta data if available
                if (false !== $cached_meta) {
                    $min_price = $cached_meta['min_price'];
                } else {
                    $min_price = $product->get_meta('_min_custom_price');
                }
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
                foreach ($cart->get_cart() as $dup_key => $cart_item) {
                    if (isset($cart_item['unique_submission_key']) && $cart_item['unique_submission_key'] === $unique_submission_key) {
                        $dup_pid = isset($cart_item['product_id']) ? (int) $cart_item['product_id'] : 0;
                        WDP_Utils::json_success(array(
                            'message' => __('Ürün zaten sepete eklenmiş', 'woo-donation-popup'),
                            'cart_count' => (int) $cart->get_cart_contents_count(),
                            'checkout_url' => wc_get_checkout_url(),
                            'items' => self::get_cart_items(),
                            'cart_item_key' => $dup_key,
                            'product_id' => $dup_pid,
                            'meta_cart_line' => self::build_meta_cart_line_from_cart_item($cart_item, $dup_pid),
                        ));
                    }
                }
            }
        }

        // Aynı ana bağış satırını kaldır (sadaka satırlarına dokunma).
        foreach ($cart->get_cart() as $cart_item_key => $cart_item) {
            if (!empty($cart_item['wdp_sadaka_donation'])) {
                continue;
            }
            if ((int) $cart_item['product_id'] === $product_id && isset($cart_item['donation_data']) && self::is_same_donation_data($cart_item['donation_data'], $donation_data)) {
                $cart->remove_cart_item($cart_item_key);
                break;
            }
        }

        $cart_item_data = array(
            'donation_data' => $donation_data,
            'unique_key' => md5(serialize(array($product_id, 'main', microtime(true), wp_rand()))),
        );

        if ($unique_submission_key) {
            $cart_item_data['unique_submission_key'] = $unique_submission_key;
        }

        if ($allow_custom_price && null !== $custom_price_value) {
            // CRITICAL: Form'dan gelen custom_price zaten base price (form.js'te hesaplanıyor)
            // Quantity = shareCount olacak ve subtotal = custom_price × quantity olarak hesaplanacak
            $cart_item_data['custom_price'] = $custom_price_value;
        } else {
            $base_unit = (float) $product->get_price();
            if ($base_unit > 0) {
                $cart_item_data['wdp_base_unit_price'] = $base_unit;
            }
        }

        if ($is_direct_share_form) {
            $cart_item_data['is_direct_share_form'] = true;

            if ('' !== $custom_price_type) {
                $cart_item_data['custom_price_type'] = $custom_price_type;
            }
        }

            // PERFORMANCE: Clear cart cache after adding item
            self::clear_cart_cache();
            
            $cart_item_key = $cart->add_to_cart($product_id, $quantity, $variation_id, array(), $cart_item_data);

            if (!$cart_item_key) {
                throw new WDP_Cart_Exception(__('Ürün sepete eklenirken bir hata oluştu.', 'woo-donation-popup'));
            }

            self::maybe_add_sadaka_donation_to_cart($cart, $product, $donation_data, $unique_submission_key, $cart_item_key);

            // PERFORMANCE: Get cart count once
            $cart_count = (int) $cart->get_cart_contents_count();
            
            // Progress bar için toplam bağış miktarını hesapla
            $total_donation = 0.0;
            $enable_progress_bar = $product->get_meta('_enable_progress_bar') === 'yes';
            if ($enable_progress_bar) {
                // Cache'i temizle (yeni bağış eklendi)
                wp_cache_delete('wdp_total_donation_' . $product_id, 'wdp_donations');
                $total_donation = WDP_Utils::get_total_donation_amount($product_id);
            }
            
            $added_item = $cart->get_cart_item($cart_item_key);
            WDP_Utils::json_success(array(
                'message' => __('Ürün sepete eklendi.', 'woo-donation-popup'),
                'cart_item_key' => $cart_item_key,
                'cart_count' => $cart_count,
                'checkout_url' => wc_get_checkout_url(),
                'items' => self::get_cart_items(),
                'total_donation' => $total_donation,
                'product_id' => $product_id,
                'meta_cart_line' => $added_item ? self::build_meta_cart_line_from_cart_item($added_item, $product_id) : null,
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

    /**
     * Safe line summary for Meta AddToCart (no donor PII).
     *
     * @param array $cart_item WooCommerce cart row.
     * @param int   $product_id Product ID fallback.
     * @return array|null
     */
    private static function build_meta_cart_line_from_cart_item($cart_item, $product_id) {
        if (empty($cart_item) || !isset($cart_item['data'])) {
            return null;
        }
        $product = $cart_item['data'];
        if (!$product || !is_object($product) || !method_exists($product, 'get_name')) {
            return null;
        }
        $qty = isset($cart_item['quantity']) ? (int) $cart_item['quantity'] : 1;
        if ($qty < 1) {
            $qty = 1;
        }
        $product_price = floatval($product->get_price());
        $line_total    = $product_price * $qty;
        if (isset($cart_item['custom_price'])) {
            $cp            = floatval($cart_item['custom_price']);
            $line_total    = $cp * $qty;
            $product_price = $cp;
        }
        $dec = function_exists('wc_get_price_decimals') ? wc_get_price_decimals() : 2;
        $pid = isset($cart_item['product_id']) ? (int) $cart_item['product_id'] : (int) $product_id;

        return array(
            'product_id'   => $pid,
            'product_name' => wp_strip_all_tags((string) $product->get_name()),
            'quantity'     => $qty,
            'line_total'   => round((float) $line_total, $dec),
            'item_price'   => $qty > 0 ? round((float) $line_total / $qty, $dec) : round((float) $line_total, $dec),
            'currency'     => function_exists('get_woocommerce_currency') ? get_woocommerce_currency() : 'TRY',
        );
    }

    /**
     * Build donation meta for optional sadaka line item.
     *
     * @param array $donation_data Primary donation payload.
     * @return array
     */
    private static function build_sadaka_donation_data(array $donation_data) {
        $sadaka_data = array(
            'is_sadaka' => true,
        );

        if (!empty($donation_data['share_count']) && !empty($donation_data['shareholders']) && is_array($donation_data['shareholders'])) {
            $first = reset($donation_data['shareholders']);
            if (is_array($first)) {
                if (!empty($first['name'])) {
                    $sadaka_data['full_name'] = $first['name'];
                }
                if (!empty($first['phone'])) {
                    $sadaka_data['phone'] = $first['phone'];
                }
            }
            return $sadaka_data;
        }

        if (!empty($donation_data['full_name'])) {
            $sadaka_data['full_name'] = $donation_data['full_name'];
        }
        if (!empty($donation_data['phone'])) {
            $sadaka_data['phone'] = $donation_data['phone'];
        }
        if (!empty($donation_data['note'])) {
            $sadaka_data['note'] = $donation_data['note'];
        }

        return $sadaka_data;
    }

    /**
     * Add separate sadaka cart line when donor opted in.
     *
     * @param WC_Cart     $cart                  Cart.
     * @param WC_Product  $product               Product.
     * @param array       $donation_data         Primary donation data.
     * @param string      $unique_submission_key Submission key.
     * @return void
     */
    private static function maybe_add_sadaka_donation_to_cart($cart, $product, array $donation_data, $unique_submission_key, $parent_cart_item_key = '') {
        if (!$cart || !$product || $product->get_meta('_enable_sadaka_donation') !== 'yes') {
            return;
        }

        $panel_active = isset($_POST['sadaka_donation_active']) && '1' === wp_unslash($_POST['sadaka_donation_active']);
        if (!$panel_active) {
            return;
        }

        $parent_product_id = (int) $product->get_id();
        $configured_sadaka_id = WDP_Utils::get_configured_sadaka_wc_product_id($product);
        $sadaka_product_id = WDP_Utils::resolve_sadaka_wc_product_id($product);

        if ($configured_sadaka_id <= 0 || $sadaka_product_id <= 0) {
            throw new WDP_Validation_Exception(
                __('Alt bağış WC ürünü bulunamadı. Başarı & Mini Sepet veya ürün ayarında geçerli bir ürün ID girin.', 'woo-donation-popup'),
                array('sadaka_custom_price')
            );
        }

        foreach ($cart->get_cart() as $existing_key => $existing_item) {
            if (empty($existing_item['wdp_sadaka_donation'])) {
                continue;
            }
            if ($parent_cart_item_key !== '') {
                if (empty($existing_item['wdp_parent_cart_item_key']) || $existing_item['wdp_parent_cart_item_key'] !== $parent_cart_item_key) {
                    continue;
                }
            } elseif (!empty($existing_item['wdp_parent_product_id']) && (int) $existing_item['wdp_parent_product_id'] !== $parent_product_id) {
                continue;
            } elseif (empty($existing_item['wdp_parent_product_id']) && (int) $existing_item['product_id'] !== $parent_product_id && (int) $existing_item['product_id'] !== $sadaka_product_id) {
                continue;
            }
            $cart->remove_cart_item($existing_key);
        }

        $fixed_price = WDP_Utils::get_sadaka_fixed_price($product);

        if ($fixed_price > 0) {
            $sadaka_value = $fixed_price;
        } else {
            $sadaka_raw = isset($_POST['sadaka_custom_price']) ? wc_clean(wp_unslash($_POST['sadaka_custom_price'])) : '';
            if ($sadaka_raw === '') {
                return;
            }

            if (strlen($sadaka_raw) > 20) {
                $sadaka_raw = substr($sadaka_raw, 0, 20);
            }

            $sadaka_value = WDP_Security::sanitize_numeric($sadaka_raw, 0, 999999);
            if (null === $sadaka_value || $sadaka_value <= 0) {
                return;
            }

            $min_sadaka = $product->get_meta('_sadaka_min_price');
            if ($min_sadaka !== '' && (float) $min_sadaka > 0 && $sadaka_value < (float) $min_sadaka) {
                throw new WDP_Validation_Exception(
                    sprintf(__('Alt bağış için lütfen %s TL ve üstü değerler girin.', 'woo-donation-popup'), wc_format_decimal($min_sadaka)),
                    array('sadaka_custom_price')
                );
            }
        }

        $sadaka_cart_data = array(
            'donation_data'         => self::build_sadaka_donation_data($donation_data),
            'custom_price'          => $sadaka_value,
            'wdp_sadaka_donation'   => true,
            'wdp_parent_product_id' => $parent_product_id,
            'wdp_sadaka_linked_wc_product' => true,
            'unique_key'            => md5(serialize(array($parent_product_id, $sadaka_product_id, 'sadaka', microtime(true), wp_rand()))),
        );

        if ($parent_cart_item_key !== '') {
            $sadaka_cart_data['wdp_parent_cart_item_key'] = $parent_cart_item_key;
        }

        if ($unique_submission_key) {
            $sadaka_cart_data['unique_submission_key'] = $unique_submission_key . '-sadaka';
        }

        $allow_purchasable = static function ($purchasable, $check_product) use ($sadaka_product_id) {
            if ($purchasable || !$check_product instanceof WC_Product) {
                return $purchasable;
            }
            return (int) $check_product->get_id() === (int) $sadaka_product_id ? true : $purchasable;
        };
        add_filter('woocommerce_is_purchasable', $allow_purchasable, 99, 2);

        $sadaka_key = $cart->add_to_cart($sadaka_product_id, 1, 0, array(), $sadaka_cart_data);

        remove_filter('woocommerce_is_purchasable', $allow_purchasable, 99);

        if (!$sadaka_key) {
            throw new WDP_Cart_Exception(
                sprintf(
                    /* translators: %d: WooCommerce product ID */
                    __('Alt bağış sepete eklenemedi (ürün #%d). Ürünün yayında olduğundan emin olun.', 'woo-donation-popup'),
                    $sadaka_product_id
                )
            );
        }

        if (method_exists($cart, 'calculate_totals')) {
            $cart->calculate_totals();
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
        if (!empty($data1['is_sadaka']) || !empty($data2['is_sadaka'])) {
            return false;
        }

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

                    if ((isset($shareholder1['email']) ? $shareholder1['email'] : '') !== (isset($shareholder2['email']) ? $shareholder2['email'] : '')) {
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

// Note: init() is called by Woo_Donation_Popup::__construct()


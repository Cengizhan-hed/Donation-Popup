<?php
if (!defined('ABSPATH')) {
	exit;
}

trait WDP_Ajax_Cart_Add_Trait {
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
}

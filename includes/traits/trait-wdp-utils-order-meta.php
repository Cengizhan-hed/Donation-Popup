<?php
if (!defined('ABSPATH')) {
    exit;
}

trait WDP_Utils_Order_Meta_Trait {
    /**
     * Read order/refund flag meta (HPOS-safe with post_meta fallback).
     *
     * @param int|WC_Abstract_Order $order_or_id Order or refund object or ID.
     * @param string                $meta_key    Meta key.
     * @return string
     */
    public static function get_order_flag_meta($order_or_id, $meta_key) {
        $order = is_object($order_or_id) ? $order_or_id : wc_get_order($order_or_id);
        if ($order && is_a($order, 'WC_Abstract_Order')) {
            $value = $order->get_meta($meta_key, true);
            if ($value !== '' && $value !== null) {
                return (string) $value;
            }
        }

        $order_id = $order ? $order->get_id() : absint($order_or_id);
        if ($order_id) {
            return (string) get_post_meta($order_id, $meta_key, true);
        }

        return '';
    }

    /**
     * Persist order/refund flag meta (HPOS-safe with post_meta fallback).
     *
     * @param int|WC_Abstract_Order $order_or_id Order or refund object or ID.
     * @param string                $meta_key    Meta key.
     * @param string                $value       Meta value.
     * @return void
     */
    public static function set_order_flag_meta($order_or_id, $meta_key, $value) {
        $order = is_object($order_or_id) ? $order_or_id : wc_get_order($order_or_id);
        if ($order && is_a($order, 'WC_Abstract_Order')) {
            $order->update_meta_data($meta_key, $value);
            $order->save();
            return;
        }

        $order_id = absint($order_or_id);
        if ($order_id) {
            update_post_meta($order_id, $meta_key, $value);
        }
    }

    /**
     * Sipariş tamamlandığında artımlı bağış toplamlarını güncelle.
     *
     * @param int $order_id WooCommerce order id.
     * @return void
     */
    public static function sync_order_donation_totals_on_complete($order_id) {
        $order_id = absint($order_id);
        if (!$order_id) {
            return;
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        if (self::get_order_flag_meta($order, '_wdp_donation_totals_applied') === 'yes') {
            return;
        }

        foreach ($order->get_items() as $item) {
            $product_id = absint($item->get_product_id());
            if (!$product_id) {
                continue;
            }

            $line_total = self::resolve_donation_line_total($item);
            if ($line_total <= 0) {
                continue;
            }

            self::update_product_donation_total($product_id, $line_total);
        }

        self::set_order_flag_meta($order, '_wdp_donation_totals_applied', 'yes');
    }

    /**
     * Refund oluştuğunda ürün bazlı bağış toplamını azalt.
     *
     * @param int $order_id  Parent order id.
     * @param int $refund_id Refund order id.
     * @return void
     */
    public static function sync_order_donation_totals_on_refund($order_id, $refund_id) {
        $refund_id = absint($refund_id);
        if (!$refund_id) {
            return;
        }

        $refund = wc_get_order($refund_id);
        if (!$refund || !is_a($refund, 'WC_Order_Refund')) {
            return;
        }

        if (self::get_order_flag_meta($refund, '_wdp_donation_totals_reverted') === 'yes') {
            return;
        }

        foreach ($refund->get_items() as $item) {
            $product_id = absint($item->get_product_id());
            if (!$product_id) {
                continue;
            }

            // Refund satır toplamı negatif gelir; mevcut toplama delta olarak uygula.
            $refund_total = floatval($item->get_total());
            if ($refund_total === 0.0) {
                continue;
            }

            self::update_product_donation_total($product_id, $refund_total);
        }

        self::set_order_flag_meta($refund, '_wdp_donation_totals_reverted', 'yes');
    }

    /**
     * Resolve effective donation total for an order line.
     *
     * @param WC_Order_Item_Product $item Order line item.
     * @return float
     */
    private static function resolve_donation_line_total($item) {
        $custom_price = $item->get_meta('_custom_price');
        if ($custom_price !== '' && is_numeric($custom_price) && floatval($custom_price) > 0) {
            return floatval($custom_price) * max(1, intval($item->get_quantity()));
        }

        return max(0.0, floatval($item->get_total()));
    }

    /**
     * Update product donation total and invalidate relevant caches.
     *
     * @param int   $product_id Product id.
     * @param float $delta      Delta amount (positive/negative).
     * @return void
     */
    private static function update_product_donation_total($product_id, $delta) {
        $product_id = absint($product_id);
        if (!$product_id || !is_numeric($delta) || floatval($delta) == 0.0) {
            return;
        }

        $current_total = floatval(get_post_meta($product_id, '_wdp_total_donation_amount', true));
        $next_total = max(0.0, $current_total + floatval($delta));

        update_post_meta($product_id, '_wdp_total_donation_amount', $next_total);
        wp_cache_delete('wdp_total_donation_' . $product_id, 'wdp_donations');
    }

    /**
     * Clear transient/object caches used for product donation info and WC product objects (WDP_Ajax).
     *
     * @param int $product_id Product ID.
     * @return void
     */
    public static function invalidate_product_donation_caches($product_id) {
        $product_id = absint($product_id);
        if (!$product_id) {
            return;
        }
        $key = 'wdp_product_info_' . $product_id;
        delete_transient($key);
        wp_cache_delete($key, 'wdp_product_info');
        wp_cache_delete('wdp_product_object_' . $product_id, 'wdp_products');
    }

    /**
     * Ürün kaldırıldığında / çöpe gittiğinde ürün + progress bar ile ilgili tüm WDP önbellek anahtarlarını sil.
     *
     * @param int $product_id Product ID.
     * @return void
     */
    private static function purge_product_donation_caches_for_removal($product_id) {
        $product_id = absint($product_id);
        if (!$product_id) {
            return;
        }

        self::invalidate_product_donation_caches($product_id);
        wp_cache_delete('wdp_total_donation_' . $product_id, 'wdp_donations');
    }

    /**
     * Kalıcı silmeden hemen önce (ürün yazı tipi).
     *
     * @param int          $post_id Post ID.
     * @param WP_Post|null $post    Post object.
     * @return void
     */
    public static function purge_product_donation_caches_on_delete($post_id, $post = null) {
        $post_id = absint($post_id);
        if ($post_id <= 0) {
            return;
        }

        if ($post instanceof WP_Post) {
            if ($post->post_type !== 'product') {
                return;
            }
        } elseif (get_post_type($post_id) !== 'product') {
            return;
        }

        self::purge_product_donation_caches_for_removal($post_id);
    }

    /**
     * Ürün çöpe taşındığında.
     *
     * @param int $post_id Post ID.
     * @return void
     */
    public static function purge_product_donation_caches_on_trash($post_id) {
        $post_id = absint($post_id);
        if ($post_id <= 0 || get_post_type($post_id) !== 'product') {
            return;
        }

        self::purge_product_donation_caches_for_removal($post_id);
    }

    /**
     * Invalidate caches when a product post is saved (price, title, stock, etc.).
     *
     * @param int     $post_id Post ID.
     * @param WP_Post $post    Post object.
     * @param bool    $update  Whether this is an update.
     * @return void
     */
    public static function invalidate_product_donation_caches_on_product_save($post_id, $post, $update) {
        unset($post, $update);

        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }

        if (wp_is_post_revision($post_id)) {
            return;
        }

        if (function_exists('wp_is_post_autosave') && wp_is_post_autosave($post_id)) {
            return;
        }

        self::invalidate_product_donation_caches((int) $post_id);
    }

    /**
     * Invalidate caches after WooCommerce persists a product (CRUD / admin / REST).
     *
     * @param int $product_id Product ID.
     * @return void
     */
    public static function invalidate_product_donation_caches_on_wc_product($product_id) {
        self::invalidate_product_donation_caches(absint($product_id));
    }

    /**
     * Invalidate caches when donation-related product meta is added or updated.
     *
     * @param int    $meta_id    Meta row ID (unused).
     * @param int    $object_id  Post ID.
     * @param string $meta_key   Meta key.
     * @param mixed  $meta_value Meta value (unused).
     * @return void
     */
    public static function maybe_invalidate_product_donation_caches_on_meta($meta_id, $object_id, $meta_key, $meta_value) {
        unset($meta_id, $meta_value);

        $object_id = absint($object_id);
        if ($object_id <= 0 || $meta_key === '') {
            return;
        }

        if (get_post_type($object_id) !== 'product') {
            return;
        }

        if (!self::is_donation_popup_product_info_meta_key($meta_key)) {
            return;
        }

        self::invalidate_product_donation_caches($object_id);
    }

    /**
     * Whether this meta key is part of WDP product donation settings (see WDP_Product_Settings_Service).
     *
     * @param string $meta_key Meta key.
     * @return bool
     */
    private static function is_donation_popup_product_info_meta_key($meta_key) {
        if (!class_exists('WDP_Product_Settings_Service')) {
            return false;
        }

        static $lookup = null;

        if (null === $lookup) {
            $lookup = array_fill_keys(WDP_Product_Settings_Service::get_settings_meta_keys(), true);
        }

        return isset($lookup[$meta_key]);
    }
}

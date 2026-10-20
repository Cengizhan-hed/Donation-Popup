<?php
/**
 * HPOS uyumlu sipariş meta ve tamamlanan sipariş bağış toplamı senkronu.
 *
 * @package WooCommerce\Donation_Popup
 */
if (!defined('ABSPATH')) {
    exit;
}

trait WDP_Utils_Order_Meta_Trait {
    /**
     * Sipariş/iade bayrak meta değerini okur (HPOS + post_meta yedek).
     *
     * @param int|WC_Abstract_Order $order_or_id Sipariş veya ID.
     * @param string                $meta_key    Meta anahtarı.
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
     * Sipariş/iade bayrak meta değerini yazar (HPOS + post_meta yedek).
     *
     * @param int|WC_Abstract_Order $order_or_id Sipariş veya ID.
     * @param string                $meta_key    Meta anahtarı.
     * @param string                $value       Değer.
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
     * Ödemesi alınmış sayılan sipariş durumları (progress bar toplamı için).
     *
     * @return string[] Durum slug'ları ("wc-" öneki olmadan).
     */
    public static function get_progress_paid_statuses() {
        /**
         * Progress bar toplamına dahil edilen sipariş durumları.
         *
         * @param string[] $statuses Varsayılan: processing, completed.
         */
        $statuses = apply_filters('wdp_progress_paid_statuses', array('processing', 'completed'));
        if (!is_array($statuses)) {
            $statuses = array('processing', 'completed');
        }

        $out = array();
        foreach ($statuses as $status) {
            $status = self::normalize_order_status_slug($status);
            if ($status !== '') {
                $out[] = $status;
            }
        }

        return array_values(array_unique($out));
    }

    /**
     * Sayılmış siparişin toplamdan düşüleceği durumlar.
     *
     * @return string[]
     */
    public static function get_progress_reversal_statuses() {
        return array('refunded', 'cancelled', 'failed');
    }

    /**
     * "wc-completed" → "completed".
     *
     * @param mixed $status Raw status.
     * @return string
     */
    private static function normalize_order_status_slug($status) {
        $status = sanitize_key((string) $status);
        return strpos($status, 'wc-') === 0 ? substr($status, 3) : $status;
    }

    /**
     * woocommerce_order_status_changed: ödenmiş duruma geçince say, iade/iptal/başarısızda geri al.
     *
     * @param int           $order_id Order ID.
     * @param string        $from     Old status.
     * @param string        $to       New status.
     * @param WC_Order|null $order    Order object.
     * @return void
     */
    public static function sync_order_donation_totals_on_status_change($order_id, $from = '', $to = '', $order = null) {
        unset($from);

        if (!is_object($order)) {
            $order_id = absint($order_id);
            $order = $order_id ? wc_get_order($order_id) : null;
        }
        if (!$order || is_a($order, 'WC_Order_Refund')) {
            return;
        }

        $to = self::normalize_order_status_slug($to);

        // Ödenmiş duruma geçince say; herhangi bir ödenmemiş duruma (on-hold, pending, trash…) düşünce düş.
        if (in_array($to, self::get_progress_paid_statuses(), true)) {
            self::count_order_in_progress_totals($order);
        } elseif (self::is_order_counted_in_progress($order)) {
            self::uncount_order_from_progress_totals($order);
        }
    }

    /**
     * Sipariş kalıcı silinmeden / çöpe gitmeden önce progress toplamından düş.
     *
     * @param int          $post_id Post ID.
     * @param WP_Post|null $post    Post.
     * @return void
     */
    public static function uncount_order_progress_on_delete($post_id, $post = null) {
        $post_id = absint($post_id);
        if ($post_id <= 0) {
            return;
        }
        $type = ($post instanceof WP_Post) ? $post->post_type : get_post_type($post_id);
        if ($type !== 'shop_order') {
            // HPOS: post_type boş olabilir; sipariş nesnesi dene.
            if (!function_exists('wc_get_order')) {
                return;
            }
        }
        $order = function_exists('wc_get_order') ? wc_get_order($post_id) : null;
        if (!$order || is_a($order, 'WC_Order_Refund')) {
            return;
        }
        self::uncount_order_from_progress_totals($order);
    }

    /**
     * Sipariş çöpe taşındığında.
     *
     * @param int $post_id Post ID.
     * @return void
     */
    public static function uncount_order_progress_on_trash($post_id) {
        self::uncount_order_progress_on_delete($post_id, null);
    }

    /**
     * Sipariş çöpten çıkınca, hâlâ ödenmiş durumdaysa yeniden say.
     *
     * @param int $post_id Post ID.
     * @return void
     */
    public static function recount_order_progress_on_untrash($post_id) {
        $post_id = absint($post_id);
        if (!$post_id || !function_exists('wc_get_order')) {
            return;
        }
        $order = wc_get_order($post_id);
        if (!$order || is_a($order, 'WC_Order_Refund')) {
            return;
        }
        $status = method_exists($order, 'get_status')
            ? self::normalize_order_status_slug($order->get_status())
            : '';
        if (in_array($status, self::get_progress_paid_statuses(), true)) {
            self::count_order_in_progress_totals($order);
        }
    }

    /**
     * Arka plan toplam yeniden hesap (wp-cron).
     *
     * @param int $product_id Product ID.
     * @return void
     */
    public static function cron_recalculate_product_donation_total($product_id) {
        self::recalculate_product_donation_total(absint($product_id));
    }

    /**
     * Tek seferlik yeniden hesap planla (ziyaretçi isteğinde ağır tarama yok).
     *
     * @param int $product_id Product ID.
     * @return void
     */
    public static function schedule_product_donation_total_recalc($product_id) {
        $product_id = absint($product_id);
        if (!$product_id || !function_exists('wp_schedule_single_event')) {
            return;
        }
        $hook = 'wdp_recalculate_product_donation_total';
        $args = array($product_id);
        if (function_exists('wp_next_scheduled') && wp_next_scheduled($hook, $args)) {
            return;
        }
        wp_schedule_single_event(time() + 15, $hook, $args);
    }

    /**
     * Geriye dönük uyumluluk: eski "completed" kancası.
     *
     * @param int $order_id WooCommerce order id.
     * @return void
     */
    public static function sync_order_donation_totals_on_complete($order_id) {
        $order_id = absint($order_id);
        $order = $order_id ? wc_get_order($order_id) : null;
        if ($order) {
            self::count_order_in_progress_totals($order);
        }
    }

    /**
     * Sipariş progress toplamlarına daha önce eklendi mi? (yeni bayrak veya eski _wdp_donation_totals_applied)
     *
     * @param WC_Abstract_Order $order Order.
     * @return bool
     */
    public static function is_order_counted_in_progress($order) {
        return self::get_order_flag_meta($order, '_wdp_progress_counted') === 'yes'
            || self::get_order_flag_meta($order, '_wdp_donation_totals_applied') === 'yes';
    }

    /**
     * Siparişi ürün toplamlarına ekle (bir kez).
     *
     * @param WC_Abstract_Order $order Order.
     * @return bool True if totals changed.
     */
    public static function count_order_in_progress_totals($order) {
        if (!is_object($order)) {
            return false;
        }

        if (self::get_order_flag_meta($order, '_wdp_progress_counted') === 'yes') {
            return false;
        }

        $amounts = self::compute_order_progress_amounts($order);

        // Eski sürüm (yalnızca "completed") zaten saymış: toplamlara dokunmadan yeni bayrağa taşı.
        if (self::get_order_flag_meta($order, '_wdp_donation_totals_applied') === 'yes') {
            self::store_order_progress_state($order, $amounts);
            return false;
        }

        foreach ($amounts as $product_id => $amount) {
            if ($amount <= 0) {
                continue;
            }
            self::update_product_donation_total($product_id, $amount);
            self::bump_product_donor_count($product_id, 1);
        }

        self::store_order_progress_state($order, $amounts);
        return true;
    }

    /**
     * Sayılmış siparişi ürün toplamlarından düş ve bayrağı kaldır.
     *
     * @param WC_Abstract_Order $order Order.
     * @return bool True if totals changed.
     */
    public static function uncount_order_from_progress_totals($order) {
        if (!is_object($order) || !self::is_order_counted_in_progress($order)) {
            return false;
        }

        $amounts = self::get_order_progress_amounts($order);
        foreach ($amounts as $product_id => $amount) {
            if ($amount <= 0) {
                continue;
            }
            self::update_product_donation_total($product_id, -$amount);
            self::bump_product_donor_count($product_id, -1);
        }

        $flag_keys = array('_wdp_progress_counted', '_wdp_progress_amounts', '_wdp_donation_totals_applied');
        foreach ($flag_keys as $flag_key) {
            $order->delete_meta_data($flag_key);
        }
        $order->save_meta_data();

        // get_order_flag_meta() post_meta yedeğine de bakar; eski kopyalar bayrağı geri getirmesin.
        $order_id = method_exists($order, 'get_id') ? absint($order->get_id()) : 0;
        if ($order_id) {
            foreach ($flag_keys as $flag_key) {
                delete_post_meta($order_id, $flag_key);
            }
        }

        return true;
    }

    /**
     * Kısmi/tam iade (woocommerce_order_refunded): iade edilen satır tutarını ürün toplamından düş.
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

        $order = wc_get_order(absint($order_id));
        if (!$order) {
            return;
        }

        self::apply_refund_to_progress_totals($order, $refund);
    }

    /**
     * Refund satırlarını sayılmış sipariş tutarlarından düş.
     *
     * Tam iadede durum önce "refunded" olur ve sipariş zaten geri alınmıştır; bu durumda bir şey yapılmaz.
     *
     * @param WC_Abstract_Order $order  Parent order.
     * @param WC_Abstract_Order $refund Refund.
     * @return float Total deducted.
     */
    public static function apply_refund_to_progress_totals($order, $refund) {
        if (!is_object($order) || !is_object($refund)) {
            return 0.0;
        }
        if (self::get_order_flag_meta($refund, '_wdp_donation_totals_reverted') === 'yes') {
            return 0.0;
        }
        if (!self::is_order_counted_in_progress($order)) {
            return 0.0;
        }

        $stored = $order->get_meta('_wdp_progress_amounts', true);
        $has_stored = is_array($stored);
        // Eski sipariş: tutarlar iade düşülmüş hâliyle hesaplanır (bu iade dahil).
        $amounts = $has_stored ? self::sanitize_progress_amounts($stored) : self::compute_order_progress_amounts($order);

        $deducted = 0.0;
        foreach ($refund->get_items() as $item) {
            $product_id = absint($item->get_product_id());
            if (!$product_id) {
                continue;
            }

            $refunded = abs(floatval($item->get_total()));
            if ($refunded <= 0) {
                continue;
            }

            if ($has_stored) {
                $available = isset($amounts[ $product_id ]) ? $amounts[ $product_id ] : 0.0;
                $refunded = min($refunded, $available);
                if ($refunded <= 0) {
                    continue;
                }
                $amounts[ $product_id ] = max(0.0, $available - $refunded);
                if ($amounts[ $product_id ] <= 0) {
                    self::bump_product_donor_count($product_id, -1);
                }
            }

            self::update_product_donation_total($product_id, -$refunded);
            $deducted += $refunded;
        }

        self::store_order_progress_state($order, $amounts);
        self::set_order_flag_meta($refund, '_wdp_donation_totals_reverted', 'yes');

        return $deducted;
    }

    /**
     * Ürün → sayılan tutar (iade edilen satır tutarları düşülmüş).
     *
     * @param WC_Abstract_Order $order Order.
     * @return array<int,float>
     */
    public static function compute_order_progress_amounts($order) {
        $amounts = array();
        if (!is_object($order) || !method_exists($order, 'get_items')) {
            return $amounts;
        }

        $currency = class_exists('WDP_Progress_Currency')
            ? WDP_Progress_Currency::get_order_currency($order)
            : (method_exists($order, 'get_currency') ? strtoupper((string) $order->get_currency()) : '');

        foreach ($order->get_items() as $item_id => $item) {
            $product_id = absint($item->get_product_id());
            if (!$product_id) {
                continue;
            }

            $line_total = self::resolve_donation_line_total($item);
            if (method_exists($order, 'get_total_refunded_for_item')) {
                $line_total -= abs(floatval($order->get_total_refunded_for_item($item_id)));
            }
            $line_total = max(0.0, $line_total);
            if ($line_total <= 0) {
                continue;
            }

            if (class_exists('WDP_Progress_Currency')) {
                $converted = WDP_Progress_Currency::convert_to_base($line_total, $currency, $order);
                if (empty($converted['ok'])) {
                    self::log_progress_conversion_skip($order, $product_id, isset($converted['reason']) ? (string) $converted['reason'] : 'unknown');
                    continue;
                }
                $line_total = (float) $converted['amount'];
            }

            $amounts[ $product_id ] = (isset($amounts[ $product_id ]) ? $amounts[ $product_id ] : 0.0) + max(0.0, $line_total);
        }

        return $amounts;
    }

    /**
     * Dönüşülemeyen satır: kişisel veri yok, günlük + ürün sayacı.
     *
     * @param WC_Abstract_Order $order      Order.
     * @param int               $product_id Product.
     * @param string            $reason     Reason code.
     * @return void
     */
    private static function log_progress_conversion_skip($order, $product_id, $reason) {
        $order_id = (is_object($order) && method_exists($order, 'get_id')) ? absint($order->get_id()) : 0;
        self::log(
            sprintf(
                'progress convert skip order=%d product=%d reason=%s',
                $order_id,
                absint($product_id),
                sanitize_key($reason)
            )
        );
        $product_id = absint($product_id);
        if ($product_id) {
            $key = '_wdp_progress_unconverted_orders';
            $skipped = get_post_meta($product_id, $key, true);
            $list = is_array($skipped) ? $skipped : array();
            if ($order_id && !in_array($order_id, $list, true)) {
                $list[] = $order_id;
                update_post_meta($product_id, $key, array_values(array_slice($list, -50)));
            }
        }
    }

    /**
     * Siparişte saklanan sayılmış tutarlar (eski siparişte hesaplanır).
     *
     * @param WC_Abstract_Order $order Order.
     * @return array<int,float>
     */
    private static function get_order_progress_amounts($order) {
        $stored = $order->get_meta('_wdp_progress_amounts', true);
        if (is_array($stored)) {
            return self::sanitize_progress_amounts($stored);
        }
        return self::compute_order_progress_amounts($order);
    }

    /**
     * @param array $amounts Raw amounts.
     * @return array<int,float>
     */
    private static function sanitize_progress_amounts(array $amounts) {
        $out = array();
        foreach ($amounts as $product_id => $amount) {
            $product_id = absint($product_id);
            if ($product_id && is_numeric($amount)) {
                $out[ $product_id ] = max(0.0, (float) $amount);
            }
        }
        return $out;
    }

    /**
     * Bayrak + tutarları siparişe yaz (_wdp_progress_counted = yes).
     *
     * @param WC_Abstract_Order $order   Order.
     * @param array             $amounts Product → amount.
     * @return void
     */
    private static function store_order_progress_state($order, array $amounts) {
        $order->update_meta_data('_wdp_progress_counted', 'yes');
        $order->update_meta_data('_wdp_progress_amounts', self::sanitize_progress_amounts($amounts));
        $order->save_meta_data();
    }

    /**
     * Ürün toplamını ödenmiş siparişleri tarayarak baştan hesapla ve yaz.
     *
     * Sayılmamış ödenmiş siparişler sayılmış olarak işaretlenir; sonraki durum değişikliklerinde çift sayım olmaz.
     *
     * @param int $product_id Product ID.
     * @return array{total:float,donors:int,orders:int}
     */
    public static function recalculate_product_donation_total($product_id) {
        $product_id = absint($product_id);
        $result = array('total' => 0.0, 'donors' => 0, 'orders' => 0, 'unconverted' => 0);
        if (!$product_id || !function_exists('wc_get_orders')) {
            return $result;
        }

        // Yeniden hesap başında dönüşüm uyarı listesini sıfırla; compute sırasında yeniden dolar.
        delete_post_meta($product_id, '_wdp_progress_unconverted_orders');

        $statuses = array();
        foreach (self::get_progress_paid_statuses() as $status) {
            $statuses[] = 'wc-' . $status;
        }
        if (empty($statuses)) {
            self::update_product_donation_total($product_id, 0.0, true);
            self::set_product_donor_count($product_id, 0);
            return $result;
        }

        // Büyük mağazalarda memory/CPU maliyetini azaltmak için siparişleri sayfalar halinde işle.
        $page = 1;
        $per_page = 200;

        do {
            $order_query = wc_get_orders(array(
                'type'     => 'shop_order',
                'status'   => $statuses,
                'limit'    => $per_page,
                'page'     => $page,
                'paginate' => true,
                'return'   => 'objects',
            ));

            if (empty($order_query) || empty($order_query->orders)) {
                break;
            }

            foreach ($order_query->orders as $order) {
                if (!$order) {
                    continue;
                }

                $amounts = self::compute_order_progress_amounts($order);
                if (!isset($amounts[ $product_id ])) {
                    continue;
                }

                // Diğer ürünlerin toplamlarını da tutarlı tut; bu ürünün toplamı aşağıda mutlak yazılır.
                if (!self::is_order_counted_in_progress($order)) {
                    self::count_order_in_progress_totals($order);
                } else {
                    $stored = $order->get_meta('_wdp_progress_amounts', true);
                    $stored = is_array($stored) ? self::sanitize_progress_amounts($stored) : $amounts;
                    $stored[ $product_id ] = $amounts[ $product_id ];
                    self::store_order_progress_state($order, $stored);
                }

                $result['orders']++;
                if ($amounts[ $product_id ] > 0) {
                    $result['total'] += $amounts[ $product_id ];
                    $result['donors']++;
                }
            }

            $page++;
        } while ($page <= (int) $order_query->max_num_pages);

        $skipped = get_post_meta($product_id, '_wdp_progress_unconverted_orders', true);
        $result['unconverted'] = is_array($skipped) ? count($skipped) : 0;

        self::update_product_donation_total($product_id, $result['total'], true);
        self::set_product_donor_count($product_id, $result['donors']);

        return $result;
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
            $line = floatval($custom_price) * max(1, intval($item->get_quantity()));
        } else {
            $line = max(0.0, floatval($item->get_total()));
        }

        return self::strip_cover_fee_from_line_total($item, $line);
    }

    /**
     * İşlem ücreti toplanana girmez: satırdaki wdp_cover_fee yüzdesinden bağış kısmını ayır.
     *
     * Kayıt: cover_fee işaretliyken sipariş satır meta `wdp_cover_fee` = yüzde string (veya eski 'yes').
     * `_custom_price` / satır total şişirilmiş tutardır → bağış = total / (1 + pct/100).
     *
     * @param object $item Order line item.
     * @param float  $line Gross line total.
     * @return float Net donation amount.
     */
    public static function strip_cover_fee_from_line_total($item, $line) {
        $line = max(0.0, (float) $line);
        if ($line <= 0 || !is_object($item) || !method_exists($item, 'get_meta')) {
            return $line;
        }

        $fee_raw = $item->get_meta(class_exists('WDP_Order_Meta_Keys') ? WDP_Order_Meta_Keys::COVER_FEE : 'wdp_cover_fee');
        $pct     = 0.0;
        if ($fee_raw !== '' && $fee_raw !== null && is_numeric($fee_raw)) {
            $pct = (float) $fee_raw;
        } elseif ((string) $fee_raw === 'yes' && method_exists($item, 'get_product_id')) {
            $product = function_exists('wc_get_product') ? wc_get_product(absint($item->get_product_id())) : null;
            if ($product && method_exists($product, 'get_meta')) {
                $pct = (float) $product->get_meta('_cover_fee_percent');
            }
        }

        if ($pct <= 0) {
            return $line;
        }

        $net = $line / (1.0 + ($pct / 100.0));
        $decimals = function_exists('wc_get_price_decimals') ? (int) wc_get_price_decimals() : 2;
        return max(0.0, round($net, $decimals));
    }

    /**
     * Tek yazım noktası: _wdp_total_donation_amount (delta veya mutlak), negatif olmaz, önbellekler temizlenir.
     *
     * Delta modunda toplam henüz hiç hesaplanmamışsa ('' meta) yazılmaz; ilk okumada tam tarama yapılır.
     *
     * @param int   $product_id Product id.
     * @param float $amount     Delta (positive/negative) or absolute total.
     * @param bool  $absolute   True to set the total instead of adding.
     * @return float|null New total, or null when nothing was written.
     */
    public static function update_product_donation_total($product_id, $amount, $absolute = false) {
        $product_id = absint($product_id);
        if (!$product_id || !is_numeric($amount)) {
            return null;
        }
        $amount = floatval($amount);

        if ($absolute) {
            $next_total = max(0.0, $amount);
        } else {
            if ($amount == 0.0) {
                return null;
            }
            $current = get_post_meta($product_id, '_wdp_total_donation_amount', true);
            if ($current === '' || !is_numeric($current)) {
                self::clear_product_donation_total_caches($product_id);
                return null;
            }
            $next_total = max(0.0, floatval($current) + $amount);
        }

        update_post_meta($product_id, '_wdp_total_donation_amount', $next_total);
        self::clear_product_donation_total_caches($product_id);

        return $next_total;
    }

    /**
     * Progress toplamı ve ürün bilgisi önbellek anahtarlarını temizle.
     *
     * @param int $product_id Product ID.
     * @return void
     */
    private static function clear_product_donation_total_caches($product_id) {
        wp_cache_delete('wdp_total_donation_' . $product_id, 'wdp_donations');
        wp_cache_delete('wdp_donor_count_' . $product_id, 'wdp_donations');
        self::invalidate_product_donation_caches($product_id);
    }

    /**
     * Bağışçı sayacını artır/azalt.
     *
     * @param int $product_id Product id.
     * @param int $delta      +1 / -1.
     * @return void
     */
    private static function bump_product_donor_count($product_id, $delta) {
        $product_id = absint($product_id);
        $delta = (int) $delta;
        if (!$product_id || $delta === 0) {
            return;
        }
        $current = (int) get_post_meta($product_id, '_wdp_donor_count', true);
        self::set_product_donor_count($product_id, $current + $delta);
    }

    /**
     * @param int $product_id Product id.
     * @param int $count      New count (clamped to >= 0).
     * @return void
     */
    private static function set_product_donor_count($product_id, $count) {
        update_post_meta($product_id, '_wdp_donor_count', max(0, (int) $count));
        wp_cache_delete('wdp_donor_count_' . $product_id, 'wdp_donations');
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
        // Progress sayaçları (meta wp-cli ile değişince de düşsün).
        wp_cache_delete('wdp_total_donation_' . $product_id, 'wdp_donations');
        wp_cache_delete('wdp_donor_count_' . $product_id, 'wdp_donations');
        if (class_exists('WDP_Donations_List')) {
            WDP_Donations_List::bump_cache();
        }
        if (class_exists('WDP_Donation_Scope')) {
            WDP_Donation_Scope::flush($product_id);
        }
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

        $progress_keys = array(
            '_wdp_total_donation_amount',
            '_wdp_donor_count',
            '_wdp_progress_unconverted_orders',
        );
        if (!self::is_donation_popup_product_info_meta_key($meta_key) && !in_array($meta_key, $progress_keys, true)) {
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

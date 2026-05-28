<?php
/**
 * Order operations class
 * Handles order meta data
 * 
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Class WDP_Order
 */
class WDP_Order {

    /**
     * Initialize order hooks
     */
    public static function init() {
        // Sipariş oluşturulurken, bağış verilerini sipariş öğe metalarına ekle
        add_action('woocommerce_checkout_create_order_line_item', array(__CLASS__, 'add_donation_meta_to_order'), 10, 4);
    }

    /**
     * Add donation meta to order item
     *
     * @param WC_Order_Item_Product $item         Order item.
     * @param string                $cart_item_key Cart item key.
     * @param array                 $values       Cart item values.
     * @param WC_Order              $order        Order.
     */
    public static function add_donation_meta_to_order($item, $cart_item_key, $values, $order) {
        // Özel fiyat varsa order item meta'ya ekle (progress bar için gerekli)
        if (isset($values['custom_price']) && $values['custom_price'] > 0) {
            $item->add_meta_data('_custom_price', floatval($values['custom_price']));
        }
        
        if (isset($values['donation_data'])) {
            $donation_data = $values['donation_data'];

            // Çoklu hisse kontrolü
            if (isset($donation_data['share_count']) && $donation_data['share_count'] > 0) {
                $item->add_meta_data(__('Hisse Sayısı', 'woo-donation-popup'), $donation_data['share_count']);

                // Hissedar bilgilerini ekle
                if (isset($donation_data['shareholders'])) {
                    foreach ($donation_data['shareholders'] as $key => $shareholder) {
                        if (!empty($shareholder['name'])) {
                            $item->add_meta_data(sprintf(__('%d. Hissedar Adı', 'woo-donation-popup'), $key), $shareholder['name']);
                        }

                        if (!empty($shareholder['phone'])) {
                            $item->add_meta_data(sprintf(__('%d. Hissedar Telefonu', 'woo-donation-popup'), $key), $shareholder['phone']);
                        }

                        if (!empty($shareholder['email'])) {
                            $item->add_meta_data(sprintf(__('%d. Hissedar E-postası', 'woo-donation-popup'), $key), $shareholder['email']);
                        }

                        if (isset($shareholder['note']) && $shareholder['note'] !== '') {
                            $item->add_meta_data(sprintf(__('%d. Hissedar Notu', 'woo-donation-popup'), $key), $shareholder['note']);
                        }
                    }
                }
            } else {
                // Normal bağış verilerini ekle
                if (!empty($donation_data['full_name'])) {
                    $item->add_meta_data(__('Bağışçı Adı', 'woo-donation-popup'), $donation_data['full_name']);
                }

                if (!empty($donation_data['phone'])) {
                    $item->add_meta_data(__('Bağışçı Telefonu', 'woo-donation-popup'), $donation_data['phone']);
                }

                if (isset($donation_data['note']) && $donation_data['note'] !== '') {
                    $item->add_meta_data(__('Bağış Notu', 'woo-donation-popup'), $donation_data['note']);
                }
            }
        }
    }
}

// Note: init() is called by Woo_Donation_Popup::__construct()


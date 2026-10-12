<?php
/**
 * wp_ajax_* kancalarını kaydeden ince AJAX sınıfı; mantık trait dosyalarında.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
    exit;
}

$wdp_ajax_traits_dir = WDP_PLUGIN_DIR . 'includes/traits/';
require_once $wdp_ajax_traits_dir . 'trait-wdp-ajax-base.php';
require_once $wdp_ajax_traits_dir . 'trait-wdp-ajax-product.php';
require_once $wdp_ajax_traits_dir . 'trait-wdp-ajax-cart-add.php';
require_once $wdp_ajax_traits_dir . 'trait-wdp-ajax-cart-session.php';
require_once $wdp_ajax_traits_dir . 'trait-wdp-ajax-cart-query.php';

/**
 * Class WDP_Ajax
 */
class WDP_Ajax {
    use WDP_Ajax_Base_Trait;
    use WDP_Ajax_Product_Trait;
    use WDP_Ajax_Cart_Add_Trait;
    use WDP_Ajax_Cart_Session_Trait;
    use WDP_Ajax_Cart_Query_Trait;

    /**
     * Register all AJAX action hooks.
     *
     * @return void
     */
    public static function init() {
        add_action('wp_ajax_wdp_get_cart_count', array(__CLASS__, 'get_cart_count'));
        add_action('wp_ajax_nopriv_wdp_get_cart_count', array(__CLASS__, 'get_cart_count'));

        add_action('wp_ajax_wdp_get_cart_contents', array(__CLASS__, 'get_cart_contents'));
        add_action('wp_ajax_nopriv_wdp_get_cart_contents', array(__CLASS__, 'get_cart_contents'));

        add_action('wp_ajax_wdp_ajax_add_to_cart', array(__CLASS__, 'ajax_add_to_cart'));
        add_action('wp_ajax_nopriv_wdp_ajax_add_to_cart', array(__CLASS__, 'ajax_add_to_cart'));

        add_action('wp_ajax_wdp_get_fresh_nonces', array(__CLASS__, 'get_fresh_nonces'));
        add_action('wp_ajax_nopriv_wdp_get_fresh_nonces', array(__CLASS__, 'get_fresh_nonces'));

        add_action('wp_ajax_wdp_verify_submission_in_cart', array(__CLASS__, 'verify_submission_in_cart'));
        add_action('wp_ajax_nopriv_wdp_verify_submission_in_cart', array(__CLASS__, 'verify_submission_in_cart'));

        add_action('wp_ajax_wdp_remove_cart_item', array(__CLASS__, 'remove_cart_item'));
        add_action('wp_ajax_nopriv_wdp_remove_cart_item', array(__CLASS__, 'remove_cart_item'));

        /** @deprecated 10.2.6 Use wdp_get_product_info */
        add_action('wp_ajax_wdp_get_product_name', array(__CLASS__, 'get_product_name'));
        add_action('wp_ajax_nopriv_wdp_get_product_name', array(__CLASS__, 'get_product_name'));

        add_action('wp_ajax_wdp_get_product_info', array(__CLASS__, 'get_product_info'));
        add_action('wp_ajax_nopriv_wdp_get_product_info', array(__CLASS__, 'get_product_info'));
    }
}

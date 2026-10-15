<?php
/**
 * Simple product add to cart — replaced by donation form or Donate button.
 *
 * Loaded via wc_get_template / woocommerce_locate_template for donation products
 * when "WooCommerce sayfalarında Sepete Ekle yerine Bağış Yap" is enabled.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

if (!class_exists('WDP_Product_Page_Integration')) {
	return;
}

WDP_Product_Page_Integration::render_template_override();

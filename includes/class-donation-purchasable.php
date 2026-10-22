<?php
/**
 * Bağışçı belirler / hedefli ürünler WooCommerce fiyatı boşken de satın alınabilir.
 *
 * Min tutarın kaynağı Bağış sekmesi (`_min_custom_price`). Genel fiyat doldurulmaz,
 * mevcut değerler değiştirilmez.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Donation_Purchasable
 */
class WDP_Donation_Purchasable {

	/**
	 * @return void
	 */
	public static function init() {
		add_filter('woocommerce_is_purchasable', array(__CLASS__, 'filter_is_purchasable'), 20, 2);
	}

	/**
	 * Custom / campaign donation products remain purchasable with an empty General price.
	 * Status, existence and catalog rules still apply (we only relax the empty-price gate).
	 *
	 * @param bool       $purchasable WC result.
	 * @param WC_Product $product     Product.
	 * @return bool
	 */
	public static function filter_is_purchasable($purchasable, $product) {
		if ($purchasable) {
			return true;
		}
		if (!is_object($product) || !method_exists($product, 'get_id')) {
			return $purchasable;
		}
		if (class_exists('WDP_Donation_Scope') && !WDP_Donation_Scope::is_donation_product($product)) {
			return $purchasable;
		}
		$id   = (int) $product->get_id();
		$type = class_exists('WDP_Donation_Type') ? WDP_Donation_Type::for_product($id) : '';
		if (!in_array($type, array(WDP_Donation_Type::CUSTOM, WDP_Donation_Type::CAMPAIGN), true)) {
			return $purchasable;
		}
		if (method_exists($product, 'exists') && !$product->exists()) {
			return false;
		}
		$status = method_exists($product, 'get_status') ? (string) $product->get_status() : 'publish';
		if ($status === 'publish') {
			return true;
		}
		if (function_exists('current_user_can') && current_user_can('edit_post', $id)) {
			return true;
		}
		return false;
	}
}

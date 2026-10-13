<?php
/**
 * WooCommerce ve Rank Math Product JSON-LD: fiyatı olmayan bağış ürünlerinde Product işaretlemesini kaldırır.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Structured data for donation products (schema=auto).
 */
class WDP_Schema {

	/**
	 * @return void
	 */
	public static function init() {
		add_filter('woocommerce_structured_data_product', array(__CLASS__, 'filter_wc_product'), 20, 2);
		if (defined('RANK_MATH_VERSION') || class_exists('RankMath')) {
			add_filter('rank_math/snippet/rich_snippet_product_entity', array(__CLASS__, 'filter_rank_math_entity'), 20);
			add_filter('rank_math/json_ld', array(__CLASS__, 'filter_rank_math_graph'), 99, 2);
		}
	}

	/**
	 * Whether this product should keep Product+Offer markup.
	 *
	 * Fixed and share products with a price > 0 keep it. Open-amount and campaign
	 * products with empty/zero price do not.
	 *
	 * @param WC_Product $product Product.
	 * @return bool
	 */
	public static function should_output_product($product) {
		if (WDP_Placement_Settings::value('schema', 'auto') !== 'auto') {
			return true;
		}
		if (!WDP_Product_Resolver::is_wc_product($product) || !WDP_Donation_Scope::is_donation_product($product)) {
			return true;
		}
		$type  = WDP_Donation_Type::for_product($product->get_id());
		$price = $product->get_price();
		$keep  = in_array($type, array(WDP_Donation_Type::FIXED, WDP_Donation_Type::SHARES), true)
			&& is_numeric($price)
			&& (float) $price > 0;

		/**
		 * @param bool       $keep    Whether to output Product markup.
		 * @param WC_Product $product Product.
		 * @param string     $type    Donation type.
		 */
		return (bool) apply_filters('wdp_product_schema', $keep, $product, $type);
	}

	/**
	 * @param array      $markup  Schema markup.
	 * @param WC_Product $product Product.
	 * @return array
	 */
	public static function filter_wc_product($markup, $product = null) {
		return WDP_Render_Guard::value(
			static function () use ($markup, $product) {
				if (!self::should_output_product($product)) {
					return array();
				}
				return is_array($markup) ? $markup : array();
			},
			is_array($markup) ? $markup : array(),
			'schema_wc'
		);
	}

	/**
	 * Rank Math Product entity. Empty array removes the Product snippet without touching the rest of the graph.
	 *
	 * @param array $entity Entity.
	 * @return array
	 */
	public static function filter_rank_math_entity($entity) {
		return WDP_Render_Guard::value(
			static function () use ($entity) {
				$product = self::current_product();
				if ($product && !self::should_output_product($product)) {
					return array();
				}
				return is_array($entity) ? $entity : array();
			},
			is_array($entity) ? $entity : array(),
			'schema_rank_math_entity'
		);
	}

	/**
	 * Fallback: drop Product nodes if the entity filter was not enough.
	 *
	 * @param array $data   JSON-LD graph.
	 * @param mixed $jsonld Rank Math JsonLD instance.
	 * @return array
	 */
	public static function filter_rank_math_graph($data, $jsonld = null) {
		return WDP_Render_Guard::value(
			static function () use ($data) {
				$product = self::current_product();
				if (!$product || self::should_output_product($product) || !is_array($data)) {
					return is_array($data) ? $data : array();
				}
				foreach ($data as $key => $node) {
					if (!is_array($node)) {
						continue;
					}
					$type = isset($node['@type']) ? $node['@type'] : '';
					$types = is_array($type) ? $type : array($type);
					if (in_array('Product', $types, true)) {
						unset($data[ $key ]);
					}
				}
				return $data;
			},
			is_array($data) ? $data : array(),
			'schema_rank_math_graph'
		);
	}

	/**
	 * @return WC_Product|null
	 */
	private static function current_product() {
		if (!function_exists('wc_get_product')) {
			return null;
		}
		$id = function_exists('get_queried_object_id') ? absint(get_queried_object_id()) : 0;
		if ($id <= 0) {
			return null;
		}
		$product = wc_get_product($id);
		return WDP_Product_Resolver::is_wc_product($product) ? $product : null;
	}
}

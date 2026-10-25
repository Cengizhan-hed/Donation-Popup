<?php
/**
 * Bir ürünün bağış ürünü sayılıp sayılmadığına karar verir (ürün işareti + genel kapsam + ürün tipi).
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Single source of truth for "is this a donation product?".
 *
 * Order: unsupported product type → false; product flag yes/no; global scope
 * (all / categories incl. children / marked only). Result is filterable and cached per request.
 */
class WDP_Donation_Scope {

	const META = '_wdp_donation_product';

	/** @var array<int, bool> */
	private static $cache = array();

	/** @var string[]|null */
	private static $types = null;

	/** @var array<int, int[]> term id => ancestor ids */
	private static $ancestors = array();

	/**
	 * Product types the donation form supports.
	 *
	 * @return string[]
	 */
	public static function supported_types() {
		if ( self::$types === null ) {
			$types       = apply_filters( 'wdp_supported_product_types', array( 'simple' ) );
			$types       = is_array( $types ) ? $types : array( 'simple' );
			self::$types = array_values( array_unique( array_filter( array_map( 'sanitize_key', array_filter( $types, 'is_scalar' ) ) ) ) );
		}
		return self::$types;
	}

	/**
	 * @param mixed $product WC_Product or ID.
	 * @return bool
	 */
	public static function is_supported_type( $product ) {
		$product = self::to_product( $product );
		return $product !== null && in_array( (string) $product->get_type(), self::supported_types(), true );
	}

	/**
	 * @param mixed $product WC_Product or ID.
	 * @return bool
	 */
	public static function is_donation_product( $product ) {
		$product = self::to_product( $product );
		if ( $product === null ) {
			return false;
		}
		$id = (int) $product->get_id();
		if ( $id > 0 && isset( self::$cache[ $id ] ) ) {
			return self::$cache[ $id ];
		}

		$result = (bool) apply_filters( 'wdp_is_donation_product', self::evaluate( $product ), $product );
		if ( $id > 0 ) {
			self::$cache[ $id ] = $result;
		}
		return $result;
	}

	/**
	 * Unfiltered decision.
	 *
	 * @param object $product WC_Product.
	 * @return bool
	 */
	public static function evaluate( $product ) {
		if ( ! self::is_supported_type( $product ) ) {
			return false;
		}
		$flag = self::product_flag( $product );
		if ( $flag === 'yes' ) {
			return true;
		}
		if ( $flag === 'no' ) {
			return false;
		}
		return self::matches_global_scope( $product );
	}

	/**
	 * Product's own choice: '' (follow global), 'yes', 'no'.
	 *
	 * @param object $product WC_Product.
	 * @return string
	 */
	public static function product_flag( $product ) {
		$raw = $product->get_meta( self::META, true );
		$raw = is_scalar( $raw ) ? strtolower( trim( (string) $raw ) ) : '';
		return in_array( $raw, array( 'yes', 'no' ), true ) ? $raw : '';
	}

	/**
	 * What the global scope decides for this product (ignores the product flag).
	 *
	 * @param object $product WC_Product.
	 * @return bool
	 */
	public static function matches_global_scope( $product ) {
		$scope = (string) WDP_Placement_Settings::value( 'donation_scope', 'all' );
		if ( $scope === 'all' ) {
			return true;
		}
		if ( $scope === 'categories' ) {
			$selected = (array) WDP_Placement_Settings::value( 'donation_categories', array() );
			return ! empty( $selected ) && self::in_categories( $product, $selected );
		}
		return false;
	}

	/**
	 * Product is in one of the categories or in one of their children.
	 *
	 * @param object $product  WC_Product.
	 * @param int[]  $selected Term IDs.
	 * @return bool
	 */
	public static function in_categories( $product, array $selected ) {
		$selected = array_map( 'absint', $selected );
		$terms    = method_exists( $product, 'get_category_ids' ) ? array_map( 'absint', (array) $product->get_category_ids() ) : array();
		foreach ( $terms as $term_id ) {
			if ( in_array( $term_id, $selected, true ) ) {
				return true;
			}
			if ( array_intersect( self::ancestors( $term_id ), $selected ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param int $term_id Term ID.
	 * @return int[]
	 */
	private static function ancestors( $term_id ) {
		if ( ! isset( self::$ancestors[ $term_id ] ) ) {
			self::$ancestors[ $term_id ] = function_exists( 'get_ancestors' )
				? array_map( 'absint', (array) get_ancestors( $term_id, 'product_cat', 'taxonomy' ) )
				: array();
		}
		return self::$ancestors[ $term_id ];
	}

	/**
	 * Published donation products currently in scope (capped scan for admin counters).
	 *
	 * @return int
	 */
	public static function count() {
		if ( ! function_exists( 'get_posts' ) ) {
			return 0;
		}
		$ids = get_posts(
			array(
				'post_type'              => 'product',
				'post_status'            => 'publish',
				'numberposts'            => 500,
				'fields'                 => 'ids',
				'suppress_filters'       => true,
				'no_found_rows'          => true,
				'update_post_meta_cache' => false,
				'update_post_term_cache' => false,
			)
		);
		$n   = 0;
		foreach ( (array) $ids as $id ) {
			if ( self::is_donation_product( (int) $id ) ) {
				++$n;
			}
		}
		return $n;
	}

	/**
	 * Clear request caches (after settings or product saves, and in tests).
	 *
	 * @param int $product_id Single product, or 0 for everything.
	 * @return void
	 */
	public static function flush( $product_id = 0 ) {
		$product_id = absint( $product_id );
		if ( $product_id > 0 ) {
			unset( self::$cache[ $product_id ] );
			return;
		}
		self::$cache     = array();
		self::$types     = null;
		self::$ancestors = array();
	}

	/**
	 * @param mixed $product WC_Product or ID.
	 * @return object|null
	 */
	private static function to_product( $product ) {
		if ( is_object( $product ) && method_exists( $product, 'get_id' ) && method_exists( $product, 'get_type' ) ) {
			return $product;
		}
		if ( is_numeric( $product ) && (int) $product > 0 && function_exists( 'wc_get_product' ) ) {
			$loaded = wc_get_product( (int) $product );
			return $loaded ? $loaded : null;
		}
		return null;
	}
}

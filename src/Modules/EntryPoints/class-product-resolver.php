<?php
/**
 * Kısa kod, blok ve widget atts'inden WooCommerce ürününü çözer (id / slug / sku / bağlam / döngü / örnek).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

defined( 'ABSPATH' ) || exit;

/**
 * Ürün çözücü.
 */
class Product_Resolver {

	/**
	 * Whether atts name a product explicitly (id, slug or sku).
	 *
	 * Explicit shortcodes skip the donation-scope check so hand-written codes keep working.
	 *
	 * @param array<string, mixed> $atts Attributes.
	 * @return bool
	 */
	public static function has_explicit_product( $atts ) {
		$atts = is_array( $atts ) ? $atts : array();
		if ( ! empty( $atts['id'] ) && absint( $atts['id'] ) > 0 ) {
			return true;
		}
		if ( ! empty( $atts['slug'] ) && sanitize_title( (string) $atts['slug'] ) !== '' ) {
			return true;
		}
		if ( ! empty( $atts['sku'] ) && trim( (string) $atts['sku'] ) !== '' ) {
			return true;
		}
		return false;
	}

	/**
	 * First match wins: id, slug, sku, block postId, global $product, is_product(), get_the_ID(), builder preview.
	 *
	 * @param array<string, mixed> $atts    Shortcode/block attributes.
	 * @param array<string, mixed> $context Block context (postId, postType).
	 * @return \WC_Product|null
	 */
	public static function resolve( $atts, $context = array() ) {
		$atts     = is_array( $atts ) ? $atts : array();
		$context  = is_array( $context ) ? $context : array();
		$resolved = null;

		$id = isset( $atts['id'] ) ? absint( $atts['id'] ) : 0;
		if ( $id > 0 ) {
			$resolved = self::as_product( $id );
		}

		if ( ! $resolved && ! empty( $atts['slug'] ) ) {
			$slug = sanitize_title( (string) $atts['slug'] );
			if ( '' !== $slug && function_exists( 'get_page_by_path' ) ) {
				$post = get_page_by_path( $slug, OBJECT, 'product' );
				if ( is_object( $post ) && ! empty( $post->ID ) ) {
					$resolved = self::as_product( (int) $post->ID );
				}
			}
		}

		if ( ! $resolved && ! empty( $atts['sku'] ) && function_exists( 'wc_get_product_id_by_sku' ) ) {
			$sku_id = (int) wc_get_product_id_by_sku( function_exists( 'wc_clean' ) ? wc_clean( (string) $atts['sku'] ) : sanitize_text_field( (string) $atts['sku'] ) );
			if ( $sku_id ) {
				$resolved = self::as_product( $sku_id );
			}
		}

		if ( ! $resolved && ! empty( $context['postId'] ) ) {
			$post_id   = absint( $context['postId'] );
			$post_type = isset( $context['postType'] ) ? (string) $context['postType'] : '';
			if ( $post_id > 0 && ( '' === $post_type || 'product' === $post_type ) ) {
				$candidate = self::as_product( $post_id );
				if ( $candidate || 'product' === $post_type ) {
					$resolved = $candidate;
				}
			}
		}

		if ( ! $resolved ) {
			$loop = isset( $GLOBALS['product'] ) ? $GLOBALS['product'] : null;
			if ( self::is_wc_product( $loop ) ) {
				$resolved = $loop;
			}
		}

		if ( ! $resolved && function_exists( 'is_product' ) && is_product() && function_exists( 'get_queried_object_id' ) ) {
			$resolved = self::as_product( (int) get_queried_object_id() );
		}

		// Custom product templates (page builders, block themes) may run without is_product()/global $product.
		if ( ! $resolved && function_exists( 'get_queried_object' ) ) {
			$resolved = self::from_post_object( get_queried_object() );
		}

		if ( ! $resolved && isset( $GLOBALS['post'] ) ) {
			$resolved = self::from_post_object( $GLOBALS['post'] );
		}

		if ( ! $resolved && function_exists( 'get_the_ID' ) ) {
			$the_id = (int) get_the_ID();
			if ( $the_id > 0 ) {
				$candidate = self::as_product( $the_id );
				if ( $candidate ) {
					$resolved = $candidate;
				}
			}
		}

		if ( ! $resolved && class_exists( 'Builder_Detect' ) ) {
			$resolved = Builder_Detect::preview_product();
		}

		/**
		 * Override the resolved product.
		 *
		 * @param \WC_Product|null $resolved Resolved product.
		 * @param array<string, mixed>           $atts     Attributes.
		 * @param array<string, mixed>           $context  Block context.
		 */
		$filtered = apply_filters( 'wdp_resolve_product', $resolved, $atts, $context ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye donuk uyumluluk sozlesmesi: eski wdp_ kanca adi degismez.
		return self::is_wc_product( $filtered ) ? $filtered : null;
	}

	/**
	 * @param mixed $product Candidate.
	 * @return bool
	 */
	public static function is_wc_product( $product ) {
		return is_object( $product ) && ( is_a( $product, 'WC_Product' ) || ( method_exists( $product, 'get_id' ) && method_exists( $product, 'get_type' ) ) );
	}

	/**
	 * Product for a WP_Post of type product (queried object / global $post); null otherwise.
	 *
	 * @param mixed $post Candidate.
	 * @return \WC_Product|null
	 */
	private static function from_post_object( $post ) {
		if ( ! is_object( $post ) || empty( $post->ID ) || ! isset( $post->post_type ) || 'product' !== (string) $post->post_type ) {
			return null;
		}
		return self::as_product( (int) $post->ID );
	}

	/**
	 * @param int $id Product ID.
	 * @return \WC_Product|null
	 */
	private static function as_product( $id ) {
		$id = absint( $id );
		if ( $id <= 0 || ! function_exists( 'wc_get_product' ) ) {
			return null;
		}
		$product = wc_get_product( $id );
		return self::is_wc_product( $product ) ? $product : null;
	}

	/**
	 * @return \WC_Product|null
	 */
	public static function current_product() {
		if ( function_exists( 'wc_get_product' ) ) {
			$id = self::current_product_id();
			if ( $id > 0 ) {
				$product = wc_get_product( $id );
				if ( self::is_wc_product( $product ) ) {
					return $product;
				}
			}
		}
		$loop = isset( $GLOBALS['product'] ) ? $GLOBALS['product'] : null;
		return self::is_wc_product( $loop ) ? $loop : null;
	}

	/**
	 * @return int
	 */
	public static function current_product_id() {
		if ( function_exists( 'get_queried_object_id' ) ) {
			return absint( get_queried_object_id() );
		}
		return function_exists( 'get_the_ID' ) ? absint( get_the_ID() ) : 0;
	}

	/**
	 * @param \WP_Block|null $instance Block instance.
	 * @return \WC_Product|null
	 */
	public static function product_from_block( $instance ) {
		$post_id = 0;
		if ( is_object( $instance ) && isset( $instance->context['postId'] ) ) {
			$post_id = absint( $instance->context['postId'] );
		}
		if ( $post_id <= 0 ) {
			$post_id = self::current_product_id();
		}
		if ( $post_id <= 0 || ! function_exists( 'wc_get_product' ) ) {
			return null;
		}
		$product = wc_get_product( $post_id );
		return self::is_wc_product( $product ) ? $product : null;
	}
}

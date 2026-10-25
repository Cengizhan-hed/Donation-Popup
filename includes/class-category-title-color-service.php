<?php
/**
 * Kategori bazlı modal başlık rengi okuma, kayıt ve inline stil.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolves title color from product categories and admin mapping.
 */
class WDP_Category_Title_Color_Service {
	const OPTION_KEY = 'wdp_category_title_colors';

	/**
	 * @return array<int,string> term_id => hex color
	 */
	public static function get_all() {
		$stored = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $stored ) ) {
			return array();
		}

		$out = array();
		foreach ( $stored as $term_id => $color ) {
			$term_id = absint( $term_id );
			$hex     = sanitize_hex_color( (string) $color );
			if ( $term_id > 0 && $hex ) {
				$out[ $term_id ] = $hex;
			}
		}

		return $out;
	}

	/**
	 * @param array $request Raw POST (category_color_enable, category_color).
	 * @return array<int,string>
	 */
	public static function normalize_from_request( array $request ) {
		$raw_colors = isset( $request['category_color'] ) && is_array( $request['category_color'] )
			? $request['category_color']
			: array();
		$raw_enable = isset( $request['category_color_enable'] ) && is_array( $request['category_color_enable'] )
			? $request['category_color_enable']
			: array();

		$out = array();
		foreach ( $raw_colors as $term_id => $color ) {
			$term_id = absint( $term_id );
			if ( $term_id <= 0 || empty( $raw_enable[ $term_id ] ) ) {
				continue;
			}
			$hex = sanitize_hex_color( wp_unslash( (string) $color ) );
			if ( $hex ) {
				$out[ $term_id ] = $hex;
			}
		}

		return $out;
	}

	/**
	 * First matching product_cat color (deepest term wins when multiple match).
	 *
	 * @param int $product_id Product ID.
	 * @return string Hex color or empty.
	 */
	public static function get_color_for_product( $product_id ) {
		$product_id = absint( $product_id );
		if ( $product_id <= 0 ) {
			return '';
		}

		$map = self::get_all();
		if ( empty( $map ) ) {
			return '';
		}

		$term_ids = wc_get_product_term_ids( $product_id, 'product_cat' );
		if ( empty( $term_ids ) || ! is_array( $term_ids ) ) {
			return '';
		}

		$best_id    = 0;
		$best_depth = -1;

		foreach ( $term_ids as $term_id ) {
			$term_id = absint( $term_id );
			if ( $term_id <= 0 || ! isset( $map[ $term_id ] ) ) {
				continue;
			}

			$depth    = 0;
			$ancestor = $term_id;
			while ( $ancestor ) {
				$term = get_term( $ancestor, 'product_cat' );
				if ( ! $term || is_wp_error( $term ) || ! $term->parent ) {
					break;
				}
				++$depth;
				$ancestor = (int) $term->parent;
			}

			if ( $depth > $best_depth ) {
				$best_depth = $depth;
				$best_id    = $term_id;
			}
		}

		return $best_id > 0 ? $map[ $best_id ] : '';
	}

	/**
	 * Inline style attribute for product title.
	 * Aynı öncelik: ürün ana rengi → kategori → genel (genelde CSS var; inline yalnız ürün/kategori).
	 *
	 * @param int $product_id Product ID.
	 * @return string Safe HTML attribute fragment (empty or style="...").
	 */
	public static function get_title_style_attr( $product_id ) {
		$product_id = absint( $product_id );
		$color      = '';
		if ( class_exists( 'WDP_Form_Modules' ) && method_exists( 'WDP_Form_Modules', 'resolve_product_shell_primary' ) ) {
			$color = WDP_Form_Modules::resolve_product_shell_primary( $product_id );
		} else {
			$raw   = (string) get_post_meta( $product_id, '_theme_primary', true );
			$color = class_exists( 'WDP_Color_Palette' )
				? WDP_Color_Palette::normalize_hex( $raw )
				: (string) ( sanitize_hex_color( $raw ) ?: '' );
			if ( $color === '' ) {
				$color = self::get_color_for_product( $product_id );
			}
		}
		if ( $color === '' ) {
			return '';
		}

		return ' style="color:' . esc_attr( $color ) . '"';
	}
}

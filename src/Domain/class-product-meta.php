<?php
/**
 * Ürün meta okuma: WP meta önbelleğinden (ek sorgu yok).
 *
 * `WC_Data::get_meta()` ürün nesnesi başına AYRI bir `read_meta_data` sorgusu açar; mağaza döngüsünde ürün sayısı
 * kadar ek sorgu demektir. Ürün/döngü sorgusu WP meta önbelleğini zaten doldurur; `get_post_meta` oradan okur.
 * Kaydedilmemiş bellek içi değişiklik varsa (`get_changes`) ürün nesnesi okunur.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * Product_Meta.
 */
class Product_Meta {

	/**
	 * Tek değer okur.
	 *
	 * @param object $product \WC_Product.
	 * @param string $key     Meta anahtarı.
	 * @return mixed Yoksa ''.
	 */
	public static function get( $product, $key ) {
		if ( ! is_object( $product ) ) {
			return '';
		}
		$id = method_exists( $product, 'get_id' ) ? (int) $product->get_id() : 0;
		if ( $id < 1 || ! function_exists( 'get_post_meta' ) ) {
			return method_exists( $product, 'get_meta' ) ? $product->get_meta( $key, true ) : '';
		}
		$value = get_post_meta( $id, (string) $key, true );
		if ( '' === $value && method_exists( $product, 'get_changes' ) && $product->get_changes() && method_exists( $product, 'get_meta' ) ) {
			$value = $product->get_meta( $key, true );
		}
		return $value;
	}
}

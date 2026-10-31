<?php
/**
 * Ek bağış satırı (AddOn): ana bağışın yanına, ayrı ürünle ve ayrı tutarla eklenen sepet satırı.
 *
 * Sepet öğesi sözleşmesi eski motorla birebir aynıdır (`wdp_sadaka_donation`, `wdp_parent_product_id`,
 * `wdp_parent_cart_item_key`, `wdp_sadaka_linked_wc_product`, `donation_data.is_addon`; eski oturumlardaki `is_sadaka` işareti `Legacy_Context::is_addon_data()` ile okunur); sepet, ödeme ve
 * sipariş kodu bu anahtarlara bakar. Tutar doğrulaması `Field_Validator` içinde yapılır; burada yalnız satır eklenir.
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce;

use DonationPanel\Domain\Addon_Settings;
use DonationPanel\Domain\Progress_Currency;

defined( 'ABSPATH' ) || exit;

/**
 * Addon_Line.
 */
final class Addon_Line {

	/**
	 * Ek bağış satırının bağış verisi: yalnız ad, telefon ve not ana bağıştan taşınır (hisseli bağışta ilk hissedar).
	 *
	 * @param array<string, mixed> $main Ana bağış verisi.
	 * @return array<string, mixed>
	 */
	public static function donation_data( array $main ) {
		$data = array( 'is_addon' => true );

		if ( ! empty( $main['share_count'] ) && ! empty( $main['shareholders'] ) && is_array( $main['shareholders'] ) ) {
			$first = reset( $main['shareholders'] );
			if ( is_array( $first ) ) {
				foreach ( array(
					'name'  => 'full_name',
					'phone' => 'phone',
				) as $from => $to ) {
					if ( ! empty( $first[ $from ] ) ) {
						$data[ $to ] = $first[ $from ];
					}
				}
			}
			return $data;
		}

		foreach ( array( 'full_name', 'phone', 'note' ) as $key ) {
			if ( ! empty( $main[ $key ] ) ) {
				$data[ $key ] = $main[ $key ];
			}
		}
		return $data;
	}

	/**
	 * Sepet öğesi verisi.
	 *
	 * @param int                  $parent_product_id Ana ürün.
	 * @param int                  $addon_product_id  Ek bağış WooCommerce ürünü.
	 * @param array<string, mixed> $main_data         Ana bağış verisi.
	 * @param float                $amount            Tutar.
	 * @param string               $submission        Gönderim anahtarı.
	 * @param string               $parent_key        Ana satırın sepet anahtarı.
	 * @return array<string, mixed>
	 */
	public static function cart_item_data( $parent_product_id, $addon_product_id, array $main_data, $amount, $submission = '', $parent_key = '' ) {
		$data = array(
			'donation_data'                => self::donation_data( $main_data ),
			'custom_price'                 => (float) $amount,
			'wdp_sadaka_donation'          => true,
			'wdp_parent_product_id'        => (int) $parent_product_id,
			'wdp_sadaka_linked_wc_product' => true,
			'unique_key'                   => md5( implode( '|', array( (int) $parent_product_id, (int) $addon_product_id, 'addon', microtime( true ), function_exists( 'wp_rand' ) ? wp_rand() : random_int( 0, PHP_INT_MAX ) ) ) ),
		);
		if ( '' !== $parent_key ) {
			$data['wdp_parent_cart_item_key'] = $parent_key;
		}
		if ( '' !== $submission ) {
			$data['unique_submission_key'] = $submission . '-addon';
		}
		return $data;
	}

	/**
	 * Ek bağış satırını sepete ekler (aynı ana satıra bağlı önceki ek satır kaldırılır).
	 *
	 * @param object               $cart       WC_Cart benzeri.
	 * @param object               $product    Ana ürün (WC_Product).
	 * @param array<string, mixed> $main_data  Ana bağış verisi.
	 * @param float                $amount     Doğrulanmış tutar.
	 * @param string               $submission Gönderim anahtarı.
	 * @param string               $parent_key Ana satırın sepet anahtarı.
	 * @return string Boşsa başarılı; doluysa hata iletisi.
	 */
	public static function add( $cart, $product, array $main_data, $amount, $submission, $parent_key ) {
		$parent_id = (int) $product->get_id();
		$addon_id  = (int) Addon_Settings::resolve_addon_wc_product_id( $product );
		if ( $addon_id <= 0 ) {
			return __( 'Add-on donation WooCommerce product was not found. Enter a valid product ID in Success & Mini Cart or the product settings.', 'woo-donation-popup' );
		}

		foreach ( $cart->get_cart() as $existing_key => $existing ) {
			if ( ! empty( $existing['wdp_sadaka_donation'] ) && isset( $existing['wdp_parent_cart_item_key'] ) && $existing['wdp_parent_cart_item_key'] === $parent_key ) {
				$cart->remove_cart_item( $existing_key );
			}
		}

		$item = self::cart_item_data( $parent_id, $addon_id, $main_data, $amount, $submission, $parent_key );
		// Ek satırın tutarı da bağışçının yazdığı birimdedir (etkin birim); ana satırla aynı damga.
		$active = Progress_Currency::get_active_currency();
		if ( '' !== $active ) {
			$item['wdp_input_currency'] = $active;
		}
		$allow = static function ( $purchasable, $check ) use ( $addon_id ) {
			return ( ! $purchasable && is_object( $check ) && method_exists( $check, 'get_id' ) && (int) $check->get_id() === $addon_id ) ? true : $purchasable;
		};
		add_filter( 'woocommerce_is_purchasable', $allow, 99, 2 );
		$key = $cart->add_to_cart( $addon_id, 1, 0, array(), $item );
		remove_filter( 'woocommerce_is_purchasable', $allow, 99 );

		if ( ! $key ) {
			/* translators: %d: WooCommerce product ID. */
			return sprintf( __( 'The add-on donation could not be added to the cart (product #%d). Make sure the product is published.', 'woo-donation-popup' ), $addon_id );
		}
		if ( method_exists( $cart, 'calculate_totals' ) ) {
			$cart->calculate_totals();
		}
		return '';
	}
}

<?php
/**
 * Yan sepet satır modeli: sepet öğesinden (eski `donation_data` sözleşmesi) gösterim verisi üretir.
 *
 * Saf mantık kısmı (WooCommerce çağrısı yok) birim testlenir; WooCommerce okuması `from_cart` içindedir.
 * Bağışçının kendi yazdığı ithaf ve hissedar adları yalnız o bağışçının oturumundaki sepet çıktısında görünür.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\SideCart;

defined( 'ABSPATH' ) || exit;

/**
 * Side_Cart_Lines.
 */
final class Side_Cart_Lines {

	/**
	 * Hissedar adı üst sınırı (gösterim).
	 */
	const SHARE_NAMES_MAX = 20;

	/**
	 * Bağış verisinden saf gösterim alanlarını çıkarır.
	 *
	 * @param array<string, mixed> $cart_item Sepet öğesi (`donation_data`, `donation_panel_type`, `custom_price`).
	 * @return array{type: string, dedication: string, share_names: string[], share_count: int, anonymous: bool, is_donation: bool}
	 */
	public static function describe( array $cart_item ) {
		$data = isset( $cart_item['donation_data'] ) && is_array( $cart_item['donation_data'] ) ? $cart_item['donation_data'] : array();

		$names = array();
		if ( isset( $data['shareholders'] ) && is_array( $data['shareholders'] ) ) {
			foreach ( $data['shareholders'] as $shareholder ) {
				$name = '';
				if ( is_array( $shareholder ) ) {
					$name = isset( $shareholder['name'] ) && is_scalar( $shareholder['name'] ) ? (string) $shareholder['name'] : '';
				} elseif ( is_scalar( $shareholder ) ) {
					$name = (string) $shareholder;
				}
				$name = trim( $name );
				if ( '' !== $name ) {
					$names[] = $name;
				}
				if ( count( $names ) >= self::SHARE_NAMES_MAX ) {
					break;
				}
			}
		}

		return array(
			'type'        => isset( $cart_item['donation_panel_type'] ) && is_scalar( $cart_item['donation_panel_type'] ) ? sanitize_key( (string) $cart_item['donation_panel_type'] ) : '',
			'dedication'  => isset( $data['dedication'] ) && is_scalar( $data['dedication'] ) ? trim( (string) $data['dedication'] ) : '',
			'share_names' => $names,
			'share_count' => isset( $data['share_count'] ) ? (int) $data['share_count'] : 0,
			'anonymous'   => ! empty( $data['anonymous'] ),
			'is_donation' => ! empty( $data ) || isset( $cart_item['custom_price'] ),
		);
	}

	/**
	 * Miktar değiştirilebilir mi: hisse bağışlarında ve bağış olmayan satırlarda hayır.
	 *
	 * @param array<string, mixed> $described `describe` çıktısı.
	 * @param bool                 $sold_individually Ürün tek adetle mi satılıyor.
	 * @return bool
	 */
	public static function can_change_quantity( array $described, $sold_individually ) {
		if ( $sold_individually ) {
			return false;
		}
		return empty( $described['share_count'] ) && empty( $described['share_names'] );
	}

	/**
	 * Sepeti satır modeline çevirir (WooCommerce gerekir).
	 *
	 * @param object $cart WC_Cart benzeri (get_cart).
	 * @return array<int, array<string, mixed>>
	 */
	public static function from_cart( $cart ) {
		$lines = array();
		if ( ! is_object( $cart ) || ! method_exists( $cart, 'get_cart' ) ) {
			return $lines;
		}
		foreach ( (array) $cart->get_cart() as $key => $item ) {
			if ( ! is_array( $item ) || empty( $item['data'] ) || ! is_object( $item['data'] ) ) {
				continue;
			}
			$product   = $item['data'];
			$described = self::describe( $item );
			$qty       = isset( $item['quantity'] ) ? max( 1, (int) $item['quantity'] ) : 1;
			$image     = '';
			if ( method_exists( $product, 'get_image_id' ) && $product->get_image_id() && function_exists( 'wp_get_attachment_image_url' ) ) {
				$image = (string) wp_get_attachment_image_url( (int) $product->get_image_id(), 'thumbnail' );
			}
			// WooCommerce'in standart sepet satırı filtreleri (mini sepetle aynı): çoklu para birimi eklentileri ve bağış fiyatı bunlara bağlanır.
			$unit_price = '';
			$line_total = '';
			if ( function_exists( 'wc_price' ) && method_exists( $cart, 'get_product_price' ) && method_exists( $cart, 'get_product_subtotal' ) ) {
				$unit_price = (string) apply_filters( 'woocommerce_cart_item_price', $cart->get_product_price( $product ), $item, $key ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WooCommerce standart filtresi.
				$line_total = (string) apply_filters( 'woocommerce_cart_item_subtotal', $cart->get_product_subtotal( $product, $qty ), $item, $key ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WooCommerce standart filtresi.
			}

			$lines[] = array_merge(
				$described,
				array(
					'key'          => (string) $key,
					'name'         => method_exists( $product, 'get_name' ) ? (string) $product->get_name() : '',
					'quantity'     => $qty,
					'image'        => $image,
					'unit_html'    => $unit_price,
					'total_html'   => $line_total,
					'can_quantity' => self::can_change_quantity( $described, method_exists( $product, 'is_sold_individually' ) && $product->is_sold_individually() ),
				)
			);
		}
		return $lines;
	}
}

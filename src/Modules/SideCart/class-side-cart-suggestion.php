<?php
/**
 * Yan sepet "Bağışınıza eklemek ister misiniz?" önerisi: küçük tutar kartları (tek dokunuşla eklenir).
 *
 * Öneri varsayılan olarak YOKTUR; site `donation_panel_side_cart_suggestion` filtresiyle tanımlar
 * (`product_id`, `amounts`, isteğe bağlı `title`, `hint`). Ekleme, formun kullandığı `cart/add` ucundan geçer
 * (sunucuda doğrulanır); burada yalnız gösterim verisi temizlenir (saf mantık).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\SideCart;

defined( 'ABSPATH' ) || exit;

/**
 * Side_Cart_Suggestion.
 */
final class Side_Cart_Suggestion {

	/**
	 * En çok gösterilecek tutar kartı.
	 */
	const MAX_AMOUNTS = 3;

	/**
	 * Ham öneriyi gösterim verisine çevirir; geçersizse boş dizi.
	 *
	 * @param mixed $raw `product_id`, `amounts` (sayı listesi), `title`, `hint`.
	 * @return array{product_id: int, amounts: float[], title: string, hint: string}|array{}
	 */
	public static function sanitize( $raw ) {
		if ( ! is_array( $raw ) ) {
			return array();
		}
		$product_id = isset( $raw['product_id'] ) ? absint( $raw['product_id'] ) : 0;
		$amounts    = array();
		foreach ( isset( $raw['amounts'] ) && is_array( $raw['amounts'] ) ? $raw['amounts'] : array() as $amount ) {
			$value = is_numeric( $amount ) ? round( (float) $amount, 6 ) : 0.0;
			if ( $value > 0 && ! in_array( $value, $amounts, true ) ) {
				$amounts[] = $value;
			}
			if ( count( $amounts ) >= self::MAX_AMOUNTS ) {
				break;
			}
		}
		if ( $product_id < 1 || ! $amounts ) {
			return array();
		}
		return array(
			'product_id' => $product_id,
			'amounts'    => $amounts,
			'title'      => isset( $raw['title'] ) && is_scalar( $raw['title'] ) ? wp_strip_all_tags( (string) $raw['title'] ) : '',
			'hint'       => isset( $raw['hint'] ) && is_scalar( $raw['hint'] ) ? wp_strip_all_tags( (string) $raw['hint'] ) : '',
		);
	}

	/**
	 * Şu anki öneri (filtre sonucu temizlenir; ürün yayımlanmamışsa ya da sepette zaten varsa yok).
	 *
	 * @param array<int, array<string, mixed>> $lines Sepet satırları (`product_id` anahtarı).
	 * @return array{product_id: int, amounts: float[], title: string, hint: string}|array{}
	 */
	public static function current( array $lines ) {
		/**
		 * Yan sepetteki ek bağış önerisi. Varsayılan: öneri yok.
		 *
		 * @param array<string, mixed> $suggestion `product_id`, `amounts`, `title`, `hint`.
		 */
		$suggestion = self::sanitize( apply_filters( 'donation_panel_side_cart_suggestion', array() ) );
		if ( ! $suggestion ) {
			return array();
		}
		foreach ( $lines as $line ) {
			if ( isset( $line['product_id'] ) && (int) $line['product_id'] === $suggestion['product_id'] ) {
				return array();
			}
		}
		if ( function_exists( 'get_post_status' ) && 'publish' !== get_post_status( $suggestion['product_id'] ) ) {
			return array();
		}
		if ( '' === $suggestion['title'] && function_exists( 'get_the_title' ) ) {
			$suggestion['title'] = wp_strip_all_tags( (string) get_the_title( $suggestion['product_id'] ) );
		}
		return $suggestion;
	}
}

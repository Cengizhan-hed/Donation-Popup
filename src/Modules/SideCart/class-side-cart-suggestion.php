<?php
/**
 * Yan sepet "Bağışınıza eklemek ister misiniz?" önerisi: küçük tutar kartları (tek dokunuşla eklenir).
 *
 * Öneri varsayılan olarak YOKTUR. Yönetici Sepet ve Ödeme → Yan sepet bölümünde açar (`side_cart.suggest`,
 * `suggest_product` (0 = ek bağış ürünü `checkout.addon_product_id`), `suggest_amounts`, `suggest_hint`); geliştirici
 * `donation_panel_side_cart_suggestion` filtresiyle değiştirebilir (`product_id`, `amounts`, `title`, `hint`).
 * Ekleme, formun kullandığı `cart/add` ucundan geçer (sunucuda doğrulanır); burada yalnız gösterim verisi temizlenir.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\SideCart;

use DonationPanel\Core\Settings;

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
	 * Yönetici ayarından ham öneri (ayar kapalıysa boş dizi). Ürün 0 ise ek bağış ürünü kullanılır.
	 *
	 * @param Settings|object $settings `get( $path, $default )` sunan ayar nesnesi.
	 * @return array<string, mixed>
	 */
	public static function from_settings( $settings ) {
		if ( ! is_object( $settings ) || ! method_exists( $settings, 'get' ) || ! $settings->get( 'side_cart.suggest', false ) ) {
			return array();
		}
		$product = absint( $settings->get( 'side_cart.suggest_product', 0 ) );
		if ( $product < 1 ) {
			$product = absint( $settings->get( 'checkout.addon_product_id', 0 ) );
		}
		return array(
			'product_id' => $product,
			'amounts'    => array_map( 'trim', explode( ',', (string) $settings->get( 'side_cart.suggest_amounts', '' ) ) ),
			'title'      => '',
			'hint'       => (string) $settings->get( 'side_cart.suggest_hint', '' ),
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
		 * Yan sepetteki ek bağış önerisi. Varsayılan: yönetici ayarı (kapalıysa öneri yok).
		 *
		 * @param array<string, mixed> $suggestion `product_id`, `amounts`, `title`, `hint`.
		 */
		$suggestion = self::sanitize( apply_filters( 'donation_panel_side_cart_suggestion', self::from_settings( new Settings() ) ) );
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

	/**
	 * Sepetteki ilk bağış satırından bağışçı bilgisini (ad, telefon, e-posta) devralır; hisseli satırda ilk hissedar kullanılır.
	 *
	 * @param array<int|string, mixed> $cart_items WooCommerce sepet öğeleri.
	 * @return array<string, string> `donation_full_name`, `donation_phone`, `donation_email` (bulunanlar).
	 */
	public static function donor_from_cart( array $cart_items ) {
		foreach ( $cart_items as $item ) {
			$data = is_array( $item ) && isset( $item['donation_data'] ) && is_array( $item['donation_data'] ) ? $item['donation_data'] : array();
			$name = isset( $data['full_name'] ) && is_scalar( $data['full_name'] ) ? (string) $data['full_name'] : '';
			$tel  = isset( $data['phone'] ) && is_scalar( $data['phone'] ) ? (string) $data['phone'] : '';
			$mail = isset( $data['email'] ) && is_scalar( $data['email'] ) ? (string) $data['email'] : '';
			if ( ( '' === $name || '' === $tel ) && isset( $data['shareholders'] ) && is_array( $data['shareholders'] ) ) {
				$first = reset( $data['shareholders'] );
				if ( is_array( $first ) ) {
					$name = '' !== $name ? $name : ( isset( $first['name'] ) && is_scalar( $first['name'] ) ? (string) $first['name'] : '' );
					$tel  = '' !== $tel ? $tel : ( isset( $first['phone'] ) && is_scalar( $first['phone'] ) ? (string) $first['phone'] : '' );
					$mail = '' !== $mail ? $mail : ( isset( $first['email'] ) && is_scalar( $first['email'] ) ? (string) $first['email'] : '' );
				}
			}
			if ( '' !== $name && '' !== $tel ) {
				return array_filter(
					array(
						'donation_full_name' => $name,
						'donation_phone'     => $tel,
						'donation_email'     => $mail,
					),
					static function ( $value ) {
						return '' !== (string) $value;
					}
				);
			}
		}
		return array();
	}
}

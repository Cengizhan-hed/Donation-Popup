<?php
/**
 * Bağış sepet verisi: form girdisini eski sepet öğesi sözleşmesine (`donation_data`, `custom_price`) çevirir.
 *
 * Saf mantık (WooCommerce çağrısı yok): alan temizleme, model dışı alanı yok sayma, kişi verisiz özet.
 * Çok baytlı güvenli: Türkçe karakterler bölünmez/bozulmaz.
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce;

defined( 'ABSPATH' ) || exit;

/**
 * Cart_Data.
 */
final class Cart_Data {

	const NAME_MAX       = 100;
	const EMAIL_MAX      = 100;
	const DEDICATION_MAX = 120;
	const NOTE_MAX       = 500;
	const PHONE_MAX      = 28;

	/**
	 * Girdiden eski `donation_data` yapısını üretir. Yalnız modelde tanımlı alanlar alınır
	 * (kapalı e-posta/ithaf/anonim alanı yok sayılır).
	 *
	 * @param array<string, mixed> $model Form modeli.
	 * @param array<string, mixed> $input İstek girdisi.
	 * @return array<string, string>
	 */
	public static function donation_data( array $model, array $input ) {
		if ( isset( $model['kind'] ) && 'shares' === $model['kind'] ) {
			return self::share_data( $model, $input );
		}
		$allowed = array();
		$fields  = isset( $model['fields'] ) && is_array( $model['fields'] ) ? $model['fields'] : array();
		foreach ( $fields as $field ) {
			if ( is_array( $field ) && ! empty( $field['name'] ) ) {
				$allowed[ (string) $field['name'] ] = true;
			}
		}

		$data = array();
		if ( isset( $allowed['donation_full_name'] ) ) {
			$value = self::text( self::raw( $input, 'donation_full_name' ), self::NAME_MAX );
			if ( '' !== $value ) {
				$data['full_name'] = $value;
			}
		}
		if ( isset( $allowed['donation_phone'] ) ) {
			$value = self::phone( self::raw( $input, 'donation_phone' ) );
			if ( '' !== $value ) {
				$data['phone'] = $value;
			}
		}
		if ( isset( $allowed['donation_note'] ) ) {
			$value = self::textarea( self::raw( $input, 'donation_note' ), self::NOTE_MAX );
			if ( '' !== $value ) {
				$data['note'] = $value;
			}
		}
		if ( isset( $allowed['donation_email'] ) ) {
			$value = self::limit( trim( self::raw( $input, 'donation_email' ) ), self::EMAIL_MAX );
			$value = '' !== $value ? sanitize_email( $value ) : '';
			if ( '' !== $value && is_email( $value ) ) {
				$data['email'] = $value;
			}
		}
		if ( isset( $allowed['donation_dedication'] ) ) {
			$value = self::text( self::raw( $input, 'donation_dedication' ), self::DEDICATION_MAX );
			if ( '' !== $value ) {
				$data['dedication'] = $value;
			}
		}
		if ( isset( $allowed['donation_anonymous'] ) && ! empty( $input['donation_anonymous'] ) ) {
			$data['anonymous'] = '1';
		}

		return $data;
	}

	/**
	 * Hisseli bağış verisi: eski sözleşmeyle aynı (`share_count`, 1 tabanlı `shareholders[n]` = ad/telefon/e-posta/not).
	 * Bağışçının kendi alanları (ad, telefon...) bu türde yoktur; her hissedar satırı eksiksiz taşınır.
	 *
	 * @param array<string, mixed> $model Form modeli.
	 * @param array<string, mixed> $input İstek girdisi (`share_count`, `shareholders`: liste).
	 * @return array<string, mixed>
	 */
	public static function share_data( array $model, array $input ) {
		$rule  = isset( $model['quantity'] ) && is_array( $model['quantity'] ) ? $model['quantity'] : array();
		$max   = isset( $rule['max'] ) ? max( 1, (int) $rule['max'] ) : 1;
		$count = isset( $input['share_count'] ) && is_scalar( $input['share_count'] ) ? (int) $input['share_count'] : 1;
		$count = min( $max, max( 1, $count ) );
		$rows  = isset( $input['shareholders'] ) && is_array( $input['shareholders'] ) ? array_values( $input['shareholders'] ) : array();

		$holders = array();
		for ( $n = 1; $n <= $count; $n++ ) {
			$row    = isset( $rows[ $n - 1 ] ) && is_array( $rows[ $n - 1 ] ) ? $rows[ $n - 1 ] : array();
			$holder = array();
			$name   = self::text( self::raw( $row, 'name' ), self::NAME_MAX );
			$phone  = self::phone( self::raw( $row, 'phone' ) );
			$email  = self::limit( trim( self::raw( $row, 'email' ) ), self::EMAIL_MAX );
			$email  = '' !== $email ? sanitize_email( $email ) : '';
			$note   = self::textarea( self::raw( $row, 'note' ), self::NOTE_MAX );
			if ( '' !== $name ) {
				$holder['name'] = $name;
			}
			if ( '' !== $phone ) {
				$holder['phone'] = $phone;
			}
			if ( '' !== $email && is_email( $email ) ) {
				$holder['email'] = $email;
			}
			if ( '' !== $note ) {
				$holder['note'] = $note;
			}
			if ( $holder ) {
				$holders[ $n ] = $holder;
			}
		}

		$data = array( 'share_count' => $count );
		if ( $holders ) {
			$data['shareholders'] = $holders;
		}
		return $data;
	}

	/**
	 * İşlem ücreti uygulanmış birim tutar (WooCommerce ondalık hane sayısıyla yuvarlanır).
	 *
	 * @param float $amount   Birim tutar.
	 * @param float $percent  Ücret yüzdesi (0 = yok).
	 * @param int   $decimals Ondalık hane.
	 * @return float
	 */
	public static function with_fee( $amount, $percent, $decimals ) {
		$amount  = (float) $amount;
		$percent = (float) $percent;
		if ( $percent <= 0 || $amount <= 0 ) {
			return $amount;
		}
		return round( $amount * ( 1 + ( $percent / 100 ) ), max( 0, (int) $decimals ) );
	}

	/**
	 * Sepet öğesi verisi (eski sözleşmeyle aynı anahtarlar).
	 *
	 * @param array<string, string> $donation_data Bağış verisi.
	 * @param float|null            $custom_price  Yazılan tutar (yalnız serbest tutarlı üründe).
	 * @param int                   $product_id    Ürün.
	 * @param string                $submission    İstemci gönderim anahtarı (çift gönderim koruması).
	 * @param string                $type          Düzenli bağış seçeneği (boş olabilir).
	 * @param array<string, mixed>  $extra         Ek sepet öğesi anahtarları (ör. `donation_panel_kind`, `wdp_base_unit_price`).
	 * @return array<string, mixed>
	 */
	public static function cart_item_data( array $donation_data, $custom_price, $product_id, $submission = '', $type = '', array $extra = array() ) {
		$item = array(
			'donation_data' => $donation_data,
			'unique_key'    => md5( implode( '|', array( (int) $product_id, 'main', microtime( true ), self::nonce_part() ) ) ),
		);
		if ( null !== $custom_price && $custom_price > 0 ) {
			$item['custom_price'] = (float) $custom_price;
		}
		$submission = self::text( $submission, 100 );
		if ( '' !== $submission ) {
			$item['unique_submission_key'] = $submission;
		}
		$type = sanitize_key( (string) $type );
		if ( '' !== $type ) {
			$item['donation_panel_type'] = $type;
		}
		return array_merge( $item, $extra );
	}

	/**
	 * İki bağış verisi aynı bağışçıya mı ait (yinelenen satırı değiştirmek için).
	 *
	 * @param array<string, mixed> $a Birinci.
	 * @param array<string, mixed> $b İkinci.
	 * @return bool
	 */
	public static function same_donor( array $a, array $b ) {
		if ( ! empty( $a['is_sadaka'] ) || ! empty( $b['is_sadaka'] ) || isset( $a['share_count'] ) || isset( $b['share_count'] ) ) {
			return false;
		}
		// Kimliği belirleyen alan yoksa (ad/telefon alanları kapalı) "aynı bağışçı" denemez: hiçbir satır ezilmez.
		if ( ( ! isset( $a['full_name'] ) || '' === $a['full_name'] ) && ( ! isset( $a['phone'] ) || '' === $a['phone'] ) ) {
			return false;
		}
		// Yalnız TÜM bağışçı alanları (ad, telefon, e-posta, ithaf, not, anonim, ücret) aynıysa aynı bağış sayılır;
		// biri bile farklıysa ikinci bağış ayrı satırdır (veri kaybı yok).
		$keys = array_unique( array_merge( array_keys( $a ), array_keys( $b ) ) );
		foreach ( $keys as $key ) {
			if ( ( isset( $a[ $key ] ) ? $a[ $key ] : '' ) !== ( isset( $b[ $key ] ) ? $b[ $key ] : '' ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Store API'ye açılan kişi verisiz özet (ad, telefon, e-posta, ithaf metni YOK).
	 *
	 * @param array<string, mixed> $cart_item Sepet öğesi.
	 * @return array<string, mixed>
	 */
	public static function public_summary( array $cart_item ) {
		$data = isset( $cart_item['donation_data'] ) && is_array( $cart_item['donation_data'] ) ? $cart_item['donation_data'] : array();
		return array(
			'is_donation'    => ! empty( $data ) || isset( $cart_item['custom_price'] ),
			'anonymous'      => ! empty( $data['anonymous'] ),
			'has_dedication' => ! empty( $data['dedication'] ),
			'has_note'       => isset( $data['note'] ) && '' !== $data['note'],
			'type'           => isset( $cart_item['donation_panel_type'] ) ? (string) $cart_item['donation_panel_type'] : '',
			'kind'           => isset( $cart_item['donation_panel_kind'] ) ? (string) $cart_item['donation_panel_kind'] : '',
		);
	}

	/**
	 * Store API güncellemesi: yalnız ithaf, not ve anonim değişebilir; çok baytlı güvenli kırpma.
	 *
	 * @param array<string, string> $current Mevcut bağış verisi.
	 * @param array<string, mixed>  $update  Gelen alanlar (`dedication`, `note`, `anonymous`).
	 * @return array<string, string>
	 */
	public static function apply_update( array $current, array $update ) {
		if ( array_key_exists( 'dedication', $update ) ) {
			self::set_or_unset( $current, 'dedication', self::text( self::scalar( $update['dedication'] ), self::DEDICATION_MAX ) );
		}
		if ( array_key_exists( 'note', $update ) ) {
			self::set_or_unset( $current, 'note', self::textarea( self::scalar( $update['note'] ), self::NOTE_MAX ) );
		}
		if ( array_key_exists( 'anonymous', $update ) ) {
			self::set_or_unset( $current, 'anonymous', ! empty( $update['anonymous'] ) && 'false' !== $update['anonymous'] ? '1' : '' );
		}
		return $current;
	}

	/**
	 * Değeri yazar ya da boşsa siler.
	 *
	 * @param array<string, string> $data  Veri (referans).
	 * @param string                $key   Anahtar.
	 * @param string                $value Değer.
	 * @return void
	 */
	private static function set_or_unset( array &$data, $key, $value ) {
		if ( '' === $value ) {
			unset( $data[ $key ] );
			return;
		}
		$data[ $key ] = $value;
	}

	/**
	 * Girdiden metin alır.
	 *
	 * @param array<string, mixed> $input Girdi.
	 * @param string               $key   Anahtar.
	 * @return string
	 */
	private static function raw( array $input, $key ) {
		return isset( $input[ $key ] ) ? self::scalar( $input[ $key ] ) : '';
	}

	/**
	 * Skaler değeri metne çevirir; dizi/nesne boş döner.
	 *
	 * @param mixed $value Değer.
	 * @return string
	 */
	private static function scalar( $value ) {
		return is_scalar( $value ) ? (string) $value : '';
	}

	/**
	 * Tek satır metin.
	 *
	 * @param string $value Değer.
	 * @param int    $max   En çok karakter.
	 * @return string
	 */
	public static function text( $value, $max ) {
		return trim( self::limit( sanitize_text_field( (string) $value ), $max ) );
	}

	/**
	 * Çok satırlı metin.
	 *
	 * @param string $value Değer.
	 * @param int    $max   En çok karakter.
	 * @return string
	 */
	public static function textarea( $value, $max ) {
		return trim( self::limit( sanitize_textarea_field( (string) $value ), $max ) );
	}

	/**
	 * Telefon (eski kuralla aynı: rakam, +, boşluk, tire, parantez).
	 *
	 * @param string $value Değer.
	 * @return string
	 */
	public static function phone( $value ) {
		$value = preg_replace( '/[^0-9+\s\-()]/', '', (string) $value );
		$value = sanitize_text_field( (string) $value );
		return trim( self::limit( $value, self::PHONE_MAX ) );
	}

	/**
	 * Karakter (bayt değil) sayısına göre kırpar.
	 *
	 * @param string $value Değer.
	 * @param int    $max   En çok karakter.
	 * @return string
	 */
	private static function limit( $value, $max ) {
		$value = (string) $value;
		if ( $max > 0 && function_exists( 'mb_strlen' ) && function_exists( 'mb_substr' ) && mb_strlen( $value, 'UTF-8' ) > $max ) {
			return mb_substr( $value, 0, $max, 'UTF-8' );
		}
		return $value;
	}

	/**
	 * Benzersizlik için rastgele parça.
	 *
	 * @return int
	 */
	private static function nonce_part() {
		return function_exists( 'wp_rand' ) ? (int) wp_rand() : random_int( 0, PHP_INT_MAX );
	}
}

<?php
/**
 * Alan doğrulama: form modeline göre yalnız hata iletileri ve normalize tutar döndürür.
 *
 * Girilen kişi verisi yanıta geri yazılmaz; Türkçe karakterler çok baytlı güvenli sayılır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Experiences;

defined( 'ABSPATH' ) || exit;

/**
 * Field_Validator.
 */
final class Field_Validator {

	/**
	 * Tutar metnini sayıya çevirir (boşluk, ₺/£ gibi simge ve binlik ayırıcı toleranslı; geçersizse null).
	 *
	 * Tek ayırıcı ve ardında 1-2 hane varsa ondalık, aksi halde binlik sayılır.
	 *
	 * @param mixed $raw Ham metin.
	 * @return float|null
	 */
	public static function parse_amount( $raw ) {
		$text = preg_replace( '/[^\d.,]/u', '', trim( (string) $raw ) );
		if ( null === $text || '' === $text || ! preg_match( '/\d/', $text ) ) {
			return null;
		}

		$last = max( (int) strrpos( $text, '.' ), (int) strrpos( $text, ',' ) );
		if ( $last > 0 && preg_match( '/^\d{1,2}$/', substr( $text, $last + 1 ) ) ) {
			$integer  = preg_replace( '/\D/', '', substr( $text, 0, $last ) );
			$fraction = substr( $text, $last + 1 );
			$number   = $integer . '.' . $fraction;
		} else {
			$number = preg_replace( '/\D/', '', $text );
		}

		return is_numeric( $number ) ? (float) $number : null;
	}

	/**
	 * Girdiyi doğrular.
	 *
	 * Tutar türe göre belirlenir: sabit tutar ve hisseli bağışta tutar sunucuda `birim fiyat x adet` olarak hesaplanır
	 * (istemci tutarı yok sayılır); bağışçı belirleyen ve hedefli kampanyada yazılan tutar doğrulanır.
	 *
	 * @param array<string, mixed> $model Form modeli.
	 * @param array<string, mixed> $input İstek verisi (alan adı => değer).
	 * @return array{valid: bool, errors: array<string, string>, amount: float|null, quantity: int, addon: array{active: bool, amount: float|null}}
	 */
	public static function validate( array $model, array $input ) {
		$errors   = array();
		$kind     = isset( $model['kind'] ) ? (string) $model['kind'] : '';
		$quantity = 1;

		if ( in_array( $kind, array( 'fixed', 'shares' ), true ) ) {
			$amount = self::derived_amount( $model, $input, $kind, $errors, $quantity );
		} else {
			$amount = self::typed_amount( $model, $input, $errors );
		}

		if ( 'shares' === $kind ) {
			self::validate_shareholders( $model, $input, $quantity, $errors );
		}
		$addon = self::validate_addon( $model, $input, $errors );

		$fields = isset( $model['fields'] ) && is_array( $model['fields'] ) ? $model['fields'] : array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) || empty( $field['name'] ) || 'checkbox' === ( isset( $field['type'] ) ? (string) $field['type'] : 'text' ) ) {
				continue;
			}
			$name  = (string) $field['name'];
			$value = isset( $input[ $name ] ) && is_scalar( $input[ $name ] ) ? trim( (string) $input[ $name ] ) : '';
			$error = self::field_error( $field, $value );
			if ( '' !== $error ) {
				$errors[ $name ] = $error;
			}
		}

		$type_field = isset( $model['types'] ) && is_array( $model['types'] ) ? $model['types'] : array();
		if ( $type_field ) {
			$allowed = array_column( $type_field, 'value' );
			$chosen  = isset( $input['donation_type'] ) && is_scalar( $input['donation_type'] ) ? sanitize_key( (string) $input['donation_type'] ) : '';
			if ( '' !== $chosen && ! in_array( $chosen, $allowed, true ) ) {
				$errors['donation_type'] = __( 'Please choose a donation type.', 'woo-donation-popup' );
			}
		}

		return array(
			'valid'    => empty( $errors ),
			'errors'   => $errors,
			'amount'   => $amount,
			'quantity' => $quantity,
			'addon'    => $addon,
		);
	}

	/**
	 * Sabit tutar / hisseli: tutar = birim fiyat x adet (adet sınırlarda doğrulanır).
	 *
	 * @param array<string, mixed>  $model    Model.
	 * @param array<string, mixed>  $input    Girdi.
	 * @param array<string, string> $errors   Hatalar (referans).
	 * @param int                   $quantity Adet (referans).
	 * @param string                $kind     Tür.
	 * @return float|null
	 */
	private static function derived_amount( array $model, array $input, $kind, array &$errors, &$quantity ) {
		$unit = isset( $model['unit_price'] ) ? (float) $model['unit_price'] : 0.0;
		$rule = isset( $model['quantity'] ) && is_array( $model['quantity'] ) ? $model['quantity'] : array();
		$max  = isset( $rule['max'] ) ? max( 1, (int) $rule['max'] ) : 1;
		$key  = 'shares' === $kind ? 'share_count' : 'quantity';
		$raw  = 'shares' === $kind ? ( isset( $input['share_count'] ) ? $input['share_count'] : '' ) : ( isset( $input['quantity'] ) ? $input['quantity'] : '' );
		$want = ( is_scalar( $raw ) && '' !== (string) $raw ) ? (string) $raw : '1';

		if ( 'fixed' === $kind && empty( $rule['enabled'] ) ) {
			$quantity = 1;
		} elseif ( ! ctype_digit( $want ) || (int) $want < 1 || (int) $want > $max ) {
			/* translators: %d: maximum quantity or share count. */
			$errors[ $key ] = sprintf( __( 'Please choose a number between 1 and %d.', 'woo-donation-popup' ), $max );
			$quantity       = 1;
		} else {
			$quantity = (int) $want;
		}

		if ( $unit <= 0 ) {
			$errors['amount'] = __( 'Please enter a donation amount.', 'woo-donation-popup' );
			return null;
		}
		return $unit * $quantity;
	}

	/**
	 * Bağışçının yazdığı/seçtiği tutarı doğrular.
	 *
	 * @param array<string, mixed>  $model  Model.
	 * @param array<string, mixed>  $input  Girdi.
	 * @param array<string, string> $errors Hatalar (referans).
	 * @return float|null
	 */
	private static function typed_amount( array $model, array $input, array &$errors ) {
		$amount = self::parse_amount( isset( $input['amount'] ) ? $input['amount'] : '' );
		$min    = isset( $model['min'] ) ? (float) $model['min'] : 0.0;
		$limit  = max( $min, 0.01 );
		if ( null === $amount || $amount <= 0 ) {
			$errors['amount'] = __( 'Please enter a donation amount.', 'woo-donation-popup' );
			return null;
		}
		if ( $amount < $limit ) {
			/* translators: %s: minimum amount. */
			$errors['amount'] = sprintf( __( 'Minimum amount is %s.', 'woo-donation-popup' ), self::format_number( $limit ) );
		} elseif ( $amount > 99999999 ) {
			$errors['amount'] = __( 'Please enter a donation amount.', 'woo-donation-popup' );
		} else {
			$decimals = isset( $model['decimals'] ) ? (int) $model['decimals'] : 2;
			if ( $decimals < 2 && abs( $amount - round( $amount, $decimals ) ) > 0.000001 ) {
				/* translators: %s: example whole amount. */
				$errors['amount'] = sprintf( __( 'Fractional amounts are not allowed on this site, e.g. %s', 'woo-donation-popup' ), (string) (int) round( $amount ) );
			}
		}
		return $amount;
	}

	/**
	 * Hissedar satırları: her hisse için ad + telefon zorunlu; e-posta/not sınırlı.
	 * Hata anahtarı `shareholder_{n}_{alan}` (1 tabanlı).
	 *
	 * @param array<string, mixed>  $model  Model.
	 * @param array<string, mixed>  $input  Girdi (`shareholders`: liste).
	 * @param int                   $count  Hisse sayısı.
	 * @param array<string, string> $errors Hatalar (referans).
	 * @return void
	 */
	private static function validate_shareholders( array $model, array $input, $count, array &$errors ) {
		$holders = isset( $input['shareholders'] ) && is_array( $input['shareholders'] ) ? array_values( $input['shareholders'] ) : array();
		$defs    = isset( $model['shareholder'] ) && is_array( $model['shareholder'] ) ? $model['shareholder'] : array();
		for ( $n = 1; $n <= $count; $n++ ) {
			$row = isset( $holders[ $n - 1 ] ) && is_array( $holders[ $n - 1 ] ) ? $holders[ $n - 1 ] : array();
			foreach ( $defs as $def ) {
				if ( ! is_array( $def ) || empty( $def['key'] ) ) {
					continue;
				}
				$field = (string) $def['key'];
				$name  = 'shareholder_' . $n . '_' . $field;
				$value = isset( $row[ $field ] ) && is_scalar( $row[ $field ] ) ? trim( (string) $row[ $field ] ) : '';
				$error = self::field_error( $def, $value );
				if ( '' !== $error ) {
					$errors[ $name ] = $error;
				}
			}
		}
	}

	/**
	 * Tek alan kuralı (zorunlu, uzunluk, e-posta, telefon).
	 *
	 * @param array<string, mixed> $field Alan tanımı.
	 * @param string               $value Kırpılmış değer.
	 * @return string Hata iletisi ya da boş.
	 */
	private static function field_error( array $field, $value ) {
		$type = isset( $field['type'] ) ? (string) $field['type'] : 'text';
		$max  = isset( $field['maxlength'] ) ? (int) $field['maxlength'] : 0;
		if ( '' === $value ) {
			if ( ! empty( $field['required'] ) ) {
				return isset( $field['required_msg'] ) ? (string) $field['required_msg'] : __( 'This field is required.', 'woo-donation-popup' );
			}
			return '';
		}
		if ( $max > 0 && self::length( $value ) > $max ) {
			/* translators: %d: maximum characters. */
			return sprintf( __( 'Please use at most %d characters.', 'woo-donation-popup' ), $max );
		}
		if ( 'email' === $type && ! is_email( $value ) ) {
			return __( 'Please enter a valid email address.', 'woo-donation-popup' );
		}
		if ( 'tel' === $type && ( preg_match( '/[^0-9+\s\-()]/', $value ) || strlen( preg_replace( '/\D/', '', $value ) ) < 6 ) ) {
			return __( 'Please check the phone number.', 'woo-donation-popup' );
		}
		return '';
	}

	/**
	 * Ek bağış (AddOn): açıksa tutar (sabit ya da yazılan; en düşük tutar uygulanır) doğrulanır.
	 *
	 * @param array<string, mixed>  $model  Model.
	 * @param array<string, mixed>  $input  Girdi (`addon_active`, `addon_amount`).
	 * @param array<string, string> $errors Hatalar (referans).
	 * @return array{active: bool, amount: float|null}
	 */
	private static function validate_addon( array $model, array $input, array &$errors ) {
		$off    = array(
			'active' => false,
			'amount' => null,
		);
		$config = isset( $model['addon'] ) && is_array( $model['addon'] ) ? $model['addon'] : array();
		if ( empty( $config ) || empty( $input['addon_active'] ) || 'false' === $input['addon_active'] ) {
			return $off;
		}
		$fixed = isset( $config['fixed'] ) ? (float) $config['fixed'] : 0.0;
		if ( $fixed > 0 ) {
			return array(
				'active' => true,
				'amount' => $fixed,
			);
		}
		$amount = self::parse_amount( isset( $input['addon_amount'] ) ? $input['addon_amount'] : '' );
		$min    = isset( $config['min'] ) ? (float) $config['min'] : 0.0;
		if ( null === $amount || $amount <= 0 || $amount > 99999999 ) {
			$errors['addon_amount'] = __( 'Please enter a valid add-on donation amount.', 'woo-donation-popup' );
			return $off;
		}
		if ( $min > 0 && $amount + 0.0001 < $min ) {
			/* translators: %s: minimum amount. */
			$errors['addon_amount'] = sprintf( __( 'Minimum amount is %s.', 'woo-donation-popup' ), self::format_number( $min ) );
			return $off;
		}
		return array(
			'active' => true,
			'amount' => $amount,
		);
	}

	/**
	 * Çok baytlı güvenli uzunluk.
	 *
	 * @param string $value Metin.
	 * @return int
	 */
	private static function length( $value ) {
		return function_exists( 'mb_strlen' ) ? (int) mb_strlen( $value, 'UTF-8' ) : strlen( $value );
	}

	/**
	 * Hata iletisi için sade sayı (ondalıksız ise tam sayı).
	 *
	 * @param float $number Sayı.
	 * @return string
	 */
	private static function format_number( $number ) {
		return floor( $number ) === $number ? (string) (int) $number : (string) $number;
	}
}

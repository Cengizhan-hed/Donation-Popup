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
	 * @param array<string, mixed> $model Form modeli.
	 * @param array<string, mixed> $input İstek verisi (alan adı => değer).
	 * @return array{valid: bool, errors: array<string, string>, amount: float|null}
	 */
	public static function validate( array $model, array $input ) {
		$errors = array();

		$amount = self::parse_amount( isset( $input['amount'] ) ? $input['amount'] : '' );
		$min    = isset( $model['min'] ) ? (float) $model['min'] : 0.0;
		$limit  = max( $min, 0.01 );
		if ( null === $amount || $amount <= 0 ) {
			$errors['amount'] = __( 'Please enter a donation amount.', 'woo-donation-popup' );
			$amount           = null;
		} elseif ( $amount < $limit ) {
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

		$fields = isset( $model['fields'] ) && is_array( $model['fields'] ) ? $model['fields'] : array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) || empty( $field['name'] ) ) {
				continue;
			}
			$name  = (string) $field['name'];
			$value = isset( $input[ $name ] ) && is_scalar( $input[ $name ] ) ? trim( (string) $input[ $name ] ) : '';
			$type  = isset( $field['type'] ) ? (string) $field['type'] : 'text';
			$max   = isset( $field['maxlength'] ) ? (int) $field['maxlength'] : 0;

			if ( 'checkbox' === $type ) {
				continue;
			}
			if ( '' === $value ) {
				if ( ! empty( $field['required'] ) ) {
					$errors[ $name ] = __( 'Full name is required.', 'woo-donation-popup' );
				}
				continue;
			}
			if ( $max > 0 && self::length( $value ) > $max ) {
				/* translators: %d: maximum characters. */
				$errors[ $name ] = sprintf( __( 'Please use at most %d characters.', 'woo-donation-popup' ), $max );
				continue;
			}
			if ( 'email' === $type && ! is_email( $value ) ) {
				$errors[ $name ] = __( 'Please enter a valid email address.', 'woo-donation-popup' );
			}
			if ( 'tel' === $type && ( preg_match( '/[^0-9+\s\-()]/', $value ) || strlen( preg_replace( '/\D/', '', $value ) ) < 6 ) ) {
				$errors[ $name ] = __( 'Please enter a valid phone number.', 'woo-donation-popup' );
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
			'valid'  => empty( $errors ),
			'errors' => $errors,
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

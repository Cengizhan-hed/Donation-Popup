<?php
/**
 * Ürün "Bağış" sekmesinin gönderdiği alanları doğrular ve ürün meta eşlemesine çevirir.
 *
 * Meta anahtarları bir sözleşmedir ve DEĞİŞMEZ. Yalnız sekmede çizilen alanların anahtarları yazılır; sekmede artık
 * olmayan eski anahtarlara (ör. `_enable_urgency`, `_theme_primary`) dokunulmaz, kayıtlı değerleri korunur.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin\Product;

use DonationPanel\Domain\Addon_Product_Visibility;
use DonationPanel\Domain\Amount_Presets;
use DonationPanel\Domain\Campaign_Goal;
use DonationPanel\Domain\Donation_Type;

defined( 'ABSPATH' ) || exit;

/**
 * Product_Settings.
 */
final class Product_Settings {

	/**
	 * Katı doğrulanan meta anahtarları: reddedilen girişte kayıtlı değer korunur (veri kaybı olmaz).
	 */
	const VALIDATED_META_KEYS = array(
		'_amount_presets',
		'_amount_preset_recommended',
		'_cover_fee_percent',
		'_progress_bar_limit',
		'_max_shares',
		'_addon_wc_product_id',
	);

	/**
	 * En çok kaç hisse seçilebilir.
	 */
	const MAX_SHARES = 50;

	/**
	 * Sekmenin yazdığı tüm meta anahtarları (sözleşme; başka anahtara dokunulmaz).
	 *
	 * @return string[]
	 */
	public static function managed_meta_keys() {
		return array(
			'_wdp_donation_product',
			'_wdp_auto_place',
			'_donation_panel_direct',
			'_allow_custom_price',
			'_allow_multiple_shares',
			'_enable_progress_bar',
			'_min_custom_price',
			'_max_shares',
			'_progress_bar_limit',
			'_goal_reached_action',
			'_goal_reached_message',
			'_enable_amount_presets',
			'_amount_presets',
			'_amount_preset_recommended',
			'_enable_quantity',
			'_enable_cover_fee',
			'_cover_fee_percent',
			'_enable_email',
			'_enable_dedication',
			'_dedication_placeholder',
			'_enable_anonymous',
			'_enable_addon_donation',
			'_addon_toggle_label',
			'_addon_wc_product_id',
			'_addon_min_price',
			'_addon_fixed_price',
			'_addon_donation_message',
		);
	}

	/**
	 * Gevşek mantıksal bayrak: true|1|yes|on (büyük/küçük harf fark etmez).
	 *
	 * @param mixed $value Ham değer.
	 * @return bool
	 */
	public static function parse_bool_flag( $value ) {
		if ( is_bool( $value ) ) {
			return $value;
		}
		if ( is_int( $value ) || is_float( $value ) ) {
			return 1 === (int) $value;
		}
		$raw = strtolower( trim( (string) ( is_scalar( $value ) ? $value : '' ) ) );
		return in_array( $raw, array( '1', 'true', 'yes', 'on' ), true );
	}

	/**
	 * Genel ayara uyma seçeneği olan bayrak: yes | no | '' (= genel ayar).
	 *
	 * @param mixed $value Ham değer.
	 * @return string
	 */
	public static function parse_tristate_flag( $value ) {
		if ( null === $value ) {
			return '';
		}
		if ( is_bool( $value ) || is_int( $value ) || is_float( $value ) ) {
			return self::parse_bool_flag( $value ) ? 'yes' : '';
		}
		$raw = strtolower( trim( (string) ( is_scalar( $value ) ? $value : '' ) ) );
		if ( 'no' === $raw ) {
			return 'no';
		}
		return in_array( $raw, array( '1', 'true', 'yes', 'on' ), true ) ? 'yes' : '';
	}

	/**
	 * Sekme gönderimini ürün meta eşlemesine çevirir.
	 *
	 * @param array<string, mixed> $posted   Eğik çizgisi temizlenmiş (wp_unslash) `$_POST['wdp_donation']`.
	 * @param array<string, mixed> $existing Meta anahtarı => kayıtlı değer (reddedilen alanlar için).
	 * @param int                  $parent_id Ürün kimliği (ek bağış ürünü kendine bağlanamaz).
	 * @return array{meta: array<string, mixed>, notices: string[]} Yazılacak meta ve yöneticiye gösterilecek uyarılar.
	 */
	public static function normalize( array $posted, array $existing = array(), $parent_id = 0 ) {
		$notices  = array();
		$rejected = array();
		$reject   = static function ( $meta_key, $message ) use ( &$notices, &$rejected ) {
			$rejected[] = $meta_key;
			if ( '' !== $message ) {
				$notices[] = $message;
			}
		};

		$flag = static function ( $key ) use ( $posted ) {
			return isset( $posted[ $key ] ) && self::parse_bool_flag( $posted[ $key ] );
		};
		$text = static function ( $key, $max ) use ( $posted ) {
			return isset( $posted[ $key ] ) && is_scalar( $posted[ $key ] )
				? self::limit_text( sanitize_text_field( (string) $posted[ $key ] ), $max )
				: '';
		};
		$area = static function ( $key, $max ) use ( $posted ) {
			return isset( $posted[ $key ] ) && is_scalar( $posted[ $key ] )
				? self::limit_text( sanitize_textarea_field( (string) $posted[ $key ] ), $max )
				: '';
		};
		$raw  = static function ( $key ) use ( $posted ) {
			return isset( $posted[ $key ] ) && is_scalar( $posted[ $key ] ) ? trim( (string) (string) $posted[ $key ] ) : '';
		};

		// Bağış türü üç eski bayrağı belirler (tek doğruluk kaynağı bu üç meta).
		$type  = Donation_Type::sanitize( isset( $posted['donation_type'] ) ? $posted['donation_type'] : '' );
		$flags = Donation_Type::to_flags( $type );

		// Hızlı tutarlar: katı doğrulama.
		$presets_raw   = $raw( 'amount_presets' );
		$presets_check = self::validate_amount_presets( $presets_raw );
		$presets       = '';
		if ( $presets_check['ok'] ) {
			$presets = $presets_check['amounts'] ? implode( ', ', $presets_check['amounts'] ) : '';
		} else {
			$reject( '_amount_presets', $presets_check['error'] );
		}

		// "Önerilen" tutar: ürün listesinde, yoksa kayıtlı listede, yoksa genel listede olmalı.
		$allowed = array();
		if ( $presets_check['ok'] && $presets_check['amounts'] ) {
			$allowed = $presets_check['amounts'];
		} else {
			$stored = isset( $existing['_amount_presets'] ) && is_scalar( $existing['_amount_presets'] ) ? (string) $existing['_amount_presets'] : '';
			$list   = Amount_Presets::parse_csv( '' !== $presets ? $presets : $stored );
			if ( ! $list ) {
				$button = get_option( 'wdp_button_settings', array() );
				$list   = Amount_Presets::parse_csv( ( is_array( $button ) && isset( $button['amount_presets'] ) ) ? (string) $button['amount_presets'] : '' );
			}
			$allowed = array_map( 'intval', $list );
		}
		$recommended_check = self::validate_recommended( $raw( 'amount_preset_recommended' ), $allowed );
		$recommended       = '';
		if ( $recommended_check['ok'] ) {
			$recommended = $recommended_check['value'];
		} else {
			$reject( '_amount_preset_recommended', $recommended_check['error'] );
		}

		// İşlem ücreti yüzdesi.
		$fee_check = self::validate_cover_fee( $raw( 'cover_fee_percent' ) );
		$fee       = 0.0;
		if ( $fee_check['ok'] ) {
			$fee = $fee_check['percent'];
		} else {
			$reject( '_cover_fee_percent', $fee_check['error'] );
		}

		// En çok hisse: 0/boş = varsayılan; 50'yi aşan yeni giriş reddedilir.
		$shares_raw = absint( $raw( 'max_shares' ) );
		$shares     = '';
		if ( $shares_raw > self::MAX_SHARES ) {
			$reject( '_max_shares', __( 'The maximum number of shares can be 50.', 'woo-donation-popup' ) );
		} elseif ( $shares_raw > 0 ) {
			$shares = (string) $shares_raw;
		}

		// En düşük tutar.
		$min_parsed = self::parse_money( '' === $raw( 'min_custom_price' ) ? '0' : $raw( 'min_custom_price' ) );
		$min_amount = $min_parsed['ok'] ? max( 0.0, min( 100000000.0, $min_parsed['amount'] ) ) : 0.0;
		if ( $min_parsed['ok'] && abs( $min_amount - $min_parsed['amount'] ) > 0.0001 ) {
			$notices[] = sprintf(
				/* translators: 1: field name, 2: original value, 3: corrected value */
				__( 'The «%1$s» value was corrected from %2$s to %3$s.', 'woo-donation-popup' ),
				__( 'Minimum amount', 'woo-donation-popup' ),
				(string) $min_parsed['amount'],
				(string) $min_amount
			);
		}

		// Kampanya hedefi: yalnız hedefli kampanyada zorunlu.
		$goal = 0.0;
		if ( $flags['enable_progress_bar'] ) {
			$goal_parsed = self::parse_money( $raw( 'progress_bar_limit' ) );
			$goal        = $goal_parsed['ok'] ? $goal_parsed['amount'] : 0.0;
			if ( ! $goal_parsed['ok'] || $goal <= 0 ) {
				$reject( '_progress_bar_limit', '' !== $goal_parsed['error'] ? $goal_parsed['error'] : __( 'The goal amount cannot be empty or zero.', 'woo-donation-popup' ) );
				$goal = 0.0;
			} elseif ( $goal > Campaign_Goal::MAX_GOAL_AMOUNT ) {
				$reject(
					'_progress_bar_limit',
					sprintf(
						/* translators: %s: max amount */
						__( 'The goal amount can be at most %s.', 'woo-donation-popup' ),
						wc_format_decimal( Campaign_Goal::MAX_GOAL_AMOUNT )
					)
				);
				$goal = 0.0;
			}
		} elseif ( '' !== $raw( 'progress_bar_limit' ) ) {
			// Hedefli olmayan türde gizli alan: kayıtlı hedef korunur, yazılmaz.
			$reject( '_progress_bar_limit', '' );
		}

		// Ek bağış ürünü: geçersizse temizlenir ve uyarı verilir.
		$addon_id     = absint( $raw( 'addon_wc_product_id' ) );
		$addon_stored = '';
		if ( $addon_id > 0 ) {
			$check = Addon_Product_Visibility::validate_addon_product_id( $addon_id, (int) $parent_id );
			if ( empty( $check['ok'] ) ) {
				$addon_id = 0;
				if ( ! empty( $check['error'] ) ) {
					$notices[] = (string) $check['error'];
				}
			} else {
				$addon_id = (int) $check['id'];
			}
		}
		if ( $addon_id > 0 ) {
			$addon_stored = (string) $addon_id;
		}

		$addon_min   = self::parse_money( '' === $raw( 'addon_min_price' ) ? '0' : $raw( 'addon_min_price' ) );
		$addon_fixed = self::parse_money( $raw( 'addon_fixed_price' ) );

		$meta = array(
			'_wdp_donation_product'      => self::parse_tristate_flag( isset( $posted['donation_product'] ) ? $posted['donation_product'] : null ),
			'_wdp_auto_place'            => 'no' === strtolower( $raw( 'auto_place' ) ) ? 'no' : '',
			'_donation_panel_direct'     => self::parse_tristate_flag( isset( $posted['direct'] ) ? $posted['direct'] : null ),
			'_allow_custom_price'        => $flags['allow_custom_price'] ? 'yes' : 'no',
			'_allow_multiple_shares'     => $flags['allow_multiple_shares'] ? 'yes' : 'no',
			'_enable_progress_bar'       => $flags['enable_progress_bar'] ? 'yes' : 'no',
			'_min_custom_price'          => $min_amount > 0 ? wc_format_decimal( $min_amount ) : '0',
			'_max_shares'                => $shares,
			'_progress_bar_limit'        => $goal > 0 ? wc_format_decimal( $goal ) : '',
			'_goal_reached_action'       => Campaign_Goal::sanitize_action( isset( $posted['goal_reached_action'] ) ? $posted['goal_reached_action'] : '' ),
			'_goal_reached_message'      => Campaign_Goal::sanitize_message( isset( $posted['goal_reached_message'] ) && is_scalar( $posted['goal_reached_message'] ) ? (string) $posted['goal_reached_message'] : '' ),
			'_enable_amount_presets'     => $flag( 'enable_amount_presets' ) ? 'yes' : 'no',
			'_amount_presets'            => $presets,
			'_amount_preset_recommended' => $recommended,
			'_enable_quantity'           => $flag( 'enable_quantity' ) ? 'yes' : 'no',
			'_enable_cover_fee'          => $flag( 'enable_cover_fee' ) ? 'yes' : 'no',
			'_cover_fee_percent'         => $fee > 0 ? (string) $fee : '',
			'_enable_email'              => self::parse_tristate_flag( isset( $posted['enable_email'] ) ? $posted['enable_email'] : null ),
			'_enable_dedication'         => self::parse_tristate_flag( isset( $posted['enable_dedication'] ) ? $posted['enable_dedication'] : null ),
			'_dedication_placeholder'    => $text( 'dedication_placeholder', 120 ),
			'_enable_anonymous'          => self::parse_tristate_flag( isset( $posted['enable_anonymous'] ) ? $posted['enable_anonymous'] : null ),
			'_enable_addon_donation'     => $flag( 'enable_addon_donation' ) ? 'yes' : 'no',
			'_addon_toggle_label'        => $text( 'addon_toggle_label', 80 ),
			'_addon_wc_product_id'       => $addon_stored,
			'_addon_min_price'           => $addon_min['ok'] && $addon_min['amount'] > 0 ? wc_format_decimal( $addon_min['amount'] ) : '0',
			'_addon_fixed_price'         => $addon_fixed['ok'] && $addon_fixed['amount'] > 0 ? wc_format_decimal( $addon_fixed['amount'] ) : '',
			'_addon_donation_message'    => $area( 'addon_donation_message', 500 ),
		);

		// Reddedilen giriş kayıtlı veriyi ASLA ezmez.
		foreach ( $rejected as $meta_key ) {
			if ( array_key_exists( $meta_key, $existing ) ) {
				$meta[ $meta_key ] = is_scalar( $existing[ $meta_key ] ) ? (string) $existing[ $meta_key ] : '';
			} else {
				unset( $meta[ $meta_key ] );
			}
		}

		return array(
			'meta'    => $meta,
			'notices' => $notices,
		);
	}

	/**
	 * Binlik ayırıcılı tutar girişi ("100.000", "100,000.50") → sayı.
	 *
	 * @param mixed $raw Ham giriş.
	 * @return array{ok: bool, amount: float, error: string}
	 */
	public static function parse_money( $raw ) {
		$raw = trim( is_scalar( $raw ) ? (string) $raw : '' );
		if ( '' === $raw ) {
			return array(
				'ok'     => false,
				'amount' => 0.0,
				'error'  => __( 'Please enter a valid amount.', 'woo-donation-popup' ),
			);
		}
		if ( preg_match( '/^\d{1,3}(\.\d{3})+(,\d{1,6})?$/', $raw ) ) {
			$normalized = str_replace( array( '.', ',' ), array( '', '.' ), $raw );
		} elseif ( preg_match( '/^\d{1,3}(,\d{3})+(\.\d{1,6})?$/', $raw ) ) {
			$normalized = str_replace( ',', '', $raw );
		} else {
			$normalized = str_replace( ',', '.', (string) wc_format_decimal( $raw ) );
		}
		if ( '' === $normalized || ! is_numeric( $normalized ) ) {
			return array(
				'ok'     => false,
				'amount' => 0.0,
				'error'  => __( 'The goal amount must be a valid number.', 'woo-donation-popup' ),
			);
		}
		return array(
			'ok'     => true,
			'amount' => (float) $normalized,
			'error'  => '',
		);
	}

	/**
	 * Hızlı tutar listesini KAYDEDERKEN katı doğrular: virgül/boşluk/noktalı virgül ayırıcı, her parça yalnız rakam,
	 * sıfırdan büyük, en çok 6. Boş liste geçerlidir.
	 *
	 * @param string $raw Ham giriş.
	 * @return array{ok: bool, amounts: int[], error: string}
	 */
	public static function validate_amount_presets( $raw ) {
		$raw = trim( (string) $raw );
		$bad = static function ( $token ) {
			return array(
				'ok'      => false,
				'amounts' => array(),
				'error'   => sprintf(
					/* translators: %s: invalid token */
					__( 'Quick amount buttons must be whole numbers only; invalid value: "%s". Separate amounts with commas, spaces, or semicolons (e.g. 100, 250, 500).', 'woo-donation-popup' ),
					$token
				),
			);
		};
		if ( '' === $raw ) {
			return array(
				'ok'      => true,
				'amounts' => array(),
				'error'   => '',
			);
		}
		if ( preg_match( '/\d+\.\d+/', $raw, $dot ) ) {
			return $bad( $dot[0] );
		}
		if ( preg_match( '/(?:^|[\s;])(\d+,\d{1,2})(?=[\s;]|$)/u', $raw, $dec ) || preg_match( '/^(\d+,\d{1,2})$/u', $raw, $dec ) ) {
			return $bad( $dec[1] );
		}
		$amounts = array();
		foreach ( (array) preg_split( '/[\s,;]+/', $raw, -1, PREG_SPLIT_NO_EMPTY ) as $part ) {
			$part = trim( (string) $part );
			if ( ! preg_match( '/^\d+$/', $part ) || (int) $part <= 0 ) {
				return $bad( $part );
			}
			$amounts[] = (int) $part;
		}
		if ( count( $amounts ) > Amount_Presets::MAX ) {
			return array(
				'ok'      => false,
				'amounts' => array(),
				'error'   => __( 'You can define at most 6 quick amount buttons.', 'woo-donation-popup' ),
			);
		}
		return array(
			'ok'      => true,
			'amounts' => $amounts,
			'error'   => '',
		);
	}

	/**
	 * "Önerilen" tutar: boş geçerli; doluysa pozitif tam sayı ve izinli listede olmalı.
	 *
	 * @param string $raw     Ham giriş.
	 * @param int[]  $allowed İzinli tutarlar.
	 * @return array{ok: bool, value: string, error: string}
	 */
	public static function validate_recommended( $raw, array $allowed ) {
		$raw = trim( (string) $raw );
		if ( '' === $raw ) {
			return array(
				'ok'    => true,
				'value' => '',
				'error' => '',
			);
		}
		if ( ! preg_match( '/^\d+$/', $raw ) || (int) $raw <= 0 ) {
			return array(
				'ok'    => false,
				'value' => '',
				'error' => sprintf(
					/* translators: %s: invalid value */
					__( 'The suggested amount must be a positive whole number only; invalid value: "%s".', 'woo-donation-popup' ),
					$raw
				),
			);
		}
		if ( ! in_array( (int) $raw, array_map( 'intval', $allowed ), true ) ) {
			return array(
				'ok'    => false,
				'value' => '',
				'error' => sprintf(
					/* translators: %s: invalid value */
					__( 'The suggested amount must be in the quick amount list; invalid value: "%s".', 'woo-donation-popup' ),
					$raw
				),
			);
		}
		return array(
			'ok'    => true,
			'value' => (string) (int) $raw,
			'error' => '',
		);
	}

	/**
	 * İşlem ücreti yüzdesi: 0/boş = kapalı; aksi halde 0,5 ile 15 arası.
	 *
	 * @param string $raw Ham giriş.
	 * @return array{ok: bool, percent: float, error: string}
	 */
	public static function validate_cover_fee( $raw ) {
		$raw = trim( str_replace( ',', '.', (string) $raw ) );
		if ( '' === $raw ) {
			return array(
				'ok'      => true,
				'percent' => 0.0,
				'error'   => '',
			);
		}
		if ( ! is_numeric( $raw ) ) {
			return array(
				'ok'      => false,
				'percent' => 0.0,
				'error'   => __( 'The processing fee percentage must be a number: 0 (off) or 0.5–15.', 'woo-donation-popup' ),
			);
		}
		$value = (float) $raw;
		if ( 0.0 === $value ) {
			return array(
				'ok'      => true,
				'percent' => 0.0,
				'error'   => '',
			);
		}
		if ( $value < 0.5 || $value > 15 ) {
			return array(
				'ok'      => false,
				'percent' => 0.0,
				'error'   => __( 'The processing fee percentage must be 0 (off) or between 0.5 and 15.', 'woo-donation-popup' ),
			);
		}
		return array(
			'ok'      => true,
			'percent' => round( $value, 2 ),
			'error'   => '',
		);
	}

	/**
	 * Metni (Unicode güvenli) en çok $max karaktere kısaltır.
	 *
	 * @param string $value Metin.
	 * @param int    $max   En çok karakter.
	 * @return string
	 */
	private static function limit_text( $value, $max ) {
		return function_exists( 'mb_substr' ) ? (string) mb_substr( $value, 0, (int) $max ) : substr( $value, 0, (int) $max );
	}
}

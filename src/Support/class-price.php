<?php
/**
 * Tutar biçimi ve bağışçı tutarı ayrıştırma (WooCommerce para birimi ayarlarıyla).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Price
 */
class Price {

	/**
	 * HTML entity içeren metni düz metne çevirir (ör. &#8378; → ₺).
	 *
	 * @param mixed $text Ham metin.
	 * @return string
	 */
	public static function decode_text_entities( $text ) {
		$text = (string) $text;
		if ( '' === $text ) {
			return '';
		}

		$charset = function_exists( 'get_bloginfo' ) ? (string) get_bloginfo( 'charset' ) : 'UTF-8';
		if ( '' === $charset ) {
			$charset = 'UTF-8';
		}

		return html_entity_decode( $text, ENT_QUOTES | ENT_HTML5, $charset );
	}

	/**
	 * Düz metin / esc_html için güvenli para birimi sembolü.
	 *
	 * @param string $symbol Boşsa WooCommerce varsayılanı kullanılır.
	 * @return string
	 */
	public static function get_display_currency_symbol( $symbol = '' ) {
		if ( '' === $symbol && function_exists( 'get_woocommerce_currency_symbol' ) ) {
			$symbol = get_woocommerce_currency_symbol();
		}
		if ( '' === $symbol ) {
			$symbol = function_exists( 'get_woocommerce_currency' ) ? (string) get_woocommerce_currency() : '';
		}

		return self::decode_text_entities( $symbol );
	}

	/**
	 * WooCommerce sayı/sembol ayarları (JS localize + biçimleme).
	 *
	 * @return array{code:string,symbol:string,decimals:int,thousandSeparator:string,decimalSeparator:string,symbolPosition:string}
	 */
	public static function get_js_currency_settings() {
		$code   = function_exists( 'get_woocommerce_currency' ) ? (string) get_woocommerce_currency() : '';
		$symbol = self::get_display_currency_symbol(
			function_exists( 'get_woocommerce_currency_symbol' ) ? get_woocommerce_currency_symbol( $code ) : ''
		);
		return array(
			'code'              => $code,
			'symbol'            => $symbol,
			'decimals'          => function_exists( 'wc_get_price_decimals' ) ? (int) wc_get_price_decimals() : 2,
			'thousandSeparator' => function_exists( 'wc_get_price_thousand_separator' ) ? (string) wc_get_price_thousand_separator() : ',',
			'decimalSeparator'  => function_exists( 'wc_get_price_decimal_separator' ) ? (string) wc_get_price_decimal_separator() : '.',
			'symbolPosition'    => function_exists( 'get_option' ) ? (string) get_option( 'woocommerce_currency_pos', 'left' ) : 'left',
		);
	}

	/**
	 * Kart / form birim fiyatı: WooCommerce "vergi dahil/hariç göster" ayarına uyar.
	 *
	 * @param \WC_Product $product Product.
	 * @return string HTML (or '').
	 */
	public static function format_product_display_price( $product ) {
		if ( ! is_object( $product ) || ! method_exists( $product, 'get_price' ) ) {
			return '';
		}
		$amount = function_exists( 'wc_get_price_to_display' )
			? wc_get_price_to_display( $product )
			: $product->get_price();
		if ( '' === $amount || null === $amount ) {
			return '';
		}
		return self::format_price_html( $amount );
	}

	/**
	 * WooCommerce fiyat HTML'i; gereksiz sondaki ondalıkları kaldırır (ör. tam sayılarda ",00" yok).
	 *
	 * @param float|int|string|null $amount Ham tutar.
	 * @param array<string, mixed>  $args   `wc_price()` için ek argümanlar.
	 * @return string Güvenli HTML.
	 */
	public static function format_price_html( $amount, array $args = array() ) {
		if ( '' === $amount || null === $amount ) {
			return '';
		}
		if ( ! function_exists( 'wc_price' ) ) {
			return '';
		}
		$numeric = floatval( $amount );
		if ( ! is_finite( $numeric ) ) {
			return '';
		}
		$args = array_merge(
			array(
				'trim_zeros' => true,
			),
			$args
		);

		$html = wp_kses_post( wc_price( $numeric, $args ) );

		return self::decode_text_entities( $html );
	}

	/**
	 * Placeholder / düz metin için fiyat (HTML etiketleri yok).
	 *
	 * @param float|string $amount Ham tutar.
	 * @return string
	 */
	public static function format_price_plain( $amount ) {
		$raw = wp_strip_all_tags( self::format_price_html( $amount ) );
		if ( '' === $raw ) {
			return '';
		}

		// wc_price() bazı para birimi sembollerini HTML entity olarak döndürebilir (örn: &#8378;).
		// Mini-cart tarafında düz metin beklediğimiz için entity'leri Unicode karaktere çözüyoruz.
		$charset = function_exists( 'get_bloginfo' ) ? (string) get_bloginfo( 'charset' ) : 'UTF-8';
		if ( '' === $charset ) {
			$charset = 'UTF-8';
		}

		return html_entity_decode( $raw, ENT_QUOTES | ENT_HTML5, $charset );
	}

	/**
	 * WooCommerce sayı biçimi (sembol yok; ondalık kırpılmaz).
	 * wc_price sayı kısmı / JS formatPrice ile aynı ayarlar.
	 *
	 * @param float|string $amount Ham tutar.
	 * @return string
	 */
	public static function format_localized_amount( $amount ) {
		if ( '' === $amount || null === $amount ) {
			return '';
		}
		$numeric = floatval( $amount );
		if ( ! is_finite( $numeric ) ) {
			return '';
		}
		$dp        = function_exists( 'wc_get_price_decimals' ) ? absint( wc_get_price_decimals() ) : 2;
		$dec       = function_exists( 'wc_get_price_decimal_separator' ) ? (string) wc_get_price_decimal_separator() : '.';
		$thousands = function_exists( 'wc_get_price_thousand_separator' ) ? (string) wc_get_price_thousand_separator() : ',';
		return number_format( $numeric, $dp, $dec, $thousands );
	}

	/**
	 * Tutar alanı yer tutucusu: "min: " + format_localized_amount (açık/hata/AJAX aynı metin).
	 *
	 * @param float|string $amount Ham tutar.
	 * @return string
	 */
	public static function format_min_placeholder( $amount ) {
		$n = self::format_localized_amount( $amount );
		return '' === $n ? '' : ( 'min: ' . $n );
	}

	/**
	 * @param float|string $amount Ham tutar.
	 * @return string
	 */
	public static function format_amount_for_min_placeholder( $amount ) {
		return self::format_localized_amount( $amount );
	}

	/**
	 * Bağışçı tutarı (JS parseMoneyDetailed ile aynı kural).
	 * Geçerli binlik gruplama (1–3 + her grup 3) → binlik; gruplamayan son
	 * ayırıcı → ondalık adayı. 0 dp: kesir tümü sıfırsa tam sayı, değilse uyarı
	 * (yuvarlama/100× yok). N>0: kesir ≤ N kabul, > N uyarı.
	 *
	 * @param mixed $raw      Ham girdi (yapıştırma: sembol/boşluk temizlenir).
	 * @param array<string, mixed> $settings İsteğe bağlı {decimals,thousandSeparator,decimalSeparator}.
	 * @return array{ok:bool,amount:float,status:string,error:string}
	 */
	public static function parse_donor_amount( $raw, $settings = null ) {
		if ( is_int( $raw ) || is_float( $raw ) ) {
			if ( ! is_finite( (float) $raw ) || (float) $raw < 0 ) {
				return self::donor_amount_result( false, 0.0, 'invalid', '' );
			}
			return self::donor_amount_result( true, (float) $raw, 'ok', '' );
		}
		if ( null === $raw ) {
			return self::donor_amount_result( false, 0.0, 'invalid', '' );
		}

		$cfg      = self::normalize_parse_currency_settings( $settings );
		$thousand = $cfg['thousandSeparator'];
		$decimal  = $cfg['decimalSeparator'];
		$s        = self::normalize_amount_input( (string) $raw, $thousand, $decimal );
		if ( '' === $s || '-' === $s || $s === $thousand || $s === $decimal || '.' === $s || ',' === $s ) {
			return self::donor_amount_result( false, 0.0, 'invalid', '' );
		}
		if ( isset( $s[0] ) && '-' === $s[0] ) {
			return self::donor_amount_result( false, 0.0, 'invalid', '' );
		}
		if ( strpos( $s, '-' ) !== false ) {
			return self::donor_amount_result( false, 0.0, 'invalid', '' );
		}

		return self::parse_grouped_amount( $s, $cfg );
	}

	/**
	 * 0 dp mağazada kuruş girilemez (yerelleştirilebilir).
	 *
	 * @param array<string, mixed>|null $settings Currency settings.
	 * @return string
	 */
	public static function get_no_fraction_amount_message( $settings = null ) {
		$cfg     = self::normalize_parse_currency_settings( $settings );
		$example = self::format_localized_amount_with_settings( 10, $cfg );
		if ( '' === $example ) {
			$example = '10';
		}
		return sprintf(
			/* translators: %s: example whole amount in store format */
			__( 'This site does not accept amounts with decimals, e.g. %s', 'woo-donation-popup' ),
			$example
		);
	}

	/**
	 * Belirsiz tutar görünür mesajı (yerelleştirilebilir; örnek mağaza biçiminde).
	 *
	 * @param array<string, mixed>|null $settings Currency settings.
	 * @return string
	 */
	public static function get_ambiguous_amount_message( $settings = null ) {
		$cfg = self::normalize_parse_currency_settings( $settings );
		if ( $cfg['decimals'] <= 0 ) {
			return self::get_no_fraction_amount_message( $cfg );
		}
		$example = self::format_localized_amount_with_settings( 10, $cfg );
		if ( '' === $example ) {
			$example = '10';
		}
		return sprintf(
			/* translators: %s: example amount in store format */
			__( 'Please enter the amount in this format, e.g. %s', 'woo-donation-popup' ),
			$example
		);
	}

	/**
	 * @param array<string, mixed>|null $settings Optional overrides.
	 * @return array{decimals:int,thousandSeparator:string,decimalSeparator:string}
	 */
	private static function normalize_parse_currency_settings( $settings ) {
		$base = self::get_js_currency_settings();
		$src  = is_array( $settings ) ? $settings : array();
		$dec  = isset( $src['decimals'] ) ? (int) $src['decimals'] : (int) $base['decimals'];
		if ( $dec < 0 ) {
			$dec = 0;
		}
		$thousand = array_key_exists( 'thousandSeparator', $src )
			? (string) $src['thousandSeparator']
			: (string) $base['thousandSeparator'];
		$decimal  = array_key_exists( 'decimalSeparator', $src )
			? (string) $src['decimalSeparator']
			: (string) $base['decimalSeparator'];
		return array(
			'decimals'          => $dec,
			'thousandSeparator' => $thousand,
			'decimalSeparator'  => $decimal,
		);
	}

	/**
	 * Sembol/harf/boşluk temizliği (yapıştırma: "₺1.250", "1 250").
	 *
	 * @param string $raw      Raw.
	 * @param string $thousand Thousand sep.
	 * @param string $decimal  Decimal sep.
	 * @return string
	 */
	public static function normalize_amount_input( $raw, $thousand = '.', $decimal = ',' ) {
		$s = trim( (string) $raw );
		if ( '' === $s ) {
			return '';
		}
		$s = preg_replace( '/[\s\x{00A0}\x{202F}\x{2009}\x{2007}\x{2060}]+/u', '', $s );
		if ( ! is_string( $s ) ) {
			return '';
		}
		$keep = preg_quote( $thousand . $decimal . '.,', '/' );
		$s    = preg_replace( '/[^0-9' . $keep . '\-]/u', '', $s );
		return is_string( $s ) ? $s : '';
	}

	/**
	 * @param string $int_part Integer part still containing separators.
	 * @param string $sep      Thousand separator.
	 * @return bool
	 */
	private static function is_valid_thousand_grouping( $int_part, $sep ) {
		if ( '' === $sep || false === strpos( $int_part, $sep ) ) {
			return false;
		}
		$parts = explode( $sep, $int_part );
		if ( count( $parts ) < 2 ) {
			return false;
		}
		if ( ! preg_match( '/^\d{1,3}$/', $parts[0] ) ) {
			return false;
		}
		$n = count( $parts );
		for ( $i = 1; $i < $n; $i++ ) {
			if ( ! preg_match( '/^\d{3}$/', $parts[ $i ] ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * "." / "," gruplama + son ayırıcı ondalık adayı (mağaza ondalık sayısı).
	 *
	 * @param string $s   Normalized digits+sep.
	 * @param array<string, mixed>  $cfg Normalized settings.
	 * @return array{ok:bool,amount:float,status:string,error:string}
	 */
	private static function parse_grouped_amount( $s, array $cfg ) {
		$decimals = (int) $cfg['decimals'];
		$seps     = array();
		$len      = strlen( $s );
		for ( $i = 0; $i < $len; $i++ ) {
			$ch = $s[ $i ];
			if ( '.' === $ch || ',' === $ch ) {
				$seps[] = array(
					'i'  => $i,
					'ch' => $ch,
				);
			}
		}
		if ( ! $seps ) {
			if ( preg_match( '/^\d+$/', $s ) ) {
				return self::donor_amount_result( true, (float) $s, 'ok', '' );
			}
			return self::donor_amount_result( false, 0.0, 'invalid', '' );
		}
		$last        = $seps[ count( $seps ) - 1 ];
		$before_last = substr( $s, 0, $last['i'] );
		$after_last  = substr( $s, $last['i'] + 1 );
		$chars       = array();
		foreach ( $seps as $row ) {
			if ( ! in_array( $row['ch'], $chars, true ) ) {
				$chars[] = $row['ch'];
			}
		}
		if ( count( $chars ) === 1 ) {
			$ch = $chars[0];
			if ( self::is_valid_thousand_grouping( $s, $ch ) ) {
				return self::donor_amount_result( true, (float) str_replace( $ch, '', $s ), 'ok', '' );
			}
			if ( count( $seps ) === 1 ) {
				return self::apply_decimal_part( $before_last, $after_last, $decimals, $cfg );
			}
			if ( self::is_valid_thousand_grouping( $before_last, $ch ) ) {
				return self::apply_decimal_part( str_replace( $ch, '', $before_last ), $after_last, $decimals, $cfg );
			}
			return self::donor_amount_ambiguous( $cfg );
		}
		$last_count = 0;
		foreach ( $seps as $row ) {
			if ( $row['ch'] === $last['ch'] ) {
				++$last_count;
			}
		}
		if ( 1 !== $last_count ) {
			return self::donor_amount_result( false, 0.0, 'invalid', '' );
		}
		$other = $chars[0] === $last['ch'] ? $chars[1] : $chars[0];
		if ( strpos( $before_last, $other ) !== false ) {
			if ( ! self::is_valid_thousand_grouping( $before_last, $other ) ) {
				return self::donor_amount_ambiguous( $cfg );
			}
			return self::apply_decimal_part( str_replace( $other, '', $before_last ), $after_last, $decimals, $cfg );
		}
		return self::apply_decimal_part( $before_last, $after_last, $decimals, $cfg );
	}

	/**
	 * @param string $int_part Integer digits.
	 * @param string $frac     Fraction digits.
	 * @param int    $decimals Store decimals.
	 * @param array<string, mixed>  $cfg      Normalized settings.
	 * @return array{ok:bool,amount:float,status:string,error:string}
	 */
	private static function apply_decimal_part( $int_part, $frac, $decimals, array $cfg ) {
		if ( '' === $int_part || '' === $frac || ! preg_match( '/^\d+$/', $int_part ) || ! preg_match( '/^\d+$/', $frac ) ) {
			return self::donor_amount_result( false, 0.0, 'invalid', '' );
		}
		if ( $decimals <= 0 ) {
			if ( preg_match( '/^0+$/', $frac ) ) {
				return self::donor_amount_result( true, (float) $int_part, 'ok', '' );
			}
			return self::donor_amount_result( false, 0.0, 'ambiguous', self::get_no_fraction_amount_message( $cfg ) );
		}
		if ( strlen( $frac ) > $decimals ) {
			return self::donor_amount_ambiguous( $cfg );
		}
		return self::donor_amount_result( true, (float) ( $int_part . '.' . $frac ), 'ok', '' );
	}

	/**
	 * @param array<string, mixed> $cfg Normalized settings.
	 * @return array{ok:bool,amount:float,status:string,error:string}
	 */
	private static function donor_amount_ambiguous( array $cfg ) {
		return self::donor_amount_result( false, 0.0, 'ambiguous', self::get_ambiguous_amount_message( $cfg ) );
	}

	/**
	 * @param bool   $ok     Ok.
	 * @param float  $amount Amount.
	 * @param string $status Status.
	 * @param string $error  Error.
	 * @return array{ok:bool,amount:float,status:string,error:string}
	 */
	private static function donor_amount_result( $ok, $amount, $status, $error ) {
		$msg = (string) $error;
		if ( ! $ok && '' === $msg ) {
			$msg = 'ambiguous' === $status
				? self::get_ambiguous_amount_message()
				: __( 'Invalid price value.', 'woo-donation-popup' );
		}
		return array(
			'ok'     => (bool) $ok,
			'amount' => (float) $amount,
			'status' => (string) $status,
			'error'  => $msg,
		);
	}

	/**
	 * @param float|int $amount Amount.
	 * @param array<string, mixed>     $cfg    {decimals,thousandSeparator,decimalSeparator}.
	 * @return string
	 */
	private static function format_localized_amount_with_settings( $amount, array $cfg ) {
		$numeric = (float) $amount;
		if ( ! is_finite( $numeric ) ) {
			return '';
		}
		$dp        = isset( $cfg['decimals'] ) ? absint( $cfg['decimals'] ) : 0;
		$dec       = isset( $cfg['decimalSeparator'] ) ? (string) $cfg['decimalSeparator'] : ',';
		$thousands = isset( $cfg['thousandSeparator'] ) ? (string) $cfg['thousandSeparator'] : '.';
		return number_format( $numeric, $dp, $dec, $thousands );
	}

	/**
	 * WooCommerce sembol konumu: left|left_space|right|right_space.
	 *
	 * @return string
	 */
	public static function currency_position() {
		$pos     = self::get_js_currency_settings()['symbolPosition'];
		$allowed = array( 'left', 'left_space', 'right', 'right_space' );
		return in_array( $pos, $allowed, true ) ? $pos : 'left';
	}

	/**
	 * Tutar kabuğu CSS sınıfı (sembol konumu).
	 *
	 * @return string
	 */
	public static function currency_position_class() {
		return 'wdp-currency-pos-' . self::currency_position();
	}

	/**
	 * Para birimine duyarlı kullanıcı iletisi tutarı (WooCommerce biçimi; yoksa sayı + simge).
	 *
	 * @param float $amount     Tutar.
	 * @param bool  $plain_text HTML'siz.
	 * @return string
	 */
	public static function format_for_message( $amount, $plain_text = true ) {
		$formatted = $plain_text ? self::format_price_plain( $amount ) : self::format_price_html( $amount );
		if ( '' !== $formatted ) {
			return $formatted;
		}

		$symbol = function_exists( 'get_woocommerce_currency_symbol' ) ? get_woocommerce_currency_symbol() : '';
		$number = function_exists( 'wc_format_decimal' ) ? wc_format_decimal( $amount ) : (string) $amount;
		return trim( $number . ' ' . html_entity_decode( (string) $symbol, ENT_QUOTES, 'UTF-8' ) );
	}
}

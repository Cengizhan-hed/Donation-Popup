<?php
/**
 * Hızlı bağış tutarları (ön ayarlar): varsayılan değerler ve kayıtlı listeyi okuma.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * Amount_Presets.
 */
final class Amount_Presets {

	/**
	 * En çok kaç hızlı tutar gösterilir.
	 */
	const MAX = 6;

	/**
	 * Para biriminin küçük birimine göre varsayılan hızlı tutarlar (hiç kaydedilmemişken).
	 *
	 * Ondalıksız para birimlerinde (JPY, çoğu TRY mağazası): 100, 250, 500, 1000, 2500.
	 * Ondalıklılarda (GBP, EUR, USD): 5, 10, 25, 50, 100.
	 *
	 * @return float[]
	 */
	public static function default_values() {
		$decimals = function_exists( 'wc_get_price_decimals' ) ? (int) wc_get_price_decimals() : 2;
		if ( $decimals <= 0 ) {
			return array( 100.0, 250.0, 500.0, 1000.0, 2500.0 );
		}
		return array( 5.0, 10.0, 25.0, 50.0, 100.0 );
	}

	/**
	 * Varsayılan değerlerin virgülle ayrılmış listesi.
	 *
	 * @return string
	 */
	public static function default_csv() {
		return implode( ', ', array_map( 'strval', self::default_values() ) );
	}

	/**
	 * Kayıtlı bir tutar listesini YALNIZ okumak için hoşgörülü ayrıştırır: gereksiz karakterleri atar,
	 * ondalık ve "1.000" biçimli değerleri kabul eder, pozitif sayıları tutar (en çok 6).
	 *
	 * @param mixed $raw Virgül, boşluk ya da noktalı virgülle ayrılmış liste.
	 * @return float[]
	 */
	public static function parse_csv( $raw ) {
		$parts = preg_split( '/[\s,;]+/', is_scalar( $raw ) ? (string) $raw : '' );
		$out   = array();
		if ( ! is_array( $parts ) ) {
			return $out;
		}
		foreach ( $parts as $part ) {
			$n = (float) str_replace( ',', '.', (string) preg_replace( '/[^\d.,]/', '', (string) $part ) );
			if ( $n > 0 ) {
				$out[] = ( floor( $n ) === $n ) ? (float) (int) $n : round( $n, 2 );
			}
			if ( count( $out ) >= self::MAX ) {
				break;
			}
		}
		return $out;
	}
}

<?php
/**
 * Telefon kuralları: ülke bazlı ulusal numara uzunluğu, gruplama ve E.164 normalleştirme.
 *
 * Kaynak tek dosyadır: `phone-rules.json` (JS tarafı `assets/src/ui2-shared/phone.mjs` aynı dosyayı derlemeye alır).
 * Kural JS ile BİREBİR aynıdır; ortak vektörler: tests/fixtures/phone-vectors.json.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Phone_Rules
 */
class Phone_Rules {

	/**
	 * Çözümlenmiş tablo (istek başına bir kez).
	 *
	 * @var array<string, array{dial:string,min:int,max:int,groups:string,mobile:string,zero:bool}>|null
	 */
	private static $table = null;

	/**
	 * Arama kodu ortak olan ülkelerde gösterilecek ülke (JSON `_p`).
	 *
	 * @var array<string, string>
	 */
	private static $primary = array();

	/**
	 * Tüm ülke kuralları (iso2 küçük harf => kural).
	 *
	 * @return array<string, array{dial:string,min:int,max:int,groups:string,mobile:string,zero:bool}>
	 */
	public static function table() {
		if ( null !== self::$table ) {
			return self::$table;
		}
		$table = array();
		$file  = __DIR__ . '/phone-rules.json';
		$json  = is_readable( $file ) ? file_get_contents( $file ) : false; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- yerel eklenti dosyası.
		$data  = false !== $json ? json_decode( $json, true ) : null;
		if ( is_array( $data ) ) {
			foreach ( $data as $iso => $row ) {
				$iso = (string) $iso;
				if ( ! is_array( $row ) ) {
					continue;
				}
				if ( '_p' === $iso ) {
					foreach ( $row as $dial => $code ) {
						self::$primary[ (string) $dial ] = (string) $code;
					}
					continue;
				}
				if ( count( $row ) < 3 ) {
					continue;
				}
				$table[ $iso ] = array(
					'dial'   => (string) (int) $row[0],
					'min'    => (int) $row[1],
					'max'    => (int) $row[2],
					'groups' => isset( $row[3] ) ? (string) $row[3] : '',
					'mobile' => isset( $row[4] ) ? (string) $row[4] : '',
					'zero'   => ! empty( $row[5] ),
				);
			}
		}
		self::$table = $table;
		return $table;
	}

	/**
	 * Tek ülke kuralı (bilinmiyorsa null).
	 *
	 * @param string $iso ISO2.
	 * @return array{dial:string,min:int,max:int,groups:string,mobile:string,zero:bool}|null
	 */
	public static function rule( $iso ) {
		$iso   = is_string( $iso ) ? strtolower( $iso ) : '';
		$table = self::table();
		return isset( $table[ $iso ] ) ? $table[ $iso ] : null;
	}

	/**
	 * Aynı arama kodunu paylaşan ülkeler.
	 *
	 * @param string $dial Arama kodu (rakam).
	 * @return array<int, string> ISO2 listesi.
	 */
	private static function isos_for_dial( $dial ) {
		$out = array();
		foreach ( self::table() as $iso => $row ) {
			if ( $row['dial'] === $dial ) {
				$out[] = $iso;
			}
		}
		return $out;
	}

	/**
	 * Girdiyi çözümler: `+90 530…`, `0090…`, `0530…`, `530…`.
	 *
	 * @param mixed  $raw         Ham girdi.
	 * @param string $default_iso Ülke kodu yoksa varsayılan ülke (ISO2).
	 * @return array{status:string,iso:string,dial:string,national:string,e164:string,warning:bool}
	 *         status: empty | ok | short | long | unknown (ülke kodu tanınmadı).
	 */
	public static function parse( $raw, $default_iso = '' ) {
		self::table();
		$out    = array(
			'status'   => 'empty',
			'iso'      => '',
			'dial'     => '',
			'national' => '',
			'e164'     => '',
			'warning'  => false,
		);
		$raw    = is_scalar( $raw ) ? trim( (string) $raw ) : '';
		$digits = (string) preg_replace( '/\D/', '', $raw );
		if ( '' === $digits ) {
			return $out;
		}
		$default_iso = strtolower( (string) $default_iso );
		$explicit    = '+' === $raw[0];
		if ( ! $explicit && 0 === strpos( $digits, '00' ) ) {
			$explicit = true;
			$digits   = ltrim( $digits, '0' );
			if ( '' === $digits ) {
				return $out;
			}
		}

		if ( $explicit ) {
			$found = null;
			for ( $len = 3; $len >= 1; $len-- ) {
				$candidate = substr( $digits, 0, $len );
				$isos      = self::isos_for_dial( $candidate );
				if ( $isos ) {
					$found = array( $candidate, $isos );
					break;
				}
			}
			if ( null === $found ) {
				$out['status'] = 'unknown';
				return $out;
			}
			list( $dial, $isos ) = $found;
			$national            = (string) substr( $digits, strlen( $dial ) );
			if ( in_array( $default_iso, $isos, true ) ) {
				$iso = $default_iso;
			} elseif ( isset( self::$primary[ $dial ] ) && in_array( self::$primary[ $dial ], $isos, true ) ) {
				$iso = self::$primary[ $dial ];
			} else {
				$iso = $isos[0];
			}
		} else {
			$rule = self::rule( $default_iso );
			if ( null === $rule ) {
				$out['status']   = 'unknown';
				$out['national'] = $digits;
				return $out;
			}
			$iso      = $default_iso;
			$dial     = $rule['dial'];
			$isos     = self::isos_for_dial( $dial );
			$national = $digits;
		}

		$rule = self::rule( $iso );
		if ( null === $rule ) {
			$out['status'] = 'unknown';
			return $out;
		}
		if ( ! $rule['zero'] ) {
			$national = ltrim( $national, '0' );
		}
		$min = $rule['min'];
		$max = $rule['max'];
		foreach ( $isos as $other ) {
			$row = self::rule( $other );
			if ( $row ) {
				$min = min( $min, $row['min'] );
				$max = max( $max, $row['max'] );
			}
		}
		// Ülke kodu `+` olmadan yapıştırıldıysa (905301234567) ve numara sığmıyorsa kod ayıklanır.
		if ( ! $explicit && strlen( $national ) > $max && 0 === strpos( $national, $dial ) ) {
			$rest = (string) substr( $national, strlen( $dial ) );
			$rest = $rule['zero'] ? $rest : ltrim( $rest, '0' );
			if ( strlen( $rest ) >= $min && strlen( $rest ) <= $max ) {
				$national = $rest;
			}
		}
		$len = strlen( $national );
		if ( 0 === $len ) {
			return $out;
		}
		$out['iso']      = $iso;
		$out['dial']     = $dial;
		$out['national'] = $national;
		if ( $len < $min ) {
			$out['status'] = 'short';
			return $out;
		}
		if ( $len > $max ) {
			$out['status'] = 'long';
			return $out;
		}
		$out['status']  = 'ok';
		$out['e164']    = '+' . $dial . $national;
		$out['warning'] = '' !== $rule['mobile'] && 0 !== strpos( $national, $rule['mobile'] );
		return $out;
	}

	/**
	 * Doğrulama: boş değer geçerlidir (zorunluluk ayrı denetlenir).
	 *
	 * @param mixed  $raw         Ham girdi.
	 * @param string $default_iso Varsayılan ülke.
	 * @return string '' (geçerli), 'short', 'long' ya da 'unknown'.
	 */
	public static function error( $raw, $default_iso = '' ) {
		$result = self::parse( $raw, $default_iso );
		if ( 'ok' === $result['status'] || 'empty' === $result['status'] ) {
			return '';
		}
		// Varsayılan ülke bilinmiyorsa (kuralsız) eski ölçüt: en az 6 hane.
		if ( 'unknown' === $result['status'] && '' !== $result['national'] ) {
			return strlen( $result['national'] ) >= 6 ? '' : 'short';
		}
		return $result['status'];
	}

	/**
	 * WooCommerce'e aktarılacak E.164 değer; çözümlenemezse ham değer aynen döner (veri kaybı yok).
	 *
	 * @param mixed  $raw         Ham girdi.
	 * @param string $default_iso Varsayılan ülke.
	 * @return string
	 */
	public static function to_e164( $raw, $default_iso = '' ) {
		$result = self::parse( $raw, $default_iso );
		if ( 'ok' === $result['status'] ) {
			return $result['e164'];
		}
		return is_scalar( $raw ) ? trim( (string) $raw ) : '';
	}
}

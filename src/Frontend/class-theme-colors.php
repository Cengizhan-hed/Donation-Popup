<?php
/**
 * Tema renkleri: WordPress global stilleri / theme.json renk paletinden ana renk ve eylem rengi seçer; düğme yazı
 * rengini WCAG kontrastına göre belirler. Temaya özel ad ya da seçici YOKTUR; yalnız WordPress standart paleti
 * (`wp_get_global_settings( array( 'color', 'palette' ) )`, klasik temalarda `editor-color-palette` desteği).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Frontend;

defined( 'ABSPATH' ) || exit;

/**
 * Theme_Colors.
 */
class Theme_Colors {

	/**
	 * Ana renk için ad tercih sırası.
	 */
	const PRIMARY_SLUGS = array( 'primary', 'accent', 'secondary', 'contrast' );

	/**
	 * Eylem rengi için ad tercih sırası.
	 */
	const ACTION_SLUGS = array( 'accent', 'secondary' );

	/**
	 * Metin kontrastı alt sınırı (WCAG AA, normal metin).
	 */
	const MIN_TEXT_CONTRAST = 4.5;

	/**
	 * Geçerli '#rgb' / '#rrggbb' değerini 'rrggbb' (küçük harf) olarak verir; değilse ''.
	 *
	 * @param mixed $value Ham değer.
	 * @return string
	 */
	public static function normalize_hex( $value ) {
		$value = strtolower( trim( (string) $value ) );
		if ( 1 !== preg_match( '/^#([0-9a-f]{3}|[0-9a-f]{6})$/', $value, $m ) ) {
			return '';
		}
		$hex = $m[1];
		if ( 3 === strlen( $hex ) ) {
			$hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
		}
		return $hex;
	}

	/**
	 * WCAG göreli parlaklık (0..1).
	 *
	 * @param string $hex 'rrggbb'.
	 * @return float
	 */
	public static function luminance( $hex ) {
		$channels = array();
		foreach ( array( 0, 2, 4 ) as $offset ) {
			$c          = hexdec( substr( $hex, $offset, 2 ) ) / 255;
			$channels[] = $c <= 0.03928 ? $c / 12.92 : pow( ( $c + 0.055 ) / 1.055, 2.4 );
		}
		return 0.2126 * $channels[0] + 0.7152 * $channels[1] + 0.0722 * $channels[2];
	}

	/**
	 * İki renk arasındaki WCAG kontrast oranı (1..21).
	 *
	 * @param string $hex_a 'rrggbb'.
	 * @param string $hex_b 'rrggbb'.
	 * @return float
	 */
	public static function contrast( $hex_a, $hex_b ) {
		$a = self::luminance( $hex_a );
		$b = self::luminance( $hex_b );
		return ( max( $a, $b ) + 0.05 ) / ( min( $a, $b ) + 0.05 );
	}

	/**
	 * Verilen arka plan üzerinde okunur yazı rengi: beyaz ya da siyah (kontrastı yüksek olan).
	 *
	 * @param string $background '#hex' ya da 'rrggbb'.
	 * @return string '#ffffff' | '#000000' ('' = arka plan geçersiz).
	 */
	public static function text_on( $background ) {
		$hex = self::normalize_hex( '#' === substr( (string) $background, 0, 1 ) ? $background : '#' . $background );
		if ( '' === $hex ) {
			return '';
		}
		return self::contrast( $hex, 'ffffff' ) >= self::contrast( $hex, '000000' ) ? '#ffffff' : '#000000';
	}

	/**
	 * Düz paleti (slug => hex) en çok kullanılan kalıba göre normalleştirir: palette satırlarından geçerli #hex alır.
	 *
	 * @param mixed $palette WordPress palet çıktısı (düz liste ya da menşe => liste).
	 * @return array<string, string> slug => 'rrggbb' (ilk görülen kazanır).
	 */
	public static function flatten_palette( $palette ) {
		$out = array();
		if ( ! is_array( $palette ) ) {
			return $out;
		}
		if ( isset( $palette['theme'] ) || isset( $palette['custom'] ) || isset( $palette['default'] ) ) {
			// Menşe sırası: tema, kullanıcı; WordPress varsayılan paleti sitenin kendi rengi değildir, kullanılmaz.
			$ordered = array();
			foreach ( array( 'theme', 'custom' ) as $origin ) {
				if ( isset( $palette[ $origin ] ) && is_array( $palette[ $origin ] ) ) {
					$ordered[] = $palette[ $origin ];
				}
			}
		} else {
			$ordered = array( $palette ); // Düz liste.
		}
		foreach ( $ordered as $list ) {
			foreach ( $list as $item ) {
				if ( ! is_array( $item ) || ! isset( $item['color'] ) ) {
					continue;
				}
				$hex  = self::normalize_hex( $item['color'] );
				$slug = isset( $item['slug'] ) ? strtolower( (string) $item['slug'] ) : '';
				if ( '' === $hex ) {
					continue;
				}
				if ( '' === $slug ) {
					$slug = 'color-' . count( $out );
				}
				if ( ! isset( $out[ $slug ] ) ) {
					$out[ $slug ] = $hex;
				}
			}
		}
		return $out;
	}

	/**
	 * Doygunluk (0..1) ve açıklık (0..1).
	 *
	 * @param string $hex 'rrggbb'.
	 * @return array{0: float, 1: float}
	 */
	private static function sat_light( $hex ) {
		$r   = hexdec( substr( $hex, 0, 2 ) ) / 255;
		$g   = hexdec( substr( $hex, 2, 2 ) ) / 255;
		$b   = hexdec( substr( $hex, 4, 2 ) ) / 255;
		$max = max( $r, $g, $b );
		$min = min( $r, $g, $b );
		$l   = ( $max + $min ) / 2;
		$d   = $max - $min;
		$den = 1 - abs( 2 * $l - 1 );
		$s   = ( 0.0 === $d || $den <= 0.0 ) ? 0.0 : $d / $den;
		return array( $s, $l );
	}

	/**
	 * Ana renk: önce ad sırası (primary/accent/secondary/contrast) — yazı olarak beyaz zeminde okunur (≥3:1) olan;
	 * yoksa paletteki ilk koyu renk (beyaz zeminde ≥4.5:1). Bulunamazsa ''.
	 *
	 * @param array<string, string> $flat slug => hex.
	 * @return string 'rrggbb' ya da ''.
	 */
	public static function pick_primary( array $flat ) {
		foreach ( self::PRIMARY_SLUGS as $slug ) {
			if ( isset( $flat[ $slug ] ) && self::contrast( $flat[ $slug ], 'ffffff' ) >= 3.0 ) {
				return $flat[ $slug ];
			}
		}
		foreach ( $flat as $hex ) {
			if ( self::contrast( $hex, 'ffffff' ) >= self::MIN_TEXT_CONTRAST ) {
				return $hex;
			}
		}
		return '';
	}

	/**
	 * Eylem (bağış düğmesi) rengi: önce ad sırası (accent/secondary), sonra "vivid" adlı, sonra paletteki ilk canlı
	 * (doygunluk ≥0.45, açıklık 0.2–0.7), sonra ana renk. Düğme metni rengi `text_on` ile ayrıca ≥4.5:1 sağlanır.
	 *
	 * @param array<string, string> $flat    slug => hex.
	 * @param string                $primary Seçilen ana renk.
	 * @return string 'rrggbb' ya da ''.
	 */
	public static function pick_action( array $flat, $primary ) {
		foreach ( self::ACTION_SLUGS as $slug ) {
			if ( isset( $flat[ $slug ] ) && self::is_usable_action( $flat[ $slug ] ) ) {
				return $flat[ $slug ];
			}
		}
		foreach ( $flat as $slug => $hex ) {
			if ( false !== strpos( (string) $slug, 'vivid' ) && self::is_usable_action( $hex ) ) {
				return $hex;
			}
		}
		foreach ( $flat as $hex ) {
			list( $s, $l ) = self::sat_light( $hex );
			if ( $s >= 0.45 && $l >= 0.2 && $l <= 0.7 && self::is_usable_action( $hex ) ) {
				return $hex;
			}
		}
		return $primary;
	}

	/**
	 * Düğme zemini olarak kullanılabilir mi: ne beyaza ne zemine karışan (beyaza ≥1.5:1) ve yazısı ≥4.5:1 olan.
	 *
	 * @param string $hex 'rrggbb'.
	 * @return bool
	 */
	private static function is_usable_action( $hex ) {
		$text = self::text_on( $hex );
		$text = ltrim( $text, '#' );
		return '' !== $text && self::contrast( $hex, $text ) >= self::MIN_TEXT_CONTRAST && self::contrast( $hex, 'ffffff' ) >= 1.5;
	}

	/**
	 * Palet + (isteğe bağlı) yönetici özel renklerinden CSS değişkenleri üretir.
	 *
	 * @param mixed  $palette WordPress paleti.
	 * @param string $custom_brand  Yönetici ana rengi ('' = tema).
	 * @param string $custom_accent Yönetici düğme rengi ('' = tema).
	 * @return array<string, string> değişken adı => değer (boş = tema CSS varsayılanları).
	 */
	public static function variables( $palette, $custom_brand = '', $custom_accent = '' ) {
		$flat    = self::flatten_palette( $palette );
		$primary = self::normalize_hex( $custom_brand );
		$action  = self::normalize_hex( $custom_accent );
		if ( '' === $primary ) {
			$primary = self::pick_primary( $flat );
		}
		if ( '' === $action ) {
			$action = self::pick_action( $flat, $primary );
		}
		$vars = array();
		if ( '' !== $primary ) {
			$vars['--dp-color-primary']    = '#' . $primary;
			$vars['--dp-color-on-primary'] = self::text_on( $primary );
		}
		if ( '' !== $action ) {
			$vars['--dp-accent']          = '#' . $action;
			$vars['--dp-color-on-accent'] = self::text_on( $action );
		}
		return $vars;
	}

	/**
	 * Sitenin etkin renk paleti (WordPress standart yolu). Okunamazsa boş dizi.
	 *
	 * @return array<mixed>
	 */
	public static function site_palette() {
		$palette = array();
		if ( function_exists( 'wp_get_global_settings' ) ) {
			$palette = wp_get_global_settings( array( 'color', 'palette' ) );
		}
		$flat = self::flatten_palette( $palette );
		if ( ! $flat && function_exists( 'get_theme_support' ) ) {
			$support = get_theme_support( 'editor-color-palette' );
			if ( is_array( $support ) && isset( $support[0] ) && is_array( $support[0] ) ) {
				$palette = array( 'theme' => $support[0] );
			}
		}
		return is_array( $palette ) ? $palette : array();
	}

	/**
	 * `.donation-panel`/`.donation-panel` kökü için tek satır içi bildirim bloğu ('' = tema CSS varsayılanları).
	 *
	 * @param string $custom_brand  Yönetici ana rengi.
	 * @param string $custom_accent Yönetici düğme rengi.
	 * @return string `--dp-color-primary:#xxxxxx;...` biçiminde bildirimler.
	 */
	public static function declarations( $custom_brand = '', $custom_accent = '' ) {
		$out = '';
		foreach ( self::variables( self::site_palette(), $custom_brand, $custom_accent ) as $name => $value ) {
			if ( '' !== $value ) {
				$out .= $name . ':' . $value . ';';
			}
		}
		return $out;
	}
}

<?php
/**
 * Tema renkleri: WordPress global stilleri / theme.json renk paletinden ana renk ve eylem rengi seçer; düğme yazı
 * rengini WCAG kontrastına göre belirler. Temaya özel ad ya da seçici YOKTUR; yalnız WordPress standart paleti
 * (`wp_get_global_settings( array( 'color', 'palette' ) )`, klasik temalarda `editor-color-palette` desteği).
 *
 * Kural (12.3): yalnız AÇIKÇA ADLANDIRILMIŞ rol renkleri kullanılır (slug ya da ad; eşleme tablosu `PRIMARY_ROLES`,
 * `ACTION_ROLES`, `NUMBERED_ROLES`; docs/MIMARI.md). "İlk koyu / ilk canlı renk" gibi tahmin YOKTUR: rol adı yoksa
 * nötr varsayılan (`DEFAULT_PRIMARY`) açıkça yazılır ve yönetici "Renkler temadan okunamadı" uyarısını görür.
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
	 * Ana renk için rol adları (tercih sırası; slug ya da ad tam eşleşme). Beyaz zeminde yazı olarak ≥4.5:1 olan ilk
	 * eşleşme seçilir. `base`/`background` zemin rolüdür (CSS köprüsünde `--dp-color-surface`).
	 */
	const PRIMARY_ROLES = array( 'primary', 'brand', 'accent', 'secondary', 'contrast', 'foreground' );

	/**
	 * Eylem (düğme) rengi için rol adları (tercih sırası). Eşleşme yoksa ana renk kullanılır.
	 */
	const ACTION_ROLES = array( 'accent', 'secondary' );

	/**
	 * Numaralı rol adları (`accent-3`, `primary2`, ad "Accent 1"): tam ad eşleşmesi yoksa numara sırasıyla denenir.
	 */
	const NUMBERED_ROLES = array( 'primary', 'brand', 'accent', 'secondary' );

	/**
	 * Metin kontrastı alt sınırı (WCAG AA, normal metin).
	 */
	const MIN_TEXT_CONTRAST = 4.5;

	/**
	 * Nötr varsayılan: tema paletinde rol adı yoksa ana renk ve düğme rengi (core.css köprü yedeği ile aynı).
	 * Mürekkep laciverti; her site rengiyle uyumlu, beyazla kontrast ≈14:1.
	 */
	const DEFAULT_PRIMARY = '1e2a3b';

	/**
	 * Yönetici renk alanında kabul edilen CSS değişkeni: `var(--ad)` ya da `var(--ad, #yedek)`.
	 * Ad yalnız [a-zA-Z0-9_-]; yedek yalnız #hex. Başka her şey (url(), expression, `;`, `}` vb.) reddedilir.
	 */
	const VAR_PATTERN = '/^var\(\s*--([a-zA-Z0-9_-]{1,100})\s*(?:,\s*(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\s*)?\)$/D';

	/**
	 * Yönetici renk değerini doğrular: '#rgb'/'#rrggbb' (olduğu gibi) ya da kanonik `var(--ad)` / `var(--ad, #yedek)`.
	 * Geçersiz ya da boş ise ''.
	 *
	 * @param mixed $value Ham değer.
	 * @return string
	 */
	public static function sanitize_color( $value ) {
		if ( ! is_scalar( $value ) ) {
			return '';
		}
		$value = trim( (string) $value );
		if ( 1 === preg_match( '/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/D', $value ) ) {
			return $value;
		}
		$var = self::parse_var( $value );
		if ( null === $var ) {
			return '';
		}
		return 'var(--' . $var['name'] . ( '' !== $var['fallback'] ? ', #' . $var['fallback'] : '' ) . ')';
	}

	/**
	 * `var(--ad)` / `var(--ad, #yedek)` ayrıştırır.
	 *
	 * @param mixed $value Ham değer.
	 * @return array{name: string, fallback: string}|null Ad ve 'rrggbb' yedek ('' = yok); geçersizse null.
	 */
	public static function parse_var( $value ) {
		if ( ! is_scalar( $value ) ) {
			return null;
		}
		if ( 1 !== preg_match( self::VAR_PATTERN, trim( (string) $value ), $m ) ) {
			return null;
		}
		return array(
			'name'     => $m[1],
			'fallback' => isset( $m[2] ) ? self::normalize_hex( $m[2] ) : '',
		);
	}

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
	 * Palet satırlarını rol anahtarına göre dizer: anahtar = slug (küçük harf) ve ad (küçük harf, boşluk/alt çizgi → '-').
	 * Slug, adla çakışırsa kazanır; menşe sırası `flatten_palette` ile aynı (tema, kullanıcı; WP varsayılan paleti yok).
	 *
	 * @param mixed $palette WordPress paleti.
	 * @return array<string, array{hex: string, slug: string}>
	 */
	public static function role_entries( $palette ) {
		$out = array();
		if ( ! is_array( $palette ) ) {
			return $out;
		}
		if ( isset( $palette['theme'] ) || isset( $palette['custom'] ) || isset( $palette['default'] ) ) {
			$lists = array();
			foreach ( array( 'theme', 'custom' ) as $origin ) {
				if ( isset( $palette[ $origin ] ) && is_array( $palette[ $origin ] ) ) {
					$lists[] = $palette[ $origin ];
				}
			}
		} else {
			$lists = array( $palette );
		}
		$by_name = array();
		foreach ( $lists as $list ) {
			foreach ( $list as $item ) {
				if ( ! is_array( $item ) || ! isset( $item['color'] ) ) {
					continue;
				}
				$hex = self::normalize_hex( $item['color'] );
				if ( '' === $hex ) {
					continue;
				}
				$slug = isset( $item['slug'] ) && is_scalar( $item['slug'] ) ? self::role_key( (string) $item['slug'] ) : '';
				$name = isset( $item['name'] ) && is_scalar( $item['name'] ) ? self::role_key( (string) $item['name'] ) : '';
				if ( '' !== $slug && ! isset( $out[ $slug ] ) ) {
					$out[ $slug ] = array(
						'hex'  => $hex,
						'slug' => $slug,
					);
				}
				if ( '' !== $name && ! isset( $by_name[ $name ] ) ) {
					$by_name[ $name ] = array(
						'hex'  => $hex,
						'slug' => '' !== $slug ? $slug : $name,
					);
				}
			}
		}
		foreach ( $by_name as $key => $entry ) {
			if ( ! isset( $out[ $key ] ) ) {
				$out[ $key ] = $entry;
			}
		}
		return $out;
	}

	/**
	 * Slug/ad → rol anahtarı ("Accent 1" → "accent-1"); geçersizse ''.
	 *
	 * @param string $name Slug ya da ad.
	 * @return string
	 */
	private static function role_key( $name ) {
		$key = strtolower( trim( $name ) );
		$key = (string) preg_replace( '/[\s_]+/', '-', $key );
		return 1 === preg_match( '/^[a-z0-9-]{1,60}$/D', $key ) ? $key : '';
	}

	/**
	 * Rol adları sırasıyla (önce tam ad, sonra numaralı `rol-N`, numara sırasıyla) koşulu sağlayan ilk girdi.
	 *
	 * @param array<string, array{hex: string, slug: string}> $entries Rol girdileri.
	 * @param string[]                                          $roles   Tercih sırası.
	 * @param callable                                          $accept  Hex kabul koşulu.
	 * @return array{hex: string, slug: string}|null
	 */
	private static function find_role( array $entries, array $roles, callable $accept ) {
		foreach ( $roles as $role ) {
			if ( isset( $entries[ $role ] ) && $accept( $entries[ $role ]['hex'] ) ) {
				return $entries[ $role ];
			}
		}
		foreach ( $roles as $role ) {
			if ( ! in_array( $role, self::NUMBERED_ROLES, true ) ) {
				continue;
			}
			$numbered = array();
			foreach ( $entries as $key => $entry ) {
				if ( 1 === preg_match( '/^' . preg_quote( $role, '/' ) . '-?(\d{1,2})$/D', (string) $key, $m ) && ! isset( $numbered[ (int) $m[1] ] ) ) {
					$numbered[ (int) $m[1] ] = $entry;
				}
			}
			ksort( $numbered );
			foreach ( $numbered as $entry ) {
				if ( $accept( $entry['hex'] ) ) {
					return $entry;
				}
			}
		}
		return null;
	}

	/**
	 * Düz slug => hex dizisini rol girdisine çevirir (zaten rol girdisiyse aynen).
	 *
	 * @param array<string, mixed> $entries Girdi.
	 * @return array<string, array{hex: string, slug: string}>
	 */
	private static function as_entries( array $entries ) {
		$out = array();
		foreach ( $entries as $key => $value ) {
			if ( is_array( $value ) && isset( $value['hex'] ) ) {
				$out[ (string) $key ] = array(
					'hex'  => (string) $value['hex'],
					'slug' => isset( $value['slug'] ) ? (string) $value['slug'] : (string) $key,
				);
				continue;
			}
			$hex = is_string( $value ) ? self::normalize_hex( '#' . ltrim( $value, '#' ) ) : '';
			if ( '' !== $hex ) {
				$out[ (string) $key ] = array(
					'hex'  => $hex,
					'slug' => (string) $key,
				);
			}
		}
		return $out;
	}

	/**
	 * Ana renk: rol adlarından beyaz zeminde yazı olarak okunur (≥4.5:1) ilk renk. Rol yoksa '' (tahmin yok).
	 *
	 * @param array<string, mixed> $entries `role_entries` çıktısı ya da slug => hex.
	 * @return string 'rrggbb' ya da ''.
	 */
	public static function pick_primary( array $entries ) {
		$found = self::find_role( self::as_entries( $entries ), self::PRIMARY_ROLES, array( __CLASS__, 'is_readable_on_white' ) );
		return null !== $found ? $found['hex'] : '';
	}

	/**
	 * Eylem (bağış düğmesi) rengi: rol adlarından (accent, secondary ve numaralıları) düğme zemini olabilen ilk renk;
	 * yoksa ana renk (tahmin yok). Düğme yazısı `text_on` ile ayrıca ≥4.5:1 sağlanır.
	 *
	 * @param array<string, mixed> $entries Rol girdileri ya da slug => hex.
	 * @param string               $primary Seçilen ana renk.
	 * @return string 'rrggbb' ya da ''.
	 */
	public static function pick_action( array $entries, $primary ) {
		$found = self::find_role( self::as_entries( $entries ), self::ACTION_ROLES, array( __CLASS__, 'is_usable_action' ) );
		return null !== $found ? $found['hex'] : (string) $primary;
	}

	/**
	 * Beyaz zeminde yazı olarak okunur mu (≥4.5:1).
	 *
	 * @param string $hex 'rrggbb'.
	 * @return bool
	 */
	public static function is_readable_on_white( $hex ) {
		return self::contrast( $hex, 'ffffff' ) >= self::MIN_TEXT_CONTRAST;
	}

	/**
	 * Düğme zemini olarak kullanılabilir mi: ne beyaza ne zemine karışan (beyaza ≥1.5:1) ve yazısı ≥4.5:1 olan.
	 *
	 * @param string $hex 'rrggbb'.
	 * @return bool
	 */
	public static function is_usable_action( $hex ) {
		$text = self::text_on( $hex );
		$text = ltrim( $text, '#' );
		return '' !== $text && self::contrast( $hex, $text ) >= self::MIN_TEXT_CONTRAST && self::contrast( $hex, 'ffffff' ) >= 1.5;
	}

	/**
	 * Her rengin değeri ve KAYNAĞI. Ön yüz (`variables()`) ve yönetici ekranı (kaynak satırları) aynı kararı kullanır.
	 *
	 * Kaynaklar: 'custom' (yöneticinin #hex'i), 'custom-var' (yöneticinin CSS değişkeni; `hex` = sunucu yedeği),
	 * 'theme' (tema paleti rolü; `slug` dolu), 'primary' (yalnız düğme: ana rengi izler), 'default' (nötr varsayılan).
	 *
	 * @param mixed  $palette       WordPress paleti.
	 * @param string $custom_brand  Yönetici ana rengi ('' = tema).
	 * @param string $custom_accent Yönetici düğme rengi ('' = tema).
	 * @return array<string, array{hex: string, source: string, slug: string, var: string}> 'primary' ve 'action'.
	 */
	public static function resolve( $palette, $custom_brand = '', $custom_accent = '' ) {
		$entries = self::role_entries( $palette );
		$out     = array();
		$slots   = array(
			'primary' => is_scalar( $custom_brand ) ? (string) $custom_brand : '',
			'action'  => is_scalar( $custom_accent ) ? (string) $custom_accent : '',
		);
		foreach ( $slots as $slot => $given ) {
			$hex = self::normalize_hex( $given );
			if ( '' !== $hex ) {
				$out[ $slot ] = array(
					'hex'    => $hex,
					'source' => 'custom',
					'slug'   => '',
					'var'    => '',
				);
				continue;
			}
			$var   = self::parse_var( $given );
			$found = 'primary' === $slot
				? self::find_role( $entries, self::PRIMARY_ROLES, array( __CLASS__, 'is_readable_on_white' ) )
				: self::find_role( $entries, self::ACTION_ROLES, array( __CLASS__, 'is_usable_action' ) );
			if ( null !== $found ) {
				$entry = array(
					'hex'    => $found['hex'],
					'source' => 'theme',
					'slug'   => $found['slug'],
					'var'    => '',
				);
			} elseif ( 'action' === $slot ) {
				$entry = array(
					'hex'    => $out['primary']['hex'],
					'source' => 'primary',
					'slug'   => '',
					'var'    => '',
				);
			} else {
				$entry = array(
					'hex'    => self::DEFAULT_PRIMARY,
					'source' => 'default',
					'slug'   => '',
					'var'    => '',
				);
			}
			if ( null !== $var ) {
				// Değişken sunucuda çözülemez: tarayıcı çözer. Sunucu yedeği: açık yedek → tema rolü / ana renk / varsayılan.
				$entry['source'] = 'custom-var';
				$entry['var']    = $var['name'];
				if ( '' !== $var['fallback'] ) {
					$entry['hex']  = $var['fallback'];
					$entry['slug'] = '';
				}
			}
			$out[ $slot ] = $entry;
		}
		return $out;
	}

	/**
	 * Palet + (isteğe bağlı) yönetici özel renklerinden CSS değişkenleri üretir (`resolve()` kararı). Rol adı yoksa
	 * nötr varsayılan AÇIKÇA yazılır; CSS köprüsü tahmin yapmaz.
	 *
	 * @param mixed  $palette WordPress paleti.
	 * @param string $custom_brand  Yönetici ana rengi ('' = tema).
	 * @param string $custom_accent Yönetici düğme rengi ('' = tema).
	 * @return array<string, string> değişken adı => değer.
	 */
	public static function variables( $palette, $custom_brand = '', $custom_accent = '' ) {
		$res  = self::resolve( $palette, $custom_brand, $custom_accent );
		$vars = array();
		$map  = array(
			'primary' => array( '--dp-color-primary', '--dp-color-on-primary' ),
			'action'  => array( '--dp-accent', '--dp-color-on-accent' ),
		);
		$dyn  = false;
		foreach ( $map as $slot => $names ) {
			$entry = $res[ $slot ];
			if ( '' !== $entry['var'] ) {
				// Tarayıcı betiği çözülen renge göre yazı rengini yalnız gerekirse günceller (`--dp-color-dynamic`).
				$vars[ $names[0] ] = 'var(--' . $entry['var'] . ', #' . $entry['hex'] . ')';
				$dyn               = true;
			} else {
				$vars[ $names[0] ] = '#' . $entry['hex'];
			}
			$vars[ $names[1] ] = self::text_on( $entry['hex'] );
		}
		if ( $dyn ) {
			$vars['--dp-color-dynamic'] = '1';
		}
		return $vars;
	}

	/**
	 * "Temamın renkleri" kaynağı durumu: 'theme' (ana renk bir palet rolünden), 'partial' (yalnız düğme rengi bir
	 * rolden; ana renk nötr varsayılan) ya da 'none' (palet yok/boş ya da rol adı yok → nötr varsayılan + uyarı).
	 *
	 * @param mixed $palette WordPress paleti; null ise sitenin etkin paleti.
	 * @return string 'theme' | 'partial' | 'none'
	 */
	public static function source_status( $palette = null ) {
		if ( null === $palette ) {
			$palette = self::site_palette();
		}
		$res = self::resolve( $palette );
		if ( 'theme' === $res['primary']['source'] ) {
			return 'theme';
		}
		return 'theme' === $res['action']['source'] ? 'partial' : 'none';
	}

	/**
	 * Yönetici için kaynak metni: "Theme palette: primary" / "Default" / "Your choice" / "Follows the main color".
	 *
	 * @param array{source: string, slug: string} $entry `resolve()` girdisi.
	 * @return string
	 */
	public static function source_label( array $entry ) {
		switch ( $entry['source'] ) {
			case 'custom':
			case 'custom-var':
				return __( 'Your choice', 'woo-donation-popup' );
			case 'theme':
				/* translators: %s: color name (slug) in the theme palette, e.g. primary. */
				return sprintf( __( 'Theme palette: %s', 'woo-donation-popup' ), $entry['slug'] );
			case 'primary':
				return __( 'Follows the main color', 'woo-donation-popup' );
		}
		return __( 'Default', 'woo-donation-popup' );
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
		return self::join( self::variables( self::site_palette(), $custom_brand, $custom_accent ) );
	}

	/**
	 * Formun `style` özniteliği için yalnız verilen (geçerli) özel renklerin bildirimleri: #hex için renk + okunur yazı
	 * rengi; `var(--ad[, #yedek])` için `variables()` çıktısındaki değişken + yedeğe göre güvenli yazı rengi + dinamik işaret.
	 * Geçersiz/boş değer bildirim üretmez (tema/belirteç rengi kalır).
	 *
	 * @param string $brand  Ana renk.
	 * @param string $accent Düğme rengi.
	 * @return string
	 */
	public static function form_style( $brand, $accent ) {
		$slots = array(
			'brand'  => array( '--dp-color-primary', '--dp-color-on-primary' ),
			'accent' => array( '--dp-accent', '--dp-color-on-accent' ),
		);
		$given = array(
			'brand'  => (string) $brand,
			'accent' => (string) $accent,
		);
		$vars  = null;
		$out   = array();
		foreach ( $slots as $slot => $names ) {
			$hex = self::normalize_hex( $given[ $slot ] );
			if ( '' !== $hex ) {
				$out[ $names[0] ] = '#' . $hex;
				$out[ $names[1] ] = self::text_on( $hex );
				continue;
			}
			if ( null === self::parse_var( $given[ $slot ] ) ) {
				continue;
			}
			if ( null === $vars ) {
				$vars = self::variables( self::site_palette(), $given['brand'], $given['accent'] );
			}
			foreach ( $names as $name ) {
				if ( isset( $vars[ $name ] ) ) {
					$out[ $name ] = $vars[ $name ];
				}
			}
			$out['--dp-color-dynamic'] = '1';
		}
		return self::join( $out );
	}

	/**
	 * Değişken => değer dizisini `ad:değer;` dizgesine çevirir (boş değerler atlanır).
	 *
	 * @param array<string, string> $vars Değişkenler.
	 * @return string
	 */
	private static function join( array $vars ) {
		$out = '';
		foreach ( $vars as $name => $value ) {
			if ( '' !== $value ) {
				$out .= $name . ':' . $value . ';';
			}
		}
		return $out;
	}
}

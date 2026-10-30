<?php
/**
 * Canlı kampanya çubuğu: tüm yüzeylerin (kart, form, compact kart) ortak sunucu yardımcısı.
 *
 * Çubuğun ön yüz yapılandırmasını (`data-dp-live-cfg`) üretir: gerçek toplam (herkese açık, kişi verisi yok), WooCommerce
 * para biçimi, ayarlar (kişisel önizleme, sayma animasyonu, kutlama) ve çevrilmiş kalıplar. Sayfa HTML'inde nonce ya
 * da kullanıcıya özel içerik yoktur; sepetteki tutar yalnız tarayıcıda okunur (önbellek güvenli).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Campaign;

use DonationPanel\Core\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Progress_Live.
 */
final class Progress_Live {

	/**
	 * Varlık slug'ı, betik ve stil yolları.
	 */
	const ASSET  = 'progress';
	const SCRIPT = 'assets/build/progress/index.js';
	const STYLE  = 'assets/build/progress/index.css';

	/**
	 * Ayar anahtarları (varsayılan: hepsi açık).
	 */
	const OPTIONS = array(
		'p' => 'progress.preview',
		'c' => 'progress.count',
		'k' => 'progress.celebrate',
	);

	/**
	 * Tutarı WooCommerce biçimiyle düz metne çevirir; tam sayıda ondalık yazılmaz ("£1,250", "£12.50").
	 *
	 * @param float $amount Gösterim birimindeki tutar.
	 * @return string
	 */
	public static function money( $amount ) {
		$amount = (float) $amount;
		if ( ! function_exists( 'wc_price' ) ) {
			return (string) $amount;
		}
		$decimals = function_exists( 'wc_get_price_decimals' ) ? (int) wc_get_price_decimals() : 2;
		$whole    = abs( $amount - round( $amount ) ) < 0.000001;
		$html     = (string) wc_price( $amount, array( 'decimals' => $whole ? 0 : $decimals ) );
		return trim( html_entity_decode( wp_strip_all_tags( $html ), ENT_QUOTES, 'UTF-8' ) );
	}

	/**
	 * Yüzde metni (çevrilmiş `%d%%` kalıbıyla; aşağı yuvarlanır; tam değilse en çok `$digits` ondalık).
	 *
	 * @param float $percent Yüzde.
	 * @param int   $digits  En çok ondalık (0: kart dışı yüzeyler, 1: kampanya kartı).
	 * @return string
	 */
	public static function percent_text( $percent, $digits = 1 ) {
		$scale = $digits > 0 ? 10 : 1;
		$shown = floor( max( 0.0, min( 100.0, (float) $percent ) ) * $scale + 1e-9 ) / $scale;
		$num   = floor( $shown ) === $shown ? (string) (int) $shown : number_format( $shown, 1, self::separator( 'decimal' ), '' );
		return str_replace( '{n}', $num, self::percent_pattern() );
	}

	/**
	 * Kesin yüzde (yuvarlanmamış; Progress_Data'nın tek ondalıklı yüzdesi 99,95'i 100'e yuvarlayabilir).
	 *
	 * @param array<string, mixed> $data Progress_Data çıktısı.
	 * @return float 0–100.
	 */
	public static function exact_percent( array $data ) {
		$goal = isset( $data['goal'] ) ? (float) $data['goal'] : 0.0;
		return $goal > 0 ? max( 0.0, min( 100.0, (float) $data['raised'] / $goal * 100.0 ) ) : 0.0;
	}

	/**
	 * Ayarlar: p (kişisel önizleme), c (dolum + sayma), k (hedefte kutlama).
	 *
	 * @return array{p: int, c: int, k: int}
	 */
	public static function options() {
		$settings = new Settings();
		$out      = array();
		foreach ( self::OPTIONS as $short => $path ) {
			$out[ $short ] = $settings->get( $path, true ) ? 1 : 0;
		}
		return $out;
	}

	/**
	 * Ön yüz yapılandırması (saf veri; `attr()` ile basılır).
	 *
	 * @param array<string, mixed> $data  Progress_Data çıktısı.
	 * @param bool                 $fresh Görününce taze veri istensin mi (önbellekli sayfadaki kampanya kartı).
	 * @param array{p: int, c: int, k: int}|null $options Ayarlar (null: kayıtlı ayarlar).
	 * @param int                                $digits  Yüzdede en çok ondalık (kart 1, diğer yüzeyler 0).
	 * @return array<string, mixed>
	 */
	public static function config( array $data, $fresh = false, $options = null, $digits = 0 ) {
		$config = array(
			'id'      => (int) $data['product_id'],
			'pd'      => $digits > 0 ? 1 : 0,
			'raised'  => round( (float) $data['raised'], 4 ),
			'goal'    => round( (float) $data['goal'], 4 ),
			'donors'  => (int) $data['donors'],
			'reached' => ! empty( $data['reached'] ),
			'cur'     => self::currency( isset( $data['currency'] ) ? (array) $data['currency'] : array() ),
			'o'       => is_array( $options ) ? $options : self::options(),
			't'       => self::texts(),
		);
		if ( $fresh ) {
			$config['fresh'] = 1;
		}
		// Güvenlik: yapılandırma yalnız veri taşır (sayı, metin kalıbı); adres yoktur ve ön yüz hiçbir öznitelikten betik/stil
		// yüklemez. Çubuk varlıkları yalnız sunucunun kuyruğundan (Assets) gelir.
		return $config;
	}

	/**
	 * Kök öznitelikleri: `data-dp-live-cfg` (JSON) ve animasyon kapalıysa durağan sınıfı (`class` ayrıca verilir).
	 *
	 * @param array<string, mixed> $config Yapılandırma.
	 * @return string Başında boşluk olan öznitelik dizisi.
	 */
	public static function attr( array $config ) {
		return ' data-dp-live-cfg="' . esc_attr( (string) wp_json_encode( $config ) ) . '"';
	}

	/**
	 * Kök sınıfı (sayma/dolum kapalıysa `donation-panel-live--static`).
	 *
	 * @param array<string, mixed> $config Yapılandırma.
	 * @return string Başında boşluk olan sınıf ya da boş.
	 */
	public static function root_class( array $config ) {
		return empty( $config['o']['c'] ) ? ' donation-panel-live--static' : '';
	}

	/**
	 * Erişilebilir değer metni: "42% · £1,250 of £3,000 goal".
	 *
	 * @param array<string, mixed> $data   Progress_Data çıktısı.
	 * @param int                  $digits Yüzdede en çok ondalık.
	 * @return string
	 */
	public static function value_text( array $data, $digits = 0 ) {
		/* translators: %s: formatted goal amount */
		return self::percent_text( self::exact_percent( $data ), $digits ) . ' · ' . self::money( (float) $data['raised'] ) . ' ' . sprintf( __( 'of %s goal', 'woo-donation-popup' ), self::money( (float) $data['goal'] ) );
	}

	/**
	 * İlk bağıştan önce gösterilen çağrı (yönetici metni ya da çevrilmiş varsayılan).
	 *
	 * @return string
	 */
	public static function first_text() {
		$text = trim( sanitize_text_field( (string) ( new Settings() )->get( 'compact.first_text', '' ) ) );
		return '' !== $text ? $text : __( 'Be the first to give', 'woo-donation-popup' );
	}

	/**
	 * Çevrilmiş kalıplar (%1$s: kişisel tutar, %2$s: yeni toplam).
	 *
	 * @return array<string, string>
	 */
	public static function texts() {
		return array(
			/* translators: 1: the donor's own gift, 2: campaign total including that gift. */
			'with' => __( 'With your %1$s it reaches %2$s', 'woo-donation-popup' ),
			/* translators: 1: amount for this campaign in the donor's cart, 2: campaign total including it. */
			'cart' => __( '%1$s in your cart · reaches %2$s', 'woo-donation-popup' ),
			/* translators: 1: the donor's own gift. */
			'goal' => __( 'Your %1$s completes the goal!', 'woo-donation-popup' ),
			'pct'  => self::percent_pattern(),
			/* translators: %s: formatted goal amount */
			'vt'   => __( 'of %s goal', 'woo-donation-popup' ),
		);
	}

	/**
	 * Çevrilmiş yüzde kalıbı `{n}` yer tutucusuyla (ör. "{n}%", Türkçe "%{n}").
	 *
	 * @return string
	 */
	private static function percent_pattern() {
		/* translators: %d: percent of goal reached. */
		$pattern = __( '%d%%', 'woo-donation-popup' );
		return str_replace( array( '%d', '%%' ), array( '{n}', '%' ), $pattern );
	}

	/**
	 * WooCommerce para biçimi (simge, ondalık, ayırıcılar, simge konumu).
	 *
	 * @param array<string, mixed> $currency Progress_Data para birimi (simge/ondalık).
	 * @return array<string, mixed>
	 */
	private static function currency( array $currency ) {
		return array(
			's'   => isset( $currency['symbol'] ) ? (string) $currency['symbol'] : '',
			'd'   => isset( $currency['decimals'] ) ? max( 0, (int) $currency['decimals'] ) : 2,
			'ds'  => self::separator( 'decimal' ),
			'ts'  => self::separator( 'thousand' ),
			'pos' => (string) get_option( 'woocommerce_currency_pos', 'left' ),
		);
	}

	/**
	 * WooCommerce ayırıcısı.
	 *
	 * @param string $which decimal|thousand.
	 * @return string
	 */
	private static function separator( $which ) {
		if ( 'decimal' === $which ) {
			return function_exists( 'wc_get_price_decimal_separator' ) ? (string) wc_get_price_decimal_separator() : '.';
		}
		return function_exists( 'wc_get_price_thousand_separator' ) ? (string) wc_get_price_thousand_separator() : ',';
	}
}

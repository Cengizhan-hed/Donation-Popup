<?php
/**
 * Compact bağış kartı (`[wdp_donation_form layout="compact"]`): slider/hero içinde yüksekliği HİÇ değişmeyen kart. Adım sayısı
 * ödeme akışına göre: sepetli 2 adım (tutar → bilgiler + "Ödemeye geç"), doğrudan 3 adım (tutar → bilgiler → ödeme) + teşekkür.
 * Form modelinden (Form_Context) türetilir; kişi verisi içermez.
 *
 * - Adımlar aynı CSS grid hücresinde üst üste durur; kart yüksekliği en uzun adıma eşittir (JS ölçümü yok).
 * - Tutar önceden seçilmez; "Önerilen" etiketi yalnız yöneticinin tanımladığı tutarda.
 * - Hisseli bağış (hissedar başına alan) kartın sabit yüksekliğine sığmaz: bu türde bugünkü sayfa içi form çizilir.
 * - İşlem ücreti, ek bağış, ithaf ve not kartta sunulmaz (yüksekliği değiştirir); sunucu kuralları aynıdır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Experiences;

use DonationPanel\Core\Settings;
use DonationPanel\Frontend\Template_Loader;

defined( 'ABSPATH' ) || exit;

/**
 * Compact_Card.
 */
final class Compact_Card {

	/**
	 * Kap adı (kısa kod `layout` değeri).
	 */
	const LAYOUT = 'compact';

	/**
	 * Varlık slug'ı (assets/build/compact).
	 */
	const ASSET = 'compact';

	/**
	 * Koşullu stil parçaları (yalnız CSS): vergi beyanı ve doğrudan bağış (ödeme adımı + teşekkür). Gerekmeyen kartta
	 * basılmaz (sepetli, beyansız kart yalnız temel paketi taşır).
	 */
	const ASSET_TAX = 'compact-tax';
	const ASSET_PAY = 'compact-pay';

	/**
	 * Kart alanları (bilgiler adımı; sıra: ad, e-posta, telefon).
	 */
	const FIELDS = array( 'donation_full_name', 'donation_email', 'donation_phone' );

	/**
	 * Şablon yükleyici.
	 *
	 * @var Template_Loader
	 */
	private $loader;

	/**
	 * Kurucu.
	 *
	 * @param Template_Loader $loader Şablon yükleyici.
	 */
	public function __construct( Template_Loader $loader ) {
		$this->loader = $loader;
	}

	/**
	 * Bu model compact kartta çizilebilir mi (hisseli bağış çizilemez).
	 *
	 * @param array<string, mixed> $model Form modeli.
	 * @return bool
	 */
	public static function supports( array $model ) {
		return ! empty( $model['product_id'] ) && 'shares' !== ( isset( $model['kind'] ) ? (string) $model['kind'] : '' );
	}

	/**
	 * Bu kartın temel paket dışında gerektirdiği stil parçaları (saf; test edilebilir).
	 *
	 * @param array<string, mixed> $model Form modeli.
	 * @return string[]
	 */
	public static function extra_styles( array $model ) {
		$out   = array();
		$steps = array_column( (array) ( isset( $model['steps'] ) ? $model['steps'] : array() ), 'id' );
		if ( in_array( 'tax_relief', $steps, true ) ) {
			$out[] = self::ASSET_TAX;
		}
		if ( ! empty( $model['direct'] ) ) {
			$out[] = self::ASSET_PAY;
		}
		return $out;
	}

	/**
	 * Kartı çizer.
	 *
	 * @param array<string, mixed> $model Form modeli.
	 * @param array<string, mixed> $args  `rest_url`, `checkout_url`.
	 * @return string
	 */
	public function render( array $model, array $args = array() ) {
		if ( ! self::supports( $model ) ) {
			return '';
		}
		static $counter = 0;
		++$counter;
		$raw  = self::campaign_raw( $model );
		$view = self::view( $model, self::settings(), $raw ? $raw['raised'] : null, $raw ? $raw['goal'] : null );
		return $this->loader->render_to_string(
			'experiences/compact.php',
			array(
				'model'   => $model,
				'view'    => $view,
				'dom_key' => 'dp-' . (int) $model['product_id'] . '-compact-' . $counter,
				'args'    => array_merge(
					array(
						'rest_url'     => '',
						'checkout_url' => '',
					),
					$args
				),
			)
		);
	}

	/**
	 * Kart ayarları (geçersiz değerler güvenli varsayılana düşer).
	 *
	 * @return array{quick: int, first_text: string, reset_hidden: bool, trust: bool}
	 */
	public static function settings() {
		$settings = new Settings();
		return self::normalize_settings(
			array(
				'quick'        => $settings->get( 'compact.quick_amounts', 3 ),
				'first_text'   => $settings->get( 'compact.first_text', '' ),
				'reset_hidden' => $settings->get( 'compact.reset_hidden', false ),
				'trust'        => $settings->get( 'compact.trust', true ),
			)
		);
	}

	/**
	 * Ayarları sınırlar (saf; test edilebilir).
	 *
	 * @param array<string, mixed> $raw Ham ayarlar.
	 * @return array{quick: int, first_text: string, reset_hidden: bool, trust: bool}
	 */
	public static function normalize_settings( array $raw ) {
		$quick = isset( $raw['quick'] ) && is_numeric( $raw['quick'] ) ? (int) $raw['quick'] : 3;
		return array(
			'quick'        => min( 3, max( 0, $quick ) ),
			'first_text'   => isset( $raw['first_text'] ) && is_scalar( $raw['first_text'] ) ? trim( sanitize_text_field( (string) $raw['first_text'] ) ) : '',
			'reset_hidden' => ! empty( $raw['reset_hidden'] ),
			// Güven satırı varsayılan açık; yalnız açıkça kapatılırsa gizlenir.
			'trust'        => ! array_key_exists( 'trust', $raw ) || ( ! empty( $raw['trust'] ) && 'no' !== $raw['trust'] ),
		);
	}

	/**
	 * Kampanyada toplanan ve hedef ham tutarlar (sıfır durumu ve gereksiz ondalıksız biçim için); kampanya yoksa null.
	 *
	 * @param array<string, mixed> $model Form modeli.
	 * @return array{raised: float, goal: float|null}|null
	 */
	private static function campaign_raw( array $model ) {
		if ( empty( $model['campaign'] ) || ! class_exists( '\DonationPanel\Modules\Campaign\Progress_Data' ) ) {
			return null;
		}
		$data = \DonationPanel\Modules\Campaign\Progress_Data::for_product( (int) $model['product_id'] );
		if ( ! is_array( $data ) || ! isset( $data['raised'] ) ) {
			return null;
		}
		return array(
			'raised' => (float) $data['raised'],
			'goal'   => isset( $data['goal'] ) ? (float) $data['goal'] : null,
		);
	}

	/**
	 * Tutarı WooCommerce biçimiyle düz metne çevirir; tam sayıda ondalık yazılmaz (£3,000 — £3,000.00 değil). Ayırıcı, simge
	 * konumu ve ondalık sayısı mağaza ayarından.
	 *
	 * @param float $amount Tutar (gösterim biriminde).
	 * @return string
	 */
	public static function money( $amount ) {
		$amount = (float) $amount;
		$whole  = abs( $amount - round( $amount ) ) < 0.005;
		if ( ! function_exists( 'wc_price' ) ) {
			return number_format_i18n( $amount, $whole ? 0 : 2 );
		}
		$decimals = function_exists( 'wc_get_price_decimals' ) ? (int) wc_get_price_decimals() : 2;
		$html     = (string) wc_price( $whole ? round( $amount ) : $amount, array( 'decimals' => $whole ? 0 : $decimals ) );
		return trim( html_entity_decode( wp_strip_all_tags( $html ), ENT_QUOTES, 'UTF-8' ) );
	}

	/**
	 * Şablon görünüm verisi (saf; test edilebilir).
	 *
	 * @param array<string, mixed> $model    Form modeli.
	 * @param array<string, mixed> $settings Kart ayarları (normalize_settings çıktısı).
	 * @param float|null           $raised   Kampanyada toplanan (null: kampanya yok / modeldeki metin).
	 * @param float|null           $goal     Kampanya hedefi (null: modeldeki metin).
	 * @return array<string, mixed>
	 */
	public static function view( array $model, array $settings, $raised = null, $goal = null ) {
		$kind        = isset( $model['kind'] ) ? (string) $model['kind'] : 'custom';
		$fixed       = 'fixed' === $kind;
		$presets     = $fixed ? array() : array_values( array_map( 'floatval', (array) ( isset( $model['presets'] ) ? $model['presets'] : array() ) ) );
		$recommended = isset( $model['recommended'] ) && is_numeric( $model['recommended'] ) ? (float) $model['recommended'] : null;
		$quick       = self::quick_amounts( $presets, (int) $settings['quick'], $recommended );
		$campaign    = isset( $model['campaign'] ) && is_array( $model['campaign'] ) ? $model['campaign'] : array();
		$first_text  = '' !== (string) $settings['first_text'] ? (string) $settings['first_text'] : __( 'Be the first to give', 'woo-donation-popup' );

		$fields = array();
		foreach ( (array) ( isset( $model['fields'] ) ? $model['fields'] : array() ) as $field ) {
			if ( is_array( $field ) && isset( $field['name'] ) && in_array( (string) $field['name'], self::FIELDS, true ) ) {
				$fields[ (string) $field['name'] ] = $field;
			}
		}
		$ordered = array();
		foreach ( self::FIELDS as $name ) {
			if ( isset( $fields[ $name ] ) ) {
				$ordered[] = $fields[ $name ];
			}
		}

		$step_ids = array_column( (array) ( isset( $model['steps'] ) ? $model['steps'] : array() ), 'id' );

		return array(
			'fixed'        => $fixed,
			// Sabit tutarda tutar alanı yok; serbest tutarda alan her zaman (hızlı tutar 0 iken yalnız alan).
			'custom'       => ! $fixed && ( ! empty( $model['allow_custom'] ) || ! $quick ),
			'quick'        => $quick,
			'recommended'  => null !== $recommended && in_array( $recommended, $quick, true ) ? $recommended : null,
			'campaign'     => $campaign ? array(
				// Ham tutar varsa kart kendisi biçimler (tam sayıda ".00" yok); yoksa modeldeki hazır metin.
				'raised'  => null !== $raised ? self::money( $raised ) : ( isset( $campaign['raised'] ) ? (string) $campaign['raised'] : '' ),
				'goal'    => null !== $goal ? self::money( $goal ) : ( isset( $campaign['goal'] ) ? (string) $campaign['goal'] : '' ),
				'percent' => isset( $campaign['percent'] ) ? max( 0, (int) $campaign['percent'] ) : 0,
				'donors'  => isset( $campaign['donors'] ) ? max( 0, (int) $campaign['donors'] ) : 0,
				'zero'    => null !== $raised ? $raised <= 0 : ( isset( $campaign['zero'] ) ? ! empty( $campaign['zero'] ) : ( empty( $campaign['percent'] ) && empty( $campaign['donors'] ) ) ),
				// Canlı çubuk (Campaign modülü): kesin yüzde, erişilebilir değer metni ve ön yüz yapılandırması.
				'exact'   => isset( $campaign['percent_exact'] ) ? (float) $campaign['percent_exact'] : ( isset( $campaign['percent'] ) ? (float) $campaign['percent'] : 0.0 ),
				'vtext'   => isset( $campaign['value_text'] ) ? (string) $campaign['value_text'] : '',
				'live'    => isset( $campaign['live'] ) && is_array( $campaign['live'] ) ? $campaign['live'] : array(),
			) : array(),
			'first_text'   => $first_text,
			'impact'       => $campaign ? '' : self::impact_text( $model ),
			'fields'       => $ordered,
			'tax_relief'   => in_array( 'tax_relief', $step_ids, true ),
			'reset_hidden' => ! empty( $settings['reset_hidden'] ),
			'trust'        => ! isset( $settings['trust'] ) || ! empty( $settings['trust'] ),
			// Adım göstergesi gerçek sayıyı gösterir: sepetli 2 (tutar, bilgiler), doğrudan 3 (tutar, bilgiler, ödeme).
			'steps'        => ! empty( $model['direct'] ) ? 3 : 2,
			// Seçilen tutarın etki ifadesi (Etki ifadeleri modülü; yöneticinin yazdığı kademeler). Yoksa satır çizilmez.
			'impact_tiers' => self::impact_tiers( $model ),
		);
	}

	/**
	 * Etki kademeleri (birim, tekil, çoğul) — yalnız düz metin; modül kapalıysa boş.
	 *
	 * @param array<string, mixed> $model Form modeli.
	 * @return array<int, array{unit: float, one: string, other: string}>
	 */
	private static function impact_tiers( array $model ) {
		$tiers = isset( $model['impact']['tiers'] ) && is_array( $model['impact']['tiers'] ) ? $model['impact']['tiers'] : array();
		$out   = array();
		foreach ( $tiers as $tier ) {
			if ( is_array( $tier ) && isset( $tier['unit'], $tier['one'] ) && (float) $tier['unit'] > 0 ) {
				$out[] = array(
					'unit'  => (float) $tier['unit'],
					'one'   => wp_strip_all_tags( (string) $tier['one'] ),
					'other' => wp_strip_all_tags( (string) ( isset( $tier['other'] ) ? $tier['other'] : $tier['one'] ) ),
				);
			}
		}
		return $out;
	}

	/**
	 * En çok N hızlı tutar; önerilen tutar ilk N içinde değilse sondakinin yerine geçer (sıra korunur).
	 *
	 * @param float[]    $presets     Ürün tutarları.
	 * @param int        $limit       0–3.
	 * @param float|null $recommended Önerilen tutar.
	 * @return float[]
	 */
	public static function quick_amounts( array $presets, $limit, $recommended = null ) {
		$limit   = min( 3, max( 0, (int) $limit ) );
		$presets = array_values( array_filter( array_map( 'floatval', $presets ), static fn( $v ) => $v > 0 ) );
		if ( 0 === $limit || ! $presets ) {
			return array();
		}
		$picked = array_slice( $presets, 0, $limit );
		if ( null !== $recommended && ! in_array( (float) $recommended, $picked, true ) && in_array( (float) $recommended, $presets, true ) ) {
			$picked[ count( $picked ) - 1 ] = (float) $recommended;
			usort(
				$picked,
				static fn( $a, $b ) => array_search( $a, $presets, true ) <=> array_search( $b, $presets, true )
			);
		}
		return $picked;
	}

	/**
	 * Hedefsiz üründe kısa etki cümlesi: yöneticinin yazdığı ürün kısa açıklaması (etiketsiz, tek paragraf);
	 * `donation_panel_compact_text` ile değişir. Eklenti metin/rakam uydurmaz: boşsa hiçbir şey gösterilmez.
	 *
	 * @param array<string, mixed> $model Form modeli.
	 * @return string
	 */
	private static function impact_text( array $model ) {
		$text    = '';
		$product = function_exists( 'wc_get_product' ) ? wc_get_product( (int) $model['product_id'] ) : null;
		if ( is_object( $product ) && method_exists( $product, 'get_short_description' ) ) {
			$text = trim( preg_replace( '/\s+/u', ' ', wp_strip_all_tags( (string) $product->get_short_description() ) ) );
		}
		/**
		 * Compact kartta hedefsiz ürünün kısa etki cümlesi (düz metin; kart en çok iki satır gösterir).
		 *
		 * @param string $text       Metin ('' = gösterme).
		 * @param int    $product_id Ürün.
		 */
		return trim( wp_strip_all_tags( (string) apply_filters( 'donation_panel_compact_text', $text, (int) $model['product_id'] ) ) );
	}
}

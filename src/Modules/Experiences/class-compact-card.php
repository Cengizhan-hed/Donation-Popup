<?php
/**
 * Compact bağış kartı (`[wdp_donation_form layout="compact"]`): slider/hero içinde yüksekliği HİÇ değişmeyen 4 adımlı kart
 * (tutar → bilgiler → ödeme → teşekkür). Form modelinden (Form_Context) türetilir; kişi verisi içermez.
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
		$view = self::view( $model, self::settings(), self::campaign_raised( $model ) );
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
	 * @return array{quick: int, first_text: string, reset_hidden: bool}
	 */
	public static function settings() {
		$settings = new Settings();
		return self::normalize_settings(
			array(
				'quick'        => $settings->get( 'compact.quick_amounts', 3 ),
				'first_text'   => $settings->get( 'compact.first_text', '' ),
				'reset_hidden' => $settings->get( 'compact.reset_hidden', false ),
			)
		);
	}

	/**
	 * Ayarları sınırlar (saf; test edilebilir).
	 *
	 * @param array<string, mixed> $raw Ham ayarlar.
	 * @return array{quick: int, first_text: string, reset_hidden: bool}
	 */
	public static function normalize_settings( array $raw ) {
		$quick = isset( $raw['quick'] ) && is_numeric( $raw['quick'] ) ? (int) $raw['quick'] : 3;
		return array(
			'quick'        => min( 3, max( 0, $quick ) ),
			'first_text'   => isset( $raw['first_text'] ) && is_scalar( $raw['first_text'] ) ? trim( sanitize_text_field( (string) $raw['first_text'] ) ) : '',
			'reset_hidden' => ! empty( $raw['reset_hidden'] ),
		);
	}

	/**
	 * Kampanyada toplanan ham tutar (sıfır durumu için); kampanya yoksa null.
	 *
	 * @param array<string, mixed> $model Form modeli.
	 * @return float|null
	 */
	private static function campaign_raised( array $model ) {
		if ( empty( $model['campaign'] ) || ! class_exists( '\DonationPanel\Modules\Campaign\Progress_Data' ) ) {
			return null;
		}
		$data = \DonationPanel\Modules\Campaign\Progress_Data::for_product( (int) $model['product_id'] );
		return is_array( $data ) && isset( $data['raised'] ) ? (float) $data['raised'] : null;
	}

	/**
	 * Şablon görünüm verisi (saf; test edilebilir).
	 *
	 * @param array<string, mixed>                                      $model    Form modeli.
	 * @param array{quick: int, first_text: string, reset_hidden: bool} $settings Kart ayarları.
	 * @param float|null                                                $raised   Kampanyada toplanan (null: kampanya yok).
	 * @return array<string, mixed>
	 */
	public static function view( array $model, array $settings, $raised = null ) {
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
				'raised'  => isset( $campaign['raised'] ) ? (string) $campaign['raised'] : '',
				'goal'    => isset( $campaign['goal'] ) ? (string) $campaign['goal'] : '',
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
		);
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

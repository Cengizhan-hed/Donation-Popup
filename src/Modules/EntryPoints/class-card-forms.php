<?php
/**
 * Liste/mağaza/döngü kartlarının formlarını sayfa HTML'ine gömer (12.4): ek istek yok, sayfa önbelleğiyle gelir.
 *
 * Kart düğmesi çizilince ürün + kap türü toplanır; sayfa sonunda (`wp_footer`) kap türü başına bir
 * `<script type="application/json" data-dp-forms>` basılır: `Form_Pack` paketi (ortak şablon + ürün başına fark),
 * kap türü ve form deneyimi/kampanya çubuğu paket adresleri (`donation_panel_experience_assets`). İçerik kullanıcıya özel
 * değildir: nonce boş (form ilk gönderimde REST'ten taze nonce alır), ön doldurma yok. Bağış listesi paketi liste
 * önbelleğinde (transient) HTML'le birlikte saklanır; döngü kartları için sayfa çiziminde üretilir.
 *
 * Bütçe: sayfada gömülü form baytı `PAGE_BUDGET` ile sınırlı; sığmayan kartın formu dokunma niyetinde tek istekle alınır.
 * `donation_panel_prefetch_forms` (bool, ürün, kap türü) false dönen ürün gömülmez (false = hiç gömme).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

use DonationPanel\Core\Plugin;
use DonationPanel\Modules\Experiences\Form_Controller;
use DonationPanel\Modules\Experiences\Form_Renderer;

defined( 'ABSPATH' ) || exit;

/**
 * Card_Forms.
 */
class Card_Forms {

	/** Sayfa başına gömülü form paketi bütçesi (ham JSON baytı; gzip ile aktarım bunun ~1/6'sı). */
	const PAGE_BUDGET = 196608;

	/** Kap türleri (katman). */
	const KINDS = array( 'popup', 'side_panel', 'bottom_sheet' );

	/**
	 * Hazır paketler (liste önbelleğinden): kap türü → paket listesi.
	 *
	 * @var array<string, array<int, array<string, mixed>>>
	 */
	private static $packs = array();

	/**
	 * Sayfa sonunda üretilecek ürünler: kap türü → ürün → true.
	 *
	 * @var array<string, array<int, bool>>
	 */
	private static $pending = array();

	/**
	 * Basılan bayt (bütçe).
	 *
	 * @var int
	 */
	private static $bytes = 0;

	/** @var bool */
	private static $hooked = false;

	/**
	 * Bu istekte sayfa sonunda gömülecek bir kart formu ekler (döngü kartı, önbelleksiz liste).
	 *
	 * @param int    $product_id Ürün.
	 * @param string $kind       Kap türü.
	 * @return void
	 */
	public static function add( $product_id, $kind ) {
		$kind = self::kind( $kind );
		if ( (int) $product_id < 1 ) {
			return;
		}
		self::$pending[ $kind ][ (int) $product_id ] = true;
		self::hook();
	}

	/**
	 * Önceden üretilmiş (önbellekteki) paketi ekler; `donation_panel_prefetch_forms` bir ürünü dışlıyorsa paket
	 * kullanılmaz, izinli ürünler sayfa sonunda yeniden üretilir.
	 *
	 * @param array<string, mixed> $payload `build()` çıktısı.
	 * @return void
	 */
	public static function add_payload( $payload ) {
		if ( ! is_array( $payload ) || empty( $payload['kind'] ) || empty( $payload['ids'] ) || empty( $payload['pack'] ) ) {
			return;
		}
		$kind    = self::kind( (string) $payload['kind'] );
		$ids     = array_map( 'intval', (array) $payload['ids'] );
		$allowed = self::allowed( $ids, $kind );
		if ( count( $allowed ) !== count( $ids ) ) {
			foreach ( $allowed as $id ) {
				self::add( $id, $kind );
			}
			return;
		}
		self::$packs[ $kind ][] = $payload;
		self::hook();
	}

	/**
	 * Ürün formlarını çizip paketler (bütçeye sığdığı kadar).
	 *
	 * @param int[]  $ids    Ürünler (sırayla; ilk kartlar önce).
	 * @param string $kind   Kap türü.
	 * @param int    $budget Ham bayt bütçesi.
	 * @return array<string, mixed>|null `kind`, `ids`, `pack`, `assets`, `bytes`; çizilecek form yoksa null.
	 */
	public static function build( array $ids, $kind, $budget = self::PAGE_BUDGET ) {
		$kind     = self::kind( $kind );
		$renderer = self::renderer();
		if ( null === $renderer || $budget <= 0 ) {
			return null;
		}
		$pack   = new Form_Pack();
		$models = array();
		$bytes  = 0;
		$args   = array(
			'rest_url'     => esc_url_raw( rest_url( 'donation-panel/v1/' ) ),
			'nonce'        => '',
			'checkout_url' => function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '',
		);
		foreach ( $ids as $product_id ) {
			$product_id = (int) $product_id;
			if ( $product_id < 1 || $pack->has( $product_id ) ) {
				continue;
			}
			$model = Form_Controller::model_for_id( $product_id );
			if ( empty( $model ) ) {
				continue;
			}
			$html = $renderer->render( $model, $kind, $args );
			if ( '' === $html ) {
				continue;
			}
			$added = $pack->add( $product_id, $html );
			if ( $added <= 0 ) {
				continue;
			}
			$bytes                += $added;
			$models[ $product_id ] = $model;
			if ( $bytes >= $budget ) {
				break; // Kalan kartlar dokunma niyetinde tek istekle alınır.
			}
		}
		if ( 0 === $pack->count() ) {
			return null;
		}
		$with = Experience_Controller::with_assets( array(), $models );
		return array(
			'kind'   => $kind,
			'ids'    => array_keys( $models ),
			'pack'   => $pack->to_array(),
			'assets' => isset( $with['assets'] ) ? $with['assets'] : array(),
		);
	}

	/**
	 * Sayfa sonu: kap türü başına paket(ler)i basar.
	 *
	 * @return void
	 */
	public static function print_footer() {
		$out = '';
		foreach ( self::$packs as $kind => $list ) {
			foreach ( $list as $payload ) {
				$out .= self::script( $payload );
				foreach ( (array) $payload['ids'] as $id ) {
					unset( self::$pending[ $kind ][ (int) $id ] );
				}
			}
		}
		foreach ( self::$pending as $kind => $map ) {
			$ids = self::allowed( array_keys( $map ), $kind );
			if ( empty( $ids ) ) {
				continue;
			}
			$payload = self::build( $ids, $kind, self::PAGE_BUDGET - self::$bytes );
			if ( null !== $payload ) {
				$out .= self::script( $payload );
			}
		}
		self::$packs   = array();
		self::$pending = array();
		echo $out; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Form_Pack::json: `</` ve `<!--` kaçışlı JSON.
	}

	/**
	 * Tek paket betiği (bütçe aşılıyorsa boş).
	 *
	 * @param array<string, mixed> $payload Paket.
	 * @return string
	 */
	private static function script( array $payload ) {
		$data = $payload['pack'];
		if ( ! is_array( $data ) ) {
			return '';
		}
		$data['kind'] = self::kind( (string) $payload['kind'] );
		if ( ! empty( $payload['assets'] ) && is_array( $payload['assets'] ) ) {
			$data['assets'] = $payload['assets'];
		}
		$json = Form_Pack::json( $data );
		if ( '' === $json || self::$bytes + strlen( $json ) > self::PAGE_BUDGET ) {
			return '';
		}
		self::$bytes += strlen( $json );
		return '<script type="application/json" data-dp-forms>' . $json . '</script>' . "\n";
	}

	/**
	 * `donation_panel_prefetch_forms` süzgecinden geçen ürünler.
	 *
	 * @param int[]  $ids  Ürünler.
	 * @param string $kind Kap türü.
	 * @return int[]
	 */
	public static function allowed( array $ids, $kind ) {
		$out = array();
		foreach ( $ids as $id ) {
			/**
			 * Kartın formu sayfaya gömülsün mü (varsayılan: evet). false: o kartın formu dokunma niyetinde tek REST isteğiyle
			 * alınır. 12.3'e kadar toplu ön almayı açıp kapatıyordu; anlamı aynı (önceden hazırlama), artık ürün ve kap türü de geçer.
			 *
			 * @param bool   $enabled    Gömülsün mü.
			 * @param int    $product_id Ürün.
			 * @param string $kind       Kap türü.
			 */
			if ( apply_filters( 'donation_panel_prefetch_forms', true, (int) $id, $kind ) ) {
				$out[] = (int) $id;
			}
		}
		return $out;
	}

	/**
	 * Testler için durum sıfırlama.
	 *
	 * @return void
	 */
	public static function reset_for_tests() {
		self::$packs   = array();
		self::$pending = array();
		self::$bytes   = 0;
		self::$hooked  = false;
	}

	/**
	 * @param string $kind Ham tür.
	 * @return string
	 */
	private static function kind( $kind ) {
		return in_array( (string) $kind, self::KINDS, true ) ? (string) $kind : 'popup';
	}

	/**
	 * @return void
	 */
	private static function hook() {
		if ( self::$hooked || ! function_exists( 'add_action' ) ) {
			return;
		}
		self::$hooked = true;
		add_action( 'wp_footer', array( __CLASS__, 'print_footer' ), 5 );
	}

	/**
	 * @return Form_Renderer|null
	 */
	private static function renderer() {
		$plugin = Plugin::instance();
		if ( null === $plugin ) {
			return null;
		}
		$renderer = $plugin->container()->get( Form_Renderer::class );
		return $renderer instanceof Form_Renderer ? $renderer : null;
	}
}

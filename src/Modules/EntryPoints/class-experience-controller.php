<?php
/**
 * REST: `GET /experience/{id}?kind=popup|side_panel|bottom_sheet` — bir ürünün bağış formunu (kap + form) döndürür.
 *
 * REST: `GET /experiences?ids=1,2,3&kind=…` — görünür alana yaklaşan kartların formları tek istekte (en çok 12; ön alma).
 *
 * Bağış listesi ve döngü/arşiv kartları formu sayfa HTML'ine basmaz (önbelleğe uygun, nonce yok); istemci kart görünür
 * alana yaklaşınca boşta toplu, dokunma niyetinde tek tek alır; dokunuşta form hazırsa ağ isteği olmaz. Salt okunur: sipariş/sepet yazmaz, kişi verisi döndürmez. Hız sınırlıdır; yanıt önbelleğe alınmaz (nonce taze).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Http\Rest_Controller;
use DonationPanel\Modules\Experiences\Experience_Container;
use DonationPanel\Modules\Experiences\Form_Controller;
use DonationPanel\Modules\Experiences\Form_Renderer;

defined( 'ABSPATH' ) || exit;

/**
 * Experience_Controller.
 */
class Experience_Controller extends Rest_Controller {

	/** Toplu ön alma isteği başına en çok ürün (istemci `BATCH_MAX` ile aynı). */
	const BATCH_MAX = 12;

	/** Tek ve toplu form ucunun ORTAK dakikalık bütçesi (form başına bir istek). */
	const RATE_LIMIT = 60;

	/**
	 * Ön alma bütçesi (form başına bir birim, dakikada): ayrı kova. Ortak 60'lık kovadan düşülseydi birkaç liste/mağaza
	 * sayfası gezen ziyaretçi (ya da aynı IP'deki kurum ağı) dokunuşta da 429 alıp formu açamıyordu (yerel ölçümde
	 * yeniden üretildi). 240 = dakikada 20 tam toplu istek; çizim maliyeti IP başına sınırlı kalır.
	 */
	const PREFETCH_LIMIT = 240;

	/** Toplu ön alma yanıtının tarayıcı önbelleğindeki ömrü (sn; yalnız `private`). */
	const PREFETCH_TTL = 300;

	/**
	 * Form çıktısı üretici.
	 *
	 * @var Form_Renderer
	 */
	private $renderer;

	/**
	 * Kurucu.
	 *
	 * @param Rate_Limiter  $limiter  Hız sınırlayıcı.
	 * @param Form_Renderer $renderer Form çıktısı üretici.
	 */
	public function __construct( Rate_Limiter $limiter, Form_Renderer $renderer ) {
		parent::__construct( $limiter );
		$this->renderer = $renderer;
	}

	/**
	 * Rotayı kaydeder.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			self::REST_NAMESPACE,
			'/experience/(?P<id>\d+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_experience' ),
				'permission_callback' => array( $this, 'permission_public' ),
				'args'                => array(
					'kind' => array(
						'type'              => 'string',
						'default'           => 'popup',
						'sanitize_callback' => 'sanitize_key',
					),
				),
			)
		);
		register_rest_route(
			self::REST_NAMESPACE,
			'/experiences',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_experiences' ),
				'permission_callback' => array( $this, 'permission_public' ),
				'args'                => array(
					'ids'  => array(
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					),
					'kind' => array(
						'type'              => 'string',
						'default'           => 'popup',
						'sanitize_callback' => 'sanitize_key',
					),
				),
			)
		);
	}

	/**
	 * Toplu ön alma: görünür alana yaklaşan liste/mağaza kartlarının formları tek istekte (en çok BATCH_MAX ürün).
	 * Salt okunur; bulunamayan ürün yanıtta yer almaz. `donation_panel_prefetch_forms` filtresi false ise boş döner ve
	 * istemci o sayfada yalnız dokunma niyetiyle (tek ürün) alır.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_experiences( $request ) {
		/**
		 * Liste/mağaza kartlarının formları görünür alana yaklaşınca önceden alınsın mı (varsayılan: evet).
		 *
		 * @param bool $enabled Açık mı.
		 */
		if ( ! apply_filters( 'donation_panel_prefetch_forms', true ) ) {
			return $this->no_store(
				array(
					'prefetch' => false,
					'items'    => new \stdClass(),
				)
			);
		}
		// Hız sınırı ÜRÜN BAŞINA (her çizim bir birim; istek başına en çok BATCH_MAX): toplu istek sınırı delemez. Kova ön
		// almaya ayrı (`entry_experience_prefetch`, PREFETCH_LIMIT/dk): ön alma dokunuştaki tek form bütçesini tüketmez.
		$ids = self::charge_ids( $this->limiter, self::parse_ids( (string) $request->get_param( 'ids' ) ), self::PREFETCH_LIMIT );
		if ( empty( $ids ) ) {
			return $this->error( 'donation_panel_rate_limited', 'Too many requests. Please try again shortly.', 429 );
		}
		$kind = self::layer_kind( (string) $request->get_param( 'kind' ) );
		$args = $this->render_args();

		$items  = array();
		$models = array();
		foreach ( $ids as $product_id ) {
			$model = Form_Controller::model_for_id( $product_id );
			if ( empty( $model ) ) {
				continue;
			}
			$html = $this->renderer->render( $model, $kind, $args );
			if ( '' !== $html ) {
				$items[ (string) $product_id ] = $html;
				$models[ $product_id ]         = $model;
			}
		}
		$response = rest_ensure_response(
			self::with_assets(
				array(
					'kind'  => $kind,
					'items' => empty( $items ) ? new \stdClass() : $items,
				),
				$models
			)
		);
		// Tarayıcı düzeyi ön alma (`<link rel="prefetch">`, Prefetch_Links): yanıt YALNIZ o tarayıcının önbelleğinde kısa
		// süre tutulur ki dokunuştaki aynı istek ağa gitmesin. `private` = paylaşılan/vekil önbellek yok; `Vary: Cookie` =
		// oturum/sepet çerezi değişince yeniden alınır. İçerikteki REST nonce'u 12–24 saat geçerli; ömür bunun çok altında.
		$response->header( 'Cache-Control', 'private, max-age=' . self::PREFETCH_TTL );
		$response->header( 'Vary', 'Cookie' );
		return $response;
	}

	/**
	 * Yanıttaki formların isteğe bağlı ek paketleri (`assets`; ör. kampanya çubuğu `progress`). Sayfada çizilmeyen (REST'le
	 * gelen) katman bu paketleri kendisi kuyruğa alamaz; istemci yalnız bu sunucu yanıtındaki (doğrulanmış) adresi kullanır,
	 * DOM özniteliğinden adres okumaz. Modül kapalıysa filtre bağlı değildir: anahtar yanıtta yer almaz.
	 *
	 * @param array<string, mixed>             $data   Yanıt gövdesi.
	 * @param array<int, array<string, mixed>> $models Yanıttaki formların modelleri (ürün => model).
	 * @return array<string, mixed>
	 */
	public static function with_assets( array $data, array $models ) {
		/**
		 * REST'le gelen formların ek paketleri. Biçim: `slug => array( 'ids' => int[], 'script' => url, 'style' => css )`.
		 * İstemci yalnız bildiği slug'ları (`progress`) ve eklentinin kendi derleme yolundaki aynı kökenli adresi kabul eder.
		 *
		 * @param array<string, array<string, mixed>> $assets Paketler.
		 * @param array<int, array<string, mixed>>    $models Ürün => form modeli.
		 */
		$assets = apply_filters( 'donation_panel_experience_assets', array(), $models );
		if ( is_array( $assets ) && ! empty( $assets ) ) {
			$data['assets'] = $assets;
		}
		return $data;
	}

	/**
	 * Her kimlik ön alma kovasından bir birim düşer; bütçe biten kimlik (ve sonrakiler) çizilmez.
	 *
	 * @param \DonationPanel\Http\Rate_Limiter $limiter Hız sınırlayıcı.
	 * @param int[]                            $ids     Kimlikler (parse_ids çıktısı; en çok BATCH_MAX).
	 * @param int                              $limit   Dakikalık sınır (form başına).
	 * @return int[] Çizilmesine izin verilen kimlikler.
	 */
	public static function charge_ids( $limiter, array $ids, $limit ) {
		$allowed = array();
		foreach ( array_slice( $ids, 0, self::BATCH_MAX ) as $id ) {
			if ( ! $limiter->hit( 'entry_experience_prefetch', (int) $limit ) ) {
				break;
			}
			$allowed[] = $id;
		}
		return $allowed;
	}

	/**
	 * `1,2,3` → benzersiz pozitif kimlikler (en çok BATCH_MAX).
	 *
	 * @param string $raw Ham değer.
	 * @return int[]
	 */
	public static function parse_ids( $raw ) {
		$out = array();
		foreach ( explode( ',', $raw ) as $part ) {
			$part = trim( $part );
			if ( 1 !== preg_match( '/^\d+$/', $part ) ) {
				continue;
			}
			$id = (int) $part;
			if ( $id > 0 && ! in_array( $id, $out, true ) ) {
				$out[] = $id;
			}
			if ( count( $out ) >= self::BATCH_MAX ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * İstenen kap türü (yalnız katman türleri; değilse popup).
	 *
	 * @param string $kind Ham tür.
	 * @return string
	 */
	private static function layer_kind( $kind ) {
		if ( ! in_array( $kind, array( 'popup', 'side_panel', 'bottom_sheet' ), true ) ) {
			return 'popup';
		}
		// Katman olmayan kap (sayfa içi) bu uçtan istenmez.
		return Experience_Container::make( $kind )->is_layer() ? $kind : 'popup';
	}

	/**
	 * Form çıktısı argümanları (nonce yalnız bu önbelleksiz yanıtta; sayfa HTML'ine girmez).
	 *
	 * @return array<string, string>
	 */
	private function render_args() {
		return array(
			'rest_url'     => esc_url_raw( rest_url( 'donation-panel/v1/' ) ),
			'nonce'        => wp_create_nonce( 'wp_rest' ),
			'checkout_url' => function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '',
		);
	}

	/**
	 * Önbelleğe alınmayan yanıt (nonce taze).
	 *
	 * @param array<string, mixed> $data Gövde.
	 * @return \WP_REST_Response
	 */
	private function no_store( array $data ) {
		$response = rest_ensure_response( $data );
		$response->header( 'Cache-Control', 'no-store, private' );
		return $response;
	}

	/**
	 * Kap + form HTML'i.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_experience( $request ) {
		$throttled = $this->throttle( 'entry_experience', self::RATE_LIMIT );
		if ( is_wp_error( $throttled ) ) {
			return $throttled;
		}

		$product_id = absint( $request->get_param( 'id' ) );
		$model      = Form_Controller::model_for_id( $product_id );
		if ( $product_id < 1 || empty( $model ) ) {
			return $this->error( 'donation_panel_product_not_found', 'Donation form not found for this product.', 404 );
		}

		$kind = self::layer_kind( (string) $request->get_param( 'kind' ) );
		$html = $this->renderer->render( $model, $kind, $this->render_args() );
		if ( '' === $html ) {
			return $this->error( 'donation_panel_product_not_found', 'Donation form not found for this product.', 404 );
		}

		return $this->no_store(
			self::with_assets(
				array(
					'product_id' => $product_id,
					'kind'       => $kind,
					'html'       => $html,
				),
				array( $product_id => $model )
			)
		);
	}
}

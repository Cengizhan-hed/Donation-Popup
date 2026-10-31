<?php
/**
 * REST denetleyici tabanı: ad alanı, yetki/nonce yardımcıları, hız sınırı, tek tip hata biçimi.
 *
 * Hata biçimi (WP_REST_Server'ın standardı): { code, message, data: { status } }.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Http;

use DonationPanel\Domain\Donation_Scope;

defined( 'ABSPATH' ) || exit;

/**
 * Rest_Controller.
 */
abstract class Rest_Controller {

	const REST_NAMESPACE = 'donation-panel/v1';

	/**
	 * Hız sınırlayıcı.
	 *
	 * @var Rate_Limiter
	 */
	protected $limiter;

	/**
	 * Kurucu.
	 *
	 * @param Rate_Limiter $limiter Hız sınırlayıcı.
	 */
	public function __construct( Rate_Limiter $limiter ) {
		$this->limiter = $limiter;
	}

	/**
	 * Rotaları kaydeder (rest_api_init içinde çağrılır).
	 *
	 * @return void
	 */
	abstract public function register_routes();

	/**
	 * Herkese açık, yalnız okuma uçları için izin (kişisel veri döndürmeyen uçlar).
	 *
	 * @return bool
	 */
	public function permission_public() {
		return true;
	}

	/**
	 * Yetki gerektiren uçlar için izin geri çağrısı üretir.
	 *
	 * @param string $capability WordPress yetkisi.
	 * @return callable
	 */
	protected function permission_for( $capability ) {
		return static function () use ( $capability ) {
			return current_user_can( $capability );
		};
	}

	/**
	 * Nonce doğrular (X-WP-Nonce başlığı ya da _wpnonce parametresi).
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @param string           $action  Nonce eylemi (varsayılan wp_rest).
	 * @return true|\WP_Error
	 */
	protected function verify_nonce( $request, $action = 'wp_rest' ) {
		$nonce = (string) $request->get_header( 'X-WP-Nonce' );
		if ( '' === $nonce ) {
			$nonce = (string) $request->get_param( '_wpnonce' );
		}
		if ( '' === $nonce || ! wp_verify_nonce( $nonce, $action ) ) {
			return $this->error( 'donation_panel_bad_nonce', 'Security check failed.', 403 );
		}
		return true;
	}

	/**
	 * Hız sınırı uygular.
	 *
	 * @param string $bucket Uç adı.
	 * @param int    $limit  Dakika başına üst sınır.
	 * @param int    $period Pencere (sn).
	 * @param bool   $donation_bucket Bağış kovası mı (direct, nonce, cart-add): yalnız bunlar güvenilmez IP'de belirteç bazlı gevşer.
	 * @return true|\WP_Error
	 */
	protected function throttle( $bucket, $limit, $period = 60, $donation_bucket = false ) {
		if ( ! $this->limiter->hit( $bucket, $limit, $period, $donation_bucket ) ) {
			return $this->error( 'donation_panel_rate_limited', 'Too many requests. Please try again shortly.', 429 );
		}
		return true;
	}

	/**
	 * İstekteki tarayıcı belirtecini (`X-Donation-Panel-Client` başlığı ya da `client_token` alanı) hız sınırlayıcıya bildirir.
	 * Belirteç yalnız IP güvenilmezken (güvenilen vekil ayarsız) kova anahtarı olur.
	 *
	 * @param \WP_REST_Request|null $request Istek.
	 * @return void
	 */
	protected function remember_client( $request ) {
		if ( ! is_object( $request ) ) {
			return;
		}
		$token = (string) $request->get_header( 'X-Donation-Panel-Client' );
		if ( '' === $token ) {
			$token = (string) $request->get_param( 'client_token' );
		}
		$this->limiter->set_client_token( $token );
	}

	/**
	 * Çerez kimliğiyle nonce/oturum veren uçlar için kökenler arası isteği reddeder: `Sec-Fetch-Site: cross-site` ya da
	 * tam kaynakla (şema+host+port) izinli kümede olmayan `Origin` 403 verir. Başlık yoksa (eski tarayıcı, aynı köken GET) izin verilir.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return true|\WP_Error
	 */
	protected function require_same_origin( $request ) {
		$fetch_site = strtolower( trim( (string) $request->get_header( 'Sec-Fetch-Site' ) ) );
		if ( 'cross-site' === $fetch_site ) {
			return $this->error( 'donation_panel_cross_origin', 'Cross-site requests are not allowed.', 403 );
		}
		$origin = trim( (string) $request->get_header( 'Origin' ) );
		if ( '' === $origin ) {
			return true;
		}
		$candidate = self::origin_of( $origin );
		if ( '' === $candidate || ! in_array( $candidate, self::allowed_origins(), true ) ) {
			return $this->error( 'donation_panel_cross_origin', 'Cross-site requests are not allowed.', 403 );
		}
		return true;
	}

	/**
	 * Bu rotanın yanıtından `Access-Control-*` başlıklarını kaldırır (WordPress çekirdeği Origin'i kimlik bilgisiyle yansıtır;
	 * nonce yanıtı başka kökene okunmasın). Çekirdeğin `rest_send_cors_headers` işleyicisinden SONRA çalışır.
	 *
	 * @param string $route Rota (`/donation-panel/v1/...`).
	 * @return void
	 */
	protected function strip_cors_for( $route ) {
		add_filter(
			'rest_pre_serve_request',
			static function ( $served, $result = null, $request = null ) use ( $route ) {
				if ( is_object( $request ) && method_exists( $request, 'get_route' ) && $request->get_route() === $route && function_exists( 'header_remove' ) && ! headers_sent() ) {
					foreach ( array( 'Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers', 'Access-Control-Expose-Headers' ) as $header ) {
						header_remove( $header );
					}
					header( 'Vary: Origin, Cookie', false );
				}
				return $served;
			},
			99,
			3
		);
	}

	/**
	 * İzinli kökenler: home_url/site_url kökeni ve bunların zorunlu https varyantı (SSL sonlandıran vekil arkasında
	 * home_url http iken tarayıcı https Origin'i gelebilir). http varyantı yalnız yapılandırılmış adres http ise vardır
	 * (https yapılandırılmışsa http Origin reddedilir). `donation_panel_allowed_origins` süzgeci kümeyi değiştirir.
	 *
	 * @return string[] Tam kökenler (şema://ana-makine[:port]).
	 */
	private static function allowed_origins() {
		$list = array();
		// site_url() şemayı isteğin SSL durumundan türetir (vekil arkasında https yapılandırmayı http'ye düşürür); yapılandırılan değer ham seçenekten okunur.
		$site = (string) get_option( 'siteurl', '' );
		foreach ( array( home_url(), '' !== $site ? $site : site_url() ) as $url ) {
			$list[] = self::origin_of( $url );
			$list[] = self::origin_of( set_url_scheme( (string) $url, 'https' ) );
		}
		$list    = array_values( array_unique( array_filter( $list ) ) );
		$allowed = apply_filters( 'donation_panel_allowed_origins', $list );
		if ( ! is_array( $allowed ) ) {
			return $list;
		}
		$out = array();
		foreach ( $allowed as $item ) {
			$norm = is_string( $item ) ? self::origin_of( $item ) : '';
			if ( '' !== $norm ) {
				$out[] = $norm;
			}
		}
		return $out;
	}

	/**
	 * Adresin tam kökeni (küçük harfli şema://ana-makine; varsayılan port 80/443 atılır); http(s) değilse ya da geçersizse ''.
	 *
	 * @param string $url Adres.
	 * @return string
	 */
	private static function origin_of( $url ) {
		$parts = wp_parse_url( (string) $url );
		if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
			return '';
		}
		$scheme = strtolower( (string) $parts['scheme'] );
		if ( 'http' !== $scheme && 'https' !== $scheme ) {
			return '';
		}
		$out  = $scheme . '://' . strtolower( (string) $parts['host'] );
		$port = isset( $parts['port'] ) ? (int) $parts['port'] : 0;
		if ( $port > 0 && ! ( ( 'http' === $scheme && 80 === $port ) || ( 'https' === $scheme && 443 === $port ) ) ) {
			$out .= ':' . $port;
		}
		return $out;
	}

	/**
	 * Hedef başına hız sınırı (ör. aynı e-postaya art arda e-posta gönderimini önler).
	 *
	 * @param string $bucket Uç adı.
	 * @param string $target Hedef.
	 * @param int    $limit  Pencere başına üst sınır.
	 * @param int    $period Pencere (sn).
	 * @return bool true: izinli.
	 */
	protected function allow_target( $bucket, $target, $limit, $period = 600 ) {
		return $this->limiter->hit_target( $bucket, $target, $limit, $period );
	}

	/**
	 * Ürün var ama herkese açık değil mi (taslak/özel/bekleyen/parolalı)? Düzenleme yetkisi olan kullanıcı için false.
	 * Ürün hiç yoksa false (çağıranın kendi "bulunamadı" yolu çalışır).
	 *
	 * @param int $product_id Ürün.
	 * @return bool
	 */
	public static function is_hidden_product( $product_id ) {
		$product_id = absint( $product_id );
		if ( $product_id < 1 || ! function_exists( 'wc_get_product' ) ) {
			return false;
		}
		$product = wc_get_product( $product_id );
		if ( ! is_object( $product ) ) {
			return false;
		}
		if ( function_exists( 'current_user_can' ) && current_user_can( 'edit_post', $product_id ) ) {
			return false;
		}
		if ( method_exists( $product, 'get_status' ) && 'publish' !== $product->get_status() ) {
			return true;
		}
		if ( method_exists( $product, 'get_post_password' ) && '' !== (string) $product->get_post_password() ) {
			return true;
		}
		// Katalog görünürlüğü "gizli" ürün (mağaza/arama listesinden gizli) yayındadır ve satın alınabilir;
		// bağış ürünleri sık böyle kurulur, bu yüzden gizli sayılmaz.
		return false;
	}

	/**
	 * Uç bu ürünü sunmamalı mı: gizli/taslak, bağış hattı dışı ya da (istenirse) hiç yok.
	 *
	 * Bağış ürünü olmayan bir ürünün kampanya/etki/akış verisi herkese açık uçlardan sızmaz.
	 *
	 * @param int  $product_id       Ürün.
	 * @param bool $require_existing true: ürün yoksa da sunulmaz (sınırsız önbellek anahtarı üretilmesin).
	 * @return bool
	 */
	public static function is_unavailable_product( $product_id, $require_existing = false ) {
		$product_id = absint( $product_id );
		if ( self::is_hidden_product( $product_id ) ) {
			return true;
		}
		if ( $product_id < 1 || ! function_exists( 'wc_get_product' ) ) {
			return false;
		}
		$product = wc_get_product( $product_id );
		if ( ! is_object( $product ) ) {
			return (bool) $require_existing;
		}
		return ! Donation_Scope::is_donation_product( $product );
	}

	/**
	 * Tek tip hata.
	 *
	 * @param string               $code    Makine kodu (donation_panel_ önekli).
	 * @param string               $message İnsan okur ileti (kişisel veri içermez).
	 * @param int                  $status  HTTP durumu.
	 * @param array<string, mixed> $data    Ek veri.
	 * @return \WP_Error
	 */
	protected function error( $code, $message, $status = 400, array $data = array() ) {
		$data['status'] = (int) $status;
		return new \WP_Error( $code, $message, $data );
	}
}

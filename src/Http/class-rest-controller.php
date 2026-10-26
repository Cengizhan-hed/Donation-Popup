<?php
/**
 * REST denetleyici tabanı: ad alanı, yetki/nonce yardımcıları, hız sınırı, tek tip hata biçimi.
 *
 * Hata biçimi (WP_REST_Server'ın standardı): { code, message, data: { status } }.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Http;

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
	 * @return true|\WP_Error
	 */
	protected function throttle( $bucket, $limit, $period = 60 ) {
		if ( ! $this->limiter->hit( $bucket, $limit, $period ) ) {
			return $this->error( 'donation_panel_rate_limited', 'Too many requests. Please try again shortly.', 429 );
		}
		return true;
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

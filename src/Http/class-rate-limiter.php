<?php
/**
 * Basit hız sınırlayıcı (transient tabanlı; sabit pencere). İstemci kimliği yalnız karma olarak saklanır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Http;

defined( 'ABSPATH' ) || exit;

/**
 * Rate_Limiter.
 */
class Rate_Limiter {

	/**
	 * İstemci kimliği çözücü (test için değiştirilebilir).
	 *
	 * @var callable|null
	 */
	private $client_id;

	/**
	 * İstek başına tarayıcı belirteci (IP güvenilmezken kova anahtarı).
	 *
	 * @var string
	 */
	private $token = '';

	/**
	 * Kurucu.
	 *
	 * @param callable|null $client_id function (): string; yoksa Client_Ip (REMOTE_ADDR; vekil başlıkları yalnız güvenilen vekilden).
	 */
	public function __construct( $client_id = null ) {
		$this->client_id = is_callable( $client_id ) ? $client_id : null;
	}

	/**
	 * Bir istek sayar; sınır aşıldıysa false döner.
	 *
	 * @param string $bucket Uç/eylem adı.
	 * @param int    $limit  Pencere başına üst sınır.
	 * @param int    $period Pencere süresi (sn).
	 * @return bool true: izinli.
	 */
	public function hit( $bucket, $limit, $period = 60 ) {
		if ( null === $this->client_id && ! Client_Ip::is_reliable() ) {
			return $this->hit_untrusted( $bucket, (int) $limit, (int) $period );
		}
		return $this->bump( 'donation_panel_rl_' . md5( $bucket . '|' . $this->identify() ), (int) $limit, (int) $period );
	}

	/**
	 * Bu istekteki tarayıcı belirtecini bildirir (yalnız [A-Za-z0-9_-], en çok 64 karakter; geri kalanı atılır).
	 *
	 * @param mixed $token Belirteç.
	 * @return void
	 */
	public function set_client_token( $token ) {
		$token       = is_scalar( $token ) ? preg_replace( '/[^A-Za-z0-9_\-]/', '', substr( (string) $token, 0, 64 ) ) : '';
		$this->token = (string) $token;
	}

	/**
	 * IP güvenilmezken (güvenilen vekil ayarsız; herkes aynı adreste): belirteç varsa belirteç (+UA) kovası normal sınırla,
	 * her durumda yüksek site tavanı (sınır x 20, en az 600). Belirteçsiz istek yalnız tavana tabidir
	 * (aynı UA'yı paylaşan meşru bağışçılar birbirini engellemez).
	 *
	 * @param string $bucket Uç/eylem adı.
	 * @param int    $limit  Sınır.
	 * @param int    $period Pencere (sn).
	 * @return bool
	 */
	private function hit_untrusted( $bucket, $limit, $period ) {
		if ( '' !== $this->token ) {
			$agent = isset( $_SERVER['HTTP_USER_AGENT'] ) ? substr( md5( (string) wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ), 0, 8 ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- yalnız karmalanır.
			if ( ! $this->bump( 'donation_panel_rl_' . md5( $bucket . '|t|' . $this->token . '|' . $agent ), $limit, $period ) ) {
				return false;
			}
		}
		return $this->bump( 'donation_panel_rl_' . md5( $bucket . '|site' ), max( 600, $limit * 20 ), $period );
	}

	/**
	 * Sayacı artırır; sınır aşıldıysa false. Nesne önbelleği varsa atomik (add + incr), yoksa transient.
	 *
	 * @param string $key    Anahtar.
	 * @param int    $limit  Sınır.
	 * @param int    $period Pencere (sn).
	 * @return bool true: izinli.
	 */
	private function bump( $key, $limit, $period ) {
		if ( function_exists( 'wp_using_ext_object_cache' ) && wp_using_ext_object_cache() && function_exists( 'wp_cache_incr' ) && function_exists( 'wp_cache_add' ) ) {
			wp_cache_add( $key, 0, 'donation_panel_rl', $period );
			$count = wp_cache_incr( $key, 1, 'donation_panel_rl' );
			if ( false !== $count ) {
				return (int) $count <= $limit;
			}
		}
		$count = (int) get_transient( $key );
		if ( $count >= $limit ) {
			return false;
		}
		set_transient( $key, $count + 1, $period );
		return true;
	}

	/**
	 * Hedef başına sayar (istemciden bağımsız); dağıtık istekle tek hedefe (ör. bir e-posta) yağdırmayı sınırlar.
	 * Hedef yalnız karma olarak saklanır.
	 *
	 * @param string $bucket Uç/eylem adı.
	 * @param string $target Hedef (ör. küçük harfli e-posta); saklanmadan önce karmalanır.
	 * @param int    $limit  Pencere başına üst sınır.
	 * @param int    $period Pencere süresi (sn).
	 * @return bool true: izinli.
	 */
	public function hit_target( $bucket, $target, $limit, $period = 60 ) {
		return $this->bump( 'donation_panel_rt_' . md5( $bucket . '|' . strtolower( trim( (string) $target ) ) ), (int) $limit, (int) $period );
	}

	/**
	 * İstemci kimliği (kişisel veri saklanmaz; yalnız karma anahtarın parçası olur).
	 *
	 * @return string
	 */
	private function identify() {
		if ( null !== $this->client_id ) {
			return (string) call_user_func( $this->client_id );
		}
		// Girişli kullanıcı kendi kimliğiyle sayılır (ortak NAT/vekil arkasında başkalarının kovasını tüketmez).
		$user_id = function_exists( 'get_current_user_id' ) ? (int) get_current_user_id() : 0;
		if ( $user_id > 0 ) {
			return 'u' . $user_id;
		}
		return Client_Ip::key();
	}
}

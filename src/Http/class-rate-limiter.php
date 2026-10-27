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
		$key   = 'donation_panel_rl_' . md5( $bucket . '|' . $this->identify() );
		$count = (int) get_transient( $key );
		if ( $count >= (int) $limit ) {
			return false;
		}
		set_transient( $key, $count + 1, (int) $period );
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
		$key   = 'donation_panel_rt_' . md5( $bucket . '|' . strtolower( trim( (string) $target ) ) );
		$count = (int) get_transient( $key );
		if ( $count >= (int) $limit ) {
			return false;
		}
		set_transient( $key, $count + 1, (int) $period );
		return true;
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
		return Client_Ip::get();
	}
}

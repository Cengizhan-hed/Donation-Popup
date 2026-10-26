<?php
/**
 * Sürüm kapılı, idempotent göç çalıştırıcısı (src/ tarafı).
 *
 * Eski Version_Migrations sınıfına dokunmaz; yan yana çalışır. Her adım kimlik + sürüm + geri çağrı
 * ile kaydolur; tamamlanan adım `donation_panel_migrations` seçeneğine yazılır ve bir daha çalışmaz.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Core;

defined( 'ABSPATH' ) || exit;

/**
 * Migrations.
 */
class Migrations {

	const OPTION_NAME = 'donation_panel_migrations';

	/**
	 * Kayıtlı adımlar.
	 *
	 * @var array<string, array{version: int, callback: callable}>
	 */
	private $steps = array();

	/**
	 * Adım kaydeder.
	 *
	 * @param string   $step_id  Benzersiz kimlik.
	 * @param int      $version  Adımın ait olduğu şema sürümü (artan).
	 * @param callable $callback Adımı çalıştırır (tekrar çalışırsa zararsız olmalı).
	 * @return void
	 */
	public function add_step( $step_id, $version, callable $callback ) {
		$this->steps[ sanitize_key( $step_id ) ] = array(
			'version'  => (int) $version,
			'callback' => $callback,
		);
	}

	/**
	 * Saklı durum.
	 *
	 * @return array{version: int, done: array<string, int>}
	 */
	public function state() {
		$state = get_option( self::OPTION_NAME, array() );
		$state = is_array( $state ) ? $state : array();
		return array(
			'version' => isset( $state['version'] ) ? (int) $state['version'] : 0,
			'done'    => isset( $state['done'] ) && is_array( $state['done'] ) ? array_map( 'intval', $state['done'] ) : array(),
		);
	}

	/**
	 * Hedef sürüm: kayıtlı adımların en büyüğü.
	 *
	 * @return int
	 */
	public function target_version() {
		$target = 0;
		foreach ( $this->steps as $step ) {
			$target = max( $target, $step['version'] );
		}
		return $target;
	}

	/**
	 * Bekleyen adım kimlikleri (sürüme göre sıralı).
	 *
	 * @return string[]
	 */
	public function pending() {
		$done    = $this->state()['done'];
		$pending = array();
		foreach ( $this->steps as $step_id => $step ) {
			if ( ! isset( $done[ $step_id ] ) ) {
				$pending[ $step_id ] = $step['version'];
			}
		}
		asort( $pending );
		return array_keys( $pending );
	}

	/**
	 * Bekleyen adımları çalıştırır; hiç bekleyen yoksa veritabanına yazmaz.
	 *
	 * @return string[] Bu çağrıda çalışan adım kimlikleri.
	 */
	public function run() {
		$pending = $this->pending();
		if ( ! $pending ) {
			return array();
		}

		$state = $this->state();
		$ran   = array();
		foreach ( $pending as $step_id ) {
			call_user_func( $this->steps[ $step_id ]['callback'] );
			$state['done'][ $step_id ] = time();
			$state['version']          = max( $state['version'], $this->steps[ $step_id ]['version'] );
			update_option( self::OPTION_NAME, $state, false );
			$ran[] = $step_id;
		}

		return $ran;
	}
}

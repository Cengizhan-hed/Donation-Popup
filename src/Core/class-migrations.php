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

	const LOCK_OPTION  = 'donation_panel_migrations_lock';
	const ERROR_OPTION = 'donation_panel_migrations_error';
	const LOCK_TTL     = 120;

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
	 * Bekleyen adımları kilit altında çalıştırır; hiç bekleyen yoksa veritabanına yazmaz.
	 *
	 * Bir adım hata fırlatırsa istek çökmez: hata kaydedilir, kalan adımlar bırakılır ve
	 * sonraki istekte kaldığı adımdan sürer (adımlar idempotenttir; tamamlananlar yazılıdır).
	 *
	 * @return string[] Bu çağrıda tamamlanan adım kimlikleri.
	 */
	public function run() {
		if ( is_admin() ) {
			add_action( 'admin_notices', array( $this, 'render_error_notice' ) );
		}
		$pending = $this->pending();
		if ( ! $pending ) {
			return array();
		}
		if ( ! $this->acquire_lock() ) {
			return array();
		}

		$state = $this->state();
		$ran   = array();
		try {
			foreach ( $pending as $step_id ) {
				call_user_func( $this->steps[ $step_id ]['callback'] );
				$state['done'][ $step_id ] = time();
				$state['version']          = max( $state['version'], $this->steps[ $step_id ]['version'] );
				update_option( self::OPTION_NAME, $state, false );
				$ran[] = $step_id;
			}
			delete_option( self::ERROR_OPTION );
		} catch ( \Throwable $e ) {
			$this->record_error( $step_id, $e );
		}
		delete_option( self::LOCK_OPTION );

		return $ran;
	}

	/**
	 * Kilidi alır (add_option atomiktir); eskimiş kilit devralınır.
	 *
	 * @return bool
	 */
	private function acquire_lock() {
		if ( add_option( self::LOCK_OPTION, time(), '', false ) ) {
			return true;
		}
		$taken = (int) get_option( self::LOCK_OPTION, 0 );
		if ( $taken > 0 && ( time() - $taken ) < self::LOCK_TTL ) {
			return false;
		}
		update_option( self::LOCK_OPTION, time(), false );
		return true;
	}

	/**
	 * Hatayı kaydeder (kişisel veri yok) ve günlüğe yazar.
	 *
	 * @param string     $step_id Adım.
	 * @param \Throwable $e       Hata.
	 * @return void
	 */
	private function record_error( $step_id, $e ) {
		$message = sprintf( '%s: %s (%s:%d)', (string) $step_id, $e->getMessage(), basename( $e->getFile() ), (int) $e->getLine() );
		update_option(
			self::ERROR_OPTION,
			array(
				'step'    => (string) $step_id,
				'message' => $message,
				'time'    => time(),
			),
			false
		);
		if ( function_exists( 'error_log' ) && defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
			error_log( 'Donation Panel migration failed: ' . $message ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- yalnız WP_DEBUG_LOG açıkken göç hatası günlüğü.
		}
	}

	/**
	 * Yönetici ekranında göç hatası bildirimi.
	 *
	 * @return void
	 */
	public function render_error_notice() {
		if ( ! function_exists( 'current_user_can' ) || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$error = get_option( self::ERROR_OPTION, array() );
		if ( ! is_array( $error ) || empty( $error['message'] ) ) {
			return;
		}
		printf(
			'<div class="notice notice-error"><p>%s</p></div>',
			esc_html(
				sprintf(
					/* translators: %s: technical error detail */
					__( 'Donation Panel could not finish an update step and will retry on the next request. Detail: %s', 'woo-donation-popup' ),
					(string) $error['message']
				)
			)
		);
	}
}

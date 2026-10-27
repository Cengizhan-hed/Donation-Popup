<?php
/**
 * #7: göç çalıştırıcı kilitli, hata yakalar, sonraki istekte kaldığı yerden sürer.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Migrations;
use PHPUnit\Framework\TestCase;

final class Fix7MigrationsSafetyTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_throwing_step_does_not_crash_and_resumes_next_request(): void {
		$log   = array();
		$fail  = true;
		$build = static function () use ( &$log, &$fail ) {
			$m = new Migrations();
			$m->add_step( 'a', 1, static function () use ( &$log ) {
				$log[] = 'a';
			} );
			$m->add_step( 'b', 2, static function () use ( &$log, &$fail ) {
				if ( $fail ) {
					throw new \RuntimeException( 'boom' );
				}
				$log[] = 'b';
			} );
			$m->add_step( 'c', 3, static function () use ( &$log ) {
				$log[] = 'c';
			} );
			return $m;
		};

		$this->assertSame( array( 'a' ), $build()->run() );
		$this->assertSame( array( 'a' ), $log, 'hata sonrası sonraki adım çalışmaz' );
		$this->assertNotEmpty( get_option( Migrations::ERROR_OPTION ) );
		$this->assertArrayNotHasKey( Migrations::LOCK_OPTION, WDP_Test_State::$options, 'kilit bırakılır' );

		$fail = false;
		$this->assertSame( array( 'b', 'c' ), $build()->run() );
		$this->assertSame( array( 'a', 'b', 'c' ), $log );
		$this->assertEmpty( get_option( Migrations::ERROR_OPTION ), 'başarı sonrası hata temizlenir' );
	}

	public function test_fresh_lock_skips_and_stale_lock_is_taken_over(): void {
		$ran = array();
		$m   = new Migrations();
		$m->add_step( 'a', 1, static function () use ( &$ran ) {
			$ran[] = 'a';
		} );

		WDP_Test_State::$options[ Migrations::LOCK_OPTION ] = time();
		$this->assertSame( array(), $m->run() );
		$this->assertSame( array(), $ran );

		WDP_Test_State::$options[ Migrations::LOCK_OPTION ] = time() - 3600;
		$this->assertSame( array( 'a' ), $m->run() );
		$this->assertArrayNotHasKey( Migrations::LOCK_OPTION, WDP_Test_State::$options );
	}

	public function test_no_pending_takes_no_lock(): void {
		$m = new Migrations();
		$this->assertSame( array(), $m->run() );
		$this->assertArrayNotHasKey( Migrations::LOCK_OPTION, WDP_Test_State::$options );
	}

	public function test_admin_init_migration_requires_manage_options(): void {
		WDP_Test_State::$caps = array();
		\DonationPanel\Core\Version_Migrations::maybe_run_for_admin();
		$this->assertArrayNotHasKey( \DonationPanel\Core\Version_Migrations::OPTION, WDP_Test_State::$options );
	}
}

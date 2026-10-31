<?php
/**
 * Gerçek veritabanı: göç kilidi atomiktir, yarıda kalan göç bir sonraki istekte kaldığı yerden sürer.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Migrations;

final class MigrationLockIntegrationTest extends WDP_Integration_Test_Case {

	/** @var array<string,mixed> */
	private $backup = array();

	protected function setUp(): void {
		parent::setUp();
		foreach ( array( Migrations::OPTION_NAME, Migrations::LOCK_OPTION, Migrations::ERROR_OPTION ) as $name ) {
			$this->backup[ $name ] = get_option( $name, null );
			delete_option( $name );
		}
	}

	protected function tearDown(): void {
		foreach ( $this->backup as $name => $value ) {
			if ( null === $value ) {
				delete_option( $name );
			} else {
				update_option( $name, $value, false );
			}
		}
		parent::tearDown();
	}

	public function test_lock_is_atomic_on_the_real_options_table(): void {
		$this->assertTrue( add_option( Migrations::LOCK_OPTION, time(), '', false ), 'İlk alan kazanır.' );
		$this->assertFalse( add_option( Migrations::LOCK_OPTION, time(), '', false ), 'İkinci alan (eşzamanlı istek) kaybeder.' );

		$ran = array();
		$m   = new Migrations();
		$m->add_step( 'itest_a', 1, static function () use ( &$ran ) {
			$ran[] = 'a';
		} );
		$this->assertSame( array(), $m->run(), 'Kilit başkasındayken göç çalışmaz.' );
		$this->assertSame( array(), $ran );

		update_option( Migrations::LOCK_OPTION, time() - 3600, false ); // eskimiş kilit devralınır
		$this->assertSame( array( 'itest_a' ), $m->run() );
		$this->assertFalse( get_option( Migrations::LOCK_OPTION, false ), 'Kilit işi bitince bırakılır.' );
	}

	public function test_interrupted_migration_resumes_where_it_stopped(): void {
		$log   = array();
		$fail  = true;
		$build = static function () use ( &$log, &$fail ) {
			$m = new Migrations();
			$m->add_step( 'itest_a', 1, static function () use ( &$log ) {
				$log[] = 'a';
			} );
			$m->add_step( 'itest_b', 2, static function () use ( &$log, &$fail ) {
				if ( $fail ) {
					throw new \RuntimeException( 'simulated crash' );
				}
				$log[] = 'b';
			} );
			$m->add_step( 'itest_c', 3, static function () use ( &$log ) {
				$log[] = 'c';
			} );
			return $m;
		};

		$this->assertSame( array( 'itest_a' ), $build()->run() );
		$this->assertSame( array( 'a' ), $log );
		$error = get_option( Migrations::ERROR_OPTION );
		$this->assertIsArray( $error );
		$this->assertSame( 'itest_b', $error['step'] );
		$this->assertFalse( get_option( Migrations::LOCK_OPTION, false ), 'Hata sonrası kilit bırakılır.' );
		$this->assertSame( array( 'itest_a' ), array_keys( ( new Migrations() )->state()['done'] ), 'Yalnız biten adım yazılı.' );

		$fail = false;
		$this->assertSame( array( 'itest_b', 'itest_c' ), $build()->run(), 'Sonraki istek kaldığı adımdan sürer.' );
		$this->assertSame( array( 'a', 'b', 'c' ), $log, 'Biten adım yeniden çalışmaz.' );
		$this->assertFalse( get_option( Migrations::ERROR_OPTION, false ) );
	}
}

<?php
/**
 * E0: sürüm kapılı göç çalıştırıcısı.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use DonationPanel\Core\Migrations;
use PHPUnit\Framework\TestCase;

final class E0MigrationsTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_steps_run_in_version_order_exactly_once(): void {
		$log = array();
		$m   = new Migrations();
		$m->add_step('b', 2, static function () use (&$log) {
			$log[] = 'b';
		});
		$m->add_step('a', 1, static function () use (&$log) {
			$log[] = 'a';
		});

		$this->assertSame(2, $m->target_version());
		$this->assertSame(array( 'a', 'b' ), $m->run());
		$this->assertSame(array( 'a', 'b' ), $log);
		$this->assertSame(2, $m->state()['version']);

		$this->assertSame(array(), $m->run());
		$this->assertSame(array( 'a', 'b' ), $log);
	}

	public function test_new_step_added_later_runs_alone(): void {
		$m = new Migrations();
		$m->add_step('a', 1, static function () {
		});
		$m->run();

		$ran = array();
		$m2  = new Migrations();
		$m2->add_step('a', 1, static function () use (&$ran) {
			$ran[] = 'a';
		});
		$m2->add_step('c', 3, static function () use (&$ran) {
			$ran[] = 'c';
		});
		$this->assertSame(array( 'c' ), $m2->run());
		$this->assertSame(array( 'c' ), $ran);
	}

	public function test_no_pending_means_no_database_write(): void {
		$m = new Migrations();
		$this->assertSame(array(), $m->run());
		$this->assertArrayNotHasKey(Migrations::OPTION_NAME, WDP_Test_State::$options);
	}
}

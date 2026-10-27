<?php
/**
 * E0: modül kayıt defteri; KAPALI modülün dosyası yüklenmez.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Autoloader;
use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Settings;
use PHPUnit\Framework\TestCase;

final class E0ModuleRegistryTest extends TestCase {

	private const ENABLED  = 'E0Fixture\\Modules\\Sample\\Enabled_Module';
	private const DISABLED = 'E0Fixture\\Modules\\Sample\\Disabled_Module';

	protected function setUp(): void {
		WDP_Test_State::reset();
		unset($GLOBALS['wdp_e0_disabled_module_loaded'], $GLOBALS['wdp_e0_disabled_module_registered']);
		Autoloader::register(dirname(__DIR__, 2) . '/fixtures/e0/src', 'E0Fixture\\');
	}

	private function registry(): Module_Registry {
		$registry = new Module_Registry(new Settings());
		$registry->add('enabled-sample', self::ENABLED, true);
		$registry->add('disabled-sample', self::DISABLED, false);
		return $registry;
	}

	private static function file_loaded(string $needle): bool {
		foreach (get_included_files() as $file) {
			if (false !== strpos($file, $needle)) {
				return true;
			}
		}
		return false;
	}

	public function test_disabled_module_file_is_never_loaded(): void {
		$registry = $this->registry();
		$registry->boot(new Container());

		$this->assertSame(array( 'enabled-sample' ), $registry->active_slugs());
		$this->assertTrue(self::file_loaded('class-enabled-module.php'));
		$this->assertFalse(self::file_loaded('class-disabled-module.php'), 'Kapali modulun dosyasi yuklendi');
		$this->assertArrayNotHasKey('wdp_e0_disabled_module_loaded', $GLOBALS);
		$this->assertFalse(class_exists(self::DISABLED, false));
	}

	public function test_setting_toggles_module_both_ways(): void {
		$settings = new Settings();
		$settings->update(array( 'modules' => array( 'enabled-sample' => false, 'disabled-sample' => true ) ));
		$registry = new Module_Registry($settings);
		$registry->add('enabled-sample', self::ENABLED, true);
		$registry->add('disabled-sample', self::DISABLED, false);

		$this->assertFalse($registry->is_enabled('enabled-sample'));
		$this->assertTrue($registry->is_enabled('disabled-sample'));
	}

	public function test_filter_can_override_enabled_state(): void {
		WDP_Test_State::$filters['donation_panel_module_enabled'] = static function ($enabled, $slug) {
			return 'disabled-sample' === $slug ? true : $enabled;
		};
		$registry = $this->registry();
		$this->assertTrue($registry->is_enabled('disabled-sample'));
	}

	public function test_unknown_slug_is_disabled_and_summary_lists_all(): void {
		$registry = $this->registry();
		$this->assertFalse($registry->is_enabled('missing'));
		$this->assertSame(
			array(
				array( 'slug' => 'enabled-sample', 'enabled' => true ),
				array( 'slug' => 'disabled-sample', 'enabled' => false ),
			),
			$registry->summary()
		);
	}

	public function test_module_registers_once_even_if_boot_runs_twice(): void {
		$cls      = self::ENABLED;
		$before   = $cls::$registered;
		$registry = $this->registry();
		$registry->boot(new Container());
		$registry->boot(new Container());
		$this->assertSame($before + 1, $cls::$registered);
	}
}

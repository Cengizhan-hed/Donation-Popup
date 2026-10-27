<?php
/**
 * E0: gömülü autoloader (ad alanı -> WPCS dosya adı).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Autoloader;
use PHPUnit\Framework\TestCase;

final class AutoloaderTest extends TestCase {

	public function test_class_interface_trait_file_names(): void {
		$base = '/x/src';
		$this->assertSame('/x/src/Core/class-module-registry.php', Autoloader::file_for_class('DonationPanel\\Core\\Module_Registry', $base));
		$this->assertSame('/x/src/Core/interface-module-interface.php', Autoloader::file_for_class('DonationPanel\\Core\\Module_Interface', $base));
		$this->assertSame('/x/src/Support/trait-sanitizes-trait.php', Autoloader::file_for_class('DonationPanel\\Support\\Sanitizes_Trait', $base));
		$this->assertSame('/x/src/Modules/EntryPoints/class-foo.php', Autoloader::file_for_class('\DonationPanel\\Modules\\EntryPoints\\Foo', $base));
		$this->assertSame('/x/src/class-plugin.php', Autoloader::file_for_class('DonationPanel\\Plugin', $base));
	}

	public function test_foreign_namespaces_are_ignored(): void {
		$this->assertSame('', Autoloader::file_for_class('Other\\Support\\Security', '/x/src'));
		$this->assertSame('', Autoloader::file_for_class('Other\\Core\\Thing', '/x/src'));
		$this->assertSame('', Autoloader::file_for_class('DonationPanel\\', '/x/src'));
	}

	public function test_every_src_file_maps_to_its_class(): void {
		$root = dirname(__DIR__, 3) . '/src';
		$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
		$checked = 0;
		foreach ($iterator as $file) {
			$path = (string) $file;
			if ('.php' !== substr($path, -4) || false !== strpos($path, 'class-hook-probe.php')) {
				continue;
			}
			$source = (string) file_get_contents($path);
			if (!preg_match('/^namespace\s+([^;{]+)[;{]/m', $source, $ns) || !preg_match('/^(?:final\s+|abstract\s+)?(class|interface|trait)\s+(\w+)/m', $source, $decl)) {
				$this->fail('Ad alani/sinif bulunamadi: ' . $path);
			}
			$fqcn = trim($ns[1]) . '\\' . $decl[2];
			$this->assertSame($path, Autoloader::file_for_class($fqcn, $root), $fqcn);
			$this->assertTrue(class_exists($fqcn) || interface_exists($fqcn) || trait_exists($fqcn), $fqcn . ' yuklenemedi');
			++$checked;
		}
		$this->assertGreaterThan(8, $checked);
	}

	public function test_additional_root_autoloads_fixture(): void {
		Autoloader::register(dirname(__DIR__, 2) . '/fixtures/e0/src', 'E0Fixture\\');
		$this->assertTrue(class_exists('E0Fixture\\Modules\\Sample\\Enabled_Module'));
	}
}

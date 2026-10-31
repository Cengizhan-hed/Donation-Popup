<?php
/**
 * E0: şablon yükleyici (tema `donation-panel/` geçersiz kılma).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Frontend\Template_Loader;
use PHPUnit\Framework\TestCase;

final class TemplateLoaderTest extends TestCase {

	/** @var string */
	private $tmp;

	protected function setUp(): void {
		WDP_Test_State::reset();
		$this->tmp = sys_get_temp_dir() . '/wdp-e0-' . uniqid('', true);
		foreach (array( 'plugin/templates/donation-panel/form', 'child/donation-panel/form', 'parent/donation-panel/form' ) as $dir) {
			mkdir($this->tmp . '/' . $dir, 0777, true);
		}
		file_put_contents($this->tmp . '/plugin/templates/donation-panel/form/popup.php', 'PLUGIN:<?php echo esc_html( $args["title"] ); ?>');
		file_put_contents($this->tmp . '/plugin/templates/donation-panel/only-plugin.php', 'ONLY');
		file_put_contents($this->tmp . '/parent/donation-panel/form/popup.php', 'PARENT');
		file_put_contents($this->tmp . '/parent/donation-panel/only-parent.php', 'PARENT-ONLY');
		file_put_contents($this->tmp . '/child/donation-panel/form/popup.php', 'CHILD');
	}

	protected function tearDown(): void {
		$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($this->tmp, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
		foreach ($it as $f) {
			$f->isDir() ? rmdir((string) $f) : unlink((string) $f);
		}
		rmdir($this->tmp);
	}

	private function loader(): Template_Loader {
		$tmp = $this->tmp;
		return new Template_Loader($tmp . '/plugin', static function () use ($tmp) {
			return array( $tmp . '/child', $tmp . '/parent' );
		});
	}

	public function test_child_theme_overrides_parent_and_plugin(): void {
		$this->assertSame($this->tmp . '/child/donation-panel/form/popup.php', $this->loader()->locate('form/popup.php'));
		$this->assertSame('CHILD', $this->loader()->render_to_string('form/popup.php'));
	}

	public function test_parent_theme_then_plugin_fallback(): void {
		$this->assertSame($this->tmp . '/parent/donation-panel/only-parent.php', $this->loader()->locate('only-parent.php'));
		$this->assertSame($this->tmp . '/plugin/templates/donation-panel/only-plugin.php', $this->loader()->locate('only-plugin.php'));
	}

	public function test_plugin_template_used_without_theme_copy_and_receives_args(): void {
		$loader = new Template_Loader($this->tmp . '/plugin', static function () {
			return array();
		});
		$this->assertSame('PLUGIN:Hello', $loader->render_to_string('form/popup.php', array( 'title' => 'Hello' )));
	}

	public function test_missing_template_returns_empty(): void {
		$this->assertSame('', $this->loader()->locate('nope.php'));
		$this->assertSame('', $this->loader()->render_to_string('nope.php'));
	}

	public function test_unsafe_names_are_rejected(): void {
		foreach (array( '../x.php', 'a/../../x.php', '/etc/passwd.php', 'form/popup.txt', '', "x\0.php", 'C:\\x.php' ) as $bad) {
			$this->assertFalse(Template_Loader::is_valid_name($bad), $bad);
			$this->assertSame('', $this->loader()->locate($bad));
		}
		$this->assertTrue(Template_Loader::is_valid_name('form/popup.php'));
	}

	public function test_located_template_filter_can_replace_path(): void {
		$replacement = $this->tmp . '/plugin/templates/donation-panel/only-plugin.php';
		WDP_Test_State::$filters['donation_panel_located_template'] = static function ($located, $name) use ($replacement) {
			return 'form/popup.php' === $name ? $replacement : $located;
		};
		$this->assertSame('ONLY', $this->loader()->render_to_string('form/popup.php'));
	}
}

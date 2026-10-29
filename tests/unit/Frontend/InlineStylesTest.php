<?php
/**
 * 12.2 stilsiz görünmeye sıfır tolerans (CLAUDE.md §25): modül CSS'i `<link>` değil, çıktının önünde satır içi `<style>`,
 * sayfa başına bir kez; gerekmeyen sayfada hiçbir şey; derlenmiş gerçek CSS'ler bütçede.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Frontend\Assets;
use PHPUnit\Framework\TestCase;

final class InlineStylesTest extends TestCase {

	/** @var string */
	private $dir = '';

	protected function setUp(): void {
		WDP_Test_State::reset();
		$this->dir = sys_get_temp_dir() . '/wdp-is-' . uniqid();
		mkdir($this->dir . '/assets/build/m', 0777, true);
		file_put_contents($this->dir . '/assets/build/m/index.js', '//');
		file_put_contents($this->dir . '/assets/build/m/index.css', ".donation-panel-x{color:red}\n/* </style><script>x</script> */");
	}

	protected function tearDown(): void {
		foreach (array( 'index.js', 'index.css' ) as $f) {
			@unlink($this->dir . '/assets/build/m/' . $f); // phpcs:ignore
		}
		@rmdir($this->dir . '/assets/build/m'); // phpcs:ignore
		@rmdir($this->dir . '/assets/build'); // phpcs:ignore
		@rmdir($this->dir . '/assets'); // phpcs:ignore
		@rmdir($this->dir); // phpcs:ignore
	}

	private function assets(): Assets {
		$assets = new Assets($this->dir, 'https://example.test/p');
		$assets->define('m', 'assets/build/m/index.js', 'assets/build/m/index.css');
		return $assets;
	}

	public function test_nothing_is_printed_when_no_surface_was_drawn(): void {
		$this->assertSame('', $this->assets()->inline_styles());
	}

	public function test_style_is_inlined_once_and_never_enqueued_as_link(): void {
		$assets = $this->assets();
		$assets->enqueue('m');
		$first = $assets->inline_styles();
		$this->assertStringStartsWith('<style id="donation-panel-inline-m">.donation-panel-x{color:red}', $first);
		$this->assertStringNotContainsString('</style><script>', $first, 'Stil etiketinden kaçış yok.');
		$this->assertSame(1, substr_count($first, '</style>'));
		$this->assertSame('', $assets->inline_styles(), 'Aynı istekte ikinci kez basılmaz.');
		$assets->enqueue('m');
		$this->assertSame('', $assets->inline_styles(), 'Yeniden kuyruk da ikinci kopya üretmez.');
		$this->assertArrayNotHasKey('__enqueued_styles', WDP_Test_State::$options, 'Ayrı <link> yok.');
	}

	public function test_footer_fallback_prints_styles_not_printed_before_output(): void {
		$assets = $this->assets();
		$assets->enqueue('m', true);
		ob_start();
		$assets->print_pending_styles();
		$this->assertStringContainsString('donation-panel-inline-m', (string) ob_get_clean());
		ob_start();
		$assets->print_pending_styles();
		$this->assertSame('', (string) ob_get_clean());
	}

	public function test_script_only_enqueue_needs_no_style(): void {
		$assets = $this->assets();
		$assets->enqueue('m', false, false);
		$this->assertSame('', $assets->inline_styles());
	}

	public function test_require_style_marks_style_without_script(): void {
		$assets = $this->assets();
		$assets->require_style('m');
		$this->assertStringContainsString('donation-panel-inline-m', $assets->inline_styles());
	}

	public function test_disabled_front_inlines_nothing(): void {
		add_filter('donation_panel_front_disabled', '__return_true');
		$assets = $this->assets();
		$assets->enqueue('m');
		$assets->require_style('m');
		$this->assertSame('', $assets->inline_styles());
	}

	/**
	 * Bütçe (gzip, bayt): derlenmiş ön yüz CSS'leri satır içi basılır; yüzey başına sınır (12.2 önerisi, RAPOR-122-fouc).
	 */
	public function test_built_front_css_is_scoped_and_within_inline_budget(): void {
		$root   = dirname(__DIR__, 3) . '/assets/build/';
		$budget = array(
			'experiences'   => 8704,
			'campaign'      => 4608,
			'list'          => 2048,
			'donor-account' => 6400,
			'side-cart'     => 5632,
			'thanks'        => 4608,
		);
		foreach ($budget as $slug => $max) {
			$file = $root . $slug . '/index.css';
			if (!is_file($file)) {
				$this->markTestSkipped('Derleme çıktısı yok (npm run build).');
			}
			$css = (string) file_get_contents($file);
			$this->assertLessThanOrEqual($max, strlen((string) gzencode($css, 9)), $slug . ' satır içi CSS gzip bütçesi');
			$this->assertStringNotContainsString('!important', $css, $slug);
			$this->assertStringNotContainsString('</', $css, $slug);
		}
	}
}

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

	/**
	 * Sıra bağımsızlığı (122-cascade): ortak çekirdek ve ortak parçalar her yüzeyden ÖNCE, sayfada bir kez basılır; hangi
	 * yüzey önce çizilirse çizilsin ikinci yüzey çekirdeği yeniden basmaz (sonraki tekrar önceki varyantı ezemez).
	 */
	public function test_core_and_shared_parts_print_once_before_first_dependent_surface(): void {
		$files = array(
			'ui-core'     => '.donation-panel-btn{--_bg:red}',
			'ui-controls' => '.donation-panel-input{color:blue}',
			'm2'          => '.donation-panel-btn--outline{--_bg:white}',
		);
		foreach ($files as $slug => $css) {
			@mkdir($this->dir . '/assets/build/' . $slug, 0777, true); // phpcs:ignore
			file_put_contents($this->dir . '/assets/build/' . $slug . '/index.css', $css);
		}
		foreach (array( array( 'm', 'm2' ), array( 'm2', 'm' ) ) as $order) {
			$assets = $this->assets();
			$assets->define('m2', '', 'assets/build/m2/index.css', array( 'ui-controls', 'bilinmeyen' ));
			$out = '';
			foreach ($order as $slug) {
				$assets->require_style($slug);
				$out .= $assets->inline_styles() . '<div>' . $slug . '</div>';
			}
			$this->assertSame(1, substr_count($out, 'id="donation-panel-inline-ui-core"'), 'Çekirdek bir kez.');
			$this->assertSame(1, substr_count($out, 'id="donation-panel-inline-ui-controls"'), 'Ortak parça bir kez.');
			$this->assertStringStartsWith('<style id="donation-panel-inline-ui-core">', $out, 'Çekirdek her yüzeyden önce.');
			$this->assertLessThan(strpos($out, 'donation-panel-inline-m2"'), strpos($out, 'donation-panel-inline-ui-controls"'), 'Parça, dayanan yüzeyden önce.');
			$this->assertStringNotContainsString('bilinmeyen', $out);
		}
		foreach (array_keys($files) as $slug) {
			@unlink($this->dir . '/assets/build/' . $slug . '/index.css'); // phpcs:ignore
			@rmdir($this->dir . '/assets/build/' . $slug); // phpcs:ignore
		}
	}

	public function test_shared_part_slugs_cannot_be_redefined_by_modules(): void {
		$assets = $this->assets();
		$assets->define('ui-core', '', 'assets/build/m/index.css');
		$assets->require_style('m');
		$this->assertStringNotContainsString('donation-panel-inline-ui-core', $assets->inline_styles(), 'Çekirdek dosyası yoksa basılmaz; modül çekirdeği ezemez.');
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
		// 122-cascade: ortak çekirdek/parçalar ayrıldı; paketler yalnız kendi kurallarını taşır (tekrar baytı yok).
		$budget = array(
			'ui-core'       => 3072,
			'ui-controls'   => 1280,
			'ui-dpx'        => 1280,
			'experiences'   => 5120,
			'campaign'      => 2048,
			// 12.3 compact v2 (+~0,9 KB: alan grubu + autofill, beyan Ayrıntılar katmanı, toplam/etki satırı, alt bölge);
			// yüzey toplamı (çekirdek + denetimler + experiences + compact) §25 sınırı 9 KB'nin altında.
			'compact'       => 3328,
			'list'          => 2048,
			'donor-account' => 3072,
			'side-cart'     => 3072,
			'thanks'        => 1792,
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

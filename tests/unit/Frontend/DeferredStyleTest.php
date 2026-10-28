<?php
/**
 * Ertelenen ana stil: etiket engellemeyen yapılır, yalnız ertelenen slug'da; kritik CSS dosyası bütçede.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Frontend\Assets;
use PHPUnit\Framework\TestCase;

final class DeferredStyleTest extends TestCase {

	private function assets( array $deferred ): Assets {
		$assets = new Assets( sys_get_temp_dir(), 'https://example.test/p' );
		$ref    = new ReflectionProperty( Assets::class, 'deferred' );
		$ref->setAccessible( true );
		$ref->setValue( $assets, $deferred );
		return $assets;
	}

	public function test_deferred_style_tag_becomes_non_blocking(): void {
		$tag = "<link rel='stylesheet' id='donation-panel-experiences-css' href='https://x.test/a.css?ver=1' media='all' />\n";
		$out = $this->assets( array( 'experiences' => true ) )->defer_style_tag( $tag, 'donation-panel-experiences' );
		$this->assertStringContainsString( "media='print' data-dp-defer=''", $out );
		$this->assertStringNotContainsString( "media='all'", $out );
	}

	public function test_non_deferred_or_other_handles_are_untouched(): void {
		$tag = "<link rel='stylesheet' href='a.css' media='all' />";
		$this->assertSame( $tag, $this->assets( array( 'experiences' => false ) )->defer_style_tag( $tag, 'donation-panel-experiences' ) );
		$this->assertSame( $tag, $this->assets( array( 'experiences' => true ) )->defer_style_tag( $tag, 'donation-panel-campaign' ) );
	}

	public function test_critical_css_is_within_budget_and_layered(): void {
		$css = (string) file_get_contents( dirname( __DIR__, 3 ) . '/assets/critical/experiences.css' );
		$this->assertLessThanOrEqual( 3072, strlen( $css ), 'Kritik CSS ≤3 KB.' );
		$this->assertStringStartsWith( '@layer dp-critical{', $css, 'Katmanlı: ana stil kazanır, çakışma yok.' );
		$this->assertStringNotContainsString( '!important', $css );
	}
}

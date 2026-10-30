<?php
/**
 * 12.3 tarayıcı düzeyi ön alma: kart kimlikleri toplanır, tekrarsız, kap türü başına ilk 12; çıktı etkisiz <template>.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Modules\EntryPoints\Prefetch_Links;
use PHPUnit\Framework\TestCase;

final class PrefetchLinksTest extends TestCase {
	protected function setUp(): void {
		Prefetch_Links::reset();
	}

	public function test_collects_unique_ids_per_kind_and_caps(): void {
		foreach ( range( 1, 20 ) as $id ) {
			Prefetch_Links::add( $id, 'side_panel' );
		}
		Prefetch_Links::add( 3, 'side_panel' );
		Prefetch_Links::add( 0, 'side_panel' );
		Prefetch_Links::add_from_html( '<a data-wdp-form="7">x</a><a data-wdp-form="7">y</a>', 'popup' );
		$urls = Prefetch_Links::urls();
		$this->assertCount( 2, $urls );
		$this->assertStringContainsString( 'ids=' . implode( ',', range( 1, Prefetch_Links::FIRST_IDS ) ), rawurldecode( $urls[0] ) );
		$this->assertStringContainsString( 'kind=side_panel', $urls[0] );
		$this->assertStringContainsString( 'ids=7', rawurldecode( $urls[1] ) );
		$this->assertStringContainsString( 'donation-panel/v1/experiences', $urls[0] );
	}

	public function test_prints_inert_template_and_nothing_when_empty(): void {
		ob_start();
		Prefetch_Links::print_links();
		$this->assertSame( '', ob_get_clean() );
		Prefetch_Links::add( 9, 'popup' );
		ob_start();
		Prefetch_Links::print_links();
		$out = (string) ob_get_clean();
		$this->assertStringStartsWith( '<template data-dp-prefetch-links>', $out );
		$this->assertStringContainsString( '<link rel="prefetch"', $out );
		$this->assertStringNotContainsString( 'nonce', $out );
	}
}

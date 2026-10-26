<?php
/**
 * Ön yüz paketi erteleme: script etiketi yeniden yazımı.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class AssetsDeferTest extends TestCase {
	public function test_src_tag_becomes_deferred_and_keeps_inline_data(): void {
		$tag = "<script id=\"wdp-donation-modal-js-js-extra\">\nvar wdp_ajax = {\"a\":\"src=1\"};\n</script>\n"
			. "<script id=\"wdp-donation-modal-js-js\" src=\"https://e.test/a.js?ver=1\"></script>\n";
		$out = WDP_Assets_Defer::rewrite_src_tag( $tag );
		$this->assertStringContainsString( 'var wdp_ajax = {"a":"src=1"};', $out );
		$this->assertStringContainsString( '<script type="text/wdp-deferred" id="wdp-donation-modal-js-js" data-wdp-src="https://e.test/a.js?ver=1"></script>', $out );
		$this->assertStringNotContainsString( ' src="https://e.test/a.js', $out );
	}

	public function test_existing_type_async_defer_are_dropped(): void {
		$out = WDP_Assets_Defer::rewrite_src_tag( '<script type="text/javascript" defer async src=\'https://e.test/b.js\' id="x"></script>' );
		$this->assertSame( '<script type="text/wdp-deferred" id="x" data-wdp-src=\'https://e.test/b.js\'></script>', $out );
	}

	public function test_tag_without_src_is_unchanged(): void {
		$tag = '<script id="inline">var a = 1;</script>';
		$this->assertSame( $tag, WDP_Assets_Defer::rewrite_src_tag( $tag ) );
	}
}

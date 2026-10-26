<?php
/**
 * K5: WooCommerce 8.0–8.4 AddToCartForm, formdaki TÜM `<button type="submit"` düğmelerini ilk eşleşmeyle
 * değiştirir. Bağış düğmeleri bu kalıpla başlamamalı (`type` öznitelik sırasında sonda).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class K5SubmitButtonMarkupTest extends TestCase {
	public function test_donor_facing_sources_have_no_leading_type_submit_button(): void {
		foreach ( array( 'templates', 'blocks' ) as $dir ) {
			$it = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( WDP_PLUGIN_DIR . $dir, FilesystemIterator::SKIP_DOTS ) );
			foreach ( $it as $file ) {
				if ( ! in_array( $file->getExtension(), array( 'php', 'html' ), true ) || false !== strpos( $file->getPathname(), '/src/Admin/' ) ) {
					continue;
				}
				$this->assertStringNotContainsString( '<button type="submit"', (string) file_get_contents( $file->getPathname() ), $file->getPathname() );
			}
		}
	}
}

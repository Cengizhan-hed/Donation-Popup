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
	public function test_rendered_action_buttons_do_not_start_with_type_submit(): void {
		require_once WDP_PLUGIN_DIR . 'includes/templates/class-modal-shell-renderer.php';
		foreach ( array( 'donation_go_checkout', 'donation_add_to_cart' ) as $name ) {
			foreach ( array( true, false ) as $disabled ) {
				$html = WDP_Modal_Shell_Renderer::render_form_action_button( $name, 'wdp-btn', 'Label', $disabled );
				$this->assertStringContainsString( '<button', $html );
				$this->assertStringNotContainsString( '<button type="submit"', $html );
				$this->assertMatchesRegularExpression( '/<button\b[^>]*\btype="submit"[^>]*>/', $html );
				$this->assertStringContainsString( 'name="' . $name . '"', $html );
			}
		}
	}

	public function test_donor_facing_sources_have_no_leading_type_submit_button(): void {
		foreach ( array( 'includes/templates', 'templates', 'blocks' ) as $dir ) {
			$it = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( WDP_PLUGIN_DIR . $dir, FilesystemIterator::SKIP_DOTS ) );
			foreach ( $it as $file ) {
				if ( ! in_array( $file->getExtension(), array( 'php', 'html' ), true ) ) {
					continue;
				}
				$this->assertStringNotContainsString( '<button type="submit"', (string) file_get_contents( $file->getPathname() ), $file->getPathname() );
			}
		}
	}
}

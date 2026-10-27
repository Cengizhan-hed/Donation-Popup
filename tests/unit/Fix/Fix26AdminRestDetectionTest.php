<?php
/**
 * #26: yönetici REST yüklemesi yeniden yazılan/kodlanmış yollarda da algılanır.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Plugin;
use PHPUnit\Framework\TestCase;

final class Fix26AdminRestDetectionTest extends TestCase {

	public function test_pretty_path(): void {
		$this->assertTrue( Plugin::is_admin_rest_request( '/wp-json/donation-panel/v1/admin/settings', '' ) );
	}

	public function test_subdirectory_install_and_encoded_slashes(): void {
		$this->assertTrue( Plugin::is_admin_rest_request( '/blog/wp-json/donation-panel%2Fv1%2Fadmin%2Fsettings', '' ) );
	}

	public function test_plain_permalink_rest_route_query_var(): void {
		$this->assertTrue( Plugin::is_admin_rest_request( '/index.php?rest_route=%2Fdonation-panel%2Fv1%2Fadmin%2Fsettings', '' ) );
		$this->assertTrue( Plugin::is_admin_rest_request( '/', '/donation-panel/v1/admin/settings' ) );
		$this->assertTrue( Plugin::is_admin_rest_request( '/', 'donation-panel/v1/admin/settings' ) );
	}

	public function test_other_requests_do_not_match(): void {
		$this->assertFalse( Plugin::is_admin_rest_request( '/wp-json/donation-panel/v1/cart/add', '' ) );
		$this->assertFalse( Plugin::is_admin_rest_request( '/shop/', '' ) );
	}

	public function test_store_api_schema_declares_every_public_summary_key(): void {
		$cart   = new \DonationPanel\WooCommerce\Cart();
		$schema = $cart->store_api_schema();
		$summary = \DonationPanel\WooCommerce\Cart_Data::public_summary( array( 'donation_panel_kind' => 'custom', 'custom_price' => 5 ) );
		foreach ( array_keys( $summary ) as $key ) {
			$this->assertArrayHasKey( $key, $schema, $key );
		}
	}
}

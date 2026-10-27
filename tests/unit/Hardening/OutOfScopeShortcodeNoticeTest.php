<?php
/**
 * #6 davranış notu: açık id'li kısa kod bağış kapsamı dışı ürün için ziyaretçiye boş çıktı verir,
 * yalnız `manage_woocommerce` yetkisi olana anlaşılır bir ipucu gösterir.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Domain\Placement_Settings;
use DonationPanel\Modules\EntryPoints\Shortcodes;
use PHPUnit\Framework\TestCase;

final class OutOfScopeShortcodeNoticeTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options[ Placement_Settings::OPTION ] = array( 'donation_scope' => 'marked' );
		Placement_Settings::flush();
		Donation_Scope::flush();
		$product                         = new WC_Product( 41 );
		$product->price                  = '25';
		WDP_Test_State::$products[41]    = $product;
	}

	public function test_visitor_gets_empty_output_for_out_of_scope_explicit_id(): void {
		$this->assertSame( '', Shortcodes::resolve_for_output( array( 'id' => 41 ) ) );
	}

	public function test_shop_manager_sees_a_hint_with_the_product_id(): void {
		WDP_Test_State::$caps = array( 'manage_woocommerce' );
		$out                  = Shortcodes::resolve_for_output( array( 'id' => 41 ) );
		$this->assertIsString( $out );
		$this->assertStringContainsString( '41', $out );
		$this->assertStringContainsString( 'donation', strtolower( $out ) );
	}

	public function test_marked_product_still_renders_for_explicit_id(): void {
		WDP_Test_State::$post_meta[41][ Donation_Scope::META ] = 'yes';
		Donation_Scope::flush();
		$out = Shortcodes::resolve_for_output( array( 'id' => 41 ) );
		$this->assertIsArray( $out );
	}
}

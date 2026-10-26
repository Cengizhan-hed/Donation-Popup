<?php
/**
 * Bağış ürününe yerel ?add-to-cart= / form.cart isteği sepete eklenmez.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class CartNativeAddToCartTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options[ \DonationPanel\Domain\Placement_Settings::OPTION ] = array(
			'auto_place'     => 'yes',
			'display'        => 'button_panel',
			'donation_scope' => 'all',
		);
		\DonationPanel\Domain\Placement_Settings::flush();
	}

	private function donation_product(int $id, string $flag = 'yes'): WC_Product {
		$p       = new WC_Product($id);
		$p->type = 'simple';
		$p->update_meta_data('_wdp_donation_product', $flag);
		WDP_Test_State::$products[ $id ] = $p;
		\DonationPanel\Domain\Donation_Scope::flush($id);
		return $p;
	}

	public function test_get_add_to_cart_rejected_for_donation_product(): void {
		$this->donation_product(40);
		$_GET     = array( 'add-to-cart' => '40' );
		$_REQUEST = $_GET;
		$_POST    = array();
		$passed   = \DonationPanel\WooCommerce\Cart_Hooks::validate_donation_fields(true, 40, 1);
		$this->assertFalse($passed);
		$notices = WDP_Test_State::$options['__wc_notices'] ?? array();
		$this->assertNotEmpty($notices);
		$this->assertSame('error', $notices[0]['type']);
		$this->assertSame(\DonationPanel\WooCommerce\Cart_Hooks::native_add_to_cart_notice(), $notices[0]['message']);
	}

	public function test_non_donation_product_native_add_allowed(): void {
		$this->donation_product(41, 'no');
		$_POST  = array();
		$passed = \DonationPanel\WooCommerce\Cart_Hooks::validate_donation_fields(true, 41, 1);
		$this->assertTrue($passed);
		$this->assertArrayNotHasKey('__wc_notices', WDP_Test_State::$options);
	}

	public function test_plugin_flow_add_is_not_blocked(): void {
		$this->donation_product(42);
		$_POST = array();
		$passed = \DonationPanel\WooCommerce\Cart_Hooks::run_in_plugin_flow(
			static function () {
				return \DonationPanel\WooCommerce\Cart_Hooks::validate_donation_fields(true, 42, 1);
			}
		);
		$this->assertTrue($passed);
		$this->assertFalse(\DonationPanel\WooCommerce\Cart_Hooks::validate_donation_fields(true, 42, 1), 'akış dışında yerel ekleme reddedilir');
	}

	public function test_plugin_flow_store_api_add_is_not_blocked(): void {
		$p = $this->donation_product(43);
		\DonationPanel\WooCommerce\Cart_Hooks::run_in_plugin_flow(
			static function () use ($p) {
				\DonationPanel\WooCommerce\Cart_Hooks::validate_store_api_add_to_cart($p);
			}
		);
		$this->assertTrue(true);
	}

	public function test_explicit_flag_rejects_even_if_auto_place_off(): void {
		WDP_Test_State::$options[ \DonationPanel\Domain\Placement_Settings::OPTION ]['auto_place'] = 'no';
		\DonationPanel\Domain\Placement_Settings::flush();
		$this->donation_product(44, 'yes');
		$this->assertTrue(\DonationPanel\WooCommerce\Cart_Hooks::should_reject_native_add_to_cart(44));
		$this->assertFalse(\DonationPanel\WooCommerce\Cart_Hooks::validate_donation_fields(true, 44, 1));
	}

	public function test_store_api_throws_for_donation_product(): void {
		$p = $this->donation_product(45);
		$this->expectException(Exception::class);
		$this->expectExceptionMessage(\DonationPanel\WooCommerce\Cart_Hooks::native_add_to_cart_notice());
		\DonationPanel\WooCommerce\Cart_Hooks::validate_store_api_add_to_cart($p);
	}

	public function test_store_api_allows_non_donation(): void {
		$p = $this->donation_product(46, 'no');
		\DonationPanel\WooCommerce\Cart_Hooks::validate_store_api_add_to_cart($p);
		$this->assertFalse(\DonationPanel\WooCommerce\Cart_Hooks::should_reject_native_add_to_cart(46));
	}
}

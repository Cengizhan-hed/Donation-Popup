<?php
/**
 * WDP_Donation_Scope: ürün tipi, işaret ve genel kapsam.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class DonationScopeTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options[ WDP_Placement_Settings::OPTION ] = array(
			'donation_scope'      => 'all',
			'donation_categories' => array(),
		);
	}

	private function product(int $id, string $type = 'simple'): WC_Product {
		$p       = new WC_Product($id);
		$p->type = $type;
		WDP_Test_State::$products[ $id ] = $p;
		return $p;
	}

	public function test_unsupported_type_is_never_donation(): void {
		$p = $this->product(1, 'variable');
		WDP_Test_State::$post_meta[1][ WDP_Donation_Scope::META ] = 'yes';
		$this->assertFalse(WDP_Donation_Scope::is_donation_product($p));
	}

	public function test_product_flag_yes_and_no(): void {
		$p = $this->product(2);
		WDP_Test_State::$post_meta[2][ WDP_Donation_Scope::META ] = 'yes';
		$this->assertTrue(WDP_Donation_Scope::is_donation_product($p));
		WDP_Donation_Scope::flush(2);
		WDP_Test_State::$post_meta[2][ WDP_Donation_Scope::META ] = 'no';
		$this->assertFalse(WDP_Donation_Scope::is_donation_product($p));
	}

	public function test_scope_all_default(): void {
		$p = $this->product(3);
		$this->assertTrue(WDP_Donation_Scope::is_donation_product($p));
	}

	public function test_scope_marked_requires_flag(): void {
		WDP_Test_State::$options[ WDP_Placement_Settings::OPTION ] = array('donation_scope' => 'marked');
		WDP_Placement_Settings::flush();
		$p = $this->product(4);
		$this->assertFalse(WDP_Donation_Scope::is_donation_product($p));
		WDP_Donation_Scope::flush(4);
		WDP_Test_State::$post_meta[4][ WDP_Donation_Scope::META ] = 'yes';
		$this->assertTrue(WDP_Donation_Scope::is_donation_product($p));
	}

	public function test_filter_can_override(): void {
		$p = $this->product(5);
		add_filter(
			'wdp_is_donation_product',
			static function () {
				return false;
			}
		);
		$this->assertFalse(WDP_Donation_Scope::is_donation_product($p));
	}
}

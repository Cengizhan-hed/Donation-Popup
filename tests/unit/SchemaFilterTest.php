<?php
/**
 * Product schema: sabit/hisseli fiyatlı kalır, açık tutar/kampanya fiyatsız düşer.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class SchemaFilterTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options[ WDP_Placement_Settings::OPTION ] = array('schema' => 'auto', 'donation_scope' => 'all');
	}

	private function product(int $id, string $type, string $price): WC_Product {
		$p        = new WC_Product($id);
		$p->price = $price;
		$p->type  = 'simple';
		WDP_Test_State::$products[ $id ] = $p;
		foreach (WDP_Donation_Type::to_meta($type) as $key => $value) {
			WDP_Test_State::$post_meta[ $id ][ $key ] = $value;
		}
		return $p;
	}

	public function test_fixed_with_price_keeps_markup(): void {
		$p = $this->product(1, WDP_Donation_Type::FIXED, '50');
		$out = WDP_Schema::filter_wc_product(array('@type' => 'Product'), $p);
		$this->assertSame('Product', $out['@type']);
	}

	public function test_custom_without_price_drops_markup(): void {
		$p = $this->product(2, WDP_Donation_Type::CUSTOM, '');
		$out = WDP_Schema::filter_wc_product(array('@type' => 'Product'), $p);
		$this->assertSame(array(), $out);
	}

	public function test_schema_off_keeps_markup(): void {
		WDP_Test_State::$options[ WDP_Placement_Settings::OPTION ] = array('schema' => 'off', 'donation_scope' => 'all');
		WDP_Placement_Settings::flush();
		$p = $this->product(3, WDP_Donation_Type::CUSTOM, '');
		$out = WDP_Schema::filter_wc_product(array('@type' => 'Product'), $p);
		$this->assertSame('Product', $out['@type']);
	}
}

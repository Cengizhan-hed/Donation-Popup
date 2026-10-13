<?php
/**
 * WDP_Product_Resolver çözüm sırası ve açık ürün nitelikleri.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class ProductResolverTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		$this->seed(5, 'kurban', 'SKU-5');
		$this->seed(9, 'su', 'SKU-9');
	}

	private function seed(int $id, string $slug, string $sku): WC_Product {
		$p        = new WC_Product($id);
		$p->name  = 'Ürün ' . $id;
		$p->slug  = $slug;
		$p->type  = 'simple';
		WDP_Test_State::$products[ $id ]      = $p;
		WDP_Test_State::$product_slugs[ $slug ] = $id;
		WDP_Test_State::$product_skus[ $sku ]   = $id;
		return $p;
	}

	public function test_id_wins(): void {
		$product = WDP_Product_Resolver::resolve(array('id' => 9, 'slug' => 'kurban'));
		$this->assertSame(9, $product->get_id());
	}

	public function test_slug_then_sku(): void {
		$product = WDP_Product_Resolver::resolve(array('slug' => 'kurban'));
		$this->assertSame(5, $product->get_id());
		$product = WDP_Product_Resolver::resolve(array('sku' => 'SKU-9'));
		$this->assertSame(9, $product->get_id());
	}

	public function test_block_context_post_id(): void {
		$product = WDP_Product_Resolver::resolve(array(), array('postId' => 5, 'postType' => 'product'));
		$this->assertSame(5, $product->get_id());
	}

	public function test_global_product_without_overwriting_loop(): void {
		$GLOBALS['product'] = WDP_Test_State::$products[9];
		$resolved = WDP_Product_Resolver::resolve(array());
		$this->assertSame(9, $resolved->get_id());
		$this->assertSame(9, $GLOBALS['product']->get_id());
	}

	public function test_is_product_queried_object(): void {
		WDP_Test_State::$is_product = true;
		WDP_Test_State::$queried_id = 5;
		$product = WDP_Product_Resolver::resolve(array());
		$this->assertSame(5, $product->get_id());
	}

	public function test_explicit_product_flags(): void {
		$this->assertTrue(WDP_Product_Resolver::has_explicit_product(array('id' => 5)));
		$this->assertTrue(WDP_Product_Resolver::has_explicit_product(array('slug' => 'kurban')));
		$this->assertTrue(WDP_Product_Resolver::has_explicit_product(array('sku' => 'SKU-5')));
		$this->assertFalse(WDP_Product_Resolver::has_explicit_product(array()));
	}

	public function test_filter_can_override(): void {
		add_filter(
			'wdp_resolve_product',
			static function ($product, $atts) {
				return WDP_Test_State::$products[9];
			}
		);
		$product = WDP_Product_Resolver::resolve(array('id' => 5));
		$this->assertSame(9, $product->get_id());
	}
}

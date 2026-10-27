<?php
/**
 * Entegrasyon altyapısı gerçekten WordPress + WooCommerce + eklenti + HPOS üzerinde çalışıyor.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

final class InfrastructureTest extends WDP_Integration_Test_Case {

	public function test_runs_on_real_wordpress_woocommerce_and_plugin_with_hpos(): void {
		$this->assertTrue( class_exists( 'WooCommerce' ) );
		$this->assertTrue( defined( 'WDP_VERSION' ) );
		$this->assertTrue( \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled(), 'HPOS açık olmalı' );
		$this->assertNotSame( '', get_bloginfo( 'version' ) );
	}

	public function test_real_order_roundtrip(): void {
		$product = $this->create_product( '30' );
		$order   = $this->create_order( $product->get_id(), 30.0, 'completed' );
		$loaded  = wc_get_order( $order->get_id() );
		$this->assertSame( 'completed', $loaded->get_status() );
		$this->assertCount( 1, $loaded->get_items() );
	}
}

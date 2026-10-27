<?php
/**
 * #15: eklenti HPOS ve blok sepet/ödeme uyumluluğunu bildirir.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/features-util-fake.php';

use Automattic\WooCommerce\Utilities\FeaturesUtil;
use DonationPanel\Core\Bootstrap;
use PHPUnit\Framework\TestCase;

final class CompatibilityDeclarationTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		FeaturesUtil::$declared = array();
		if ( ! defined( 'WDP_PLUGIN_FILE' ) ) {
			define( 'WDP_PLUGIN_FILE', '/x/woo-donation-popup.php' );
		}
	}

	public function test_declares_custom_order_tables_and_cart_checkout_blocks(): void {
		Bootstrap::declare_woocommerce_compatibility();
		$features = array_column( FeaturesUtil::$declared, 0 );
		$this->assertContains( 'custom_order_tables', $features );
		$this->assertContains( 'cart_checkout_blocks', $features );
		foreach ( FeaturesUtil::$declared as $row ) {
			$this->assertTrue( $row[2] );
		}
	}
}

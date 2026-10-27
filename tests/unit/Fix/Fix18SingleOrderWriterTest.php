<?php
/**
 * #18: sipariş kalemi bağış verisini tek yazıcı yazar; Deneyim modülü kapalıyken bile bağış türü yazılır.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__ ) . '/Experiences/E2BOrderMetaTest.php';

use DonationPanel\WooCommerce\Donation_Order_Meta;
use DonationPanel\WooCommerce\Order_Hooks;
use PHPUnit\Framework\TestCase;

final class Fix18SingleOrderWriterTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_core_registers_exactly_one_writer_that_also_writes_type_without_experiences_module(): void {
		Order_Hooks::init();
		$callbacks = WDP_Test_State::$actions[ Donation_Order_Meta::HOOK ] ?? array();
		$this->assertCount( 1, $callbacks, 'tek yazıcı' );

		$item = new E2B_Fake_Order_Item();
		do_action(
			Donation_Order_Meta::HOOK,
			$item,
			'k1',
			array(
				'custom_price'        => 50.0,
				'donation_panel_kind' => 'custom',
				'donation_data'       => array( 'full_name' => 'Çağlar Öztürk', 'anonymous' => '1' ),
			),
			null
		);
		$this->assertSame( 'custom', $item->meta[ Donation_Order_Meta::KEY_TYPE ] );
		$this->assertSame( 50.0, $item->meta['_custom_price'] );
		$this->assertSame( 'Çağlar Öztürk', $item->meta['wdp_donor_name'], 'anonim bile olsa ad silinmez' );
	}

	public function test_legacy_static_writer_delegates_and_does_not_double_write(): void {
		$item   = new E2B_Fake_Order_Item();
		$values = array( 'donation_panel_kind' => 'fixed', 'donation_data' => array( 'full_name' => 'Ali' ) );
		Order_Hooks::add_donation_meta_to_order( $item, 'k', $values, null );
		Order_Hooks::add_donation_meta_to_order( $item, 'k', $values, null );
		$this->assertSame( 'fixed', $item->meta[ Donation_Order_Meta::KEY_TYPE ] );
		$this->assertSame( 'Ali', $item->meta['wdp_donor_name'] );
	}
}

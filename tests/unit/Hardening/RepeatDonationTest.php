<?php
/**
 * #25: tekrar bağış yalnız ödenmiş siparişten; ücret/anonim/not/tür taşınır; tutar ücretsiz birim tutardır.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';
require_once dirname( __DIR__ ) . '/DonorAccount/DonorAccountModuleTest.php';

use DonationPanel\Modules\DonorAccount\Account_Controller;
use PHPUnit\Framework\TestCase;

final class RepeatDonationTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_only_paid_orders_can_be_repeated(): void {
		$this->assertTrue( Account_Controller::repeat_status_allowed( 'completed' ) );
		$this->assertTrue( Account_Controller::repeat_status_allowed( 'wc-processing' ) );
		foreach ( array( 'cancelled', 'failed', 'pending', 'refunded', 'trash', '' ) as $status ) {
			$this->assertFalse( Account_Controller::repeat_status_allowed( $status ), $status );
		}
	}

	public function test_input_carries_note_anonymous_type_and_strips_fee_from_amount(): void {
		$data  = array(
			'wdp_donor_name'    => array( 'value' => 'Çağlar Öztürk' ),
			'wdp_donation_note' => array( 'value' => 'Not ğüşiöç' ),
			'wdp_anonymous'     => array( 'value' => 'yes' ),
			'wdp_cover_fee'     => array( 'value' => '5' ),
		);
		$input = Account_Controller::repeat_input( $data, 105.0, 'monthly', 2 );
		$this->assertSame( 100.0, $input['amount'] );
		$this->assertSame( '1', $input['donation_cover_fee'] );
		$this->assertSame( 'Not ğüşiöç', $input['donation_note'] );
		$this->assertSame( '1', $input['donation_anonymous'] );
		$this->assertSame( 'monthly', $input['donation_type'] );
		$this->assertSame( 'Çağlar Öztürk', $input['donation_full_name'] );
	}

	public function test_no_fee_keeps_total_and_omits_flags(): void {
		$input = Account_Controller::repeat_input( array(), 50.0, '', 2 );
		$this->assertSame( 50.0, $input['amount'] );
		$this->assertArrayNotHasKey( 'donation_cover_fee', $input );
		$this->assertArrayNotHasKey( 'donation_anonymous', $input );
		$this->assertArrayNotHasKey( 'donation_type', $input );
	}
}

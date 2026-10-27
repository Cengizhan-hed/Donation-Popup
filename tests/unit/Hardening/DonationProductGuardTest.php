<?php
/**
 * #6: cart/add, form ve experience uçları yalnız bağış hattındaki ürünü kabul eder.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Domain\Placement_Settings;
use DonationPanel\Modules\Experiences\Cart_Controller;
use DonationPanel\Modules\Experiences\Form_Controller;
use PHPUnit\Framework\TestCase;

final class DonationProductGuardTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		Donation_Scope::flush();
		Placement_Settings::flush();
	}

	private function product( int $id, string $price = '25', array $meta = array() ): WC_Product {
		$p        = new WC_Product( $id );
		$p->price = $price;
		foreach ( $meta as $k => $v ) {
			WDP_Test_State::$post_meta[ $id ][ $k ] = $v;
		}
		WDP_Test_State::$products[ $id ] = new WC_Product( $id );
		WDP_Test_State::$products[ $id ]->price = $price;
		return WDP_Test_State::$products[ $id ];
	}

	public function test_donation_product_gets_a_model(): void {
		$this->product( 10 );
		$this->assertNotEmpty( Form_Controller::model_for_id( 10 ) );
	}

	public function test_non_donation_product_is_rejected(): void {
		WDP_Test_State::$options[ Placement_Settings::OPTION ] = array( 'donation_scope' => 'marked' );
		Placement_Settings::flush();
		$this->product( 11 );
		$this->assertSame( array(), Form_Controller::model_for_id( 11 ) );
		$this->assertNull( Cart_Controller::product_for_id( 11 ) );
	}

	public function test_marked_product_is_accepted_when_scope_marked(): void {
		WDP_Test_State::$options[ Placement_Settings::OPTION ] = array( 'donation_scope' => 'marked' );
		Placement_Settings::flush();
		$this->product( 12, '25', array( Donation_Scope::META => 'yes' ) );
		$this->assertNotEmpty( Form_Controller::model_for_id( 12 ) );
		$this->assertNotNull( Cart_Controller::product_for_id( 12 ) );
	}

	public function test_zero_price_product_without_donor_chooses_is_rejected(): void {
		$this->product( 13, '0' );
		$this->assertSame( array(), Form_Controller::model_for_id( 13 ) );
		$this->assertNull( Cart_Controller::product_for_id( 13 ) );
	}

	public function test_zero_price_product_with_donor_chooses_is_accepted(): void {
		$this->product( 14, '', array( '_allow_custom_price' => 'yes' ) );
		$this->assertNotEmpty( Form_Controller::model_for_id( 14 ) );
	}

	public function test_unsupported_type_is_rejected(): void {
		$p       = $this->product( 15 );
		$p->type = 'variable';
		$this->assertSame( array(), Form_Controller::model_for_id( 15 ) );
	}
}

<?php
/**
 * Cart shareholder parse unit tests.
 *
 * @package WDP\Tests
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * @covers Cart_Hooks
 */
final class CartShareholdersParseTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_parses_valid_shareholders(): void {
		$result = \DonationPanel\WooCommerce\Cart_Hooks::parse_shareholders_from_request(
			array(
				'shareholder_name_1'  => 'Ali Veli',
				'shareholder_phone_1' => '+90 532 000 00 00',
				'shareholder_note_1'  => 'Not',
				'shareholder_email_1' => 'ali@example.com',
			),
			1
		);

		$this->assertSame( 1, $result['share_count'] );
		$this->assertSame( array(), $result['missing_fields'] );
		$this->assertArrayHasKey( 1, $result['shareholders'] );
		$this->assertSame( 'Ali Veli', $result['shareholders'][1]['name'] );
		$this->assertSame( 'ali@example.com', $result['shareholders'][1]['email'] );
	}

	public function test_reports_missing_required_contact(): void {
		$result = \DonationPanel\WooCommerce\Cart_Hooks::parse_shareholders_from_request(
			array(
				'shareholder_name_1' => '',
			),
			1,
			array( 'require_contact' => true )
		);

		$this->assertNotEmpty( $result['missing_fields'] );
		$this->assertContains( 'shareholder_name_1', $result['missing_field_keys'] );
		$this->assertContains( 'shareholder_phone_1', $result['missing_field_keys'] );
	}

	public function test_clamps_share_count_to_max(): void {
		$result = \DonationPanel\WooCommerce\Cart_Hooks::parse_shareholders_from_request(
			array(),
			99,
			array( 'max_shares' => 3, 'require_contact' => false )
		);
		$this->assertSame( 3, $result['share_count'] );
	}
}

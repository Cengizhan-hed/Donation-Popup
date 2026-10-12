<?php
/**
 * Shareholder settings hex merge unit tests.
 *
 * @package WDP\Tests
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * @covers WDP_Admin_Settings_Normalizer
 */
final class ShareholderSettingsHexTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_pick_hex_uses_request_then_existing_then_default(): void {
		WDP_Test_State::$options['wdp_shareholder_settings'] = array(
			'shareholder_header_bg' => '#112233',
		);

		$from_request = WDP_Admin_Settings_Normalizer::normalize_shareholder_settings(
			array(
				'shareholder_header_bg' => '#abcdef',
			)
		);
		$this->assertSame( '#abcdef', $from_request['shareholder_header_bg'] );

		$from_existing = WDP_Admin_Settings_Normalizer::normalize_shareholder_settings( array() );
		$this->assertSame( '#112233', $from_existing['shareholder_header_bg'] );

		WDP_Test_State::$options['wdp_shareholder_settings'] = array();
		$from_default = WDP_Admin_Settings_Normalizer::normalize_shareholder_settings( array() );
		$this->assertSame( '#0f608b', $from_default['shareholder_header_bg'] );
	}

	public function test_invalid_hex_falls_back_to_default(): void {
		$out = WDP_Admin_Settings_Normalizer::normalize_shareholder_settings(
			array(
				'shareholder_header_bg' => 'not-a-color',
			)
		);
		$this->assertSame( '#0f608b', $out['shareholder_header_bg'] );
	}

	public function test_null_existing_hex_does_not_fatal(): void {
		WDP_Test_State::$options['wdp_shareholder_settings'] = array(
			'shareholder_header_bg' => null,
		);
		$out = WDP_Admin_Settings_Normalizer::normalize_shareholder_settings( array() );
		$this->assertSame( '#0f608b', $out['shareholder_header_bg'] );
	}
}

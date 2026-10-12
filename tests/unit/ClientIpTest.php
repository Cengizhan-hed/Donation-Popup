<?php
/**
 * Client IP resolution unit tests.
 *
 * @package WDP\Tests
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * @covers WDP_Security
 */
final class ClientIpTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_prefers_remote_addr_when_proxy_headers_untrusted(): void {
		$_SERVER['REMOTE_ADDR']          = '203.0.113.10';
		$_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.20';

		$this->assertSame( '203.0.113.10', WDP_Security::get_client_ip() );
	}

	public function test_uses_forwarded_for_when_proxy_trusted(): void {
		$_SERVER['REMOTE_ADDR']          = '10.0.0.1';
		$_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.20, 10.0.0.1';
		add_filter(
			'wdp_trust_proxy_headers',
			static function () {
				return true;
			}
		);

		$this->assertSame( '198.51.100.20', WDP_Security::get_client_ip() );
	}

	public function test_returns_zero_when_no_valid_ip(): void {
		$this->assertSame( '0.0.0.0', WDP_Security::get_client_ip() );
	}
}

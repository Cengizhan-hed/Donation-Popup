<?php
/**
 * #1: istemci IP'si varsayılan REMOTE_ADDR; vekil başlıkları yalnız güvenilen vekilden gelirse; girişli kullanıcı kimlikle sayılır.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Http\Client_Ip;
use DonationPanel\Http\Rate_Limiter;
use PHPUnit\Framework\TestCase;

final class ClientIpTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		$_SERVER = array();
	}

	protected function tearDown(): void {
		$_SERVER = array();
	}

	public function test_default_is_remote_addr_and_ignores_spoofable_headers(): void {
		$_SERVER['REMOTE_ADDR']          = '203.0.113.10';
		$_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.20';
		$_SERVER['HTTP_X_REAL_IP']       = '198.51.100.21';
		$this->assertSame( '203.0.113.10', Client_Ip::get() );
	}

	public function test_forwarded_header_trusted_only_from_trusted_proxy(): void {
		add_filter( 'donation_panel_trusted_proxies', static function () {
			return array( '10.0.0.0/8', '192.0.2.5' );
		} );
		$_SERVER['REMOTE_ADDR']          = '10.1.2.3';
		$_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.20, 10.9.9.9';
		$this->assertSame( '198.51.100.20', Client_Ip::get() );

		// Güvenilmeyen kaynaktan gelen başlık yok sayılır.
		$_SERVER['REMOTE_ADDR'] = '203.0.113.50';
		$this->assertSame( '203.0.113.50', Client_Ip::get() );
	}

	public function test_forwarded_chain_spoof_from_client_is_not_trusted(): void {
		add_filter( 'donation_panel_trusted_proxies', static function () {
			return array( '10.0.0.1' );
		} );
		// İstemci kendi sahte değerini başa ekledi; sağdan ilk güvenilmeyen gerçek istemcidir.
		$_SERVER['REMOTE_ADDR']          = '10.0.0.1';
		$_SERVER['HTTP_X_FORWARDED_FOR'] = '1.1.1.1, 198.51.100.77';
		$this->assertSame( '198.51.100.77', Client_Ip::get() );
	}

	public function test_invalid_remote_falls_back_to_zero(): void {
		$this->assertSame( '0.0.0.0', Client_Ip::get() );
	}

	public function test_final_filter_can_override(): void {
		$_SERVER['REMOTE_ADDR'] = '203.0.113.10';
		add_filter( 'donation_panel_client_ip', static function () {
			return '192.0.2.200';
		} );
		$this->assertSame( '192.0.2.200', Client_Ip::get() );
	}

	public function test_ipv6_cidr_trusted_proxy(): void {
		add_filter( 'donation_panel_trusted_proxies', static function () {
			return array( '2001:db8::/32' );
		} );
		$_SERVER['REMOTE_ADDR']          = '2001:db8::1';
		$_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.9';
		$this->assertSame( '198.51.100.9', Client_Ip::get() );
	}

	public function test_default_limiter_uses_client_ip_helper_not_shared_bucket_for_users(): void {
		$_SERVER['REMOTE_ADDR'] = '203.0.113.10';
		$limiter                = new Rate_Limiter();
		for ( $i = 0; $i < 3; $i++ ) {
			$this->assertTrue( $limiter->hit( 'b', 3 ) );
		}
		$this->assertFalse( $limiter->hit( 'b', 3 ) );

		// Girişli kullanıcı kendi kovasındadır (IP'den bağımsız).
		WDP_Test_State::$user_id = 42;
		$this->assertTrue( $limiter->hit( 'b', 3 ) );
	}

	public function test_admin_setting_defines_trusted_proxies(): void {
		update_option( 'donation_panel_settings', array( 'general' => array( 'trusted_proxies' => "10.0.0.0/8\nnot-an-ip, 192.0.2.5" ) ) );
		$this->assertSame( array( '10.0.0.0/8', '192.0.2.5' ), Client_Ip::trusted_proxies() );
		$_SERVER['REMOTE_ADDR']          = '10.1.2.3';
		$_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.20';
		$this->assertSame( '198.51.100.20', Client_Ip::get() );
		$_SERVER['REMOTE_ADDR'] = '203.0.113.50';
		$this->assertSame( '203.0.113.50', Client_Ip::get() );
	}

	public function test_empty_setting_keeps_remote_addr(): void {
		$this->assertSame( array(), Client_Ip::trusted_proxies() );
	}

	public function test_legacy_trust_filter_still_honoured(): void {
		add_filter( 'wdp_trust_proxy_headers', static function () {
			return true;
		} );
		$_SERVER['REMOTE_ADDR']          = '10.0.0.1';
		$_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.20, 10.0.0.1';
		$this->assertSame( '198.51.100.20', Client_Ip::get() );
	}
}

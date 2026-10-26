<?php
/**
 * Güvenlik reddi HTTP kodları: nonce 403, istek sınırı 429, yetki 403; asla 200.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class SecurityAjaxHttpTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		$_POST    = array();
		$_REQUEST = array();
		$_SERVER  = array(
			'REQUEST_METHOD' => 'POST',
			'HTTP_ORIGIN'    => 'https://example.test',
			'REMOTE_ADDR'    => '127.0.0.1',
		);
	}

	protected function tearDown(): void {
		$_POST    = array();
		$_REQUEST = array();
		$_SERVER  = array();
		WDP_Test_State::reset();
	}

	public function test_logged_in_rate_limit_key_uses_user_id(): void {
		WDP_Test_State::$user_id = 7;
		$key                     = \DonationPanel\Support\Security::get_rate_limit_key('get_product_info');
		$this->assertSame('u:7|a:get_product_info', $key);
		$this->assertSame('u:7|a:get_product_info', \DonationPanel\Support\Security::get_rate_limit_key('get_product_info', true));
	}

	public function test_guest_rate_limit_key_is_not_user_scoped(): void {
		WDP_Test_State::$user_id = 0;
		$key                     = \DonationPanel\Support\Security::get_rate_limit_key('add_to_cart');
		$this->assertStringStartsWith('g:', $key);
		$this->assertStringNotContainsString('u:', $key);
		$this->assertStringNotContainsString('v:', $key);
	}

	public function test_guest_read_key_has_no_cookie_dependency(): void {
		WDP_Test_State::$user_id    = 0;
		$_SERVER['REMOTE_ADDR']     = '203.0.113.10';
		$_SERVER['HTTP_USER_AGENT'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)';

		$plain = \DonationPanel\Support\Security::get_rate_limit_key('get_product_info', true);
		// Eski wdp_vid çerezi gelse bile anahtar değişmez ve yeni çerez yazılmaz.
		$_COOKIE['wdp_vid'] = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.9999999999.deadbeef';
		$with_cookie        = \DonationPanel\Support\Security::get_rate_limit_key('get_product_info', true);

		$this->assertStringStartsWith('g:', $plain);
		$this->assertSame($plain, $with_cookie);
		$this->assertSame('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.9999999999.deadbeef', $_COOKIE['wdp_vid']);
		$this->assertFalse(method_exists('DonationPanel\\Support\\Security', 'get_visitor_id'));
		$this->assertFalse(method_exists('DonationPanel\\Support\\Security', 'mint_visitor_token'));
		$this->assertSame(
			\DonationPanel\Support\Security::get_rate_limit_ip_key('get_product_info'),
			\DonationPanel\Support\Security::get_rate_limit_ip_key('get_product_info')
		);
	}

	public function test_guest_read_ip_layer_caps_shared_cgnat(): void {
		WDP_Test_State::$user_id    = 0;
		$_SERVER['REMOTE_ADDR']     = '198.51.100.20';
		$_SERVER['HTTP_USER_AGENT'] = 'Mozilla/5.0 (Linux; Android 14) SameModel';
		WDP_Test_State::$filters['wdp_rate_limit_ip_max'] = static function ( $limit ) {
			return 3;
		};

		for ( $i = 0; $i < 3; $i++ ) {
			$this->assertTrue(
				\DonationPanel\Support\Security::check_action_rate_limit('get_product_info', 60, 60, true),
				'request ' . ( $i + 1 )
			);
		}

		$this->assertFalse(\DonationPanel\Support\Security::check_action_rate_limit('get_product_info', 60, 60, true));
	}

	public function test_guest_read_different_ua_are_separate_buckets(): void {
		WDP_Test_State::$user_id    = 0;
		$_SERVER['REMOTE_ADDR']     = '192.0.2.40';
		$_SERVER['HTTP_USER_AGENT'] = 'Mozilla/5.0 UA-One';

		for ( $i = 0; $i < 60; $i++ ) {
			$this->assertTrue(\DonationPanel\Support\Security::check_action_rate_limit('get_product_info', 60, 60, true), 'a' . $i);
		}
		$this->assertFalse(\DonationPanel\Support\Security::check_action_rate_limit('get_product_info', 60, 60, true));

		$_SERVER['HTTP_USER_AGENT'] = 'Mozilla/5.0 UA-Two';
		$this->assertTrue(\DonationPanel\Support\Security::check_action_rate_limit('get_product_info', 60, 60, true));
	}

}

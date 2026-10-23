<?php
/**
 * Güvenlik reddi HTTP kodları: nonce 403, istek sınırı 429, yetki 403; asla 200.
 *
 * @package WooCommerce\Donation_Popup
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

	public function test_json_error_never_sends_http_200(): void {
		try {
			WDP_Utils::json_error('test');
			$this->fail('json expected');
		} catch (WDP_Json_Sent $e) {
			$this->assertSame(400, $e->status);
			$this->assertFalse($e->payload['success']);
		}

		WDP_Test_State::$last_json    = null;
		WDP_Test_State::$json_status  = 0;
		try {
			WDP_Utils::json_error(new WDP_Security_Exception(null, 'nonce'));
			$this->fail('json expected');
		} catch (WDP_Json_Sent $e) {
			$this->assertSame(403, $e->status);
			$this->assertSame('nonce', $e->payload['code']);
			$this->assertFalse($e->payload['success']);
		}

		WDP_Test_State::$last_json   = null;
		WDP_Test_State::$json_status = 0;
		try {
			WDP_Utils::json_error(new WDP_Security_Exception('rate', 'rate_limit', 60));
			$this->fail('json expected');
		} catch (WDP_Json_Sent $e) {
			$this->assertSame(429, $e->status);
			$this->assertSame('rate_limit', $e->payload['code']);
			$this->assertSame(60, $e->payload['retry_after']);
		}

		WDP_Test_State::$last_json   = null;
		WDP_Test_State::$json_status = 0;
		try {
			WDP_Utils::json_error(new WDP_Security_Exception('cap', 'capability'));
			$this->fail('json expected');
		} catch (WDP_Json_Sent $e) {
			$this->assertSame(403, $e->status);
			$this->assertSame('capability', $e->payload['code']);
		}
	}

	public function test_logged_in_rate_limit_key_uses_user_id(): void {
		WDP_Test_State::$user_id = 7;
		$key                     = WDP_Security::get_rate_limit_key('get_product_info');
		$this->assertSame('u:7|a:get_product_info', $key);
	}

	public function test_guest_rate_limit_key_is_not_user_scoped(): void {
		WDP_Test_State::$user_id = 0;
		$key                     = WDP_Security::get_rate_limit_key('get_product_info');
		$this->assertStringStartsWith('g:', $key);
		$this->assertStringNotContainsString('u:', $key);
	}

	public function test_product_info_nonce_fail_is_http_403(): void {
		$_POST['security']    = '';
		$_REQUEST['security'] = '';
		$_POST['product_id']  = '41';
		try {
			WDP_Ajax::get_product_info();
			$this->fail('json expected');
		} catch (WDP_Json_Sent $e) {
			$this->assertSame(403, $e->status);
			$this->assertFalse($e->payload['success']);
			$this->assertSame('nonce', $e->payload['code']);
		}
	}

	public function test_product_info_rate_limit_is_http_429(): void {
		WDP_Test_State::$user_id = 3;
		$live                    = new WC_Product(41);
		$live->name              = 'Açık bağış';
		$live->price             = '25';
		WDP_Test_State::$products[41] = $live;
		$_POST['security']            = 'test-nonce';
		$_REQUEST['security']         = 'test-nonce';
		$_POST['product_id']          = '41';

		for ($i = 0; $i < 60; $i++) {
			WDP_Test_State::$last_json   = null;
			WDP_Test_State::$json_status = 0;
			try {
				WDP_Ajax::get_product_info();
				$this->fail('success expected');
			} catch (WDP_Json_Sent $e) {
				$this->assertSame(200, $e->status, 'istek ' . ($i + 1));
				$this->assertTrue($e->payload['success']);
			}
		}

		WDP_Test_State::$last_json   = null;
		WDP_Test_State::$json_status = 0;
		try {
			WDP_Ajax::get_product_info();
			$this->fail('rate limit expected');
		} catch (WDP_Json_Sent $e) {
			$this->assertSame(429, $e->status);
			$this->assertFalse($e->payload['success']);
			$this->assertSame('rate_limit', $e->payload['code']);
			$this->assertSame(60, $e->payload['retry_after']);
		}
	}
}

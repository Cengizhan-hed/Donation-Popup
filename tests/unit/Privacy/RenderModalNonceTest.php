<?php
/**
 * wdp_render_modal: nonce zorunlu (403 + code nonce), süzgeçle kapatılabilir; ortak üretici ürün hatalarını döndürür.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class RenderModalNonceTest extends TestCase {
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

	public function test_missing_nonce_is_403_with_nonce_code(): void {
		$_REQUEST['product_id'] = '41';
		try {
			WDP_Lazy_Modal::ajax_render();
			$this->fail('json expected');
		} catch (WDP_Json_Sent $e) {
			$this->assertSame(403, $e->status);
			$this->assertFalse($e->payload['success']);
			$this->assertSame('nonce', $e->payload['data']['code']);
		}
	}

	public function test_valid_nonce_passes_to_product_validation(): void {
		$_REQUEST['product_id'] = '999';
		$_REQUEST['security']   = 'test-nonce';
		try {
			WDP_Lazy_Modal::ajax_render();
			$this->fail('json expected');
		} catch (WDP_Json_Sent $e) {
			// Ürün yok → 404 (nonce aşıldı).
			$this->assertSame(404, $e->status);
		}
	}

	public function test_filter_can_disable_nonce_for_backward_compat(): void {
		WDP_Test_State::$filters['wdp_render_modal_require_nonce'] = static function () {
			return false;
		};
		$_REQUEST['product_id'] = '999';
		try {
			WDP_Lazy_Modal::ajax_render();
			$this->fail('json expected');
		} catch (WDP_Json_Sent $e) {
			$this->assertSame(404, $e->status);
		}
	}

	public function test_build_reports_missing_product_without_nonce_dependency(): void {
		$result = WDP_Lazy_Modal::build(999, 'popup');
		$this->assertSame(404, $result['status']);
		$this->assertArrayNotHasKey('html', $result);
	}

	public function test_rest_controller_is_listed_via_filter(): void {
		$list = WDP_Lazy_Modal::add_rest_controller(array());
		$this->assertCount(1, $list);
		$this->assertInstanceOf('DonationPanel\Http\Rest\Modal_Controller', $list[0]);
	}
}

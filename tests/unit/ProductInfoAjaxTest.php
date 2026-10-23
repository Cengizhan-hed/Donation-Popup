<?php
/**
 * wdp_get_product_info: 400 + yayımlı ürün success (katalog gizliliği düşürmez).
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class ProductInfoAjaxTest extends TestCase {
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

	public function test_parse_product_info_id_rejects_empty_and_zero(): void {
		$this->assertSame(0, WDP_Ajax::parse_product_info_id(null));
		$this->assertSame(0, WDP_Ajax::parse_product_info_id(''));
		$this->assertSame(0, WDP_Ajax::parse_product_info_id('0'));
		$this->assertSame(42, WDP_Ajax::parse_product_info_id('42'));
	}

	public function test_published_product_resolves_even_if_catalog_hidden(): void {
		$hidden = new WC_Product(31);
		$hidden->status              = 'publish';
		$hidden->catalog_visibility  = 'hidden';
		$hidden->visible             = false;
		$hidden->name                = 'Gizli yayımlı bağış';
		WDP_Test_State::$products[31] = $hidden;

		$out = null;
		$this->assertTrue(WDP_Ajax::resolve_product_for_info(31, $out));
		$this->assertInstanceOf(WC_Product::class, $out);
		$this->assertSame(31, $out->get_id());
		$this->assertFalse(WDP_Security::validate_product_id(31));
	}

	public function test_draft_and_missing_do_not_resolve(): void {
		$draft = new WC_Product(32);
		$draft->status = 'draft';
		WDP_Test_State::$products[32] = $draft;

		$this->assertFalse(WDP_Ajax::resolve_product_for_info(32));
		$this->assertFalse(WDP_Ajax::resolve_product_for_info(0));
		$this->assertFalse(WDP_Ajax::resolve_product_for_info(9999));
	}

	public function test_missing_id_sends_json_error_400(): void {
		$this->primeAjax();
		$_POST['product_id'] = '0';

		try {
			WDP_Ajax::get_product_info();
			$this->fail('wp_send_json_error expected');
		} catch (WDP_Json_Sent $e) {
			$this->assertSame(400, $e->status);
			$this->assertFalse($e->payload['success']);
			$this->assertSame('Geçersiz ürün ID', $e->payload['data']['message']);
		}
	}

	public function test_published_product_info_success(): void {
		$this->primeAjax();
		$live = new WC_Product(41);
		$live->name  = 'Açık bağış';
		$live->price = '25';
		WDP_Test_State::$products[41] = $live;
		$_POST['product_id']          = '41';

		try {
			WDP_Ajax::get_product_info();
			$this->fail('json_success expected');
		} catch (WDP_Json_Sent $e) {
			$this->assertSame(200, $e->status);
			$this->assertTrue($e->payload['success']);
			$this->assertSame('Açık bağış', $e->payload['product_name']);
		}
	}

	private function primeAjax(): void {
		$_POST['security']    = 'test-nonce';
		$_REQUEST['security'] = 'test-nonce';
	}
}

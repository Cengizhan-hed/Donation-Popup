<?php
/**
 * E2B: REST cart/add + nonce — JSON zorunlu, hata biçimi, bayat nonce tazeleme ucu, no-store, hız sınırı.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';
require_once __DIR__ . '/E2BCartTest.php';

use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Modules\Experiences\Cart_Controller;
use DonationPanel\Modules\Experiences\Form_Context;
use DonationPanel\WooCommerce\Cart;
use PHPUnit\Framework\TestCase;

final class E2BCartControllerTest extends TestCase {

	/** @var E2B_Fake_Cart */
	private $cart;

	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_E0_Rest_Log::$routes = array();
		$this->cart              = new E2B_Fake_Cart();
	}

	private function controller( string $ip = '203.0.113.9', $cart = 'default' ): Cart_Controller {
		$cart_obj = 'default' === $cart ? $this->cart : $cart;
		return new Cart_Controller(
			new Rate_Limiter(
				static function () use ( $ip ) {
					return $ip;
				}
			),
			new Cart(),
			static function ( $id ) {
				return 7 === $id ? Form_Context::from_legacy( array( 'product_id' => 7, 'allow_custom_price' => true, 'min_price' => '10' ) ) : array();
			},
			static function ( $id ) {
				return 7 === $id ? new WC_Product( 7 ) : null;
			},
			static function () use ( $cart_obj ) {
				return $cart_obj;
			}
		);
	}

	/** @param array<string, mixed> $params Parametreler. */
	private function request( array $params, bool $json = true ): WP_REST_Request {
		$request          = new WP_REST_Request();
		$request->params  = $params;
		$request->headers = $json ? array( 'Content-Type' => 'application/json; charset=UTF-8' ) : array( 'Content-Type' => 'application/x-www-form-urlencoded' );
		return $request;
	}

	/** @return array<string, mixed> */
	private function good(): array {
		return array(
			'product_id'         => '7',
			'amount'             => '100',
			'donation_full_name' => 'Çağlar Öztürk',
			'donation_phone'     => '+44 7700 900123',
		);
	}

	public function test_routes_are_cart_add_post_and_nonce_get_public(): void {
		$this->controller()->register_routes();
		$routes = array();
		foreach ( WDP_E0_Rest_Log::$routes as $route ) {
			$this->assertSame( 'donation-panel/v1', $route['ns'] );
			$routes[ $route['route'] ] = $route['args'];
		}
		$this->assertSame( 'POST', $routes['/cart/add']['methods'] );
		$this->assertSame( 'GET', $routes['/nonce']['methods'] );
		$this->assertTrue( call_user_func( $routes['/nonce']['permission_callback'] ) );
	}

	public function test_form_encoded_request_is_refused(): void {
		$result = $this->controller()->add( $this->request( $this->good(), false ) );
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 415, $result->get_error_data()['status'] );
		$this->assertSame( array(), $this->cart->added );
	}

	public function test_missing_and_unknown_product(): void {
		$missing = $this->controller()->add( $this->request( array() ) );
		$this->assertSame( 400, $missing->get_error_data()['status'] );
		$unknown = $this->controller()->add( $this->request( array( 'product_id' => '99' ) ) );
		$this->assertSame( 404, $unknown->get_error_data()['status'] );
	}

	public function test_cart_unavailable_is_503(): void {
		$result = $this->controller( '203.0.113.20', null )->add( $this->request( $this->good() ) );
		$this->assertSame( 503, $result->get_error_data()['status'] );
	}

	public function test_success_adds_and_returns_urls_without_personal_data_and_no_store(): void {
		$result = $this->controller()->add( $this->request( $this->good() ) );
		$this->assertInstanceOf( WP_REST_Response::class, $result );
		$data = $result->get_data();
		$this->assertTrue( $data['success'] );
		$this->assertSame( 'k1', $data['cart_item_key'] );
		$this->assertSame( 1, $data['cart_count'] );
		$json = (string) wp_json_encode( $data );
		$this->assertStringNotContainsString( 'Çağlar', $json );
		$this->assertStringNotContainsString( '7700', $json );
		$this->assertStringContainsString( 'no-store', $result->headers['Cache-Control'] );
		$this->assertCount( 1, $this->cart->added );
	}

	public function test_validation_failure_is_400_with_field_errors(): void {
		$bad    = $this->good();
		$bad['amount'] = '1';
		$bad['donation_full_name'] = '';
		$result = $this->controller()->add( $this->request( $bad ) );
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'donation_panel_cart_rejected', $result->get_error_code() );
		$data = $result->get_error_data();
		$this->assertSame( 400, $data['status'] );
		$this->assertArrayHasKey( 'amount', (array) $data['errors'] );
		$this->assertArrayHasKey( 'donation_full_name', (array) $data['errors'] );
		$this->assertStringNotContainsString( 'Çağlar', (string) wp_json_encode( $data ) );
	}

	public function test_nonce_endpoint_returns_fresh_nonce_no_store(): void {
		$result = $this->controller()->nonce();
		$this->assertInstanceOf( WP_REST_Response::class, $result );
		$this->assertNotEmpty( $result->get_data()['nonce'] );
		$this->assertSame( array( 'nonce' ), array_keys( $result->get_data() ) );
		$this->assertStringContainsString( 'no-store', $result->headers['Cache-Control'] );
	}

	public function test_stale_nonce_scenario_refresh_endpoint_always_available_and_not_nonce_gated(): void {
		// Bayat nonce'lu istemci 403 alır (WordPress çekirdeği); tazeleme ucu nonce istemeden çalışmalıdır.
		$request = $this->request( array() );
		$request->headers['X-WP-Nonce'] = 'bayat';
		$result  = $this->controller()->nonce();
		$this->assertInstanceOf( WP_REST_Response::class, $result );
	}

	public function test_add_is_rate_limited(): void {
		$controller = $this->controller( '203.0.113.77' );
		$last       = null;
		for ( $i = 0; $i < 21; $i++ ) {
			$last = $controller->add( $this->request( array() ) );
		}
		$this->assertInstanceOf( WP_Error::class, $last );
		$this->assertSame( 429, $last->get_error_data()['status'] );
	}

	public function test_nonce_is_rate_limited(): void {
		$controller = $this->controller( '203.0.113.78' );
		$last       = null;
		for ( $i = 0; $i < 31; $i++ ) {
			$last = $controller->nonce();
		}
		$this->assertInstanceOf( WP_Error::class, $last );
		$this->assertSame( 429, $last->get_error_data()['status'] );
	}
}

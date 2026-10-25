<?php
/**
 * E2A: REST donation-panel/v1 form + validate.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Frontend\Template_Loader;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Modules\Experiences\Form_Context;
use DonationPanel\Modules\Experiences\Form_Controller;
use DonationPanel\Modules\Experiences\Form_Renderer;
use PHPUnit\Framework\TestCase;

final class E2AFormControllerTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_E0_Rest_Log::$routes = array();
	}

	private function controller(): Form_Controller {
		$limiter  = new Rate_Limiter(
			static function () {
				return '203.0.113.7';
			}
		);
		$renderer = new Form_Renderer(
			new Template_Loader(
				WDP_PLUGIN_DIR,
				static function () {
					return array();
				}
			)
		);
		return new Form_Controller(
			$limiter,
			$renderer,
			static function ( $id ) {
				if ( 7 !== $id ) {
					return array();
				}
				return Form_Context::from_legacy(
					array(
						'product_id'            => 7,
						'product_name'          => 'Su Kuyusu',
						'allow_custom_price'    => true,
						'min_price'             => '10',
						'enable_amount_presets' => true,
						'amount_presets'        => '50 100',
						'currency_symbol'       => '₺',
					)
				);
			}
		);
	}

	/**
	 * @param array<string, mixed> $params  Parametreler.
	 * @param array<string, string> $headers Başlıklar.
	 */
	private function request( array $params, array $headers = array() ): WP_REST_Request {
		$request          = new WP_REST_Request();
		$request->params  = $params;
		$request->headers = $headers;
		return $request;
	}

	public function test_routes_registered_under_v1_public_readonly_form_and_nonce_post_validate(): void {
		$this->controller()->register_routes();
		$routes = array();
		foreach ( WDP_E0_Rest_Log::$routes as $route ) {
			$this->assertSame( 'donation-panel/v1', $route['ns'] );
			$routes[ $route['route'] ] = $route['args'];
		}
		$this->assertArrayHasKey( '/validate', $routes );
		$this->assertSame( 'POST', $routes['/validate']['methods'] );
		$form_route = array_values( array_filter( array_keys( $routes ), static function ( $r ) {
			return false !== strpos( $r, '/form' );
		} ) );
		$this->assertCount( 1, $form_route );
		$this->assertSame( 'GET', $routes[ $form_route[0] ]['methods'] );
		$this->assertTrue( call_user_func( $routes[ $form_route[0] ]['permission_callback'] ) );
	}

	public function test_form_without_id_returns_explicit_400_not_404(): void {
		$result = $this->controller()->get_form( $this->request( array() ) );
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'donation_panel_product_id_required', $result->get_error_code() );
		$this->assertSame( 400, $result->get_error_data()['status'] );
	}

	public function test_unknown_product_is_404(): void {
		$result = $this->controller()->get_form( $this->request( array( 'id' => '99' ) ) );
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 404, $result->get_error_data()['status'] );
	}

	public function test_form_payload_has_html_and_model_without_personal_data(): void {
		$result = $this->controller()->get_form( $this->request( array( 'id' => '7' ) ) );
		$this->assertInstanceOf( WP_REST_Response::class, $result );
		$data = $result->get_data();
		$this->assertSame( array( 'product_id', 'model', 'html' ), array_keys( $data ) );
		$this->assertStringContainsString( 'data-dp-form', $data['html'] );
		$this->assertStringNotContainsString( '203.0.113.7', (string) wp_json_encode( $data ) );
	}

	public function test_validate_requires_nonce(): void {
		$result = $this->controller()->validate( $this->request( array( 'product_id' => '7', 'amount' => '50' ) ) );
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 403, $result->get_error_data()['status'] );
	}

	public function test_validate_reports_errors_without_echoing_values(): void {
		$result = $this->controller()->validate(
			$this->request(
				array(
					'product_id'         => '7',
					'amount'             => '5',
					'donation_full_name' => '',
					'donation_email'     => 'gizli@example.org',
				),
				array( 'X-WP-Nonce' => 'abc' )
			)
		);
		$this->assertInstanceOf( WP_REST_Response::class, $result );
		$data = $result->get_data();
		$this->assertFalse( $data['valid'] );
		$this->assertArrayHasKey( 'amount', $data['errors'] );
		$this->assertArrayHasKey( 'donation_full_name', $data['errors'] );
		$this->assertStringNotContainsString( 'gizli@example.org', (string) wp_json_encode( $data ) );
	}

	public function test_validate_accepts_good_input(): void {
		$result = $this->controller()->validate(
			$this->request(
				array(
					'product_id'         => '7',
					'amount'             => '100',
					'donation_full_name' => 'Çağlar Öztürk',
					'donation_phone'     => '+44 7700 900123',
				),
				array( 'X-WP-Nonce' => 'abc' )
			)
		);
		$data = $result->get_data();
		$this->assertTrue( $data['valid'] );
		$this->assertSame( 100.0, $data['amount'] );
	}

	public function test_validate_is_rate_limited(): void {
		$controller = $this->controller();
		$request    = $this->request( array( 'product_id' => '7', 'amount' => '100', 'donation_full_name' => 'Ada' ), array( 'X-WP-Nonce' => 'abc' ) );
		for ( $i = 0; $i < 30; $i++ ) {
			$this->assertNotInstanceOf( WP_Error::class, $controller->validate( $request ) );
		}
		$blocked = $controller->validate( $request );
		$this->assertInstanceOf( WP_Error::class, $blocked );
		$this->assertSame( 429, $blocked->get_error_data()['status'] );
	}
}

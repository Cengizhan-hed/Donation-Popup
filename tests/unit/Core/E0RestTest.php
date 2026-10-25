<?php
/**
 * E0: REST tabanı (nonce, hız sınırı, hata biçimi) + donation-panel/v1/ping.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/support/e0-stubs.php';

use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Settings;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Http\Rest\Ping_Controller;
use DonationPanel\Http\Rest_Controller;
use PHPUnit\Framework\TestCase;

final class E0RestProbeController extends Rest_Controller {
	public function register_routes() {
	}

	public function nonce( $request ) {
		return $this->verify_nonce($request);
	}

	public function limit( $limit ) {
		return $this->throttle('probe', $limit);
	}

	public function fail() {
		return $this->error('donation_panel_x', 'Nope', 422, array( 'field' => 'amount' ));
	}
}

final class E0RestTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_E0_Rest_Log::$routes = array();
	}

	private function limiter(): Rate_Limiter {
		return new Rate_Limiter(static function () {
			return '203.0.113.9';
		});
	}

	private function registry(): Module_Registry {
		$registry = new Module_Registry(new Settings());
		$registry->add('alpha', 'Not\\Loaded\\Alpha', true);
		$registry->add('beta', 'Not\\Loaded\\Beta', false);
		return $registry;
	}

	public function test_ping_route_is_registered_public_under_v1(): void {
		(new Ping_Controller($this->limiter(), $this->registry()))->register_routes();
		$this->assertCount(1, WDP_E0_Rest_Log::$routes);
		$route = WDP_E0_Rest_Log::$routes[0];
		$this->assertSame('donation-panel/v1', $route['ns']);
		$this->assertSame('/ping', $route['route']);
		$this->assertSame('GET', $route['args']['methods']);
		$this->assertTrue(call_user_func($route['args']['permission_callback']));
	}

	public function test_ping_payload_has_only_version_and_modules(): void {
		$controller = new Ping_Controller($this->limiter(), $this->registry());
		$response   = $controller->handle();
		$this->assertInstanceOf(WP_REST_Response::class, $response);
		$data = $response->get_data();
		$this->assertSame(array( 'version', 'modules' ), array_keys($data));
		$this->assertSame(WDP_VERSION, $data['version']);
		$this->assertSame(
			array(
				array( 'slug' => 'alpha', 'enabled' => true ),
				array( 'slug' => 'beta', 'enabled' => false ),
			),
			$data['modules']
		);
		$json = (string) json_encode($data);
		$this->assertStringNotContainsString('@', $json);
		$this->assertStringNotContainsString('203.0.113.9', $json);
	}

	public function test_ping_is_rate_limited(): void {
		$controller = new Ping_Controller($this->limiter(), $this->registry());
		for ($i = 0; $i < 120; $i++) {
			$this->assertNotInstanceOf(WP_Error::class, $controller->handle());
		}
		$blocked = $controller->handle();
		$this->assertInstanceOf(WP_Error::class, $blocked);
		$this->assertSame('donation_panel_rate_limited', $blocked->get_error_code());
		$this->assertSame(429, $blocked->get_error_data()['status']);
	}

	public function test_rate_limiter_buckets_are_independent_per_client(): void {
		$a = new Rate_Limiter(static function () {
			return 'a';
		});
		$b = new Rate_Limiter(static function () {
			return 'b';
		});
		$this->assertTrue($a->hit('x', 1));
		$this->assertFalse($a->hit('x', 1));
		$this->assertTrue($b->hit('x', 1));
		$this->assertTrue($a->hit('y', 1));
	}

	public function test_nonce_header_or_param_accepted_and_missing_rejected(): void {
		$c = new E0RestProbeController($this->limiter());

		$request = new WP_REST_Request();
		$bad     = $c->nonce($request);
		$this->assertInstanceOf(WP_Error::class, $bad);
		$this->assertSame(403, $bad->get_error_data()['status']);

		$request->headers['X-WP-Nonce'] = 'abc123';
		$this->assertTrue($c->nonce($request));

		$request2                   = new WP_REST_Request();
		$request2->params['_wpnonce'] = 'abc123';
		$this->assertTrue($c->nonce($request2));
	}

	public function test_uniform_error_shape(): void {
		$error = (new E0RestProbeController($this->limiter()))->fail();
		$this->assertInstanceOf(WP_Error::class, $error);
		$this->assertSame('donation_panel_x', $error->get_error_code());
		$this->assertSame('Nope', $error->get_error_message());
		$this->assertSame(array( 'field' => 'amount', 'status' => 422 ), $error->get_error_data());
	}

	public function test_permission_for_uses_capability(): void {
		$c = new E0RestProbeController($this->limiter());
		$m = new ReflectionMethod($c, 'permission_for');
		$m->setAccessible(true);
		$callback = $m->invoke($c, 'manage_woocommerce');
		$this->assertFalse($callback());
		WDP_Test_State::$caps = array( 'manage_woocommerce' );
		$this->assertTrue($callback());
	}
}

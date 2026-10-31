<?php
/**
 * 12.4 email5: nonce yanıtı yalnız boolean `logged_in` taşır (kullanıcı verisi yok), önbelleğe alınmaz ve çereze göre değişir.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';
require_once __DIR__ . '/CartTest.php';

use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Modules\Experiences\Cart_Controller;
use DonationPanel\WooCommerce\Cart;
use PHPUnit\Framework\TestCase;

final class NonceSessionTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		$_SERVER = array();
	}

	protected function tearDown(): void {
		$_SERVER = array();
	}

	private function controller(): Cart_Controller {
		return new Cart_Controller(
			new Rate_Limiter(
				static function () {
					return '203.0.113.9';
				}
			),
			new Cart()
		);
	}

	public function test_guest_gets_logged_in_false_and_only_the_two_keys(): void {
		WDP_Test_State::$user_id = 0;
		$response                = $this->controller()->nonce( new WP_REST_Request() );

		$data = $response->get_data();
		$this->assertSame( array( 'logged_in', 'nonce' ), $this->sorted_keys( $data ) );
		$this->assertFalse( $data['logged_in'] );
	}

	public function test_logged_in_user_gets_true_without_any_user_data(): void {
		WDP_Test_State::$user_id = 7;
		$response                = $this->controller()->nonce( new WP_REST_Request() );

		$data = $response->get_data();
		$this->assertSame( array( 'logged_in', 'nonce' ), $this->sorted_keys( $data ) );
		$this->assertTrue( $data['logged_in'] );
		$this->assertIsBool( $data['logged_in'] );
		$this->assertStringNotContainsString( '@', (string) wp_json_encode( $data ) );
	}

	public function test_response_is_private_and_varies_by_cookie(): void {
		$response = $this->controller()->nonce( new WP_REST_Request() );

		$this->assertStringContainsString( 'no-store', $response->headers['Cache-Control'] );
		$this->assertSame( 'Cookie', $response->headers['Vary'] );
	}

	/**
	 * @param array<string, mixed> $data Veri.
	 * @return string[]
	 */
	private function sorted_keys( array $data ): array {
		$keys = array_keys( $data );
		sort( $keys );
		return $keys;
	}
}

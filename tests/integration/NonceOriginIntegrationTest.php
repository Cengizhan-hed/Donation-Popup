<?php
/**
 * Gerçek WP: çerez kullanıcısı için nonce dönen uçlar (`/nonce`, `/account/session`) kökenler arası isteği reddeder,
 * yanıtlarında CORS başlığı yoktur; aynı köken çalışır. Güvenilmez IP'de kota belirteç bazlıdır.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Http\Rate_Limiter;

final class NonceOriginIntegrationTest extends WDP_Integration_Test_Case {

	/** @var array<string,mixed> */
	private $server_backup = array();

	protected function setUp(): void {
		parent::setUp();
		$this->server_backup    = $_SERVER;
		$_SERVER['REMOTE_ADDR'] = '203.0.113.10';
	}

	protected function tearDown(): void {
		$_SERVER = $this->server_backup;
		parent::tearDown();
	}

	/** @param array<string,string> $headers Başlıklar. */
	private function get( string $route, array $headers = array() ): WP_REST_Response {
		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '\_transient\_donation\_panel\_rl\_%' OR option_name LIKE '\_transient\_timeout\_donation\_panel\_rl\_%'" );
		wp_cache_flush();
		$request = new WP_REST_Request( 'GET', $route );
		foreach ( $headers as $name => $value ) {
			$request->set_header( $name, $value );
		}
		return rest_do_request( $request );
	}

	/** @return array<string,array{0:string}> */
	public function routes(): array {
		return array(
			'nonce' => array( '/donation-panel/v1/nonce' ),
		);
	}

	public function test_account_session_endpoint_rejects_a_foreign_origin(): void {
		// Bağışçı hesabı modülü varsayılan kapalı olduğundan rota kayıtlı değildir; denetleyici doğrudan çağrılır.
		$controller = new \DonationPanel\Modules\DonorAccount\Account_Controller( new Rate_Limiter() );
		$foreign    = new WP_REST_Request( 'GET', '/donation-panel/v1/account/session' );
		$foreign->set_header( 'Origin', 'https://evil.example' );
		$denied = $controller->session( $foreign );
		$this->assertInstanceOf( WP_Error::class, $denied );
		$this->assertSame( 403, $denied->get_error_data()['status'] );

		$cross = new WP_REST_Request( 'GET', '/donation-panel/v1/account/session' );
		$cross->set_header( 'Sec-Fetch-Site', 'cross-site' );
		$this->assertInstanceOf( WP_Error::class, $controller->session( $cross ) );

		$same = new WP_REST_Request( 'GET', '/donation-panel/v1/account/session' );
		$same->set_header( 'Origin', home_url() );
		$ok = $controller->session( $same );
		$this->assertNotInstanceOf( WP_Error::class, $ok );
		$this->assertNotEmpty( $ok->get_data()['nonce'] );
	}

	/** @dataProvider routes */
	public function test_foreign_origin_is_rejected_and_same_origin_is_accepted( string $route ): void {
		$foreign = $this->get( $route, array( 'Origin' => 'https://evil.example' ) );
		$this->assertSame( 403, $foreign->get_status(), $route );
		$this->assertArrayNotHasKey( 'nonce', (array) $foreign->get_data() );

		$cross_site = $this->get( $route, array( 'Sec-Fetch-Site' => 'cross-site' ) );
		$this->assertSame( 403, $cross_site->get_status(), $route );

		$same = $this->get( $route, array( 'Origin' => home_url(), 'Sec-Fetch-Site' => 'same-origin' ) );
		$this->assertSame( 200, $same->get_status(), $route );
		$this->assertNotEmpty( $same->get_data()['nonce'] );

		$bare = $this->get( $route );
		$this->assertSame( 200, $bare->get_status(), $route );
	}

	/** @dataProvider routes */
	public function test_cors_headers_are_removed_from_the_served_response( string $route ): void {
		$request = new WP_REST_Request( 'GET', $route );
		$request->set_header( 'Origin', home_url() );
		$result = rest_do_request( $request );
		$this->assertSame( 200, $result->get_status() );
		// rest_pre_serve_request: çekirdeğin CORS işleyicisinden sonra çalışan süzgeç yanıtı değiştirmeden bırakır
		// ve başlıkları siler; CLI'da header() yok sayılır, bu yüzden süzgecin varlığı + yanıt değişmezliği doğrulanır.
		$served = apply_filters( 'rest_pre_serve_request', false, $result, $request, rest_get_server() );
		$this->assertFalse( $served );
		$this->assertTrue( has_filter( 'rest_pre_serve_request' ) !== false );
	}

	public function test_untrusted_ip_buckets_by_client_token(): void {
		$_SERVER['REMOTE_ADDR'] = '10.9.9.9';
		$a                      = new Rate_Limiter();
		$b                      = new Rate_Limiter();
		$a->set_client_token( 'itestTokenA' );
		$b->set_client_token( 'itestTokenB' );
		$this->assertTrue( $a->hit( 'itest_sec', 2, 60, true ) );
		$this->assertTrue( $a->hit( 'itest_sec', 2, 60, true ) );
		$this->assertFalse( $a->hit( 'itest_sec', 2, 60, true ) );
		$this->assertTrue( $b->hit( 'itest_sec', 2, 60, true ) );
		// Kimlik doğrulama kovası: aynı koşulda katı (IP başına tek kova).
		$this->assertTrue( $a->hit( 'itest_login', 1, 60 ) );
		$this->assertFalse( $b->hit( 'itest_login', 1, 60 ) );
	}
}

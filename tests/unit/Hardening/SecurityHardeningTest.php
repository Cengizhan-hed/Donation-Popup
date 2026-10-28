<?php
/**
 * 12.1 güvenlik sertleştirmesi: nonce uçlarında kökenler arası ret, güvenilmez IP'de belirteç bazlı kova, IPv6 /64,
 * ön yüz kapısı (REST yolu başta + cart/add kapalı), CORS başlıklarının kaldırılması için rota kaydı.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';
require_once dirname( __DIR__ ) . '/Experiences/CartTest.php';

use DonationPanel\Core\Settings;
use DonationPanel\Frontend\Front_Gate;
use DonationPanel\Http\Client_Ip;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Modules\Experiences\Cart_Controller;
use DonationPanel\WooCommerce\Cart;
use PHPUnit\Framework\TestCase;

final class SecurityHardeningTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_E0_Rest_Log::$routes = array();
		$_SERVER                 = array();
	}

	protected function tearDown(): void {
		$_SERVER = array();
	}

	private function nonce_controller(): Cart_Controller {
		return new Cart_Controller(
			new Rate_Limiter(
				static function () {
					return '203.0.113.9';
				}
			),
			new Cart()
		);
	}

	/** @param array<string, string> $headers Başlıklar. */
	private function request( array $headers ): WP_REST_Request {
		$request          = new WP_REST_Request();
		$request->headers = $headers;
		return $request;
	}

	public function test_nonce_endpoint_rejects_a_foreign_origin_and_accepts_the_same_origin(): void {
		$controller = $this->nonce_controller();

		$foreign = $controller->nonce( $this->request( array( 'Origin' => 'https://evil.example' ) ) );
		$this->assertInstanceOf( WP_Error::class, $foreign );
		$this->assertSame( 403, $foreign->get_error_data()['status'] );

		$same = $controller->nonce( $this->request( array( 'Origin' => 'https://example.test' ) ) );
		$this->assertNotInstanceOf( WP_Error::class, $same );

		$no_header = $controller->nonce( $this->request( array() ) );
		$this->assertNotInstanceOf( WP_Error::class, $no_header );
	}

	public function test_nonce_endpoint_rejects_cross_site_fetch_metadata_even_without_origin(): void {
		$cross = $this->nonce_controller()->nonce( $this->request( array( 'Sec-Fetch-Site' => 'cross-site' ) ) );
		$this->assertInstanceOf( WP_Error::class, $cross );
		$this->assertSame( 403, $cross->get_error_data()['status'] );

		$same = $this->nonce_controller()->nonce( $this->request( array( 'Sec-Fetch-Site' => 'same-origin' ) ) );
		$this->assertNotInstanceOf( WP_Error::class, $same );
	}

	public function test_origin_null_and_foreign_host_are_rejected(): void {
		foreach ( array( 'null', 'https://example.test.evil.example', 'https://evil.example:443', 'http://sub.example.test' ) as $origin ) {
			$result = $this->nonce_controller()->nonce( $this->request( array( 'Origin' => $origin ) ) );
			$this->assertInstanceOf( WP_Error::class, $result, $origin );
		}
	}

	public function test_origin_scheme_and_port_differences_are_accepted_behind_a_ssl_terminating_proxy(): void {
		foreach ( array( 'http://example.test', 'https://example.test:8443', 'https://EXAMPLE.test' ) as $origin ) {
			$result = $this->nonce_controller()->nonce( $this->request( array( 'Origin' => $origin ) ) );
			$this->assertNotInstanceOf( WP_Error::class, $result, $origin );
		}
	}

	public function test_nonce_route_registration_adds_a_cors_stripping_filter(): void {
		$this->nonce_controller()->register_routes();
		$this->assertArrayHasKey( 'rest_pre_serve_request', WDP_Test_State::$filters );
	}

	public function test_untrusted_ip_uses_per_token_buckets_and_one_token_cannot_block_another(): void {
		$_SERVER['REMOTE_ADDR'] = '10.0.0.5'; // özel adres: güvenilmez, vekil ayarsız.
		$a                      = new Rate_Limiter();
		$b                      = new Rate_Limiter();
		$a->set_client_token( 'token-a' );
		$b->set_client_token( 'token-b' );

		for ( $i = 0; $i < 3; ++$i ) {
			$this->assertTrue( $a->hit( 'direct', 3, 60, true ) );
		}
		$this->assertFalse( $a->hit( 'direct', 3, 60, true ), 'Tek belirteç sınırı aşınca 429.' );
		$this->assertTrue( $b->hit( 'direct', 3, 60, true ), 'Başka belirteç etkilenmez.' );
	}

	public function test_auth_buckets_keep_the_strict_per_ip_behaviour_on_an_untrusted_ip(): void {
		$_SERVER['REMOTE_ADDR'] = '10.0.0.5';
		foreach ( array( 'account_login', 'account_register', 'account_reset' ) as $bucket ) {
			$limiter = new Rate_Limiter();
			$limiter->set_client_token( 'rotating-1' );
			for ( $i = 0; $i < 10; ++$i ) {
				$this->assertTrue( $limiter->hit( $bucket, 10 ), $bucket );
			}
			// Belirteç döndürmek ya da belirteçsiz gelmek 12.0'daki IP kovasını atlatmaz.
			$rotated = new Rate_Limiter();
			$rotated->set_client_token( 'rotating-2' );
			$this->assertFalse( $rotated->hit( $bucket, 10 ), $bucket . ': belirteç döndürme' );
			$this->assertFalse( ( new Rate_Limiter() )->hit( $bucket, 10 ), $bucket . ': belirteçsiz' );
		}
		// Aynı koşulda bağış kovası belirteç bazlıdır.
		$donor = new Rate_Limiter();
		$donor->set_client_token( 'donor-1' );
		$this->assertTrue( $donor->hit( 'direct', 10, 60, true ) );
	}

	public function test_untrusted_ip_without_token_is_only_subject_to_the_high_site_ceiling(): void {
		$_SERVER['REMOTE_ADDR'] = '10.0.0.5';
		$limiter                = new Rate_Limiter();
		for ( $i = 0; $i < 100; ++$i ) {
			$this->assertTrue( $limiter->hit( 'direct', 5, 60, true ), 'Belirteçsiz istek düşük sınırla kısıtlanmaz.' );
		}
		// Tavan = max(600, 5 x 20) = 600 (yeni sayaç: kalan 500).
		$denied = 0;
		for ( $i = 0; $i < 600; ++$i ) {
			if ( ! $limiter->hit( 'direct', 5, 60, true ) ) {
				++$denied;
			}
		}
		$this->assertGreaterThan( 0, $denied );
	}

	public function test_untrusted_ip_ceiling_also_stops_token_rotation(): void {
		$_SERVER['REMOTE_ADDR'] = '10.0.0.5';
		$allowed                = 0;
		for ( $i = 0; $i < 700; ++$i ) {
			$limiter = new Rate_Limiter();
			$limiter->set_client_token( 'rot-' . $i );
			if ( $limiter->hit( 'direct', 30, 60, true ) ) {
				++$allowed;
			}
		}
		$this->assertSame( 600, $allowed );
	}

	public function test_reliable_public_ip_keeps_the_per_ip_bucket(): void {
		$_SERVER['REMOTE_ADDR'] = '203.0.113.7';
		$limiter                = new Rate_Limiter();
		$limiter->set_client_token( 'ignored' );
		$this->assertTrue( $limiter->hit( 'direct', 2 ) );
		$this->assertTrue( $limiter->hit( 'direct', 2 ) );
		$this->assertFalse( $limiter->hit( 'direct', 2 ) );
	}

	public function test_set_client_token_strips_unsafe_characters_and_length(): void {
		$_SERVER['REMOTE_ADDR'] = '10.0.0.5';
		$a                      = new Rate_Limiter();
		$a->set_client_token( "tok<script>\n" );
		$b = new Rate_Limiter();
		$b->set_client_token( 'tokscript' );
		$this->assertTrue( $a->hit( 'x', 1, 60, true ) );
		$this->assertFalse( $b->hit( 'x', 1, 60, true ),'Temizlenmiş belirteç aynı kovayı paylaşır.' );
	}

	public function test_ipv6_is_normalised_to_its_64_prefix(): void {
		$_SERVER['REMOTE_ADDR'] = '2001:db8:1:2:aaaa:bbbb:cccc:dddd';
		$first                  = Client_Ip::key();
		$_SERVER['REMOTE_ADDR'] = '2001:db8:1:2:1111:2222:3333:4444';
		$this->assertSame( $first, Client_Ip::key() );
		$this->assertSame( '2001:db8:1:2::/64', $first );
		$_SERVER['REMOTE_ADDR'] = '2001:db8:1:3::1';
		$this->assertNotSame( $first, Client_Ip::key() );
		$_SERVER['REMOTE_ADDR'] = '203.0.113.7';
		$this->assertSame( '203.0.113.7', Client_Ip::key() );
	}

	public function test_ipv6_addresses_in_one_64_share_a_rate_limit_bucket(): void {
		$limiter                = new Rate_Limiter();
		$_SERVER['REMOTE_ADDR'] = '2606:4700:1:2:aaaa::1';
		$this->assertTrue( $limiter->hit( 'direct', 1 ) );
		$_SERVER['REMOTE_ADDR'] = '2606:4700:1:2:bbbb::2';
		$this->assertFalse( $limiter->hit( 'direct', 1 ) );
	}

	public function test_front_gate_rest_detection_is_anchored_at_the_path_start(): void {
		WDP_Test_State::$options[ Settings::OPTION_NAME ] = array( 'general' => array( 'disable_frontend' => true ) );

		$_SERVER['REQUEST_URI'] = '/wp-json/donation-panel/v1/direct';
		$this->assertFalse( Front_Gate::front_request_disabled(), 'Gerçek REST yolu kapıdan geçer.' );

		$_SERVER['REQUEST_URI'] = '/blog/wp-json/x';
		$this->assertTrue( Front_Gate::front_request_disabled(), 'Sayfa yolunun ortasındaki /wp-json/ kapıyı atlatmaz.' );

		$_SERVER['REQUEST_URI'] = '/some-page/?x=/wp-json/';
		$this->assertTrue( Front_Gate::front_request_disabled(), 'Sorgu dizesindeki /wp-json/ kapıyı atlatmaz.' );
	}

	public function test_cart_add_is_closed_with_503_when_the_front_gate_is_disabled(): void {
		WDP_Test_State::$options[ Settings::OPTION_NAME ] = array( 'general' => array( 'disable_frontend' => true ) );
		$request                                          = new WP_REST_Request();
		$request->headers                                 = array( 'Content-Type' => 'application/json' );
		$request->params                                  = array( 'product_id' => '7' );
		$result                                           = $this->nonce_controller()->add( $request );
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 503, $result->get_error_data()['status'] );
	}
}

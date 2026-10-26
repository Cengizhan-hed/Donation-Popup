<?php
/**
 * E8E: güvenlik denetimi düzeltmeleri — gizli/taslak ürün REST uçlarında görünmez, hedef başına hız sınırı,
 * route'larda permission_callback zorunlu, yetkisiz/nonce'suz/sınır aşımı yanıtları.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';
require_once dirname( __DIR__ ) . '/DonorAccount/E5DonorAccountTest.php';

use DonationPanel\Core\Settings;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Http\Rest_Controller;
use DonationPanel\Modules\Campaign\Progress_Controller;
use DonationPanel\Modules\DonorAccount\Account_Controller;
use DonationPanel\Modules\Experiences\Cart_Controller;
use DonationPanel\Modules\Experiences\Form_Controller;
use DonationPanel\Modules\Impact\Impact_Controller;
use DonationPanel\Modules\SocialProof\Donations_Controller;
use PHPUnit\Framework\TestCase;

final class E8ESecurityTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		E5Wp::reset();
	}

	private function limiter( string $ip = '203.0.113.9' ): Rate_Limiter {
		return new Rate_Limiter(
			static function () use ( $ip ) {
				return $ip;
			}
		);
	}

	private function product( int $id, string $status = 'publish', string $visibility = 'visible' ): WC_Product {
		$p                     = new WC_Product( $id );
		$p->status             = $status;
		$p->catalog_visibility = $visibility;
		WDP_Test_State::$products[ $id ] = $p;
		return $p;
	}

	/** @return array<string, array{0: string, 1: string}> */
	public function hidden_provider(): array {
		return array(
			'draft'   => array( 'draft', 'visible' ),
			'private' => array( 'private', 'visible' ),
			'pending' => array( 'pending', 'visible' ),
		);
	}

	/** @dataProvider hidden_provider */
	public function test_hidden_product_detected_for_visitor( string $status, string $visibility ): void {
		$this->product( 5, $status, $visibility );
		$this->assertTrue( Rest_Controller::is_hidden_product( 5 ) );
	}

	public function test_published_and_missing_products_are_not_hidden(): void {
		$this->product( 6 );
		$this->product( 7, 'publish', 'hidden' ); // Katalogda gizli ama yayında: bağış akışı çalışmalı.
		$this->assertFalse( Rest_Controller::is_hidden_product( 7 ) );
		$this->assertFalse( Rest_Controller::is_hidden_product( 6 ) );
		$this->assertFalse( Rest_Controller::is_hidden_product( 999 ) );
		$this->assertFalse( Rest_Controller::is_hidden_product( 0 ) );
	}

	public function test_editor_may_see_hidden_product(): void {
		$this->product( 5, 'draft' );
		WDP_Test_State::$caps = array( 'edit_post' );
		$this->assertFalse( Rest_Controller::is_hidden_product( 5 ) );
	}

	public function test_default_providers_refuse_hidden_product(): void {
		$this->product( 5, 'draft' );
		$this->product( 6 );
		$this->assertNull( Cart_Controller::product_for_id( 5 ) );
		$this->assertNotNull( Cart_Controller::product_for_id( 6 ) );
		$this->assertSame( array(), Form_Controller::model_for_id( 5 ) );
	}

	public function test_progress_impact_and_feed_return_404_for_hidden_product(): void {
		$this->product( 5, 'draft' );
		$request         = new WP_REST_Request();
		$request->params = array( 'id' => '5', 'product_id' => '5' );

		$progress = ( new Progress_Controller( $this->limiter() ) )->get_progress( $request );
		$this->assertInstanceOf( WP_Error::class, $progress );
		$this->assertSame( 404, $progress->data['status'] );

		$impact = ( new Impact_Controller( $this->limiter(), new Settings() ) )->get_impact( $request );
		$this->assertInstanceOf( WP_Error::class, $impact );
		$this->assertSame( 404, $impact->data['status'] );

		$feed = new Donations_Controller( $this->limiter() );
		foreach ( array( $feed->get_donations( $request ), $feed->get_stats( $request ) ) as $res ) {
			$this->assertInstanceOf( WP_Error::class, $res );
			$this->assertSame( 404, $res->data['status'] );
		}
	}

	public function test_reset_is_limited_per_email_across_clients_without_changing_response(): void {
		$sent = array();
		WDP_Test_State::$actions['woocommerce_reset_password_notification'][] = static function ( $login ) use ( &$sent ) {
			$sent[] = (string) $login;
		};
		E5Wp::$users['ayse@example.test'] = 7;

		$first = null;
		for ( $i = 1; $i <= 6; $i++ ) {
			$c       = new Account_Controller( $this->limiter( '198.51.100.' . $i ) ); // her istek başka IP.
			$request = new WP_REST_Request();
			$request->headers['X-WP-Nonce'] = 'abc123';
			$request->params                = array( 'email' => 'ayse@example.test' );
			$res                            = $c->reset( $request );
			$first                          = $first ?? $res->get_data();
			$this->assertSame( $first, $res->get_data(), 'Yanıt sınırdan etkilenmemeli.' );
		}
		$this->assertCount( 3, $sent, 'Aynı e-postaya pencerede en fazla 3 gönderim.' );
	}

	public function test_ip_limit_returns_429(): void {
		$c = new Account_Controller( $this->limiter() );
		$last = null;
		for ( $i = 0; $i < 8; $i++ ) {
			$request                        = new WP_REST_Request();
			$request->headers['X-WP-Nonce'] = 'abc123';
			$request->params                = array( 'email' => 'x' . $i . '@example.test' );
			$last                           = $c->reset( $request );
		}
		$this->assertInstanceOf( WP_Error::class, $last );
		$this->assertSame( 429, $last->data['status'] );
	}

	public function test_write_endpoints_without_nonce_are_403_and_member_routes_need_login(): void {
		$c = new Account_Controller( $this->limiter() );
		foreach ( array( 'login', 'register', 'reset', 'link_guest', 'link_guest_confirm', 'donations' ) as $method ) {
			$res = $c->$method( new WP_REST_Request() );
			$this->assertInstanceOf( WP_Error::class, $res, $method );
			$this->assertSame( 403, $res->data['status'], $method );
		}
		$this->assertFalse( $c->permission_member() );
	}

	public function test_cart_add_requires_json_content_type(): void {
		$c       = new Cart_Controller( $this->limiter(), new DonationPanel\WooCommerce\Cart() );
		$request = new WP_REST_Request();
		$request->headers['Content-Type'] = 'text/plain';
		$request->params                  = array( 'product_id' => '5' );
		$res                              = $c->add( $request );
		$this->assertInstanceOf( WP_Error::class, $res );
		$this->assertSame( 415, $res->data['status'] );
	}

	public function test_no_route_uses_return_true_and_every_route_declares_permission_callback(): void {
		$root  = dirname( __DIR__, 3 );
		$files = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $root . '/src', FilesystemIterator::SKIP_DOTS ) );
		foreach ( $files as $file ) {
			if ( 'php' !== $file->getExtension() ) {
				continue;
			}
			$code = (string) file_get_contents( $file->getPathname() );
			$this->assertStringNotContainsString( '__return_true', $code, $file->getPathname() );
			$calls = substr_count( $code, 'register_rest_route(' );
			if ( $calls > 0 ) {
				$this->assertGreaterThanOrEqual( $calls, substr_count( $code, "'permission_callback'" ) , $file->getPathname() );
			}
		}
		$legacy = (string) file_get_contents( $root . '/includes/class-admin-hooks.php' );
		$this->assertStringNotContainsString( 'wp_ajax_nopriv_wdp_save', $legacy );
	}

	public function test_admin_ajax_handlers_all_call_guard(): void {
		$root = dirname( __DIR__, 3 );
		$src  = (string) file_get_contents( $root . '/includes/class-woo-donation-popup-admin.php' );
		preg_match_all( '/public function ((?:save_[a-z_]+)|apply_style_preset|export_style_preset|import_style_preset)\(\)/', $src, $m, PREG_OFFSET_CAPTURE );
		$this->assertNotEmpty( $m[1] );
		foreach ( $m[1] as $i => $hit ) {
			$start = (int) $m[0][ $i ][1];
			$body  = substr( $src, $start, 400 );
			$this->assertStringContainsString( 'guard_admin_settings_ajax()', $body, $hit[0] );
		}
		$this->assertStringContainsString( "check_ajax_referer( 'wdp_admin_nonce', 'nonce' )", $src );
		$this->assertStringContainsString( "current_user_can( 'manage_woocommerce' )", $src );
	}
}

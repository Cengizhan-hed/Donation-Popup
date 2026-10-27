<?php
/**
 * #4/#5: bağış akışı önbellekli; istatistik/akış uçları yalnız var olan bağış ürününü sunar; sınırsız önbellek anahtarı yok.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Domain\Placement_Settings;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Modules\SocialProof\Donation_Feed;
use DonationPanel\Modules\SocialProof\Donations_Controller;
use PHPUnit\Framework\TestCase;

final class Fix45FeedGuardTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		Donation_Scope::flush();
		Placement_Settings::flush();
	}

	private function controller(): Donations_Controller {
		return new Donations_Controller( new Rate_Limiter( static function () {
			return '203.0.113.9';
		} ) );
	}

	private function request( array $params ): WP_REST_Request {
		$r         = new WP_REST_Request();
		$r->params = $params;
		return $r;
	}

	public function test_page_result_is_cached_and_served_from_cache(): void {
		$first = Donation_Feed::page( 0, 1, 5 );
		$keys  = array_filter( array_keys( WDP_Test_State::$transients ), static function ( $k ) {
			return 0 === strpos( (string) $k, 'dp_social_page_' );
		} );
		$this->assertCount( 1, $keys );

		$key                                = array_values( $keys )[0];
		WDP_Test_State::$transients[ $key ] = array( 'items' => array( array( 'name' => 'Cached' ) ), 'page' => 1, 'per_page' => 5, 'has_more' => false );
		$this->assertSame( 'Cached', Donation_Feed::page( 0, 1, 5 )['items'][0]['name'] );
		$this->assertSame( array(), $first['items'] );
	}

	public function test_page_number_is_clamped_so_cache_keys_stay_bounded(): void {
		Donation_Feed::page( 0, 99999, 5 );
		Donation_Feed::page( 0, 50, 5 );
		$keys = array_filter( array_keys( WDP_Test_State::$transients ), static function ( $k ) {
			return 0 === strpos( (string) $k, 'dp_social_page_' );
		} );
		$this->assertCount( 1, $keys );
	}

	public function test_stats_and_feed_404_for_missing_product_and_create_no_cache_row(): void {
		$res = $this->controller()->get_stats( $this->request( array( 'product_id' => '987654' ) ) );
		$this->assertInstanceOf( WP_Error::class, $res );
		$this->assertSame( 404, $res->data['status'] );
		$res = $this->controller()->get_donations( $this->request( array( 'product_id' => '987654' ) ) );
		$this->assertInstanceOf( WP_Error::class, $res );
		foreach ( array_keys( WDP_Test_State::$transients ) as $k ) {
			$this->assertStringStartsNotWith( 'dp_social_stats_987654', (string) $k );
		}
	}

	public function test_non_donation_product_is_404_and_donation_product_is_served(): void {
		WDP_Test_State::$options[ Placement_Settings::OPTION ] = array( 'donation_scope' => 'marked' );
		Placement_Settings::flush();
		WDP_Test_State::$products[40] = new WC_Product( 40 );
		$res                          = $this->controller()->get_stats( $this->request( array( 'product_id' => '40' ) ) );
		$this->assertInstanceOf( WP_Error::class, $res );
		$this->assertSame( 404, $res->data['status'] );

		WDP_Test_State::$post_meta[41][ Donation_Scope::META ] = 'yes';
		WDP_Test_State::$products[41]                          = new WC_Product( 41 );
		$ok = $this->controller()->get_stats( $this->request( array( 'product_id' => '41' ) ) );
		$this->assertNotInstanceOf( WP_Error::class, $ok );
	}

	public function test_site_wide_stats_without_product_id_still_work(): void {
		$ok = $this->controller()->get_stats( $this->request( array() ) );
		$this->assertNotInstanceOf( WP_Error::class, $ok );
	}
}

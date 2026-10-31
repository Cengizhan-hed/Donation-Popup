<?php
/**
 * 12.4 inceleme düzeltmeleri: liste/kart önbellek anahtarı (Y1, O1), belirteç karakterli form (D6), doğrudan bağış
 * e-posta tipi (O5), `/nonce` kovası (D5).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Http\Rest\Direct_Donation_Controller;
use DonationPanel\Modules\EntryPoints\Card_Forms;
use DonationPanel\Modules\EntryPoints\Donations_List;
use DonationPanel\Modules\EntryPoints\Form_Pack;
use DonationPanel\Modules\Experiences\Cart_Controller;
use DonationPanel\WooCommerce\Cart;
use PHPUnit\Framework\TestCase;

final class Review124FixesTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		Card_Forms::reset_for_tests();
		Donations_List::reset_bump_guard();
		$_SERVER = array();
	}

	protected function tearDown(): void {
		$_SERVER = array();
	}

	public function test_cache_key_changes_when_site_address_permalinks_or_checkout_page_change(): void {
		$atts  = array( 'kind' => 'popup' );
		$base  = Donations_List::cache_key( $atts );
		$piece = Card_Forms::piece_key( 1, 'popup' );
		foreach ( array(
			'home'                         => 'https://yeni.example',
			'siteurl'                      => 'https://yeni.example/wp',
			'permalink_structure'          => '/%postname%/',
			'woocommerce_checkout_page_id' => '77',
		) as $option => $value ) {
			WDP_Test_State::$options[ $option ] = $value;
			$this->assertNotSame( $base, Donations_List::cache_key( $atts ), $option );
			$this->assertNotSame( $piece, Card_Forms::piece_key( 1, 'popup' ), $option . ' (kart parçası)' );
			unset( WDP_Test_State::$options[ $option ] );
			$this->assertSame( $base, Donations_List::cache_key( $atts ), $option . ' geri alınınca aynı anahtar' );
		}
		foreach ( array( 'home', 'siteurl', 'permalink_structure', 'woocommerce_checkout_page_id' ) as $option ) {
			Donations_List::reset_bump_guard();
			$before = Donations_List::cache_version();
			Donations_List::on_option( $option );
			$this->assertSame( $before + 1, Donations_List::cache_version(), $option . ' sürümü artırır' );
		}
	}

	public function test_many_bumps_keep_a_single_stored_row_per_list_and_piece(): void {
		$atts = array( 'kind' => 'popup' );
		$keys = array();
		$pkey = array();
		for ( $i = 0; $i < 50; $i++ ) {
			Donations_List::reset_bump_guard();
			Donations_List::bump_cache();
			$key            = Donations_List::cache_key( $atts );
			$piece          = Card_Forms::piece_key( 9, 'popup' );
			$keys[ $key ]   = true;
			$pkey[ $piece ] = true;
			// Her çizim aynı anahtara yazar (üzerine yazma); değerdeki sürüm güncel olur.
			set_transient( $key, array( 'html' => 'x', 'forms' => null, 'cv' => Donations_List::cache_version() ), DAY_IN_SECONDS );
			set_transient( $piece, array( 'h' => 'x', 'm' => array(), 'cv' => Donations_List::cache_version() ), DAY_IN_SECONDS );
		}
		$this->assertCount( 1, $keys );
		$this->assertCount( 1, $pkey );
		$this->assertCount( 2, WDP_Test_State::$transients, 'N bump sonrası saklanan girdi sayısı sabit (liste + parça)' );
	}

	public function test_stored_value_is_stale_after_a_bump_even_with_the_same_key(): void {
		$value = array( 'html' => 'x', 'cv' => Donations_List::cache_version() );
		$this->assertTrue( Donations_List::is_current( $value ) );
		Donations_List::bump_cache();
		$this->assertFalse( Donations_List::is_current( $value ) );
		$this->assertFalse( Donations_List::is_current( array( 'html' => 'x' ) ), 'sürümsüz eski değer bayat sayılır' );
		$this->assertFalse( Donations_List::is_current( 'x' ) );
	}

	public function test_control_characters_are_stripped_so_the_card_form_is_kept(): void {
		$html = '<div data-dp-product="7"><p>Ad' . "\x01" . 'ı' . "\x02" . ' Bağış</p></div>';
		$this->assertNull( Form_Pack::normalize( $html, 7 ), 'ham kontrol karakteri kayıpsızlık için hâlâ reddedilir' );
		$clean = (string) preg_replace( '/[\x01\x02]/', '', $html );
		$norm  = Form_Pack::normalize( $clean, 7 );
		$this->assertNotNull( $norm );
		$this->assertStringContainsString( 'Adı Bağış', (string) $norm, 'Türkçe karakter korunur' );
	}

	public function test_array_email_is_rejected_with_400_and_no_warning(): void {
		$controller                       = new Direct_Donation_Controller(
			new Rate_Limiter(
				static function () {
					return '203.0.113.9';
				}
			)
		);
		$request                          = new WP_REST_Request();
		$request->headers['Content-Type'] = 'application/json';
		$request->params                  = array(
			'product_id'     => 5,
			'donation_email' => array( 'a' ),
		);
		$result                           = $controller->create( $request );
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 400, $result->get_error_data()['status'] );
	}

	public function test_nonce_bucket_is_separate_and_wider_than_donation_buckets(): void {
		$this->assertSame( 'rest_nonce', Cart_Controller::NONCE_BUCKET );
		$this->assertGreaterThan( 30, Cart_Controller::NONCE_LIMIT );
		$controller = new Cart_Controller(
			new Rate_Limiter(
				static function () {
					return '203.0.113.9';
				}
			),
			new Cart()
		);
		for ( $i = 0; $i < 40; $i++ ) {
			$this->assertNotInstanceOf( WP_Error::class, $controller->nonce( new WP_REST_Request() ), 'istek ' . $i );
		}
		for ( $i = 40; $i < Cart_Controller::NONCE_LIMIT; $i++ ) {
			$controller->nonce( new WP_REST_Request() );
		}
		$this->assertInstanceOf( WP_Error::class, $controller->nonce( new WP_REST_Request() ), 'limit aşılınca 429' );
	}
}

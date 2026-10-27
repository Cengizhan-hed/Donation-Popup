<?php
/**
 * #24: gizlilik aracı meta aramasını bilinen anahtarlara daraltır (indekssiz tam tablo taraması yok).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once __DIR__ . '/PrivacyToolsTest.php';

use DonationPanel\Privacy\Order_Privacy;
use DonationPanel\WooCommerce\Order_Meta_Keys;
use PHPUnit\Framework\TestCase;

final class Fix24PrivacyLookupNarrowingTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Privacy_Registry::reset();
		$GLOBALS['wpdb'] = new WDP_Privacy_Fake_Wpdb();
	}

	public function test_lookup_patterns_cover_fixed_legacy_and_shareholder_keys(): void {
		$email = Order_Meta_Keys::lookup_key_patterns( 'email' );
		$this->assertContains( 'wdp_donor_email', $email['exact'] );
		$this->assertContains( 'Bağışçı E-posta', $email['exact'] );
		$this->assertNotEmpty( array_filter( $email['like'], static function ( $p ) {
			return false !== strpos( $p, 'wdp' ) && false !== strpos( $p, 'email' ) && false !== strpos( $p, '%' );
		} ) );
		$this->assertContains( '%. Hissedar E-postası', $email['like'] );

		$phone = Order_Meta_Keys::lookup_key_patterns( 'phone' );
		$this->assertContains( 'wdp_donor_phone', $phone['exact'] );
		$this->assertContains( 'Bağışçı Telefonu', $phone['exact'] );
	}

	public function test_email_and_phone_lookups_filter_by_meta_key(): void {
		Order_Privacy::find_order_ids( 'ayse@example.com' );
		Order_Privacy::find_order_ids_by_phone( 'ayse@example.com', array( '+90 532 111 22 33' ) );
		$this->assertNotEmpty( $GLOBALS['wpdb']->sql );
		foreach ( $GLOBALS['wpdb']->sql as $sql ) {
			$this->assertStringContainsString( 'im.meta_key IN (%s, %s, %s)', $sql );
			$this->assertStringContainsString( 'im.meta_key LIKE %s', $sql );
			$this->assertStringContainsString( 'woocommerce_order_itemmeta', $sql );
		}
	}
}

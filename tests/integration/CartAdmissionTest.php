<?php
/**
 * Gerçek WP + WooCommerce: bağış hattı sepete yalnız bağış ürünüyle girer; tutar sınırı; ikinci bağış birincinin üstüne yazmaz.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Domain\Placement_Settings;

final class CartAdmissionTest extends WDP_Integration_Test_Case {

	private function scope_marked(): void {
		update_option( Placement_Settings::OPTION, array( 'donation_scope' => 'marked' ) );
		$this->option_names[] = Placement_Settings::OPTION;
		Placement_Settings::flush();
		Donation_Scope::flush();
	}

	private function donor( string $name, array $extra = array() ): array {
		return array_merge(
			array(
				'donation_full_name' => $name,
				'donation_phone'     => '+90 532 000 00 00',
			),
			$extra
		);
	}

	public function test_non_donation_product_cannot_enter_cart(): void {
		$this->scope_marked();
		$normal = $this->create_product( '25' );
		$res    = $this->rest_post( '/donation-panel/v1/cart/add', array( 'product_id' => $normal->get_id(), 'amount' => '25' ) + $this->donor( 'Ayşe Yılmaz' ) );
		$this->assertGreaterThanOrEqual( 400, $res->get_status(), wp_json_encode( $res->get_data() ) );
		$this->assertSame( 0, WC()->cart->get_cart_contents_count(), 'Bağış olmayan ürün sepete girmemeli.' );
	}

	public function test_marked_donation_product_enters_cart(): void {
		$this->scope_marked();
		$marked = $this->create_product( '', array( Donation_Scope::META => 'yes', '_allow_custom_price' => 'yes' ) );
		$res    = $this->rest_post( '/donation-panel/v1/cart/add', array( 'product_id' => $marked->get_id(), 'amount' => '75' ) + $this->donor( 'Ayşe Yılmaz' ) );
		$this->assertSame( 200, $res->get_status(), wp_json_encode( $res->get_data() ) );
		$this->assertSame( 1, WC()->cart->get_cart_contents_count() );
	}

	public function test_second_donation_does_not_overwrite_the_first(): void {
		$this->scope_marked();
		$marked = $this->create_product( '', array( Donation_Scope::META => 'yes', '_allow_custom_price' => 'yes' ) );
		$route  = '/donation-panel/v1/cart/add';

		$first = $this->rest_post( $route, array( 'product_id' => $marked->get_id(), 'amount' => '50' ) + $this->donor( 'Ayşe Yılmaz' ) );
		$this->assertSame( 200, $first->get_status(), wp_json_encode( $first->get_data() ) );
		// Aynı ad, başka telefon ve başka ad: ikisi de ayrı satır olmalı, birincisi silinmemeli (#11).
		$second = $this->rest_post( $route, array( 'product_id' => $marked->get_id(), 'amount' => '70' ) + $this->donor( 'Ayşe Yılmaz', array( 'donation_phone' => '+90 533 111 22 33' ) ) );
		$third  = $this->rest_post( $route, array( 'product_id' => $marked->get_id(), 'amount' => '90' ) + $this->donor( 'Mehmet Demir' ) );
		$this->assertSame( 200, $second->get_status(), wp_json_encode( $second->get_data() ) );
		$this->assertSame( 200, $third->get_status(), wp_json_encode( $third->get_data() ) );

		$prices = array();
		foreach ( WC()->cart->get_cart() as $line ) {
			$prices[] = (float) $line['custom_price'];
		}
		sort( $prices );
		$this->assertSame( array( 50.0, 70.0, 90.0 ), $prices, 'Her bağış kendi satırında kalmalı.' );
	}

	public function test_amount_above_the_limit_is_rejected_and_the_limit_is_filterable(): void {
		$this->scope_marked();
		$marked = $this->create_product( '', array( Donation_Scope::META => 'yes', '_allow_custom_price' => 'yes' ) );
		$route  = '/donation-panel/v1/cart/add';

		$too_big = $this->rest_post( $route, array( 'product_id' => $marked->get_id(), 'amount' => '99999999' ) + $this->donor( 'Ayşe Yılmaz' ) );
		$this->assertSame( 400, $too_big->get_status(), wp_json_encode( $too_big->get_data() ) );
		$this->assertSame( 0, WC()->cart->get_cart_contents_count() );

		$lower = static function () {
			return 100.0;
		};
		add_filter( 'donation_panel_max_amount', $lower );
		try {
			$over = $this->rest_post( $route, array( 'product_id' => $marked->get_id(), 'amount' => '150' ) + $this->donor( 'Ayşe Yılmaz' ) );
			$this->assertSame( 400, $over->get_status(), wp_json_encode( $over->get_data() ) );
			$ok = $this->rest_post( $route, array( 'product_id' => $marked->get_id(), 'amount' => '100' ) + $this->donor( 'Ayşe Yılmaz' ) );
			$this->assertSame( 200, $ok->get_status(), wp_json_encode( $ok->get_data() ) );
		} finally {
			remove_filter( 'donation_panel_max_amount', $lower );
		}
	}
}

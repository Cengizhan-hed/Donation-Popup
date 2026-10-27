<?php
/**
 * E4: yan sepet satır modeli + çıktı (kaçış, Türkçe karakter, boş durum, miktar kuralı) + modül kaydı.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Plugin;
use DonationPanel\Core\Settings;
use DonationPanel\Modules\SideCart\Side_Cart_Lines;
use DonationPanel\Modules\SideCart\Side_Cart_Renderer;
use DonationPanel\Modules\SideCart\Side_Cart_Suggestion;
use PHPUnit\Framework\TestCase;

if ( ! function_exists( '_n' ) ) {
	function _n( $single, $plural, $number, $domain = null ) { // phpcs:ignore
		unset( $domain );
		return 1 === (int) $number ? $single : $plural;
	}
}

final class SideCartTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_describe_reads_dedication_type_and_shareholder_names(): void {
		$d = Side_Cart_Lines::describe(
			array(
				'donation_panel_type' => 'Zakat',
				'donation_data'       => array(
					'dedication'   => 'Anneannem Şükriye için',
					'share_count'  => 2,
					'shareholders' => array(
						1 => array( 'name' => 'Çağlar Öztürk', 'phone' => '+90 532' ),
						2 => array( 'name' => '  ' ),
						3 => 'Ayşe Yılmaz',
					),
				),
			)
		);
		$this->assertSame( 'zakat', $d['type'] );
		$this->assertSame( 'Anneannem Şükriye için', $d['dedication'] );
		$this->assertSame( array( 'Çağlar Öztürk', 'Ayşe Yılmaz' ), $d['share_names'] );
		$this->assertSame( 2, $d['share_count'] );
		$this->assertTrue( $d['is_donation'] );
	}

	public function test_describe_non_donation_line(): void {
		$d = Side_Cart_Lines::describe( array( 'quantity' => 1 ) );
		$this->assertFalse( $d['is_donation'] );
		$this->assertSame( '', $d['dedication'] );
		$this->assertSame( array(), $d['share_names'] );
	}

	public function test_quantity_cannot_change_for_shares_or_sold_individually(): void {
		$plain  = Side_Cart_Lines::describe( array( 'custom_price' => 50.0, 'donation_data' => array() ) );
		$shares = Side_Cart_Lines::describe( array( 'donation_data' => array( 'share_count' => 3 ) ) );
		$this->assertTrue( Side_Cart_Lines::can_change_quantity( $plain, false ) );
		$this->assertFalse( Side_Cart_Lines::can_change_quantity( $plain, true ) );
		$this->assertFalse( Side_Cart_Lines::can_change_quantity( $shares, false ) );
	}

	public function test_body_empty_state_has_action_and_no_checkout_link(): void {
		$html = Side_Cart_Renderer::body( array(), '', 'https://example.test/checkout/' );
		$this->assertStringContainsString( 'dp-sc__empty', $html );
		$this->assertStringContainsString( 'data-dp-sc-close', $html );
		$this->assertStringNotContainsString( 'data-dp-sc-go', $html );
	}

	public function test_body_renders_lines_escapes_and_keeps_turkish(): void {
		$html = Side_Cart_Renderer::body(
			array(
				array(
					'key'          => 'abc123',
					'name'         => 'Su Kuyusu <b>x</b>',
					'quantity'     => 2,
					'type'         => 'sadaka',
					'dedication'   => 'İ <script>alert(1)</script> ğüşöç',
					'share_names'  => array( 'Çağlar', 'Ayşe' ),
					'unit_html'    => '50,00 TL',
					'total_html'   => '100,00 TL',
					'can_quantity' => true,
				),
			),
			'100,00 TL',
			'https://example.test/checkout/'
		);
		$this->assertStringNotContainsString( '<script>', $html );
		$this->assertStringNotContainsString( '<b>x</b>', $html );
		$this->assertStringContainsString( 'ğüşöç', $html );
		$this->assertStringContainsString( 'Çağlar, Ayşe', $html );
		$this->assertStringContainsString( 'data-dp-sc-key="abc123"', $html );
		$this->assertStringContainsString( 'data-dp-sc-qty="-1"', $html );
		$this->assertStringContainsString( 'href="https://example.test/checkout/"', $html );
		$this->assertStringContainsString( 'data-dp-sc-go', $html );
		$this->assertStringContainsString( 'dpx-btn--link" data-dp-sc-close', $html );
		$this->assertSame( '1 gift in your basket', Side_Cart_Renderer::count_text( 1 ) );
	}

	public function test_body_renders_suggestion_card_with_amount_buttons(): void {
		$suggestion = Side_Cart_Suggestion::sanitize(
			array(
				'product_id' => 42,
				'amounts'    => array( '50', 100, 'x', -5, 50, 200, 300 ),
				'title'      => '<b>Sadaka</b>',
				'hint'       => 'Küçük bir katkı',
			)
		);
		$this->assertSame( 42, $suggestion['product_id'] );
		$this->assertSame( array( 50.0, 100.0, 200.0 ), $suggestion['amounts'] );
		$this->assertSame( 'Sadaka', $suggestion['title'] );
		$line = array( 'key' => 'k', 'name' => 'Su', 'quantity' => 1, 'can_quantity' => false, 'total_html' => '10' );
		$html = Side_Cart_Renderer::body( array( $line ), '10', '/c', $suggestion );
		$this->assertStringContainsString( 'data-dp-sc-suggest', $html );
		$this->assertStringContainsString( 'data-product="42"', $html );
		$this->assertStringContainsString( 'data-amount="100"', $html );
		$this->assertStringContainsString( 'Küçük bir katkı', $html );
		$this->assertStringNotContainsString( 'data-dp-sc-suggest', Side_Cart_Renderer::body( array( $line ), '10', '/c' ) );
	}

	public function test_suggestion_without_product_or_amounts_is_empty(): void {
		$this->assertSame( array(), Side_Cart_Suggestion::sanitize( array( 'product_id' => 0, 'amounts' => array( 5 ) ) ) );
		$this->assertSame( array(), Side_Cart_Suggestion::sanitize( array( 'product_id' => 5, 'amounts' => array() ) ) );
		$this->assertSame( array(), Side_Cart_Suggestion::sanitize( 'x' ) );
	}

	public function test_drawer_head_holds_count_text(): void {
		$html = Side_Cart_Renderer::drawer( '<p>x</p>', array(), '3 gifts in your basket' );
		$this->assertStringContainsString( 'data-dp-sc-sub>3 gifts in your basket<', $html );
	}

	public function test_line_without_quantity_control_has_only_remove(): void {
		$html = Side_Cart_Renderer::body(
			array( array( 'key' => 'k', 'name' => 'Hisse', 'quantity' => 1, 'can_quantity' => false, 'total_html' => '10' ) ),
			'10',
			'/c'
		);
		$this->assertStringNotContainsString( 'data-dp-sc-qty', $html );
		$this->assertStringContainsString( 'data-dp-sc-remove', $html );
	}

	public function test_trigger_and_badge_hidden_when_empty(): void {
		$this->assertStringContainsString( ' hidden>0<', Side_Cart_Renderer::count_badge( 0 ) );
		$this->assertStringNotContainsString( 'hidden', Side_Cart_Renderer::count_badge( 3 ) );
		$trigger = Side_Cart_Renderer::trigger( 2, '' );
		$this->assertStringContainsString( 'aria-controls="' . Side_Cart_Renderer::DRAWER_ID . '"', $trigger );
		$this->assertStringContainsString( 'aria-haspopup="dialog"', $trigger );
	}

	public function test_drawer_is_dialog_with_data_attributes(): void {
		$html = Side_Cart_Renderer::drawer( '<p>x</p>', array( 'rest' => 'https://e.test/?a=1&b=2', 'store' => 'https://e.test/s/' ) );
		$this->assertStringContainsString( 'role="dialog"', $html );
		$this->assertStringContainsString( 'aria-modal="true"', $html );
		$this->assertStringContainsString( 'data-dp-sc-rest="', $html );
		$this->assertStringContainsString( 'data-dp-sc-body', $html );
	}

	public function test_module_registered_default_off(): void {
		$registry = new Module_Registry( new Settings() );
		Plugin::register_modules( $registry );
		$this->assertContains( 'side_cart', $registry->slugs() );
		$this->assertFalse( $registry->is_enabled( 'side_cart' ) );
	}
}

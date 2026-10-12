<?php
/**
 * Form body module order unit tests.
 *
 * @package WDP\Tests
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * @covers WDP_Form_Fields_Renderer
 * @covers WDP_Form_Modules
 */
final class FormBodyOrderTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options['wdp_button_settings'] = array();
	}

	public function test_body_module_ids_are_donor_first(): void {
		$this->assertSame(
			array( 'donor', 'dedication', 'amount', 'cover_fee' ),
			WDP_Form_Fields_Renderer::BODY_MODULE_IDS
		);
	}

	public function test_ordered_body_html_puts_donor_before_amount(): void {
		$html = WDP_Form_Fields_Renderer::render_ordered_body_modules(
			array(
				'donor_opts'  => array(
					'enable_email'      => false,
					'enable_dedication' => true,
					'enable_anonymous'  => false,
				),
				'amount_html' => '<div class="wdp-form-block wdp-form-block--amount"><input name="custom_price" /></div>',
				'context'     => array(),
			)
		);

		$donor_pos  = strpos( $html, 'name="donation_full_name"' );
		$amount_pos = strpos( $html, 'wdp-form-block--amount' );
		$ded_pos    = strpos( $html, 'name="donation_dedication"' );

		$this->assertNotFalse( $donor_pos );
		$this->assertNotFalse( $amount_pos );
		$this->assertNotFalse( $ded_pos );
		$this->assertLessThan( $ded_pos, $donor_pos, 'Donor fields must precede dedication' );
		$this->assertLessThan( $amount_pos, $ded_pos, 'Dedication must precede amount' );
	}

	public function test_form_modules_sanitize_order_keeps_allowed_ids(): void {
		$order = WDP_Form_Modules::sanitize_order( 'amount,donor,bogus,media' );
		$this->assertSame( 'amount', $order[0] );
		$this->assertSame( 'donor', $order[1] );
		$this->assertNotContains( 'bogus', $order );
		$this->assertContains( 'media', $order );
	}
}

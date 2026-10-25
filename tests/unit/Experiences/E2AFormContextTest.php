<?php
/**
 * E2A: form modeli (eski bağlamdan türetme, alan sözleşmesi).
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use DonationPanel\Modules\Experiences\Form_Context;
use PHPUnit\Framework\TestCase;

final class E2AFormContextTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	/**
	 * @return array<string, mixed>
	 */
	private function legacy( array $over = array() ): array {
		return array_merge(
			array(
				'product_id'                => 42,
				'product_name'              => 'Kurban Bağışı',
				'product_price'             => '',
				'allow_custom_price'        => true,
				'min_price'                 => '10',
				'enable_amount_presets'     => true,
				'amount_presets'            => '50, 100 250',
				'amount_preset_recommended' => '100',
				'enable_email'              => true,
				'enable_dedication'         => true,
				'enable_anonymous'          => true,
				'allow_multiple_shares'     => false,
				'currency_symbol'           => '₺',
			),
			$over
		);
	}

	public function test_maps_presets_recommended_and_title(): void {
		$model = Form_Context::from_legacy( $this->legacy() );
		$this->assertSame( 42, $model['product_id'] );
		$this->assertSame( 'Kurban Bağışı', $model['title'] );
		$this->assertSame( array( 50.0, 100.0, 250.0 ), $model['presets'] );
		$this->assertSame( 100.0, $model['recommended'] );
		$this->assertSame( 10.0, $model['min'] );
		$this->assertTrue( $model['allow_custom'] );
	}

	public function test_field_names_match_order_contract(): void {
		$model = Form_Context::from_legacy( $this->legacy() );
		$names = array_column( $model['fields'], 'name' );
		$this->assertSame(
			array( 'donation_full_name', 'donation_phone', 'donation_email', 'donation_dedication', 'donation_note', 'donation_anonymous' ),
			$names
		);
	}

	public function test_shares_product_has_no_email_dedication_anonymous(): void {
		$model = Form_Context::from_legacy( $this->legacy( array( 'allow_multiple_shares' => true ) ) );
		$names = array_column( $model['fields'], 'name' );
		$this->assertSame( array( 'donation_full_name', 'donation_phone', 'donation_note' ), $names );
	}

	public function test_fixed_price_product_has_single_preset_and_no_custom(): void {
		$model = Form_Context::from_legacy( $this->legacy( array( 'allow_custom_price' => false, 'product_price' => '75' ) ) );
		$this->assertSame( array( 75.0 ), $model['presets'] );
		$this->assertFalse( $model['allow_custom'] );
	}

	public function test_goal_closed_flag(): void {
		$model = Form_Context::from_legacy( $this->legacy( array( 'goal_closed' => true, 'goal_reached_message' => 'Hedefe ulaşıldı' ) ) );
		$this->assertTrue( $model['closed'] );
		$this->assertSame( 'Hedefe ulaşıldı', $model['closed_message'] );
	}

	public function test_preset_parser_caps_at_six_and_skips_invalid(): void {
		$this->assertSame( array( 1.0, 2.0, 3.0, 4.0, 5.0, 6.0 ), Form_Context::parse_presets( '1 2 3 4 5 6 7 8' ) );
		$this->assertSame( array( 10.0 ), Form_Context::parse_presets( 'x, 0, -5, 10' ) );
	}

	public function test_model_contains_no_personal_data_keys(): void {
		$json = (string) wp_json_encode( Form_Context::from_legacy( $this->legacy() ) );
		$this->assertStringNotContainsString( '@', $json );
	}
}

<?php
/**
 * E2A: form modeli (eski bağlamdan türetme, alan sözleşmesi).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Modules\Experiences\Form_Context;
use PHPUnit\Framework\TestCase;

final class FormContextTest extends TestCase {

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

	public function test_phone_prefix_list_comes_from_phone_countries(): void {
		$model = Form_Context::from_legacy( $this->legacy() );
		$this->assertNotEmpty( $model['phone']['countries'] );
		$this->assertNotSame( '', $model['phone']['iso'] );
		$this->assertNotSame( '', $model['phone']['dial'] );
	}

	public function test_brand_and_accent_follow_admin_setting_only_when_custom(): void {
		$model = Form_Context::from_legacy( $this->legacy() );
		$this->assertSame( '', $model['brand'] );
		$this->assertSame( '', $model['accent'] );

		WDP_Test_State::$options['donation_panel_settings'] = array( 'design' => array( 'colors' => 'theme', 'brand' => '#112233', 'accent' => '#aabbcc' ) );
		$model = Form_Context::from_legacy( $this->legacy() );
		$this->assertSame( '', $model['brand'], 'tema renkleri seçiliyken özel renk yok sayılır' );

		WDP_Test_State::$options['donation_panel_settings'] = array( 'design' => array( 'colors' => 'custom', 'brand' => '#112233', 'accent' => 'javascript:x' ) );
		$model = Form_Context::from_legacy( $this->legacy() );
		$this->assertSame( '#112233', $model['brand'] );
		$this->assertSame( '', $model['accent'], 'geçersiz değer reddedilir' );
	}

	public function test_privacy_link_needs_setting_and_a_personal_data_field(): void {
		$this->assertSame( '', Form_Context::from_legacy( $this->legacy() )['privacy_url'], 'ayar kapalı' );

		WDP_Test_State::$options['wdp_button_settings'] = array(
			'enable_privacy_notice' => '1',
			'privacy_notice_url'    => 'https://example.test/gizlilik/',
		);
		$this->assertSame( 'https://example.test/gizlilik/', Form_Context::from_legacy( $this->legacy() )['privacy_url'] );
		$this->assertSame(
			'',
			Form_Context::from_legacy( $this->legacy( array( 'enable_email' => false, 'enable_dedication' => false ) ) )['privacy_url'],
			'e-posta/ithaf alanı yoksa bağlantı gösterilmez'
		);
	}

	public function test_field_names_match_order_contract(): void {
		$model = Form_Context::from_legacy( $this->legacy() );
		$names = array_column( $model['fields'], 'name' );
		$this->assertSame(
			array( 'donation_full_name', 'donation_phone', 'donation_email', 'donation_dedication', 'donation_note', 'donation_anonymous' ),
			$names
		);
	}

	public function test_shares_product_has_no_donor_fields_only_shareholder_rows(): void {
		$model = Form_Context::from_legacy( $this->legacy( array( 'allow_multiple_shares' => true ) ) );
		$this->assertSame( array(), array_column( $model['fields'], 'name' ) );
		$this->assertSame( array( 'name', 'phone', 'email', 'note' ), array_column( $model['shareholder'], 'key' ) );
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

<?php
/**
 * E2C: bağış türleri (sabit, serbest, hisseli, kampanya), adet/hisse, işlem ücreti, ek bağış, adımlar, sipariş türü metası.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Modules\Experiences\Field_Validator;
use DonationPanel\Modules\Experiences\Form_Context;
use DonationPanel\WooCommerce\Addon_Line;
use DonationPanel\WooCommerce\Cart;
use DonationPanel\WooCommerce\Cart_Data;
use DonationPanel\WooCommerce\Donation_Order_Meta;
use PHPUnit\Framework\TestCase;

/** Sahte WC_Cart. */
final class E2C_Fake_Cart {
	/** @var array<string, array<string, mixed>> */
	public $items = array();
	/** @var array<int, array<string, mixed>> */
	public $added = array();

	public function get_cart() {
		return $this->items;
	}

	public function remove_cart_item( $key ) {
		unset( $this->items[ $key ] );
		return true;
	}

	public function get_cart_contents_count() {
		return count( $this->items );
	}

	public function add_to_cart( $product_id, $quantity, $variation_id, $variation, $data ) {
		$key                 = 'k' . ( count( $this->items ) + 1 );
		$this->items[ $key ] = array_merge( array( 'product_id' => $product_id ), $data );
		$this->added[]       = array( 'product_id' => $product_id, 'quantity' => $quantity, 'data' => $data );
		return $key;
	}
}

/** Sahte sipariş kalemi. */
final class E2C_Fake_Order_Item {
	/** @var array<string, mixed> */
	public $meta = array();

	public function get_meta( $key, $single = true ) {
		return isset( $this->meta[ $key ] ) ? $this->meta[ $key ] : '';
	}

	public function add_meta_data( $key, $value ) {
		$this->meta[ $key ] = $value;
	}
}

final class E2CDonationTypesTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	/** @return array<string, mixed> */
	private function legacy( array $over = array() ): array {
		return array_merge(
			array(
				'product_id'            => 7,
				'product_name'          => 'Su Kuyusu',
				'product_price'         => '',
				'allow_custom_price'    => true,
				'min_price'             => '10',
				'enable_amount_presets' => true,
				'amount_presets'        => '50 100',
				'enable_email'          => true,
				'currency_symbol'       => '₺',
			),
			$over
		);
	}

	private function product(): object {
		return new WC_Product( 7 );
	}

	public function test_kind_follows_legacy_priority(): void {
		$this->assertSame( 'custom', Form_Context::from_legacy( $this->legacy() )['kind'] );
		$this->assertSame( 'fixed', Form_Context::from_legacy( $this->legacy( array( 'allow_custom_price' => false, 'product_price' => '75' ) ) )['kind'] );
		$this->assertSame( 'campaign', Form_Context::from_legacy( $this->legacy( array( 'enable_progress_bar' => true, 'progress_min_price' => '5' ) ) )['kind'] );
		$shares = Form_Context::from_legacy( $this->legacy( array( 'allow_multiple_shares' => true, 'enable_progress_bar' => true, 'product_price' => '1400', 'max_shares' => '7' ) ) );
		$this->assertSame( 'shares', $shares['kind'] );
		$this->assertFalse( $shares['allow_custom'] );
		$this->assertSame( 1400.0, $shares['unit_price'] );
		$this->assertSame( 7, $shares['quantity']['max'] );
	}

	public function test_campaign_uses_progress_minimum(): void {
		$model = Form_Context::from_legacy( $this->legacy( array( 'enable_progress_bar' => true, 'min_price' => '10', 'progress_min_price' => '0' ) ) );
		$this->assertSame( 0.0, $model['min'] );
	}

	public function test_quantity_rules(): void {
		$fixed = Form_Context::from_legacy( $this->legacy( array( 'allow_custom_price' => false, 'product_price' => '75' ) ) );
		$this->assertTrue( $fixed['quantity']['enabled'] );
		$off = Form_Context::from_legacy( $this->legacy( array( 'allow_custom_price' => false, 'product_price' => '75', 'enable_quantity' => false ) ) );
		$this->assertFalse( $off['quantity']['enabled'] );
		$custom = Form_Context::from_legacy( $this->legacy() );
		$this->assertFalse( $custom['quantity']['enabled'] );
		$many = Form_Context::from_legacy( $this->legacy( array( 'allow_multiple_shares' => true, 'max_shares' => '999', 'product_price' => '10' ) ) );
		$this->assertSame( 50, $many['quantity']['max'] );
	}

	public function test_fee_addon_and_default_steps(): void {
		$model = Form_Context::from_legacy(
			$this->legacy(
				array(
					'enable_cover_fee'       => true,
					'cover_fee_percent'      => 2.5,
					'enable_sadaka_donation' => true,
					'sadaka_wc_product_id'   => '55',
					'sadaka_toggle_label'    => 'Sadaka ekle',
					'sadaka_is_fixed_price'  => false,
					'sadaka_min_price'       => '20',
				)
			)
		);
		$this->assertSame( 2.5, $model['cover_fee'] );
		$this->assertSame( 'Sadaka ekle', $model['addon']['label'] );
		$this->assertSame( 20.0, $model['addon']['min'] );
		$this->assertSame( array( 'amount', 'details' ), array_column( $model['steps'], 'id' ) );

		$plain = Form_Context::from_legacy( $this->legacy() );
		$this->assertSame( 0.0, $plain['cover_fee'] );
		$this->assertNull( $plain['addon'] );
	}

	public function test_fixed_amount_is_server_computed_and_quantity_bounded(): void {
		$model = Form_Context::from_legacy( $this->legacy( array( 'allow_custom_price' => false, 'product_price' => '75' ) ) );
		$ok    = Field_Validator::validate( $model, array( 'amount' => '1', 'quantity' => '3', 'donation_full_name' => 'A B', 'donation_phone' => '5551234567' ) );
		$this->assertTrue( $ok['valid'] );
		$this->assertSame( 225.0, $ok['amount'] );
		$this->assertSame( 3, $ok['quantity'] );

		$bad = Field_Validator::validate( $model, array( 'quantity' => '500', 'donation_full_name' => 'A B', 'donation_phone' => '5551234567' ) );
		$this->assertArrayHasKey( 'quantity', $bad['errors'] );
	}

	public function test_shares_require_name_and_phone_for_every_share(): void {
		$model = Form_Context::from_legacy( $this->legacy( array( 'allow_multiple_shares' => true, 'product_price' => '1400', 'max_shares' => '3' ) ) );
		$res   = Field_Validator::validate(
			$model,
			array(
				'share_count'  => '2',
				'shareholders' => array(
					array( 'name' => 'Ayşe Yılmaz', 'phone' => '+90 555 111 22 33' ),
					array( 'name' => '', 'phone' => '' ),
				),
			)
		);
		$this->assertFalse( $res['valid'] );
		$this->assertSame( array( 'shareholder_2_name', 'shareholder_2_phone' ), array_keys( $res['errors'] ) );
		$this->assertSame( 2800.0, $res['amount'] );

		$over = Field_Validator::validate( $model, array( 'share_count' => '4', 'shareholders' => array() ) );
		$this->assertArrayHasKey( 'share_count', $over['errors'] );
	}

	public function test_addon_amount_rules(): void {
		$model = Form_Context::from_legacy( $this->legacy( array( 'enable_sadaka_donation' => true, 'sadaka_wc_product_id' => '55', 'sadaka_min_price' => '20' ) ) );
		$base  = array( 'amount' => '100', 'donation_full_name' => 'A B', 'donation_phone' => '5551234567', 'addon_active' => '1' );

		$low = Field_Validator::validate( $model, $base + array( 'addon_amount' => '5' ) );
		$this->assertArrayHasKey( 'addon_amount', $low['errors'] );
		$empty = Field_Validator::validate( $model, $base );
		$this->assertArrayHasKey( 'addon_amount', $empty['errors'] );
		$ok = Field_Validator::validate( $model, $base + array( 'addon_amount' => '25' ) );
		$this->assertTrue( $ok['valid'] );
		$this->assertSame( array( 'active' => true, 'amount' => 25.0 ), $ok['addon'] );
		$off = Field_Validator::validate( $model, array_diff_key( $base, array( 'addon_active' => 1 ) ) );
		$this->assertFalse( $off['addon']['active'] );
	}

	public function test_fixed_line_adds_quantity_and_kind(): void {
		$model = Form_Context::from_legacy( $this->legacy( array( 'allow_custom_price' => false, 'product_price' => '75' ) ) );
		$cart  = new E2C_Fake_Cart();
		$res   = ( new Cart() )->add_item( $cart, $this->product(), $model, array( 'quantity' => '3', 'donation_full_name' => 'Çağlar Öztürk', 'donation_phone' => '5551234567', 'submission_key' => 's1' ) );
		$this->assertTrue( $res['ok'], $res['message'] );
		$this->assertSame( 3, $cart->added[0]['quantity'] );
		$this->assertSame( 'fixed', $cart->added[0]['data']['donation_panel_kind'] );
		$this->assertArrayNotHasKey( 'custom_price', $cart->added[0]['data'] );
		$this->assertArrayNotHasKey( 'wdp_base_unit_price', $cart->added[0]['data'] );
	}

	public function test_shares_line_keeps_every_shareholder_field_with_turkish_characters(): void {
		$model = Form_Context::from_legacy( $this->legacy( array( 'allow_multiple_shares' => true, 'product_price' => '1400', 'max_shares' => '7' ) ) );
		$cart  = new E2C_Fake_Cart();
		$res   = ( new Cart() )->add_item(
			$cart,
			$this->product(),
			$model,
			array(
				'share_count'  => '2',
				'shareholders' => array(
					array( 'name' => 'Çağlar Şükrü İğdır', 'phone' => '+44 7700 900123', 'email' => 'a@ornek.org', 'note' => 'Ğüşiöç notu' ),
					array( 'name' => 'Öznur Ünal', 'phone' => '0555 000 00 00' ),
				),
				'submission_key' => 's2',
			)
		);
		$this->assertTrue( $res['ok'], $res['message'] . wp_json_encode( $res['errors'] ) );
		$this->assertSame( 2, $cart->added[0]['quantity'] );
		$data = $cart->added[0]['data']['donation_data'];
		$this->assertSame( 2, $data['share_count'] );
		$this->assertSame( 'Çağlar Şükrü İğdır', $data['shareholders'][1]['name'] );
		$this->assertSame( 'Ğüşiöç notu', $data['shareholders'][1]['note'] );
		$this->assertSame( 'Öznur Ünal', $data['shareholders'][2]['name'] );
		$this->assertSame( 'shares', $cart->added[0]['data']['donation_panel_kind'] );

		$item = new E2C_Fake_Order_Item();
		( new Donation_Order_Meta() )->write_item( $item, 'k1', $cart->items['k1'], null );
		$this->assertSame( 'shares', $item->meta[ Donation_Order_Meta::KEY_TYPE ] );
		$this->assertSame( 2, $item->meta['wdp_share_count'] );
		$this->assertSame( 'Çağlar Şükrü İğdır', $item->meta['wdp_shareholder_1_name'] );
		$this->assertSame( 'Öznur Ünal', $item->meta['wdp_shareholder_2_name'] );
	}

	public function test_cover_fee_is_applied_from_server_percent_and_client_percent_is_ignored(): void {
		$legacy = $this->legacy( array( 'enable_cover_fee' => true, 'cover_fee_percent' => 5 ) );
		$model  = Form_Context::from_legacy( $legacy );
		$cart   = new E2C_Fake_Cart();
		$res    = ( new Cart() )->add_item( $cart, $this->product(), $model, array( 'amount' => '100', 'donation_cover_fee' => '1', 'donation_cover_fee_percent' => '90', 'donation_full_name' => 'A B', 'donation_phone' => '5551234567' ) );
		$this->assertTrue( $res['ok'], $res['message'] );
		$data = $cart->added[0]['data'];
		$this->assertSame( 105.0, $data['custom_price'] );
		$this->assertSame( '1', $data['donation_data']['cover_fee'] );
		$this->assertSame( 5.0, $data['donation_data']['cover_fee_percent'] );

		$item = new E2C_Fake_Order_Item();
		( new Donation_Order_Meta() )->write_item( $item, 'k1', $cart->items['k1'], null );
		$this->assertSame( '5', (string) $item->meta['wdp_cover_fee'] );
		$this->assertSame( 'custom', $item->meta[ Donation_Order_Meta::KEY_TYPE ] );

		$off   = new E2C_Fake_Cart();
		( new Cart() )->add_item( $off, $this->product(), $model, array( 'amount' => '100', 'donation_full_name' => 'A B', 'donation_phone' => '5551234567' ) );
		$this->assertSame( 100.0, $off->added[0]['data']['custom_price'] );

		$fixed = Form_Context::from_legacy( $this->legacy( array( 'allow_custom_price' => false, 'product_price' => '40', 'enable_cover_fee' => true, 'cover_fee_percent' => 5 ) ) );
		$fx    = new E2C_Fake_Cart();
		( new Cart() )->add_item( $fx, $this->product(), $fixed, array( 'quantity' => '2', 'donation_cover_fee' => '1', 'donation_full_name' => 'A B', 'donation_phone' => '5551234567' ) );
		$this->assertSame( 42.0, $fx->added[0]['data']['wdp_base_unit_price'] );
		$this->assertSame( 2, $fx->added[0]['quantity'] );
	}

	public function test_addon_line_contract_matches_legacy(): void {
		$main = array( 'full_name' => 'Ayşe Yılmaz', 'phone' => '555', 'note' => 'Not', 'email' => 'x@y.org' );
		$this->assertSame( array( 'is_sadaka' => true, 'full_name' => 'Ayşe Yılmaz', 'phone' => '555', 'note' => 'Not' ), Addon_Line::donation_data( $main ) );

		$shares = array( 'share_count' => 2, 'shareholders' => array( 1 => array( 'name' => 'Öznur', 'phone' => '1' ), 2 => array( 'name' => 'B' ) ) );
		$this->assertSame( array( 'is_sadaka' => true, 'full_name' => 'Öznur', 'phone' => '1' ), Addon_Line::donation_data( $shares ) );

		$item = Addon_Line::cart_item_data( 7, 55, $main, 25.0, 'sub', 'parentkey' );
		$this->assertTrue( $item['wdp_sadaka_donation'] );
		$this->assertSame( 7, $item['wdp_parent_product_id'] );
		$this->assertSame( 'parentkey', $item['wdp_parent_cart_item_key'] );
		$this->assertSame( 'sub-sadaka', $item['unique_submission_key'] );
		$this->assertSame( 25.0, $item['custom_price'] );
		$this->assertTrue( $item['wdp_sadaka_linked_wc_product'] );
	}

	public function test_extra_step_hook_is_filtered_and_core_steps_are_protected(): void {
		add_filter(
			'donation_panel_form_steps',
			static function ( $steps ) {
				$steps[] = array( 'id' => 'tax', 'label' => 'Vergi' );
				return $steps;
			}
		);
		$model = Form_Context::from_legacy( $this->legacy() );
		$this->assertSame( array( 'amount', 'details', 'tax' ), array_column( $model['steps'], 'id' ) );
		WDP_Test_State::reset();
		add_filter(
			'donation_panel_form_steps',
			static function () {
				return array( array( 'id' => 'tax', 'label' => 'x' ) );
			}
		);
		$model = Form_Context::from_legacy( $this->legacy() );
		$this->assertSame( array( 'amount', 'details' ), array_column( $model['steps'], 'id' ) );
	}

	public function test_public_summary_exposes_kind_without_personal_data(): void {
		$summary = Cart_Data::public_summary( array( 'donation_panel_kind' => 'shares', 'donation_data' => array( 'share_count' => 1, 'shareholders' => array( 1 => array( 'name' => 'Gizli Ad' ) ) ) ) );
		$this->assertSame( 'shares', $summary['kind'] );
		$this->assertStringNotContainsString( 'Gizli', (string) wp_json_encode( $summary ) );
	}

	public function test_frequency_option_is_stored_only_when_the_model_defines_it(): void {
		$base = array( 'amount' => '100', 'donation_full_name' => 'A B', 'donation_phone' => '5551234567', 'donation_type' => 'monthly' );

		$plain = new E2C_Fake_Cart();
		( new Cart() )->add_item( $plain, $this->product(), Form_Context::from_legacy( $this->legacy() ), $base );
		$this->assertArrayNotHasKey( 'donation_panel_type', $plain->added[0]['data'] );

		add_filter(
			'donation_panel_frequency_options',
			static function () {
				return array(
					array( 'value' => 'once', 'label' => 'Tek seferlik' ),
					array( 'value' => 'monthly', 'label' => 'Aylık' ),
				);
			}
		);
		$model = Form_Context::from_legacy( $this->legacy() );
		$with  = new E2C_Fake_Cart();
		( new Cart() )->add_item( $with, $this->product(), $model, $base );
		$this->assertSame( 'monthly', $with->added[0]['data']['donation_panel_type'] );

		$item = new E2C_Fake_Order_Item();
		( new Donation_Order_Meta() )->write_item( $item, 'k1', $with->items['k1'], null );
		$this->assertSame( 'monthly', $item->meta[ Donation_Order_Meta::KEY_FREQUENCY ] );
	}
}

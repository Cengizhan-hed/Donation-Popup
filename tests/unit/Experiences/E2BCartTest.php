<?php
/**
 * E2B: sepet köprüsü (Cart, Cart_Data) — eski sepet öğesi sözleşmesi, doğrulama, Türkçe karakter, çift gönderim.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Modules\Experiences\Form_Context;
use DonationPanel\WooCommerce\Cart;
use DonationPanel\WooCommerce\Cart_Data;
use PHPUnit\Framework\TestCase;

/** Sahte WC_Cart. */
final class E2B_Fake_Cart {
	/** @var array<string, array<string, mixed>> */
	public $items = array();
	/** @var array<int, array<string, mixed>> */
	public $added = array();
	/** @var array<string, string> */
	public $post_during_add = array();
	/** @var bool */
	public $fail = false;

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
		$this->post_during_add = array(
			'action' => isset( $_POST['action'] ) ? (string) $_POST['action'] : '',
			'flow'   => isset( $_POST['wdp_ajax_flow'] ) ? (string) $_POST['wdp_ajax_flow'] : '',
		);
		if ( $this->fail ) {
			return false;
		}
		$key                 = 'k' . ( count( $this->items ) + 1 );
		$this->items[ $key ] = array_merge( array( 'product_id' => $product_id ), $data );
		$this->added[]       = array( 'product_id' => $product_id, 'quantity' => $quantity, 'data' => $data );
		return $key;
	}
}

final class E2BCartTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		unset( $_POST['action'], $_POST['wdp_ajax_flow'] );
	}

	/** @return array<string, mixed> */
	private function model( array $over = array() ): array {
		return array_merge(
			Form_Context::from_legacy(
				array(
					'product_id'            => 7,
					'product_name'          => 'Su Kuyusu',
					'allow_custom_price'    => true,
					'min_price'             => '10',
					'enable_amount_presets' => true,
					'amount_presets'        => '50 100',
					'enable_email'          => true,
					'enable_dedication'     => true,
					'enable_anonymous'      => true,
					'currency_symbol'       => '₺',
				)
			),
			$over
		);
	}

	private function product(): object {
		return new WC_Product( 7 );
	}

	/** @return array<string, mixed> */
	private function input( array $over = array() ): array {
		return array_merge(
			array(
				'amount'              => '100',
				'donation_full_name'  => 'Çağlar Şükrü Öztürk İğdır',
				'donation_phone'      => '+44 7700 900123',
				'donation_note'       => 'Ğüşiöç ĞÜŞİÖÇ notu',
				'submission_key'      => 'dp-7-1',
			),
			$over
		);
	}

	public function test_adds_line_with_legacy_cart_item_contract_and_turkish_characters(): void {
		$cart   = new E2B_Fake_Cart();
		$result = ( new Cart() )->add_item( $cart, $this->product(), $this->model(), $this->input() );

		$this->assertTrue( $result['ok'], $result['message'] . json_encode( $result['errors'] ) );
		$this->assertSame( 'k1', $result['cart_item_key'] );
		$this->assertCount( 1, $cart->added );
		$data = $cart->added[0]['data'];
		$this->assertSame( 100.0, $data['custom_price'] );
		$this->assertSame( 'Çağlar Şükrü Öztürk İğdır', $data['donation_data']['full_name'] );
		$this->assertSame( '+44 7700 900123', $data['donation_data']['phone'] );
		$this->assertSame( 'Ğüşiöç ĞÜŞİÖÇ notu', $data['donation_data']['note'] );
		$this->assertNotEmpty( $data['unique_key'] );
		$this->assertSame( 'dp-7-1', $data['unique_submission_key'] );
		$this->assertSame( 1, $cart->added[0]['quantity'] );
	}

	public function test_plugin_flow_flag_is_set_only_during_add_and_restored(): void {
		$cart = new E2B_Fake_Cart();
		( new Cart() )->add_item( $cart, $this->product(), $this->model(), $this->input() );
		$this->assertSame( 'wdp_ajax_add_to_cart', $cart->post_during_add['action'] );
		$this->assertSame( '1', $cart->post_during_add['flow'] );
		$this->assertArrayNotHasKey( 'action', $_POST );
		$this->assertArrayNotHasKey( 'wdp_ajax_flow', $_POST );

		$_POST['action'] = 'keep-me';
		( new Cart() )->add_item( new E2B_Fake_Cart(), $this->product(), $this->model(), $this->input() );
		$this->assertSame( 'keep-me', $_POST['action'] );
		unset( $_POST['action'] );
	}

	public function test_invalid_input_returns_field_errors_and_adds_nothing(): void {
		$cart   = new E2B_Fake_Cart();
		$result = ( new Cart() )->add_item( $cart, $this->product(), $this->model(), $this->input( array( 'amount' => '3', 'donation_full_name' => '' ) ) );
		$this->assertFalse( $result['ok'] );
		$this->assertSame( 400, $result['status'] );
		$this->assertArrayHasKey( 'amount', $result['errors'] );
		$this->assertArrayHasKey( 'donation_full_name', $result['errors'] );
		$this->assertSame( array(), $cart->added );
	}

	public function test_closed_campaign_is_rejected(): void {
		$cart   = new E2B_Fake_Cart();
		$result = ( new Cart() )->add_item( $cart, $this->product(), $this->model( array( 'closed' => true, 'closed_message' => 'Hedefe ulaşıldı' ) ), $this->input() );
		$this->assertFalse( $result['ok'] );
		$this->assertSame( 409, $result['status'] );
		$this->assertSame( 'Hedefe ulaşıldı', $result['message'] );
		$this->assertSame( array(), $cart->added );
	}

	public function test_same_submission_key_is_idempotent(): void {
		$cart   = new E2B_Fake_Cart();
		$bridge = new Cart();
		$first  = $bridge->add_item( $cart, $this->product(), $this->model(), $this->input() );
		$second = $bridge->add_item( $cart, $this->product(), $this->model(), $this->input() );
		$this->assertTrue( $second['ok'] );
		$this->assertSame( $first['cart_item_key'], $second['cart_item_key'] );
		$this->assertCount( 1, $cart->added );
	}

	public function test_same_donor_line_is_replaced_not_duplicated(): void {
		$cart   = new E2B_Fake_Cart();
		$bridge = new Cart();
		$bridge->add_item( $cart, $this->product(), $this->model(), $this->input() );
		$bridge->add_item( $cart, $this->product(), $this->model(), $this->input( array( 'amount' => '250', 'submission_key' => 'dp-7-2' ) ) );
		$this->assertCount( 1, $cart->items );
		$this->assertSame( 250.0, array_values( $cart->items )[0]['custom_price'] );
	}

	public function test_fixed_price_product_sends_no_custom_price(): void {
		$cart   = new E2B_Fake_Cart();
		$model  = $this->model( array( 'allow_custom' => false, 'min' => 0.0, 'presets' => array( 100.0 ) ) );
		$result = ( new Cart() )->add_item( $cart, $this->product(), $model, $this->input() );
		$this->assertTrue( $result['ok'] );
		$this->assertArrayNotHasKey( 'custom_price', $cart->added[0]['data'] );
	}

	public function test_cart_failure_reports_error(): void {
		$cart       = new E2B_Fake_Cart();
		$cart->fail = true;
		$result     = ( new Cart() )->add_item( $cart, $this->product(), $this->model(), $this->input() );
		$this->assertFalse( $result['ok'] );
		$this->assertSame( 400, $result['status'] );
	}

	public function test_closed_optional_fields_are_ignored(): void {
		$model = Form_Context::from_legacy( array( 'product_id' => 7, 'allow_custom_price' => true ) );
		$data  = Cart_Data::donation_data( $model, $this->input( array( 'donation_email' => 'a@b.co', 'donation_dedication' => 'x', 'donation_anonymous' => '1' ) ) );
		$this->assertArrayNotHasKey( 'email', $data );
		$this->assertArrayNotHasKey( 'dedication', $data );
		$this->assertArrayNotHasKey( 'anonymous', $data );
	}

	public function test_optional_fields_are_kept_when_open_and_anonymous_does_not_drop_data(): void {
		$data = Cart_Data::donation_data(
			$this->model(),
			$this->input( array( 'donation_email' => 'bagis@ornek.org', 'donation_dedication' => 'Annem Şükriye için', 'donation_anonymous' => '1' ) )
		);
		$this->assertSame( 'bagis@ornek.org', $data['email'] );
		$this->assertSame( 'Annem Şükriye için', $data['dedication'] );
		$this->assertSame( '1', $data['anonymous'] );
		$this->assertSame( 'Çağlar Şükrü Öztürk İğdır', $data['full_name'] );
		$this->assertSame( '+44 7700 900123', $data['phone'] );
	}

	public function test_multibyte_truncation_does_not_split_characters(): void {
		$long = str_repeat( 'Ş', 130 );
		$data = Cart_Data::donation_data( $this->model(), $this->input( array( 'donation_full_name' => $long ) ) );
		$this->assertSame( 100, mb_strlen( $data['full_name'], 'UTF-8' ) );
		$this->assertTrue( mb_check_encoding( $data['full_name'], 'UTF-8' ) );
	}

	public function test_public_summary_has_no_personal_data(): void {
		$item    = array(
			'custom_price'  => 100.0,
			'donation_data' => array( 'full_name' => 'Çağlar', 'phone' => '+44', 'email' => 'x@y.zz', 'dedication' => 'Anne', 'anonymous' => '1' ),
		);
		$summary = Cart_Data::public_summary( $item );
		$this->assertTrue( $summary['is_donation'] );
		$this->assertTrue( $summary['anonymous'] );
		$this->assertTrue( $summary['has_dedication'] );
		$json = (string) wp_json_encode( $summary );
		foreach ( array( 'Çağlar', '+44', 'x@y.zz', 'Anne' ) as $secret ) {
			$this->assertStringNotContainsString( $secret, $json );
		}
	}

	public function test_apply_update_changes_only_dedication_note_anonymous(): void {
		$current = array( 'full_name' => 'Çağlar', 'phone' => '+44', 'dedication' => 'Eski' );
		$updated = Cart_Data::apply_update( $current, array( 'dedication' => 'Yeni İthaf', 'anonymous' => '1', 'full_name' => 'Hack', 'phone' => '0' ) );
		$this->assertSame( 'Yeni İthaf', $updated['dedication'] );
		$this->assertSame( '1', $updated['anonymous'] );
		$this->assertSame( 'Çağlar', $updated['full_name'] );
		$this->assertSame( '+44', $updated['phone'] );
		$cleared = Cart_Data::apply_update( $updated, array( 'dedication' => '' ) );
		$this->assertArrayNotHasKey( 'dedication', $cleared );
	}

	public function test_store_api_registration_is_guarded_without_blocks(): void {
		( new Cart() )->register_store_api();
		$this->assertTrue( true ); // Store API işlevleri yoksa hata vermez.
	}
}

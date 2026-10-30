<?php
/**
 * Gerçek WP + WooCommerce: doğrudan (sepetsiz) bağış — sipariş üretimi, sepete dokunmama, idempotency, kilit,
 * ödeme yöntemi × durum, Woo tamamlama kancalarının tek sefer tetiklenmesi, yarım siparişin temizliği.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Settings;
use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Domain\Placement_Settings;
use DonationPanel\WooCommerce\Direct\Direct_Cleanup;
use DonationPanel\WooCommerce\Direct\Direct_Order_Factory;
use DonationPanel\WooCommerce\Direct\Direct_Settings;

/**
 * Test kart geçidi: kart verisi görmez; sonucu `mode` belirler (success | fail | redirect = 3DS benzeri dış yönlendirme).
 */
class WDP_Test_Card_Gateway extends WC_Payment_Gateway {

	/** @var string */
	public static $mode = 'success';

	public function __construct() {
		$this->id                 = 'wdp_test_card';
		$this->method_title       = 'WDP test card';
		$this->has_fields         = false;
		$this->enabled            = 'yes';
		$this->title              = 'Test card';
	}

	public function process_payment( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( 'fail' === self::$mode ) {
			$order->update_status( 'failed', 'Test card declined.' );
			return array( 'result' => 'failure' );
		}
		if ( 'redirect' === self::$mode ) {
			// Sipariş bekleyen kalır; geçit dış sayfaya yönlendirir, onay sonradan (dönüş/webhook) gelir.
			return array(
				'result'   => 'success',
				'redirect' => 'https://3ds.example.test/challenge',
			);
		}
		$order->payment_complete( 'txn_test_1' );
		return array(
			'result'   => 'success',
			'redirect' => $this->get_return_url( $order ),
		);
	}
}

final class DirectDonationTest extends WDP_Integration_Test_Case {

	/** @var array<string,int> */
	private $counts = array();

	/** @var array<int,array{0:string,1:callable}> */
	private $listeners = array();

	/** @var string Koşuya özgü anahtar öneki (önceki koşulardan kalan siparişlerle çakışmaz). */
	private $run = '';

	protected function setUp(): void {
		parent::setUp();
		$this->run = wp_generate_password( 8, false );
		update_option( Placement_Settings::OPTION, array( 'donation_scope' => 'marked' ) );
		$this->option_names[] = Placement_Settings::OPTION;
		Placement_Settings::flush();
		Donation_Scope::flush();
		WDP_Test_Card_Gateway::$mode = 'success';
		add_filter( 'woocommerce_payment_gateways', array( $this, 'add_test_gateway' ) );
		WC()->payment_gateways()->init();
		$this->counts = array();
		foreach ( array(
			'woocommerce_payment_complete',
			'woocommerce_order_status_pending',
			'woocommerce_order_status_processing',
			'woocommerce_order_status_completed',
			'woocommerce_order_status_on-hold',
			'woocommerce_order_status_failed',
			'woocommerce_order_status_cancelled',
			'woocommerce_thankyou',
			'woocommerce_new_order',
		) as $hook ) {
			$this->counts[ $hook ] = 0;
			$callback              = function () use ( $hook ) {
				++$this->counts[ $hook ];
			};
			add_action( $hook, $callback, 1 );
			$this->listeners[] = array( $hook, $callback );
		}
	}

	protected function tearDown(): void {
		remove_filter( 'woocommerce_payment_gateways', array( $this, 'add_test_gateway' ) );
		foreach ( $this->listeners as $listener ) {
			remove_action( $listener[0], $listener[1], 1 );
		}
		$this->listeners = array();
		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'donation_panel_dl\\_%'" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$settings = new Settings();
		$settings->update( array( 'direct' => array( 'enabled' => false ) ) );
		unset( $_GET['key'] );
		foreach ( wc_get_orders( array( 'limit' => -1, 'status' => 'any', 'return' => 'objects', 'meta_key' => Direct_Order_Factory::FLAG_META, 'meta_value' => 'yes' ) ) as $leftover ) { // phpcs:ignore WordPress.DB.SlowDBQuery
			$leftover->delete( true );
		}
		parent::tearDown();
	}

	/**
	 * @param array<string,string> $gateways Geçitler.
	 * @return array<string,string>
	 */
	public function add_test_gateway( $gateways ) {
		$gateways[] = 'WDP_Test_Card_Gateway';
		return $gateways;
	}

	private function direct_product( string $price = '', array $meta = array() ): WC_Product_Simple {
		$base = array(
			Donation_Scope::META         => 'yes',
			'_allow_custom_price'        => '' === $price ? 'yes' : 'no',
			Direct_Settings::META        => 'yes',
		);
		return $this->create_product( $price, array_merge( $base, $meta ) );
	}

	/**
	 * Doğrudan bağış isteği (hız sınırı sayaçları önce sıfırlanır; sınır testi hariç).
	 *
	 * @param array<string,mixed> $body Gövde.
	 */
	private function direct( array $body, bool $reset = true ): WP_REST_Response {
		if ( $reset ) {
			$this->reset_rate_limits();
		}
		if ( isset( $body['submission_key'] ) && '' !== $body['submission_key'] ) {
			$body['submission_key'] = $this->key( (string) $body['submission_key'] );
		}
		return $this->rest_post( '/donation-panel/v1/direct', $body );
	}

	/** @return array<string,mixed> */
	private function donor_body( int $product_id, string $amount, string $key, array $extra = array() ): array {
		return array_merge(
			array(
				'product_id'         => $product_id,
				'amount'             => $amount,
				'submission_key'     => $key,
				'donation_full_name' => 'Ayşe Yılmaz',
				'donation_phone'     => '+90 532 000 00 00',
			),
			$extra
		);
	}

	private function order_from( WP_REST_Response $res ): WC_Order {
		$data = $res->get_data();
		$this->assertSame( 200, $res->get_status(), wp_json_encode( $data ) );
		$this->assertTrue( $data['success'] );
		$url = (string) $data['redirect_url'];
		$this->assertSame( 1, preg_match( '#order-pay/(\d+)/#', $url . '/', $m ) ?: preg_match( '#[?&]order-pay=(\d+)#', $url, $m ), $url );
		$order = wc_get_order( (int) $m[1] );
		$this->assertInstanceOf( WC_Order::class, $order );
		$this->order_ids[] = $order->get_id();
		return $order;
	}

	private function key( string $key ): string {
		return $this->run . '-' . $key;
	}

	/** @return int Anahtarla eşleşen toplam sipariş sayısı (durum fark etmez). */
	private function orders_for_key( string $key ): int {
		$orders = wc_get_orders(
			array(
				'limit'      => -1,
				'status'     => 'any',
				'return'     => 'ids',
				'meta_query' => array(
					array(
						'key'   => Direct_Order_Factory::KEY_META,
						'value' => md5( 'donation_panel_direct|' . $this->key( $key ) ),
					),
				),
			)
		);
		return count( $orders );
	}

	public function test_creates_pending_order_without_touching_the_cart(): void {
		$product = $this->direct_product();
		$other   = $this->create_product( '10' );
		WC()->cart->add_to_cart( $other->get_id(), 2 );
		$before = WC()->cart->get_cart_contents_count();
		$hash   = WC()->cart->get_cart_hash();

		$res   = $this->direct( $this->donor_body( $product->get_id(), '75', 'k-create-1' ) + array( 'donation_dedication' => 'Anneme' ) );
		$order = $this->order_from( $res );

		$this->assertSame( 'pending', $order->get_status() );
		$this->assertSame( 75.0, (float) $order->get_total() );
		$this->assertSame( 'yes', $order->get_meta( Direct_Order_Factory::FLAG_META ) );
		$this->assertSame( 'donation_panel_direct', $order->get_created_via() );
		$this->assertSame( 'Ayşe', $order->get_billing_first_name() );
		$this->assertSame( 'Yılmaz', $order->get_billing_last_name() );
		$this->assertSame( '+90 532 000 00 00', $order->get_billing_phone() );
		$items = array_values( $order->get_items() );
		$this->assertCount( 1, $items );
		$this->assertSame( $product->get_id(), $items[0]->get_product_id() );
		$this->assertSame( 75.0, (float) $items[0]->get_meta( '_custom_price' ) );
		$this->assertSame( 'custom', $items[0]->get_meta( 'wdp_donation_type' ) );
		$this->assertStringContainsString( 'order-pay', $res->get_data()['redirect_url'] );
		$this->assertStringContainsString( 'key=' . $order->get_order_key(), $res->get_data()['redirect_url'] );
		$this->assertTrue( $order->needs_payment() );

		$this->assertSame( $before, WC()->cart->get_cart_contents_count(), 'Mevcut sepet etkilenmemeli.' );
		$this->assertSame( $hash, WC()->cart->get_cart_hash(), 'Sepet içeriği değişmemeli.' );
		$this->assertSame( 1, $this->counts['woocommerce_new_order'] );
		$this->assertSame( 0, $this->counts['woocommerce_payment_complete'], 'Ödeme tamamlanmadan tamamlama kancası tetiklenmemeli.' );
	}

	public function test_dedication_and_turkish_fields_reach_the_order_intact(): void {
		$product = $this->direct_product( '', array( '_enable_dedication' => 'yes' ) );
		$res     = $this->direct( $this->donor_body( $product->get_id(), '40', 'k-fields', array( 'donation_dedication' => 'Şükrü Ağa adına', 'donation_note' => 'Çok güzel bir iş: ığüşöç' ) ) );
		$order   = $this->order_from( $res );
		$meta    = array();
		foreach ( array_values( $order->get_items() )[0]->get_meta_data() as $row ) {
			$meta[ $row->key ] = $row->value;
		}
		$joined = wp_json_encode( $meta, JSON_UNESCAPED_UNICODE );
		$this->assertStringContainsString( 'Şükrü Ağa adına', (string) $joined );
		$this->assertStringContainsString( 'ığüşöç', (string) $joined );
		$this->assertStringContainsString( 'Ayşe Yılmaz', (string) $joined );
	}

	public function test_idempotent_same_key_returns_same_order(): void {
		$product = $this->direct_product();
		$tok     = array( 'client_token' => 'idemTok' );
		$first   = $this->order_from( $this->direct( $this->donor_body( $product->get_id(), '50', 'k-idem', $tok ) ) );
		$res2    = $this->direct( $this->donor_body( $product->get_id(), '50', 'k-idem', $tok ) );
		$second  = $this->order_from( $res2 );
		$res3    = $this->direct( $this->donor_body( $product->get_id(), '50', 'k-idem', $tok ) );
		$third   = $this->order_from( $res3 );

		$this->assertSame( $first->get_id(), $second->get_id() );
		$this->assertSame( $first->get_id(), $third->get_id() );
		$this->assertTrue( $res2->get_data()['reused'] );
		$this->assertSame( 1, $this->orders_for_key( 'k-idem' ), 'Aynı anahtar tek sipariş üretmeli.' );
		$this->assertSame( 1, $this->counts['woocommerce_new_order'] );
	}

	public function test_same_key_with_other_content_is_rejected_and_new_key_creates_new_order(): void {
		$product = $this->direct_product();
		$first   = $this->order_from( $this->direct( $this->donor_body( $product->get_id(), '50', 'k-fp' ) ) );
		$clash   = $this->direct( $this->donor_body( $product->get_id(), '60', 'k-fp' ) );
		$this->assertSame( 422, $clash->get_status() );
		$this->assertSame( 1, $this->orders_for_key( 'k-fp' ) );
		$other = $this->order_from( $this->direct( $this->donor_body( $product->get_id(), '60', 'k-fp-2' ) ) );
		$this->assertNotSame( $first->get_id(), $other->get_id() );
	}

	public function test_concurrent_request_is_blocked_by_lock_and_stale_lock_is_taken_over(): void {
		$product = $this->direct_product();
		$key     = 'k-lock';
		$name    = Direct_Order_Factory::GUARD_PREFIX . md5( 'donation_panel_direct|' . $this->key( $key ) );

		add_option( $name, time(), '', false );
		$busy = $this->direct( $this->donor_body( $product->get_id(), '30', $key ) );
		$this->assertSame( 409, $busy->get_status(), wp_json_encode( $busy->get_data() ) );
		$this->assertSame( 0, $this->orders_for_key( $key ), 'Kilitliyken sipariş üretilmemeli.' );

		update_option( $name, time() - 3600, false );
		$ok = $this->direct( $this->donor_body( $product->get_id(), '30', $key ) );
		$this->order_from( $ok );
		$this->assertSame( 1, $this->orders_for_key( $key ) );
		$this->assertFalse( get_option( $name ), 'İş bitince kilit bırakılmalı.' );
	}

	public function test_disabled_by_default_and_global_default_and_product_override(): void {
		$plain = $this->create_product( '', array( Donation_Scope::META => 'yes', '_allow_custom_price' => 'yes' ) );
		$this->assertFalse( Direct_Settings::enabled_for( $plain ) );
		$res = $this->direct( $this->donor_body( $plain->get_id(), '20', 'k-off' ) );
		$this->assertSame( 409, $res->get_status() );
		$this->assertSame( 0, $this->orders_for_key( 'k-off' ) );

		( new Settings() )->update( array( 'direct' => array( 'enabled' => true ) ) );
		$this->assertTrue( Direct_Settings::enabled_for( wc_get_product( $plain->get_id() ) ) );
		$this->order_from( $this->direct( $this->donor_body( $plain->get_id(), '20', 'k-global' ) ) );

		update_post_meta( $plain->get_id(), Direct_Settings::META, 'no' );
		$this->assertFalse( Direct_Settings::enabled_for( wc_get_product( $plain->get_id() ) ) );
		$this->assertSame( 409, $this->direct( $this->donor_body( $plain->get_id(), '20', 'k-global-no' ) )->get_status() );
	}

	public function test_donation_type_setting_sits_between_product_and_global(): void {
		$custom = $this->create_product( '', array( Donation_Scope::META => 'yes', '_allow_custom_price' => 'yes' ) );
		// Genel kapalı, tür "doğrudan": REST siparişi açar ve form modeli aynı kararı verir.
		( new Settings() )->update( array( 'direct' => array( 'enabled' => false, 'type_custom' => 'direct' ) ) );
		$this->assertSame( 'type', Direct_Settings::resolve( wc_get_product( $custom->get_id() ) )['source'] );
		$this->order_from( $this->direct( $this->donor_body( $custom->get_id(), '20', 'k-type-direct' ) ) );
		$this->assertTrue( \DonationPanel\Modules\Experiences\Form_Controller::model_for_id( $custom->get_id() )['direct'] );

		// Genel açık, tür "sepetli": REST reddeder.
		( new Settings() )->update( array( 'direct' => array( 'enabled' => true, 'type_custom' => 'cart' ) ) );
		$this->assertSame( 409, $this->direct( $this->donor_body( $custom->get_id(), '20', 'k-type-cart' ) )->get_status() );

		// Ürün türün üstünde (sözleşme meta anahtarı).
		update_post_meta( $custom->get_id(), Direct_Settings::META, 'yes' );
		$this->order_from( $this->direct( $this->donor_body( $custom->get_id(), '20', 'k-type-product' ) ) );
		( new Settings() )->update( array( 'direct' => array( 'enabled' => false, 'type_custom' => '' ) ) );
	}

	public function test_invalid_input_creates_no_order(): void {
		$product = $this->direct_product();
		$bad     = $this->direct( $this->donor_body( $product->get_id(), '', 'k-bad' ) );
		$this->assertSame( 400, $bad->get_status() );
		$nokey = $this->donor_body( $product->get_id(), '10', '' );
		$this->assertSame( 400, $this->direct( $nokey )->get_status() );
		$big = $this->direct( $this->donor_body( $product->get_id(), '99999999', 'k-big' ) );
		$this->assertSame( 400, $big->get_status() );
		$this->assertSame( 0, $this->counts['woocommerce_new_order'] );

		$req = new WP_REST_Request( 'POST', '/donation-panel/v1/direct' );
		$req->set_header( 'Content-Type', 'application/x-www-form-urlencoded' );
		$req->set_body_params( $this->donor_body( $product->get_id(), '10', 'k-form' ) );
		$this->reset_rate_limits();
		$this->assertSame( 415, rest_do_request( $req )->get_status() );

		$normal = $this->create_product( '25', array( Direct_Settings::META => 'yes' ) );
		$this->assertSame( 404, $this->direct( $this->donor_body( $normal->get_id(), '25', 'k-normal' ) )->get_status(), 'Bağış ürünü olmayan ürün sipariş üretmemeli.' );
		$this->assertSame( 0, $this->counts['woocommerce_new_order'] );
	}

	public function test_unavailable_products_are_rejected_before_any_order_item(): void {
		$body = static function ( int $id, string $key ) {
			return array( 'product_id' => $id, 'amount' => '1', 'quantity' => 3, 'submission_key' => $key, 'donation_full_name' => 'Ali Veli', 'donation_phone' => '+90 532 111 11 11' );
		};

		// Stokta yok.
		$oos = $this->direct_product( '25', array( '_enable_quantity' => 'yes' ) );
		$p   = wc_get_product( $oos->get_id() );
		$p->set_manage_stock( true );
		$p->set_stock_quantity( 0 );
		$p->save();
		$this->assertSame( 409, $this->direct( $body( $oos->get_id(), 'k-oos' ) )->get_status() );

		// Yeterli stok yok (2 var, 3 isteniyor).
		$few = $this->direct_product( '25', array( '_enable_quantity' => 'yes' ) );
		$p   = wc_get_product( $few->get_id() );
		$p->set_manage_stock( true );
		$p->set_stock_quantity( 2 );
		$p->save();
		$this->assertSame( 409, $this->direct( $body( $few->get_id(), 'k-few' ) )->get_status() );

		// Tekil satış: adet > 1 reddedilir.
		$solo = $this->direct_product( '25', array( '_enable_quantity' => 'yes' ) );
		$p    = wc_get_product( $solo->get_id() );
		$p->set_sold_individually( true );
		$p->save();
		$this->assertSame( 409, $this->direct( $body( $solo->get_id(), 'k-solo' ) )->get_status() );

		// Satın alınamaz (taslak): ürün gizli sayılır, sipariş yok.
		$draft = $this->direct_product( '25' );
		$p     = wc_get_product( $draft->get_id() );
		$p->set_status( 'draft' );
		$p->save();
		$this->assertGreaterThanOrEqual( 400, $this->direct( $body( $draft->get_id(), 'k-draft' ) )->get_status() );

		// Ortak doğrulama süzgeci (sepete ekleme ile aynı) reddederse sipariş açılmaz.
		$ok     = $this->direct_product( '25' );
		$reject = static function ( $passed ) {
			wc_add_notice( 'Blocked by validator.', 'error' );
			return false;
		};
		add_filter( 'woocommerce_add_to_cart_validation', $reject, 99 );
		try {
			$res = $this->direct( array( 'product_id' => $ok->get_id(), 'submission_key' => 'k-filter', 'donation_full_name' => 'Ali Veli', 'donation_phone' => '+90 532 111 11 11' ) );
		} finally {
			remove_filter( 'woocommerce_add_to_cart_validation', $reject, 99 );
		}
		$this->assertSame( 409, $res->get_status() );
		$this->assertStringContainsString( 'Blocked by validator', (string) $res->get_data()['message'] );
		$this->assertCount( 0, wc_get_notices( 'error' ), 'Doğrulayıcı iletileri kuyrukta kalmamalı.' );
		$this->assertSame( 0, $this->counts['woocommerce_new_order'], 'Hiçbir reddedilen istek sipariş üretmemeli.' );
	}

	public function test_stock_is_reserved_for_the_pending_order(): void {
		$product = $this->direct_product( '25', array( '_enable_quantity' => 'yes' ) );
		$p       = wc_get_product( $product->get_id() );
		$p->set_manage_stock( true );
		$p->set_stock_quantity( 5 );
		$p->save();
		$order = $this->order_from( $this->direct( array( 'product_id' => $product->get_id(), 'quantity' => 3, 'submission_key' => 'k-res', 'donation_full_name' => 'Ali Veli', 'donation_phone' => '+90 532 111 11 11' ) ) );
		$this->assertSame( 3, (int) ( new \Automattic\WooCommerce\Checkout\Helpers\ReserveStock() )->get_reserved_stock( wc_get_product( $product->get_id() ), 0 ), 'Bekleyen sipariş 3 adet rezerve etmeli.' );
		$this->assertSame( 5, (int) wc_get_product( $product->get_id() )->get_stock_quantity(), 'Rezervasyon stok miktarını düşürmez.' );
	}

	public function test_order_currency_matches_the_amount_calculation(): void {
		$product = $this->direct_product();
		$order   = $this->order_from( $this->direct( $this->donor_body( $product->get_id(), '55', 'k-cur' ) ) );
		$this->assertSame( \DonationPanel\Domain\Progress_Currency::get_base_currency(), $order->get_currency() );
		$this->assertSame( 55.0, (float) $order->get_total() );
	}

	public function test_waiting_orders_are_capped_per_ip_and_browser_token_and_shared_ip_donors_are_not_blocked(): void {
		$product = $this->direct_product();
		$cap     = \DonationPanel\WooCommerce\Direct\Direct_Order_Factory::max_pending();
		$this->assertSame( 10, $cap );
		$mine = static function ( array $body ) {
			return $body + array( 'client_token' => 'browserAAAA' );
		};
		$first_id = 0;
		for ( $i = 1; $i <= $cap; $i++ ) {
			$order    = $this->order_from( $this->direct( $mine( $this->donor_body( $product->get_id(), (string) ( 10 + $i ), 'k-cap-' . $i ) ) ) );
			$first_id = 1 === $i ? $order->get_id() : $first_id;
		}
		// Sınır aşıldı: yeni içerik reddedilir, sipariş açılmaz.
		$over = $this->direct( $mine( $this->donor_body( $product->get_id(), '99', 'k-cap-over' ) ) );
		$this->assertSame( 429, $over->get_status(), wp_json_encode( $over->get_data() ) );
		$this->assertSame( 0, $this->orders_for_key( 'k-cap-over' ) );
		// Aynı içerik, yeni anahtar: yeni sipariş AÇILMAZ, mevcut bekleyen sipariş yeniden kullanılır.
		$same = $this->direct( $mine( $this->donor_body( $product->get_id(), '11', 'k-cap-new-key' ) ) );
		$this->assertSame( 200, $same->get_status() );
		$this->assertTrue( $same->get_data()['reused'] );
		$this->assertSame( $first_id, $this->order_from( $same )->get_id() );
		$this->assertSame( 0, $this->orders_for_key( 'k-cap-new-key' ) );
		// Başarısız siparişler de pencerede sayılır.
		wc_get_order( $first_id )->update_status( 'failed' );
		$this->assertSame( 429, $this->direct( $mine( $this->donor_body( $product->get_id(), '98', 'k-cap-over-2' ) ) )->get_status() );

		// Aynı IP, farklı tarayıcı belirteçleri (ortak mobil operatör IP'si): çok sayıda bağış engellenmez.
		for ( $i = 1; $i <= 25; $i++ ) {
			$res = $this->direct( $this->donor_body( $product->get_id(), (string) ( 200 + $i ), 'k-shared-' . $i, array( 'client_token' => 'browser' . $i . 'XYZ' ) ) );
			$this->assertSame( 200, $res->get_status(), 'Ortak IP, farklı tarayıcı #' . $i . ': ' . wp_json_encode( $res->get_data() ) );
			$this->order_ids[] = $this->order_from( $res )->get_id();
		}

		// Belirteçsiz istek (API istemcisi) yalnız IP'ye bağlanır, kendi kovasına düşer.
		$this->assertSame( 200, $this->direct( $this->donor_body( $product->get_id(), '300', 'k-notoken' ) )->get_status() );

		// Ödenen/iptal edilen sipariş yer açar.
		wc_get_order( $first_id )->update_status( 'cancelled' );
		$this->order_from( $this->direct( $mine( $this->donor_body( $product->get_id(), '98', 'k-cap-over-2' ) ) ) );
	}

	public function test_hard_ip_cap_cannot_be_bypassed_by_rotating_browser_tokens(): void {
		$product = $this->direct_product();
		$low     = static function () {
			return 12;
		};
		add_filter( 'donation_panel_direct_max_pending_ip', $low );
		try {
			$this->assertSame( 12, \DonationPanel\WooCommerce\Direct\Direct_Order_Factory::max_pending_per_ip() );
			$ids = array();
			for ( $i = 1; $i <= 12; $i++ ) {
				$res   = $this->direct( $this->donor_body( $product->get_id(), (string) ( 20 + $i ), 'k-hard-' . $i, array( 'client_token' => 'rotateTok' . $i ) ) );
				$ids[] = $this->order_from( $res )->get_id();
			}
			// Her istek yeni belirteç taşıyor; sert IP sınırı yine de dolu.
			$blocked = $this->direct( $this->donor_body( $product->get_id(), '77', 'k-hard-13', array( 'client_token' => 'brandNewToken' ) ) );
			$this->assertSame( 429, $blocked->get_status(), wp_json_encode( $blocked->get_data() ) );
			$this->assertSame( 0, $this->orders_for_key( 'k-hard-13' ) );
			// Aynı içerik yeni belirteç/anahtarla: yeni sipariş yok, mevcut bekleyen yeniden kullanılır.
			$same = $this->direct( $this->donor_body( $product->get_id(), '21', 'k-hard-same', array( 'client_token' => 'anotherToken' ) ) );
			$this->assertSame( $ids[0], $this->order_from( $same )->get_id() );
			$this->assertTrue( $same->get_data()['reused'] );
			// Iptal yer açar (kendiliğinden boşalma).
			wc_get_order( $ids[0] )->update_status( 'cancelled' );
			$this->order_from( $this->direct( $this->donor_body( $product->get_id(), '77', 'k-hard-13', array( 'client_token' => 'brandNewToken' ) ) ) );
		} finally {
			remove_filter( 'donation_panel_direct_max_pending_ip', $low );
		}
	}

	public function test_hard_ip_cap_is_not_applied_when_the_ip_is_private_or_unknown(): void {
		$product = $this->direct_product();
		$low     = static function () {
			return 2;
		};
		add_filter( 'donation_panel_direct_max_pending_ip', $low );
		$saved = $_SERVER['REMOTE_ADDR'] ?? '';
		try {
			foreach ( array( '10.0.0.5', '192.168.1.9', '127.0.0.1' ) as $n => $addr ) {
				$_SERVER['REMOTE_ADDR'] = $addr;
				for ( $i = 1; $i <= 3; $i++ ) {
					$res = $this->direct( $this->donor_body( $product->get_id(), (string) ( 30 + $i ), 'k-priv-' . $n . '-' . $i, array( 'client_token' => 'privTok' . $n . $i ) ) );
					$this->assertSame( 200, $res->get_status(), $addr . ': ' . wp_json_encode( $res->get_data() ) );
				}
			}
			// Genel IP'de aynı sınır uygulanır.
			$_SERVER['REMOTE_ADDR'] = '8.8.4.4';
			$this->direct( $this->donor_body( $product->get_id(), '41', 'k-pub-1', array( 'client_token' => 'pubT1' ) ) );
			$this->direct( $this->donor_body( $product->get_id(), '42', 'k-pub-2', array( 'client_token' => 'pubT2' ) ) );
			$this->assertSame( 429, $this->direct( $this->donor_body( $product->get_id(), '43', 'k-pub-3', array( 'client_token' => 'pubT3' ) ) )->get_status() );
		} finally {
			$_SERVER['REMOTE_ADDR'] = $saved;
			remove_filter( 'donation_panel_direct_max_pending_ip', $low );
		}
	}

	public function test_unreliable_ip_falls_back_to_a_generous_site_wide_cap(): void {
		$product = $this->direct_product();
		$low     = static function () {
			return 4;
		};
		add_filter( 'donation_panel_direct_max_pending_site', $low );
		$saved                  = $_SERVER['REMOTE_ADDR'] ?? '';
		$_SERVER['REMOTE_ADDR'] = '10.1.2.3';
		try {
			for ( $i = 1; $i <= 4; $i++ ) {
				$this->order_from( $this->direct( $this->donor_body( $product->get_id(), (string) ( 50 + $i ), 'k-site-' . $i, array( 'client_token' => 'siteTok' . $i ) ) ) );
			}
			$blocked = $this->direct( $this->donor_body( $product->get_id(), '99', 'k-site-5', array( 'client_token' => 'siteTok5' ) ) );
			$this->assertSame( 429, $blocked->get_status(), wp_json_encode( $blocked->get_data() ) );
			// Aynı içerik YALNIZ aynı tarayıcı belirteciyle mevcut bekleyen siparişe bağlanır (başkasının adresi sızmaz).
			$same = $this->direct( $this->donor_body( $product->get_id(), '51', 'k-site-same', array( 'client_token' => 'siteTok1' ) ) );
			$this->assertTrue( $same->get_data()['reused'], 'Aynı içerik mevcut bekleyen siparişe bağlanır.' );
			$other = $this->direct( $this->donor_body( $product->get_id(), '51', 'k-site-same-2', array( 'client_token' => 'siteTokX' ) ) );
			$this->assertSame( 429, $other->get_status(), 'Başka belirteç başkasının bekleyen siparişini alamaz.' );
		} finally {
			$_SERVER['REMOTE_ADDR'] = $saved;
			remove_filter( 'donation_panel_direct_max_pending_site', $low );
		}
		$this->assertSame( 500, \DonationPanel\WooCommerce\Direct\Direct_Order_Factory::max_pending_site() );
		$this->assertSame( 5000, \DonationPanel\WooCommerce\Direct\Direct_Order_Factory::max_pending_site_quantity() );
	}

	public function test_unreliable_ip_does_not_load_site_orders_on_every_request(): void {
		$product = $this->direct_product();
		$saved   = $_SERVER['REMOTE_ADDR'] ?? '';
		$_SERVER['REMOTE_ADDR'] = '10.1.2.3';
		delete_transient( Direct_Order_Factory::SITE_QTY_TRANSIENT );
		$loads   = 0;
		$counter = static function ( $class ) use ( &$loads ) {
			++$loads;
			return $class;
		};
		try {
			// Taban: bekleyen sipariş yokken tek istekte yüklenen sipariş nesnesi sayısı (kendi akışı).
			add_filter( 'woocommerce_order_class', $counter );
			$this->order_from( $this->direct( $this->donor_body( $product->get_id(), '60', 'k-light-0', array( 'client_token' => 'lightTok0' ) ) ) );
			remove_filter( 'woocommerce_order_class', $counter );
			$base  = $loads;
			for ( $i = 1; $i <= 8; $i++ ) {
				$this->order_from( $this->direct( $this->donor_body( $product->get_id(), (string) ( 60 + $i ), 'k-light-' . $i, array( 'client_token' => 'lightTok' . $i ) ) ) );
			}
			// Sayaç ısındı; 9 bekleyen sipariş varken yeni istek tabandan fazla sipariş nesnesi yüklemez (eskiden bekleyen sayısı kadar).
			$loads = 0;
			add_filter( 'woocommerce_order_class', $counter );
			$this->order_from( $this->direct( $this->donor_body( $product->get_id(), '99', 'k-light-9', array( 'client_token' => 'lightTok9' ) ) ) );
			remove_filter( 'woocommerce_order_class', $counter );
			$this->assertLessThanOrEqual( $base + 1, $loads, 'Bekleyen siparişler her istekte yüklenmemeli; taban ' . $base . ', yüklenen: ' . $loads );
		} finally {
			remove_filter( 'woocommerce_order_class', $counter );
			$_SERVER['REMOTE_ADDR'] = $saved;
		}
	}

	public function test_submission_key_returns_the_payment_url_only_to_the_client_that_created_it(): void {
		$product = $this->direct_product();
		$first   = $this->order_from( $this->direct( $this->donor_body( $product->get_id(), '25', 'k-owner', array( 'client_token' => 'ownerTokA' ) ) ) );

		// Aynı anahtar + aynı içerik, BAŞKA belirteç: yeni sipariş yok, adres yok.
		$thief = $this->direct( $this->donor_body( $product->get_id(), '25', 'k-owner', array( 'client_token' => 'ownerTokB' ) ) );
		$this->assertSame( 422, $thief->get_status(), wp_json_encode( $thief->get_data() ) );
		$this->assertArrayNotHasKey( 'redirect_url', (array) $thief->get_data() );
		$this->assertStringNotContainsString( $first->get_order_key(), (string) wp_json_encode( $thief->get_data() ) );
		$this->assertSame( 1, $this->orders_for_key( 'k-owner' ) );

		// Belirteçsiz istek de alamaz.
		$none = $this->direct( $this->donor_body( $product->get_id(), '25', 'k-owner' ) );
		$this->assertSame( 422, $none->get_status() );
		$this->assertSame( 1, $this->orders_for_key( 'k-owner' ) );

		// Aynı istemci yeniden gönderirse aynı sipariş.
		$again = $this->direct( $this->donor_body( $product->get_id(), '25', 'k-owner', array( 'client_token' => 'ownerTokA' ) ) );
		$this->assertTrue( $again->get_data()['reused'] );
		$this->assertSame( $first->get_id(), $this->order_from( $again )->get_id() );
	}

	public function test_replay_with_empty_owner_on_both_sides_is_not_returned(): void {
		$product = $this->direct_product();
		$first   = $this->order_from( $this->direct( $this->donor_body( $product->get_id(), '25', 'k-empty-owner' ) ) );
		$order   = wc_get_order( $first->get_id() );
		$order->delete_meta_data( Direct_Order_Factory::OWNER_META );
		$order->save();

		$replay = $this->direct( $this->donor_body( $product->get_id(), '25', 'k-empty-owner' ), false );
		$this->assertSame( 422, $replay->get_status(), wp_json_encode( $replay->get_data() ) );
		$this->assertArrayNotHasKey( 'redirect_url', (array) $replay->get_data() );
		$this->assertSame( 1, $this->orders_for_key( 'k-empty-owner' ) );
	}

	public function test_client_hashes_are_salted_and_dropped_when_the_order_leaves_pending(): void {
		$product = $this->direct_product();
		$_SERVER['REMOTE_ADDR'] = '203.0.113.77';
		$order  = $this->order_from( $this->direct( $this->donor_body( $product->get_id(), '31', 'k-hash', array( 'client_token' => 'hashTok' ) ) ) );
		$client = (string) $order->get_meta( Direct_Order_Factory::CLIENT_META );
		$this->assertNotSame( md5( 'donation_panel_direct_client|203.0.113.77' ), $client, 'Tuzsuz md5 değil.' );
		$this->assertSame( 64, strlen( $client ) );
		$this->assertNotSame( '', (string) $order->get_meta( Direct_Order_Factory::TOKEN_META ) );

		$order->update_status( 'on-hold' );
		$fresh = wc_get_order( $order->get_id() );
		$this->assertSame( '', (string) $fresh->get_meta( Direct_Order_Factory::CLIENT_META ) );
		$this->assertSame( '', (string) $fresh->get_meta( Direct_Order_Factory::TOKEN_META ) );
		$this->assertNotSame( '', (string) $fresh->get_meta( Direct_Order_Factory::OWNER_META ), 'İdempotency sahibi kalır.' );

		// Eraser aynı e-postadaki siparişin kalan karmasını da siler.
		$fresh->set_billing_email( 'sec-test-' . $this->run . '@example.com' );
		$fresh->save();
		\DonationPanel\Privacy\Order_Privacy::erase_direct_client_meta( $fresh );
		$this->assertSame( '', (string) wc_get_order( $order->get_id() )->get_meta( Direct_Order_Factory::OWNER_META ) );
	}

	public function test_direct_endpoint_is_closed_when_the_front_gate_is_disabled(): void {
		$product = $this->direct_product();
		$off     = static function () {
			return true;
		};
		add_filter( 'donation_panel_front_disabled', $off );
		try {
			$res = $this->direct( $this->donor_body( $product->get_id(), '40', 'k-gate' ) );
			$this->assertSame( 503, $res->get_status() );
			$this->assertSame( 0, $this->orders_for_key( 'k-gate' ) );
		} finally {
			remove_filter( 'donation_panel_front_disabled', $off );
		}
		$this->order_from( $this->direct( $this->donor_body( $product->get_id(), '40', 'k-gate' ) ) );
	}

	public function test_deactivation_clears_the_cleanup_event(): void {
		Direct_Cleanup::schedule();
		$this->assertNotFalse( wp_next_scheduled( Direct_Cleanup::HOOK ) );
		\DonationPanel\Core\Bootstrap::deactivate();
		$this->assertFalse( wp_next_scheduled( Direct_Cleanup::HOOK ) );
	}

	public function test_total_reserved_quantity_per_ip_is_capped(): void {
		$product = $this->direct_product( '5', array( '_enable_quantity' => 'yes', '_max_shares' => '500' ) );
		$cap     = static function () {
			return 5;
		};
		add_filter( 'donation_panel_direct_max_pending_quantity', $cap );
		try {
			$make = static function ( int $id, int $qty, string $key, string $token ) {
				return array( 'product_id' => $id, 'quantity' => $qty, 'submission_key' => $key, 'client_token' => $token, 'donation_full_name' => 'Ali Veli ' . $token, 'donation_phone' => '+90 532 111 11 11' );
			};
			$this->order_from( $this->direct( $make( $product->get_id(), 3, 'k-q1', 'tokQ1' ) ) );
			$res = $this->direct( $make( $product->get_id(), 3, 'k-q2', 'tokQ2' ) );
			$this->assertSame( 429, $res->get_status(), 'Aynı IP toplam rezerve adedi sınırı (3+3 > 5), belirteç değişse de.' );
			$this->order_from( $this->direct( $make( $product->get_id(), 2, 'k-q3', 'tokQ3' ) ) );
		} finally {
			remove_filter( 'donation_panel_direct_max_pending_quantity', $cap );
		}
	}

	public function test_quantity_is_capped_per_direct_order(): void {
		$product = $this->direct_product( '5', array( '_enable_quantity' => 'yes', '_max_shares' => '500' ) );
		$body    = array( 'product_id' => $product->get_id(), 'quantity' => 21, 'submission_key' => 'k-qty', 'donation_full_name' => 'Ali Veli', 'donation_phone' => '+90 532 111 11 11' );
		$res     = $this->direct( $body );
		$this->assertSame( 400, $res->get_status(), wp_json_encode( $res->get_data() ) );
		$this->assertSame( 0, $this->orders_for_key( 'k-qty' ) );
		$allow = static function () {
			return 21;
		};
		add_filter( 'donation_panel_direct_max_quantity', $allow );
		$this->assertContains( $this->direct( $body )->get_status(), array( 200, 400 ) );
		remove_filter( 'donation_panel_direct_max_quantity', $allow );
	}

	public function test_works_when_the_woocommerce_session_is_not_loaded_as_in_a_bare_rest_request(): void {
		$product = $this->direct_product();
		WC()->session = null;
		$res          = $this->direct( $this->donor_body( $product->get_id(), '33', 'k-nosession' ) );
		$this->order_from( $res );
		$this->assertNotNull( WC()->session );
	}

	public function test_stock_is_reserved_only_for_stock_managed_products(): void {
		global $wpdb;
		$product = $this->direct_product( '25', array( '_enable_quantity' => 'yes' ) );
		$order   = $this->order_from( $this->direct( array( 'product_id' => $product->get_id(), 'quantity' => 3, 'submission_key' => 'k-nores', 'donation_full_name' => 'Ali Veli', 'donation_phone' => '+90 532 111 11 11' ) ) );
		$rows    = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}wc_reserved_stock WHERE order_id = %d", $order->get_id() ) ); // phpcs:ignore WordPress.DB
		$this->assertSame( 0, $rows, 'Stok yönetimsiz bağış ürünü rezervasyon tüketmemeli.' );
	}

	public function test_cleanup_ttl_follows_the_woocommerce_hold_stock_minutes(): void {
		$old = get_option( 'woocommerce_hold_stock_minutes', '60' );
		update_option( 'woocommerce_hold_stock_minutes', '45' );
		$this->assertSame( 45 * MINUTE_IN_SECONDS, Direct_Cleanup::ttl() );
		update_option( 'woocommerce_hold_stock_minutes', '0' );
		$this->assertSame( 6 * HOUR_IN_SECONDS, Direct_Cleanup::ttl() );
		update_option( 'woocommerce_hold_stock_minutes', '5' );
		$this->assertSame( 15 * MINUTE_IN_SECONDS, Direct_Cleanup::ttl(), 'En az 15 dakika.' );
		update_option( 'woocommerce_hold_stock_minutes', $old );
	}

	public function test_rate_limit(): void {
		$product = $this->direct_product();
		$lift    = static function () {
			return 100;
		};
		add_filter( 'donation_panel_direct_max_pending', $lift );
		$this->reset_rate_limits();
		$last = 0;
		for ( $i = 0; $i < 32; $i++ ) {
			$r    = $this->direct( $this->donor_body( $product->get_id(), '15', 'k-rl-' . $i ), false );
			$last = $r->get_status();
		}
		$this->assertSame( 429, $last );
		remove_filter( 'donation_panel_direct_max_pending', $lift );
		$this->assertSame( 30, $this->counts['woocommerce_new_order'], 'Dakikada en çok 30 sipariş.' );
	}

	public function test_fixed_price_product_uses_server_price_and_quantity(): void {
		$product = $this->direct_product( '25', array( '_enable_quantity' => 'yes' ) );
		$res     = $this->direct( array( 'product_id' => $product->get_id(), 'amount' => '1', 'quantity' => 3, 'submission_key' => 'k-fixed', 'donation_full_name' => 'Ali Veli', 'donation_phone' => '+90 532 111 11 11' ) );
		$order   = $this->order_from( $res );
		$this->assertSame( 75.0, (float) $order->get_total(), 'Tutar sunucuda birim fiyat x adet olmalı; istemci tutarı yok sayılır.' );
		$this->assertSame( 3, array_values( $order->get_items() )[0]->get_quantity() );
	}

	/**
	 * Ödeme yöntemi x durum matrisi: yöntem, sonuç durumu ve Woo kancalarının tetiklenme sayıları.
	 *
	 * @return array<string,array{0:string,1:string}>
	 */
	public function method_provider(): array {
		return array(
			'cod'            => array( 'cod', 'success' ),
			'bacs'           => array( 'bacs', 'success' ),
			'cheque'         => array( 'cheque', 'success' ),
			'card success'   => array( 'wdp_test_card', 'success' ),
			'card 3ds'       => array( 'wdp_test_card', 'redirect' ),
			'card failed'    => array( 'wdp_test_card', 'fail' ),
		);
	}

	/**
	 * @dataProvider method_provider
	 */
	public function test_payment_method_status_matrix_fires_woo_hooks_once( string $method, string $mode ): void {
		$product = $this->direct_product();
		$order   = $this->order_from( $this->direct( $this->donor_body( $product->get_id(), '80', 'k-m-' . $method . '-' . $mode ) ) );
		$id      = $order->get_id();
		WDP_Test_Card_Gateway::$mode = $mode;
		$total_before                = $this->total_for( $product->get_id() );

		$order->set_payment_method( $method );
		$order->save();
		$gateways = WC()->payment_gateways()->payment_gateways();
		$this->assertArrayHasKey( $method, $gateways );
		$result = $gateways[ $method ]->process_payment( $id );
		$order  = wc_get_order( $id );

		if ( 'redirect' === $mode ) {
			$this->assertSame( 'pending', $order->get_status(), '3DS yönlendirmesinde sipariş onaya kadar bekleyen kalır.' );
			$this->assertStringContainsString( '3ds.example.test', $result['redirect'] );
			$this->assertSame( 0, $this->counts['woocommerce_payment_complete'] );
			// Dönüş/webhook: onay iki kez gelse bile kanca tek sefer.
			$order->payment_complete( 'txn_3ds' );
			$order = wc_get_order( $id );
			wc_get_order( $id )->payment_complete( 'txn_3ds' );
			$this->assertSame( 1, $this->counts['woocommerce_payment_complete'], 'Çift webhook tamamlama kancasını bir kez tetiklemeli.' );
		}
		$status = wc_get_order( $id )->get_status();

		// Teşekkür ekranı (woocommerce_thankyou): Woo'nun kendi şablonu; sayfa yenilenince tekrar çizilir, eklenti saymaz/göndermez.
		$_GET['key'] = $order->get_order_key();
		ob_start();
		wc_get_template( 'checkout/thankyou.php', array( 'order' => wc_get_order( $id ) ) );
		ob_end_clean();
		$thankyou_once = $this->counts['woocommerce_thankyou'];

		$expected_status = array(
			'success' => in_array( $method, array( 'cod' ), true ) ? array( 'processing', 'on-hold' ) : ( 'wdp_test_card' === $method ? array( 'processing', 'completed' ) : array( 'on-hold' ) ),
			'redirect' => array( 'processing', 'completed' ),
			'fail'     => array( 'failed' ),
		);
		$this->assertContains( $status, $expected_status[ $mode ], "{$method}/{$mode} durumu: {$status}" );
		$this->assertSame( 1, $this->counts[ 'woocommerce_order_status_' . $status ] ?? 0, "woocommerce_order_status_{$status} bir kez" );
		$expected_complete = ( 'wdp_test_card' === $method && in_array( $mode, array( 'success', 'redirect' ), true ) ) ? 1 : 0;
		$this->assertSame( $expected_complete, $this->counts['woocommerce_payment_complete'], 'woocommerce_payment_complete sayısı' );
		$this->assertSame( 1, $thankyou_once, 'woocommerce_thankyou teşekkür sayfası çiziminde bir kez' );
		$this->assertSame( 1, $this->counts['woocommerce_new_order'] );

		// Kampanya toplamı: yalnız ödenmiş/işlemdeki durumlarda ve bir kez artar.
		$delta = $this->total_for( $product->get_id() ) - $total_before;
		$this->assertContains( $delta, array( 0.0, 80.0 ), 'Toplam ya hiç ya bir kez artar: ' . $delta );

		fwrite( STDERR, sprintf( "\n[matris] %-14s %-9s -> %-10s payment_complete=%d status_hook=%d thankyou=%d new_order=%d toplam_artis=%s", $method, $mode, $status, $this->counts['woocommerce_payment_complete'], $this->counts[ 'woocommerce_order_status_' . $status ] ?? 0, $thankyou_once, $this->counts['woocommerce_new_order'], $delta ) );
	}

	public function test_failed_order_resubmit_returns_same_order_for_retry_and_cancelled_creates_new(): void {
		$product = $this->direct_product();
		$key     = 'k-retry';
		$tok     = array( 'client_token' => 'retryTok' );
		$first   = $this->order_from( $this->direct( $this->donor_body( $product->get_id(), '90', $key, $tok ) ) );
		$first->set_payment_method( 'wdp_test_card' );
		$first->save();
		WDP_Test_Card_Gateway::$mode = 'fail';
		WC()->payment_gateways()->payment_gateways()['wdp_test_card']->process_payment( $first->get_id() );
		$this->assertSame( 'failed', wc_get_order( $first->get_id() )->get_status() );

		$again = $this->direct( $this->donor_body( $product->get_id(), '90', $key, $tok ) );
		$same  = $this->order_from( $again );
		$this->assertSame( $first->get_id(), $same->get_id(), 'Başarısız ödeme aynı siparişte yeniden denenir (devam bağlantısı).' );
		$this->assertTrue( wc_get_order( $first->get_id() )->needs_payment() );
		$this->assertStringContainsString( 'order-pay', $again->get_data()['redirect_url'] );

		wc_get_order( $first->get_id() )->update_status( 'cancelled' );
		$fresh = $this->order_from( $this->direct( $this->donor_body( $product->get_id(), '90', $key, $tok ) ) );
		$this->assertNotSame( $first->get_id(), $fresh->get_id(), 'İptal edilmiş sipariş yerine yeni sipariş açılır.' );
	}

	public function test_paid_order_resubmit_points_to_thank_you_and_never_duplicates(): void {
		$product = $this->direct_product();
		$key     = 'k-paid';
		$tok     = array( 'client_token' => 'paidTok' );
		$order   = $this->order_from( $this->direct( $this->donor_body( $product->get_id(), '60', $key, $tok ) ) );
		$order->payment_complete( 'txn_paid' );

		$res  = $this->direct( $this->donor_body( $product->get_id(), '60', $key, $tok ) );
		$data = $res->get_data();
		$this->assertSame( 200, $res->get_status() );
		$this->assertTrue( $data['reused'] );
		$this->assertStringContainsString( 'order-received', (string) $data['redirect_url'] );
		$this->assertSame( 1, $this->orders_for_key( $key ) );
		$this->assertSame( 1, $this->counts['woocommerce_payment_complete'] );
	}

	public function test_stale_pending_direct_orders_are_cancelled_but_others_are_not_touched(): void {
		$product = $this->direct_product();
		$old     = $this->order_from( $this->direct( $this->donor_body( $product->get_id(), '35', 'k-old' ) ) );
		$fresh   = $this->order_from( $this->direct( $this->donor_body( $product->get_id(), '36', 'k-fresh' ) ) );
		$regular = $this->create_order( $product->get_id(), 20.0, 'pending' );

		$old->set_date_created( time() - 3 * DAY_IN_SECONDS );
		$old->save();
		$regular->set_date_created( time() - 3 * DAY_IN_SECONDS );
		$regular->save();

		$this->assertSame( 1, Direct_Cleanup::cancel_stale() );
		$this->assertSame( 'cancelled', wc_get_order( $old->get_id() )->get_status() );
		$this->assertSame( 'pending', wc_get_order( $fresh->get_id() )->get_status() );
		$this->assertSame( 'pending', wc_get_order( $regular->get_id() )->get_status(), 'Doğrudan bağış olmayan sipariş dokunulmaz.' );
		$this->assertNotFalse( wp_next_scheduled( Direct_Cleanup::HOOK ), 'Temizlik olayı ilk siparişte zamanlanmış olmalı.' );

		// Geç gelen geçit onayı iptal edilmiş siparişi yine de ödenmiş yapar (WooCommerce standardı).
		wc_get_order( $old->get_id() )->payment_complete( 'txn_late' );
		$this->assertContains( wc_get_order( $old->get_id() )->get_status(), array( 'processing', 'completed' ) );
	}

	public function test_logged_in_donor_order_is_linked_to_the_account(): void {
		$user_id = self::factory_user();
		wp_set_current_user( $user_id );
		$product = $this->direct_product();
		$order   = $this->order_from( $this->direct( $this->donor_body( $product->get_id(), '25', 'k-user' ) ) );
		$this->assertSame( $user_id, $order->get_customer_id() );
		$this->assertNotSame( '', $order->get_billing_email(), 'Hesap e-postası fatura e-postasına yazılır.' );
		wp_set_current_user( 0 );
		require_once ABSPATH . 'wp-admin/includes/user.php';
		wp_delete_user( $user_id );
	}

	private static function factory_user(): int {
		$id = wp_insert_user(
			array(
				'user_login' => 'wdp_direct_' . wp_generate_password( 6, false ),
				'user_pass'  => wp_generate_password( 20 ),
				'user_email' => 'wdp-direct-' . wp_generate_password( 6, false ) . '@example.test',
				'role'       => 'customer',
			)
		);
		return (int) $id;
	}
}

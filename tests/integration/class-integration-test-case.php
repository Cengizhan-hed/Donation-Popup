<?php
/**
 * Entegrasyon testleri için ortak taban: gerçek WooCommerce nesneleri oluşturur ve YALNIZ kendi oluşturduğu
 * kayıtları siler (başka kaydı/ayarı değiştirmez).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

abstract class WDP_Integration_Test_Case extends TestCase {

	/** @var int[] */
	protected $product_ids = array();

	/** @var int[] */
	protected $order_ids = array();

	/** @var string[] */
	protected $option_names = array();

	protected function setUp(): void {
		parent::setUp();
		if ( function_exists( 'wc_load_cart' ) ) {
			wc_load_cart();
		}
		$this->empty_cart();
		$this->reset_rate_limits();
		wp_set_current_user( 0 );
	}

	protected function tearDown(): void {
		$this->empty_cart();
		foreach ( $this->order_ids as $id ) {
			$order = wc_get_order( $id );
			if ( $order ) {
				$order->delete( true );
			}
		}
		foreach ( $this->product_ids as $id ) {
			$product = wc_get_product( $id );
			if ( $product ) {
				$product->delete( true );
			}
		}
		foreach ( $this->option_names as $name ) {
			delete_option( $name );
		}
		$this->product_ids  = array();
		$this->order_ids    = array();
		$this->option_names = array();
		\DonationPanel\Domain\Donation_Scope::flush();
		\DonationPanel\Domain\Placement_Settings::flush();
		parent::tearDown();
	}

	/**
	 * Eklentinin hız sınırı sayaçlarını (yalnız bu yerel entegrasyon WP'sinde) sıfırlar.
	 */
	protected function reset_rate_limits(): void {
		global $wpdb;
		foreach ( array( 'donation_panel_rl_', 'donation_panel_rt_' ) as $prefix ) {
			foreach ( array( '_transient_', '_transient_timeout_' ) as $kind ) {
				$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", $wpdb->esc_like( $kind . $prefix ) . '%' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			}
		}
		wp_cache_flush();
	}

	protected function empty_cart(): void {
		if ( function_exists( 'WC' ) && WC()->cart ) {
			WC()->cart->empty_cart();
		}
	}

	/**
	 * Gerçek WooCommerce basit ürünü.
	 *
	 * @param string               $price Fiyat.
	 * @param array<string,string> $meta  Ürün meta.
	 */
	protected function create_product( string $price = '25', array $meta = array() ): WC_Product_Simple {
		$product = new WC_Product_Simple();
		$product->set_name( 'WDP integration ' . wp_generate_password( 6, false ) );
		$product->set_status( 'publish' );
		$product->set_regular_price( $price );
		$product->set_price( $price );
		$product->set_virtual( true );
		$id = $product->save();
		foreach ( $meta as $key => $value ) {
			update_post_meta( $id, $key, $value );
		}
		$this->product_ids[] = $id;
		return wc_get_product( $id );
	}

	/**
	 * Tek bağış kalemli gerçek sipariş (HPOS açıksa HPOS'a yazar).
	 */
	protected function create_order( int $product_id, float $amount, string $status = 'pending' ): WC_Order {
		$order = wc_create_order();
		$item  = new WC_Order_Item_Product();
		$item->set_product_id( $product_id );
		$item->set_name( 'Donation' );
		$item->set_quantity( 1 );
		$item->set_subtotal( (string) $amount );
		$item->set_total( (string) $amount );
		$item->add_meta_data( '_custom_price', $amount, true );
		$order->add_item( $item );
		$order->set_billing_email( 'integration@example.test' );
		$order->calculate_totals( false );
		$order->set_status( $status );
		$order->save();
		$this->order_ids[] = $order->get_id();
		return $order;
	}

	protected function total_for( int $product_id ): float {
		return (float) get_post_meta( $product_id, '_wdp_total_donation_amount', true );
	}

	protected function donors_for( int $product_id ): int {
		return (int) get_post_meta( $product_id, '_wdp_donor_count', true );
	}

	/**
	 * REST isteği (JSON gövdeli) gönderir.
	 *
	 * @param array<string,mixed> $body Gövde.
	 * @param array<string,string> $headers Ek başlıklar.
	 */
	protected function rest_post( string $route, array $body, array $headers = array() ): WP_REST_Response {
		$request = new WP_REST_Request( 'POST', $route );
		$request->set_header( 'Content-Type', 'application/json' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		foreach ( $headers as $name => $value ) {
			$request->set_header( $name, $value );
		}
		$request->set_body( (string) wp_json_encode( $body ) );
		$request->set_body_params( $body );
		return rest_do_request( $request );
	}
}

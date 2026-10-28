<?php
/**
 * Doğrudan (sepetsiz) bağış: tek kalemlik bekleyen (pending) sipariş üretir; sepete dokunmaz.
 *
 * - Doğrulama sepet akışıyla AYNI sunucu kurallarıdır (Field_Validator, hedef kapalı, en düşük tutar).
 * - İdempotency: istemci `submission_key` anahtarı sipariş meta alanında (karma) saklanır; aynı anahtarla gelen ikinci istek
 *   yeni sipariş üretmez, mevcut siparişin durumuna göre ödeme (order-pay) ya da teşekkür bağlantısı döner. Eşzamanlı iki
 *   istek `add_option` kilidiyle (atomik) sıraya girer. Aynı anahtar başka içerikle gelirse 422.
 * - Sipariş kalemi meta alanları sepet akışıyla aynı yazıcıdan geçer (`woocommerce_checkout_create_order_line_item`).
 * - Eklenti ödeme tamamlama/purchase kancası ÇAĞIRMAZ; durum geçişlerini ödeme geçidi ve WooCommerce yapar.
 * - Kart verisi eklentiye girmez: ödeme order-pay sayfasında geçidin kendi alanlarıyla yapılır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce\Direct;

use DonationPanel\Domain\Campaign_Goal;
use DonationPanel\Domain\Progress_Currency;
use DonationPanel\Modules\Experiences\Field_Validator;
use DonationPanel\WooCommerce\Cart_Data;
use DonationPanel\WooCommerce\Cart_Hooks;

defined( 'ABSPATH' ) || exit;

/**
 * Direct_Order_Factory.
 */
final class Direct_Order_Factory {

	/** Doğrudan bağış siparişi işareti. */
	const FLAG_META = '_donation_panel_direct';

	/** İdempotency anahtarı (karma). */
	const KEY_META = '_donation_panel_direct_key';

	/** İçerik parmak izi (karma). */
	const FINGERPRINT_META = '_donation_panel_direct_fp';

	/** Kilit seçeneği öneki (kısa ömürlü). */
	const GUARD_PREFIX = 'donation_panel_dl_';

	/** Kilit en çok bu kadar sn tutulur; eskiyen kilit devralınır. */
	const LOCK_TTL = 60;

	/**
	 * Siparişi üretir ya da (aynı anahtarla) mevcut olanı döndürür.
	 *
	 * @param object               $product \WC_Product.
	 * @param array<string, mixed> $model   Form modeli (Form_Context).
	 * @param array<string, mixed> $input   İstek girdisi (cart/add ile aynı alanlar + `submission_key`).
	 * @return array{ok: bool, status: int, message: string, errors: array<string, string>, order: \WC_Order|null, reused: bool, code: string}
	 */
	public function submit( $product, array $model, array $input ) {
		if ( ! empty( $model['closed'] ) ) {
			$closed = isset( $model['closed_message'] ) && '' !== $model['closed_message'] ? (string) $model['closed_message'] : __( 'This campaign is no longer accepting donations.', 'woo-donation-popup' );
			return $this->fail( 409, $closed, 'donation_panel_campaign_closed' );
		}

		$key = isset( $input['submission_key'] ) && is_scalar( $input['submission_key'] ) ? Cart_Data::text( (string) $input['submission_key'], 100 ) : '';
		if ( '' === $key ) {
			return $this->fail( 400, __( 'The request is missing its submission key.', 'woo-donation-popup' ), 'donation_panel_direct_key_required' );
		}

		$validated = Field_Validator::validate( $model, $input );
		if ( empty( $validated['valid'] ) ) {
			return $this->fail( 400, __( 'Please check the highlighted fields.', 'woo-donation-popup' ), 'donation_panel_cart_rejected', (array) $validated['errors'] );
		}
		$rule = $this->rule_error( $product, $model, (float) $validated['amount'] );
		if ( '' !== $rule['message'] ) {
			return $this->fail( 400, $rule['message'], 'donation_panel_cart_rejected', $rule['errors'] );
		}

		$plan = $this->plan( $product, $model, $input, $validated );
		// Sipariş kalemi oluşmadan önce sepete ekleme ile aynı satın alınabilirlik/stok/ekleme doğrulamaları.
		$purchase = $this->purchase_error( $product, (int) $plan['quantity'] );
		if ( '' !== $purchase ) {
			return $this->fail( 409, $purchase, 'donation_panel_direct_unavailable' );
		}
		$key_hash    = md5( 'donation_panel_direct|' . $key );
		$fingerprint = md5( (string) wp_json_encode( $plan['fingerprint'] ) );

		if ( ! $this->acquire( $key_hash ) ) {
			return $this->fail( 409, __( 'Your donation is already being processed. Please wait a moment.', 'woo-donation-popup' ), 'donation_panel_direct_busy' );
		}
		try {
			$existing = $this->find( $key_hash );
			if ( $existing ) {
				if ( (string) $existing->get_meta( self::FINGERPRINT_META ) !== $fingerprint ) {
					return $this->fail( 422, __( 'This submission key was already used for a different donation.', 'woo-donation-popup' ), 'donation_panel_direct_key_reused' );
				}
				return $this->done( $existing, true );
			}
			$order = $this->create( $product, $plan, $key_hash, $fingerprint );
		} finally {
			$this->release( $key_hash );
		}
		if ( is_wp_error( $order ) && 'donation_panel_direct_stock' === $order->get_error_code() ) {
			return $this->fail( 409, $order->get_error_message(), 'donation_panel_direct_unavailable' );
		}
		if ( is_wp_error( $order ) ) {
			return $this->fail( 500, __( 'The donation could not be started. Please try again.', 'woo-donation-popup' ), 'donation_panel_direct_failed' );
		}
		return $this->done( $order, false );
	}

	/**
	 * Sepete ekleme ile aynı doğrulamalar: satın alınabilirlik, stok, tekil satış ve `woocommerce_add_to_cart_validation`.
	 *
	 * @param object $product  \WC_Product.
	 * @param int    $quantity Adet.
	 * @return string Hata iletisi; boşsa geçerli.
	 */
	private function purchase_error( $product, $quantity ) {
		$quantity = max( 1, (int) $quantity );
		if ( ! $product->is_purchasable() ) {
			return __( 'This donation is not available right now.', 'woo-donation-popup' );
		}
		if ( ! $product->is_in_stock() || ! $product->has_enough_stock( $quantity ) ) {
			return __( 'This donation is out of stock.', 'woo-donation-popup' );
		}
		if ( $product->is_sold_individually() && $quantity > 1 ) {
			return __( 'This donation can only be made once per order.', 'woo-donation-popup' );
		}
		$product_id = (int) $product->get_id();
		/** This filter is documented in woocommerce/includes/class-wc-cart.php. */
		$passed = (bool) Cart_Hooks::run_in_plugin_flow(
			static function () use ( $product_id, $quantity ) {
				return apply_filters( 'woocommerce_add_to_cart_validation', true, $product_id, $quantity ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
			}
		);
		$notice = '';
		if ( function_exists( 'wc_get_notices' ) ) {
			$notices = wc_get_notices( 'error' );
			if ( ! $passed && is_array( $notices ) && ! empty( $notices ) ) {
				$first  = reset( $notices );
				$text   = is_array( $first ) && isset( $first['notice'] ) ? $first['notice'] : $first;
				$notice = is_scalar( $text ) ? wp_strip_all_tags( (string) $text ) : '';
			}
			// Doğrulayıcıların kuyruğa aldığı sepet iletileri REST yanıtında/oturumda kalmasın.
			if ( function_exists( 'wc_clear_notices' ) ) {
				wc_clear_notices();
			}
		}
		if ( $passed ) {
			return '';
		}
		return '' !== $notice ? $notice : __( 'This donation cannot be started right now.', 'woo-donation-popup' );
	}

	/**
	 * Eski sunucu kuralları (hedef kapalı, en düşük tutar) — sepet akışıyla aynı.
	 *
	 * @param object               $product Ürün.
	 * @param array<string, mixed> $model   Model.
	 * @param float                $amount  Tutar.
	 * @return array{message: string, errors: array<string, string>}
	 */
	private function rule_error( $product, array $model, $amount ) {
		try {
			Campaign_Goal::assert_accepts_donation( $product );
		} catch ( \Exception $e ) {
			return array(
				'message' => $e->getMessage(),
				'errors'  => array(),
			);
		}
		if ( ! empty( $model['allow_custom'] ) ) {
			$min   = method_exists( $product, 'get_meta' ) ? $product->get_meta( '_min_custom_price' ) : '';
			$error = (string) Cart_Hooks::get_donation_amount_error( $amount, $min, (int) $product->get_id(), true, Progress_Currency::get_active_currency() );
			if ( '' !== $error ) {
				return array(
					'message' => $error,
					'errors'  => array( 'amount' => $error ),
				);
			}
		}
		return array(
			'message' => '',
			'errors'  => array(),
		);
	}

	/**
	 * Sipariş planı: kalem tutarı (mağaza para biriminde), adet, bağış verisi.
	 *
	 * @param object               $product   Ürün.
	 * @param array<string, mixed> $model     Model.
	 * @param array<string, mixed> $input     Girdi.
	 * @param array<string, mixed> $validated Field_Validator sonucu.
	 * @return array<string, mixed>
	 */
	private function plan( $product, array $model, array $input, array $validated ) {
		$kind     = isset( $model['kind'] ) ? (string) $model['kind'] : '';
		$decimals = isset( $model['decimals'] ) ? (int) $model['decimals'] : 2;
		$quantity = max( 1, (int) $validated['quantity'] );
		$amount   = (float) $validated['amount'];
		$data     = Cart_Data::donation_data( $model, $input );

		$fee = 0.0;
		if ( ! empty( $input['donation_cover_fee'] ) && 'false' !== $input['donation_cover_fee'] && ! empty( $model['cover_fee'] ) ) {
			$fee = (float) $model['cover_fee'];
			if ( $fee > 0 ) {
				$data['cover_fee']         = '1';
				$data['cover_fee_percent'] = $fee;
			}
		}

		$custom      = ! empty( $model['allow_custom'] ) ? Cart_Data::with_fee( $amount, $fee, $decimals ) : null;
		$active      = Progress_Currency::get_active_currency();
		$line_total  = 0.0;
		$line_values = array( 'donation_data' => $data );
		if ( null !== $custom ) {
			$quantity                    = 1;
			$line_total                  = (float) Progress_Currency::to_store_amount( $custom, $active );
			$line_values['custom_price'] = (float) $custom;
			if ( '' !== $active ) {
				$line_values['wdp_input_currency'] = $active;
			}
		} else {
			$unit       = isset( $model['unit_price'] ) ? (float) $model['unit_price'] : 0.0;
			$line_total = Cart_Data::with_fee( $unit, $fee, $decimals ) * $quantity;
		}
		$line_total = (float) wc_format_decimal( $line_total, $decimals );

		if ( '' !== $kind ) {
			$line_values['donation_panel_kind'] = sanitize_key( $kind );
		}
		$type = isset( $input['donation_type'] ) && is_scalar( $input['donation_type'] ) ? sanitize_key( (string) $input['donation_type'] ) : '';
		if ( '' !== $type && ! in_array( $type, array_column( isset( $model['types'] ) && is_array( $model['types'] ) ? $model['types'] : array(), 'value' ), true ) ) {
			$type = '';
		}
		if ( '' !== $type ) {
			$line_values['donation_panel_type'] = $type;
		}

		return array(
			'total'       => $line_total,
			'quantity'    => $quantity,
			'values'      => $line_values,
			'data'        => $data,
			'fingerprint' => array( (int) $product->get_id(), $line_total, Progress_Currency::get_base_currency(), $quantity, $data, $type ),
		);
	}

	/**
	 * Siparişi oluşturur.
	 *
	 * @param object               $product     Ürün.
	 * @param array<string, mixed> $plan        Plan.
	 * @param string               $key_hash    Anahtar karması.
	 * @param string               $fingerprint İçerik parmak izi.
	 * @return \WC_Order|\WP_Error
	 */
	private function create( $product, array $plan, $key_hash, $fingerprint ) {
		$order = wc_create_order(
			array(
				'status'      => 'pending',
				'customer_id' => get_current_user_id(),
				'created_via' => 'donation_panel_direct',
			)
		);
		if ( is_wp_error( $order ) ) {
			return $order;
		}
		// Tutar mağaza ana birimine çevrilerek hesaplandı (Progress_Currency::to_store_amount); sipariş de o birimde.
		$order->set_currency( Progress_Currency::get_base_currency() );

		$item = new \WC_Order_Item_Product();
		$item->set_product( $product );
		$item->set_quantity( (int) $plan['quantity'] );
		$item->set_subtotal( (string) $plan['total'] );
		$item->set_total( (string) $plan['total'] );
		$order->add_item( $item );

		// Sepet akışıyla aynı kanca: bağış verisi tek yazıcıdan (Donation_Order_Meta + Order_Meta_Keys) sipariş kalemine yazılır.
		/** This action is documented in woocommerce/includes/class-wc-checkout.php. */
		do_action( 'woocommerce_checkout_create_order_line_item', $item, 'donation_panel_direct', $plan['values'], $order ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

		$this->fill_customer( $order, (array) $plan['data'] );
		$order->set_customer_ip_address( \WC_Geolocation::get_ip_address() );
		$order->set_customer_user_agent( wc_get_user_agent() );
		$order->update_meta_data( self::FLAG_META, 'yes' );
		$order->update_meta_data( self::KEY_META, $key_hash );
		$order->update_meta_data( self::FINGERPRINT_META, $fingerprint );
		$order->calculate_totals( true );
		$order->add_order_note( __( 'Direct donation started. Waiting for payment.', 'woo-donation-popup' ) );
		$order->save();

		// Bekleyen sipariş stoğu rezerve eder (WooCommerce ödeme akışıyla aynı); yetmiyorsa sipariş açılmaz.
		if ( function_exists( 'wc_reserve_stock_for_order' ) ) {
			try {
				wc_reserve_stock_for_order( $order );
			} catch ( \Exception $e ) {
				$order->delete( true );
				return new \WP_Error( 'donation_panel_direct_stock', $e->getMessage() );
			}
		}

		Direct_Cleanup::schedule();
		return $order;
	}

	/**
	 * Fatura alanlarını bağışçının yazdığından doldurur (hiçbir alan silinmez/maskelenmez).
	 *
	 * @param \WC_Order            $order Sipariş.
	 * @param array<string, mixed> $data  Bağış verisi.
	 * @return void
	 */
	private function fill_customer( $order, array $data ) {
		$name = isset( $data['full_name'] ) ? trim( (string) $data['full_name'] ) : '';
		if ( '' !== $name ) {
			$pos = strrpos( $name, ' ' );
			if ( false === $pos ) {
				$order->set_billing_first_name( $name );
			} else {
				$order->set_billing_first_name( trim( substr( $name, 0, $pos ) ) );
				$order->set_billing_last_name( trim( substr( $name, $pos + 1 ) ) );
			}
		}
		$email = isset( $data['email'] ) ? (string) $data['email'] : '';
		if ( '' === $email ) {
			$user  = function_exists( 'wp_get_current_user' ) ? wp_get_current_user() : null;
			$email = $user && $user->exists() ? (string) $user->user_email : '';
		}
		if ( '' !== $email ) {
			$order->set_billing_email( $email );
		}
		if ( ! empty( $data['phone'] ) ) {
			$order->set_billing_phone( (string) $data['phone'] );
		}
	}

	/**
	 * Aynı anahtarın etkin siparişi (iptal/iade edilmiş olanlar yok sayılır: yeniden denemeye izin verir).
	 *
	 * @param string $key_hash Anahtar karması.
	 * @return \WC_Order|null
	 */
	private function find( $key_hash ) {
		$orders = wc_get_orders(
			array(
				'limit'      => 1,
				'orderby'    => 'date',
				'order'      => 'DESC',
				'status'     => array( 'pending', 'failed', 'on-hold', 'processing', 'completed' ),
				'meta_query' => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- tek anahtarlı, indeksli arama.
					array(
						'key'   => self::KEY_META,
						'value' => $key_hash,
					),
				),
			)
		);
		return ! empty( $orders ) && $orders[0] instanceof \WC_Order ? $orders[0] : null;
	}

	/**
	 * Sonuç: durum ödeme bekliyorsa order-pay, ödenmişse teşekkür bağlantısı.
	 *
	 * @param \WC_Order $order  Sipariş.
	 * @param bool      $reused Mevcut sipariş mi.
	 * @return array{ok: bool, status: int, message: string, errors: array<string, string>, order: \WC_Order, reused: bool, code: string}
	 */
	private function done( $order, $reused ) {
		return array(
			'ok'      => true,
			'status'  => 200,
			'message' => '',
			'errors'  => array(),
			'order'   => $order,
			'reused'  => (bool) $reused,
			'code'    => '',
		);
	}

	/**
	 * Hata sonucu.
	 *
	 * @param int                   $status  HTTP durumu.
	 * @param string                $message İleti.
	 * @param string                $code    Makine kodu.
	 * @param array<string, string> $errors  Alan hataları.
	 * @return array{ok: bool, status: int, message: string, errors: array<string, string>, order: null, reused: bool, code: string}
	 */
	private function fail( $status, $message, $code, array $errors = array() ) {
		return array(
			'ok'      => false,
			'status'  => (int) $status,
			'message' => (string) $message,
			'errors'  => $errors,
			'order'   => null,
			'reused'  => false,
			'code'    => (string) $code,
		);
	}

	/**
	 * Atomik kilit (`add_option` eşsiz ad: ikinci eşzamanlı çağrı başarısız olur).
	 *
	 * @param string $key_hash Anahtar karması.
	 * @return bool
	 */
	private function acquire( $key_hash ) {
		$name = self::GUARD_PREFIX . $key_hash;
		if ( add_option( $name, time(), '', false ) ) {
			return true;
		}
		$since = (int) get_option( $name, 0 );
		if ( $since > 0 && ( time() - $since ) > self::LOCK_TTL ) {
			delete_option( $name );
			return (bool) add_option( $name, time(), '', false );
		}
		return false;
	}

	/**
	 * Kilidi bırakır.
	 *
	 * @param string $key_hash Anahtar karması.
	 * @return void
	 */
	private function release( $key_hash ) {
		delete_option( self::GUARD_PREFIX . $key_hash );
	}
}

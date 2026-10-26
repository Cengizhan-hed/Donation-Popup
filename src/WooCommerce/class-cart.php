<?php
/**
 * Sepet köprüsü: bağışı WooCommerce sepetine ekler ve Store API uzantısını (`donation-panel`) kaydeder.
 *
 * - `add_item()`: doğrulama (Field_Validator) -> eski sepet öğesi sözleşmesiyle `WC_Cart::add_to_cart`.
 *   Fiyat, `custom_price` olarak sepet öğesine yazılır; fiyatı sepette uygulayan/dönüştüren yol mevcut
 *   `woocommerce_before_calculate_totals` kancasıdır (bu sınıf fiyat atamaz/dönüştürmez).
 * - Store API: sepet öğesi şemasına kişi verisiz özet (`extensions['donation-panel']`) ve
 *   `/cart/extensions` ile ithaf/not/anonim güncelleme.
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce;

use DonationPanel\Domain\Campaign_Goal;
use DonationPanel\Domain\Progress_Currency;
use DonationPanel\Modules\Experiences\Field_Validator;

defined( 'ABSPATH' ) || exit;

/**
 * Cart.
 */
final class Cart {

	const EXTENSION_NAMESPACE = 'donation-panel';

	/**
	 * Kancaları kaydeder.
	 *
	 * @return void
	 */
	public function register() {
		if ( did_action( 'woocommerce_blocks_loaded' ) ) {
			$this->register_store_api();
			return;
		}
		add_action( 'woocommerce_blocks_loaded', array( $this, 'register_store_api' ) );
	}

	/**
	 * Store API uç verisi + güncelleme geri çağrısı.
	 *
	 * @return void
	 */
	public function register_store_api() {
		if ( function_exists( 'woocommerce_store_api_register_endpoint_data' ) ) {
			$endpoint = class_exists( '\Automattic\WooCommerce\StoreApi\Schemas\V1\CartItemSchema' )
				? \Automattic\WooCommerce\StoreApi\Schemas\V1\CartItemSchema::IDENTIFIER
				: 'cart-item';
			woocommerce_store_api_register_endpoint_data(
				array(
					'endpoint'        => $endpoint,
					'namespace'       => self::EXTENSION_NAMESPACE,
					'data_callback'   => array( $this, 'store_api_data' ),
					'schema_callback' => array( $this, 'store_api_schema' ),
					'schema_type'     => ARRAY_A,
				)
			);
		}
		if ( function_exists( 'woocommerce_store_api_register_update_callback' ) ) {
			woocommerce_store_api_register_update_callback(
				array(
					'namespace' => self::EXTENSION_NAMESPACE,
					'callback'  => array( $this, 'store_api_update' ),
				)
			);
		}
	}

	/**
	 * Store API sepet öğesi verisi (kişi verisi içermez).
	 *
	 * @param array<string, mixed> $cart_item Sepet öğesi.
	 * @return array<string, mixed>
	 */
	public function store_api_data( $cart_item ) {
		return Cart_Data::public_summary( is_array( $cart_item ) ? $cart_item : array() );
	}

	/**
	 * Store API şeması.
	 *
	 * @return array<string, mixed>
	 */
	public function store_api_schema() {
		$flag = static function ( $description ) {
			return array(
				'description' => $description,
				'type'        => 'boolean',
				'context'     => array( 'view', 'edit' ),
				'readonly'    => true,
			);
		};
		return array(
			'is_donation'    => $flag( 'Whether the line is a donation.' ),
			'anonymous'      => $flag( 'Whether the donor asked to stay anonymous.' ),
			'has_dedication' => $flag( 'Whether a dedication was entered.' ),
			'has_note'       => $flag( 'Whether a note was entered.' ),
			'type'           => array(
				'description' => 'Donation type.',
				'type'        => 'string',
				'context'     => array( 'view', 'edit' ),
				'readonly'    => true,
			),
		);
	}

	/**
	 * Store API `/cart/extensions` güncellemesi: `{ key, dedication?, note?, anonymous? }`.
	 *
	 * @param array<string, mixed> $data Gelen veri.
	 * @return void
	 * @throws \Exception Geçersiz satır.
	 */
	public function store_api_update( $data ) {
		$data = is_array( $data ) ? $data : array();
		$key  = isset( $data['key'] ) && is_scalar( $data['key'] ) ? (string) $data['key'] : '';
		$cart = function_exists( 'WC' ) && WC() ? WC()->cart : null;
		if ( '' === $key || ! $cart || ! isset( $cart->cart_contents[ $key ]['donation_data'] ) ) {
			$this->fail( 'donation_panel_cart_item_invalid', 'Donation line not found.' );
		}
		$cart->cart_contents[ $key ]['donation_data'] = Cart_Data::apply_update( (array) $cart->cart_contents[ $key ]['donation_data'], $data );
		if ( method_exists( $cart, 'set_session' ) ) {
			$cart->set_session();
		}
	}

	/**
	 * Bağışı sepete ekler.
	 *
	 * @param object               $cart    WC_Cart benzeri (add_to_cart, get_cart, remove_cart_item, get_cart_contents_count).
	 * @param object               $product WC_Product benzeri (get_id).
	 * @param array<string, mixed> $model   Form modeli (Form_Context).
	 * @param array<string, mixed> $input   İstek girdisi (`amount`, `quantity`, `share_count`, `shareholders`, `donation_*`, `addon_*`, `donation_type`, `submission_key`).
	 * @return array{ok: bool, status: int, message: string, errors: array<string, string>, cart_item_key: string, cart_count: int}
	 */
	public function add_item( $cart, $product, array $model, array $input ) {
		$product_id = (int) $product->get_id();

		if ( ! empty( $model['closed'] ) ) {
			$closed = isset( $model['closed_message'] ) && '' !== $model['closed_message'] ? (string) $model['closed_message'] : __( 'This campaign is no longer accepting donations.', 'woo-donation-popup' );
			return $this->result( false, 409, $closed );
		}

		$validated = Field_Validator::validate( $model, $input );
		if ( empty( $validated['valid'] ) ) {
			return $this->result( false, 400, __( 'Please check the highlighted fields.', 'woo-donation-popup' ), (array) $validated['errors'] );
		}
		$amount   = (float) $validated['amount'];
		$quantity = max( 1, (int) $validated['quantity'] );
		$kind     = isset( $model['kind'] ) ? (string) $model['kind'] : '';

		$rule = $this->legacy_rule_error( $product, $model, $amount );
		if ( '' !== $rule['message'] ) {
			return $this->result( false, 400, $rule['message'], $rule['errors'] );
		}

		$donation_data = Cart_Data::donation_data( $model, $input );
		$submission    = isset( $input['submission_key'] ) && is_scalar( $input['submission_key'] ) ? Cart_Data::text( (string) $input['submission_key'], 100 ) : '';

		if ( '' !== $submission ) {
			foreach ( $cart->get_cart() as $existing_key => $existing ) {
				if ( isset( $existing['unique_submission_key'] ) && $existing['unique_submission_key'] === $submission ) {
					return $this->result( true, 200, '', array(), (string) $existing_key, (int) $cart->get_cart_contents_count() );
				}
			}
		}

		// İşlem ücreti: yüzde sunucudaki modelden (ürün ayarı) gelir; istemcinin yüzdesi yok sayılır.
		$fee_percent = 0.0;
		if ( ! empty( $input['donation_cover_fee'] ) && 'false' !== $input['donation_cover_fee'] && ! empty( $model['cover_fee'] ) ) {
			$fee_percent = (float) $model['cover_fee'];
			if ( $fee_percent > 0 ) {
				$donation_data['cover_fee']         = '1';
				$donation_data['cover_fee_percent'] = $fee_percent;
			}
		}
		$decimals = isset( $model['decimals'] ) ? (int) $model['decimals'] : 2;

		$custom = ! empty( $model['allow_custom'] ) ? Cart_Data::with_fee( $amount, $fee_percent, $decimals ) : null;
		$type   = isset( $input['donation_type'] ) && is_scalar( $input['donation_type'] ) ? sanitize_key( (string) $input['donation_type'] ) : '';
		// Düzenli bağış seçeneği yalnız sunucudaki modelde tanımlıysa kaydedilir.
		if ( '' !== $type && ! in_array( $type, array_column( isset( $model['types'] ) && is_array( $model['types'] ) ? $model['types'] : array(), 'value' ), true ) ) {
			$type = '';
		}
		$extra = array();
		if ( '' !== $kind ) {
			$extra['donation_panel_kind'] = sanitize_key( $kind );
		}
		if ( null === $custom && $fee_percent > 0 && ! empty( $model['unit_price'] ) ) {
			$extra['wdp_base_unit_price'] = Cart_Data::with_fee( (float) $model['unit_price'], $fee_percent, $decimals );
		}
		$item = Cart_Data::cart_item_data( $donation_data, $custom, $product_id, $submission, $type, $extra );
		if ( isset( $item['custom_price'] ) ) {
			// Yazılan tutarın birimi: sepet fiyatı ana birime çevrilir, gösterim bu birimde kalır (Cart_Hooks::apply_custom_price_to_cart).
			$active = Progress_Currency::get_active_currency();
			if ( '' !== $active ) {
				$item['wdp_input_currency'] = $active;
			}
		}

		if ( 'shares' !== $kind ) {
			foreach ( $cart->get_cart() as $existing_key => $existing ) {
				if ( (int) $existing['product_id'] === $product_id
					&& isset( $existing['donation_data'] )
					&& empty( $existing['wdp_sadaka_donation'] )
					&& Cart_Data::same_donor( (array) $existing['donation_data'], $donation_data )
				) {
					$cart->remove_cart_item( $existing_key );
					break;
				}
			}
		}

		$key = $this->with_plugin_flow(
			static function () use ( $cart, $product_id, $quantity, $item ) {
				return $cart->add_to_cart( $product_id, $quantity, 0, array(), $item );
			}
		);
		if ( ! $key ) {
			return $this->result( false, 400, $this->collect_notice( __( 'An error occurred while adding the product to the cart.', 'woo-donation-popup' ) ) );
		}

		$addon = isset( $validated['addon'] ) && is_array( $validated['addon'] ) ? $validated['addon'] : array();
		if ( ! empty( $addon['active'] ) ) {
			$failure = (string) $this->with_plugin_flow(
				static function () use ( $cart, $product, $donation_data, $addon, $submission, $key ) {
					return Addon_Line::add( $cart, $product, $donation_data, (float) $addon['amount'], $submission, (string) $key );
				}
			);
			if ( '' !== $failure ) {
				$cart->remove_cart_item( $key );
				return $this->result( false, 400, $failure, array( 'addon_amount' => $failure ) );
			}
		}

		return $this->result( true, 200, '', array(), (string) $key, (int) $cart->get_cart_contents_count() );
	}

	/**
	 * Eski sunucu kuralları (hedef kapalı, genel en düşük tutar) — varsa uygulanır.
	 *
	 * @param object               $product Ürün.
	 * @param array<string, mixed> $model   Model.
	 * @param float                $amount  Tutar.
	 * @return array{message: string, errors: array<string, string>}
	 */
	private function legacy_rule_error( $product, array $model, $amount ) {
		$none = array(
			'message' => '',
			'errors'  => array(),
		);
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
			$error = (string) Cart_Hooks::get_donation_amount_error( $amount, $min, (int) $product->get_id(), true );
			if ( '' !== $error ) {
				return array(
					'message' => $error,
					'errors'  => array( 'amount' => $error ),
				);
			}
		}
		return $none;
	}

	/**
	 * Eski sepet doğrulamaları "eklentinin kendi akışı" bayrağını okur (`Cart_Hooks::is_ajax_add_to_cart_flow`);
	 * bayrak `Cart_Hooks::run_in_plugin_flow` ile yalnız `add_to_cart` süresince açılır (`$_POST` değiştirilmez).
	 *
	 * @param callable $callback Sepete ekleme çağrısı.
	 * @return mixed
	 */
	private function with_plugin_flow( $callback ) {
		return Cart_Hooks::run_in_plugin_flow( $callback );
	}

	/**
	 * WooCommerce'in kuyruğa aldığı hata iletisini alır ve kuyruğu temizler.
	 *
	 * @param string $fallback Varsayılan ileti.
	 * @return string
	 */
	private function collect_notice( $fallback ) {
		$message = '';
		if ( function_exists( 'wc_get_notices' ) ) {
			$notices = wc_get_notices( 'error' );
			if ( is_array( $notices ) && ! empty( $notices ) ) {
				$first   = reset( $notices );
				$text    = is_array( $first ) && isset( $first['notice'] ) ? $first['notice'] : $first;
				$message = is_scalar( $text ) ? wp_strip_all_tags( (string) $text ) : '';
			}
			if ( function_exists( 'wc_clear_notices' ) ) {
				wc_clear_notices();
			}
		}
		return '' !== $message ? $message : $fallback;
	}

	/**
	 * Sonuç biçimi.
	 *
	 * @param bool                  $ok      Başarılı mı.
	 * @param int                   $status  HTTP durumu.
	 * @param string                $message İleti.
	 * @param array<string, string> $errors  Alan hataları.
	 * @param string                $key     Sepet öğesi anahtarı.
	 * @param int                   $count   Sepetteki ürün adedi.
	 * @return array{ok: bool, status: int, message: string, errors: array<string, string>, cart_item_key: string, cart_count: int}
	 */
	private function result( $ok, $status, $message, array $errors = array(), $key = '', $count = 0 ) {
		return array(
			'ok'            => (bool) $ok,
			'status'        => (int) $status,
			'message'       => (string) $message,
			'errors'        => $errors,
			'cart_item_key' => (string) $key,
			'cart_count'    => (int) $count,
		);
	}

	/**
	 * Store API istisnası (varsa RouteException) fırlatır.
	 *
	 * @param string $code    Kod.
	 * @param string $message İleti.
	 * @return void
	 * @throws \Exception Her zaman.
	 */
	private function fail( $code, $message ) {
		if ( class_exists( '\Automattic\WooCommerce\StoreApi\Exceptions\RouteException' ) ) {
			throw new \Automattic\WooCommerce\StoreApi\Exceptions\RouteException( $code, $message, 400 ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}
		throw new \Exception( $message ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
	}
}

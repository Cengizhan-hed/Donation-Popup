<?php
/**
 * WooCommerce sepet kancaları; bağış verisi, özel fiyat, hisse kilidi ve görünüm filtreleri.
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce;

use DonationPanel\Domain\Addon_Settings;
use DonationPanel\Domain\Campaign_Goal;
use DonationPanel\Domain\Cover_Fee;
use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Domain\Donation_Type;
use DonationPanel\Domain\Placement_Settings;
use DonationPanel\Domain\Progress_Currency;
use DonationPanel\Support\Price;
use DonationPanel\Support\Security;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Cart_Hooks
 */
class Cart_Hooks {

	/**
	 * Initialize cart hooks
	 */
	public static function init() {
		// Bağış satırına yazılan tutarın para birimi damgası.
		add_filter( 'woocommerce_add_cart_item_data', array( __CLASS__, 'stamp_input_currency' ), 99, 1 );

		// Sepete ekleme öncesi doğrulama (hedefi dolan kampanya, form dışı ekleme).
		add_filter( 'woocommerce_add_to_cart_validation', array( __CLASS__, 'validate_donation_fields' ), 10, 2 );
		add_action( 'woocommerce_store_api_validate_add_to_cart', array( __CLASS__, 'validate_store_api_add_to_cart' ), 10, 2 );

		// Sepet sayfasında bağış bilgilerini göster
		add_filter( 'woocommerce_get_item_data', array( __CLASS__, 'display_donation_data_in_cart' ), 10, 2 );

		// Özel fiyat uygulaması için gerekli hook'lar
		add_action( 'woocommerce_before_calculate_totals', array( __CLASS__, 'apply_custom_price_to_cart' ), 99 );
		add_filter( 'woocommerce_cart_item_price', array( __CLASS__, 'custom_cart_item_price' ), 10, 3 );
		add_filter( 'woocommerce_cart_item_subtotal', array( __CLASS__, 'custom_cart_item_subtotal' ), 10, 3 );

		// Hisseli ürünler için miktar girişini devre dışı bırak
		add_filter( 'woocommerce_cart_item_quantity', array( __CLASS__, 'disable_quantity_input_for_share_items' ), 10, 3 );
		add_filter( 'woocommerce_update_cart_validation', array( __CLASS__, 'prevent_share_items_quantity_update' ), 10, 4 );

		add_filter( 'woocommerce_cart_item_class', array( __CLASS__, 'filter_cart_item_css_class' ), 10, 3 );
		add_filter( 'woocommerce_cart_item_name', array( __CLASS__, 'filter_cart_item_display_name' ), 10, 3 );
		add_filter( 'woocommerce_cart_item_thumbnail', array( __CLASS__, 'filter_cart_item_thumbnail' ), 10, 3 );
	}

	/**
	 * Eklentinin kendi sepete ekleme akışı derinliği (`run_in_plugin_flow`); > 0 iken form dışı ekleme
	 * reddi atlanır.
	 *
	 * @var int
	 */
	private static $plugin_flow_depth = 0;

	/**
	 * Verilen geri çağrıyı "eklentinin kendi sepete ekleme akışı" içinde çalıştırır (yalnız süresince geçerli).
	 *
	 * @param callable $callback Sepete ekleme çağrısı.
	 * @return mixed
	 */
	public static function run_in_plugin_flow( $callback ) {
		++self::$plugin_flow_depth;
		try {
			return call_user_func( $callback );
		} finally {
			--self::$plugin_flow_depth;
		}
	}

	/**
	 * Eklentinin kendi sepete ekleme akışı içinde miyiz (`run_in_plugin_flow` süresince true).
	 *
	 * @return bool
	 */
	public static function in_plugin_flow() {
		return self::$plugin_flow_depth > 0;
	}

	/**
	 * Sepete ekleme öncesi doğrulama: hedefi dolan kampanyayı ve bağış formu dışından eklemeyi reddeder.
	 *
	 * @param bool $passed     Doğrulama sonucu.
	 * @param int  $product_id Ürün kimliği.
	 * @return bool
	 */
	public static function validate_donation_fields( $passed, $product_id ) {
		// Hedef kapatıldıysa (close): yeni eklemeyi reddet.
		if ( $passed ) {
			$passed = Campaign_Goal::filter_add_to_cart_validation( $passed, $product_id );
			if ( ! $passed ) {
				return false;
			}
		}

		// Eklentinin kendi akışı (REST /cart/add) doğrulamayı kendisi yapar.
		if ( self::in_plugin_flow() ) {
			return $passed;
		}

		// WooCommerce'in kendi `?add-to-cart=` yolu: bağış ürünü bağış formu olmadan sepete alınmaz.
		if ( $passed && self::should_reject_native_add_to_cart( $product_id ) ) {
			if ( function_exists( 'wc_add_notice' ) ) {
				wc_add_notice( self::native_add_to_cart_notice(), 'error' );
			}
			return false;
		}

		return $passed;
	}

	/**
	 * Store API (blok sepeti) ile ekleme: aynı kural.
	 *
	 * @param mixed $product Eklenen ürün.
	 * @param mixed $request REST isteği (kullanılmaz).
	 * @return void
	 * @throws \Exception Bağış ürünü form dışından eklenmek istenirse.
	 */
	public static function validate_store_api_add_to_cart( $product, $request = null ) {
		unset( $request );
		if ( self::in_plugin_flow() ) {
			return;
		}
		$id = 0;
		if ( is_object( $product ) && method_exists( $product, 'get_id' ) ) {
			$id = (int) $product->get_id();
		} elseif ( is_numeric( $product ) ) {
			$id = (int) $product;
		}
		if ( ! self::should_reject_native_add_to_cart( $id ) ) {
			return;
		}
		$message = self::native_add_to_cart_notice();
		if ( class_exists( '\\Automattic\\WooCommerce\\StoreApi\\Exceptions\\RouteException' ) ) {
			throw new \Automattic\WooCommerce\StoreApi\Exceptions\RouteException(
				'woocommerce_rest_cart_invalid_product',
				$message, // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- kullanıcıya gösterilen ileti.
				400
			);
		}
		throw new \Exception( $message ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- kullanıcıya gösterilen ileti.
	}

	/**
	 * Notice when a donation product is added without the plugin form.
	 *
	 * @return string
	 */
	public static function native_add_to_cart_notice() {
		return __( 'Please add to cart using the donation form. Donor details are required.', 'woo-donation-popup' );
	}

	/**
	 * Block Woo native add-to-cart (GET ?add-to-cart= / form.cart) for donation products.
	 * Explicit product flag or auto_place=yes (plugin owns the add-to-cart UI).
	 * Does not run for the plugin AJAX flow or donation_modal=1 POST.
	 *
	 * @param int $product_id Product ID.
	 * @return bool
	 */
	public static function should_reject_native_add_to_cart( $product_id ) {
		$product_id = absint( $product_id );
		if ( $product_id <= 0 ) {
			return false;
		}
		if ( ! Donation_Scope::is_donation_product( $product_id ) ) {
			return false;
		}
		$product = function_exists( 'wc_get_product' ) ? wc_get_product( $product_id ) : null;
		$flag    = ( $product && is_object( $product ) ) ? Donation_Scope::product_flag( $product ) : '';
		if ( 'yes' === $flag ) {
			return true;
		}
		return Placement_Settings::value( 'auto_place' ) === 'yes';
	}

	/**
	 * Cover-fee percent for a product. ALWAYS read from product meta (never from the client);
	 * 0 when the product has the fee disabled. Runtime-clamped to 0.5–15.
	 *
	 * @param \WC_Product|int $product Product or ID.
	 * @return float
	 */
	public static function get_product_cover_fee_percent( $product ) {
		if ( is_numeric( $product ) ) {
			$product = wc_get_product( (int) $product );
		}
		if ( ! $product || ! is_object( $product ) || ! method_exists( $product, 'get_meta' ) ) {
			return 0.0;
		}
		if ( 'yes' !== $product->get_meta( '_enable_cover_fee' ) ) {
			return 0.0;
		}
		return Cover_Fee::clamp_percent( $product->get_meta( '_cover_fee_percent' ) );
	}

	/**
	 * Unit amount including the cover fee.
	 *
	 * @param float $amount  Base unit amount.
	 * @param float $percent Fee percent (0 = none).
	 * @return float
	 */
	public static function apply_cover_fee_to_amount( $amount, $percent ) {
		$amount  = (float) $amount;
		$percent = (float) $percent;
		if ( $percent <= 0 || $amount <= 0 ) {
			return $amount;
		}
		$dp = function_exists( 'wc_get_price_decimals' ) ? (int) wc_get_price_decimals() : 2;
		return round( $amount * ( 1 + ( $percent / 100 ) ), max( 0, $dp ) );
	}

	/**
	 * Whether the product form has the quantity selector (fixed type only; default on).
	 *
	 * @param \WC_Product $product Product.
	 * @return bool
	 */
	public static function product_allows_quantity( $product ) {
		if ( ! $product || ! is_object( $product ) || ! method_exists( $product, 'get_meta' ) ) {
			return true;
		}
		if ( 'no' === $product->get_meta( '_enable_quantity' ) ) {
			return false;
		}
		$type = Donation_Type::infer_from_meta(
			array(
				'_allow_custom_price'    => (string) $product->get_meta( '_allow_custom_price' ),
				'_allow_multiple_shares' => (string) $product->get_meta( '_allow_multiple_shares' ),
				'_enable_progress_bar'   => (string) $product->get_meta( '_enable_progress_bar' ),
			)
		);
		return Donation_Type::FIXED === $type;
	}

	/**
	 * Display donation data in cart
	 *
	 * @param array $item_data Item data.
	 * @param array $cart_item  Cart item.
	 * @return array
	 */
	public static function display_donation_data_in_cart( $item_data, $cart_item ) {
		if ( isset( $cart_item['donation_data'] ) ) {
			$donation_data = $cart_item['donation_data'];

			// Çoklu hisse kontrolü
			if ( isset( $donation_data['share_count'] ) && $donation_data['share_count'] > 0 ) {
				$item_data[] = array(
					'key'   => __( 'Share count', 'woo-donation-popup' ),
					'value' => $donation_data['share_count'],
				);

				// Hissedar bilgilerini göster
				if ( isset( $donation_data['shareholders'] ) ) {
					foreach ( $donation_data['shareholders'] as $key => $shareholder ) {
						if ( ! empty( $shareholder['name'] ) ) {
							$item_data[] = array(
								/* translators: %d: shareholder number. */
								'key'   => sprintf( __( 'Shareholder %d', 'woo-donation-popup' ), $key ),
								'value' => $shareholder['name'] . ( ! empty( $shareholder['phone'] ) ? ' (' . $shareholder['phone'] . ')' : '' ),
							);
						}

						if ( ! empty( $shareholder['email'] ) ) {
							$item_data[] = array(
								/* translators: %d: shareholder number. */
								'key'   => sprintf( __( 'Shareholder %d email', 'woo-donation-popup' ), $key ),
								'value' => $shareholder['email'],
							);
						}

						if ( isset( $shareholder['note'] ) && '' !== $shareholder['note'] ) {
							$item_data[] = array(
								/* translators: %d: shareholder number. */
								'key'   => sprintf( __( 'Shareholder %d note', 'woo-donation-popup' ), $key ),
								'value' => $shareholder['note'],
							);
						}
					}
				}
			} else {
				// Normal bağış verilerini göster (bağışçının kendi oturum sepeti — orijinal ad).
				if ( ! empty( $donation_data['full_name'] ) ) {
					$item_data[] = array(
						'key'   => __( 'Donor', 'woo-donation-popup' ),
						'value' => $donation_data['full_name'] . ( ! empty( $donation_data['phone'] ) ? ' (' . $donation_data['phone'] . ')' : '' ),
					);
				}

				if ( ! empty( $donation_data['email'] ) ) {
					$item_data[] = array(
						'key'   => __( 'Email', 'woo-donation-popup' ),
						'value' => $donation_data['email'],
					);
				}

				if ( ! empty( $donation_data['dedication'] ) ) {
					$item_data[] = array(
						'key'   => __( 'Dedication', 'woo-donation-popup' ),
						'value' => $donation_data['dedication'],
					);
				}

				if ( ! empty( $donation_data['anonymous'] ) ) {
					$item_data[] = array(
						'key'   => __( 'Keep my name private', 'woo-donation-popup' ),
						'value' => __( 'Yes', 'woo-donation-popup' ),
					);
				}

				if ( isset( $donation_data['note'] ) && '' !== $donation_data['note'] ) {
					$item_data[] = array(
						'key'   => __( 'Donation note', 'woo-donation-popup' ),
						'value' => $donation_data['note'],
					);
				}
			}
		}

		// 10.29.0 (Y1): işlem ücreti ayrı satır olarak gösterilir (tüm bağış tiplerinde).
		if ( ! empty( $cart_item['donation_data']['cover_fee'] ) && ! empty( $cart_item['donation_data']['cover_fee_percent'] ) ) {
			$pct   = (float) $cart_item['donation_data']['cover_fee_percent'];
			$value = sprintf( '+%%%s', rtrim( rtrim( number_format( $pct, 2, function_exists( 'wc_get_price_decimal_separator' ) ? wc_get_price_decimal_separator() : '.', '' ), '0' ), function_exists( 'wc_get_price_decimal_separator' ) ? wc_get_price_decimal_separator() : '.' ) );
			$unit  = self::resolve_cart_line_unit_price( $cart_item );
			$qty   = max( 1, (int) ( isset( $cart_item['quantity'] ) ? $cart_item['quantity'] : 1 ) );
			if ( null !== $unit && $unit > 0 && $pct > 0 && function_exists( 'wc_price' ) ) {
				$fee_amount = ( $unit - ( $unit / ( 1 + ( $pct / 100 ) ) ) ) * $qty;
				$value     .= ' (' . wp_strip_all_tags( wc_price( $fee_amount ) ) . ')';
			}
			$item_data[] = array(
				'key'   => __( 'Processing fee', 'woo-donation-popup' ),
				'value' => $value,
			);
		}

		return $item_data;
	}

	/**
	 * Apply custom price to cart items
	 *
	 * @param \WC_Cart $cart Cart object.
	 */
	public static function apply_custom_price_to_cart( $cart ) {
		if ( ! $cart || ! is_a( $cart, 'WC_Cart' ) ) {
			return;
		}

		$removed_zero_lines = false;

		foreach ( $cart->get_cart() as $cart_item_key => $cart_item ) {
			if ( ! empty( $cart_item['wdp_sadaka_donation'] ) ) {
				$cart_item = self::sync_addon_line_wc_product( $cart, $cart_item_key, $cart_item );
			}

			if ( empty( $cart_item['data'] ) || ! is_a( $cart_item['data'], 'WC_Product' ) ) {
				continue;
			}

			// Ürün fiyatı mağaza ana para biriminde tutulur; çoklu para birimi eklentisi gösterirken çevirir.
			$line_price = self::resolve_cart_line_store_price( $cart_item );

			if ( self::is_zero_priced_donation_line( $cart_item, $line_price ) ) {
				$cart->remove_cart_item( $cart_item_key );
				$removed_zero_lines = true;
				continue;
			}

			if ( null === $line_price ) {
				continue;
			}

			$line_product = clone $cart_item['data'];
			$line_product->set_price( (string) $line_price );
			$cart->cart_contents[ $cart_item_key ]['data'] = $line_product;
		}

		if ( $removed_zero_lines && function_exists( 'wc_add_notice' ) ) {
			$notice = __( 'The donation line with amount 0 was removed from the cart. Please enter a valid donation amount.', 'woo-donation-popup' );
			if ( ! function_exists( 'wc_has_notice' ) || ! wc_has_notice( $notice, 'error' ) ) {
				wc_add_notice( $notice, 'error' );
			}
		}
	}

	/**
	 * Whether a cart row is a plugin donation line (main, share or addon).
	 *
	 * @param array $cart_item Cart row.
	 * @return bool
	 */
	public static function is_donation_cart_line( array $cart_item ) {
		return isset( $cart_item['donation_data'] )
			|| isset( $cart_item['custom_price'] )
			|| ! empty( $cart_item['wdp_sadaka_donation'] );
	}

	/**
	 * Donation line whose effective unit price is 0 (or not positive) — must not stay in the cart.
	 *
	 * @param array      $cart_item  Cart row.
	 * @param float|null $line_price Resolved unit price (null = falls back to product price).
	 * @return bool
	 */
	public static function is_zero_priced_donation_line( array $cart_item, $line_price ) {
		if ( ! self::is_donation_cart_line( $cart_item ) ) {
			return false;
		}

		if ( null === $line_price ) {
			$product = isset( $cart_item['data'] ) ? $cart_item['data'] : null;
			if ( ! is_object( $product ) || ! method_exists( $product, 'get_price' ) ) {
				return false;
			}
			$line_price = (float) $product->get_price();
		}

		return (float) $line_price <= 0;
	}

	/**
	 * Global minimum donation amount (filterable), never below the product minimum.
	 *
	 * @param mixed $product_min_meta Product `_min_custom_price` meta (may be '' or 0).
	 * @param int   $product_id       Product ID (filter context).
	 * @return float
	 */
	public static function get_min_donation_amount( $product_min_meta = '', $product_id = 0 ) {
		/**
		 * Lowest accepted donation amount when the product has no (or a zero) minimum.
		 *
		 * @param float $min        Default 1.
		 * @param int   $product_id Product ID.
		 */
		$global_min = (float) apply_filters( 'wdp_min_donation_amount', 1.0, absint( $product_id ) ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
		if ( ! is_finite( $global_min ) || $global_min < 0 ) {
			$global_min = 0.0;
		}

		$product_min = ( '' !== $product_min_meta && null !== $product_min_meta && is_numeric( $product_min_meta ) )
			? (float) $product_min_meta
			: 0.0;

		return max( $global_min, $product_min );
	}

	/**
	 * Validation message for a donation amount ('' when valid).
	 *
	 * @param float $amount           Sanitized amount.
	 * @param mixed $product_min_meta Product `_min_custom_price` meta.
	 * @param int   $product_id       Product ID.
	 * @param bool  $plain_text       True for JSON/textContent consumers, false for HTML notices.
	 * @param string $input_currency  Currency the amount was typed in ('' = active currency).
	 * @return string
	 */
	public static function get_donation_amount_error( $amount, $product_min_meta = '', $product_id = 0, $plain_text = true, $input_currency = '' ) {
		$amount = (float) $amount;
		$min    = self::get_min_donation_amount( $product_min_meta, $product_id );

		// Minimum ürün ana biriminde tutulur; bağışçının yazdığı tutar ($input_currency, boşsa etkin birim) ana birime çevrilerek kıyaslanır.
		$amount_store = self::amount_to_store_currency( $amount, $input_currency );
		if ( $amount > 0 && $amount_store >= $min ) {
			return '';
		}

		if ( $min <= 0 ) {
			return __( 'Please enter a donation amount greater than 0.', 'woo-donation-popup' );
		}

		return sprintf(
			/* translators: %s: formatted minimum amount with currency */
			__( 'Please enter %s or more.', 'woo-donation-popup' ),
			self::format_amount_for_message( self::amount_from_store_currency( $min, $input_currency ), $plain_text )
		);
	}

	/**
	 * Bağışçının yazdığı tutarı ($input_currency; boşsa etkin birim) mağaza ana birimine çevirir.
	 * Dönüşüm yoksa (varsayılan) tutar aynen döner.
	 *
	 * @param float  $amount         Tutar.
	 * @param string $input_currency Para birimi kodu ('' = etkin birim).
	 * @return float
	 */
	public static function amount_to_store_currency( $amount, $input_currency = '' ) {
		$from = '' !== (string) $input_currency ? (string) $input_currency : Progress_Currency::get_active_currency();
		return Progress_Currency::to_store_amount( (float) $amount, $from );
	}

	/**
	 * Ana birimdeki tutarı bağışçının birimine ($input_currency; boşsa etkin birim) çevirir (ileti gösterimi).
	 *
	 * @param float  $amount         Ana birimde tutar.
	 * @param string $input_currency Para birimi kodu ('' = etkin birim).
	 * @return float
	 */
	public static function amount_from_store_currency( $amount, $input_currency = '' ) {
		return Progress_Currency::from_store_amount( (float) $amount, (string) $input_currency );
	}

	/**
	 * Currency-aware amount for user messages.
	 *
	 * @param float $amount     Amount.
	 * @param bool  $plain_text Strip HTML (for JSON/textContent).
	 * @return string
	 */
	public static function format_amount_for_message( $amount, $plain_text = true ) {
		$formatted = $plain_text ? Price::format_price_plain( $amount ) : Price::format_price_html( $amount );
		if ( '' !== $formatted ) {
			return $formatted;
		}

		$symbol = function_exists( 'get_woocommerce_currency_symbol' ) ? get_woocommerce_currency_symbol() : '';
		$number = function_exists( 'wc_format_decimal' ) ? wc_format_decimal( $amount ) : (string) $amount;
		return trim( $number . ' ' . html_entity_decode( (string) $symbol, ENT_QUOTES, 'UTF-8' ) );
	}

	/**
	 * Addon satırı için bağlı WC ürün ID'si (görsel / isim).
	 *
	 * @param array $cart_item Cart row.
	 * @return int
	 */
	public static function resolve_addon_line_wc_product_id( array $cart_item ) {
		if ( empty( $cart_item['wdp_sadaka_donation'] ) ) {
			return 0;
		}

		$line_product_id = isset( $cart_item['product_id'] ) ? (int) $cart_item['product_id'] : 0;
		if ( ! empty( $cart_item['wdp_sadaka_linked_wc_product'] ) && $line_product_id > 0 ) {
			return $line_product_id;
		}

		$parent_id = ! empty( $cart_item['wdp_parent_product_id'] )
			? (int) $cart_item['wdp_parent_product_id']
			: 0;

		if ( $parent_id > 0 ) {
			$resolved = (int) Addon_Settings::resolve_addon_wc_product_id( $parent_id );
			if ( $resolved > 0 ) {
				return $resolved;
			}
		}

		return $line_product_id;
	}

	/**
	 * Sepet satırını bağlı Addon WC ürününe hizala (görsel + ürün adı).
	 *
	 * @param \WC_Cart $cart          Cart.
	 * @param string  $cart_item_key Key.
	 * @param array   $cart_item     Row.
	 * @return array
	 */
	private static function sync_addon_line_wc_product( $cart, $cart_item_key, array $cart_item ) {
		$target_id  = self::resolve_addon_line_wc_product_id( $cart_item );
		$current_id = isset( $cart_item['product_id'] ) ? (int) $cart_item['product_id'] : 0;

		if ( $target_id <= 0 || $target_id === $current_id ) {
			return $cart_item;
		}

		$addon_product = wc_get_product( $target_id );
		if ( ! $addon_product || ! $addon_product->exists() ) {
			return $cart_item;
		}

		$cart_item['product_id']                   = $target_id;
		$cart_item['data']                         = $addon_product;
		$cart_item['wdp_sadaka_linked_wc_product'] = true;

		if ( is_array( $cart->cart_contents ) && isset( $cart->cart_contents[ $cart_item_key ] ) ) {
			$cart->cart_contents[ $cart_item_key ]['product_id']                   = $target_id;
			$cart->cart_contents[ $cart_item_key ]['data']                         = $addon_product;
			$cart->cart_contents[ $cart_item_key ]['wdp_sadaka_linked_wc_product'] = true;
		}

		return $cart_item;
	}

	/**
	 * Resolve per-line unit price (main donation vs optional addon line).
	 *
	 * @param array $cart_item Cart row.
	 * @return float|null
	 */
	/**
	 * Public accessor for cart line unit price (used by AJAX cart payload).
	 *
	 * @param array $cart_item Cart row.
	 * @return float|null
	 */
	public static function get_cart_line_unit_price( array $cart_item ) {
		return self::resolve_cart_line_unit_price( $cart_item );
	}

	/**
	 * Sum non-addon cart line totals for a progress-bar product (pending until paid).
	 *
	 * @param int $product_id Product ID.
	 * @return float
	 */
	public static function sum_cart_pending_for_product( $product_id ) {
		$product_id = absint( $product_id );
		if ( $product_id <= 0 || ! function_exists( 'WC' ) ) {
			return 0.0;
		}

		$cart = WC()->cart;
		if ( ! $cart ) {
			return 0.0;
		}

		$pending = 0.0;
		foreach ( $cart->get_cart() as $cart_item ) {
			if ( empty( $cart_item['product_id'] ) || (int) $cart_item['product_id'] !== $product_id ) {
				continue;
			}
			if ( ! empty( $cart_item['wdp_sadaka_donation'] ) ) {
				continue;
			}
			$quantity = max( 1, (int) ( isset( $cart_item['quantity'] ) ? $cart_item['quantity'] : 1 ) );
			$unit     = self::resolve_cart_line_store_price( $cart_item );
			if ( null === $unit ) {
				$product = isset( $cart_item['data'] ) ? $cart_item['data'] : null;
				$unit    = $product ? (float) $product->get_price() : 0.0;
			}
			$pending += ( (float) $unit ) * $quantity;
		}

		return max( 0.0, $pending );
	}

	/**
	 * Satırın gösterim birim fiyatı: ziyaretçinin gördüğü (etkin) para biriminde.
	 * Bağışçının yazdığı tutar yazıldığı birimle aynıysa aynen döner; varsayılan (dönüşüm yok) davranış değişmez.
	 *
	 * @param array $cart_item Cart row.
	 * @return float|null
	 */
	private static function resolve_cart_line_unit_price( array $cart_item ) {
		$raw = self::resolve_cart_line_raw_price( $cart_item );
		if ( null === $raw ) {
			return $raw;
		}
		if ( isset( $cart_item['custom_price'] ) ) {
			$input = isset( $cart_item['wdp_input_currency'] ) ? strtoupper( (string) $cart_item['wdp_input_currency'] ) : '';
			if ( '' === $input || Progress_Currency::get_active_currency() === $input ) {
				return $raw;
			}
			return Progress_Currency::from_store_amount( Progress_Currency::to_store_amount( $raw, $input ) );
		}
		return Progress_Currency::from_store_amount( $raw );
	}

	/**
	 * Satırın mağaza ana para birimindeki birim fiyatı (sepete konan ürün fiyatı).
	 *
	 * @param array $cart_item Cart row.
	 * @return float|null
	 */
	private static function resolve_cart_line_store_price( array $cart_item ) {
		$raw = self::resolve_cart_line_raw_price( $cart_item );
		if ( null === $raw || ! isset( $cart_item['custom_price'] ) ) {
			return $raw;
		}
		$input = isset( $cart_item['wdp_input_currency'] ) ? (string) $cart_item['wdp_input_currency'] : '';
		return Progress_Currency::to_store_amount( $raw, $input );
	}

	/**
	 * Sepet satırına, bağışçı tutarının yazıldığı para birimini işler (yalnız `custom_price` satırları).
	 *
	 * @param array $cart_item_data Cart item data.
	 * @return array
	 */
	public static function stamp_input_currency( $cart_item_data ) {
		if ( isset( $cart_item_data['custom_price'] ) && empty( $cart_item_data['wdp_input_currency'] ) ) {
			$active = Progress_Currency::get_active_currency();
			if ( '' !== $active ) {
				$cart_item_data['wdp_input_currency'] = $active;
			}
		}
		return $cart_item_data;
	}

	/**
	 * Satırın ham birim fiyatı: `custom_price` yazıldığı birimde, diğerleri mağaza ana biriminde.
	 *
	 * @param array $cart_item Cart row.
	 * @return float|null
	 */
	private static function resolve_cart_line_raw_price( array $cart_item ) {
		if ( ! empty( $cart_item['wdp_sadaka_donation'] ) ) {
			if ( ! isset( $cart_item['custom_price'] ) ) {
				return null;
			}
			return self::sanitize_custom_price( $cart_item['custom_price'] );
		}

		if ( isset( $cart_item['custom_price'] ) ) {
			return self::sanitize_custom_price( $cart_item['custom_price'] );
		}

		if ( isset( $cart_item['wdp_base_unit_price'] ) ) {
			$stored = self::sanitize_custom_price( $cart_item['wdp_base_unit_price'] );
			if ( null !== $stored && $stored > 0 ) {
				return $stored;
			}
		}

		$product_id = ! empty( $cart_item['product_id'] ) ? (int) $cart_item['product_id'] : 0;
		if ( $product_id <= 0 ) {
			return null;
		}

		$catalog = wc_get_product( $product_id );
		if ( ! $catalog ) {
			return null;
		}

		$base = (float) $catalog->get_regular_price( 'edit' );
		if ( $base <= 0 ) {
			$base = (float) $catalog->get_price( 'edit' );
		}

		return $base > 0 ? $base : null;
	}

	/**
	 * CSS class for addon rows on cart/checkout tables.
	 *
	 * @param string $classes      Classes.
	 * @param array  $cart_item    Cart item.
	 * @param string $cart_item_key Key.
	 * @return string
	 */
	public static function filter_cart_item_css_class( $classes, $cart_item, $cart_item_key ) {
		unset( $cart_item_key );
		if ( ! empty( $cart_item['wdp_sadaka_donation'] ) ) {
			$classes .= ' wdp-cart-line--addon';
		}
		return trim( $classes );
	}

	/**
	 * Display name suffix for addon cart lines.
	 *
	 * @param string $product_name Name HTML.
	 * @param array  $cart_item    Cart item.
	 * @param string $cart_item_key Key.
	 * @return string
	 */
	public static function filter_cart_item_display_name( $product_name, $cart_item, $cart_item_key ) {
		unset( $cart_item_key );
		if ( empty( $cart_item['wdp_sadaka_donation'] ) ) {
			return $product_name;
		}

		$display_id = self::resolve_addon_line_wc_product_id( $cart_item );
		if ( $display_id > 0 ) {
			$display_product = wc_get_product( $display_id );
			if ( $display_product && $display_product->exists() ) {
				$parent_id = ! empty( $cart_item['wdp_parent_product_id'] )
					? (int) $cart_item['wdp_parent_product_id']
					: (int) ( $cart_item['product_id'] ?? 0 );
				if ( $display_id !== $parent_id || ! empty( $cart_item['wdp_sadaka_linked_wc_product'] ) ) {
					return wp_kses_post( $display_product->get_name() );
				}
			}
		}

		return esc_html__( 'Add-on donation', 'woo-donation-popup' );
	}

	/**
	 * Addon satırında WooCommerce ürün görseli (bağlı Addon ürünü).
	 *
	 * @param string $thumbnail     Default HTML.
	 * @param array  $cart_item     Cart row.
	 * @param string $cart_item_key Key.
	 * @return string
	 */
	public static function filter_cart_item_thumbnail( $thumbnail, $cart_item, $cart_item_key ) {
		unset( $cart_item_key );
		if ( empty( $cart_item['wdp_sadaka_donation'] ) ) {
			return $thumbnail;
		}

		$display_id = self::resolve_addon_line_wc_product_id( $cart_item );
		if ( $display_id <= 0 ) {
			return $thumbnail;
		}

		$display_product = wc_get_product( $display_id );
		if ( ! $display_product || ! $display_product->exists() ) {
			return $thumbnail;
		}

		$parent_id = ! empty( $cart_item['wdp_parent_product_id'] )
			? (int) $cart_item['wdp_parent_product_id']
			: (int) ( $cart_item['product_id'] ?? 0 );

		if ( $display_id === $parent_id && empty( $cart_item['wdp_sadaka_linked_wc_product'] ) ) {
			return $thumbnail;
		}

		$image = $display_product->get_image(
			apply_filters( 'wdp_sadaka_cart_thumbnail_size', 'woocommerce_thumbnail' ), // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
			array(
				'class' => 'wdp-sadaka-cart-thumb',
			)
		);

		return $image ? $image : $thumbnail;
	}

	/**
	 * Sanitize custom price to avoid negative or abusive values.
	 *
	 * @param mixed $value Raw value.
	 * @return float|null
	 */
	private static function sanitize_custom_price( $value ) {

		return Security::sanitize_numeric( $value, 0, 999999 );
	}

	/**
	 * Custom cart item price display
	 *
	 * @param string $price     Price HTML.
	 * @param array  $cart_item Cart item.
	 * @param string $cart_item_key Cart item key.
	 * @return string
	 */
	public static function custom_cart_item_price( $price, $cart_item, $cart_item_key ) {
		unset( $cart_item_key );
		$unit = self::resolve_cart_line_unit_price( $cart_item );
		if ( null !== $unit ) {
			return Price::format_price_html( $unit );
		}

		return $price;
	}

	/**
	 * Custom cart item subtotal display
	 *
	 * @param string $price     Subtotal HTML.
	 * @param array  $cart_item Cart item.
	 * @param string $cart_item_key Cart item key.
	 * @return string
	 */
	public static function custom_cart_item_subtotal( $price, $cart_item, $cart_item_key ) {
		unset( $cart_item_key );
		$unit = self::resolve_cart_line_unit_price( $cart_item );
		if ( null !== $unit ) {
			$quantity = isset( $cart_item['quantity'] ) ? max( 1, (int) $cart_item['quantity'] ) : 1;
			return Price::format_price_html( $unit * $quantity );
		}

		return $price;
	}

	/**
	 * Disable quantity input for share items
	 *
	 * @param string $product_quantity Product quantity HTML.
	 * @param string $cart_item_key    Cart item key.
	 * @param array  $cart_item        Cart item.
	 * @return string
	 */
	public static function disable_quantity_input_for_share_items( $product_quantity, $cart_item_key, $cart_item ) {
		if ( isset( $cart_item['donation_data']['share_count'] ) && $cart_item['donation_data']['share_count'] > 0 ) {
			return '<span>' . $cart_item['quantity'] . '</span>';
		}

		return $product_quantity;
	}

	/**
	 * Prevent quantity update for share items
	 *
	 * @param bool  $passed       Validation result.
	 * @param string $cart_item_key Cart item key.
	 * @param array $values        Values.
	 * @param int   $quantity      Quantity.
	 * @return bool
	 */
	public static function prevent_share_items_quantity_update( $passed, $cart_item_key, $values, $quantity ) {
		unset( $cart_item_key, $quantity );
		if ( isset( $values['donation_data']['share_count'] ) && $values['donation_data']['share_count'] > 0 ) {
			return false; // Prevent quantity update
		}

		return $passed;
	}
}

// Note: init() is called by Woo_Donation_Popup::__construct()

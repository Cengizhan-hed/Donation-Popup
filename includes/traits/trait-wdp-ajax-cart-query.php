<?php
/**
 * Sepet sayacı, mini-cart listesi, satır silme ve bağış meta alt kümesi.
 *
 * @package WooCommerce\Donation_Popup
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

trait WDP_Ajax_Cart_Query_Trait {
	/**
	 * Ön yüz sepet UI için bağış meta verisinin gizlilik-güvenli alt kümesini döndürür.
	 *
	 * @param array $donation_data Sepet satırındaki ham bağış verisi.
	 * @return array
	 */
	private static function sanitize_public_donation_data( $donation_data ) {
		if ( ! is_array( $donation_data ) ) {
			return array();
		}

		$safe = array();
		if ( isset( $donation_data['full_name'] ) ) {
			// Herkese açık mini-sepet alt kümesi: anonimse tam ad sızdırılmaz.
			$safe['full_name'] = class_exists( 'WDP_Donation_Optional_Fields' )
				? WDP_Donation_Optional_Fields::mask_public_donor_name(
					(string) $donation_data['full_name'],
					! empty( $donation_data['anonymous'] )
				)
				: sanitize_text_field( (string) $donation_data['full_name'] );
		}
		if ( isset( $donation_data['share_count'] ) ) {
			$safe['share_count'] = (int) $donation_data['share_count'];
		}
		if ( ! empty( $donation_data['shareholders'] ) && is_array( $donation_data['shareholders'] ) ) {
			$safe['shareholders'] = array();
			foreach ( $donation_data['shareholders'] as $shareholder ) {
				if ( ! is_array( $shareholder ) || empty( $shareholder['name'] ) ) {
					continue;
				}
				$safe['shareholders'][] = array(
					'name' => sanitize_text_field( (string) $shareholder['name'] ),
				);
			}
		}

		return $safe;
	}
	/**
	 * AJAX ile sepet ürün adedini döndürür.
	 */
	public static function get_cart_count() {
		self::run_secured_ajax( 'wdp_get_cart_count', 'get_cart_count', 120, 60 );

		$cart = self::get_wc_cart();
		if ( ! $cart ) {
			WDP_Utils::json_error( __( 'WooCommerce cart object was not found.', 'woo-donation-popup' ) );
			return;
		}

		// PERFORMANCE: Cache cart count for short period (5 seconds) to reduce database queries
		$cache_key    = 'wdp_cart_count_' . self::get_cart_cache_suffix();
		$cached_count = wp_cache_get( $cache_key, 'wdp_cart' );

		if ( false === $cached_count ) {
			$cached_count = (int) $cart->get_cart_contents_count();
			// Cache for 5 seconds (cart changes frequently)
			wp_cache_set( $cache_key, $cached_count, 'wdp_cart', 5 );
		}

		WDP_Utils::json_success(
			array(
				'cart_count' => $cached_count,
			)
		);
	}

	/**
	 * AJAX ile sepet satırlarını (mini-cart UI) döndürür.
	 */
	public static function get_cart_contents() {
		self::run_secured_ajax( 'wdp_get_cart_contents', 'get_cart_contents', 120, 60 );

		$cart = self::get_wc_cart();
		if ( ! $cart ) {
			WDP_Utils::json_error( __( 'WooCommerce cart object was not found.', 'woo-donation-popup' ) );
			return;
		}

		// PERFORMANCE: Cache cart contents for short period (3 seconds)
		$cache_key    = 'wdp_cart_contents_' . self::get_cart_cache_suffix();
		$cached_items = wp_cache_get( $cache_key, 'wdp_cart' );

		if ( false === $cached_items ) {
			$cached_items = self::get_cart_items();
			// Cache for 3 seconds (cart changes frequently)
			wp_cache_set( $cache_key, $cached_items, 'wdp_cart', 3 );
		}

		WDP_Utils::json_success(
			array(
				'items'      => $cached_items,
				'cart_count' => (int) $cart->get_cart_contents_count(),
			)
		);
	}

	/**
	 * Get cart items formatted for response
	 *
	 * @return array
	 */
	private static function get_cart_items() {
		$cart = self::get_wc_cart();
		if ( ! $cart ) {
			return array();
		}

		$items = array();

		// PERFORMANCE: Get cart items once (avoid multiple calls)
		$cart_items = $cart->get_cart();

		foreach ( $cart_items as $cart_item_key => $cart_item ) {
			$product = $cart_item['data'];

			if ( ! $product ) {
				continue;
			}

			$quantity   = max( 1, (int) $cart_item['quantity'] );
			$unit_price = class_exists( 'WDP_Cart' ) ? WDP_Cart::get_cart_line_unit_price( $cart_item ) : null;
			if ( null === $unit_price ) {
				$unit_price = (float) $product->get_price();
			}
			$line_total    = $unit_price * $quantity;
			$is_addon_line = ! empty( $cart_item['wdp_sadaka_donation'] );
			if ( $is_addon_line && class_exists( 'WDP_Cart' ) ) {
				$display_id = WDP_Cart::resolve_addon_line_wc_product_id( $cart_item );
				$parent_id  = ! empty( $cart_item['wdp_parent_product_id'] )
					? (int) $cart_item['wdp_parent_product_id']
					: (int) $cart_item['product_id'];
				if ( $display_id > 0 && ( $display_id !== $parent_id || ! empty( $cart_item['wdp_sadaka_linked_wc_product'] ) ) ) {
					$display_product = wc_get_product( $display_id );
					$product_name    = ( $display_product && $display_product->exists() )
						? wp_strip_all_tags( (string) $display_product->get_name() )
						: __( 'Charity donation', 'woo-donation-popup' );
				} else {
					$product_name = __( 'Charity donation', 'woo-donation-popup' );
				}
			} else {
				$product_name = wp_strip_all_tags( (string) $product->get_name() );
			}

			$item_data = array(
				'key'                => $cart_item_key,
				'product_id'         => $cart_item['product_id'],
				'product_name'       => $product_name,
				'quantity'           => $quantity,
				'price'              => $unit_price,
				'line_total'         => $line_total,
				'price_html'         => WDP_Utils::format_price_html( $line_total ),
				'price_plain'        => WDP_Utils::format_price_plain( $line_total ),
				'is_sadaka_donation' => $is_addon_line,
				'line_kind'          => $is_addon_line ? 'sadaka' : 'donation',
			);

			// Meta veriler (donation data vb.)
			if ( isset( $cart_item['donation_data'] ) ) {
				$safe_donation_data = self::sanitize_public_donation_data( $cart_item['donation_data'] );
				if ( ! empty( $safe_donation_data ) ) {
					$item_data['donation_data'] = $safe_donation_data;
				}

				// Meta verileri formatla (gösterim için)
				$meta = array();
				if ( isset( $safe_donation_data['full_name'] ) ) {
					$meta[] = array(
						'key'   => __( 'Full name', 'woo-donation-popup' ),
						'value' => $safe_donation_data['full_name'],
					);
				}
				if ( isset( $safe_donation_data['share_count'] ) ) {
					$meta[] = array(
						'key'   => __( 'Number of shares', 'woo-donation-popup' ),
						'value' => $safe_donation_data['share_count'],
					);
				}
				if ( isset( $safe_donation_data['shareholders'] ) && is_array( $safe_donation_data['shareholders'] ) ) {
					foreach ( $safe_donation_data['shareholders'] as $index => $shareholder ) {
						if ( isset( $shareholder['name'] ) && $shareholder['name'] !== '' ) {
							$meta[] = array(
								'key'   => sprintf( __( 'Shareholder %d', 'woo-donation-popup' ), (int) $index + 1 ),
								'value' => $shareholder['name'],
							);
						}
					}
				}

				if ( ! empty( $meta ) ) {
					$item_data['meta'] = $meta;
				}
			}

			if ( isset( $cart_item['custom_price'] ) ) {
				$item_data['custom_price'] = floatval( $cart_item['custom_price'] );
			}

			$items[] = $item_data;
		}

		return $items;
	}

	/**
	 * Remove cart item via AJAX
	 *
	 * @since 10.0
	 * @return void
	 */
	public static function remove_cart_item() {
		self::run_secured_ajax( 'wdp_remove_cart_item', 'remove_cart_item', 40, 60 );

		$cart = self::get_wc_cart();
		if ( ! $cart ) {
			WDP_Utils::json_error( __( 'WooCommerce cart object was not found.', 'woo-donation-popup' ) );
			return;
		}

		try {
			// Get cart item key
			$cart_item_key = isset( $_POST['cart_item_key'] ) ? sanitize_text_field( wp_unslash( $_POST['cart_item_key'] ) ) : '';

			if ( empty( $cart_item_key ) ) {
				throw new WDP_Validation_Exception( __( 'Cart item key was not found.', 'woo-donation-popup' ) );
			}

			$target_item = $cart->get_cart_item( $cart_item_key );
			if ( ! $target_item ) {
				throw new WDP_Exception( __( 'The cart item could not be removed.', 'woo-donation-popup' ) );
			}

			if ( empty( $target_item['wdp_sadaka_donation'] ) ) {
				foreach ( $cart->get_cart() as $linked_key => $linked_item ) {
					if ( empty( $linked_item['wdp_sadaka_donation'] ) ) {
						continue;
					}
					if ( isset( $linked_item['wdp_parent_cart_item_key'] ) && $linked_item['wdp_parent_cart_item_key'] === $cart_item_key ) {
						$cart->remove_cart_item( $linked_key );
					}
				}
			}

			$removed = $cart->remove_cart_item( $cart_item_key );

			if ( ! $removed ) {
				throw new WDP_Exception( __( 'The cart item could not be removed.', 'woo-donation-popup' ) );
			}

			if ( method_exists( $cart, 'calculate_totals' ) ) {
				$cart->calculate_totals();
			}

			// Clear all cart cache variations
			self::clear_cart_cache();
			wp_cache_delete( 'wdp_cart_items_' . $cart->get_cart_hash(), 'wdp_cart' );
			wp_cache_delete( 'wdp_cart_count_' . $cart->get_cart_hash(), 'wdp_cart' );

			// Get updated cart items
			$items              = self::get_cart_items();
			$removed_product_id = ! empty( $target_item['product_id'] ) ? absint( $target_item['product_id'] ) : 0;
			$pending_in_cart    = ( $removed_product_id > 0 && class_exists( 'WDP_Cart' ) )
				? (float) WDP_Cart::sum_cart_pending_for_product( $removed_product_id )
				: 0.0;

			WDP_Utils::json_success(
				array(
					'message'         => __( 'Cart item removed.', 'woo-donation-popup' ),
					'items'           => $items,
					'cart_count'      => (int) $cart->get_cart_contents_count(),
					'product_id'      => $removed_product_id,
					'pending_in_cart' => $pending_in_cart,
				)
			);

		} catch ( WDP_Security_Exception $e ) {
			WDP_Utils::json_error( $e, array( 'code' => 'security_error' ) );
		} catch ( WDP_Validation_Exception $e ) {
			WDP_Utils::json_error( $e, array( 'code' => 'validation_error' ) );
		} catch ( WDP_Exception $e ) {
			WDP_Utils::json_error( $e, array( 'code' => 'general_error' ) );
		} catch ( Exception $e ) {
			WDP_Utils::json_error(
				__( 'An unexpected error occurred.', 'woo-donation-popup' ),
				array(
					'code'        => 'unknown_error',
					'http_status' => 500,
				)
			);
		}
	}
}

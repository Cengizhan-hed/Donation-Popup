<?php
/**
 * AJAX sepete ekleme; bağış doğrulama, özel fiyat ve güvenli sepet ekleme mantığı.
 *
 * @package WooCommerce\Donation_Popup
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

trait WDP_Ajax_Cart_Add_Trait {
	/**
	 * AJAX ile ürünü sepete ekler (tekli veya çoklu hisse).
	 *
	 * Hız sınırı, alan doğrulama ve güvenlik kontrolleri içerir.
	 *
	 * @throws WDP_Security_Exception Nonce veya limit hatası.
	 * @throws WDP_Validation_Exception Eksik/geçersiz alan veya fiyat.
	 * @throws WDP_Product_Not_Found_Exception Ürün bulunamazsa.
	 * @throws WDP_Cart_Exception Sepet işlemi başarısızsa.
	 */
	public static function ajax_add_to_cart() {
		try {
			self::run_secured_ajax( 'wdp_ajax_add_to_cart', 'add_to_cart', 20, 60 );

			// SECURITY: Sanitize and validate inputs with length limits
			$product_id = 0;
			if ( isset( $_POST['wdp_product_id'] ) ) {
				$product_id = absint( wp_unslash( $_POST['wdp_product_id'] ) );
			}
			if ( ! $product_id && isset( $_POST['add-to-cart'] ) ) {
				$product_id = absint( wp_unslash( $_POST['add-to-cart'] ) );
			}
			$quantity = isset( $_POST['quantity'] ) ? wc_stock_amount( wp_unslash( $_POST['quantity'] ) ) : 1;
			// SECURITY: Limit quantity to prevent abuse
			if ( $quantity > 1000 ) {
				$quantity = 1000;
			}
			$variation_id     = isset( $_POST['variation_id'] ) ? absint( wp_unslash( $_POST['variation_id'] ) ) : 0;
			$custom_price_raw = isset( $_POST['custom_price'] ) ? wc_clean( wp_unslash( $_POST['custom_price'] ) ) : '';
			// SECURITY: Limit custom price length
			if ( strlen( $custom_price_raw ) > 20 ) {
				$custom_price_raw = substr( $custom_price_raw, 0, 20 );
			}
			$unique_submission_key = isset( $_POST['unique_submission_key'] ) ? WDP_Security::sanitize_text( wp_unslash( $_POST['unique_submission_key'] ), 100 ) : '';
			$timestamp             = isset( $_POST['timestamp'] ) ? absint( wp_unslash( $_POST['timestamp'] ) ) : 0;
			// SECURITY: Validate timestamp (not too old, not in future)
			$current_time = time();
			if ( $timestamp > 0 && ( $timestamp < ( $current_time - 3600 ) || $timestamp > ( $current_time + 60 ) ) ) {
				$timestamp = $current_time;
			}
			$is_direct_share_form = ! empty( $_POST['is_direct_share_form'] ) && '1' === wp_unslash( $_POST['is_direct_share_form'] );
			$custom_price_type    = isset( $_POST['custom_price_type'] ) ? WDP_Security::sanitize_text( wp_unslash( $_POST['custom_price_type'] ), 50 ) : '';

			if ( ! $product_id ) {
				throw new WDP_Validation_Exception( __( 'Invalid product ID.', 'woo-donation-popup' ) );
			}

			$cart = self::get_wc_cart();
			if ( ! $cart ) {
				throw new WDP_Cart_Exception( __( 'WooCommerce cart object was not found.', 'woo-donation-popup' ) );
			}

			$product = wc_get_product( $product_id );

			if ( ! $product ) {
				throw new WDP_Product_Not_Found_Exception( $product_id );
			}

			if ( class_exists( 'WDP_Campaign_Goal' ) ) {
				WDP_Campaign_Goal::assert_accepts_donation( $product );
			}

			$donation_data = array();
			$share_count   = isset( $_POST['share_count'] ) ? absint( wp_unslash( $_POST['share_count'] ) ) : 0;

			if ( $share_count > 0 ) {
				$max_share_count = 50;
				if ( $product && method_exists( $product, 'get_meta' ) ) {
					$configured_max = absint( $product->get_meta( '_max_shares' ) );
					if ( $configured_max >= 1 ) {
						$max_share_count = min( $configured_max, 50 );
					}
				}

				if ( $share_count > $max_share_count ) {
					throw new WDP_Validation_Exception( __( 'Maximum number of shares exceeded', 'woo-donation-popup' ) );
				}

				$parsed = WDP_Cart::parse_shareholders_from_request(
					$_POST,
					$share_count,
					array(
						'max_shares'      => $max_share_count,
						'require_contact' => true,
					)
				);

				if ( ! empty( $parsed['missing_fields'] ) ) {
					throw new WDP_Validation_Exception(
						__( 'Please fill in all required fields: ', 'woo-donation-popup' ) . implode( ', ', $parsed['missing_fields'] ),
						$parsed['missing_field_keys']
					);
				}

				$share_count                  = $parsed['share_count'];
				$donation_data['share_count'] = $share_count;
				if ( ! empty( $parsed['shareholders'] ) ) {
					$donation_data['shareholders'] = $parsed['shareholders'];
				}

				// CRITICAL: Quantity'yi share_count olarak ayarla (hissedar sayısı = sepetteki miktar)
				// Dinamik: Kaç hissedar bilgisi doldurulduysa, o kadar adet ürün sepete eklenecek
				// Örnek: 7 hissedar = 7 adet ürün, fiyat = base_price × 7
				$quantity = max( 1, $share_count );

				WDP_Utils::log(
					array(
						'event'                 => 'ajax_add_to_cart_request_hisseli',
						'product_id'            => $product_id,
						'quantity'              => $quantity,
						'share_count'           => $share_count,
						'custom_price'          => $custom_price_raw,
						'unique_submission_key' => $unique_submission_key,
					)
				);
			} else {
				// Ad Soyad alanını al
				$full_name = isset( $_POST['donation_full_name'] ) ? WDP_Security::sanitize_text( wp_unslash( $_POST['donation_full_name'] ), WDP_Donation_Optional_Fields::NAME_MAX ) : '';
				$phone     = isset( $_POST['donation_phone'] ) ? WDP_Security::sanitize_phone( wp_unslash( $_POST['donation_phone'] ) ) : '';
				$note      = isset( $_POST['donation_note'] )
				? WDP_Security::sanitize_textarea( wp_unslash( $_POST['donation_note'] ), WDP_Donation_Optional_Fields::NOTE_MAX )
				: '';

				if ( '' === $full_name ) {
					throw new WDP_Validation_Exception( __( 'Please enter your full name.', 'woo-donation-popup' ), array( 'donation_full_name' ) );
				}

				if ( '' === $phone ) {
					throw new WDP_Validation_Exception( __( 'Please enter your phone number.', 'woo-donation-popup' ), array( 'donation_phone' ) );
				}

				$donation_data['full_name'] = $full_name;
				$donation_data['phone']     = $phone;

				if ( '' !== $note ) {
					$donation_data['note'] = $note;
				}

				// 10.30.0: e-posta/ithaf/anonim — ürün bağlamında kapalıysa yok say; geçersiz e-posta hata.
				WDP_Donation_Optional_Fields::apply_from_request( $product, wp_unslash( $_POST ), $donation_data );
			}

			// 10.29.0 (Y1/Y2): işlem ücreti tüm tiplerde (özel, kampanya, sabit, hisseli) uygulanır.
			// Yüzde HER ZAMAN ürün meta'sından okunur; istemciden gelen donation_cover_fee_percent yok sayılır.
			$cover_fee_pct = 0.0;
			if ( ! empty( $_POST['donation_cover_fee'] ) ) {
				$cover_fee_pct = WDP_Cart::get_product_cover_fee_percent( $product );
				if ( $cover_fee_pct > 0 ) {
					$donation_data['cover_fee']         = '1';
					$donation_data['cover_fee_percent'] = $cover_fee_pct;
				}
			}

			// 10.29.0 (C): adet seçici kapalıysa (ya da form sabit tutarlı değilse) adet sunucuda 1'e sabitlenir.
			// Hisseli formda adet = hisse sayısıdır, dokunulmaz.
			if ( $share_count <= 0 && ! WDP_Cart::product_allows_quantity( $product ) ) {
				$quantity = 1;
			}

			// PERFORMANCE: Use cached meta data ($product already loaded above).
			$cache_key_meta = 'wdp_product_info_' . $product_id;
			$cached_meta    = wp_cache_get( $cache_key_meta, 'wdp_product_info' );

			if ( false === $cached_meta ) {
				$cached_meta = get_transient( $cache_key_meta );
			}

			if ( false !== $cached_meta ) {
				$allow_custom_price = ! empty( $cached_meta['allow_custom_price'] );
				if ( ! $allow_custom_price && ! empty( $cached_meta['enable_progress_bar'] ) ) {
					$allow_custom_price = true;
				}
			} else {
				$allow_custom_price = $product->get_meta( '_allow_custom_price' ) === 'yes';
				if ( ! $allow_custom_price && $product->get_meta( '_enable_progress_bar' ) === 'yes' ) {
					$allow_custom_price = true;
				}
			}

			$custom_price_value = null;

			if ( $allow_custom_price ) {
				if ( $custom_price_raw === '' ) {
					throw new WDP_Validation_Exception( __( 'Please enter the donation amount.', 'woo-donation-popup' ), array( 'custom_price' ) );
				}

				$parsed_amount = class_exists( 'WDP_Utils' )
					? WDP_Utils::parse_donor_amount( $custom_price_raw )
					: array(
						'ok'     => false,
						'amount' => 0.0,
						'status' => 'invalid',
						'error'  => __( 'Invalid price value.', 'woo-donation-popup' ),
					);
				if ( empty( $parsed_amount['ok'] ) ) {
					$parse_error = isset( $parsed_amount['error'] ) && $parsed_amount['error'] !== ''
						? (string) $parsed_amount['error']
						: __( 'Invalid price value.', 'woo-donation-popup' );
					throw new WDP_Validation_Exception( $parse_error, array( 'custom_price' ) );
				}
				$custom_price_value = WDP_Security::sanitize_numeric( $parsed_amount['amount'], 0, 999999 );

				if ( null === $custom_price_value ) {
					throw new WDP_Validation_Exception( __( 'Invalid price value.', 'woo-donation-popup' ), array( 'custom_price' ) );
				}

				// PERFORMANCE: Use cached meta data if available
				if ( false !== $cached_meta ) {
					$min_price = $cached_meta['min_price'];
				} else {
					$min_price = $product->get_meta( '_min_custom_price' );
				}
				$max_price = 999999; // Reasonable maximum

				// Ürün min'i boş/0 olsa bile tutar > 0 ve global minimumun (wdp_min_donation_amount) üstünde olmalı.
				$amount_error = WDP_Cart::get_donation_amount_error( $custom_price_value, $min_price, $product_id, true );
				if ( '' !== $amount_error ) {
					$effective_min = WDP_Cart::get_min_donation_amount( $min_price, $product_id );
					throw new WDP_Validation_Exception(
						$amount_error,
						array( 'custom_price' => __( 'Minimum price: ', 'woo-donation-popup' ) . WDP_Cart::format_amount_for_message( $effective_min, true ) )
					);
				}

				if ( $custom_price_value > $max_price ) {
					throw new WDP_Validation_Exception(
						sprintf(
							/* translators: %s: formatted maximum amount with currency */
							__( 'Maximum price: %s', 'woo-donation-popup' ),
							WDP_Cart::format_amount_for_message( $max_price, true )
						),
						array( 'custom_price' )
					);
				}

				if ( $cover_fee_pct > 0 && $custom_price_value > 0 ) {
					$custom_price_value = WDP_Cart::apply_cover_fee_to_amount( $custom_price_value, $cover_fee_pct );
				}
			}

			if ( $unique_submission_key && $timestamp ) {
				$current_time = time();

				if ( ( $current_time - $timestamp ) < 30 ) {
					foreach ( $cart->get_cart() as $dup_key => $cart_item ) {
						if ( isset( $cart_item['unique_submission_key'] ) && $cart_item['unique_submission_key'] === $unique_submission_key ) {
							$dup_pid = isset( $cart_item['product_id'] ) ? (int) $cart_item['product_id'] : 0;
							WDP_Utils::json_success(
								array(
									'message'        => __( 'Product is already in the cart', 'woo-donation-popup' ),
									'cart_count'     => (int) $cart->get_cart_contents_count(),
									'checkout_url'   => wc_get_checkout_url(),
									'items'          => self::get_cart_items(),
									'cart_item_key'  => $dup_key,
									'product_id'     => $dup_pid,
								)
							);
						}
					}
				}
			}

			// Aynı ana bağış satırını kaldır (addon satırlarına dokunma).
			foreach ( $cart->get_cart() as $cart_item_key => $cart_item ) {
				if ( ! empty( $cart_item['wdp_sadaka_donation'] ) ) {
					continue;
				}
				if ( (int) $cart_item['product_id'] === $product_id && isset( $cart_item['donation_data'] ) && self::is_same_donation_data( $cart_item['donation_data'], $donation_data ) ) {
					$cart->remove_cart_item( $cart_item_key );
					break;
				}
			}

			$cart_item_data = array(
				'donation_data' => $donation_data,
				'unique_key'    => md5( serialize( array( $product_id, 'main', microtime( true ), wp_rand() ) ) ),
			);

			if ( $unique_submission_key ) {
				$cart_item_data['unique_submission_key'] = $unique_submission_key;
			}

			if ( $allow_custom_price && null !== $custom_price_value ) {
				// CRITICAL: Form'dan gelen custom_price zaten base price (form.js'te hesaplanıyor)
				// Quantity = shareCount olacak ve subtotal = custom_price × quantity olarak hesaplanacak
				$cart_item_data['custom_price'] = $custom_price_value;
			} else {
				// Sabit / hisseli: işlem ücreti birim fiyata eklenir (sepet satırında ayrıca gösterilir).
				$base_unit = WDP_Cart::apply_cover_fee_to_amount( (float) $product->get_price(), $cover_fee_pct );
				if ( $base_unit > 0 ) {
					$cart_item_data['wdp_base_unit_price'] = $base_unit;
				}
			}

			if ( $is_direct_share_form ) {
				$cart_item_data['is_direct_share_form'] = true;

				if ( '' !== $custom_price_type ) {
					$cart_item_data['custom_price_type'] = $custom_price_type;
				}
			}

			// PERFORMANCE: Clear cart cache after adding item
			self::clear_cart_cache();

			$cart_item_key = $cart->add_to_cart( $product_id, $quantity, $variation_id, array(), $cart_item_data );

			if ( ! $cart_item_key ) {
				throw new WDP_Cart_Exception( __( 'An error occurred while adding the product to the cart.', 'woo-donation-popup' ) );
			}

			self::maybe_add_addon_donation_to_cart( $cart, $product, $donation_data, $unique_submission_key, $cart_item_key );

			// PERFORMANCE: Get cart count once
			$cart_count = (int) $cart->get_cart_contents_count();

			// Progress bar için toplam bağış miktarını hesapla
			$total_donation      = 0.0;
			$pending_in_cart     = 0.0;
			$enable_progress_bar = $product->get_meta( '_enable_progress_bar' ) === 'yes';
			if ( $enable_progress_bar ) {
				// Cache'i temizle (yeni bağış eklendi)
				wp_cache_delete( 'wdp_total_donation_' . $product_id, 'wdp_donations' );
				$total_donation  = WDP_Utils::get_total_donation_amount( $product_id );
				$pending_in_cart = class_exists( 'WDP_Cart' )
					? (float) WDP_Cart::sum_cart_pending_for_product( $product_id )
					: 0.0;
			}

			WDP_Utils::json_success(
				array(
					'message'         => __( 'Product added to cart.', 'woo-donation-popup' ),
					'cart_item_key'   => $cart_item_key,
					'cart_count'      => $cart_count,
					'checkout_url'    => wc_get_checkout_url(),
					'items'           => self::get_cart_items(),
					'total_donation'  => $total_donation,
					'pending_in_cart' => $pending_in_cart,
					'product_id'      => $product_id,
				)
			);
		} catch ( WDP_Validation_Exception $e ) {
			WDP_Utils::json_error( $e );
		} catch ( WDP_Security_Exception $e ) {
			WDP_Utils::json_error( $e );
		} catch ( WDP_Cart_Exception $e ) {
			WDP_Utils::json_error( $e );
		} catch ( WDP_Exception $e ) {
			WDP_Utils::json_error( $e );
		} catch ( Exception $e ) {
			WDP_Utils::handle_exception( $e, true );
		}
	}
	/**
	 * Build donation meta for optional addon line item.
	 *
	 * @param array $donation_data Primary donation payload.
	 * @return array
	 */
	private static function build_addon_donation_data( array $donation_data ) {
		$addon_data = array(
			'is_sadaka' => true,
		);

		if ( ! empty( $donation_data['share_count'] ) && ! empty( $donation_data['shareholders'] ) && is_array( $donation_data['shareholders'] ) ) {
			$first = reset( $donation_data['shareholders'] );
			if ( is_array( $first ) ) {
				if ( ! empty( $first['name'] ) ) {
					$addon_data['full_name'] = $first['name'];
				}
				if ( ! empty( $first['phone'] ) ) {
					$addon_data['phone'] = $first['phone'];
				}
			}
			return $addon_data;
		}

		if ( ! empty( $donation_data['full_name'] ) ) {
			$addon_data['full_name'] = $donation_data['full_name'];
		}
		if ( ! empty( $donation_data['phone'] ) ) {
			$addon_data['phone'] = $donation_data['phone'];
		}
		if ( ! empty( $donation_data['note'] ) ) {
			$addon_data['note'] = $donation_data['note'];
		}

		return $addon_data;
	}

	/**
	 * Add separate addon cart line when donor opted in.
	 *
	 * @param WC_Cart     $cart                  Cart.
	 * @param WC_Product  $product               Product.
	 * @param array       $donation_data         Primary donation data.
	 * @param string      $unique_submission_key Submission key.
	 * @return void
	 */
	private static function maybe_add_addon_donation_to_cart( $cart, $product, array $donation_data, $unique_submission_key, $parent_cart_item_key = '' ) {
		if ( ! $cart || ! $product || WDP_Addon_Product_Visibility::get_meta( $product, '_enable_addon_donation' ) !== 'yes' ) {
			return;
		}

		$panel_active = isset( $_POST['sadaka_donation_active'] ) && '1' === wp_unslash( $_POST['sadaka_donation_active'] );
		if ( ! $panel_active ) {
			return;
		}

		$parent_product_id   = (int) $product->get_id();
		$configured_addon_id = WDP_Utils::get_configured_addon_wc_product_id( $product );
		$addon_product_id    = WDP_Utils::resolve_addon_wc_product_id( $product );

		if ( $configured_addon_id <= 0 || $addon_product_id <= 0 ) {
			throw new WDP_Validation_Exception(
				__( 'Add-on donation WooCommerce product was not found. Enter a valid product ID in Success & Mini Cart or the product settings.', 'woo-donation-popup' ),
				array( 'sadaka_custom_price' )
			);
		}

		foreach ( $cart->get_cart() as $existing_key => $existing_item ) {
			if ( empty( $existing_item['wdp_sadaka_donation'] ) ) {
				continue;
			}
			if ( $parent_cart_item_key !== '' ) {
				if ( empty( $existing_item['wdp_parent_cart_item_key'] ) || $existing_item['wdp_parent_cart_item_key'] !== $parent_cart_item_key ) {
					continue;
				}
			} elseif ( ! empty( $existing_item['wdp_parent_product_id'] ) && (int) $existing_item['wdp_parent_product_id'] !== $parent_product_id ) {
				continue;
			} elseif ( empty( $existing_item['wdp_parent_product_id'] ) && (int) $existing_item['product_id'] !== $parent_product_id && (int) $existing_item['product_id'] !== $addon_product_id ) {
				continue;
			}
			$cart->remove_cart_item( $existing_key );
		}

		$fixed_price = WDP_Utils::get_addon_fixed_price( $product );
		$addon_raw   = isset( $_POST['sadaka_custom_price'] ) ? wc_clean( wp_unslash( $_POST['sadaka_custom_price'] ) ) : '';
		if ( strlen( $addon_raw ) > 20 ) {
			$addon_raw = substr( $addon_raw, 0, 20 );
		}
		$min_addon = WDP_Addon_Product_Visibility::get_meta( $product, '_addon_min_price' );
		$min_float = ( $min_addon !== '' && (float) $min_addon > 0 ) ? (float) $min_addon : 0.0;

		$validated = WDP_Utils::validate_addon_amount( $addon_raw, $min_float, $fixed_price );
		if ( empty( $validated['ok'] ) ) {
			throw new WDP_Validation_Exception(
				! empty( $validated['message'] )
					? (string) $validated['message']
					: __( 'Please enter a valid add-on donation amount.', 'woo-donation-popup' ),
				array( 'sadaka_custom_price' )
			);
		}
		$addon_value = (float) $validated['amount'];

		$addon_cart_data = array(
			'donation_data'                => self::build_addon_donation_data( $donation_data ),
			'custom_price'                 => $addon_value,
			'wdp_sadaka_donation'          => true,
			'wdp_parent_product_id'        => $parent_product_id,
			'wdp_sadaka_linked_wc_product' => true,
			'unique_key'                   => md5( serialize( array( $parent_product_id, $addon_product_id, 'sadaka', microtime( true ), wp_rand() ) ) ),
		);

		if ( $parent_cart_item_key !== '' ) {
			$addon_cart_data['wdp_parent_cart_item_key'] = $parent_cart_item_key;
		}

		if ( $unique_submission_key ) {
			$addon_cart_data['unique_submission_key'] = $unique_submission_key . '-sadaka';
		}

		$allow_purchasable = static function ( $purchasable, $check_product ) use ( $addon_product_id ) {
			if ( $purchasable || ! $check_product instanceof WC_Product ) {
				return $purchasable;
			}
			return (int) $check_product->get_id() === (int) $addon_product_id ? true : $purchasable;
		};
		add_filter( 'woocommerce_is_purchasable', $allow_purchasable, 99, 2 );

		$addon_key = $cart->add_to_cart( $addon_product_id, 1, 0, array(), $addon_cart_data );

		remove_filter( 'woocommerce_is_purchasable', $allow_purchasable, 99 );

		if ( ! $addon_key ) {
			throw new WDP_Cart_Exception(
				sprintf(
					/* translators: %d: WooCommerce product ID */
					__( 'The add-on donation could not be added to the cart (product #%d). Make sure the product is published.', 'woo-donation-popup' ),
					$addon_product_id
				)
			);
		}

		if ( method_exists( $cart, 'calculate_totals' ) ) {
			$cart->calculate_totals();
		}
	}

	/**
	 * Check if two donation data are the same
	 *
	 * @param array $data1 First donation data.
	 * @param array $data2 Second donation data.
	 * @return bool
	 */
	private static function is_same_donation_data( $data1, $data2 ) {
		if ( ! empty( $data1['is_sadaka'] ) || ! empty( $data2['is_sadaka'] ) ) {
			return false;
		}

		if ( empty( $data1 ) && empty( $data2 ) ) {
			return true;
		}

		if ( empty( $data1 ) || empty( $data2 ) ) {
			return false;
		}

		// Check share count
		if ( isset( $data1['share_count'] ) && isset( $data2['share_count'] ) ) {
			if ( $data1['share_count'] !== $data2['share_count'] ) {
				return false;
			}

			// If share counts match, check shareholders
			if ( isset( $data1['shareholders'] ) && isset( $data2['shareholders'] ) ) {
				if ( count( $data1['shareholders'] ) !== count( $data2['shareholders'] ) ) {
					return false;
				}

				foreach ( $data1['shareholders'] as $index => $shareholder1 ) {
					if ( ! isset( $data2['shareholders'][ $index ] ) ) {
						return false;
					}

					$shareholder2 = $data2['shareholders'][ $index ];

					if ( ( isset( $shareholder1['name'] ) ? $shareholder1['name'] : '' ) !== ( isset( $shareholder2['name'] ) ? $shareholder2['name'] : '' ) ) {
						return false;
					}

					if ( ( isset( $shareholder1['phone'] ) ? $shareholder1['phone'] : '' ) !== ( isset( $shareholder2['phone'] ) ? $shareholder2['phone'] : '' ) ) {
						return false;
					}

					if ( ( isset( $shareholder1['email'] ) ? $shareholder1['email'] : '' ) !== ( isset( $shareholder2['email'] ) ? $shareholder2['email'] : '' ) ) {
						return false;
					}
				}
			} elseif ( isset( $data1['shareholders'] ) || isset( $data2['shareholders'] ) ) {
				return false;
			}
		} else {
			// Check single donation data
			if ( ( isset( $data1['full_name'] ) ? $data1['full_name'] : '' ) !== ( isset( $data2['full_name'] ) ? $data2['full_name'] : '' ) ) {
				return false;
			}

			if ( ( isset( $data1['phone'] ) ? $data1['phone'] : '' ) !== ( isset( $data2['phone'] ) ? $data2['phone'] : '' ) ) {
				return false;
			}
		}

		return true;
	}
}

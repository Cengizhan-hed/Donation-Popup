<?php
/**
 * get_product_info AJAX; önbellekli ürün meta ve sadaka blok verisi.
 *
 * @package WooCommerce\Donation_Popup
 */
if (!defined("ABSPATH")) { exit; }

trait WDP_Ajax_Product_Trait {
    /** Ürün meta verilerini önbellekleyerek ön yüze JSON döndürür. */
    public static function get_product_info() {
        try {
            self::run_secured_ajax('wdp_get_product_info', 'get_product_info', 60, 60, false);

            $product_id = isset($_POST['product_id']) ? absint(wp_unslash($_POST['product_id'])) : 0;

            if (!$product_id) {
                throw new WDP_Validation_Exception(__('Geçersiz ürün ID', 'woo-donation-popup'));
            }
            
            $product = null;
            // SECURITY: Validate product ID and reuse resolved product instance.
            if (!WDP_Security::validate_product_id($product_id, $product)) {
                throw new WDP_Validation_Exception(__('Geçersiz ürün ID', 'woo-donation-popup'));
            }

            if (!$product) {
                throw new WDP_Product_Not_Found_Exception($product_id);
            }

        // PERFORMANCE: Use object cache if available (faster than transient)
        $cache_key = 'wdp_product_info_' . $product_id;
        $cached_data = wp_cache_get($cache_key, 'wdp_product_info');
        
        if (false === $cached_data) {
            // Fallback to transient if object cache not available
            $cached_data = get_transient($cache_key);
        }
        
        if (false !== $cached_data) {
            // Use cached data
            $allow_custom_price = $cached_data['allow_custom_price'];
            $min_price = $cached_data['min_price'];
            $allow_multiple_shares = $cached_data['allow_multiple_shares'];
            $max_shares = $cached_data['max_shares'];
            $enable_progress_bar = !empty($cached_data['enable_progress_bar']);
            $enable_sadaka_donation = !empty($cached_data['enable_sadaka_donation']);
        } else {
            // PERFORMANCE: Read only required keys (avoids hydrating full meta collection).
            $allow_custom_price = $product->get_meta('_allow_custom_price') === 'yes';
            $min_price = $product->get_meta('_min_custom_price');
            $allow_multiple_shares = $product->get_meta('_allow_multiple_shares') === 'yes';
            $max_shares = $product->get_meta('_max_shares');
            $enable_progress_bar = $product->get_meta('_enable_progress_bar') === 'yes';
            $enable_sadaka_donation = $product->get_meta('_enable_sadaka_donation') === 'yes';
            
            $cache_data = array(
                'allow_custom_price' => $allow_custom_price,
                'min_price' => $min_price,
                'allow_multiple_shares' => $allow_multiple_shares,
                'max_shares' => $max_shares,
                'enable_progress_bar' => $enable_progress_bar,
                'enable_sadaka_donation' => $enable_sadaka_donation,
            );
            
            // PERFORMANCE: Cache in both object cache and transient (fallback)
            wp_cache_set($cache_key, $cache_data, 'wdp_product_info', HOUR_IN_SECONDS);
            set_transient($cache_key, $cache_data, HOUR_IN_SECONDS);
        }

		if ($enable_progress_bar) {
			$allow_custom_price = true;
		}

		if ($allow_custom_price && '' === $min_price) {
			$min_price = '0';
		}

		// Progress forms: floor/default is WooCommerce product price when admin min is 0/empty.
		$progress_min_price = $min_price;
		if ($enable_progress_bar) {
			$product_base_price = (float) $product->get_price();
			if ($product_base_price > 0) {
				$progress_min_price = ($min_price !== '' && (float) $min_price > 0)
					? (string) min((float) $min_price, $product_base_price)
					: (string) $product_base_price;
			} elseif ($min_price !== '' && (float) $min_price > 0) {
				$progress_min_price = (string) $min_price;
			} else {
				$progress_min_price = '0';
			}
			// Frontend min_price for progress should never advertise "0" when WC has a price.
			if ((float) $progress_min_price > 0) {
				$min_price = $progress_min_price;
			}
		}

		if ($allow_multiple_shares && '' === $max_shares) {
			$max_shares = '7';
		}

		$show_sadaka_donation = $enable_sadaka_donation && !$enable_progress_bar;
		$sadaka_block_html = '';
		if ($show_sadaka_donation && class_exists('WDP_Donation_Product_Context_Service') && class_exists('WDP_Templates')) {
			$sadaka_context = WDP_Donation_Product_Context_Service::build_form_context($product);
			$sadaka_block_html = WDP_Templates::render_sadaka_donation_block($sadaka_context);
		}

		$raw_price = $product->get_price();
		$response = array(
			'product_name' => $product->get_name(),
			'is_custom_price' => $allow_custom_price,
			'min_price' => $min_price,
			'progress_min_price' => $progress_min_price,
			'enable_progress_bar' => $enable_progress_bar,
			'regular_price' => $product->get_regular_price(),
			'price' => $raw_price,
			'price_html' => ($raw_price !== '' && $raw_price !== null) ? WDP_Utils::format_price_html($raw_price) : '',
			'is_multiple_shares' => $allow_multiple_shares,
			'max_shares' => $max_shares,
			'enable_sadaka_donation' => $show_sadaka_donation,
			'sadaka_block_html' => $sadaka_block_html,
		);

            WDP_Utils::log(array('event' => 'get_product_info', 'response' => $response));
            WDP_Utils::json_success($response);
        } catch (WDP_Exception $e) {
            WDP_Utils::json_error($e);
        } catch (Exception $e) {
            WDP_Utils::handle_exception($e, true);
        }
    }

    /**
     * Get product name via AJAX.
     *
     * @since 10.0
     * @return never Sends JSON response and terminates.
     * @throws WDP_Security_Exception      If nonce verification fails.
     * @throws WDP_Validation_Exception    If product ID is invalid.
     * @throws WDP_Product_Not_Found_Exception If product doesn't exist.
     */
    public static function get_product_name() {
        if (function_exists('wdp_track_deprecated_ajax_usage')) {
            wdp_track_deprecated_ajax_usage('wdp_get_product_name');
        }

        try {
            self::run_secured_ajax('wdp_get_product_name', 'get_product_name', 60, 60, false);
        } catch (WDP_Security_Exception $e) {
            WDP_Utils::json_error($e);
        }

        $product_id = isset($_POST['product_id']) ? absint(wp_unslash($_POST['product_id'])) : 0;

        if (!$product_id) {
            WDP_Utils::json_error(__('Geçersiz ürün ID', 'woo-donation-popup'));
        }
        
        $product = null;
        // SECURITY: Validate product ID and reuse resolved product instance.
        if (!WDP_Security::validate_product_id($product_id, $product)) {
            WDP_Utils::json_error(__('Geçersiz ürün ID', 'woo-donation-popup'));
        }

        if (!$product) {
            WDP_Utils::json_error(__('Ürün bulunamadı', 'woo-donation-popup'));
        }

        WDP_Utils::json_success(array(
            'product_name' => $product->get_name(),
            'deprecated' => true,
            'use_instead' => 'wdp_get_product_info',
        ));
    }
}

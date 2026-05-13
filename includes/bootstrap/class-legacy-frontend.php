<?php
/**
 * Backward-compatible frontend helpers and AJAX handlers.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

if (!function_exists('wdp_render_donation_button')) {
	/**
	 * Render donation button for a product.
	 *
	 * @param int    $product_id  Product ID.
	 * @param string $button_text Button label.
	 * @return string
	 */
	function wdp_render_donation_button($product_id, $button_text = 'Bağış Yap') {
		if (!class_exists('WDP_Templates')) {
			return '<p style="color:red;">WooCommerce Donation Popup eklentisi aktif değil.</p>';
		}
		if (!function_exists('wc_get_product')) {
			return '<p style="color:red;">WooCommerce etkin değil.</p>';
		}

		$product_id = intval($product_id);
		$product    = wc_get_product($product_id);
		if (!$product) {
			wdp_debug_log('WDP: Ürün bulunamadı - ID: ' . $product_id);
			return '<p style="color:red;">Ürün bulunamadı (ID: ' . esc_html($product_id) . '). Lütfen ürün ID\'sini kontrol edin.</p>';
		}

		return WDP_Templates::render_donation_modal($product_id, $button_text);
	}
}

if (!function_exists('wdp_render_donation_form')) {
	/**
	 * Render direct donation form shortcode output.
	 *
	 * @param int   $product_id Product ID.
	 * @param array $args       Shortcode args.
	 * @return string
	 */
	function wdp_render_donation_form($product_id, $args = array()) {
		if (!class_exists('WDP_Templates')) {
			return '<p style="color:red;">WooCommerce Donation Popup eklentisi aktif değil.</p>';
		}
		if (!function_exists('wc_get_product')) {
			return '<p style="color:red;">WooCommerce etkin değil.</p>';
		}

		$product_id = intval($product_id);
		$product    = wc_get_product($product_id);
		if (!$product) {
			wdp_debug_log('WDP: Ürün bulunamadı - ID: ' . $product_id);
			return '<p style="color:red;">Ürün bulunamadı (ID: ' . esc_html($product_id) . '). Lütfen ürün ID\'sini kontrol edin.</p>';
		}

		return WDP_Templates::render_donation_form($product_id, is_array($args) ? $args : array());
	}
}

if (!function_exists('wdp_should_render_js_helpers')) {
	/**
	 * Determine if JS helper snippet should be printed.
	 *
	 * @return bool
	 */
	function wdp_should_render_js_helpers() {
		if (is_admin()) {
			return false;
		}

		if (wp_script_is('wdp-init-js', 'enqueued') || wp_script_is('wdp-module-loader-js', 'enqueued')) {
			return true;
		}

		if (function_exists('is_product') && is_product()) {
			$product_id = get_the_ID();
			if ($product_id) {
				$allow_custom_price    = get_post_meta($product_id, '_allow_custom_price', true) === 'yes';
				$allow_multiple_shares = get_post_meta($product_id, '_allow_multiple_shares', true) === 'yes';
				$enable_progress_bar   = get_post_meta($product_id, '_enable_progress_bar', true) === 'yes';
				if ($allow_custom_price || $allow_multiple_shares || $enable_progress_bar) {
					return true;
				}
			}
		}

		if (is_singular()) {
			$post = get_post();
			if ($post && has_shortcode($post->post_content, 'wdp_donation_button')) {
				return true;
			}
			if ($post && has_shortcode($post->post_content, 'wdp_donation_form')) {
				return true;
			}
		}

		return false;
	}
}

if (!function_exists('wdp_add_js_helpers')) {
	/**
	 * Print legacy helper JS API for backwards compatibility.
	 *
	 * @return void
	 */
	function wdp_add_js_helpers() {
		if (!wdp_should_render_js_helpers()) {
			return;
		}
		?>
		<script>
		if (typeof window.WDP === 'undefined') { window.WDP = {}; }
		window.WDP.renderDonationButton = function(productId, containerId) {
		  var container = document.getElementById(containerId);
		  var parsedProductId = Number.parseInt(productId, 10);
		  if (!container || !Number.isFinite(parsedProductId) || parsedProductId <= 0) { return; }
		  var formData = 'action=wdp_render_donation_button' +
		    '&product_id=' + encodeURIComponent(String(parsedProductId)) +
		    '&security=' + encodeURIComponent('<?php echo esc_js(wp_create_nonce('wdp_render_donation_button')); ?>');
		  fetch('<?php echo esc_url(admin_url('admin-ajax.php')); ?>', {
		    method: 'POST',
		    credentials: 'same-origin',
		    headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest'},
		    body: formData
		  })
		  .then(function(response){ if(!response.ok){ throw new Error('HTTP ' + response.status);} return response.json(); })
		  .then(function(response){ if(response && response.success && typeof response.html === 'string'){ container.innerHTML = response.html; if (typeof window.WDP.refresh === 'function') { window.WDP.refresh(); }}})
		  .catch(function(err){ if(window.console && typeof window.console.error === 'function'){ window.console.error('Error rendering donation button:', err);} });
		};
		</script>
		<?php
	}
}

if (!function_exists('wdp_ajax_render_donation_button')) {
	/**
	 * AJAX renderer for button helper.
	 *
	 * @return void
	 */
	function wdp_ajax_render_donation_button() {
		check_ajax_referer('wdp_render_donation_button', 'security');
		if (!function_exists('wc_get_product')) {
			wp_send_json(array('success' => false, 'message' => __('WooCommerce etkin değil.', 'woo-donation-popup')));
		}

		if (class_exists('WDP_Security')) {
			if (!WDP_Security::validate_request_origin()) {
				wp_send_json(array('success' => false, 'message' => __('Geçersiz istek kaynağı', 'woo-donation-popup')));
			}
			$rate_key = WDP_Security::get_rate_limit_key('render_donation_button');
			if (!WDP_Security::check_rate_limit($rate_key, 40, 60)) {
				wp_send_json(array('success' => false, 'message' => __('Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.', 'woo-donation-popup')));
			}
		}

		$product_id  = isset($_POST['product_id']) ? absint(wp_unslash($_POST['product_id'])) : 0;
		$button_text = isset($_POST['button_text']) ? sanitize_text_field(wp_unslash($_POST['button_text'])) : __('Bağış Yap', 'woo-donation-popup');
		if (!$product_id) {
			wp_send_json(array('success' => false, 'message' => __('Geçersiz ürün ID', 'woo-donation-popup')));
		}

		if (class_exists('WDP_Security') && !WDP_Security::validate_product_id($product_id)) {
			wp_send_json(array('success' => false, 'message' => __('Ürün bulunamadı veya görüntülenemiyor.', 'woo-donation-popup')));
		}

		wp_send_json(array('success' => true, 'html' => wdp_render_donation_button($product_id, $button_text)));
	}
}

add_action('wp_footer', 'wdp_add_js_helpers');
add_action('wp_ajax_wdp_render_donation_button', 'wdp_ajax_render_donation_button');
add_action('wp_ajax_nopriv_wdp_render_donation_button', 'wdp_ajax_render_donation_button');

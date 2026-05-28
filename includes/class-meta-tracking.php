<?php
/**
 * Meta Pixel companion: settings, thank-you Purchase payload, optional base pixel (off by default).
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Meta_Tracking
 */
class WDP_Meta_Tracking {

	const OPTION_KEY = 'wdp_meta_tracking_settings';

	/**
	 * Default settings (recommended).
	 *
	 * @return array
	 */
	public static function default_settings() {
		return array(
			'enabled'                  => '1',
			'view_content'             => '1',
			'add_to_cart'              => '1',
			// Off by default: WooCommerce / Meta (facebook-for-woocommerce) normally sends Purchase.
			'purchase'                 => '0',
			'custom_debug'             => '0',
			'debug'                    => '0',
			'load_base_pixel'          => '0',
			'optional_pixel_id'        => '',
			'initiate_checkout'        => '0',
			'purchase_include_on_hold' => '0',
		);
	}

	/**
	 * Merged settings from DB.
	 *
	 * @return array
	 */
	public static function get_settings() {
		$defaults = self::default_settings();
		$stored   = get_option(self::OPTION_KEY, array());
		if (!is_array($stored)) {
			$stored = array();
		}
		return array_merge($defaults, $stored);
	}

	/**
	 * Whether a checkbox-like setting is on.
	 *
	 * @param array  $settings Settings.
	 * @param string $key      Key.
	 * @return bool
	 */
	private static function is_on($settings, $key) {
		return isset($settings[ $key ]) && '1' === (string) $settings[ $key ];
	}

	/**
	 * Whether WooCommerce's official Meta / Facebook integration likely sends Purchase on thank-you.
	 *
	 * @return bool
	 */
	public static function is_woocommerce_meta_purchase_integration_active() {
		static $cached = null;
		if (null !== $cached) {
			return $cached;
		}

		$cached = false;

		if (! function_exists('is_plugin_active')) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$plugin_files = array(
			'facebook-for-woocommerce/facebook-for-woocommerce.php',
		);

		foreach ($plugin_files as $plugin_file) {
			if (is_plugin_active($plugin_file)) {
				$cached = true;
				break;
			}
		}

		if (! $cached) {
			$cached = class_exists('WC_Facebookcommerce_Integration', false)
				|| class_exists('WC_Facebook_Loader', false)
				|| class_exists('WC_Facebookcommerce', false)
				|| class_exists('Facebookcommerce', false);
		}

		$cached = (bool) apply_filters('wdp_meta_woocommerce_purchase_integration_active', $cached);

		return $cached;
	}

	/**
	 * Whether this plugin should fire Purchase on order-received (explicit admin opt-in only).
	 *
	 * @return bool
	 */
	public static function should_track_purchase_from_plugin() {
		$s = self::get_settings();
		if (! self::is_on($s, 'enabled')) {
			return false;
		}
		return self::is_on($s, 'purchase');
	}

	/**
	 * One-time: disable plugin Purchase when WooCommerce/Meta already sends it (avoids duplicate conversions).
	 *
	 * @return void
	 */
	public static function maybe_migrate_purchase_setting_for_wc_meta() {
		if (get_option('wdp_meta_purchase_wc_migration_v1', false)) {
			return;
		}

		if (! self::is_woocommerce_meta_purchase_integration_active()) {
			update_option('wdp_meta_purchase_wc_migration_v1', '1', false);
			return;
		}

		$stored = get_option(self::OPTION_KEY, false);
		if (is_array($stored) && isset($stored['purchase']) && '1' === (string) $stored['purchase']) {
			$stored['purchase'] = '0';
			update_option(self::OPTION_KEY, $stored, false);
		}

		update_option('wdp_meta_purchase_wc_migration_v1', '1', false);
	}

	/**
	 * Whether frontend meta-tracking.js should load with the main bundle.
	 *
	 * Thank-you Purchase uses a separate enqueue path.
	 *
	 * @return bool
	 */
	public static function frontend_events_script_needed() {
		$s = self::get_settings();
		if (!self::is_on($s, 'enabled')) {
			return false;
		}

		return self::is_on($s, 'view_content')
			|| self::is_on($s, 'add_to_cart')
			|| self::is_on($s, 'initiate_checkout');
	}

	/**
	 * Config for wp_localize_script (wdp_ajax.meta).
	 *
	 * @return array
	 */
	public static function get_frontend_config() {
		$s = self::get_settings();
		return array(
			'enabled'            => self::is_on($s, 'enabled'),
			'viewContent'        => self::is_on($s, 'view_content'),
			'addToCart'          => self::is_on($s, 'add_to_cart'),
			'purchase'           => self::should_track_purchase_from_plugin(),
			'wcMetaPurchaseActive' => self::is_woocommerce_meta_purchase_integration_active(),
			'customDebug'        => self::is_on($s, 'custom_debug'),
			'debug'              => self::is_on($s, 'debug'),
			'initiateCheckout'   => self::is_on($s, 'initiate_checkout'),
			'loadBasePixel'      => self::is_on($s, 'load_base_pixel'),
			'optionalPixelId'    => isset($s['optional_pixel_id']) ? preg_replace('/\D/', '', (string) $s['optional_pixel_id']) : '',
		);
	}

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public static function init() {
		if (!function_exists('WC')) {
			return;
		}
		self::maybe_migrate_purchase_setting_for_wc_meta();
		add_action('wp_enqueue_scripts', array(__CLASS__, 'maybe_enqueue_thankyou_purchase'), 25);
		add_action('wp_footer', array(__CLASS__, 'maybe_print_optional_base_pixel'), 1);
	}

	/**
	 * Optional base pixel snippet (default off). Can duplicate site pixel if the same ID is used — admin-only escape hatch.
	 *
	 * @return void
	 */
	public static function maybe_print_optional_base_pixel() {
		if (is_admin()) {
			return;
		}
		$s = self::get_settings();
		if (! self::is_on($s, 'load_base_pixel')) {
			return;
		}
		$pixel = isset($s['optional_pixel_id']) ? preg_replace('/\D/', '', (string) $s['optional_pixel_id']) : '';
		if ('' === $pixel || strlen($pixel) < 8) {
			return;
		}
		$pixel_js = esc_js($pixel);
		$script   = "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','" . $pixel_js . "');";
		if (function_exists('wp_print_inline_script_tag')) {
			wp_print_inline_script_tag($script, array( 'id' => 'wdp-meta-optional-pixel-bootstrap' ));
		} else {
			echo '<script id="wdp-meta-optional-pixel-bootstrap">' . $script . '</script>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built from esc_js pixel id only.
		}
	}

	/**
	 * Thank-you page: enqueue meta-tracking.js only and localize Purchase payload.
	 *
	 * @return void
	 */
	public static function maybe_enqueue_thankyou_purchase() {
		if (! function_exists('is_wc_endpoint_url') || ! is_wc_endpoint_url('order-received')) {
			return;
		}

		if (! self::should_track_purchase_from_plugin()) {
			return;
		}

		$s = self::get_settings();

		global $wp;
		$order_id = 0;
		if (is_object($wp) && isset($wp->query_vars['order-received'])) {
			$order_id = absint($wp->query_vars['order-received']);
		}
		if (! $order_id) {
			return;
		}

		$order_key = '';
		if (isset($_GET['key'])) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$order_key = sanitize_text_field(wp_unslash($_GET['key'])); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		}

		$order = wc_get_order($order_id);
		if (! $order instanceof WC_Order) {
			return;
		}

		if (! $order->key_is_valid($order_key)) {
			return;
		}

		$status = $order->get_status();
		$allow  = in_array($status, array('processing', 'completed'), true);
		if (! $allow && self::is_on($s, 'purchase_include_on_hold') && 'on-hold' === $status) {
			$allow = true;
		}
		if (! $allow) {
			return;
		}

		$payload = self::build_purchase_payload_for_order($order);
		if (empty($payload['params']) || empty($payload['params']['content_ids'])) {
			return;
		}

		$order_key_internal = $order->get_order_key();
		$hash_suffix        = substr(sha1((string) $order_key_internal), 0, 12);
		$event_id           = 'wdp_purchase_' . $order_id . '_' . $hash_suffix;

		$plugin_url = defined('WDP_PLUGIN_URL') ? WDP_PLUGIN_URL : plugin_dir_url(WDP_PLUGIN_FILE);
		$ver        = defined('WDP_ASSET_VERSION') ? WDP_ASSET_VERSION : ( defined('WDP_VERSION') ? WDP_VERSION : '1' );

		if (! wp_script_is('wdp-meta-tracking-js', 'registered')) {
			wp_register_script(
				'wdp-meta-tracking-js',
				$plugin_url . 'assets/js/src/meta-tracking.js',
				array(),
				$ver,
				true
			);
		}

		wp_enqueue_script('wdp-meta-tracking-js');

		wp_localize_script(
			'wdp-meta-tracking-js',
			'wdpMetaPurchase',
			array(
				'orderId'      => $order_id,
				'eventID'      => $event_id,
				'params'       => $payload['params'],
				'runPurchase'  => true,
				'debug'        => self::is_on($s, 'debug'),
			)
		);
	}

	/**
	 * Build Meta Purchase params from order (no donor PII).
	 *
	 * @param WC_Order $order Order.
	 * @return array{params:array<string,mixed>}
	 */
	private static function build_purchase_payload_for_order(WC_Order $order) {
		$content_ids = array();
		$names       = array();
		$contents    = array();
		$num_items   = 0;

		foreach ($order->get_items('line_item') as $item) {
			if (! $item instanceof WC_Order_Item_Product) {
				continue;
			}
			$product = $item->get_product();
			$pid     = $item->get_product_id();
			if (! $pid) {
				continue;
			}
			$qty = (int) $item->get_quantity();
			if ($qty < 1) {
				$qty = 1;
			}
			$line_subtotal = (float) $item->get_subtotal();
			$item_price    = $qty > 0 ? round($line_subtotal / $qty, wc_get_price_decimals()) : round((float) $item->get_subtotal(), wc_get_price_decimals());

			$content_ids[] = (string) $pid;
			$name          = $product ? wp_strip_all_tags((string) $product->get_name()) : '';
			if ($name !== '') {
				$names[] = $name;
			}
			$contents[] = array(
				'id'         => (string) $pid,
				'quantity'   => $qty,
				'item_price' => (float) $item_price,
			);
			$num_items += $qty;
		}

		$content_name = '';
		if (! empty($names)) {
			$content_name = implode(', ', array_slice(array_unique($names), 0, 20));
			if (strlen($content_name) > 500) {
				$content_name = substr($content_name, 0, 497) . '...';
			}
		}

		$currency = $order->get_currency();
		$value    = (float) $order->get_total();

		$params = array(
			'content_ids'   => array_values(array_unique($content_ids)),
			'content_name'  => $content_name,
			'content_type'  => 'product',
			'contents'      => $contents,
			'value'         => round($value, wc_get_price_decimals()),
			'currency'      => $currency,
			'num_items'     => $num_items,
			'order_id'      => (string) $order->get_id(),
			'source'        => 'wdp_donation_plugin',
		);

		return array( 'params' => $params );
	}

	/**
	 * Persist settings (non-autoload).
	 *
	 * @param array $settings Normalized settings.
	 * @return bool
	 */
	public static function update_settings($settings) {
		return update_option(self::OPTION_KEY, $settings, false);
	}
}

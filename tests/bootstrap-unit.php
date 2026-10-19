<?php
/**
 * PHPUnit bootstrap — WordPress stubs + plugin autoloader.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

$root = dirname(__DIR__);

if (!defined('ABSPATH')) {
	define('ABSPATH', $root . '/');
}
if (!defined('WDP_PLUGIN_DIR')) {
	define('WDP_PLUGIN_DIR', $root . '/');
}
if (!defined('WDP_PLUGIN_FILE')) {
	define('WDP_PLUGIN_FILE', $root . '/woo-donation-popup.php');
}
if (!defined('WDP_VERSION')) {
	define('WDP_VERSION', '10.28.10');
}
if (!defined('HOUR_IN_SECONDS')) {
	define('HOUR_IN_SECONDS', 3600);
}
if (!defined('DAY_IN_SECONDS')) {
	define('DAY_IN_SECONDS', 86400);
}

/**
 * In-memory option / meta store for unit tests.
 */
final class WDP_Test_State {
	/** @var array<string, mixed> */
	public static $options = array();

	/** @var array<int, array<string, mixed>> */
	public static $post_meta = array();

	/** @var array<string, callable> */
	public static $filters = array();

	/** @var string[] Capabilities granted to the current user. */
	public static $caps = array();

	/** @var array<string, mixed> */
	public static $transients = array();

	/** @var array<string, array<int, callable>> Registered actions (hook => callbacks). */
	public static $actions = array();

	/** @var array<int, WC_Product> */
	public static $products = array();

	/** @var array<string, int> slug => product id */
	public static $product_slugs = array();

	/** @var array<string, int> sku => product id */
	public static $product_skus = array();

	/** @var bool */
	public static $is_product = false;

	/** @var int */
	public static $queried_id = 0;

	/** @var bool */
	public static $is_admin = false;

	/** @var bool */
	public static $is_cart = false;

	/** @var bool */
	public static $is_checkout = false;

	/** @var bool */
	public static $doing_ajax = false;

	/** @var array<string, int> */
	public static $did_actions = array();

	public static function reset(): void {
		self::$options       = array();
		self::$post_meta     = array();
		self::$filters       = array();
		self::$caps          = array();
		self::$transients    = array();
		self::$actions       = array();
		self::$products      = array();
		self::$product_slugs = array();
		self::$product_skus  = array();
		self::$is_product    = false;
		self::$queried_id    = 0;
		self::$is_admin      = false;
		self::$is_cart       = false;
		self::$is_checkout   = false;
		self::$doing_ajax    = false;
		self::$did_actions   = array();
		$GLOBALS['wpdb']     = new WDP_Fake_Wpdb();
		unset($GLOBALS['product']);
		$_SERVER  = array();
		$_GET     = array();
		$_POST    = array();
		$_REQUEST = array();
		if (class_exists('WDP_Donation_Scope')) {
			WDP_Donation_Scope::flush();
		}
		if (class_exists('WDP_Sadaka_Product_Visibility')) {
			WDP_Sadaka_Product_Visibility::flush();
		}
		if (class_exists('WDP_Placement_Settings')) {
			WDP_Placement_Settings::flush();
		}
		if (class_exists('WDP_Render_Registry')) {
			WDP_Render_Registry::reset();
		}
		if (class_exists('WDP_Builder_Detect')) {
			WDP_Builder_Detect::reset();
		}
		if (class_exists('WDP_Product_Page_Integration')) {
			WDP_Product_Page_Integration::reset_request_flags();
		}
	}
}

if (!function_exists('current_user_can')) {
	function current_user_can($capability, ...$args) {
		return in_array((string) $capability, WDP_Test_State::$caps, true);
	}
}

if (!function_exists('__')) {
	function __($text, $domain = null) {
		return (string) $text;
	}
}
if (!function_exists('esc_html__')) {
	function esc_html__($text, $domain = null) {
		return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
	}
}
if (!function_exists('esc_attr__')) {
	function esc_attr__($text, $domain = null) {
		return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
	}
}
if (!function_exists('esc_html')) {
	function esc_html($text) {
		return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
	}
}
if (!function_exists('esc_attr')) {
	function esc_attr($text) {
		return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
	}
}
if (!function_exists('esc_url')) {
	function esc_url($url) {
		return filter_var((string) $url, FILTER_SANITIZE_URL) ?: '';
	}
}
if (!function_exists('wp_kses')) {
	function wp_kses($string, $allowed_html, $allowed_protocols = array()) {
		return (string) $string;
	}
}
if (!function_exists('wp_kses_post')) {
	function wp_kses_post($string) {
		return (string) $string;
	}
}
if (!function_exists('wp_unslash')) {
	function wp_unslash($value) {
		return $value;
	}
}
if (!function_exists('absint')) {
	function absint($value) {
		return abs((int) $value);
	}
}
if (!function_exists('sanitize_key')) {
	function sanitize_key($key) {
		$key = strtolower((string) $key);
		return preg_replace('/[^a-z0-9_\-]/', '', $key) ?: '';
	}
}
if (!function_exists('sanitize_text_field')) {
	function sanitize_text_field($str) {
		$str = (string) $str;
		$str = strip_tags($str);
		return trim($str);
	}
}
if (!function_exists('sanitize_textarea_field')) {
	function sanitize_textarea_field($str) {
		return sanitize_text_field($str);
	}
}
if (!function_exists('sanitize_email')) {
	function sanitize_email($email) {
		$email = trim((string) $email);
		return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : '';
	}
}
if (!function_exists('sanitize_hex_color')) {
	function sanitize_hex_color($color) {
		$color = trim((string) $color);
		if (preg_match('/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/', $color)) {
			return $color;
		}
		return null;
	}
}
if (!function_exists('apply_filters')) {
	function apply_filters($hook, $value) {
		$args = func_get_args();
		array_shift($args);
		if (isset(WDP_Test_State::$filters[ $hook ]) && is_callable(WDP_Test_State::$filters[ $hook ])) {
			return call_user_func_array(WDP_Test_State::$filters[ $hook ], $args);
		}
		return $value;
	}
}
if (!function_exists('add_filter')) {
	function add_filter($hook, $callback, $priority = 10, $accepted_args = 1) {
		WDP_Test_State::$filters[ $hook ] = $callback;
		return true;
	}
}
if (!function_exists('get_option')) {
	function get_option($key, $default = false) {
		if (array_key_exists($key, WDP_Test_State::$options)) {
			return WDP_Test_State::$options[ $key ];
		}
		return $default;
	}
}
if (!function_exists('update_option')) {
	function update_option($key, $value, $autoload = null) {
		WDP_Test_State::$options[ $key ] = $value;
		return true;
	}
}
if (!function_exists('get_post_meta')) {
	function get_post_meta($post_id, $key = '', $single = false) {
		$post_id = (int) $post_id;
		if (!isset(WDP_Test_State::$post_meta[ $post_id ])) {
			return $single ? '' : array();
		}
		if ($key === '') {
			return WDP_Test_State::$post_meta[ $post_id ];
		}
		if (!array_key_exists($key, WDP_Test_State::$post_meta[ $post_id ])) {
			return $single ? '' : array();
		}
		$val = WDP_Test_State::$post_meta[ $post_id ][ $key ];
		return $single ? $val : array( $val );
	}
}
if (!function_exists('current_time')) {
	function current_time($type, $gmt = 0) {
		return $type === 'timestamp' ? time() : gmdate('Y-m-d H:i:s');
	}
}
if (!function_exists('wp_json_encode')) {
	function wp_json_encode($data, $options = 0, $depth = 512) {
		return json_encode($data, $options, $depth);
	}
}
if (!function_exists('is_email')) {
	function is_email($email) {
		return (bool) filter_var((string) $email, FILTER_VALIDATE_EMAIL);
	}
}
if (!function_exists('wp_nonce_field')) {
	function wp_nonce_field($action = -1, $name = '_wpnonce', $referer = true, $echo = true) {
		$html = '<input type="hidden" name="' . esc_attr($name) . '" value="test-nonce" />';
		if ($echo) {
			echo $html;
		}
		return $html;
	}
}
if (!function_exists('wp_parse_args')) {
	function wp_parse_args($args, $defaults = array()) {
		if (is_object($args)) {
			$args = get_object_vars($args);
		} elseif (!is_array($args)) {
			$args = array();
		}
		if (!is_array($defaults)) {
			$defaults = array();
		}
		return array_merge($defaults, $args);
	}
}
if (!function_exists('sanitize_html_class')) {
	function sanitize_html_class($class, $fallback = '') {
		$sanitized = preg_replace('/[^A-Za-z0-9_-]/', '', (string) $class);
		return $sanitized !== '' ? $sanitized : (string) $fallback;
	}
}
if (!function_exists('checked')) {
	function checked($checked, $current = true, $echo = true) {
		$result = ((string) $checked === (string) $current) ? ' checked="checked"' : '';
		if ($echo) {
			echo $result;
		}
		return $result;
	}
}

if (!function_exists('update_post_meta')) {
	function update_post_meta($post_id, $key, $value) {
		WDP_Test_State::$post_meta[ (int) $post_id ][ $key ] = $value;
		return true;
	}
}
if (!function_exists('delete_post_meta')) {
	function delete_post_meta($post_id, $key) {
		unset(WDP_Test_State::$post_meta[ (int) $post_id ][ $key ]);
		return true;
	}
}
if (!function_exists('wp_cache_get')) {
	function wp_cache_get($key, $group = '') {
		return false;
	}
}
if (!function_exists('wp_cache_set')) {
	function wp_cache_set($key, $value, $group = '', $expire = 0) {
		return true;
	}
}
if (!function_exists('wp_cache_delete')) {
	function wp_cache_delete($key, $group = '') {
		return true;
	}
}
if (!function_exists('delete_transient')) {
	function delete_transient($key) {
		unset(WDP_Test_State::$transients[ $key ]);
		return true;
	}
}
if (!function_exists('get_transient')) {
	function get_transient($key) {
		return array_key_exists($key, WDP_Test_State::$transients) ? WDP_Test_State::$transients[ $key ] : false;
	}
}
if (!function_exists('set_transient')) {
	function set_transient($key, $value, $expiration = 0) {
		WDP_Test_State::$transients[ $key ] = $value;
		return true;
	}
}
if (!function_exists('delete_option')) {
	function delete_option($key) {
		unset(WDP_Test_State::$options[ $key ]);
		return true;
	}
}
if (!function_exists('delete_post_meta_by_key')) {
	function delete_post_meta_by_key($key) {
		foreach (WDP_Test_State::$post_meta as $post_id => $meta) {
			unset(WDP_Test_State::$post_meta[ $post_id ][ $key ]);
		}
		return true;
	}
}
if (!function_exists('add_action')) {
	function add_action($hook, $callback, $priority = 10, $accepted_args = 1) {
		WDP_Test_State::$actions[ $hook ][] = $callback;
		return true;
	}
}
if (!function_exists('do_action')) {
	function do_action($hook, ...$args) {
		foreach (WDP_Test_State::$actions[ $hook ] ?? array() as $callback) {
			call_user_func_array($callback, $args);
		}
	}
}
if (!function_exists('plugin_basename')) {
	function plugin_basename($file) {
		return basename(dirname((string) $file)) . '/' . basename((string) $file);
	}
}
if (!function_exists('wp_strip_all_tags')) {
	function wp_strip_all_tags($text) {
		return trim(strip_tags((string) $text));
	}
}
if (!function_exists('remove_filter')) {
	function remove_filter($hook, $callback, $priority = 10) {
		unset(WDP_Test_State::$filters[ $hook ]);
		return true;
	}
}
if (!function_exists('wp_verify_nonce')) {
	function wp_verify_nonce($nonce, $action = -1) {
		return $nonce !== '' && $nonce !== '0';
	}
}
if (!function_exists('wp_nonce_url')) {
	function wp_nonce_url($url, $action = -1, $name = '_wpnonce') {
		return $url . (strpos((string) $url, '?') === false ? '?' : '&') . $name . '=test-nonce';
	}
}
if (!function_exists('add_query_arg')) {
	function add_query_arg($key, $value = null, $url = null) {
		if (is_array($key)) {
			$url = (string) $value;
			foreach ($key as $k => $v) {
				$url .= (strpos($url, '?') === false ? '?' : '&') . rawurlencode((string) $k) . '=' . rawurlencode((string) $v);
			}
			return $url;
		}
		$url = (string) ($url === null ? '' : $url);
		return $url . (strpos($url, '?') === false ? '?' : '&') . rawurlencode((string) $key) . '=' . rawurlencode((string) $value);
	}
}
if (!function_exists('sanitize_title')) {
	function sanitize_title($title) {
		$title = strtolower(trim((string) $title));
		$title = preg_replace('/[^a-z0-9\-]+/', '-', $title);
		return trim((string) $title, '-');
	}
}
if (!function_exists('get_page_by_path')) {
	function get_page_by_path($path, $output = OBJECT, $post_type = 'page') {
		$id = WDP_Test_State::$product_slugs[ sanitize_title((string) $path) ] ?? 0;
		if (!$id) {
			return null;
		}
		$post = new stdClass();
		$post->ID = $id;
		return $post;
	}
}
if (!function_exists('wc_get_product')) {
	function wc_get_product($id) {
		$id = is_object($id) && isset($id->ID) ? (int) $id->ID : (int) $id;
		return WDP_Test_State::$products[ $id ] ?? null;
	}
}
if (!function_exists('wc_get_product_id_by_sku')) {
	function wc_get_product_id_by_sku($sku) {
		return WDP_Test_State::$product_skus[ (string) $sku ] ?? 0;
	}
}
if (!function_exists('is_product')) {
	function is_product() {
		return WDP_Test_State::$is_product;
	}
}
if (!function_exists('get_queried_object_id')) {
	function get_queried_object_id() {
		return WDP_Test_State::$queried_id;
	}
}
if (!function_exists('get_the_ID')) {
	function get_the_ID() {
		return WDP_Test_State::$queried_id;
	}
}
if (!function_exists('get_woocommerce_currency')) {
	function get_woocommerce_currency() {
		return 'TRY';
	}
}
if (!defined('OBJECT')) {
	define('OBJECT', 'OBJECT');
}
if (!function_exists('get_woocommerce_currency_symbol')) {
	function get_woocommerce_currency_symbol() {
		return '&#8378;';
	}
}
if (!function_exists('wc_format_decimal')) {
	function wc_format_decimal($number) {
		return (string) $number;
	}
}
if (!function_exists('wc_price')) {
	function wc_price($price, $args = array()) {
		$formatted = rtrim(rtrim(number_format((float) $price, 2, ',', '.'), '0'), ',');
		return '<span class="woocommerce-Price-amount amount"><bdi>' . $formatted . '&nbsp;<span class="woocommerce-Price-currencySymbol">&#8378;</span></bdi></span>';
	}
}
if (!function_exists('is_admin')) {
	function is_admin() {
		return WDP_Test_State::$is_admin;
	}
}
if (!function_exists('is_cart')) {
	function is_cart() {
		return WDP_Test_State::$is_cart;
	}
}
if (!function_exists('is_checkout')) {
	function is_checkout() {
		return WDP_Test_State::$is_checkout;
	}
}
if (!function_exists('wp_doing_ajax')) {
	function wp_doing_ajax() {
		return WDP_Test_State::$doing_ajax;
	}
}
if (!function_exists('did_action')) {
	function did_action($hook) {
		return (int) (WDP_Test_State::$did_actions[ (string) $hook ] ?? 0);
	}
}
if (!function_exists('get_permalink')) {
	function get_permalink($post = 0) {
		$id = is_object($post) && method_exists($post, 'get_id') ? (int) $post->get_id() : (int) $post;
		return 'https://example.test/?p=' . $id;
	}
}
if (!function_exists('has_shortcode')) {
	function has_shortcode($content, $tag) {
		return is_string($content) && $tag !== '' && strpos($content, '[' . $tag) !== false;
	}
}
if (!function_exists('selected')) {
	function selected($selected, $current = true, $echo = true) {
		$result = ((string) $selected === (string) $current) ? ' selected="selected"' : '';
		if ($echo) {
			echo $result;
		}
		return $result;
	}
}

require_once __DIR__ . '/support/fakes.php';
$GLOBALS['wpdb'] = new WDP_Fake_Wpdb();

require_once WDP_PLUGIN_DIR . 'includes/class-exceptions.php';
require_once WDP_PLUGIN_DIR . 'includes/class-autoloader.php';
WDP_Autoloader::register();

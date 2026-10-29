<?php
/**
 * PHPUnit bootstrap — WordPress stubs + plugin autoloader.
 *
 * @package DonationPanel
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
	define('WDP_VERSION', '12.0.0');
}
if (!defined('MINUTE_IN_SECONDS')) {
	define('MINUTE_IN_SECONDS', 60);
}
if (!defined('HOUR_IN_SECONDS')) {
	define('HOUR_IN_SECONDS', 3600);
}
if (!defined('DAY_IN_SECONDS')) {
	define('DAY_IN_SECONDS', 86400);
}
if (!defined('WDP_PLUGIN_URL')) {
	define('WDP_PLUGIN_URL', 'https://example.test/wp-content/plugins/woo-donation-popup/');
}
if (!defined('WDP_ASSET_VERSION')) {
	define('WDP_ASSET_VERSION', '12.0.0');
}
if (!defined('WDP_UNIT_TEST')) {
	define('WDP_UNIT_TEST', true);
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

	/** @var array<int, int[]> product_id => term ids (product_cat) */
	public static $product_terms = array();

	/** @var array<int, object> term_id => term stub */
	public static $terms = array();

	/** @var bool */
	public static $is_product = false;

	/** @var int */
	public static $queried_id = 0;

	/** @var object|null Queried object returned by get_queried_object(). */
	public static $queried_object = null;

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

	/** @var array<string, array{timestamp:int,args:array}> */
	public static $cron = array();

	/** @var string */
	public static $timezone = 'Europe/Istanbul';

	/** @var string */
	public static $currency = 'TRY';

	/** @var int */
	public static $price_decimals = 2;

	/** @var string */
	public static $price_thousand = '.';

	/** @var string */
	public static $price_decimal = ',';

	/** @var array<int, string> post_id => post_type */
	public static $post_types = array();
	/** @var array<int, object> wc_get_order() kayıtları. */
	public static $orders = array();

	/** @var int */
	public static $unique_id = 0;

	/** @var int Simulated logged-in user id. */
	public static $user_id = 0;

	/** @var mixed */
	public static $last_json = null;

	/** @var int */
	public static $json_status = 0;

	/** @var array<string, callable> Registered shortcodes (tag => callback). */
	public static $shortcodes = array();

	public static function reset(): void {
		self::$shortcodes    = array();
		self::$options       = array();
		self::$post_meta     = array();
		self::$filters       = array();
		self::$caps          = array();
		self::$transients    = array();
		self::$actions       = array();
		self::$products      = array();
		self::$product_slugs = array();
		self::$product_skus  = array();
		self::$product_terms = array();
		self::$terms         = array();
		self::$is_product    = false;
		self::$queried_id    = 0;
		self::$queried_object = null;
		self::$is_admin      = false;
		self::$is_cart       = false;
		self::$is_checkout   = false;
		self::$doing_ajax    = false;
		self::$did_actions   = array();
		self::$cron          = array();
		self::$timezone      = 'Europe/Istanbul';
		self::$currency      = 'TRY';
		self::$price_decimals = 2;
		self::$price_thousand = '.';
		self::$price_decimal  = ',';
		self::$post_types    = array();
		self::$orders        = array();
		self::$unique_id     = 0;
		self::$user_id       = 0;
		self::$last_json     = null;
		self::$json_status   = 0;
		$GLOBALS['wpdb']     = new WDP_Fake_Wpdb();
		if (class_exists('DonationPanel\\Modules\\EntryPoints\\Donations_List') && method_exists('DonationPanel\\Modules\\EntryPoints\\Donations_List', 'reset_for_tests')) {
			\DonationPanel\Modules\EntryPoints\Donations_List::reset_for_tests();
		}
		unset($GLOBALS['product']);
		$_SERVER  = array();
		$_GET     = array();
		$_POST    = array();
		$_REQUEST = array();
		$_COOKIE  = array();
		if (class_exists('DonationPanel\\Domain\\Donation_Scope')) {
			\DonationPanel\Domain\Donation_Scope::flush();
		}
		if (class_exists('DonationPanel\\Domain\\Addon_Product_Visibility')) {
			\DonationPanel\Domain\Addon_Product_Visibility::flush();
		}
		if (class_exists('DonationPanel\\Domain\\Placement_Settings')) {
			\DonationPanel\Domain\Placement_Settings::flush();
		}
		if (class_exists('DonationPanel\\Modules\\EntryPoints\\Render_Registry')) {
			\DonationPanel\Modules\EntryPoints\Render_Registry::reset();
		}
		if (class_exists('\DonationPanel\Modules\EntryPoints\Builder_Detect')) {
			\DonationPanel\Modules\EntryPoints\Builder_Detect::reset();
		}
		if (class_exists('\DonationPanel\Modules\EntryPoints\Auto_Placement')) {
			\DonationPanel\Modules\EntryPoints\Auto_Placement::reset_request_flags();
		}
	}
}

if (!function_exists('current_user_can')) {
	function current_user_can($capability, ...$args) {
		return in_array((string) $capability, WDP_Test_State::$caps, true);
	}
}
if (!function_exists('is_user_logged_in')) {
	function is_user_logged_in() {
		return in_array('read', WDP_Test_State::$caps, true) || get_current_user_id() > 0;
	}
}
if (!function_exists('get_current_user_id')) {
	function get_current_user_id() {
		return (int) WDP_Test_State::$user_id;
	}
}
if (!function_exists('check_ajax_referer')) {
	function check_ajax_referer($action = -1, $query_arg = false, $die = true) {
		unset($action);
		$nonce = '';
		if (is_string($query_arg) && $query_arg !== '' && isset($_REQUEST[ $query_arg ])) {
			$nonce = (string) $_REQUEST[ $query_arg ];
		} elseif (isset($_REQUEST['security'])) {
			$nonce = (string) $_REQUEST['security'];
		} elseif (isset($_REQUEST['_wpnonce'])) {
			$nonce = (string) $_REQUEST['_wpnonce'];
		}
		$ok = $nonce !== '' && $nonce !== '0';
		if (!$ok && $die) {
			wp_die('invalid nonce');
		}
		return $ok;
	}
}
if (!class_exists('WDP_Json_Sent')) {
	class WDP_Json_Sent extends Error {
		/** @var mixed */
		public $payload;
		/** @var int */
		public $status;

		public function __construct($payload, $status = 200) {
			$this->payload = $payload;
			$this->status  = (int) $status;
			parent::__construct('json');
		}
	}
}
if (!function_exists('status_header')) {
	function status_header($code) {
		WDP_Test_State::$json_status = (int) $code;
	}
}
if (!function_exists('wp_die')) {
	function wp_die($message = '') {
		$payload = WDP_Test_State::$last_json;
		$status  = WDP_Test_State::$json_status ? WDP_Test_State::$json_status : 200;
		if ($payload !== null) {
			throw new WDP_Json_Sent($payload, $status);
		}
		throw new RuntimeException($message === '' ? 'wp_die' : (string) $message);
	}
}
if (!function_exists('wp_send_json')) {
	function wp_send_json($response, $status_code = null) {
		if ($status_code) {
			status_header($status_code);
		} elseif (!WDP_Test_State::$json_status) {
			WDP_Test_State::$json_status = 200;
		}
		WDP_Test_State::$last_json = $response;
		wp_die();
	}
}
if (!function_exists('wp_send_json_error')) {
	function wp_send_json_error($data = null, $status_code = null) {
		$response = array('success' => false);
		if (isset($data)) {
			$response['data'] = $data;
		}
		wp_send_json($response, $status_code === null ? 200 : $status_code);
	}
}
if (!function_exists('wp_send_json_success')) {
	function wp_send_json_success($data = null, $status_code = null) {
		$response = array('success' => true);
		if (isset($data)) {
			$response['data'] = $data;
		}
		wp_send_json($response, $status_code === null ? 200 : $status_code);
	}
}

if (!function_exists('wdp_test_translate')) {
	/**
	 * Birim testlerinde gettext: languages/woo-donation-popup-<locale>.po okunur (varsayılan tr_TR; en_US = çeviri yok,
	 * İngilizce kaynak). Test içinde `$GLOBALS['wdp_test_locale'] = 'en_US'` ile geçici değiştirilir.
	 * Böylece eski Türkçe beklentiler çeviri zinciri üzerinden doğrulanır.
	 *
	 * @param string $text    İngilizce kaynak metin.
	 * @param string $context msgctxt.
	 * @return string
	 */
	function wdp_test_translate($text, $context = '') {
		static $maps = array();
		$locale = isset($GLOBALS['wdp_test_locale']) ? (string) $GLOBALS['wdp_test_locale'] : (string) getenv('WDP_TEST_LOCALE');
		$locale = $locale !== '' ? $locale : 'tr_TR';
		if (!isset($maps[$locale])) {
			$map  = array();
			$file = dirname(__DIR__) . '/languages/woo-donation-popup-' . $locale . '.po';
			if ($locale !== 'en_US' && is_readable($file)) {
				$ctx = '';
				$id  = null;
				$str = null;
				$cur = '';
				$un  = static function ($v) {
					return strtr($v, array('\\n' => "\n", '\\t' => "\t", '\\"' => '"', '\\\\' => '\\'));
				};
				$flush = static function () use (&$map, &$ctx, &$id, &$str) {
					if ($id !== null && $id !== '' && $str !== null && $str !== '') {
						$map[$ctx . "\x04" . $id] = $str;
					}
					$ctx = '';
					$id  = null;
					$str = null;
				};
				foreach (file($file, FILE_IGNORE_NEW_LINES) as $line) {
					if (preg_match('/^msgctxt "(.*)"$/', $line, $m)) {
						$flush();
						$ctx = $un($m[1]);
						$cur = 'ctx';
					} elseif (preg_match('/^msgid "(.*)"$/', $line, $m)) {
						if ($cur === 'str' || $cur === 'plural') {
							$flush();
						}
						$id  = $un($m[1]);
						$cur = 'id';
					} elseif (preg_match('/^msgid_plural "(.*)"$/', $line)) {
						$cur = 'plural';
					} elseif (preg_match('/^msgstr(?:\[0\])? "(.*)"$/', $line, $m)) {
						$str = $un($m[1]);
						$cur = 'str';
					} elseif (preg_match('/^msgstr\[\d+\] "/', $line)) {
						$cur = 'plural';
					} elseif (preg_match('/^"(.*)"$/', $line, $m)) {
						if ($cur === 'id') {
							$id .= $un($m[1]);
						} elseif ($cur === 'str') {
							$str .= $un($m[1]);
						} elseif ($cur === 'ctx') {
							$ctx .= $un($m[1]);
						}
					} elseif (trim($line) === '') {
						$flush();
						$cur = '';
					}
				}
				$flush();
			}
			$maps[$locale] = $map;
		}
		$key = (string) $context . "\x04" . (string) $text;
		return isset($maps[$locale][$key]) ? $maps[$locale][$key] : (string) $text;
	}
}
if (!function_exists('__')) {
	function __($text, $domain = null) {
		unset($domain);
		return wdp_test_translate($text);
	}
}
if (!function_exists('_x')) {
	function _x($text, $context, $domain = null) {
		unset($domain);
		return wdp_test_translate($text, $context);
	}
}
if (!function_exists('load_plugin_textdomain')) {
	function load_plugin_textdomain($domain, $deprecated = false, $plugin_rel_path = false) {
		WDP_Test_State::$options['__textdomain'] = array(
			'domain'           => (string) $domain,
			'plugin_rel_path'  => (string) $plugin_rel_path,
			'deprecated'       => $deprecated,
		);
		return true;
	}
}
if (!function_exists('esc_html__')) {
	function esc_html__($text, $domain = null) {
		unset($domain);
		return htmlspecialchars(wdp_test_translate($text), ENT_QUOTES, 'UTF-8');
	}
}
if (!function_exists('esc_attr__')) {
	function esc_attr__($text, $domain = null) {
		unset($domain);
		return htmlspecialchars(wdp_test_translate($text), ENT_QUOTES, 'UTF-8');
	}
}
if (!function_exists('esc_html_x')) {
	function esc_html_x($text, $context, $domain = null) {
		unset($domain);
		return htmlspecialchars(wdp_test_translate($text, $context), ENT_QUOTES, 'UTF-8');
	}
}
if (!function_exists('esc_attr_x')) {
	function esc_attr_x($text, $context, $domain = null) {
		unset($domain);
		return htmlspecialchars(wdp_test_translate($text, $context), ENT_QUOTES, 'UTF-8');
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
if (!function_exists('esc_url_raw')) {
	function esc_url_raw($url) {
		return esc_url($url);
	}
}
if (!function_exists('get_privacy_policy_url')) {
	function get_privacy_policy_url() {
		return isset(WDP_Test_State::$options['__privacy_policy_url'])
			? (string) WDP_Test_State::$options['__privacy_policy_url']
			: '';
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
if (!function_exists('wp_salt')) {
	function wp_salt($scheme = 'auth') {
		return 'wdp-test-salt-' . (string) $scheme;
	}
}
if (!function_exists('wp_hash')) {
	function wp_hash($data, $scheme = 'auth') {
		return hash_hmac('md5', (string) $data, wp_salt($scheme));
	}
}
if (!function_exists('is_ssl')) {
	function is_ssl() {
		return false;
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
if (!function_exists('add_shortcode')) {
	function add_shortcode($tag, $callback) {
		WDP_Test_State::$shortcodes[ $tag ] = $callback;
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
if (!function_exists('wc_get_order')) {
	function wc_get_order($id = false) {
		if (isset(WDP_Test_State::$orders[ (int) $id ])) {
			return WDP_Test_State::$orders[ (int) $id ];
		}
		return class_exists('WDP_Privacy_Registry', false) ? (WDP_Privacy_Registry::$orders[ (int) $id ] ?? false) : false;
	}
}
if (!function_exists('add_option')) {
	function add_option($key, $value = '', $deprecated = '', $autoload = 'yes') {
		unset($deprecated, $autoload);
		if (array_key_exists($key, WDP_Test_State::$options)) {
			return false;
		}
		WDP_Test_State::$options[ $key ] = $value;
		return true;
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
if (!function_exists('shortcode_atts')) {
	function shortcode_atts($pairs, $atts, $shortcode = '') {
		$atts = is_array($atts) ? $atts : array();
		$out  = array();
		foreach ((array) $pairs as $name => $default) {
			$out[ $name ] = array_key_exists($name, $atts) ? $atts[ $name ] : $default;
		}
		unset($shortcode);
		return $out;
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
		unset($priority, $accepted_args);
		WDP_Test_State::$actions[ $hook ][] = $callback;
		return true;
	}
}
if (!function_exists('remove_action')) {
	function remove_action($hook, $callback, $priority = 10) {
		unset($priority);
		if (!isset(WDP_Test_State::$actions[ $hook ])) {
			return false;
		}
		$found = false;
		$keep  = array();
		foreach (WDP_Test_State::$actions[ $hook ] as $cb) {
			if (!$found && $cb === $callback) {
				$found = true;
				continue;
			}
			$keep[] = $cb;
		}
		WDP_Test_State::$actions[ $hook ] = $keep;
		return $found;
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
if (!function_exists('wc_get_related_products')) {
	function wc_get_related_products($id, $limit = 5) {
		$p = wc_get_product($id);
		if (!$p || !isset($p->related_ids) || !is_array($p->related_ids)) {
			return array();
		}
		return array_slice(array_values(array_map('intval', $p->related_ids)), 0, (int) $limit);
	}
}
if (!function_exists('wc_get_product_term_ids')) {
	function wc_get_product_term_ids($product_id, $taxonomy = '') {
		unset($taxonomy);
		return WDP_Test_State::$product_terms[ (int) $product_id ] ?? array();
	}
}
if (!function_exists('get_term')) {
	function get_term($term_id, $taxonomy = '') {
		unset($taxonomy);
		$term_id = (int) $term_id;
		if (isset(WDP_Test_State::$terms[ $term_id ])) {
			return WDP_Test_State::$terms[ $term_id ];
		}
		$t          = new stdClass();
		$t->term_id = $term_id;
		$t->parent  = 0;
		$t->slug    = 'term-' . $term_id;
		$t->name    = 'Term ' . $term_id;
		return $t;
	}
}
if (!function_exists('get_ancestors')) {
	function get_ancestors($object_id, $object_type = '', $resource_type = '') {
		unset($object_type, $resource_type);
		$out = array();
		$id  = (int) $object_id;
		for ($i = 0; $i < 20; $i++) {
			$term = get_term($id);
			$parent = is_object($term) ? (int) $term->parent : 0;
			if ($parent <= 0) {
				break;
			}
			$out[] = $parent;
			$id    = $parent;
		}
		return $out;
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
if (!function_exists('get_queried_object')) {
	function get_queried_object() {
		return WDP_Test_State::$queried_object;
	}
}
if (!function_exists('get_the_ID')) {
	function get_the_ID() {
		return WDP_Test_State::$queried_id;
	}
}
if (!function_exists('get_woocommerce_currency')) {
	function get_woocommerce_currency() {
		return WDP_Test_State::$currency;
	}
}
if (!defined('OBJECT')) {
	define('OBJECT', 'OBJECT');
}
if (!function_exists('get_woocommerce_currency_symbol')) {
	function get_woocommerce_currency_symbol($currency = '') {
		unset($currency);
		return '&#8378;';
	}
}
if (!function_exists('get_woocommerce_price_format')) {
	function get_woocommerce_price_format() {
		return '%2$s&nbsp;%1$s';
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
if (!function_exists('wc_add_notice')) {
	function wc_add_notice($message, $notice_type = 'success') {
		if (!isset(WDP_Test_State::$options['__wc_notices'])) {
			WDP_Test_State::$options['__wc_notices'] = array();
		}
		WDP_Test_State::$options['__wc_notices'][] = array(
			'message' => (string) $message,
			'type'    => (string) $notice_type,
		);
		return true;
	}
}
if (!function_exists('number_format_i18n')) {
	function number_format_i18n($number, $decimals = 0) {
		return number_format((float) $number, (int) $decimals, '.', '');
	}
}
if (!function_exists('is_wp_error')) {
	function is_wp_error($thing) {
		return is_object($thing) && is_a($thing, 'WP_Error');
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
if (!function_exists('wp_timezone')) {
	function wp_timezone() {
		return new DateTimeZone(WDP_Test_State::$timezone);
	}
}
if (!function_exists('wp_next_scheduled')) {
	function wp_next_scheduled($hook, $args = array()) {
		$key = $hook . '|' . md5(serialize($args));
		return isset(WDP_Test_State::$cron[ $key ]) ? WDP_Test_State::$cron[ $key ]['timestamp'] : false;
	}
}
if (!function_exists('wp_schedule_single_event')) {
	function wp_schedule_single_event($timestamp, $hook, $args = array()) {
		$key = $hook . '|' . md5(serialize($args));
		WDP_Test_State::$cron[ $key ] = array(
			'timestamp' => (int) $timestamp,
			'args'      => $args,
		);
		return true;
	}
}
if (!function_exists('get_posts')) {
	function get_posts($args = array()) {
		$meta_key   = isset($args['meta_key']) ? (string) $args['meta_key'] : '';
		$meta_value = isset($args['meta_value']) ? (string) $args['meta_value'] : '';
		$out        = array();
		foreach (WDP_Test_State::$post_meta as $id => $meta) {
			if ($meta_key !== '' && (!isset($meta[ $meta_key ]) || (string) $meta[ $meta_key ] !== $meta_value)) {
				continue;
			}
			$out[] = (int) $id;
		}
		return $out;
	}
}
if (!function_exists('get_post_type')) {
	function get_post_type($post = null) {
		$id = is_object($post) && isset($post->ID) ? (int) $post->ID : (int) $post;
		if (isset(WDP_Test_State::$post_types[ $id ])) {
			return WDP_Test_State::$post_types[ $id ];
		}
		return isset(WDP_Test_State::$products[ $id ]) ? 'product' : '';
	}
}
if (!function_exists('wp_unique_id')) {
	function wp_unique_id($prefix = '') {
		WDP_Test_State::$unique_id++;
		return $prefix . (string) WDP_Test_State::$unique_id;
	}
}
if (!function_exists('taxonomy_exists')) {
	function taxonomy_exists($taxonomy) {
		return false;
	}
}
if (!function_exists('wp_reset_postdata')) {
	function wp_reset_postdata() {}
}
if (!function_exists('wp_script_is')) {
	function wp_script_is($handle = '', $status = 'enqueued') {
		if ('registered' === $status) {
			foreach (WDP_Test_State::$options['__scripts'] ?? array() as $row) {
				if ($row['handle'] === (string) $handle) {
					return true;
				}
			}
		}
		return false;
	}
}
if (!function_exists('wp_style_is')) {
	function wp_style_is($handle = '', $status = 'enqueued') {
		return false;
	}
}
if (!function_exists('wp_enqueue_style')) {
	function wp_enqueue_style(...$args) {
		$handle = isset($args[0]) ? (string) $args[0] : '';
		if ($handle !== '') {
			WDP_Test_State::$options['__enqueued_styles'][] = $handle;
		}
	}
}
if (!function_exists('wp_enqueue_script')) {
	function wp_enqueue_script(...$args) {
		$handle = isset($args[0]) ? (string) $args[0] : '';
		if ($handle !== '') {
			WDP_Test_State::$options['__enqueued_scripts'][] = $handle;
		}
	}
}
if (!function_exists('wp_register_script')) {
	function wp_register_script($handle, $src = '', $deps = array(), $ver = false, $args = false) {
		WDP_Test_State::$options['__scripts'][] = array(
			'handle' => (string) $handle,
			'src'    => (string) $src,
			'deps'   => $deps,
		);
		return true;
	}
}
if (!function_exists('wp_set_script_translations')) {
	function wp_set_script_translations($handle, $domain = 'default', $path = null) {
		WDP_Test_State::$options['__script_translations'][] = array(
			'handle' => (string) $handle,
			'domain' => (string) $domain,
			'path'   => (string) $path,
		);
		return true;
	}
}
if (!function_exists('wp_localize_script')) {
	function wp_localize_script($handle, $object_name, $l10n) {
		WDP_Test_State::$options['__localized'][] = array(
			'handle' => (string) $handle,
			'object' => (string) $object_name,
			'l10n'   => $l10n,
		);
		return true;
	}
}
if (!function_exists('register_block_type')) {
	function register_block_type($name, $args = array()) {
		WDP_Test_State::$options['__blocks'][] = is_string($name) ? $name : (string) $name;
		return true;
	}
}
if (!function_exists('admin_url')) {
	function admin_url($path = '') {
		return 'https://example.test/wp-admin/' . ltrim((string) $path, '/');
	}
}
if (!function_exists('wp_create_nonce')) {
	function wp_create_nonce($action = -1) {
		return 'test-nonce-' . (string) $action;
	}
}
if (!function_exists('wp_script_add_data')) {
	function wp_script_add_data(...$args) {}
}
if (!function_exists('rest_url')) {
	function rest_url($path = '') {
		return 'https://example.test/wp-json/' . ltrim((string) $path, '/');
	}
}
if (!function_exists('home_url')) {
	function home_url($path = '') {
		return 'https://example.test' . $path;
	}
}
if (!function_exists('site_url')) {
	function site_url($path = '') {
		return 'https://example.test' . $path;
	}
}
if (!function_exists('set_url_scheme')) {
	function set_url_scheme($url, $scheme = null) {
		return preg_replace('#^[a-z][a-z0-9+.-]*://#i', $scheme . '://', (string) $url);
	}
}
if (!function_exists('wp_parse_url')) {
	function wp_parse_url($url, $component = -1) {
		return $component === -1 ? parse_url((string) $url) : parse_url((string) $url, $component);
	}
}
if (!function_exists('get_locale')) {
	function get_locale() {
		return 'tr_TR';
	}
}
if (!function_exists('determine_locale')) {
	function determine_locale() {
		return 'tr_TR';
	}
}
if (!function_exists('wp_cache_flush_group')) {
	function wp_cache_flush_group($group) {
		return true;
	}
}
if (!function_exists('wp_is_post_revision')) {
	function wp_is_post_revision($post) {
		return false;
	}
}
if (!class_exists('WP_Query')) {
	class WP_Query {
		/** @var array */
		public $posts = array();

		public function __construct($args = array()) {
			$args     = is_array($args) ? $args : array();
			$limit    = isset($args['posts_per_page']) ? (int) $args['posts_per_page'] : 10;
			$paged    = isset($args['paged']) ? max(1, (int) $args['paged']) : 1;
			$include  = isset($args['post__in']) && is_array($args['post__in']) ? array_map('intval', $args['post__in']) : array();
			$exclude  = isset($args['post__not_in']) && is_array($args['post__not_in']) ? array_map('intval', $args['post__not_in']) : array();
			$ids      = array();
			if (!empty($include)) {
				$ids = $include;
			} else {
				$ids = array_keys(WDP_Test_State::$products);
				sort($ids, SORT_NUMERIC);
			}
			$ids = array_values(array_diff($ids, $exclude));
			$offset = ($paged - 1) * max(1, $limit);
			$slice  = array_slice($ids, $offset, max(1, $limit));
			foreach ($slice as $id) {
				$p     = new stdClass();
				$p->ID = (int) $id;
				$this->posts[] = $p;
			}
		}
	}
}
if (!function_exists('wc_get_price_decimals')) {
	function wc_get_price_decimals() {
		return (int) (WDP_Test_State::$price_decimals ?? 2);
	}
}
if (!function_exists('wc_get_price_thousand_separator')) {
	function wc_get_price_thousand_separator() {
		return (string) (WDP_Test_State::$price_thousand ?? '.');
	}
}
if (!function_exists('wc_get_price_decimal_separator')) {
	function wc_get_price_decimal_separator() {
		return (string) (WDP_Test_State::$price_decimal ?? ',');
	}
}
if (!function_exists('wc_get_price_to_display')) {
	function wc_get_price_to_display($product, $args = array()) {
		unset($args);
		if (is_object($product) && method_exists($product, 'get_price')) {
			return $product->get_price();
		}
		return 0;
	}
}
if (!function_exists('get_terms')) {
	function get_terms($args = array()) {
		$include = isset($args['include']) ? array_map('intval', (array) $args['include']) : array();
		$out     = array();
		foreach ($include as $id) {
			if ($id <= 0) {
				continue;
			}
			if (isset(WDP_Test_State::$terms[ $id ])) {
				$out[] = WDP_Test_State::$terms[ $id ];
				continue;
			}
			$t              = new stdClass();
			$t->term_id     = $id;
			$t->slug        = 'term-' . $id;
			$t->name        = 'Term ' . $id;
			$t->parent      = 0;
			$t->term_order  = 0;
			$out[]          = $t;
		}
		return $out;
	}
}

require_once __DIR__ . '/support/fakes.php';
require_once __DIR__ . '/support/os-junk.php';
$GLOBALS['wpdb'] = new WDP_Fake_Wpdb();

require_once WDP_PLUGIN_DIR . 'src/Core/class-autoloader.php';
\DonationPanel\Core\Autoloader::register( WDP_PLUGIN_DIR . 'src' );

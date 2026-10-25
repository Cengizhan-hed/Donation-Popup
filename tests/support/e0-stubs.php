<?php
/**
 * E0 testleri için WordPress REST/Error saplamaları (yalnız test).
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

if (!class_exists('WP_Error')) {
	class WP_Error {
		/** @var string */
		public $code;
		/** @var string */
		public $message;
		/** @var mixed */
		public $data;

		public function __construct($code = '', $message = '', $data = '') {
			$this->code    = (string) $code;
			$this->message = (string) $message;
			$this->data    = $data;
		}

		public function get_error_code() {
			return $this->code;
		}

		public function get_error_message() {
			return $this->message;
		}

		public function get_error_data() {
			return $this->data;
		}
	}
}

if (!class_exists('WP_REST_Request')) {
	class WP_REST_Request {
		/** @var array<string, string> */
		public $headers = array();
		/** @var array<string, mixed> */
		public $params = array();

		public function get_header($key) {
			return $this->headers[ $key ] ?? null;
		}

		public function get_param($key) {
			return $this->params[ $key ] ?? null;
		}
	}
}

if (!class_exists('WP_REST_Response')) {
	class WP_REST_Response {
		/** @var mixed */
		public $data;

		public function __construct($data = null) {
			$this->data = $data;
		}

		public function get_data() {
			return $this->data;
		}
	}
}

/**
 * Kayıtlı REST rotaları (test gözlemi).
 */
final class WDP_E0_Rest_Log {
	/** @var array<int, array{ns: string, route: string, args: array}> */
	public static $routes = array();
}

if (!function_exists('register_rest_route')) {
	function register_rest_route($namespace, $route, $args = array()) {
		WDP_E0_Rest_Log::$routes[] = array(
			'ns'    => (string) $namespace,
			'route' => (string) $route,
			'args'  => (array) $args,
		);
		return true;
	}
}

if (!function_exists('rest_ensure_response')) {
	function rest_ensure_response($response) {
		return $response instanceof WP_REST_Response ? $response : new WP_REST_Response($response);
	}
}

if (!function_exists('esc_html_e')) {
	function esc_html_e($text, $domain = 'default') {
		echo esc_html(__($text, $domain));
	}
}

if (!function_exists('esc_attr_e')) {
	function esc_attr_e($text, $domain = 'default') {
		echo esc_attr(__($text, $domain));
	}
}

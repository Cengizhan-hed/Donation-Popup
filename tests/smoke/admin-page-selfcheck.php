<?php
/**
 * Ayar sayfası sekmelerinin PHP hatası vermeden çıktı üretmesi ve DOM bütünlüğü.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

if (!defined('WDP_PLUGIN_DIR')) {
	fwrite(STDERR, "admin-page-selfcheck: WDP_PLUGIN_DIR missing\n");
	return 1;
}

// Reuse unit stubs (options, esc_*, get_option, …).
require_once dirname(__DIR__) . '/bootstrap-unit.php';

if (!function_exists('submit_button')) {
	function submit_button($text = '', $type = 'primary', $name = 'submit', $wrap = true, $other = array()) {
		echo '<button type="submit" class="button">' . esc_html((string) $text) . '</button>';
	}
}
if (!function_exists('home_url')) {
	function home_url($path = '') {
		return 'https://example.test' . (string) $path;
	}
}
if (!function_exists('admin_url')) {
	function admin_url($path = '') {
		return 'https://example.test/wp-admin/' . ltrim((string) $path, '/');
	}
}
if (!function_exists('get_terms')) {
	function get_terms($args = array()) {
		return array();
	}
}
if (!function_exists('is_wp_error')) {
	function is_wp_error($thing) {
		return false;
	}
}
if (!function_exists('wp_enqueue_script')) {
	function wp_enqueue_script(...$args) {}
}
if (!function_exists('wp_enqueue_style')) {
	function wp_enqueue_style(...$args) {}
}
if (!function_exists('wp_register_style')) {
	function wp_register_style(...$args) {
		return true;
	}
}
if (!function_exists('wp_add_inline_style')) {
	function wp_add_inline_style(...$args) {
		return true;
	}
}
if (!function_exists('wp_create_nonce')) {
	function wp_create_nonce($action = -1) {
		return 'test-nonce';
	}
}
if (!function_exists('get_user_meta')) {
	function get_user_meta($user_id, $key = '', $single = false) {
		return '';
	}
}
if (!function_exists('get_current_user_id')) {
	function get_current_user_id() {
		return 1;
	}
}
if (!function_exists('disabled')) {
	function disabled($disabled, $current = true, $echo = true) {
		$result = ((string) $disabled === (string) $current) ? ' disabled="disabled"' : '';
		if ($echo) {
			echo $result;
		}
		return $result;
	}
}
if (!function_exists('esc_textarea')) {
	function esc_textarea($text) {
		return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
	}
}
if (!function_exists('is_plugin_active')) {
	function is_plugin_active($plugin) {
		return false;
	}
}
if (!function_exists('taxonomy_exists')) {
	function taxonomy_exists($taxonomy) {
		return false;
	}
}
if (!function_exists('esc_html_e')) {
	function esc_html_e($text, $domain = null) {
		echo htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
	}
}
if (!class_exists('WP_Query', false)) {
	class WP_Query {
		/** @var array */
		public $posts = array();
		/** @var int */
		public $found_posts = 0;
		/** @var int */
		public $max_num_pages = 0;
		public function __construct($args = array()) {}
	}
}
if (!class_exists('WP_List_Table', false)) {
	/**
	 * Minimal list table stub for smoke rendering.
	 */
	class WP_List_Table {
		/** @var array */
		public $items = array();
		/** @var array */
		protected $_column_headers = array();

		public function __construct($args = array()) {}
		public function prepare_items() {
			$this->items = array();
		}
		public function get_pagenum() {
			return 1;
		}
		public function set_pagination_args($args) {}
		public function search_box($text, $input_id) {
			echo '<p class="search-box"><input type="search" id="' . esc_attr($input_id) . '" /></p>';
		}
		public function display() {
			echo '<table class="wp-list-table widefat"><tbody><tr><td>smoke</td></tr></tbody></table>';
		}
		public function get_columns() {
			return array();
		}
		protected function get_sortable_columns() {
			return array();
		}
		protected function column_default($item, $column_name) {
			return '';
		}
	}
}

WDP_Test_State::reset();
WDP_Test_State::$caps[] = 'manage_woocommerce';
WDP_Test_State::$caps[] = 'edit_products';
WDP_Test_State::$options['wdp_button_settings']          = array();
WDP_Test_State::$options['wdp_success_settings']         = array();
WDP_Test_State::$options['wdp_shareholder_settings']     = array();
WDP_Test_State::$options['wdp_progress_bar_settings']    = array();
WDP_Test_State::$options['wdp_modal_layout_settings']    = array();
WDP_Test_State::$options[ \DonationPanel\Domain\Placement_Settings::OPTION ] = \DonationPanel\Domain\Placement_Settings::defaults();

$renderers = array(
	'placement'        => array('WDP_Admin_Placement_Tab_Renderer', 'render_tab'),
	'design-studio'    => array('WDP_Admin_Design_Studio_Renderer', 'render_tab'),
	'modal-layout'     => array('WDP_Admin_Layout_Tabs_Renderer', 'render_modal_layout_tab'),
	'normal-form'      => array('WDP_Admin_Form_Tabs_Renderer', 'render_normal_form_tab'),
	'shareholder-form' => array('WDP_Admin_Form_Tabs_Renderer', 'render_shareholder_form_tab'),
	'progress-bar'     => array('WDP_Admin_Layout_Tabs_Renderer', 'render_progress_bar_tab'),
	'success-screen'   => array('WDP_Admin_Form_Tabs_Renderer', 'render_success_screen_tab'),
);

$fail = 0;
foreach ($renderers as $key => $callable) {
	try {
		ob_start();
		call_user_func($callable);
		$out = (string) ob_get_clean();
		if (trim($out) === '') {
			echo "[FAIL] Admin tab renderer produced empty output: {$key}\n";
			$fail++;
		} else {
			echo "[OK] Admin tab renderer output: {$key}\n";
		}
	} catch (Throwable $e) {
		if (ob_get_level() > 0) {
			ob_end_clean();
		}
		echo '[FAIL] Admin tab renderer threw: ' . $key . ' — ' . $e->getMessage() . "\n";
		$fail++;
	}
}

try {
	ob_start();
	WDP_Admin_Page_Renderer::render_settings_page(
		array('WDP_Admin_Layout_Tabs_Renderer', 'render_modal_layout_tab'),
		array('WDP_Admin_Form_Tabs_Renderer', 'render_normal_form_tab'),
		array('WDP_Admin_Form_Tabs_Renderer', 'render_shareholder_form_tab'),
		array('WDP_Admin_Layout_Tabs_Renderer', 'render_progress_bar_tab'),
		array('WDP_Admin_Form_Tabs_Renderer', 'render_success_screen_tab'),
		array('WDP_Admin_Design_Studio_Renderer', 'render_tab')
	);
	$page = (string) ob_get_clean();
} catch (Throwable $e) {
	if (ob_get_level() > 0) {
		ob_end_clean();
	}
	echo '[FAIL] Full settings page render threw: ' . $e->getMessage() . "\n";
	return 1;
}

if (strpos($page, 'Bağış formu çizilemedi') !== false) {
	echo "[FAIL] Settings page contains render-guard admin notice\n";
	$fail++;
} else {
	echo "[OK] Settings page has no render-guard admin notice\n";
}

$wrapped = '<?xml encoding="utf-8"><div id="wdp-smoke-root">' . $page . '</div>';
$dom     = new DOMDocument();
$prev    = libxml_use_internal_errors(true);
$loaded  = $dom->loadHTML($wrapped, LIBXML_NOERROR | LIBXML_NOWARNING | LIBXML_NONET);
libxml_clear_errors();
libxml_use_internal_errors($prev);

if (!$loaded) {
	echo "[FAIL] Settings page DOMDocument parse failed\n";
	return 1;
}

$xpath  = new DOMXPath($dom);
$shells = $xpath->query('//*[@class="wdp-admin-shell" or contains(concat(" ", normalize-space(@class), " "), " wdp-admin-shell ")]');
if (!$shells || $shells->length < 1) {
	echo "[FAIL] .wdp-admin-shell not found in settings page\n";
	return 1;
}

$shell = $shells->item(0);
$panels = 0;
foreach ($shell->childNodes as $child) {
	if ($child->nodeType !== XML_ELEMENT_NODE) {
		continue;
	}
	/** @var DOMElement $child */
	$id = $child->getAttribute('id');
	$class = ' ' . $child->getAttribute('class') . ' ';
	if ($id !== '' && (strpos($id, 'wdp-') === 0 && substr($id, -4) === '-tab' || strpos($class, ' wdp-tab-content ') !== false || strpos($class, ' nav-tab-wrapper ') !== false || strpos($class, ' wdp-nav-tab-wrapper ') !== false)) {
		$panels++;
	}
}

if ($panels < 2) {
	echo "[FAIL] Expected tab panels as direct children of .wdp-admin-shell (found {$panels})\n";
	$fail++;
} else {
	echo "[OK] Tab panels are direct children of .wdp-admin-shell ({$panels})\n";
}

// Unclosed tags: DOMDocument recovery would still load; compare tag balance for panel wrappers.
if (substr_count($page, '<div') < substr_count($page, '</div>')) {
	echo "[FAIL] Settings page has more closing </div> than opening <div>\n";
	$fail++;
} else {
	echo "[OK] Settings page div tag counts are balanced or open-heavy\n";
}

return $fail;

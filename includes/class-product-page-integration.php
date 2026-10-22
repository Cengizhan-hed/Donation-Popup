<?php
/**
 * WooCommerce sayfalarında "Sepete Ekle" yerine bağış formu/butonu; şablon override, döngü, fiyat.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Front-end product page and loop integration.
 *
 * Primary path: replace WooCommerce simple add-to-cart template (theme/builder agnostic).
 * Fallback: summary hooks when the template filter did not run in this request.
 * Avada Layouts without a WooCommerce Add to cart element need a shortcode in the layout.
 */
class WDP_Product_Page_Integration {

	/** Relative WooCommerce template we override. */
	const SIMPLE_ATC_TEMPLATE = 'single-product/add-to-cart/simple.php';

	/** @var bool */
	private static $css_printed = false;

	/** @var bool Template filter returned our file at least once this request. */
	private static $template_override_used = false;

	/** @var bool Filters registered for this request. */
	private static $hooks_added = false;

	/**
	 * Front-end only. WooCommerce filters are registered only when the setting is on.
	 *
	 * @return void
	 */
	public static function init() {
		if (is_admin() && !(function_exists('wp_doing_ajax') && wp_doing_ajax())) {
			return;
		}

		if (WDP_Placement_Settings::value('auto_place') !== 'yes') {
			return;
		}

		self::$hooks_added = true;

		add_action('wp', array(__CLASS__, 'on_wp'), 20);
		add_filter('body_class', array(__CLASS__, 'body_class'));
		add_filter('post_class', array(__CLASS__, 'post_class'), 10, 3);
		add_action('wp_head', array(__CLASS__, 'print_hide_cart_css'), 30);

		add_filter('wc_get_template', array(__CLASS__, 'filter_wc_get_template'), 20, 5);
		add_filter('woocommerce_locate_template', array(__CLASS__, 'filter_locate_template'), 20, 3);

		add_filter('woocommerce_get_price_html', array(__CLASS__, 'filter_price_html'), 20, 2);
		add_filter('woocommerce_loop_add_to_cart_link', array(__CLASS__, 'filter_loop_add_to_cart'), 10, 3);
		add_filter('woocommerce_product_add_to_cart_text', array(__CLASS__, 'filter_add_to_cart_text'), 20, 2);
		add_filter('woocommerce_product_add_to_cart_url', array(__CLASS__, 'filter_add_to_cart_url'), 20, 2);
		add_filter('woocommerce_product_supports', array(__CLASS__, 'filter_product_supports'), 20, 3);

		add_filter('render_block_woocommerce/add-to-cart-form', array(__CLASS__, 'filter_block_add_to_cart'), 10, 3);
		add_filter('render_block_woocommerce/add-to-cart-with-options', array(__CLASS__, 'filter_block_add_to_cart'), 10, 3);
		add_filter('render_block_woocommerce/product-price', array(__CLASS__, 'filter_block_price'), 10, 3);
		add_filter('render_block_woocommerce/product-button', array(__CLASS__, 'filter_block_product_button'), 10, 3);

		add_action('woocommerce_after_single_product', array(__CLASS__, 'render_builder_fallback'), 5);
		add_action('wp_footer', array(__CLASS__, 'render_builder_fallback'), 4);
	}

	/**
	 * @return bool
	 */
	public static function hooks_added() {
		return self::$hooks_added;
	}

	/**
	 * @return bool
	 */
	public static function template_override_used() {
		return self::$template_override_used;
	}

	/**
	 * Register fallback summary placement after we know the queried product.
	 *
	 * @return void
	 */
	public static function on_wp() {
		if (!function_exists('is_product') || !is_product()) {
			return;
		}
		$product = self::current_product();
		if (!$product || !WDP_Donation_Scope::is_donation_product($product)) {
			return;
		}
		if (!self::should_auto_place($product)) {
			return;
		}

		// Backup only: if the template filter never runs, still try summary hooks.
		$position = (string) WDP_Placement_Settings::value('position', 'replace_cart');
		if ($position === 'below_summary') {
			add_action('woocommerce_after_single_product_summary', array(__CLASS__, 'render_fallback_placed_form'), 5);
			return;
		}
		$priority = ($position === 'after_excerpt') ? 21 : 30;
		add_action('woocommerce_single_product_summary', array(__CLASS__, 'render_fallback_placed_form'), $priority);
	}

	/**
	 * Swap the simple add-to-cart template for donation products.
	 *
	 * @param string $template      Located path.
	 * @param string $template_name Relative name.
	 * @param array  $args          Template args.
	 * @param string $template_path WC template path.
	 * @param string $default_path  Default path.
	 * @return string
	 */
	public static function filter_wc_get_template($template, $template_name, $args = array(), $template_path = '', $default_path = '') {
		if ((string) $template_name !== self::SIMPLE_ATC_TEMPLATE) {
			return $template;
		}
		if (!self::should_override_current_product()) {
			return $template;
		}
		$path = self::plugin_simple_template_path();
		if ($path === '' || !is_readable($path)) {
			return $template;
		}
		self::$template_override_used = true;
		return $path;
	}

	/**
	 * Secondary locate filter for themes that bypass wc_get_template.
	 *
	 * @param string $template      Located path.
	 * @param string $template_name Relative name.
	 * @param string $template_path Path prefix.
	 * @return string
	 */
	public static function filter_locate_template($template, $template_name, $template_path = '') {
		if ((string) $template_name !== self::SIMPLE_ATC_TEMPLATE) {
			return $template;
		}
		if (!self::should_override_current_product()) {
			return $template;
		}
		$path = self::plugin_simple_template_path();
		if ($path === '' || !is_readable($path)) {
			return $template;
		}
		self::$template_override_used = true;
		return $path;
	}

	/**
	 * Absolute path to the plugin's simple add-to-cart override.
	 *
	 * @return string
	 */
	public static function plugin_simple_template_path() {
		if (!defined('WDP_PLUGIN_DIR')) {
			return '';
		}
		return WDP_PLUGIN_DIR . 'templates/woocommerce/' . self::SIMPLE_ATC_TEMPLATE;
	}

	/**
	 * Echo donation UI from the overridden WooCommerce template.
	 *
	 * @return void
	 */
	public static function render_template_override() {
		echo WDP_Render_Guard::html( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			static function () {
				return self::template_override_markup();
			},
			self::current_product_id(),
			'template_override'
		);
	}

	/**
	 * @return string
	 */
	public static function template_override_markup() {
		$product = self::current_product();
		if (!$product || !WDP_Donation_Scope::is_donation_product($product)) {
			return '';
		}
		$id = (int) $product->get_id();
		if (WDP_Render_Registry::has_product_ui($id)) {
			return WDP_Render_Registry::duplicate_ui_notice($id);
		}
		if (!self::should_auto_place($product)) {
			return '';
		}
		return self::placed_markup();
	}

	/**
	 * Builder layouts (Elementor / Avada) that omit the Woo add-to-cart element never
	 * hit the template override or summary hooks. auto_place=yes still means the
	 * Donate control belongs on the product page; print it once if nothing else did.
	 *
	 * @return void
	 */
	public static function render_builder_fallback() {
		if (!function_exists('is_product') || !is_product()) {
			return;
		}
		if (self::$template_override_used) {
			return;
		}
		$product = self::current_product();
		if (!$product || !WDP_Donation_Scope::is_donation_product($product)) {
			return;
		}
		if (WDP_Render_Registry::has_product_ui((int) $product->get_id())) {
			return;
		}
		if (!self::should_auto_place($product)) {
			return;
		}
		echo '<div class="wdp-auto-place-fallback">'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		self::render_placed_form();
		echo '</div>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Fallback when the template filter did not run; never doubles after a successful override.
	 *
	 * @return void
	 */
	public static function render_fallback_placed_form() {
		if (self::$template_override_used) {
			return;
		}
		$product = self::current_product();
		if (!$product) {
			return;
		}
		if (WDP_Render_Registry::has_product_ui((int) $product->get_id())) {
			if (function_exists('current_user_can') && current_user_can('edit_products')) {
				echo WDP_Render_Registry::duplicate_ui_notice((int) $product->get_id()); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			}
			return;
		}
		self::render_placed_form();
	}

	/**
	 * @param string[] $classes Body classes.
	 * @return string[]
	 */
	public static function body_class($classes) {
		$classes = is_array($classes) ? $classes : array();
		if (function_exists('is_product') && is_product()) {
			$product = self::current_product();
			if ($product && WDP_Donation_Scope::is_donation_product($product)) {
				$classes[] = 'wdp-donation-product';
			}
		}
		return $classes;
	}

	/**
	 * @param string[] $classes CSS classes.
	 * @param string[] $extra   Extra classes.
	 * @param int      $post_id Post ID.
	 * @return string[]
	 */
	public static function post_class($classes, $extra = array(), $post_id = 0) {
		$classes = is_array($classes) ? $classes : array();
		$post_id = absint($post_id);
		if ($post_id <= 0) {
			return $classes;
		}
		if (WDP_Donation_Scope::is_donation_product($post_id)) {
			$classes[] = 'wdp-donation-product';
		}
		return $classes;
	}

	/**
	 * Hide a theme-reintroduced native cart form (plugin form/button keep their classes).
	 *
	 * @return void
	 */
	public static function print_hide_cart_css() {
		if (self::$css_printed) {
			return;
		}
		if (!function_exists('is_product') || !is_product()) {
			return;
		}
		$product = self::current_product();
		if (!$product || !WDP_Donation_Scope::is_donation_product($product) || !self::should_auto_place($product)) {
			return;
		}
		self::$css_printed = true;
		echo '<style id="wdp-hide-native-cart">.wdp-donation-product form.cart:not(.wdp-form):not(.wdp-donation-form-fields){display:none!important}</style>' . "\n";
	}

	/**
	 * @return void
	 */
	public static function render_placed_form() {
		echo WDP_Render_Guard::html( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			static function () {
				return self::placed_markup();
			},
			self::current_product_id(),
			'auto_place'
		);
	}

	/**
	 * @return string
	 */
	public static function placed_markup() {
		$product = self::current_product();
		if (!$product || !WDP_Donation_Scope::is_donation_product($product)) {
			return '';
		}
		if (self::content_already_has_shortcode($product)) {
			return '';
		}
		$display = (string) WDP_Placement_Settings::value('display', 'button_panel');
		$atts    = array(
			'show_title' => WDP_Placement_Settings::value('show_form_title') === 'yes' ? 'yes' : 'no',
		);
		if ($display === 'button_popup') {
			return WDP_Shortcodes::render_button($atts, 'wdp_donation_button', 'popup');
		}
		if ($display === 'button_panel') {
			return WDP_Shortcodes::render_button($atts, 'wdp_donation_button_panel', 'side_panel');
		}
		return WDP_Shortcodes::render_form($atts);
	}

	/**
	 * Hide price for open-amount and campaign donation products when hide_price=yes.
	 * Fixed and share products keep their price. Never blank in admin/cart/checkout/email/REST.
	 *
	 * @param string     $html    Price HTML.
	 * @param WC_Product $product Product.
	 * @return string
	 */
	public static function filter_price_html($html, $product) {
		if (WDP_Placement_Settings::value('hide_price') !== 'yes') {
			return $html;
		}
		if (self::should_preserve_price_html_context()) {
			return $html;
		}
		if (!WDP_Product_Resolver::is_wc_product($product) || !WDP_Donation_Scope::is_donation_product($product)) {
			return $html;
		}
		$type = WDP_Donation_Type::for_product($product->get_id());
		if (in_array($type, array(WDP_Donation_Type::CUSTOM, WDP_Donation_Type::CAMPAIGN), true)) {
			return '';
		}
		return $html;
	}

	/**
	 * @param string     $html    Button HTML.
	 * @param WC_Product $product Product.
	 * @param array      $args    Args.
	 * @return string
	 */
	public static function filter_loop_add_to_cart($html, $product, $args = array()) {
		return WDP_Render_Guard::value(
			static function () use ($html, $product) {
				return self::loop_button_html($html, $product);
			},
			$html,
			'loop_button'
		);
	}

	/**
	 * @param string     $html    Original.
	 * @param WC_Product $product Product.
	 * @return string
	 */
	public static function loop_button_html($html, $product) {
		if (!WDP_Product_Resolver::is_wc_product($product) || !WDP_Donation_Scope::is_donation_product($product)) {
			return $html;
		}
		$mode = (string) WDP_Placement_Settings::value('loop_button', 'panel');
		if ($mode === 'off') {
			return $html;
		}
		WDP_Assets::force_enqueue();
		$url  = method_exists($product, 'get_permalink') ? $product->get_permalink() : get_permalink($product->get_id());
		$text = WDP_Shortcodes::resolve_button_text('');
		$id   = (int) $product->get_id();
		$cls  = 'button wdp-loop-donate';
		$goal_closed = class_exists('WDP_Campaign_Goal') && WDP_Campaign_Goal::should_block_new_donations($product);
		if ($goal_closed) {
			$cls .= ' is-disabled wdp-goal-closed-trigger';
		}
		if ($mode === 'popup' || $mode === 'panel') {
			$cls_extra = $mode === 'panel' ? ' wdp-open-modal wdp-open-side-panel' : ' wdp-open-modal';
			$attrs     = ' type="button" class="' . esc_attr($cls . $cls_extra) . '" data-product-id="' . esc_attr((string) $id) . '" data-wdp-lazy="1" data-wdp-mode="' . esc_attr($mode === 'panel' ? 'side_panel' : 'popup') . '"';
			if ($goal_closed) {
				$attrs .= ' aria-disabled="true" data-wdp-goal-closed="1" data-wdp-goal-message="' . esc_attr(WDP_Campaign_Goal::resolve_message($product)) . '"';
			}
			return '<button' . $attrs . '>' . esc_html($text) . '</button>';
		}
		$attrs = ' href="' . esc_url($url) . '" class="' . esc_attr($cls) . '"';
		if ($goal_closed) {
			$attrs .= ' aria-disabled="true" data-wdp-goal-closed="1" data-wdp-goal-message="' . esc_attr(WDP_Campaign_Goal::resolve_message($product)) . '"';
		}
		return '<a' . $attrs . '>' . esc_html($text) . '</a>';
	}

	/**
	 * Themes that draw their own loop button text.
	 *
	 * @param string     $text    Default text.
	 * @param WC_Product $product Product.
	 * @return string
	 */
	public static function filter_add_to_cart_text($text, $product = null) {
		if (!WDP_Product_Resolver::is_wc_product($product) || !WDP_Donation_Scope::is_donation_product($product)) {
			return $text;
		}
		if ((string) WDP_Placement_Settings::value('loop_button', 'panel') === 'off') {
			return $text;
		}
		return WDP_Shortcodes::resolve_button_text('');
	}

	/**
	 * Point loop URLs at the product page (no direct add-to-cart).
	 *
	 * @param string     $url     URL.
	 * @param WC_Product $product Product.
	 * @return string
	 */
	public static function filter_add_to_cart_url($url, $product = null) {
		if (!WDP_Product_Resolver::is_wc_product($product) || !WDP_Donation_Scope::is_donation_product($product)) {
			return $url;
		}
		if ((string) WDP_Placement_Settings::value('loop_button', 'panel') === 'off') {
			return $url;
		}
		$permalink = method_exists($product, 'get_permalink') ? $product->get_permalink() : get_permalink($product->get_id());
		return $permalink ? $permalink : $url;
	}

	/**
	 * Disable AJAX add-to-cart support on donation products in loops.
	 *
	 * @param bool       $supports Whether supported.
	 * @param string     $feature  Feature name.
	 * @param WC_Product $product  Product.
	 * @return bool
	 */
	public static function filter_product_supports($supports, $feature, $product = null) {
		if ((string) $feature !== 'ajax_add_to_cart') {
			return $supports;
		}
		if (!WDP_Product_Resolver::is_wc_product($product) || !WDP_Donation_Scope::is_donation_product($product)) {
			return $supports;
		}
		return false;
	}

	/**
	 * Block themes: replace add-to-cart block with the donation form on donation products.
	 *
	 * @param string   $content Block HTML.
	 * @param array    $block   Parsed block.
	 * @param WP_Block $instance Block instance.
	 * @return string
	 */
	public static function filter_block_add_to_cart($content, $block, $instance = null) {
		return WDP_Render_Guard::value(
			static function () use ($content, $instance) {
				$product = self::product_from_block($instance);
				if (!$product || !WDP_Donation_Scope::is_donation_product($product) || !self::should_auto_place($product)) {
					return $content;
				}
				if (self::content_already_has_shortcode($product) || WDP_Render_Registry::has_product_ui($product->get_id())) {
					return WDP_Render_Registry::duplicate_ui_notice((int) $product->get_id());
				}
				return self::placed_markup();
			},
			$content,
			'block_add_to_cart'
		);
	}

	/**
	 * @param string   $content  HTML.
	 * @param array    $block    Parsed block.
	 * @param WP_Block $instance Instance.
	 * @return string
	 */
	public static function filter_block_price($content, $block, $instance = null) {
		if (WDP_Placement_Settings::value('hide_price') !== 'yes') {
			return $content;
		}
		if (self::should_preserve_price_html_context()) {
			return $content;
		}
		$product = self::product_from_block($instance);
		if (!$product || !WDP_Donation_Scope::is_donation_product($product)) {
			return $content;
		}
		$type = WDP_Donation_Type::for_product($product->get_id());
		if (!in_array($type, array(WDP_Donation_Type::CUSTOM, WDP_Donation_Type::CAMPAIGN), true)) {
			return $content;
		}
		return '';
	}

	/**
	 * @param string   $content  HTML.
	 * @param array    $block    Parsed block.
	 * @param WP_Block $instance Instance.
	 * @return string
	 */
	public static function filter_block_product_button($content, $block, $instance = null) {
		return WDP_Render_Guard::value(
			static function () use ($content, $instance) {
				$product = self::product_from_block($instance);
				if (!$product) {
					return $content;
				}
				return self::loop_button_html($content, $product);
			},
			$content,
			'block_product_button'
		);
	}

	/**
	 * Auto-place unless the product override or a shortcode is already in the product content.
	 *
	 * @param WC_Product $product Product.
	 * @return bool
	 */
	public static function should_auto_place($product) {
		if (!WDP_Product_Resolver::is_wc_product($product) || !WDP_Donation_Scope::is_donation_product($product)) {
			return false;
		}
		$override = $product->get_meta('_wdp_auto_place', true);
		if ($override === 'no') {
			return false;
		}
		if (WDP_Placement_Settings::value('auto_place') !== 'yes') {
			return false;
		}
		return !self::content_already_has_shortcode($product);
	}

	/**
	 * @param WC_Product $product Product.
	 * @return bool
	 */
	public static function content_already_has_shortcode($product) {
		$excerpt = (string) $product->get_short_description();
		$content = (string) $product->get_description();
		return self::text_has_wdp_shortcode($excerpt) || self::text_has_wdp_shortcode($content);
	}

	/**
	 * @param string $text HTML/content.
	 * @return bool
	 */
	public static function text_has_wdp_shortcode($text) {
		if (!is_string($text) || $text === '' || !function_exists('has_shortcode')) {
			return false;
		}
		return has_shortcode($text, 'wdp_donation_form')
			|| has_shortcode($text, 'wdp_donation_button')
			|| has_shortcode($text, 'wdp_donation_button_panel');
	}

	/**
	 * @return bool
	 */
	private static function should_override_current_product() {
		$product = self::current_product();
		if (!$product || !WDP_Donation_Scope::is_donation_product($product)) {
			return false;
		}
		$override = $product->get_meta('_wdp_auto_place', true);
		if ($override === 'no') {
			return false;
		}
		return WDP_Placement_Settings::value('auto_place') === 'yes';
	}

	/**
	 * Contexts where price HTML must never be blanked.
	 *
	 * @return bool
	 */
	public static function should_preserve_price_html_context() {
		if (function_exists('is_admin') && is_admin() && !(function_exists('wp_doing_ajax') && wp_doing_ajax())) {
			return true;
		}
		if (function_exists('is_cart') && is_cart()) {
			return true;
		}
		if (function_exists('is_checkout') && is_checkout()) {
			return true;
		}
		if (defined('REST_REQUEST') && REST_REQUEST) {
			return true;
		}
		if (function_exists('did_action') && did_action('woocommerce_email_header')) {
			return true;
		}
		if (function_exists('wp_doing_ajax') && wp_doing_ajax()) {
			$wc_ajax = isset($_REQUEST['wc-ajax']) ? sanitize_key(wp_unslash((string) $_REQUEST['wc-ajax'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ($wc_ajax !== '' && (strpos($wc_ajax, 'fragment') !== false || strpos($wc_ajax, 'cart') !== false || $wc_ajax === 'get_refreshed_fragments')) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @return WC_Product|null
	 */
	private static function current_product() {
		if (function_exists('wc_get_product')) {
			$id = self::current_product_id();
			if ($id > 0) {
				$product = wc_get_product($id);
				if (WDP_Product_Resolver::is_wc_product($product)) {
					return $product;
				}
			}
		}
		$loop = isset($GLOBALS['product']) ? $GLOBALS['product'] : null;
		return WDP_Product_Resolver::is_wc_product($loop) ? $loop : null;
	}

	/**
	 * @return int
	 */
	private static function current_product_id() {
		if (function_exists('get_queried_object_id')) {
			return absint(get_queried_object_id());
		}
		return function_exists('get_the_ID') ? absint(get_the_ID()) : 0;
	}

	/**
	 * @param WP_Block|null $instance Block instance.
	 * @return WC_Product|null
	 */
	private static function product_from_block($instance) {
		$post_id = 0;
		if (is_object($instance) && isset($instance->context['postId'])) {
			$post_id = absint($instance->context['postId']);
		}
		if ($post_id <= 0) {
			$post_id = self::current_product_id();
		}
		if ($post_id <= 0 || !function_exists('wc_get_product')) {
			return null;
		}
		$product = wc_get_product($post_id);
		return WDP_Product_Resolver::is_wc_product($product) ? $product : null;
	}

	/**
	 * Reset request flags (unit tests).
	 *
	 * @return void
	 */
	public static function reset_request_flags() {
		self::$css_printed            = false;
		self::$template_override_used = false;
		self::$hooks_added            = false;
	}
}

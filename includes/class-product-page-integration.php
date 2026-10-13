<?php
/**
 * Ürün sayfasına otomatik yerleşim, sepete ekle gizleme, döngü butonu ve blok şablon uyumu.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Front-end product page and loop integration. Avada Layouts without WC hooks are skipped
 * (place an id-less shortcode in the layout once).
 */
class WDP_Product_Page_Integration {

	/** @var bool */
	private static $in_loop = false;

	/** @var bool */
	private static $css_printed = false;

	/**
	 * Front-end only.
	 *
	 * @return void
	 */
	public static function init() {
		if (is_admin() && !(function_exists('wp_doing_ajax') && wp_doing_ajax())) {
			return;
		}

		add_action('wp', array(__CLASS__, 'on_wp'), 20);
		add_filter('body_class', array(__CLASS__, 'body_class'));
		add_filter('post_class', array(__CLASS__, 'post_class'), 10, 3);
		add_action('wp_head', array(__CLASS__, 'print_hide_cart_css'), 30);

		add_action('woocommerce_before_shop_loop_item', array(__CLASS__, 'loop_enter'), 1);
		add_action('woocommerce_after_shop_loop_item', array(__CLASS__, 'loop_leave'), 99);
		add_filter('woocommerce_get_price_html', array(__CLASS__, 'filter_loop_price_html'), 20, 2);
		add_filter('woocommerce_loop_add_to_cart_link', array(__CLASS__, 'filter_loop_add_to_cart'), 10, 3);

		add_filter('render_block_woocommerce/add-to-cart-form', array(__CLASS__, 'filter_block_add_to_cart'), 10, 3);
		add_filter('render_block_woocommerce/add-to-cart-with-options', array(__CLASS__, 'filter_block_add_to_cart'), 10, 3);
		add_filter('render_block_woocommerce/product-price', array(__CLASS__, 'filter_block_price'), 10, 3);
		add_filter('render_block_woocommerce/product-button', array(__CLASS__, 'filter_block_product_button'), 10, 3);
	}

	/**
	 * Classic PHP templates: hook the single product summary once we know the queried product.
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

		self::hide_add_to_cart_hooks();
		if (WDP_Placement_Settings::value('hide_price') === 'yes') {
			self::hide_price_hooks();
		}

		if (!self::should_auto_place($product)) {
			return;
		}

		$position = (string) WDP_Placement_Settings::value('position', 'replace_cart');
		if ($position === 'below_summary') {
			add_action('woocommerce_after_single_product_summary', array(__CLASS__, 'render_placed_form'), 5);
			return;
		}
		$priority = ($position === 'after_excerpt') ? 21 : 30;
		add_action('woocommerce_single_product_summary', array(__CLASS__, 'render_placed_form'), $priority);
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
	 * Hide the native cart form even when a theme re-adds it at a custom priority.
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
		if (!$product || !WDP_Donation_Scope::is_donation_product($product)) {
			return;
		}
		self::$css_printed = true;
		echo '<style id="wdp-hide-native-cart">.wdp-donation-product form.cart:not(.wdp-form):not(.wdp-donation-form-fields){display:none!important}</style>' . "\n";
	}

	/**
	 * @return void
	 */
	public static function render_placed_form() {
		echo WDP_Render_Guard::html(
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
		$display = (string) WDP_Placement_Settings::value('display', 'inline');
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
	 * @return void
	 */
	public static function loop_enter() {
		self::$in_loop = true;
	}

	/**
	 * @return void
	 */
	public static function loop_leave() {
		self::$in_loop = false;
	}

	/**
	 * Hide loop price for open-amount and campaign donation products when hide_price=yes.
	 * Fixed and share products keep their price.
	 *
	 * @param string     $html    Price HTML.
	 * @param WC_Product $product Product.
	 * @return string
	 */
	public static function filter_loop_price_html($html, $product) {
		if (!self::$in_loop || WDP_Placement_Settings::value('hide_price') !== 'yes') {
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
		$mode = (string) WDP_Placement_Settings::value('loop_button', 'link');
		if ($mode === 'off') {
			return $html;
		}
		WDP_Assets::force_enqueue();
		$url  = method_exists($product, 'get_permalink') ? $product->get_permalink() : get_permalink($product->get_id());
		$text = WDP_Shortcodes::resolve_button_text('');
		$id   = (int) $product->get_id();
		$cls  = 'button wdp-loop-donate';
		$attrs = ' href="' . esc_url($url) . '" class="' . esc_attr($cls) . '"';
		if ($mode === 'popup' || $mode === 'panel') {
			$attrs .= ' data-product-id="' . esc_attr((string) $id) . '" data-wdp-lazy="1" data-wdp-mode="' . esc_attr($mode === 'panel' ? 'side_panel' : 'popup') . '"';
			$cls_extra = $mode === 'panel' ? ' wdp-open-modal wdp-open-side-panel' : ' wdp-open-modal';
			$attrs = str_replace(' class="' . esc_attr($cls) . '"', ' class="' . esc_attr($cls . $cls_extra) . '"', $attrs);
		}
		return '<a' . $attrs . '>' . esc_html($text) . '</a>';
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
				if (self::content_already_has_shortcode($product) || WDP_Render_Registry::has_form($product->get_id())) {
					return '';
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
		$product = self::product_from_block($instance);
		if (!$product || !WDP_Donation_Scope::is_donation_product($product)) {
			return $content;
		}
		$is_single = (function_exists('is_product') && is_product()) || self::block_is_single_product($instance);
		if (!$is_single) {
			$type = WDP_Donation_Type::for_product($product->get_id());
			if (!in_array($type, array(WDP_Donation_Type::CUSTOM, WDP_Donation_Type::CAMPAIGN), true)) {
				return $content;
			}
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
		if (WDP_Render_Registry::has_form($product->get_id())) {
			return false;
		}
		return !self::content_already_has_shortcode($product);
	}

	/**
	 * @param WC_Product $product Product.
	 * @return bool
	 */
	public static function content_already_has_shortcode($product) {
		$id = (int) $product->get_id();
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
	 * @return void
	 */
	private static function hide_add_to_cart_hooks() {
		$hook = 'woocommerce_single_product_summary';
		$priority = has_action($hook, 'woocommerce_template_single_add_to_cart');
		if ($priority !== false) {
			remove_action($hook, 'woocommerce_template_single_add_to_cart', $priority);
		}
	}

	/**
	 * @return void
	 */
	private static function hide_price_hooks() {
		$hook = 'woocommerce_single_product_summary';
		$priority = has_action($hook, 'woocommerce_template_single_price');
		if ($priority !== false) {
			remove_action($hook, 'woocommerce_template_single_price', $priority);
		}
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
	 * @param WP_Block|null $instance Block.
	 * @return bool
	 */
	private static function block_is_single_product($instance) {
		if (function_exists('is_product') && is_product()) {
			return true;
		}
		if (is_object($instance) && !empty($instance->context['postType']) && $instance->context['postType'] === 'product') {
			return empty($instance->context['queryId']);
		}
		return false;
	}
}

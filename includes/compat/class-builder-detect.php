<?php
/**
 * Avada, Elementor, Gutenberg, Divi, Bricks ve Beaver Builder düzenleyici/önizleme tespiti (yalnızca bu dosya).
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Detects page-builder editors and previews. Theme/builder-specific code lives only here.
 */
class WDP_Builder_Detect {

	/** @var bool|null */
	private static $is_preview = null;

	/** @var object|null|false */
	private static $preview_product = false;

	/**
	 * Current request is a builder editor or preview AND the user may edit products.
	 *
	 * Visitors never see a sample product.
	 *
	 * @return bool
	 */
	public static function is_builder_preview() {
		if (self::$is_preview !== null) {
			return self::$is_preview;
		}
		self::$is_preview = false;
		if (!function_exists('current_user_can') || !current_user_can('edit_products')) {
			return false;
		}
		self::$is_preview = self::avada() || self::elementor() || self::gutenberg() || self::divi() || self::bricks() || self::beaver();
		return self::$is_preview;
	}

	/**
	 * Sample (or Avada-selected) donation product for builder canvases.
	 *
	 * @return WC_Product|null
	 */
	public static function preview_product() {
		if (!self::is_builder_preview()) {
			return null;
		}
		if (self::$preview_product !== false) {
			return self::$preview_product ? self::$preview_product : null;
		}

		$product = self::avada_dynamic_product();
		if (!$product) {
			$product = self::latest_donation_product();
		}

		/**
		 * Override the product shown on builder canvases.
		 *
		 * @param WC_Product|null $product Preview product.
		 */
		$filtered = apply_filters('wdp_builder_preview_product', $product);
		self::$preview_product = (is_object($filtered) && method_exists($filtered, 'get_id')) ? $filtered : null;
		return self::$preview_product;
	}

	/**
	 * Admin-only note shown above a preview form/button.
	 *
	 * @param object $product WC_Product.
	 * @return string
	 */
	public static function preview_notice($product) {
		if (!self::is_builder_preview() || !is_object($product) || !method_exists($product, 'get_name')) {
			return '';
		}
		$name = $product->get_name();
		/* translators: %s: sample product name */
		return WDP_Utils::admin_notice_html(sprintf(__('Önizleme: «%s» gösteriliyor. Ürün sayfasında o ürünün formu görünür.', 'woo-donation-popup'), $name));
	}

	/**
	 * @return void
	 */
	public static function reset() {
		self::$is_preview      = null;
		self::$preview_product = false;
	}

	/**
	 * Site theme/builder context for the setup guide (FAZ 7.1).
	 *
	 * @return array{type:string,recommended:string,reason:string,label:string,has_product_template:bool}
	 */
	public static function detect_site_context() {
		$has_avada_product_layout = self::avada_has_product_layout();
		$has_elementor_product    = self::elementor_has_product_template();
		$is_block_theme           = function_exists('wp_is_block_theme') && wp_is_block_theme();

		if ($has_avada_product_layout || (defined('AVADA_VERSION') || class_exists('FusionBuilder'))) {
			return array(
				'type'                 => 'avada',
				'recommended'          => 'template_shortcode',
				'reason'               => __('Avada algılandı ve ürünleriniz bir Avada Layout kullanıyor. Bu yüzden otomatik yerleşim çalışmaz; şablona bir kez kısa kod ekleyin.', 'woo-donation-popup'),
				'label'                => __('Avada', 'woo-donation-popup'),
				'has_product_template' => $has_avada_product_layout,
			);
		}

		if ($has_elementor_product || (defined('ELEMENTOR_VERSION') && defined('ELEMENTOR_PRO_VERSION'))) {
			return array(
				'type'                 => 'elementor',
				'recommended'          => 'template_shortcode',
				'reason'               => __('Elementor Pro Theme Builder ürün şablonu algılandı. Bağış widget’ını şablona bir kez ekleyin; otomatik yerleşim tema şablonuyla çakışabilir.', 'woo-donation-popup'),
				'label'                => __('Elementor', 'woo-donation-popup'),
				'has_product_template' => $has_elementor_product,
			);
		}

		if ($is_block_theme) {
			return array(
				'type'                 => 'block',
				'recommended'          => 'auto',
				'reason'               => __('Blok tema algılandı. Otomatik yerleşim çoğu durumda yeterlidir; isterseniz ürün şablonuna «Bağış formu» bloğu ekleyebilirsiniz.', 'woo-donation-popup'),
				'label'                => __('Blok tema', 'woo-donation-popup'),
				'has_product_template' => false,
			);
		}

		return array(
			'type'                 => 'classic',
			'recommended'          => 'auto',
			'reason'               => __('Klasik tema algılandı. Otomatik yerleşim önerilir; WooCommerce ürün şablonuna müdahale etmeden form eklenir.', 'woo-donation-popup'),
			'label'                => __('Klasik tema', 'woo-donation-popup'),
			'has_product_template' => false,
		);
	}

	/**
	 * @return bool
	 */
	private static function avada_has_product_layout() {
		if (!function_exists('post_type_exists')) {
			return false;
		}
		if (!post_type_exists('fusion_tb_section') && !post_type_exists('fusion_tb_layout')) {
			return false;
		}
		$q = new WP_Query(
			array(
				'post_type'      => array('fusion_tb_section', 'fusion_tb_layout'),
				'post_status'    => 'publish',
				'posts_per_page' => 5,
				's'              => 'product',
				'fields'         => 'ids',
			)
		);
		$found = $q->have_posts();
		wp_reset_postdata();
		return $found;
	}

	/**
	 * @return bool
	 */
	private static function elementor_has_product_template() {
		if (!function_exists('post_type_exists') || !post_type_exists('elementor_library')) {
			return false;
		}
		$q = new WP_Query(
			array(
				'post_type'      => 'elementor_library',
				'post_status'    => 'publish',
				'posts_per_page' => 5,
				'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
					array(
						'key'     => '_elementor_template_type',
						'value'   => array('product', 'product-archive', 'single-product'),
						'compare' => 'IN',
					),
				),
				'fields'         => 'ids',
			)
		);
		$found = $q->have_posts();
		wp_reset_postdata();
		return $found;
	}

	/**
	 * @return bool
	 */
	private static function avada() {
		$get = self::query_vars();
		if (!empty($get['fb-edit']) || (!empty($get['builder']) && (string) $get['builder'] === 'true')) {
			return true;
		}
		$post_type = '';
		if (!empty($get['post_type'])) {
			$post_type = sanitize_key((string) $get['post_type']);
		} elseif (function_exists('get_post_type')) {
			$post_type = (string) get_post_type();
		}
		return in_array($post_type, array('fusion_tb_section', 'fusion_tb_layout'), true);
	}

	/**
	 * Avada Live "dynamic content preview" product, when a documented API exposes it.
	 *
	 * @return WC_Product|null
	 */
	private static function avada_dynamic_product() {
		if (!class_exists('FusionBuilder') && !class_exists('Fusion_App') && !function_exists('fusion_is_preview_frame')) {
			return null;
		}
		$ids = array();
		if (function_exists('fusion_library') && is_object(fusion_library()) && method_exists(fusion_library(), 'get_page_id')) {
			$ids[] = (int) fusion_library()->get_page_id();
		}
		if (isset($GLOBALS['fusion_dynamic_data_preview_id'])) {
			$ids[] = absint($GLOBALS['fusion_dynamic_data_preview_id']);
		}
		$get = self::query_vars();
		foreach (array('preview_id', 'fusion_preview', 'awb_preview_id') as $key) {
			if (!empty($get[ $key ])) {
				$ids[] = absint($get[ $key ]);
			}
		}
		foreach (array_unique(array_filter($ids)) as $id) {
			if (!function_exists('wc_get_product')) {
				break;
			}
			$product = wc_get_product($id);
			if ($product && class_exists('WDP_Donation_Scope') && WDP_Donation_Scope::is_donation_product($product)) {
				return $product;
			}
			if ($product && method_exists($product, 'get_type') && $product->get_type() === 'simple') {
				return $product;
			}
		}
		return null;
	}

	/**
	 * @return bool
	 */
	private static function elementor() {
		if (!class_exists('\Elementor\Plugin')) {
			return false;
		}
		try {
			$plugin = \Elementor\Plugin::$instance;
			if (isset($plugin->preview) && is_object($plugin->preview) && method_exists($plugin->preview, 'is_preview_mode') && $plugin->preview->is_preview_mode()) {
				return true;
			}
			if (isset($plugin->editor) && is_object($plugin->editor) && method_exists($plugin->editor, 'is_edit_mode') && $plugin->editor->is_edit_mode()) {
				return true;
			}
		} catch (\Throwable $e) {
			return false;
		}
		$get = self::query_vars();
		return !empty($get['elementor-preview']) || (!empty($get['action']) && (string) $get['action'] === 'elementor');
	}

	/**
	 * Gutenberg block editor REST render requests.
	 *
	 * @return bool
	 */
	private static function gutenberg() {
		if (defined('REST_REQUEST') && REST_REQUEST && !empty($GLOBALS['wp']->query_vars['rest_route'])) {
			$route = (string) $GLOBALS['wp']->query_vars['rest_route'];
			if (strpos($route, '/block-renderer/') !== false) {
				return true;
			}
		}
		if (function_exists('wp_is_json_request') && wp_is_json_request() && isset($_SERVER['REQUEST_URI'])) {
			$uri = (string) wp_unslash($_SERVER['REQUEST_URI']);
			if (strpos($uri, '/wp/v2/block-renderer') !== false) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @return bool
	 */
	private static function divi() {
		$get = self::query_vars();
		return !empty($get['et_fb']) || !empty($get['et_fb_preview']);
	}

	/**
	 * @return bool
	 */
	private static function bricks() {
		$get = self::query_vars();
		return !empty($get['bricks']) || (isset($get['brickspreview']) && (string) $get['brickspreview'] !== '');
	}

	/**
	 * @return bool
	 */
	private static function beaver() {
		$get = self::query_vars();
		if (!empty($get['fl_builder']) || !empty($get['fl_builder_preview'])) {
			return true;
		}
		return class_exists('FLBuilderModel') && method_exists('FLBuilderModel', 'is_builder_active') && FLBuilderModel::is_builder_active();
	}

	/**
	 * Latest published donation product (by modified date).
	 *
	 * @return WC_Product|null
	 */
	private static function latest_donation_product() {
		if (!function_exists('wc_get_products')) {
			return null;
		}
		$products = wc_get_products(
			array(
				'status'  => 'publish',
				'limit'   => 12,
				'orderby' => 'modified',
				'order'   => 'DESC',
				'type'    => class_exists('WDP_Donation_Scope') ? WDP_Donation_Scope::supported_types() : array('simple'),
				'return'  => 'objects',
			)
		);
		if (!is_array($products)) {
			return null;
		}
		foreach ($products as $product) {
			if (class_exists('WDP_Donation_Scope') && WDP_Donation_Scope::is_donation_product($product)) {
				return $product;
			}
		}
		return isset($products[0]) ? $products[0] : null;
	}

	/**
	 * @return array<string, mixed>
	 */
	private static function query_vars() {
		$out = array();
		if (isset($_GET) && is_array($_GET)) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			foreach ($_GET as $key => $value) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
				if (is_scalar($value)) {
					$out[ sanitize_key((string) $key) ] = sanitize_text_field(wp_unslash((string) $value));
				}
			}
		}
		return $out;
	}
}

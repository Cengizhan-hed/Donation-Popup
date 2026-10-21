<?php
/**
 * Elementor Free widget kaydı (Pro yok). Widget’lar kısa kod fonksiyonlarını çağırır.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Registers donation form + list widgets when Elementor is present.
 */
class WDP_Elementor {

	/**
	 * @return void
	 */
	public static function init() {
		if (!did_action('elementor/loaded') && !class_exists('\Elementor\Widget_Base')) {
			add_action('elementor/widgets/register', array(__CLASS__, 'register'));
			add_action('elementor/elements/categories_registered', array(__CLASS__, 'category'));
			add_action('elementor/editor/after_enqueue_scripts', array(__CLASS__, 'editor_assets'));
			add_action('wp_ajax_wdp_elementor_search_products', array(__CLASS__, 'ajax_search_products'));
			return;
		}
		add_action('elementor/widgets/register', array(__CLASS__, 'register'));
		add_action('elementor/elements/categories_registered', array(__CLASS__, 'category'));
		add_action('elementor/editor/after_enqueue_scripts', array(__CLASS__, 'editor_assets'));
		add_action('wp_ajax_wdp_elementor_search_products', array(__CLASS__, 'ajax_search_products'));
	}

	/**
	 * Elementor editor: SELECT2 ajax for donation products.
	 *
	 * @return void
	 */
	public static function editor_assets() {
		wp_enqueue_script(
			'wdp-elementor-editor',
			WDP_PLUGIN_URL . 'assets/js/elementor-editor.js',
			array('jquery', 'jquery-ui-autocomplete'),
			WDP_VERSION,
			true
		);
		wp_localize_script(
			'wdp-elementor-editor',
			'wdpElementor',
			array(
				'ajaxUrl' => admin_url('admin-ajax.php'),
				'nonce'   => wp_create_nonce('wdp_elementor_search_products'),
			)
		);
	}

	/**
	 * Ajax product search (donation-scoped, all WC types, no 300 cap).
	 *
	 * @return void
	 */
	public static function ajax_search_products() {
		check_ajax_referer('wdp_elementor_search_products', 'nonce');
		if (!current_user_can('edit_products') && !current_user_can('edit_posts')) {
			wp_send_json(array('results' => array()));
		}
		$term = isset($_REQUEST['q']) ? sanitize_text_field(wp_unslash($_REQUEST['q'])) : '';
		if (!function_exists('wc_get_products')) {
			wp_send_json(array('results' => array()));
		}
		$args = array(
			'status'  => 'publish',
			'limit'   => 20,
			'orderby' => 'title',
			'order'   => 'ASC',
			'return'  => 'objects',
		);
		if ($term !== '') {
			$args['s'] = $term;
		}
		$products = wc_get_products($args);
		$results  = array();
		foreach ((array) $products as $product) {
			if (!is_object($product) || !method_exists($product, 'get_id')) {
				continue;
			}
			if (class_exists('WDP_Donation_Scope') && !WDP_Donation_Scope::is_donation_product($product)) {
				continue;
			}
			$results[] = array(
				'id'   => (int) $product->get_id(),
				'text' => $product->get_name() . ' (#' . $product->get_id() . ')',
			);
		}
		wp_send_json(array('results' => $results));
	}

	/**
	 * @param \Elementor\Elements_Manager $elements Elements manager.
	 * @return void
	 */
	public static function category($elements) {
		if (!is_object($elements) || !method_exists($elements, 'add_category')) {
			return;
		}
		$elements->add_category(
			'wdp-donation',
			array(
				'title' => __('Bağış (WooCommerce Donation)', 'woo-donation-popup'),
				'icon'  => 'fa fa-heart',
			)
		);
	}

	/**
	 * @param \Elementor\Widgets_Manager $widgets Widgets manager.
	 * @return void
	 */
	public static function register($widgets) {
		if (!class_exists('\Elementor\Widget_Base') || !is_object($widgets) || !method_exists($widgets, 'register')) {
			return;
		}
		require_once WDP_PLUGIN_DIR . 'includes/elementor/class-widget-donation-form.php';
		require_once WDP_PLUGIN_DIR . 'includes/elementor/class-widget-donations-list.php';
		$widgets->register(new WDP_Elementor_Widget_Donation_Form());
		$widgets->register(new WDP_Elementor_Widget_Donations_List());
	}
}

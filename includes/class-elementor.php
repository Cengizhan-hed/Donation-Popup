<?php
/**
 * Elementor uyumluluk katmanı: widget kaydı. Widget'lar yalnız eşdeğer kısa kodu çalıştırır.
 *
 * Yeni özellik eklenmez; widget adları ve ayar anahtarları kayıtlı sayfalar için sabittir.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Registers the donation form + list widgets when Elementor fires its registration hooks.
 */
class WDP_Elementor {

	/**
	 * @return void
	 */
	public static function init() {
		add_action('elementor/widgets/register', array(__CLASS__, 'register'));
		add_action('elementor/elements/categories_registered', array(__CLASS__, 'category'));
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
				'title' => __('Donation (WooCommerce Donation)', 'woo-donation-popup'),
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

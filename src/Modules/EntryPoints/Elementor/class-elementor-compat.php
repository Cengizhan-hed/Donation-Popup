<?php
/**
 * Elementor uyumluluk katmanı: widget kaydı. Widget'lar yalnız eşdeğer kısa kodu çalıştırır.
 *
 * Yeni özellik eklenmez; widget adları ve ayar anahtarları kayıtlı sayfalar için sabittir.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints\Elementor;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the donation form + list widgets when Elementor fires its registration hooks.
 */
class Elementor_Compat {

	/**
	 * @return void
	 */
	public static function init() {
		add_action( 'elementor/widgets/register', array( __CLASS__, 'register' ) );
		add_action( 'elementor/elements/categories_registered', array( __CLASS__, 'category' ) );
	}

	/**
	 * @param \Elementor\Elements_Manager $elements Elements manager.
	 * @return void
	 */
	public static function category( $elements ) {
		if ( ! is_object( $elements ) || ! method_exists( $elements, 'add_category' ) ) {
			return;
		}
		$elements->add_category(
			'wdp-donation',
			array(
				'title' => __( 'Donation (WooCommerce Donation)', 'woo-donation-popup' ),
				'icon'  => 'fa fa-heart',
			)
		);
	}

	/**
	 * @param \Elementor\Widgets_Manager $widgets Widgets manager.
	 * @return void
	 */
	public static function register( $widgets ) {
		if ( ! class_exists( '\Elementor\Widget_Base' ) || ! is_object( $widgets ) || ! method_exists( $widgets, 'register' ) ) {
			return;
		}
		$widgets->register( new Donation_Form_Widget() );
		$widgets->register( new Donations_List_Widget() );
	}
}

<?php
/**
 * Elementor "Bağış Listesi" widget'ı.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Donations grid widget.
 */
class WDP_Elementor_Widget_Donations_List extends \Elementor\Widget_Base {

	/**
	 * @return string
	 */
	public function get_name() {
		return 'wdp-donations';
	}

	/**
	 * @return string
	 */
	public function get_title() {
		return _x('Donations list', 'elementor widget title', 'woo-donation-popup');
	}

	/**
	 * @return string
	 */
	public function get_icon() {
		return 'eicon-posts-grid';
	}

	/**
	 * @return string[]
	 */
	public function get_categories() {
		return array('wdp-donation');
	}

	/**
	 * @return string[]
	 */
	public function get_keywords() {
		return array($this->get_title());
	}

	/**
	 * @return string[]
	 */
	public function get_style_depends() {
		return array('wdp-donations-list', 'wdp-donation-modal-css');
	}

	/**
	 * @return string[]
	 */
	public function get_script_depends() {
		return array('wdp-donations-list', 'wdp-donation-modal-js');
	}

	/**
	 * @return void
	 */
	protected function register_controls() {
		$this->start_controls_section('query', array('label' => __('Query', 'woo-donation-popup')));
		$this->add_control('categories', array('label' => __('Categories (slugs, comma-separated)', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT));
		$this->add_control('exclude_categories', array('label' => __('Exclude categories', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT));
		$this->add_control('ids', array('label' => __('IDs only', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT));
		$this->add_control('exclude', array('label' => __('Exclude IDs', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT));
		$this->add_control('type', array('label' => __('Type', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT, 'placeholder' => 'fixed,custom,shares,campaign'));
		$this->add_control('limit', array('label' => __('Count', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::NUMBER, 'min' => 1, 'max' => 100, 'default' => 48));
		$this->add_control(
			'orderby',
			array(
				'label'   => __('Order by', 'woo-donation-popup'),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'default' => 'menu_order',
				'options' => array(
					'menu_order' => __('Menu order', 'woo-donation-popup'),
					'date'       => __('Date', 'woo-donation-popup'),
					'title'      => __('Title', 'woo-donation-popup'),
					'popularity' => __('Popularity', 'woo-donation-popup'),
					'random'     => __('Random', 'woo-donation-popup'),
				),
			)
		);
		$this->add_control('order', array('label' => __('Direction', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SELECT, 'default' => 'ASC', 'options' => array('ASC' => 'ASC', 'DESC' => 'DESC')));
		$this->end_controls_section();

		$this->start_controls_section('layout', array('label' => __('Display', 'woo-donation-popup')));
		$this->add_responsive_control(
			'columns',
			array(
				'label'          => __('Columns', 'woo-donation-popup'),
				'type'           => \Elementor\Controls_Manager::NUMBER,
				'min'            => 1,
				'max'            => 6,
				'default'        => 3,
				'tablet_default' => 2,
				'mobile_default' => 1,
			)
		);
		$this->add_control('gap', array('label' => __('Gap (px)', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::NUMBER, 'min' => 0, 'max' => 64, 'default' => 24));
		$this->add_control(
			'image_ratio',
			array(
				'label'   => __('Image ratio', 'woo-donation-popup'),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'default' => '4:3',
				'options' => array('1:1' => '1:1', '4:3' => '4:3', '3:2' => '3:2', '16:9' => '16:9', 'original' => __('Original', 'woo-donation-popup')),
			)
		);
		$this->add_control('align', array('label' => __('Alignment', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SELECT, 'default' => 'center', 'options' => array('center' => __('Center', 'woo-donation-popup'), 'left' => __('Left', 'woo-donation-popup'))));
		$this->add_control('button', array('label' => __('Button', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SELECT, 'default' => 'panel', 'options' => array('panel' => __('Panel', 'woo-donation-popup'), 'popup' => __('Popup', 'woo-donation-popup'), 'link' => __('Link', 'woo-donation-popup'))));
		$this->add_control('button_full', array('label' => __('Full-width button', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => 'yes'));
		$this->add_control('button_text', array('label' => _x('Button text', 'Elementor widget', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT));
		$this->add_control('tabs', array('label' => __('Tabs', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => 'yes'));
		$this->add_control('tab_all', array('label' => __('“All” tab', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => 'yes'));
		$this->add_control('tab_all_label', array('label' => __('All tab label', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT, 'default' => __('All', 'woo-donation-popup')));
		$this->add_control('show_image', array('label' => __('Image', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => 'yes'));
		$this->add_control('show_excerpt', array('label' => __('Excerpt', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => ''));
		$this->add_control('show_progress', array('label' => __('Progress', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => 'yes'));
		$this->add_control('show_price', array('label' => __('Price', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => 'yes'));
		$this->add_control('show_category', array('label' => __('Category', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => ''));
		$this->add_control('excerpt_words', array('label' => __('Excerpt words', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::NUMBER, 'min' => 0, 'max' => 60, 'default' => 18));
		$this->add_control(
			'image_size',
			array(
				'label'   => __('Image size', 'woo-donation-popup'),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'default' => 'woocommerce_thumbnail',
				'options' => self::image_size_options(),
			)
		);
		$this->add_control('heading_tag', array('label' => __('Heading tag', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SELECT, 'default' => 'h3', 'options' => array('h2' => 'H2', 'h3' => 'H3', 'h4' => 'H4')));
		$this->add_control('class', array('label' => __('CSS class', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT));
		$this->end_controls_section();
	}

	/**
	 * @return array<string, string>
	 */
	private static function image_size_options() {
		$out = array(
			'woocommerce_thumbnail' => 'woocommerce_thumbnail',
			'thumbnail'             => 'thumbnail',
			'medium'                => 'medium',
			'medium_large'          => 'medium_large',
			'large'                 => 'large',
			'full'                  => 'full',
		);
		if (function_exists('wp_get_registered_image_subsizes')) {
			foreach (array_keys(wp_get_registered_image_subsizes()) as $size) {
				$out[ $size ] = $size;
			}
		}
		return $out;
	}

	protected function render() {
		$s    = $this->get_settings_for_display();
		$html = WDP_Render_Guard::html(
			static function () use ($s) {
				return WDP_Donations_List::shortcode(WDP_Donations_List::atts_from_elementor_settings($s));
			},
			0,
			'elementor_donations'
		);
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}

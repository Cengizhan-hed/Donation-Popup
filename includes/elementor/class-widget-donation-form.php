<?php
/**
 * Elementor "Bağış Formu" widget'ı.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Donation form / button widget.
 */
class WDP_Elementor_Widget_Donation_Form extends \Elementor\Widget_Base {

	/**
	 * @return string
	 */
	public function get_name() {
		return 'wdp-donation-form';
	}

	/**
	 * @return string
	 */
	public function get_title() {
		return __('Bağış Formu', 'woo-donation-popup');
	}

	/**
	 * @return string
	 */
	public function get_icon() {
		return 'eicon-form-horizontal';
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
	public function get_style_depends() {
		return array('wdp-donation-modal-css');
	}

	/**
	 * @return string[]
	 */
	public function get_script_depends() {
		return array('wdp-donation-modal-js');
	}

	/**
	 * @return void
	 */
	protected function register_controls() {
		$this->start_controls_section(
			'content',
			array('label' => __('İçerik', 'woo-donation-popup'))
		);

		$this->add_control(
			'source',
			array(
				'label'   => __('Ürün kaynağı', 'woo-donation-popup'),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'default' => 'current',
				'options' => array(
					'current' => __('Mevcut ürün', 'woo-donation-popup'),
					'list'    => __('Listeden seç', 'woo-donation-popup'),
					'manual'  => __('ID veya slug elle', 'woo-donation-popup'),
				),
			)
		);

		$this->add_control(
			'product_id',
			array(
				'label'     => __('Ürün', 'woo-donation-popup'),
				'type'      => \Elementor\Controls_Manager::SELECT2,
				'options'   => self::product_options(),
				'condition' => array('source' => 'list'),
			)
		);

		$this->add_control(
			'manual',
			array(
				'label'       => __('Ürün ID veya slug', 'woo-donation-popup'),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'condition'   => array('source' => 'manual'),
				'label_block' => true,
			)
		);

		$this->add_control(
			'display',
			array(
				'label'   => __('Görünüm', 'woo-donation-popup'),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'default' => 'inline',
				'options' => array(
					'inline' => __('Sayfa içi form', 'woo-donation-popup'),
					'popup'  => __('Ortada pencere', 'woo-donation-popup'),
					'panel'  => __('Sağ panel', 'woo-donation-popup'),
				),
			)
		);

		$this->add_control(
			'show_title',
			array(
				'label'        => __('Başlığı göster', 'woo-donation-popup'),
				'type'         => \Elementor\Controls_Manager::SWITCHER,
				'label_on'     => __('Evet', 'woo-donation-popup'),
				'label_off'    => __('Hayır', 'woo-donation-popup'),
				'return_value' => 'yes',
				'default'      => 'yes',
			)
		);

		$this->add_control(
			'button_text',
			array(
				'label'   => __('Buton metni', 'woo-donation-popup'),
				'type'    => \Elementor\Controls_Manager::TEXT,
				'default' => '',
			)
		);

		$this->end_controls_section();
	}

	/**
	 * @return array<int, string>
	 */
	private static function product_options() {
		if (!function_exists('wc_get_products')) {
			return array();
		}
		$products = wc_get_products(
			array(
				'status'   => 'publish',
				'limit'    => 300,
				'type'     => 'simple',
				'orderby'  => 'title',
				'order'    => 'ASC',
				'return'   => 'objects',
			)
		);
		$out = array();
		foreach ((array) $products as $product) {
			if (!is_object($product) || !method_exists($product, 'get_id')) {
				continue;
			}
			if (class_exists('WDP_Donation_Scope') && !WDP_Donation_Scope::is_donation_product($product)) {
				continue;
			}
			$out[ $product->get_id() ] = $product->get_name() . ' (#' . $product->get_id() . ')';
		}
		return $out;
	}

	/**
	 * @return void
	 */
	protected function render() {
		$settings = $this->get_settings_for_display();
		$html     = WDP_Render_Guard::html(
			static function () use ($settings) {
				$atts = array(
					'id'         => 0,
					'slug'       => '',
					'sku'        => '',
					'text'       => isset($settings['button_text']) ? $settings['button_text'] : '',
					'show_title' => (!empty($settings['show_title']) && $settings['show_title'] === 'yes') ? 'yes' : 'no',
				);
				$source = isset($settings['source']) ? $settings['source'] : 'current';
				if ($source === 'list') {
					$atts['id'] = isset($settings['product_id']) ? absint($settings['product_id']) : 0;
				} elseif ($source === 'manual') {
					$manual = isset($settings['manual']) ? trim((string) $settings['manual']) : '';
					if (ctype_digit($manual)) {
						$atts['id'] = absint($manual);
					} else {
						$atts['slug'] = sanitize_title($manual);
					}
				}
				$display = isset($settings['display']) ? $settings['display'] : 'inline';
				if ($display === 'popup') {
					return WDP_Shortcodes::render_button($atts, 'wdp_donation_button', 'popup');
				}
				if ($display === 'panel') {
					return WDP_Shortcodes::render_button($atts, 'wdp_donation_button_panel', 'side_panel');
				}
				return WDP_Shortcodes::render_form($atts);
			},
			0,
			'elementor_donation_form'
		);
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}

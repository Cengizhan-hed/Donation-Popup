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
				'label'       => __('Ürün', 'woo-donation-popup'),
				'type'        => \Elementor\Controls_Manager::SELECT2,
				'options'     => $this->selected_product_options(),
				'label_block' => true,
				'condition'   => array('source' => 'list'),
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
				'label'     => __('Buton metni', 'woo-donation-popup'),
				'type'      => \Elementor\Controls_Manager::TEXT,
				'default'   => '',
				'condition' => array('display!' => 'inline'),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Only the currently selected product (ajax search fills the rest).
	 *
	 * @return array<int, string>
	 */
	private function selected_product_options() {
		$settings = method_exists($this, 'get_settings') ? $this->get_settings('product_id') : array();
		$id       = 0;
		if (is_array($settings) && isset($settings['product_id'])) {
			$id = absint($settings['product_id']);
		} elseif (is_scalar($settings)) {
			$id = absint($settings);
		}
		if ($id <= 0 || !function_exists('wc_get_product')) {
			return array();
		}
		$product = wc_get_product($id);
		if (!$product || !method_exists($product, 'get_id')) {
			return array();
		}
		return array($id => $product->get_name() . ' (#' . $id . ')');
	}

	/**
	 * @return void
	 */
	protected function render() {
		$settings = $this->get_settings_for_display();
		$html     = WDP_Render_Guard::html(
			static function () use ($settings) {
				$label = isset($settings['button_text']) ? $settings['button_text'] : '';
				$atts  = array(
					'id'          => 0,
					'slug'        => '',
					'sku'         => '',
					'text'        => $label,
					'button_text' => $label,
					'show_title'  => (!empty($settings['show_title']) && $settings['show_title'] === 'yes') ? 'yes' : 'no',
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

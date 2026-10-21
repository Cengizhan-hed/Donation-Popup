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
		return __('Bağış Listesi', 'woo-donation-popup');
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
		$this->start_controls_section('query', array('label' => __('Sorgu', 'woo-donation-popup')));
		$this->add_control('categories', array('label' => __('Kategoriler (slug, virgülle)', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT));
		$this->add_control('exclude_categories', array('label' => __('Hariç kategoriler', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT));
		$this->add_control('ids', array('label' => __('Yalnızca ID’ler', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT));
		$this->add_control('exclude', array('label' => __('Hariç ID’ler', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT));
		$this->add_control('type', array('label' => __('Tip', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT, 'placeholder' => 'fixed,custom,shares,campaign'));
		$this->add_control('limit', array('label' => __('Adet', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::NUMBER, 'min' => 1, 'max' => 100, 'default' => 48));
		$this->add_control(
			'orderby',
			array(
				'label'   => __('Sıralama', 'woo-donation-popup'),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'default' => 'menu_order',
				'options' => array(
					'menu_order' => __('Menü sırası', 'woo-donation-popup'),
					'date'       => __('Tarih', 'woo-donation-popup'),
					'title'      => __('Başlık', 'woo-donation-popup'),
					'popularity' => __('Popülerlik', 'woo-donation-popup'),
					'random'     => __('Rastgele', 'woo-donation-popup'),
				),
			)
		);
		$this->add_control('order', array('label' => __('Yön', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SELECT, 'default' => 'ASC', 'options' => array('ASC' => 'ASC', 'DESC' => 'DESC')));
		$this->end_controls_section();

		$this->start_controls_section('layout', array('label' => __('Görünüm', 'woo-donation-popup')));
		$this->add_responsive_control(
			'columns',
			array(
				'label'          => __('Sütunlar', 'woo-donation-popup'),
				'type'           => \Elementor\Controls_Manager::NUMBER,
				'min'            => 1,
				'max'            => 6,
				'default'        => 3,
				'tablet_default' => 2,
				'mobile_default' => 1,
			)
		);
		$this->add_control('gap', array('label' => __('Boşluk (px)', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::NUMBER, 'min' => 0, 'max' => 64, 'default' => 24));
		$this->add_control(
			'image_ratio',
			array(
				'label'   => __('Görsel oranı', 'woo-donation-popup'),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'default' => '4:3',
				'options' => array('1:1' => '1:1', '4:3' => '4:3', '3:2' => '3:2', '16:9' => '16:9', 'original' => __('Orijinal', 'woo-donation-popup')),
			)
		);
		$this->add_control('align', array('label' => __('Hiza', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SELECT, 'default' => 'center', 'options' => array('center' => __('Orta', 'woo-donation-popup'), 'left' => __('Sol', 'woo-donation-popup'))));
		$this->add_control('button', array('label' => __('Buton', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SELECT, 'default' => 'panel', 'options' => array('panel' => __('Panel', 'woo-donation-popup'), 'popup' => __('Popup', 'woo-donation-popup'), 'link' => __('Bağlantı', 'woo-donation-popup'))));
		$this->add_control('button_full', array('label' => __('Buton tam genişlik', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => 'yes'));
		$this->add_control('button_text', array('label' => __('Buton metni', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT));
		$this->add_control('tabs', array('label' => __('Sekmeler', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => 'yes'));
		$this->add_control('tab_all', array('label' => __('“Tümü” sekmesi', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => 'yes'));
		$this->add_control('tab_all_label', array('label' => __('Tümü etiketi', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT, 'default' => __('Tümü', 'woo-donation-popup')));
		$this->add_control('show_image', array('label' => __('Görsel', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => 'yes'));
		$this->add_control('show_excerpt', array('label' => __('Özet', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => ''));
		$this->add_control('show_progress', array('label' => __('İlerleme', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => 'yes'));
		$this->add_control('show_price', array('label' => __('Fiyat', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => 'yes'));
		$this->add_control('show_category', array('label' => __('Kategori', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SWITCHER, 'return_value' => 'yes', 'default' => ''));
		$this->add_control('excerpt_words', array('label' => __('Özet kelime', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::NUMBER, 'min' => 0, 'max' => 60, 'default' => 18));
		$this->add_control(
			'image_size',
			array(
				'label'   => __('Görsel boyutu', 'woo-donation-popup'),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'default' => 'woocommerce_thumbnail',
				'options' => self::image_size_options(),
			)
		);
		$this->add_control('heading_tag', array('label' => __('Başlık etiketi', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::SELECT, 'default' => 'h3', 'options' => array('h2' => 'H2', 'h3' => 'H3', 'h4' => 'H4')));
		$this->add_control('class', array('label' => __('CSS sınıfı', 'woo-donation-popup'), 'type' => \Elementor\Controls_Manager::TEXT));
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

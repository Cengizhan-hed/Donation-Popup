<?php
/**
 * Elementor uyumluluk katmanı: "Donation form" widget'ı (yalnız kısa kodu çalıştırır).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints\Elementor;

use DonationPanel\Compat\Public_Contract;

defined( 'ABSPATH' ) || exit;

/**
 * Donation form / button widget.
 */
class Donation_Form_Widget extends \Elementor\Widget_Base {

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
		return _x( 'Donation form', 'elementor widget title', 'woo-donation-popup' );
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
		return array( 'wdp-donation' );
	}

	/**
	 * @return string[]
	 */
	public function get_keywords() {
		return array(
			$this->get_title(),
			_x( 'donation', 'elementor widget search keyword', 'woo-donation-popup' ),
			_x( 'donate', 'elementor widget search keyword', 'woo-donation-popup' ),
			_x( 'charity', 'elementor widget search keyword', 'woo-donation-popup' ),
			_x( 'form', 'elementor widget search keyword', 'woo-donation-popup' ),
			_x( 'popup', 'elementor widget search keyword', 'woo-donation-popup' ),
		);
	}

	/**
	 * @return string[]
	 */
	public function get_style_depends() {
		return array( 'wdp-donation-modal-css' );
	}

	/**
	 * @return string[]
	 */
	public function get_script_depends() {
		return array( 'wdp-donation-modal-js' );
	}

	/**
	 * @return void
	 */
	protected function register_controls() {
		$this->start_controls_section(
			'content',
			array( 'label' => __( 'Content', 'woo-donation-popup' ) )
		);

		$this->add_control(
			'source',
			array(
				'label'   => __( 'Product source', 'woo-donation-popup' ),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'default' => 'current',
				'options' => array(
					'current' => __( 'Current product', 'woo-donation-popup' ),
					'list'    => __( 'Select from list', 'woo-donation-popup' ),
					'manual'  => __( 'Enter ID or slug', 'woo-donation-popup' ),
				),
			)
		);

		$this->add_control(
			'product_id',
			array(
				'label'       => __( 'Product', 'woo-donation-popup' ),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'label_block' => true,
				'condition'   => array( 'source' => 'list' ),
			)
		);

		$this->add_control(
			'manual',
			array(
				'label'       => __( 'Product ID or slug', 'woo-donation-popup' ),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'condition'   => array( 'source' => 'manual' ),
				'label_block' => true,
			)
		);

		$this->add_control(
			'display',
			array(
				'label'   => __( 'Display', 'woo-donation-popup' ),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'default' => 'inline',
				'options' => array(
					'inline' => __( 'Inline form', 'woo-donation-popup' ),
					'popup'  => _x( 'Popup', 'display mode', 'woo-donation-popup' ),
					'panel'  => __( 'Side panel', 'woo-donation-popup' ),
				),
			)
		);

		$this->add_control(
			'layout',
			array(
				'label'     => __( 'Layout', 'woo-donation-popup' ),
				'type'      => \Elementor\Controls_Manager::SELECT,
				'default'   => 'full',
				'options'   => array(
					'full'    => _x( 'Full', 'Donation form layout', 'woo-donation-popup' ),
					'compact' => _x( 'Compact', 'Donation form layout', 'woo-donation-popup' ),
				),
				'condition' => array( 'display' => 'inline' ),
			)
		);

		$this->add_control(
			'show_title',
			array(
				'label'        => __( 'Show heading', 'woo-donation-popup' ),
				'type'         => \Elementor\Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'woo-donation-popup' ),
				'label_off'    => __( 'No', 'woo-donation-popup' ),
				'return_value' => 'yes',
				'default'      => 'yes',
			)
		);

		$this->add_control(
			'button_text',
			array(
				'label'     => _x( 'Button text', 'Elementor widget', 'woo-donation-popup' ),
				'type'      => \Elementor\Controls_Manager::TEXT,
				'default'   => '',
				'condition' => array( 'display!' => 'inline' ),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Widget settings → shortcode name + attributes (same names/attributes as the shortcodes).
	 *
	 * @param array<string, mixed> $settings Widget settings.
	 * @return array{0: string, 1: array<string, mixed>} Shortcode tag and attributes.
	 */
	public static function shortcode_from_settings( $settings ) {
		$label  = isset( $settings['button_text'] ) ? (string) $settings['button_text'] : '';
		$atts   = array(
			'id'          => 0,
			'slug'        => '',
			'sku'         => '',
			'text'        => $label,
			'button_text' => $label,
			'show_title'  => ( ! empty( $settings['show_title'] ) && 'yes' === $settings['show_title'] ) ? 'yes' : 'no',
		);
		$source = isset( $settings['source'] ) ? $settings['source'] : 'current';
		if ( 'list' === $source ) {
			$atts['id'] = isset( $settings['product_id'] ) ? absint( $settings['product_id'] ) : 0;
		} elseif ( 'manual' === $source ) {
			$manual = isset( $settings['manual'] ) ? trim( (string) $settings['manual'] ) : '';
			if ( ctype_digit( $manual ) ) {
				$atts['id'] = absint( $manual );
			} else {
				$atts['slug'] = sanitize_title( $manual );
			}
		}
		$display = isset( $settings['display'] ) ? $settings['display'] : 'inline';
		if ( 'popup' === $display ) {
			return array( 'wdp_donation_button', $atts );
		}
		if ( 'panel' === $display ) {
			return array( 'wdp_donation_button_panel', $atts );
		}
		if ( isset( $settings['layout'] ) && 'compact' === $settings['layout'] ) {
			$atts['layout'] = 'compact';
		}
		return array( 'wdp_donation_form', $atts );
	}

	/**
	 * Thin compatibility layer: runs the equivalent shortcode handler.
	 *
	 * @return void
	 */
	protected function render() {
		list($tag, $atts) = self::shortcode_from_settings( $this->get_settings_for_display() );
		$html             = Public_Contract::render( $tag, $atts );
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}

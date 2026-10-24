<?php
/**
 * Avada (Fusion Builder) elementleri: "Donation Panel" form ve liste.
 *
 * Fusion Builder'ın belgelenmiş kayıt yolu (`fusion_builder_before_init` + `fusion_builder_map`) kullanılır.
 * Çıktı her zaman mevcut kısa kodlardan gelir; kısa kod adları/öznitelikleri değişmez.
 * Bu dosya yalnız Fusion Builder kanca ateşlediğinde yüklenir (WDP_Compat_Loader koşullu kayıt eder).
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class WDP_Compat_Avada_Element
 */
class WDP_Compat_Avada_Element {

	const TAG_FORM = 'wdp_avada_donation_form';
	const TAG_LIST = 'wdp_donations';

	/**
	 * Fusion Builder hazır olunca elementleri kaydet.
	 *
	 * @return void
	 */
	public static function register() {
		if ( ! function_exists( 'fusion_builder_map' ) ) {
			return;
		}
		add_shortcode( self::TAG_FORM, array( __CLASS__, 'render_form' ) );
		fusion_builder_map( self::form_element() );
		fusion_builder_map( self::list_element() );
	}

	/**
	 * Form elementi: kaynak/gösterim seçimine göre mevcut kısa kodu çağırır.
	 *
	 * @param array|string $atts Öznitelikler.
	 * @return string
	 */
	public static function render_form( $atts ) {
		$atts   = is_array( $atts ) ? $atts : array();
		$source = isset( $atts['source'] ) ? (string) $atts['source'] : 'current';
		$out    = array();
		if ( 'list' === $source ) {
			$id = isset( $atts['product_id'] ) ? absint( $atts['product_id'] ) : 0;
			if ( $id > 0 ) {
				$out['id'] = (string) $id;
			}
		} elseif ( 'manual' === $source ) {
			$manual = isset( $atts['manual'] ) ? trim( (string) $atts['manual'] ) : '';
			if ( '' !== $manual && ctype_digit( $manual ) ) {
				$out['id'] = (string) absint( $manual );
			} elseif ( '' !== $manual ) {
				$out['slug'] = sanitize_title( $manual );
			}
		}
		$display = isset( $atts['display'] ) ? (string) $atts['display'] : 'inline';
		$tag     = 'wdp_donation_form';
		if ( 'popup' === $display ) {
			$tag = 'wdp_donation_button';
		} elseif ( 'panel' === $display ) {
			$tag = 'wdp_donation_button_panel';
		}
		if ( 'wdp_donation_form' === $tag ) {
			$out['show_title'] = ( isset( $atts['show_title'] ) && 'no' === $atts['show_title'] ) ? 'no' : 'yes';
		} elseif ( isset( $atts['button_text'] ) && '' !== trim( (string) $atts['button_text'] ) ) {
			$out['button_text'] = (string) $atts['button_text'];
		}
		if ( ! empty( $atts['class'] ) ) {
			$out['class'] = (string) $atts['class'];
		}
		return do_shortcode( self::shortcode_string( $tag, $out ) );
	}

	/**
	 * @param string               $tag  Kısa kod adı.
	 * @param array<string,string> $atts Öznitelikler.
	 * @return string
	 */
	public static function shortcode_string( $tag, array $atts ) {
		$parts = array( $tag );
		foreach ( $atts as $key => $value ) {
			$value   = preg_replace( '/[\[\]"\r\n]/', '', sanitize_text_field( (string) $value ) );
			$parts[] = sanitize_key( $key ) . '="' . $value . '"';
		}
		return '[' . implode( ' ', $parts ) . ']';
	}

	/**
	 * @return array<string,string>
	 */
	private static function yes_no() {
		return array(
			'yes' => __( 'Yes', 'woo-donation-popup' ),
			'no'  => __( 'No', 'woo-donation-popup' ),
		);
	}

	/**
	 * @return array<string,string>
	 */
	private static function product_options() {
		$out = array();
		if ( ! function_exists( 'wc_get_products' ) ) {
			return $out;
		}
		$products = wc_get_products(
			array(
				'status'  => 'publish',
				'limit'   => 200,
				'orderby' => 'title',
				'order'   => 'ASC',
			)
		);
		foreach ( (array) $products as $product ) {
			if ( is_object( $product ) && method_exists( $product, 'get_id' ) ) {
				$out[ (string) $product->get_id() ] = $product->get_name() . ' (#' . $product->get_id() . ')';
			}
		}
		return $out;
	}

	/**
	 * @param string $param Bağımlı olunan parametre.
	 * @param string $value Değer.
	 * @param string $op    Karşılaştırma.
	 * @return array<int,array<string,string>>
	 */
	private static function dep( $param, $value, $op = '==' ) {
		return array(
			array(
				'element'  => $param,
				'value'    => $value,
				'operator' => $op,
			),
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function form_element() {
		$title = __( 'Donation Panel', 'woo-donation-popup' ) . ' - ' . _x( 'Donation form', 'elementor widget title', 'woo-donation-popup' );
		return array(
			'name'            => $title,
			'shortcode'       => self::TAG_FORM,
			'icon'            => 'fusiona-dollar',
			'allow_generator' => true,
			'keywords'        => self::keywords( $title ),
			'params'          => array(
				array(
					'type'        => 'select',
					'heading'     => __( 'Product source', 'woo-donation-popup' ),
					'param_name'  => 'source',
					'default'     => 'current',
					'value'       => array(
						'current' => __( 'Current product', 'woo-donation-popup' ),
						'list'    => __( 'Select from list', 'woo-donation-popup' ),
						'manual'  => __( 'Enter ID or slug', 'woo-donation-popup' ),
					),
				),
				array(
					'type'       => 'select',
					'heading'    => __( 'Product', 'woo-donation-popup' ),
					'param_name' => 'product_id',
					'default'    => '',
					'value'      => array( '' => __( 'Select from list', 'woo-donation-popup' ) ) + self::product_options(),
					'dependency' => self::dep( 'source', 'list' ),
				),
				array(
					'type'       => 'textfield',
					'heading'    => __( 'Product ID or slug', 'woo-donation-popup' ),
					'param_name' => 'manual',
					'value'      => '',
					'dependency' => self::dep( 'source', 'manual' ),
				),
				array(
					'type'       => 'select',
					'heading'    => __( 'Display', 'woo-donation-popup' ),
					'param_name' => 'display',
					'default'    => 'inline',
					'value'      => array(
						'inline' => __( 'Inline form', 'woo-donation-popup' ),
						'popup'  => _x( 'Popup', 'display mode', 'woo-donation-popup' ),
						'panel'  => __( 'Side panel', 'woo-donation-popup' ),
					),
				),
				array(
					'type'       => 'radio_button_set',
					'heading'    => __( 'Show heading', 'woo-donation-popup' ),
					'param_name' => 'show_title',
					'default'    => 'yes',
					'value'      => self::yes_no(),
					'dependency' => self::dep( 'display', 'inline' ),
				),
				array(
					'type'       => 'textfield',
					'heading'    => _x( 'Button text', 'Elementor widget', 'woo-donation-popup' ),
					'param_name' => 'button_text',
					'value'      => '',
					'dependency' => self::dep( 'display', 'inline', '!=' ),
				),
			),
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function list_element() {
		$title = __( 'Donation Panel', 'woo-donation-popup' ) . ' - ' . _x( 'Donations list', 'elementor widget title', 'woo-donation-popup' );
		$q     = __( 'Query', 'woo-donation-popup' );
		$d     = __( 'Display', 'woo-donation-popup' );
		$text  = static function ( $name, $label, $group, $default = '' ) {
			return array(
				'type'       => 'textfield',
				'heading'    => $label,
				'param_name' => $name,
				'value'      => $default,
				'group'      => $group,
			);
		};
		$range = static function ( $name, $label, $group, $min, $max, $default ) {
			return array(
				'type'       => 'range',
				'heading'    => $label,
				'param_name' => $name,
				'value'      => (string) $default,
				'default'    => (string) $default,
				'min'        => (string) $min,
				'max'        => (string) $max,
				'step'       => '1',
				'group'      => $group,
			);
		};
		$sel   = static function ( $name, $label, $group, $default, $options ) {
			return array(
				'type'       => 'select',
				'heading'    => $label,
				'param_name' => $name,
				'default'    => $default,
				'value'      => $options,
				'group'      => $group,
			);
		};
		$yn    = static function ( $name, $label, $default ) {
			return array(
				'type'       => 'radio_button_set',
				'heading'    => $label,
				'param_name' => $name,
				'default'    => $default,
				'value'      => self::yes_no(),
				'group'      => __( 'Display', 'woo-donation-popup' ),
			);
		};
		$sizes = array(
			'woocommerce_thumbnail' => 'woocommerce_thumbnail',
			'thumbnail'             => 'thumbnail',
			'medium'                => 'medium',
			'medium_large'          => 'medium_large',
			'large'                 => 'large',
			'full'                  => 'full',
		);
		if ( function_exists( 'wp_get_registered_image_subsizes' ) ) {
			foreach ( array_keys( wp_get_registered_image_subsizes() ) as $size ) {
				$sizes[ $size ] = $size;
			}
		}
		return array(
			'name'            => $title,
			'shortcode'       => self::TAG_LIST,
			'icon'            => 'fusiona-dollar',
			'allow_generator' => true,
			'keywords'        => self::keywords( $title ),
			'params'          => array(
				$text( 'categories', __( 'Categories (slugs, comma-separated)', 'woo-donation-popup' ), $q ),
				$text( 'exclude_categories', __( 'Exclude categories', 'woo-donation-popup' ), $q ),
				$text( 'ids', __( 'IDs only', 'woo-donation-popup' ), $q ),
				$text( 'exclude', __( 'Exclude IDs', 'woo-donation-popup' ), $q ),
				$text( 'type', __( 'Type', 'woo-donation-popup' ), $q ),
				$range( 'limit', __( 'Count', 'woo-donation-popup' ), $q, 1, 100, 48 ),
				$sel(
					'orderby',
					__( 'Order by', 'woo-donation-popup' ),
					$q,
					'menu_order',
					array(
						'menu_order' => __( 'Menu order', 'woo-donation-popup' ),
						'date'       => __( 'Date', 'woo-donation-popup' ),
						'title'      => __( 'Title', 'woo-donation-popup' ),
						'popularity' => __( 'Popularity', 'woo-donation-popup' ),
						'random'     => __( 'Random', 'woo-donation-popup' ),
					)
				),
				$sel( 'order', __( 'Direction', 'woo-donation-popup' ), $q, 'ASC', array( 'ASC' => 'ASC', 'DESC' => 'DESC' ) ),
				$range( 'columns', __( 'Columns', 'woo-donation-popup' ), $d, 1, 6, 3 ),
				$range( 'columns_tablet', __( 'Tablet columns', 'woo-donation-popup' ), $d, 1, 6, 2 ),
				$range( 'columns_mobile', __( 'Mobile columns', 'woo-donation-popup' ), $d, 1, 6, 1 ),
				$range( 'gap', __( 'Gap (px)', 'woo-donation-popup' ), $d, 0, 64, 24 ),
				$sel(
					'image_ratio',
					__( 'Image ratio', 'woo-donation-popup' ),
					$d,
					'4:3',
					array(
						'1:1'      => '1:1',
						'4:3'      => '4:3',
						'3:2'      => '3:2',
						'16:9'     => '16:9',
						'original' => __( 'Original', 'woo-donation-popup' ),
					)
				),
				$sel( 'align', __( 'Alignment', 'woo-donation-popup' ), $d, 'center', array( 'center' => __( 'Center', 'woo-donation-popup' ), 'left' => __( 'Left', 'woo-donation-popup' ) ) ),
				$sel(
					'button',
					__( 'Button', 'woo-donation-popup' ),
					$d,
					'panel',
					array(
						'panel' => __( 'Panel', 'woo-donation-popup' ),
						'popup' => __( 'Popup', 'woo-donation-popup' ),
						'link'  => __( 'Link', 'woo-donation-popup' ),
					)
				),
				$yn( 'button_full', __( 'Full-width button', 'woo-donation-popup' ), 'yes' ),
				$text( 'button_text', _x( 'Button text', 'Elementor widget', 'woo-donation-popup' ), $d ),
				$yn( 'tabs', __( 'Tabs', 'woo-donation-popup' ), 'yes' ),
				$yn( 'tab_all', __( '“All” tab', 'woo-donation-popup' ), 'yes' ),
				$text( 'tab_all_label', __( 'All tab label', 'woo-donation-popup' ), $d, __( 'All', 'woo-donation-popup' ) ),
				$yn( 'show_image', __( 'Image', 'woo-donation-popup' ), 'yes' ),
				$yn( 'show_excerpt', __( 'Excerpt', 'woo-donation-popup' ), 'no' ),
				$yn( 'show_progress', __( 'Progress', 'woo-donation-popup' ), 'yes' ),
				$yn( 'show_price', __( 'Price', 'woo-donation-popup' ), 'yes' ),
				$yn( 'show_category', __( 'Category', 'woo-donation-popup' ), 'no' ),
				$range( 'excerpt_words', __( 'Excerpt words', 'woo-donation-popup' ), $d, 0, 60, 18 ),
				$sel( 'image_size', __( 'Image size', 'woo-donation-popup' ), $d, 'woocommerce_thumbnail', $sizes ),
				$sel( 'heading_tag', __( 'Heading tag', 'woo-donation-popup' ), $d, 'h3', array( 'h2' => 'H2', 'h3' => 'H3', 'h4' => 'H4' ) ),
				$text( 'class', __( 'CSS class', 'woo-donation-popup' ), $d ),
			),
		);
	}

	/**
	 * @param string $title Element adı.
	 * @return string[]
	 */
	private static function keywords( $title ) {
		return array(
			$title,
			_x( 'donation', 'elementor widget search keyword', 'woo-donation-popup' ),
			_x( 'donate', 'elementor widget search keyword', 'woo-donation-popup' ),
			_x( 'charity', 'elementor widget search keyword', 'woo-donation-popup' ),
			_x( 'form', 'elementor widget search keyword', 'woo-donation-popup' ),
			_x( 'popup', 'elementor widget search keyword', 'woo-donation-popup' ),
		);
	}
}

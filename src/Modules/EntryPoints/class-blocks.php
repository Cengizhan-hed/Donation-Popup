<?php
/**
 * Gutenberg blokları: bağış formu ve bağış listesi (PHP render_callback).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

defined( 'ABSPATH' ) || exit;

/**
 * Bloklar.
 */
class Blocks {

	/**
	 * @return void
	 */
	public static function init() {
		if ( ! function_exists( 'register_block_type' ) ) {
			return;
		}
		$version = isset( $GLOBALS['wp_version'] ) ? (string) $GLOBALS['wp_version'] : '0';
		if ( '0' !== $version && version_compare( $version, '6.3', '<' ) ) {
			return;
		}
		add_action( 'init', array( __CLASS__, 'register' ) );
	}

	/**
	 * @return void
	 */
	public static function register() {
		$script_deps = array( 'wp-blocks', 'wp-element', 'wp-components', 'wp-block-editor', 'wp-server-side-render', 'wp-i18n', 'wp-data', 'wp-api-fetch' );

		wp_register_script(
			'wdp-block-donation-form',
			WDP_PLUGIN_URL . 'blocks/donation-form/index.js',
			$script_deps,
			WDP_VERSION,
			true
		);
		wp_register_script(
			'wdp-block-donations',
			WDP_PLUGIN_URL . 'blocks/donations/index.js',
			$script_deps,
			WDP_VERSION,
			true
		);
		wp_set_script_translations( 'wdp-block-donation-form', 'woo-donation-popup', WDP_PLUGIN_DIR . 'languages' );
		wp_set_script_translations( 'wdp-block-donations', 'woo-donation-popup', WDP_PLUGIN_DIR . 'languages' );

		register_block_type(
			WDP_PLUGIN_DIR . 'blocks/donation-form',
			array(
				'render_callback' => array( Shortcodes::class, 'render_form' ),
			)
		);
		register_block_type(
			WDP_PLUGIN_DIR . 'blocks/donations',
			array(
				'render_callback' => array( __CLASS__, 'render_list' ),
			)
		);
	}

	/**
	 * @param array<string, mixed>    $atts    Attributes.
	 * @param string   $content Inner.
	 * @param \WP_Block $block   Block.
	 * @return string
	 */
	public static function render_form( $atts, $content = '', $block = null ) {
		return Render_Guard::html(
			static function () use ( $atts, $block ) {
				$atts    = is_array( $atts ) ? $atts : array();
				$context = ( is_object( $block ) && ! empty( $block->context ) ) ? (array) $block->context : array();
				$display = isset( $atts['display'] ) ? sanitize_key( (string) $atts['display'] ) : 'inline';
				$label   = isset( $atts['buttonText'] ) ? sanitize_text_field( (string) $atts['buttonText'] ) : '';
				$short   = array(
					'id'          => isset( $atts['productId'] ) ? absint( $atts['productId'] ) : 0,
					'slug'        => isset( $atts['slug'] ) ? sanitize_title( (string) $atts['slug'] ) : '',
					'sku'         => isset( $atts['sku'] ) ? sanitize_text_field( (string) $atts['sku'] ) : '',
					'text'        => $label,
					'button_text' => $label,
					'show_title'  => ( ! empty( $atts['showTitle'] ) && 'no' !== $atts['showTitle'] ) ? 'yes' : 'no',
				);
				if ( isset( $atts['layout'] ) && 'compact' === $atts['layout'] ) {
					$short['layout'] = 'compact';
				}
				if ( 'popup' === $display ) {
					return Shortcodes::render_button( $short, 'wdp_donation_button', 'popup', $context );
				}
				if ( 'panel' === $display ) {
					return Shortcodes::render_button( $short, 'wdp_donation_button_panel', 'side_panel', $context );
				}
				return Shortcodes::render_form( $short, $context );
			},
			isset( $atts['productId'] ) ? absint( $atts['productId'] ) : 0,
			'block_donation_form'
		);
	}

	/**
	 * @param array<string, mixed> $atts Attributes.
	 * @return string
	 */
	public static function render_list( $atts ) {
		return Donations_List::shortcode( is_array( $atts ) ? $atts : array() );
	}
}

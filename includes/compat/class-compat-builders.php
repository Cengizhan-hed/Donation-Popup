<?php
/**
 * Sayfa oluşturucu bağdaştırıcısı (Avada/Elementor/Divi/Bricks/Beaver adları yalnızca bu dosyada).
 *
 * Genel tespit WDP_Builder_Detect içindedir; burası yalnız ek işaretler ve API'ler ekler.
 * Çekirdek filtreleri: wdp_is_builder_preview, wdp_builder_preview_context_product.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class WDP_Compat_Builders
 */
class WDP_Compat_Builders {

	/**
	 * @return void
	 */
	public static function init() {
		add_filter( 'wdp_is_builder_preview', array( __CLASS__, 'is_preview' ), 10, 1 );
		add_filter( 'wdp_builder_preview_context_product', array( __CLASS__, 'context_product' ), 10, 1 );
	}

	/**
	 * @param bool $is_preview Genel tespit sonucu.
	 * @return bool
	 */
	public static function is_preview( $is_preview ) {
		if ( $is_preview ) {
			return true;
		}
		return self::avada() || self::elementor() || self::divi() || self::bricks() || self::beaver();
	}

	/**
	 * @param WC_Product|null $product Önceki değer.
	 * @return WC_Product|null
	 */
	public static function context_product( $product ) {
		return $product ? $product : self::avada_dynamic_product();
	}

	/**
	 * @return bool
	 */
	private static function avada() {
		$get = WDP_Builder_Detect::query_vars();
		if ( ! empty( $get['fb-edit'] ) || ( ! empty( $get['builder'] ) && 'true' === (string) $get['builder'] ) ) {
			return true;
		}
		$post_type = '';
		if ( ! empty( $get['post_type'] ) ) {
			$post_type = sanitize_key( (string) $get['post_type'] );
		} elseif ( function_exists( 'get_post_type' ) ) {
			$post_type = (string) get_post_type();
		}
		return in_array( $post_type, array( 'fusion_tb_section', 'fusion_tb_layout' ), true );
	}

	/**
	 * Avada Live "dynamic content preview" product, when a documented API exposes it.
	 *
	 * @return WC_Product|null
	 */
	private static function avada_dynamic_product() {
		if ( ! class_exists( 'FusionBuilder' ) && ! class_exists( 'Fusion_App' ) && ! function_exists( 'fusion_is_preview_frame' ) ) {
			return null;
		}
		$ids = array();
		if ( function_exists( 'fusion_library' ) && is_object( fusion_library() ) && method_exists( fusion_library(), 'get_page_id' ) ) {
			$ids[] = (int) fusion_library()->get_page_id();
		}
		if ( isset( $GLOBALS['fusion_dynamic_data_preview_id'] ) ) {
			$ids[] = absint( $GLOBALS['fusion_dynamic_data_preview_id'] );
		}
		$get = WDP_Builder_Detect::query_vars();
		foreach ( array( 'preview_id', 'fusion_preview', 'awb_preview_id' ) as $key ) {
			if ( ! empty( $get[ $key ] ) ) {
				$ids[] = absint( $get[ $key ] );
			}
		}
		foreach ( array_unique( array_filter( $ids ) ) as $id ) {
			if ( ! function_exists( 'wc_get_product' ) ) {
				break;
			}
			$product = wc_get_product( $id );
			if ( $product && class_exists( 'WDP_Donation_Scope' ) && WDP_Donation_Scope::is_donation_product( $product ) ) {
				return $product;
			}
			if ( $product && method_exists( $product, 'get_type' ) && $product->get_type() === 'simple' ) {
				return $product;
			}
		}
		return null;
	}

	/**
	 * @return bool
	 */
	private static function elementor() {
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return false;
		}
		try {
			$plugin = \Elementor\Plugin::$instance;
			if ( isset( $plugin->preview ) && is_object( $plugin->preview ) && method_exists( $plugin->preview, 'is_preview_mode' ) && $plugin->preview->is_preview_mode() ) {
				return true;
			}
			if ( isset( $plugin->editor ) && is_object( $plugin->editor ) && method_exists( $plugin->editor, 'is_edit_mode' ) && $plugin->editor->is_edit_mode() ) {
				return true;
			}
		} catch ( \Throwable $e ) {
			return false;
		}
		$get = WDP_Builder_Detect::query_vars();
		return ! empty( $get['elementor-preview'] ) || ( ! empty( $get['action'] ) && 'elementor' === (string) $get['action'] );
	}

	/**
	 * @return bool
	 */
	private static function divi() {
		$get = WDP_Builder_Detect::query_vars();
		return ! empty( $get['et_fb'] ) || ! empty( $get['et_fb_preview'] );
	}

	/**
	 * @return bool
	 */
	private static function bricks() {
		$get = WDP_Builder_Detect::query_vars();
		return ! empty( $get['bricks'] ) || ( isset( $get['brickspreview'] ) && '' !== (string) $get['brickspreview'] );
	}

	/**
	 * @return bool
	 */
	private static function beaver() {
		$get = WDP_Builder_Detect::query_vars();
		if ( ! empty( $get['fl_builder'] ) || ! empty( $get['fl_builder_preview'] ) ) {
			return true;
		}
		return class_exists( 'FLBuilderModel' ) && method_exists( 'FLBuilderModel', 'is_builder_active' ) && FLBuilderModel::is_builder_active();
	}
}

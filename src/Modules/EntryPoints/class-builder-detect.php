<?php
/**
 * Düzenleyici/önizleme tespiti: yalnız genel WordPress sinyalleri (hiçbir oluşturucu adı bilinmez).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Support\Admin_Notice;

defined( 'ABSPATH' ) || exit;

/**
 * Builder_Detect.
 */
class Builder_Detect {

	/** @var bool|null */
	private static $is_preview = null;

	/** @var object|null|false */
	private static $preview_product = false;

	/**
	 * Current request is a builder editor or preview AND the user may edit products.
	 *
	 * Visitors never see a sample product.
	 *
	 * @return bool
	 */
	public static function is_builder_preview() {
		if ( null !== self::$is_preview ) {
			return self::$is_preview;
		}
		self::$is_preview = false;
		if ( ! function_exists( 'current_user_can' ) || ! current_user_can( 'edit_products' ) ) {
			return false;
		}
		$generic = self::gutenberg() || self::wp_preview() || self::editor_query_var();
		/**
		 * Düzenleyici/önizleme isteği mi? Site sahibi ek işaret ekleyebilir.
		 *
		 * @param bool $generic Genel tespit sonucu.
		 */
		self::$is_preview = (bool) apply_filters( 'wdp_is_builder_preview', $generic ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye donuk uyumluluk sozlesmesi: eski wdp_ kanca adi degismez.
		return self::$is_preview;
	}

	/**
	 * Sample (or builder-selected) donation product for builder canvases.
	 *
	 * @return \WC_Product|null
	 */
	public static function preview_product() {
		if ( ! self::is_builder_preview() ) {
			return null;
		}
		if ( false !== self::$preview_product ) {
			return self::$preview_product ? self::$preview_product : null;
		}

		/**
		 * Oluşturucunun önizleme için seçtiği ürün (site sahibi sağlayabilir).
		 *
		 * @param \WC_Product|null $product Product or null.
		 */
		$product = apply_filters( 'wdp_builder_preview_context_product', null ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye donuk uyumluluk sozlesmesi: eski wdp_ kanca adi degismez.
		if ( ! $product ) {
			$product = self::latest_donation_product();
		}

		/**
		 * Override the product shown on builder canvases.
		 *
		 * @param \WC_Product|null $product Preview product.
		 */
		$filtered              = apply_filters( 'wdp_builder_preview_product', $product ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye donuk uyumluluk sozlesmesi: eski wdp_ kanca adi degismez.
		self::$preview_product = ( is_object( $filtered ) && method_exists( $filtered, 'get_id' ) ) ? $filtered : null;
		return self::$preview_product;
	}

	/**
	 * Admin-only note shown above a preview form/button.
	 *
	 * @param object $product \WC_Product.
	 * @return string
	 */
	public static function preview_notice( $product ) {
		if ( ! self::is_builder_preview() || ! is_object( $product ) || ! method_exists( $product, 'get_name' ) ) {
			return '';
		}
		$name = $product->get_name();
		/* translators: %s: sample product name */
		return Admin_Notice::admin_notice_html( sprintf( __( 'Preview: «%s» is shown. That product’s form appears on the product page.', 'woo-donation-popup' ), $name ) );
	}

	/**
	 * @return void
	 */
	public static function reset() {
		self::$is_preview      = null;
		self::$preview_product = false;
	}

	/**
	 * Gutenberg block editor REST render requests.
	 *
	 * @return bool
	 */
	private static function gutenberg() {
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST && ! empty( $GLOBALS['wp']->query_vars['rest_route'] ) ) {
			$route = (string) $GLOBALS['wp']->query_vars['rest_route'];
			if ( false !== strpos( $route, '/block-renderer/' ) ) {
				return true;
			}
		}
		if ( function_exists( 'wp_is_json_request' ) && wp_is_json_request() && isset( $_SERVER['REQUEST_URI'] ) ) {
			$uri = sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) );
			if ( false !== strpos( $uri, '/wp/v2/block-renderer' ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * WordPress'in kendi önizleme sinyalleri (yazı önizleme, Özelleştirici).
	 *
	 * @return bool
	 */
	private static function wp_preview() {
		return ( function_exists( 'is_preview' ) && is_preview() ) || ( function_exists( 'is_customize_preview' ) && is_customize_preview() );
	}

	/**
	 * Düzenleyici/önizleme çerçevelerinin kullandığı genel sorgu anahtarları:
	 * anahtar "edit", "preview", "builder" veya "fb" parçası içerir ve değeri doludur
	 * (örn. `x-edit`, `x_fb`, `x-preview`, `builder=true`).
	 *
	 * @return bool
	 */
	private static function editor_query_var() {
		foreach ( self::query_vars() as $key => $value ) {
			if ( '' === $value || '0' === $value || 'false' === $value ) {
				continue;
			}
			foreach ( preg_split( '/[-_]+/', (string) $key ) as $part ) {
				if ( in_array( $part, array( 'edit', 'preview', 'builder', 'fb' ), true ) ) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Latest published donation product (by modified date).
	 *
	 * @return \WC_Product|null
	 */
	private static function latest_donation_product() {
		if ( ! function_exists( 'wc_get_products' ) ) {
			return null;
		}
		$products = wc_get_products(
			array(
				'status'  => 'publish',
				'limit'   => 12,
				'orderby' => 'modified',
				'order'   => 'DESC',
				'type'    => class_exists( 'DonationPanel\\Domain\\Donation_Scope' ) ? Donation_Scope::supported_types() : array( 'simple' ),
				'return'  => 'objects',
			)
		);
		if ( ! is_array( $products ) ) {
			return null;
		}
		foreach ( $products as $product ) {
			if ( class_exists( 'DonationPanel\\Domain\\Donation_Scope' ) && Donation_Scope::is_donation_product( $product ) ) {
				return $product;
			}
		}
		return isset( $products[0] ) ? $products[0] : null;
	}

	/**
	 * @return array<string, mixed>
	 */
	public static function query_vars() {
		$out = array();
		if ( ! empty( $_GET ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			foreach ( $_GET as $key => $value ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
				if ( is_scalar( $value ) ) {
					$out[ sanitize_key( (string) $key ) ] = sanitize_text_field( wp_unslash( (string) $value ) );
				}
			}
		}
		return $out;
	}
}

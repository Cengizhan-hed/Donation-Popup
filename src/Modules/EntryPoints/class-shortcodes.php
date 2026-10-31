<?php
/**
 * Düğme / panel / sayfa içi form girişlerinin ortak çizimi: kısa kod, blok, Elementor ince katmanı ve otomatik yerleşim
 * aynı yöntemleri kullanır; çıktıyı yeni form deneyimi (`experiences`) üretir.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

use DonationPanel\Domain\Button_Settings;
use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Support\Admin_Notice;

defined( 'ABSPATH' ) || exit;

/**
 * Kısa kodlar.
 */
class Shortcodes {

	/**
	 * Donation button shortcode (center popup).
	 *
	 * @param array<string, mixed> $atts Shortcode attributes.
	 * @return string
	 */
	public static function donation_button_shortcode( $atts ) {
		return Render_Guard::html(
			static function () use ( $atts ) {
				return self::render_button( $atts, 'wdp_donation_button', 'popup' );
			},
			self::raw_id( $atts ),
			'wdp_donation_button'
		);
	}

	/**
	 * Donation button shortcode (right side panel).
	 *
	 * @param array<string, mixed> $atts Shortcode attributes.
	 * @return string
	 */
	public static function donation_button_panel_shortcode( $atts ) {
		return Render_Guard::html(
			static function () use ( $atts ) {
				return self::render_button( $atts, 'wdp_donation_button_panel', 'side_panel' );
			},
			self::raw_id( $atts ),
			'wdp_donation_button_panel'
		);
	}

	/**
	 * Donation form shortcode
	 *
	 * @param array<string, mixed> $atts Shortcode attributes.
	 * @return string
	 */
	public static function donation_form_shortcode( $atts ) {
		return Render_Guard::html(
			static function () use ( $atts ) {
				return self::render_form( $atts );
			},
			self::raw_id( $atts ),
			'wdp_donation_form'
		);
	}

	/**
	 * Ortak düğme çizici (kısa kod, blok, Elementor ince katmanı ve otomatik yerleşim): yeni form deneyimini çizer.
	 *
	 * @param array<string, mixed> $atts          Öznitelikler (`id`, `slug`, `sku`, `text`, `button_text`, `class`).
	 * @param string               $shortcode_tag Kısa kod adı (shortcode_atts için).
	 * @param string               $display_mode  popup|side_panel.
	 * @param array<string, mixed> $context       Blok bağlamı.
	 * @return string
	 */
	public static function render_button( $atts, $shortcode_tag, $display_mode, $context = array() ) {
		$raw_atts = is_array( $atts ) ? $atts : array();
		$atts     = shortcode_atts(
			array(
				'id'          => 0,
				'slug'        => '',
				'sku'         => '',
				'text'        => '',
				'button_text' => '',
				'class'       => '',
			),
			$raw_atts,
			$shortcode_tag
		);

		$resolved = self::resolve_for_output( $atts, $context );
		if ( is_string( $resolved ) ) {
			return $resolved;
		}
		$product    = $resolved['product'];
		$product_id = (int) $product->get_id();

		if ( self::product_is_unavailable( $product ) ) {
			return self::unavailable_product_notice( $product );
		}

		if ( self::auto_entry_already_drawn( $product_id ) ) {
			return '';
		}

		$button_text = self::resolve_button_text( '' !== $atts['text'] ? $atts['text'] : $atts['button_text'] );
		$kind        = 'side_panel' === $display_mode ? 'side_panel' : 'popup';
		$html        = Experience_Renderer::render( $product_id, $kind, $button_text, self::sanitize_class_list( $atts['class'] ) );
		if ( '' !== $html ) {
			Render_Registry::mark_trigger( $product_id );
		}
		return $resolved['notice'] . $html;
	}

	/**
	 * Ortak sayfa içi form çizici.
	 *
	 * @param array<string, mixed> $atts    Öznitelikler (`id`, `slug`, `sku`, `title`, `show_title`, `class`, `layout` = ''|compact).
	 * @param array<string, mixed> $context Blok bağlamı.
	 * @return string
	 */
	public static function render_form( $atts, $context = array() ) {
		$raw  = is_array( $atts ) ? $atts : array();
		$atts = shortcode_atts(
			array(
				'id'          => 0,
				'slug'        => '',
				'sku'         => '',
				'button_text' => '',
				'text'        => '',
				'title'       => '',
				'show_title'  => 'yes',
				'class'       => '',
				'layout'      => '',
			),
			$raw,
			'wdp_donation_form'
		);
		// `layout="compact"`: slider/hero için yüksekliği sabit kart; başka/boş değer bugünkü formu AYNEN çizer.
		$kind = 'compact' === sanitize_key( (string) $atts['layout'] ) ? 'compact' : 'inline';

		$resolved = self::resolve_for_output( $atts, $context );
		if ( is_string( $resolved ) ) {
			return $resolved;
		}
		$product    = $resolved['product'];
		$product_id = (int) $product->get_id();

		if ( self::product_is_unavailable( $product ) ) {
			return self::unavailable_product_notice( $product );
		}

		if ( self::auto_entry_already_drawn( $product_id ) ) {
			return '';
		}

		if ( ! Render_Registry::claim_form( $product_id ) ) {
			return Render_Registry::duplicate_form_notice( $product_id );
		}

		return $resolved['notice'] . Experience_Renderer::render( $product_id, $kind, '', self::sanitize_class_list( $atts['class'] ) );
	}

	/**
	 * One entry point per product page: after auto-placement drew the button/form,
	 * a later shortcode/block/widget for the same product on a product page prints nothing.
	 *
	 * @param int $product_id Product ID.
	 * @return bool
	 */
	private static function auto_entry_already_drawn( $product_id ) {
		if ( ! Render_Registry::has_auto( $product_id ) || ( Builder_Detect::is_builder_preview() ) ) {
			return false;
		}
		/**
		 * Allow several entry points on one page for the same product.
		 *
		 * @param bool $allow      Default false.
		 * @param int  $product_id Product ID.
		 */
		return ! apply_filters( 'wdp_allow_multiple_entries', false, $product_id ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye donuk uyumluluk sozlesmesi: eski wdp_ kanca adi degismez.
	}

	/**
	 * Resolve product, apply scope, return product+preview notice or an HTML string (error/empty).
	 *
	 * @param array<string, mixed> $atts    Attributes.
	 * @param array<string, mixed> $context Block context.
	 * @return array{product:object,notice:string}|string
	 */
	public static function resolve_for_output( $atts, $context = array() ) {
		$atts     = is_array( $atts ) ? $atts : array();
		$context  = is_array( $context ) ? $context : array();
		$explicit = Product_Resolver::has_explicit_product( $atts );
		$product  = Product_Resolver::resolve( $atts, $context );

		$preview_notice = '';
		if ( $product && ! $explicit ) {
			// Yalnız editör önizlemesinde ve örnek ürün gösterilirken (Builder_Detect::preview_notice).
			$preview_notice = Builder_Detect::preview_notice( $product );
		}

		if ( ! $product ) {
			return Admin_Notice::admin_notice_html(
				__( 'Donation form: product not found (no id/slug/sku was given, or this is not a product page).', 'woo-donation-popup' )
			);
		}

		if ( ! $explicit && ! Donation_Scope::is_donation_product( $product ) ) {
			return Admin_Notice::admin_notice_html( __( 'This product is not marked as a donation product.', 'woo-donation-popup' ) );
		}

		// Açık id/slug/sku'lu giriş de bağış kapsamında olmalı (REST artık kapsam dışı ürünü reddeder): ziyaretçiye boş
		// çıktı, mağaza yöneticisine nedenini söyleyen ipucu.
		if ( $explicit && ! Donation_Scope::is_donation_product( $product ) ) {
			return Admin_Notice::manager_notice_html(
				sprintf(
					/* translators: %d: product ID */
					__( 'Donation form hidden: product #%d is outside the donation scope. Mark it as a donation product (Donation Panel settings, "Which products are donation products") or change the scope.', 'woo-donation-popup' ),
					(int) $product->get_id()
				)
			);
		}

		return array(
			'product' => $product,
			'notice'  => $preview_notice,
		);
	}

	/**
	 * Space-separated HTML classes; each token is sanitized separately.
	 *
	 * @param mixed $raw Raw class attribute.
	 * @return string
	 */
	public static function sanitize_class_list( $raw ) {
		$parts = preg_split( '/\s+/', is_scalar( $raw ) ? trim( (string) $raw ) : '' );
		$out   = array();
		foreach ( (array) $parts as $part ) {
			$clean = sanitize_html_class( $part );
			if ( '' !== $clean && ! in_array( $clean, $out, true ) ) {
				$out[] = $clean;
			}
		}
		return implode( ' ', $out );
	}

	/**
	 * Shared stock / purchasable check for button and inline form.
	 *
	 * @param object $product \WC_Product.
	 * @return bool
	 */
	public static function product_is_unavailable( $product ) {
		if ( ! is_object( $product ) || ! method_exists( $product, 'get_id' ) ) {
			return false;
		}
		if ( method_exists( $product, 'is_purchasable' ) && ! $product->is_purchasable() ) {
			return true;
		}
		if ( method_exists( $product, 'is_in_stock' ) && ! $product->is_in_stock() ) {
			return true;
		}
		return false;
	}

	/**
	 * Admin-only notice when the product cannot be donated; guests see empty output.
	 *
	 * @param object $product \WC_Product.
	 * @return string
	 */
	public static function unavailable_product_notice( $product ) {
		if ( ! self::product_is_unavailable( $product ) ) {
			return '';
		}
		$product_id = (int) $product->get_id();
		if ( method_exists( $product, 'is_purchasable' ) && ! $product->is_purchasable() ) {
			return Admin_Notice::admin_notice_html(
				sprintf(
					/* translators: %d: product ID */
					__( 'This product cannot be purchased (ID: %d).', 'woo-donation-popup' ),
					$product_id
				)
			);
		}
		if ( method_exists( $product, 'is_in_stock' ) && ! $product->is_in_stock() ) {
			return Admin_Notice::admin_notice_html(
				sprintf(
					/* translators: %d: product ID */
					__( 'This product is out of stock (ID: %d).', 'woo-donation-popup' ),
					$product_id
				)
			);
		}
		return '';
	}

	/**
	 * Düğme metni: verilen metin, yoksa genel ayar, yoksa varsayılan.
	 *
	 * @param mixed $text Ham metin.
	 * @return string
	 */
	public static function resolve_button_text( $text ) {
		$text = is_scalar( $text ) ? sanitize_text_field( (string) $text ) : '';
		if ( '' !== $text ) {
			return $text;
		}
		$button_settings = Button_Settings::get();
		if ( ! empty( $button_settings['popup_button_text'] ) ) {
			return sanitize_text_field( (string) $button_settings['popup_button_text'] );
		}
		return __( 'Donate', 'woo-donation-popup' );
	}

	/**
	 * Product ID attribute as typed (for error notices before the product is resolved).
	 *
	 * @param mixed $atts Shortcode attributes.
	 * @return int
	 */
	private static function raw_id( $atts ) {
		return ( is_array( $atts ) && isset( $atts['id'] ) ) ? absint( $atts['id'] ) : 0;
	}
}

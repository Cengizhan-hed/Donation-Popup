<?php
/**
 * Form modeli: ürün ayarlarından, kap ve gösterimden bağımsız tek veri yapısı üretir.
 *
 * Mevcut ürün bağlamı (eski motor) okunur; model yalnız form çekirdeğinin ihtiyacı olan alanları taşır
 * ve kişi verisi içermez.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Experiences;

defined( 'ABSPATH' ) || exit;

/**
 * Form_Context.
 */
final class Form_Context {

	/**
	 * Bir ürün için form modelini üretir; ürün bağış formu çizemiyorsa boş dizi döner.
	 *
	 * @param \WC_Product|object $product Ürün.
	 * @return array<string, mixed>
	 */
	public static function for_product( $product ) {
		if ( ! is_object( $product ) || ! method_exists( $product, 'get_id' ) ) {
			return array();
		}

		$legacy = array();
		if ( class_exists( 'WDP_Donation_Product_Context_Service' ) ) {
			$legacy = \WDP_Donation_Product_Context_Service::build_form_context( $product );
		}
		return self::from_legacy( is_array( $legacy ) ? $legacy : array(), $product );
	}

	/**
	 * Eski motor bağlamından modeli türetir (saf; test edilebilir).
	 *
	 * @param array<string, mixed> $legacy  Eski form bağlamı.
	 * @param object|null          $product Ürün (başlık/görsel için).
	 * @return array<string, mixed>
	 */
	public static function from_legacy( array $legacy, $product = null ) {
		$product_id = isset( $legacy['product_id'] ) ? (int) $legacy['product_id'] : 0;
		if ( $product_id < 1 && is_object( $product ) && method_exists( $product, 'get_id' ) ) {
			$product_id = (int) $product->get_id();
		}

		$title = isset( $legacy['product_name'] ) ? (string) $legacy['product_name'] : '';
		if ( '' === $title && is_object( $product ) && method_exists( $product, 'get_name' ) ) {
			$title = (string) $product->get_name();
		}

		$fixed_price  = isset( $legacy['product_price'] ) && is_numeric( $legacy['product_price'] ) ? (float) $legacy['product_price'] : 0.0;
		$allow_custom = ! empty( $legacy['allow_custom_price'] ) || $fixed_price <= 0;
		$min          = isset( $legacy['min_price'] ) && is_numeric( $legacy['min_price'] ) ? max( 0.0, (float) $legacy['min_price'] ) : 0.0;

		$presets = array();
		if ( ! empty( $legacy['enable_amount_presets'] ) ) {
			$presets = self::parse_presets( isset( $legacy['amount_presets'] ) ? (string) $legacy['amount_presets'] : '' );
		}
		if ( ! $allow_custom && $fixed_price > 0 ) {
			$presets = array( $fixed_price );
		}

		/**
		 * Hızlı tutar seçeneklerini değiştirir.
		 *
		 * @param float[] $presets    Tutarlar (en çok 6).
		 * @param int     $product_id Ürün.
		 */
		$presets = array_slice( array_values( array_filter( array_map( 'floatval', (array) apply_filters( 'donation_panel_amount_presets', $presets, $product_id ) ) ) ), 0, 6 );

		$recommended = null;
		if ( isset( $legacy['amount_preset_recommended'] ) && is_numeric( $legacy['amount_preset_recommended'] ) ) {
			foreach ( $presets as $preset ) {
				if ( abs( $preset - (float) $legacy['amount_preset_recommended'] ) < 0.005 ) {
					$recommended = $preset;
				}
			}
		}

		$decimals = function_exists( 'wc_get_price_decimals' ) ? (int) wc_get_price_decimals() : 2;
		$symbol   = isset( $legacy['currency_symbol'] ) ? (string) $legacy['currency_symbol'] : '';
		if ( '' === $symbol && function_exists( 'get_woocommerce_currency_symbol' ) ) {
			$symbol = html_entity_decode( (string) get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8' );
		}

		$shares = ! empty( $legacy['allow_multiple_shares'] );
		$model  = array(
			'product_id'     => $product_id,
			'title'          => $title,
			'symbol'         => $symbol,
			'decimals'       => max( 0, $decimals ),
			'presets'        => $presets,
			'recommended'    => $recommended,
			'allow_custom'   => $allow_custom,
			'min'            => $min,
			'closed'         => ! empty( $legacy['goal_closed'] ),
			'closed_message' => isset( $legacy['goal_reached_message'] ) ? (string) $legacy['goal_reached_message'] : '',
			'types'          => self::types( $product_id ),
			'fields'         => self::fields( $legacy, $shares ),
		);

		/**
		 * Form modelini değiştirir (kişi verisi eklenmemelidir).
		 *
		 * @param array<string, mixed> $model  Form modeli.
		 * @param array<string, mixed> $legacy Eski bağlam.
		 */
		return (array) apply_filters( 'donation_panel_form_model', $model, $legacy );
	}

	/**
	 * Tutar listesini ayrıştırır (boşluk, virgül, noktalı virgül; en çok 6; pozitif).
	 *
	 * @param string $csv Ham liste.
	 * @return float[]
	 */
	public static function parse_presets( $csv ) {
		$csv = trim( (string) $csv );
		if ( '' === $csv && class_exists( 'WDP_Form_Modules' ) ) {
			$csv = (string) \WDP_Form_Modules::default_amount_presets_csv();
		}
		$out   = array();
		$parts = preg_split( '/[\s,;]+/', $csv );
		foreach ( (array) $parts as $part ) {
			if ( ! is_numeric( $part ) || (float) $part <= 0 ) {
				continue;
			}
			$out[] = (float) $part;
			if ( count( $out ) >= 6 ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * Bağış türü seçenekleri (yalnız `donation_panel_frequency_options` doluysa görünür).
	 *
	 * @param int $product_id Ürün.
	 * @return array<int, array{value: string, label: string}>
	 */
	private static function types( $product_id ) {
		/**
		 * Bağış türü (ör. tek seferlik/aylık) seçenekleri; boş dizi türü gizler.
		 *
		 * @param array<int, array{value: string, label: string}> $options    Seçenekler.
		 * @param int                                             $product_id Ürün.
		 */
		$options = (array) apply_filters( 'donation_panel_frequency_options', array(), $product_id );
		$out     = array();
		foreach ( $options as $option ) {
			if ( is_array( $option ) && isset( $option['value'], $option['label'] ) ) {
				$out[] = array(
					'value' => sanitize_key( (string) $option['value'] ),
					'label' => (string) $option['label'],
				);
			}
		}
		return count( $out ) > 1 ? $out : array();
	}

	/**
	 * Alan tanımları (sipariş sözleşmesiyle aynı alan adları).
	 *
	 * @param array<string, mixed> $legacy Eski bağlam.
	 * @param bool                 $shares Hisseli ürün mü (ithaf/e-posta yok).
	 * @return array<int, array<string, mixed>>
	 */
	private static function fields( array $legacy, $shares ) {
		$fields = array(
			array(
				'name'         => 'donation_full_name',
				'type'         => 'text',
				'label'        => __( 'Full name *', 'woo-donation-popup' ),
				'required'     => true,
				'required_msg' => __( 'Please enter your full name.', 'woo-donation-popup' ),
				'autocomplete' => 'name',
				'maxlength'    => 100,
			),
			array(
				'name'         => 'donation_phone',
				'type'         => 'tel',
				'label'        => __( 'Phone number *', 'woo-donation-popup' ),
				'required'     => true,
				'required_msg' => __( 'Please enter your phone number.', 'woo-donation-popup' ),
				'autocomplete' => 'tel',
				'inputmode'    => 'tel',
				'maxlength'    => 28,
			),
		);
		if ( ! $shares && ! empty( $legacy['enable_email'] ) ) {
			$fields[] = array(
				'name'         => 'donation_email',
				'type'         => 'email',
				'label'        => __( 'Email (optional)', 'woo-donation-popup' ),
				'required'     => false,
				'autocomplete' => 'email',
				'inputmode'    => 'email',
				'maxlength'    => 100,
			);
		}
		if ( ! $shares && ! empty( $legacy['enable_dedication'] ) ) {
			$placeholder = isset( $legacy['dedication_placeholder'] ) ? (string) $legacy['dedication_placeholder'] : '';
			$fields[]    = array(
				'name'         => 'donation_dedication',
				'type'         => 'text',
				'label'        => __( 'Dedication', 'woo-donation-popup' ),
				'placeholder'  => $placeholder,
				'required'     => false,
				'autocomplete' => 'off',
				'maxlength'    => 120,
			);
		}
		$fields[] = array(
			'name'         => 'donation_note',
			'type'         => 'textarea',
			'label'        => __( 'Note (optional)', 'woo-donation-popup' ),
			'required'     => false,
			'autocomplete' => 'off',
			'maxlength'    => 500,
		);
		if ( ! $shares && ! empty( $legacy['enable_anonymous'] ) ) {
			$fields[] = array(
				'name'     => 'donation_anonymous',
				'type'     => 'checkbox',
				'label'    => __( 'Anonymous donation', 'woo-donation-popup' ),
				'required' => false,
			);
		}

		/**
		 * Form alanlarını değiştirir. Alan adları sipariş sözleşmesiyle aynı kalmalıdır.
		 *
		 * @param array<int, array<string, mixed>> $fields Alan tanımları.
		 * @param array<string, mixed>             $legacy Eski bağlam.
		 */
		return array_values( (array) apply_filters( 'donation_panel_form_fields', $fields, $legacy ) );
	}
}

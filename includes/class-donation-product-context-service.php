<?php
/**
 * WC ürününden normalize edilmiş form bağlamı (fiyat, hisse, addon) üretir.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Builds normalized product context for shortcode/template rendering.
 */
class WDP_Donation_Product_Context_Service {
	/**
	 * Resolve product by ID safely.
	 *
	 * @param int $product_id Product ID.
	 * @return WC_Product|false
	 */
	public static function get_product( $product_id ) {
		$product_id = absint( $product_id );
		if ( ! $product_id ) {
			return false;
		}

		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			return false;
		}

		return $product;
	}

	/**
	 * Build normalized form context.
	 *
	 * @param WC_Product $product Product.
	 * @return array
	 */
	public static function build_form_context( $product ) {
		$product_id            = (int) $product->get_id();
		$product_price         = $product->get_price();
		$allow_custom_price    = $product->get_meta( '_allow_custom_price' ) === 'yes';
		$allow_multiple_shares = $product->get_meta( '_allow_multiple_shares' ) === 'yes';
		$enable_progress_bar   = $product->get_meta( '_enable_progress_bar' ) === 'yes';

		// Progress bar forms always collect a custom amount.
		if ( $enable_progress_bar ) {
			$allow_custom_price = true;
		}

		$min_price = (string) $product->get_meta( '_min_custom_price' );
		if ( $allow_custom_price && $min_price === '' ) {
			$min_price = '0';
		}

		$max_shares = (string) $product->get_meta( '_max_shares' );
		if ( $allow_multiple_shares && $max_shares === '' ) {
			$max_shares = '7';
		}

		$progress_bar_limit       = (string) $product->get_meta( '_progress_bar_limit' );
		$progress_bar_limit_value = (float) $progress_bar_limit;

		$progress_min_price = $min_price;
		if ( $enable_progress_bar ) {
			$progress_min_price = ( $min_price !== '' && (float) $min_price > 0 ) ? $min_price : '0';
		}

		$total_donation = 0.0;
		if ( $enable_progress_bar ) {
			$total_donation = WDP_Utils::get_total_donation_amount( $product_id );
		}

		$addon_min_price = (string) WDP_Addon_Product_Visibility::get_meta( $product, '_addon_min_price' );
		if ( $addon_min_price === '' ) {
			$addon_min_price = '0';
		}

		$addon_fixed_price    = (string) WDP_Addon_Product_Visibility::get_meta( $product, '_addon_fixed_price' );
		$addon_fixed_float    = ( $addon_fixed_price !== '' ) ? (float) wc_format_decimal( $addon_fixed_price ) : 0.0;
		$addon_is_fixed_price = $addon_fixed_float > 0;
		$addon_wc_product_id  = class_exists( 'WDP_Utils' )
			? (string) WDP_Utils::get_configured_addon_wc_product_id( $product )
			: (string) absint( WDP_Addon_Product_Visibility::get_meta( $product, '_addon_wc_product_id' ) );
		$addon_toggle_label   = class_exists( 'WDP_Utils' ) ? WDP_Utils::get_addon_toggle_label( $product ) : __( 'Add add-on donation', 'woo-donation-popup' );

		$context = array(
			'product_id'                => $product_id,
			'product_name'              => $product->get_name(),
			'product_price'             => $product_price,
			'formatted_price'           => $product_price ? WDP_Utils::format_price_html( $product_price ) : '',
			'allow_custom_price'        => $allow_custom_price,
			'min_price'                 => $min_price,
			'allow_multiple_shares'     => $allow_multiple_shares,
			'max_shares'                => $max_shares,
			'enable_progress_bar'       => $enable_progress_bar,
			'progress_bar_limit'        => $progress_bar_limit_value,
			'progress_min_price'        => $progress_min_price,
			'total_donation'            => $total_donation,
			'enable_product_note'       => $product->get_meta( '_enable_product_note' ) === 'yes',
			'product_note_text'         => trim( (string) $product->get_meta( '_product_note_text' ) ),
			'enable_sadaka_donation'    => WDP_Addon_Product_Visibility::get_meta( $product, '_enable_addon_donation' ) === 'yes',
			'sadaka_donation_message'   => trim( (string) WDP_Addon_Product_Visibility::get_meta( $product, '_addon_donation_message' ) ),
			'sadaka_min_price'          => $addon_min_price,
			'sadaka_fixed_price'        => $addon_is_fixed_price ? wc_format_decimal( $addon_fixed_float ) : '',
			'sadaka_is_fixed_price'     => $addon_is_fixed_price,
			'sadaka_wc_product_id'      => $addon_wc_product_id,
			'sadaka_toggle_label'       => $addon_toggle_label,
			'currency_symbol'           => WDP_Utils::get_display_currency_symbol(),
			'custom_price_placeholder'  => ( (float) ( $enable_progress_bar ? $progress_min_price : $min_price ) > 0 )
				? WDP_Utils::format_min_placeholder( $enable_progress_bar ? $progress_min_price : $min_price )
				: '',
			'sadaka_price_placeholder'  => $addon_is_fixed_price
				? ''
				: ( ( (float) $addon_min_price > 0 )
					? WDP_Utils::format_min_placeholder( $addon_min_price )
					: __( 'Add-on amount', 'woo-donation-popup' ) ),
			'enable_trust_strip'        => self::meta_flag_default_yes( $product, '_enable_trust_strip' ),
			'enable_quantity'           => self::meta_flag_default_yes( $product, '_enable_quantity' ),
			'enable_amount_presets'     => self::meta_flag_default_yes( $product, '_enable_amount_presets' ),
			'enable_wizard'             => self::meta_flag_or_global( $product, '_enable_wizard', 'enable_multi_step' ),
			'enable_field_icons'        => self::meta_flag_or_global( $product, '_enable_field_icons', 'enable_field_icons' ),
			'enable_impact_line'        => self::meta_flag_default_yes( $product, '_enable_impact_line' ),
			'impact_line_text'          => trim( (string) $product->get_meta( '_impact_line_text' ) ),
			'amount_presets'            => trim( (string) $product->get_meta( '_amount_presets' ) ),
			'amount_preset_recommended' => trim( (string) $product->get_meta( '_amount_preset_recommended' ) ),
			'enable_email'              => self::meta_flag_or_global( $product, '_enable_email', 'enable_donor_email' ),
			'enable_dedication'         => self::meta_flag_or_global( $product, '_enable_dedication', 'enable_dedication' ),
			'enable_anonymous'          => self::meta_flag_or_global( $product, '_enable_anonymous', 'enable_anonymous' ),
			'dedication_placeholder'    => trim( (string) $product->get_meta( '_dedication_placeholder' ) ),
			'trust_badges'              => (string) $product->get_meta( '_trust_badges' ),
			'theme_primary'             => (string) $product->get_meta( '_theme_primary' ),
			'theme_primary_hover'       => (string) $product->get_meta( '_theme_primary_hover' ),
			'theme_radius'              => (string) $product->get_meta( '_theme_radius' ),
			'theme_modal_bg'            => (string) $product->get_meta( '_theme_modal_bg' ),
			'layout_mode'               => in_array( sanitize_key( (string) $product->get_meta( '_layout_mode' ) ), array( 'classic', 'campaign', 'story' ), true )
				? sanitize_key( (string) $product->get_meta( '_layout_mode' ) )
				: 'classic',
			'enable_campaign_media'     => $product->get_meta( '_enable_campaign_media' ) === 'yes',
			'enable_urgency'            => $product->get_meta( '_enable_urgency' ) === 'yes',
			'urgency_text'              => trim( (string) $product->get_meta( '_urgency_text' ) ),
			'urgency_ends_at'           => trim( (string) $product->get_meta( '_urgency_ends_at' ) ),
			'enable_social_proof'       => $product->get_meta( '_enable_social_proof' ) === 'yes',
			'social_proof_text'         => trim( (string) $product->get_meta( '_social_proof_text' ) ),
			'enable_cover_fee'          => $product->get_meta( '_enable_cover_fee' ) === 'yes',
			'cover_fee_percent'         => WDP_Form_Modules::clamp_cover_fee_percent_for_runtime( $product->get_meta( '_cover_fee_percent' ) ),
			'goal_reached_action'       => class_exists( 'WDP_Campaign_Goal' )
				? WDP_Campaign_Goal::resolve_action( $product )
				: 'message',
			'goal_reached_message'      => class_exists( 'WDP_Campaign_Goal' )
				? WDP_Campaign_Goal::resolve_message( $product )
				: '',
			'goal_reached'              => class_exists( 'WDP_Campaign_Goal' )
				? WDP_Campaign_Goal::is_goal_reached( $product_id, array( 'include_pending' => false ) )
				: false,
			'goal_closed'               => class_exists( 'WDP_Campaign_Goal' )
				? WDP_Campaign_Goal::should_block_new_donations( $product )
				: false,
		);

		return apply_filters( 'wdp_form_context', $context, $product );
	}

	/**
	 * Post meta yes/no with empty → yes.
	 *
	 * @param WC_Product $product Product.
	 * @param string     $key     Meta key.
	 * @return bool
	 */
	private static function meta_flag_default_yes( $product, $key ) {
		$raw = $product->get_meta( $key );
		if ( $raw === '' || $raw === null ) {
			return true;
		}
		return $raw === 'yes';
	}

	/**
	 * yes/no meta with empty → global button setting.
	 *
	 * @param WC_Product $product     Product.
	 * @param string     $meta_key    Meta key.
	 * @param string     $global_key  Key in wdp_button_settings.
	 * @return bool
	 */
	private static function meta_flag_or_global( $product, $meta_key, $global_key ) {
		return self::resolve_flag_or_global( $product, $meta_key, $global_key );
	}

	/**
	 * Public resolver: yes/no meta with empty → global button setting.
	 *
	 * @param WC_Product $product     Product.
	 * @param string     $meta_key    Meta key.
	 * @param string     $global_key  Key in wdp_button_settings.
	 * @return bool
	 */
	public static function resolve_flag_or_global( $product, $meta_key, $global_key ) {
		$raw = $product->get_meta( $meta_key );
		if ( $raw === 'yes' ) {
			return true;
		}
		if ( $raw === 'no' ) {
			return false;
		}
		$button = get_option( 'wdp_button_settings', array() );
		return is_array( $button ) && ! empty( $button[ $global_key ] ) && (string) $button[ $global_key ] === '1';
	}
}

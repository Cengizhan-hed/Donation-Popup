<?php
/**
 * WooCommerce ürün düzenleme ekranındaki "Bağış" sekmesi: bağış tipi, gruplu ayarlar ve kayıt.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Product data "Bağış" tab (render + save through the WC product object).
 */
class WDP_Admin_Product_Data_Tab {
	const TAB_KEY      = 'wdp_donation';
	const PANEL_ID     = 'wdp_donation_product_data';
	const FIELD_NAME   = 'wdp_donation';
	const NONCE_ACTION = 'wdp_save_product_donation';
	const NONCE_FIELD  = 'wdp_product_donation_nonce';

	/**
	 * Header blocks whose order a product may override (body blocks have a fixed order).
	 */
	const HEADER_MODULES = array( 'media', 'impact', 'urgency', 'social_proof', 'progress' );

	const MAX_TRUST_ROWS = 3;

	/**
	 * Register WooCommerce hooks.
	 *
	 * @return void
	 */
	public static function register() {
		add_filter( 'woocommerce_product_data_tabs', array( __CLASS__, 'add_tab' ) );
		add_action( 'woocommerce_product_data_panels', array( __CLASS__, 'render_panel' ) );
		add_action( 'woocommerce_admin_process_product_object', array( __CLASS__, 'save' ) );
	}

	/**
	 * Edit link that opens this tab.
	 *
	 * @param int $product_id Product ID.
	 * @return string
	 */
	public static function get_edit_url( $product_id ) {
		return admin_url( 'post.php?post=' . absint( $product_id ) . '&action=edit' ) . '#' . self::TAB_KEY;
	}

	/**
	 * @param array $tabs Product data tabs.
	 * @return array
	 */
	public static function add_tab( $tabs ) {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return $tabs;
		}

		$classes = array();
		foreach ( WDP_Donation_Scope::supported_types() as $type ) {
			$classes[] = 'show_if_' . $type;
		}

		$tabs[ self::TAB_KEY ] = array(
			'label'    => __( 'Donation', 'woo-donation-popup' ),
			'target'   => self::PANEL_ID,
			'class'    => $classes,
			'priority' => 15,
		);

		return $tabs;
	}

	/**
	 * Persist panel values on product save.
	 *
	 * @param WC_Product $product Product being saved.
	 * @return void
	 */
	public static function save( $product ) {
		try {
			self::save_panel( $product );
		} catch ( \Throwable $e ) {
			if ( function_exists( 'wdp_debug_log' ) ) {
				wdp_debug_log( 'WDP product tab save failed: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
			}
		}
	}

	/**
	 * @param WC_Product $product Product being saved.
	 * @return void
	 */
	private static function save_panel( $product ) {
		if ( ! is_a( $product, 'WC_Product' ) ) {
			return;
		}

		$nonce = isset( $_POST[ self::NONCE_FIELD ] ) ? sanitize_text_field( wp_unslash( $_POST[ self::NONCE_FIELD ] ) ) : '';
		if ( $nonce === '' || ! wp_verify_nonce( $nonce, self::NONCE_ACTION ) ) {
			return;
		}

		if ( ! current_user_can( 'manage_woocommerce' ) || ! current_user_can( 'edit_post', $product->get_id() ) ) {
			return;
		}

		// Sanitized field by field in WDP_Product_Settings_Service::from_request().
		$posted = ( isset( $_POST[ self::FIELD_NAME ] ) && is_array( $_POST[ self::FIELD_NAME ] ) ) ? $_POST[ self::FIELD_NAME ] : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized

		$existing = array();
		foreach ( WDP_Product_Settings_Service::PRESERVED_FIELDS as $meta_key ) {
			$existing[ $meta_key ] = $product->get_meta( $meta_key, true );
		}
		foreach ( WDP_Product_Settings_Service::VALIDATED_META_KEYS as $meta_key ) {
			$existing[ $meta_key ] = $product->get_meta( $meta_key, true );
		}

		foreach ( WDP_Product_Settings_Service::from_product_panel( $posted, $existing, $product->get_id() ) as $meta_key => $meta_value ) {
			$product->update_meta_data( $meta_key, $meta_value );
		}
		WDP_Product_Settings_Service::flush_correction_notices();
		if ( class_exists( 'WDP_Donation_Scope' ) ) {
			WDP_Donation_Scope::flush( $product->get_id() );
		}
		if ( class_exists( 'WDP_Donations_List' ) ) {
			WDP_Donations_List::on_product_settings_save();
		}
	}

	/**
	 * Render the panel.
	 *
	 * @return void
	 */
	public static function render_panel() {
		global $post, $product_object;

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}

		$product = ( $product_object instanceof WC_Product ) ? $product_object : ( isset( $post->ID ) ? wc_get_product( $post->ID ) : false );
		if ( ! $product ) {
			return;
		}

		$values = self::get_panel_values( $product );

		echo '<div id="' . esc_attr( self::PANEL_ID ) . '" class="panel woocommerce_options_panel hidden wdp-pp" data-wdp-product-panel data-wdp-supported-types="' . esc_attr( implode( ' ', WDP_Donation_Scope::supported_types() ) ) . '">';
		wp_nonce_field( self::NONCE_ACTION, self::NONCE_FIELD );

		self::render_scope_block( $product, $values );
		self::render_type_picker( $values['donation_type'] );
		self::render_type_fields( $product, $values );

		echo '<div class="wdp-pp-sections">';
		self::render_amount_section( $values );
		self::render_form_fields_section( $values );
		self::render_campaign_blocks_section( $product->get_id(), $values );
		self::render_addon_section( $values, $product->get_id() );
		self::render_appearance_section( $values );
		echo '</div>';

		self::render_shortcode_block( $product->get_id() );

		echo '<p class="screen-reader-text" data-wdp-products-status role="status" aria-live="polite"></p>';
		echo '</div>';
	}

	/**
	 * Mini progress summary (collected / goal + recalc button), shared with the products table.
	 *
	 * @param int  $product_id Product ID.
	 * @param bool $compact    Table variant.
	 * @return void
	 */
	public static function render_progress_summary( $product_id, $compact = false ) {
		$product_id = absint( $product_id );
		$goal_raw   = (string) get_post_meta( $product_id, '_progress_bar_limit', true );
		$goal       = (float) ( $goal_raw !== '' ? $goal_raw : WDP_Donation_Type::DEFAULT_GOAL );
		$stored     = get_post_meta( $product_id, '_wdp_total_donation_amount', true );
		$has_total  = ( $stored !== '' && is_numeric( $stored ) );
		$total      = $has_total ? max( 0.0, (float) $stored ) : 0.0;
		$percent    = $goal > 0 ? min( 100, (int) floor( ( $total / $goal ) * 100 ) ) : 0;

		$total_text    = $has_total ? WDP_Utils::format_price_plain( $total ) : __( '0', 'woo-donation-popup' );
		$goal_text     = WDP_Utils::format_price_plain( $goal );
		$unconverted   = get_post_meta( $product_id, '_wdp_progress_unconverted_orders', true );
		$unconverted_n = is_array( $unconverted ) ? count( $unconverted ) : 0;

		echo '<div class="wdp-progress-summary' . ( $compact ? ' wdp-progress-summary--compact' : '' ) . '" data-wdp-progress data-goal="' . esc_attr( (string) $goal ) . '">';
		echo '<div class="wdp-progress-summary__text">';
		echo '<span class="wdp-progress-summary__total" data-wdp-progress-total>' . esc_html( $total_text ) . '</span>';
		echo ' <span class="wdp-progress-summary__goal">/ ' . esc_html( $goal_text ) . '</span>';
		echo '</div>';
		echo '<div class="wdp-progress-summary__row">';
		echo '<div class="wdp-progress-summary__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' . esc_attr( (string) $percent ) . '" aria-label="' . esc_attr__( 'Progress toward goal', 'woo-donation-popup' ) . '" data-wdp-progress-track>';
		echo '<span class="wdp-progress-summary__bar" style="width:' . esc_attr( (string) $percent ) . '%" data-wdp-progress-bar></span>';
		echo '</div>';
		echo '<span class="wdp-progress-summary__percent" data-wdp-progress-percent>%' . esc_html( (string) $percent ) . '</span>';
		echo '<button type="button" class="wdp-icon-button" data-wdp-recalc data-product-id="' . esc_attr( (string) $product_id ) . '" aria-label="' . esc_attr__( 'Recalculate total', 'woo-donation-popup' ) . '" title="' . esc_attr__( 'Scans paid orders and recalculates the total.', 'woo-donation-popup' ) . '">';
		echo '<span class="dashicons dashicons-update" aria-hidden="true"></span>';
		echo '</button>';
		echo '</div>';
		if ( $unconverted_n > 0 ) {
			echo '<p class="description wdp-pp-note--warning">';
			echo esc_html(
				sprintf(
					/* translators: %d: number of orders */
					_n( '%d order could not be converted', '%d orders could not be converted', $unconverted_n, 'woo-donation-popup' ),
					$unconverted_n
				)
			);
			echo '</p>';
		}
		echo '</div>';
	}

	/**
	 * Current values for every panel control.
	 *
	 * @param WC_Product $product Product.
	 * @return array<string, mixed>
	 */
	private static function get_panel_values( $product ) {
		$meta     = static function ( $key ) use ( $product ) {
			$value = WDP_Addon_Product_Visibility::get_meta( $product, $key );
			return is_scalar( $value ) ? (string) $value : '';
		};
		$flag     = static function ( $key, $default_yes = false ) use ( $meta ) {
			$raw = $meta( $key );
			if ( $raw === '' ) {
				return $default_yes ? 'yes' : 'no';
			}
			return $raw === 'yes' ? 'yes' : 'no';
		};
		$tristate = static function ( $key ) use ( $meta ) {
			$raw = $meta( $key );
			return in_array( $raw, array( 'yes', 'no' ), true ) ? $raw : '';
		};

		$repair = array( 'WDP_Product_Settings_Service', 'repair_unicode_escapes' );

		$trust_rows = array();
		$trust_raw  = $meta( '_trust_badges' );
		if ( $trust_raw !== '' ) {
			foreach ( WDP_Form_Modules::sanitize_trust_badges( $trust_raw ) as $row ) {
				$trust_rows[] = array(
					'icon' => $row['icon'],
					'text' => call_user_func( $repair, $row['text'] ),
				);
			}
		}

		$min_price  = $meta( '_min_custom_price' );
		$max_shares = $meta( '_max_shares' );
		$goal       = $meta( '_progress_bar_limit' );
		$layout     = sanitize_key( $meta( '_layout_mode' ) );

		$auto_place = $meta( '_wdp_auto_place' );
		$has_image  = false;
		if ( method_exists( $product, 'get_image_id' ) ) {
			$has_image = (int) $product->get_image_id() > 0;
		} elseif ( function_exists( 'get_post_thumbnail_id' ) ) {
			$has_image = (int) get_post_thumbnail_id( $product->get_id() ) > 0;
		}

		return array(
			'donation_product'          => WDP_Donation_Scope::product_flag( $product ),
			'auto_place'                => $auto_place === 'no' ? 'no' : '',
			'donation_type'             => WDP_Donation_Type::infer_from_meta(
				array(
					'_allow_custom_price'    => $meta( '_allow_custom_price' ),
					'_allow_multiple_shares' => $meta( '_allow_multiple_shares' ),
					'_enable_progress_bar'   => $meta( '_enable_progress_bar' ),
				)
			),
			'min_custom_price'          => $min_price !== '' ? $min_price : '0',
			'max_shares'                => ( $max_shares !== '' && absint( $max_shares ) > 0 ) ? $max_shares : WDP_Donation_Type::DEFAULT_MAX_SHARES,
			'progress_bar_limit'        => $goal !== '' ? $goal : WDP_Donation_Type::DEFAULT_GOAL,
			'goal_reached_action'       => class_exists( 'WDP_Campaign_Goal' )
				? WDP_Campaign_Goal::sanitize_action( $meta( '_goal_reached_action' ) )
				: 'message',
			'goal_reached_message'      => $meta( '_goal_reached_message' ),
			'enable_amount_presets'     => $flag( '_enable_amount_presets', true ),
			'amount_presets'            => $meta( '_amount_presets' ),
			'amount_preset_recommended' => $meta( '_amount_preset_recommended' ),
			'enable_quantity'           => $flag( '_enable_quantity', true ),
			'enable_cover_fee'          => $flag( '_enable_cover_fee' ),
			'cover_fee_percent'         => $meta( '_cover_fee_percent' ),
			'enable_email'              => $tristate( '_enable_email' ),
			'enable_dedication'         => $tristate( '_enable_dedication' ),
			'dedication_placeholder'    => $meta( '_dedication_placeholder' ),
			'enable_anonymous'          => $tristate( '_enable_anonymous' ),
			'enable_product_note'       => $flag( '_enable_product_note' ),
			'product_note_text'         => $meta( '_product_note_text' ),
			'enable_wizard'             => $tristate( '_enable_wizard' ),
			'enable_field_icons'        => $tristate( '_enable_field_icons' ),
			'enable_impact_line'        => $flag( '_enable_impact_line', true ),
			'impact_line_text'          => $meta( '_impact_line_text' ),
			'enable_urgency'            => $flag( '_enable_urgency' ),
			'urgency_text'              => $meta( '_urgency_text' ),
			'urgency_ends_at'           => $meta( '_urgency_ends_at' ),
			'enable_social_proof'       => $flag( '_enable_social_proof' ),
			'social_proof_text'         => $meta( '_social_proof_text' ),
			'enable_trust_strip'        => $flag( '_enable_trust_strip', true ),
			'trust_rows'                => $trust_rows,
			'module_order_custom'       => $meta( '_wdp_module_order' ) !== '',
			'enable_sadaka_donation'    => $flag( '_enable_addon_donation' ),
			'sadaka_toggle_label'       => $meta( '_addon_toggle_label' ),
			'sadaka_wc_product_id'      => ( $meta( '_addon_wc_product_id' ) !== '' && $meta( '_addon_wc_product_id' ) !== '0' ) ? $meta( '_addon_wc_product_id' ) : '',
			'sadaka_min_price'          => $meta( '_addon_min_price' ) !== '' ? $meta( '_addon_min_price' ) : '0',
			'sadaka_fixed_price'        => ( (float) $meta( '_addon_fixed_price' ) > 0 ) ? $meta( '_addon_fixed_price' ) : '',
			'sadaka_donation_message'   => $meta( '_addon_donation_message' ),
			'layout_mode'               => in_array( $layout, array( 'classic', 'campaign', 'story' ), true ) ? $layout : 'classic',
			'enable_campaign_media'     => $flag( '_enable_campaign_media' ),
			'has_featured_image'        => $has_image ? 'yes' : 'no',
			'theme_primary'             => $meta( '_theme_primary' ),
			'theme_primary_hover'       => $meta( '_theme_primary_hover' ),
			'theme_modal_bg'            => $meta( '_theme_modal_bg' ),
			'theme_radius'              => $meta( '_theme_radius' ),
		);
	}

	/* ---------------------------------------------------------------------
	 * Field helpers (thin wrappers around woocommerce_wp_*)
	 * ------------------------------------------------------------------- */

	/**
	 * @param string $key Field key.
	 * @return string
	 */
	private static function name( $key ) {
		return self::FIELD_NAME . '[' . $key . ']';
	}

	/**
	 * @param string $key Field key.
	 * @return string
	 */
	private static function id( $key ) {
		return 'wdp_' . $key;
	}

	/**
	 * @param string $key         Field key.
	 * @param string $value       Value.
	 * @param string $label       Label.
	 * @param string $description One-sentence help.
	 * @param array  $extra       Extra woocommerce_wp_text_input args.
	 * @return void
	 */
	private static function text( $key, $value, $label, $description, array $extra = array() ) {
		woocommerce_wp_text_input(
			array_merge(
				array(
					'id'          => self::id( $key ),
					'name'        => self::name( $key ),
					'value'       => (string) $value,
					'label'       => $label,
					'description' => $description,
					'desc_tip'    => false,
				),
				$extra
			)
		);
	}

	/**
	 * @param string $key         Field key.
	 * @param string $value       Value.
	 * @param string $label       Label.
	 * @param string $description One-sentence help.
	 * @param array  $attributes  Input attributes.
	 * @return void
	 */
	private static function number( $key, $value, $label, $description, array $attributes = array() ) {
		$placeholder = isset( $attributes['placeholder'] ) ? (string) $attributes['placeholder'] : '';
		unset( $attributes['placeholder'] );

		self::text(
			$key,
			$value,
			$label,
			$description,
			array(
				'type'              => 'number',
				'placeholder'       => $placeholder,
				'custom_attributes' => array_merge(
					array(
						'min'  => '0',
						'step' => 'any',
					),
					$attributes
				),
			)
		);
	}

	/**
	 * @param string $key         Field key.
	 * @param string $value       yes|no.
	 * @param string $label       Label.
	 * @param string $description One-sentence help.
	 * @param array  $extra       Extra args.
	 * @return void
	 */
	private static function checkbox( $key, $value, $label, $description, array $extra = array() ) {
		woocommerce_wp_checkbox(
			array_merge(
				array(
					'id'          => self::id( $key ),
					'name'        => self::name( $key ),
					'value'       => $value === 'yes' ? 'yes' : 'no',
					'cbvalue'     => 'yes',
					'label'       => $label,
					'description' => $description,
					'desc_tip'    => false,
				),
				$extra
			)
		);
	}

	/**
	 * @param string $key         Field key.
	 * @param string $value       Value.
	 * @param string $label       Label.
	 * @param string $description One-sentence help.
	 * @param array  $options     value => label.
	 * @return void
	 */
	private static function select( $key, $value, $label, $description, array $options ) {
		woocommerce_wp_select(
			array(
				'id'          => self::id( $key ),
				'name'        => self::name( $key ),
				'value'       => (string) $value,
				'label'       => $label,
				'options'     => $options,
				'description' => $description,
				'desc_tip'    => false,
			)
		);
	}

	/**
	 * @param string $key         Field key.
	 * @param string $value       Value.
	 * @param string $label       Label.
	 * @param string $description One-sentence help.
	 * @param array  $attributes  Textarea attributes.
	 * @return void
	 */
	private static function textarea( $key, $value, $label, $description, array $attributes = array() ) {
		$placeholder = isset( $attributes['placeholder'] ) ? (string) $attributes['placeholder'] : '';
		unset( $attributes['placeholder'] );

		woocommerce_wp_textarea_input(
			array(
				'id'                => self::id( $key ),
				'name'              => self::name( $key ),
				'value'             => (string) $value,
				'label'             => $label,
				'description'       => $description,
				'desc_tip'          => false,
				'rows'              => 3,
				'placeholder'       => $placeholder,
				'custom_attributes' => $attributes,
			)
		);
	}

	/**
	 * Use global / on / off select options.
	 *
	 * @return array<string, string>
	 */
	private static function tristate_options() {
		return array(
			''    => __( 'Use general setting', 'woo-donation-popup' ),
			'yes' => __( 'On', 'woo-donation-popup' ),
			'no'  => __( 'Off', 'woo-donation-popup' ),
		);
	}

	/**
	 * @param string $id    Section id.
	 * @param string $title Title.
	 * @param string $hint  One-line summary.
	 * @return void
	 */
	private static function open_section( $id, $title, $hint ) {
		echo '<details class="wdp-pp-section" id="wdp-pp-section-' . esc_attr( $id ) . '">';
		echo '<summary class="wdp-pp-section__summary">';
		echo '<span class="wdp-pp-section__title">' . esc_html( $title ) . '</span>';
		echo '<span class="wdp-pp-section__hint">' . esc_html( $hint ) . '</span>';
		echo '</summary>';
		echo '<div class="wdp-pp-section__body options_group">';
	}

	/**
	 * @return void
	 */
	private static function close_section() {
		echo '</div></details>';
	}

	/**
	 * Container visible only for the given types.
	 *
	 * @param string[] $types   Type ids.
	 * @param string   $current Selected type.
	 * @param string   $class   Extra class.
	 * @return void
	 */
	private static function open_type_scope( array $types, $current, $class = '' ) {
		$hidden = in_array( $current, $types, true ) ? '' : ' hidden';
		echo '<div class="wdp-pp-type-scope' . ( $class !== '' ? ' ' . esc_attr( $class ) : '' ) . '" data-wdp-type-scope="' . esc_attr( implode( ' ', $types ) ) . '"' . $hidden . '>';
	}

	/* ---------------------------------------------------------------------
	 * Panel blocks
	 * ------------------------------------------------------------------- */

	/**
	 * Donation product flag + automatic placement override.
	 *
	 * @param WC_Product $product Product.
	 * @param array      $values  Values.
	 * @return void
	 */
	private static function render_scope_block( $product, array $values ) {
		$global_is_donation = WDP_Donation_Scope::matches_global_scope( $product );
		$global_label       = $global_is_donation ? __( 'Donation product', 'woo-donation-popup' ) : __( 'Regular product', 'woo-donation-popup' );
		$auto_place_global  = WDP_Placement_Settings::value( 'auto_place' ) === 'yes' ? __( 'On', 'woo-donation-popup' ) : __( 'Off', 'woo-donation-popup' );

		echo '<div class="wdp-pp-block wdp-pp-scope options_group">';
		self::select(
			'donation_product',
			$values['donation_product'],
			__( 'Donation product', 'woo-donation-popup' ),
			__( 'On donation products the donation form is used instead of the WooCommerce add-to-cart field, and the product appears in donation lists.', 'woo-donation-popup' ),
			array(
				/* translators: %s: what the global setting currently decides */
				''    => sprintf( __( 'General setting (currently: %s)', 'woo-donation-popup' ), $global_label ),
				'yes' => __( 'Donation product', 'woo-donation-popup' ),
				'no'  => __( 'Regular product', 'woo-donation-popup' ),
			)
		);
		self::select(
			'auto_place',
			$values['auto_place'],
			__( 'Automatic placement', 'woo-donation-popup' ),
			__( 'If off, you add the form to the product page yourself with a shortcode, block, or widget only.', 'woo-donation-popup' ),
			array(
				/* translators: %s: On / Off */
				''   => sprintf( __( 'General setting (currently: %s)', 'woo-donation-popup' ), $auto_place_global ),
				'no' => __( 'Off', 'woo-donation-popup' ),
			)
		);
		echo '</div>';
	}

	/**
	 * @param string $current Selected type.
	 * @return void
	 */
	private static function render_type_picker( $current ) {
		echo '<fieldset class="wdp-pp-block wdp-type-picker">';
		echo '<legend class="wdp-pp-heading">' . esc_html__( 'Donation type', 'woo-donation-popup' ) . '</legend>';
		echo '<p class="wdp-pp-lead">' . esc_html__( 'Choose how this product’s donation form works; only the selected type’s settings appear below.', 'woo-donation-popup' ) . '</p>';
		echo '<div class="wdp-type-picker__grid">';
		foreach ( WDP_Donation_Type::get_definitions() as $type => $def ) {
			$input_id = 'wdp_donation_type_' . $type;
			$selected = ( $type === $current );
			echo '<label class="wdp-type-card' . ( $selected ? ' is-selected' : '' ) . '" for="' . esc_attr( $input_id ) . '" data-wdp-type-card>';
			echo '<input type="radio" class="wdp-type-card__input" id="' . esc_attr( $input_id ) . '" name="' . esc_attr( self::name( 'donation_type' ) ) . '" value="' . esc_attr( $type ) . '" aria-describedby="' . esc_attr( $input_id . '_desc' ) . '" data-wdp-type-input' . checked( $selected, true, false ) . ' />';
			echo '<span class="wdp-type-card__icon dashicons ' . esc_attr( $def['icon'] ) . '" aria-hidden="true"></span>';
			echo '<span class="wdp-type-card__text">';
			echo '<span class="wdp-type-card__title">' . esc_html( $def['label'] ) . '</span>';
			echo '<span class="wdp-type-card__desc" id="' . esc_attr( $input_id . '_desc' ) . '">' . esc_html( $def['description'] ) . '</span>';
			echo '</span>';
			echo '</label>';
		}
		echo '</div>';
		echo '</fieldset>';
	}

	/**
	 * Fields that depend on the selected type.
	 *
	 * @param WC_Product $product Product.
	 * @param array      $values  Values.
	 * @return void
	 */
	private static function render_type_fields( $product, array $values ) {
		$type     = $values['donation_type'];
		$currency = get_woocommerce_currency_symbol();

		echo '<div class="wdp-pp-block wdp-pp-type-fields options_group">';

		self::open_type_scope( array( WDP_Donation_Type::FIXED ), $type );
		$price = $product->get_price();
		if ( $price !== '' && (float) $price > 0 ) {
			echo '<p class="wdp-pp-note">';
			/* translators: %s: formatted product price */
			echo esc_html( sprintf( __( 'The donation amount is the product price: %s. You can change the price on the "General" tab.', 'woo-donation-popup' ), WDP_Utils::format_price_plain( $price ) ) );
			echo '</p>';
		} else {
			echo '<p class="wdp-pp-note wdp-pp-note--warning">' . esc_html__( 'This product has no price; enter a regular price on the "General" tab for a fixed amount.', 'woo-donation-popup' ) . '</p>';
		}
		echo '</div>';

		self::open_type_scope( array( WDP_Donation_Type::CAMPAIGN ), $type );
		/* translators: %s: currency symbol */
		self::number(
			'progress_bar_limit',
			$values['progress_bar_limit'],
			sprintf( __( 'Goal amount (%s)', 'woo-donation-popup' ), $currency ),
			__( 'Campaign goal at which the progress bar is 100% (in the store’s main currency). Empty or zero cannot be saved.', 'woo-donation-popup' ),
			array(
				'step' => '1',
				'min'  => '1',
			)
		);
		echo '</div>';

		self::open_type_scope( array( WDP_Donation_Type::CUSTOM, WDP_Donation_Type::CAMPAIGN ), $type );
		echo '<p class="wdp-pp-note">' . esc_html__( 'Set the donation amount on this tab. The WooCommerce General price field is not required for these types and may be left empty; the plugin does not change the General price by itself.', 'woo-donation-popup' ) . '</p>';
		/* translators: %s: currency symbol */
		self::number(
			'min_custom_price',
			$values['min_custom_price'],
			sprintf( __( 'Minimum amount (%s)', 'woo-donation-popup' ), $currency ),
			__( 'The lowest amount the donor can enter. This field is the single source (the WooCommerce General price is for fallback/compatibility; the minimum is not calculated from it).', 'woo-donation-popup' ),
			array( 'step' => '1' )
		);
		echo '</div>';

		self::open_type_scope( array( WDP_Donation_Type::SHARES ), $type );
		self::number(
			'max_shares',
			$values['max_shares'],
			__( 'Maximum shares', 'woo-donation-popup' ),
			__( 'The highest number of shares the donor can select at once (maximum 50).', 'woo-donation-popup' ),
			array(
				'min'  => '1',
				'max'  => '50',
				'step' => '1',
			)
		);
		echo '</div>';

		self::open_type_scope( array( WDP_Donation_Type::CAMPAIGN ), $type );
		echo '<div class="form-field wdp-pp-field">';
		echo '<span class="wdp-pp-field__label">' . esc_html__( 'Raised', 'woo-donation-popup' ) . '</span>';
		echo '<div class="wdp-pp-field__control">';
		self::render_progress_summary( $product->get_id() );
		echo '<span class="description">' . esc_html__( 'Only orders with confirmed payment (processing/completed) are counted; processing fees and on-hold are not included. Amounts are converted to the store’s main currency. The refresh icon recalculates the total from scratch.', 'woo-donation-popup' ) . '</span>';
		echo '</div>';
		echo '</div>';
		self::select(
			'goal_reached_action',
			isset( $values['goal_reached_action'] ) ? $values['goal_reached_action'] : 'message',
			__( 'When the goal is reached', 'woo-donation-popup' ),
			__( 'When the campaign reaches its goal, should donations keep being accepted, or should they be closed?', 'woo-donation-popup' ),
			array(
				'continue' => __( 'Keep accepting donations (no message)', 'woo-donation-popup' ),
				'message'  => __( 'Accept donations + show a thank-you message', 'woo-donation-popup' ),
				'close'    => __( 'Close new donations + show a message', 'woo-donation-popup' ),
			)
		);
		self::textarea(
			'goal_reached_message',
			isset( $values['goal_reached_message'] ) ? $values['goal_reached_message'] : '',
			__( 'Message when the goal is reached', 'woo-donation-popup' ),
			__( 'If left empty, the default thank-you text is used (maximum 300 characters).', 'woo-donation-popup' ),
			array(
				'maxlength'   => '300',
				'placeholder' => class_exists( 'WDP_Campaign_Goal' ) ? WDP_Campaign_Goal::default_message() : '',
			)
		);
		echo '</div>';

		echo '</div>';
	}

	/**
	 * @param array $values Values.
	 * @return void
	 */
	private static function render_amount_section( array $values ) {
		$type = isset( $values['donation_type'] ) ? $values['donation_type'] : WDP_Donation_Type::FIXED;
		self::open_section( 'amount', __( 'Amount options', 'woo-donation-popup' ), __( 'Quick amount buttons, quantity, and processing fee', 'woo-donation-popup' ) );

		// Hızlı tutar düğmeleri yalnız "Bağışçı belirler" ve "Hedefli kampanya" formlarında vardır.
		self::open_type_scope( array( WDP_Donation_Type::CUSTOM, WDP_Donation_Type::CAMPAIGN ), $type );
		self::checkbox( 'enable_amount_presets', $values['enable_amount_presets'], __( 'Quick amount buttons', 'woo-donation-popup' ), __( 'Shows one-click amount buttons above the amount field. If the general setting (Settings → Regular) is off, the buttons stay hidden even if this box is checked.', 'woo-donation-popup' ) );
		self::text( 'amount_presets', $values['amount_presets'], __( 'Amounts', 'woo-donation-popup' ), __( 'Whole numbers only; separate with commas, spaces, or semicolons (maximum 6). If left empty, the amounts from the general setting are used. Buttons below the minimum amount are not shown.', 'woo-donation-popup' ), array( 'placeholder' => '100, 250, 500' ) );
		self::number(
			'amount_preset_recommended',
			isset( $values['amount_preset_recommended'] ) ? $values['amount_preset_recommended'] : '',
			__( 'Suggested amount', 'woo-donation-popup' ),
			__( 'If left empty, no amount shows a Suggested label. If filled, the label appears only on that listed amount; the amount is not pre-selected. A value that is not on the list or is not a whole number blocks saving.', 'woo-donation-popup' ),
			array(
				'min'  => '1',
				'step' => '1',
			)
		);
		echo '</div>';

		// Adet seçici yalnız sabit tutarlı formda vardır.
		self::open_type_scope( array( WDP_Donation_Type::FIXED ), $type );
		self::checkbox( 'enable_quantity', $values['enable_quantity'], __( 'Quantity selector', 'woo-donation-popup' ), __( 'Shows quantity plus/minus buttons on a fixed-amount form. If off, the quantity is always 1.', 'woo-donation-popup' ) );
		echo '</div>';

		// İşlem ücreti tüm bağış tiplerinde geçerlidir.
		self::checkbox( 'enable_cover_fee', $values['enable_cover_fee'], __( 'Cover processing fee', 'woo-donation-popup' ), __( 'Offers the donor the option to also cover the payment processing cost (on all donation types).', 'woo-donation-popup' ) );
		self::number(
			'cover_fee_percent',
			$values['cover_fee_percent'],
			__( 'Processing fee (%)', 'woo-donation-popup' ),
			__( '0 = off; otherwise a percentage between 0.5 and 15. A value outside the range is not saved.', 'woo-donation-popup' ),
			array(
				'min'  => '0',
				'max'  => '15',
				'step' => '0.1',
			)
		);
		self::close_section();
	}

	/**
	 * @param array $values Values.
	 * @return void
	 */
	private static function render_form_fields_section( array $values ) {
		$type = isset( $values['donation_type'] ) ? $values['donation_type'] : WDP_Donation_Type::FIXED;
		self::open_section( 'fields', __( 'Form fields', 'woo-donation-popup' ), __( 'Email, dedication, anonymous donation, and note', 'woo-donation-popup' ) );

		// F1: e-posta / ithaf / anonim hisseli tipte formda yok → ürün sekmesinde de gizle.
		self::open_type_scope(
			array( WDP_Donation_Type::FIXED, WDP_Donation_Type::CUSTOM, WDP_Donation_Type::CAMPAIGN ),
			$type
		);
		self::select( 'enable_email', $values['enable_email'], __( 'Email field', 'woo-donation-popup' ), __( 'Asks the donor for an email address; "Use general setting" applies the choice on the Design tab.', 'woo-donation-popup' ), self::tristate_options() );
		self::select( 'enable_dedication', $values['enable_dedication'], __( 'Dedication field', 'woo-donation-popup' ), __( 'Shows a field to write who the donation is on behalf of.', 'woo-donation-popup' ), self::tristate_options() );
		self::text( 'dedication_placeholder', $values['dedication_placeholder'], __( 'Dedication placeholder', 'woo-donation-popup' ), __( 'Sample text shown inside the dedication field when it is empty.', 'woo-donation-popup' ), array( 'custom_attributes' => array( 'maxlength' => '120' ) ) );
		self::select( 'enable_anonymous', $values['enable_anonymous'], __( 'Anonymous donation', 'woo-donation-popup' ), __( 'If checked, the donor name is hidden on public lists; it remains visible on order records.', 'woo-donation-popup' ), self::tristate_options() );
		echo '</div>';

		self::checkbox( 'enable_product_note', $values['enable_product_note'], __( 'Product note', 'woo-donation-popup' ), __( 'This is not a note written by the donor; it is an info text shown at the top of the form.', 'woo-donation-popup' ) );
		self::textarea(
			'product_note_text',
			$values['product_note_text'],
			__( 'Note text', 'woo-donation-popup' ),
			__( 'Short info shown to the donor (maximum 400 characters).', 'woo-donation-popup' ),
			array(
				'maxlength'   => '400',
				'placeholder' => __( 'E.g.: A video is delivered within 24 hours.', 'woo-donation-popup' ),
			)
		);
		self::select( 'enable_wizard', $values['enable_wizard'], __( 'Multi-step form', 'woo-donation-popup' ), __( 'Shows the form step by step as donor info and amount. "Use general setting" applies the choice on the Regular tab.', 'woo-donation-popup' ), self::tristate_options() );
		self::select( 'enable_field_icons', $values['enable_field_icons'], __( 'Field icons', 'woo-donation-popup' ), __( 'Icons on the name, note, and email rows. "Use general setting" applies the choice on the Design tab.', 'woo-donation-popup' ), self::tristate_options() );
		self::close_section();
	}

	/**
	 * @param int   $product_id Product ID.
	 * @param array $values     Values.
	 * @return void
	 */
	private static function render_campaign_blocks_section( $product_id, array $values ) {
		self::open_section( 'campaign', __( 'Campaign blocks', 'woo-donation-popup' ), __( 'Impact line, urgency, social proof, trust badges, and order', 'woo-donation-popup' ) );

		self::checkbox( 'enable_impact_line', $values['enable_impact_line'], __( 'Impact line', 'woo-donation-popup' ), __( 'Shows a short sentence under the title that describes the donation’s impact.', 'woo-donation-popup' ) );
		self::text(
			'impact_line_text',
			$values['impact_line_text'],
			__( 'Impact text', 'woo-donation-popup' ),
			__( 'If left empty, the line is hidden.', 'woo-donation-popup' ),
			array(
				'placeholder'       => __( 'E.g.: Your donation warms a family.', 'woo-donation-popup' ),
				'custom_attributes' => array( 'maxlength' => '160' ),
			)
		);
		if ( $values['enable_impact_line'] === 'yes' && trim( (string) $values['impact_line_text'] ) === '' ) {
			echo '<p class="description wdp-pp-note--warning">' . esc_html__( 'Impact line is on but the text is empty; the line will not appear on the form.', 'woo-donation-popup' ) . '</p>';
		}

		self::checkbox( 'enable_urgency', $values['enable_urgency'], __( 'Urgency strip', 'woo-donation-popup' ), __( 'Shows a strip that highlights that the campaign is time-limited. The end date only removes the strip; it does not close the campaign.', 'woo-donation-popup' ) );
		self::text( 'urgency_text', $values['urgency_text'], __( 'Urgency text', 'woo-donation-popup' ), __( 'Text that will appear on the strip.', 'woo-donation-popup' ), array( 'custom_attributes' => array( 'maxlength' => '140' ) ) );
		self::text(
			'urgency_ends_at',
			$values['urgency_ends_at'],
			__( 'End date', 'woo-donation-popup' ),
			__( 'The strip is shown until the end of this day (23:59:59) in the site time zone (Y-m-d). An invalid date is not saved.', 'woo-donation-popup' ),
			array(
				'type'              => 'date',
				'placeholder'       => 'YYYY-MM-DD',
				'custom_attributes' => array( 'pattern' => '\d{4}-\d{2}-\d{2}' ),
			)
		);
		if ( $values['urgency_ends_at'] !== '' ) {
			$ends_check = WDP_Product_Settings_Service::validate_urgency_ends_at( $values['urgency_ends_at'] );
			if ( empty( $ends_check['ok'] ) ) {
				echo '<p class="description wdp-pp-note--warning">' . esc_html__( 'The saved end date is invalid; the strip appears with no time limit. Enter a valid Y-m-d.', 'woo-donation-popup' ) . '</p>';
			}
		}

		self::checkbox( 'enable_social_proof', $values['enable_social_proof'], __( 'Social proof', 'woo-donation-popup' ), __( 'Shows a line with the real donor count. If the number is 0, the line is hidden.', 'woo-donation-popup' ) );
		self::text(
			'social_proof_text',
			$values['social_proof_text'],
			__( 'Social proof text', 'woo-donation-popup' ),
			__( 'The {donors} placeholder in the text is replaced with the real donor count. If left empty, the default is: “{donors} people donated”.', 'woo-donation-popup' ),
			array( 'placeholder' => __( '{donors} people donated', 'woo-donation-popup' ) )
		);
		$legacy_social = (string) $values['social_proof_text'];
		if ( $legacy_social !== '' && strpos( $legacy_social, '{donors}' ) === false ) {
			echo '<p class="description wdp-pp-note">' . esc_html(
				sprintf(
					/* translators: %s: old free-text */
					__( 'Old text: %s — no longer used; the real number is used.', 'woo-donation-popup' ),
					$legacy_social
				)
			) . '</p>';
		}

		self::checkbox( 'enable_trust_strip', $values['enable_trust_strip'], __( 'Trust badges', 'woo-donation-popup' ), __( 'Shows trust messages under the form. If the general setting is off, they are not shown even if this product is on.', 'woo-donation-popup' ) );
		self::render_repeater(
			'trust_badges',
			__( 'Badges', 'woo-donation-popup' ),
			/* translators: %d: max rows */
			sprintf( __( 'If the product list is filled, it replaces the general list (maximum %d). If left empty, the general badges are used.', 'woo-donation-popup' ), self::MAX_TRUST_ROWS ),
			$values['trust_rows'],
			self::MAX_TRUST_ROWS,
			array(
				'icon' => array(
					'label' => __( 'Icon', 'woo-donation-popup' ),
					'type'  => 'icon',
				),
				'text' => array(
					'label' => __( 'Text', 'woo-donation-popup' ),
					'type'  => 'text',
				),
			)
		);

		self::render_module_order( $product_id, $values['module_order_custom'] );

		self::close_section();
	}

	/**
	 * @param array $values Values.
	 * @return void
	 */
	private static function render_addon_section( array $values, $parent_product_id = 0 ) {
		$default_wc_id = WDP_Utils::get_default_addon_wc_product_id();
		$default_label = class_exists( 'WDP_Templates' ) ? WDP_Templates::get_default_addon_donation_message() : '';
		$currency      = get_woocommerce_currency_symbol();

		self::open_section( 'sadaka', __( 'Extra donation (sadaqah)', 'woo-donation-popup' ), __( 'A second, smaller donation row added to the form', 'woo-donation-popup' ) );
		self::open_type_scope( array( WDP_Donation_Type::CAMPAIGN ), $values['donation_type'] );
		echo '<p class="wdp-pp-note">' . esc_html__( 'On a goal campaign the extra donation is not shown on the form; the settings are used if you switch to other types.', 'woo-donation-popup' ) . '</p>';
		echo '</div>';
		self::checkbox( 'enable_sadaka_donation', $values['enable_sadaka_donation'], __( 'Add an extra donation', 'woo-donation-popup' ), __( 'Lets the donor add a small extra donation on top of the main donation.', 'woo-donation-popup' ) );
		self::text(
			'sadaka_toggle_label',
			$values['sadaka_toggle_label'],
			_x( 'Button text', 'product data tab', 'woo-donation-popup' ),
			__( 'Text of the button that opens the extra donation.', 'woo-donation-popup' ),
			array(
				'placeholder'       => __( 'Add extra donation', 'woo-donation-popup' ),
				'custom_attributes' => array( 'maxlength' => '80' ),
			)
		);
		$addon_wc_value    = ( $values['sadaka_wc_product_id'] !== '' && $values['sadaka_wc_product_id'] !== '0' )
			? absint( $values['sadaka_wc_product_id'] )
			: 0;
		$addon_field_error = '';
		if ( $addon_wc_value > 0 && class_exists( 'WDP_Addon_Product_Visibility' ) ) {
			$check = \WDP_Addon_Product_Visibility::validate_addon_product_id( $addon_wc_value, (int) $parent_product_id );
			if ( empty( $check['ok'] ) ) {
				$addon_field_error = (string) $check['error'];
			}
		}
		if ( class_exists( 'WDP_Addon_Product_Visibility' ) ) {
			\WDP_Addon_Product_Visibility::render_product_search_field(
				array(
					'id'          => self::id( 'sadaka_wc_product_id' ),
					'name'        => self::name( 'sadaka_wc_product_id' ),
					'value'       => $addon_wc_value,
					'label'       => __( 'Extra donation product', 'woo-donation-popup' ),
					'description' => $default_wc_id
						? sprintf(
							/* translators: %d: default product ID */
							__( 'WooCommerce product to add to the cart; if empty, the general default (#%d) is used.', 'woo-donation-popup' ),
							$default_wc_id
						)
						: __( 'WooCommerce product to add to the cart; if empty, the general default is used, and if that is also missing the row is not added.', 'woo-donation-popup' ),
					'error'       => $addon_field_error,
				)
			);
		} else {
			self::number(
				'sadaka_wc_product_id',
				$values['sadaka_wc_product_id'],
				__( 'Extra donation product ID', 'woo-donation-popup' ),
				__( 'WooCommerce product to add to the cart; if empty, the general default is used, and if that is also missing the row is not added.', 'woo-donation-popup' ),
				array(
					'min'         => '1',
					'step'        => '1',
					'placeholder' => $default_wc_id ? (string) $default_wc_id : '',
				)
			);
		}
		/* translators: %s: currency symbol */
		self::number( 'sadaka_min_price', $values['sadaka_min_price'], sprintf( __( 'Minimum amount (%s)', 'woo-donation-popup' ), $currency ), __( 'Lower limit applied when the donor types the amount themselves.', 'woo-donation-popup' ), array( 'step' => '1' ) );
		/* translators: %s: currency symbol */
		self::number(
			'sadaka_fixed_price',
			$values['sadaka_fixed_price'],
			sprintf( __( 'Fixed amount (%s)', 'woo-donation-popup' ), $currency ),
			__( 'If filled, the extra donation is added at this amount and the minimum amount is ignored.', 'woo-donation-popup' ),
			array(
				'step'        => '1',
				'placeholder' => '0',
			)
		);
		self::textarea(
			'sadaka_donation_message',
			$values['sadaka_donation_message'],
			__( 'Extra donation note', 'woo-donation-popup' ),
			__( 'Description shown next to the extra donation row.', 'woo-donation-popup' ),
			array(
				'maxlength'   => '300',
				'placeholder' => $default_label,
			)
		);
		self::close_section();
	}

	/**
	 * @param array $values Values.
	 * @return void
	 */
	private static function render_appearance_section( array $values ) {
		self::open_section( 'appearance', __( 'Appearance for this product', 'woo-donation-popup' ), __( 'Layout, colors, corner radius, and media', 'woo-donation-popup' ) );
		self::select(
			'layout_mode',
			$values['layout_mode'],
			__( 'Layout', 'woo-donation-popup' ),
			__( 'Overall form layout; "Story" shows the image and form side by side. Cannot be left empty; default is Classic (there is no general layout setting).', 'woo-donation-popup' ),
			array(
				'classic'  => __( 'Classic', 'woo-donation-popup' ),
				'campaign' => __( 'Campaign', 'woo-donation-popup' ),
				'story'    => __( 'Story (side by side)', 'woo-donation-popup' ),
			)
		);
		self::checkbox( 'enable_campaign_media', $values['enable_campaign_media'], __( 'Show product image', 'woo-donation-popup' ), __( 'Uses the product’s featured image as the campaign image at the top of the form.', 'woo-donation-popup' ) );
		if ( $values['enable_campaign_media'] === 'yes' && empty( $values['has_featured_image'] ) ) {
			echo '<p class="form-field wdp-pp-field wdp-pp-media-warning" style="margin-top:-8px"><span class="description" style="color:#b32d2e">'
				. esc_html__( 'This product has no featured image; the image cannot be shown.', 'woo-donation-popup' )
				. '</span></p>';
		}
		$color_extra = array(
			'class'             => 'short wdp-color-field',
			'custom_attributes' => array(
				'maxlength' => '7',
				'pattern'   => '#?[0-9A-Fa-f]{3,6}',
			),
		);
		self::text(
			'theme_primary',
			$values['theme_primary'],
			__( 'Primary color', 'woo-donation-popup' ),
			__( 'Button and accent color. If left empty, the category color is used, and if that is also missing the general color is used.', 'woo-donation-popup' ),
			$color_extra + array( 'placeholder' => '#036a37' )
		);
		self::text( 'theme_primary_hover', $values['theme_primary_hover'], __( 'Primary color (hover)', 'woo-donation-popup' ), __( 'Color used when the mouse is over the button; if empty, it is derived from the primary color.', 'woo-donation-popup' ), $color_extra + array( 'placeholder' => '#025a2e' ) );
		self::text( 'theme_modal_bg', $values['theme_modal_bg'], __( 'Background color', 'woo-donation-popup' ), __( 'Background of the form window; if empty, the general setting is used.', 'woo-donation-popup' ), $color_extra + array( 'placeholder' => '#ffffff' ) );
		$r_min = class_exists( 'WDP_Form_Modules' ) ? (string) WDP_Form_Modules::PRODUCT_THEME_RADIUS_MIN : '4';
		$r_max = class_exists( 'WDP_Form_Modules' ) ? (string) WDP_Form_Modules::PRODUCT_THEME_RADIUS_MAX : '32';
		self::number(
			'theme_radius',
			$values['theme_radius'],
			__( 'Corner radius (px)', 'woo-donation-popup' ),
			sprintf(
				/* translators: 1: min px, 2: max px */
				__( 'For button and field corners, %1$s–%2$s px; if empty, the general setting is used.', 'woo-donation-popup' ),
				$r_min,
				$r_max
			),
			array(
				'min'  => $r_min,
				'max'  => $r_max,
				'step' => '1',
			)
		);
		self::close_section();
	}

	/**
	 * Add/remove row editor; posts `wdp_donation[$key][i][col]` (format kept by WDP_Form_Modules).
	 *
	 * @param string $key         Field key.
	 * @param string $label       Label.
	 * @param string $description Help text.
	 * @param array  $rows        Current rows.
	 * @param int    $max         Max rows.
	 * @param array  $columns     col => {label, type: text|textarea|icon}.
	 * @return void
	 */
	private static function render_repeater( $key, $label, $description, array $rows, $max, array $columns ) {
		$desc_id = self::id( $key ) . '_desc';

		echo '<div class="form-field wdp-pp-field wdp-pp-field--wide">';
		echo '<span class="wdp-pp-field__label" id="' . esc_attr( self::id( $key ) . '_label' ) . '">' . esc_html( $label ) . '</span>';
		echo '<div class="wdp-pp-field__control wdp-repeater" data-wdp-repeater data-max="' . esc_attr( (string) $max ) . '" data-next-index="' . esc_attr( (string) count( $rows ) ) . '" role="group" aria-labelledby="' . esc_attr( self::id( $key ) . '_label' ) . '" aria-describedby="' . esc_attr( $desc_id ) . '">';
		echo '<ol class="wdp-repeater__rows" data-wdp-repeater-rows>';
		foreach ( array_values( $rows ) as $index => $row ) {
			self::render_repeater_row( $key, (string) $index, $row, $columns );
		}
		echo '</ol>';
		echo '<template data-wdp-repeater-template>';
		self::render_repeater_row( $key, '__INDEX__', array(), $columns );
		echo '</template>';
		echo '<button type="button" class="button wdp-repeater__add" data-wdp-repeater-add' . ( count( $rows ) >= $max ? ' disabled' : '' ) . '>';
		echo '<span class="dashicons dashicons-plus-alt2" aria-hidden="true"></span> ' . esc_html__( 'Add row', 'woo-donation-popup' );
		echo '</button>';
		echo '<span class="description" id="' . esc_attr( $desc_id ) . '">' . esc_html( $description ) . '</span>';
		echo '</div>';
		echo '</div>';
	}

	/**
	 * @param string $key     Field key.
	 * @param string $index   Row index or __INDEX__.
	 * @param array  $row     Row values.
	 * @param array  $columns Columns.
	 * @return void
	 */
	private static function render_repeater_row( $key, $index, array $row, array $columns ) {
		echo '<li class="wdp-repeater__row" data-wdp-repeater-row>';
		echo '<div class="wdp-repeater__cells">';
		foreach ( $columns as $col => $def ) {
			$input_id = self::id( $key ) . '_' . $index . '_' . $col;
			$name     = self::FIELD_NAME . '[' . $key . '][' . $index . '][' . $col . ']';
			$value    = isset( $row[ $col ] ) ? (string) $row[ $col ] : '';

			echo '<div class="wdp-repeater__cell wdp-repeater__cell--' . esc_attr( $def['type'] ) . '">';
			echo '<label class="wdp-repeater__label" for="' . esc_attr( $input_id ) . '">' . esc_html( $def['label'] ) . '</label>';
			if ( $def['type'] === 'textarea' ) {
				echo '<textarea id="' . esc_attr( $input_id ) . '" name="' . esc_attr( $name ) . '" rows="2">' . esc_textarea( $value ) . '</textarea>';
			} elseif ( $def['type'] === 'icon' ) {
				self::render_icon_select( $input_id, $name, $value );
			} else {
				echo '<input type="text" id="' . esc_attr( $input_id ) . '" name="' . esc_attr( $name ) . '" value="' . esc_attr( $value ) . '" />';
			}
			echo '</div>';
		}
		echo '</div>';
		echo '<button type="button" class="wdp-icon-button wdp-repeater__remove" data-wdp-repeater-remove aria-label="' . esc_attr__( 'Delete row', 'woo-donation-popup' ) . '" title="' . esc_attr__( 'Delete row', 'woo-donation-popup' ) . '">';
		echo '<span class="dashicons dashicons-trash" aria-hidden="true"></span>';
		echo '</button>';
		echo '</li>';
	}

	/**
	 * Built-in icon select (keeps an existing attachment icon as an option).
	 *
	 * @param string $id    Input id.
	 * @param string $name  Input name.
	 * @param string $value Current value.
	 * @return void
	 */
	private static function render_icon_select( $id, $name, $value ) {
		$value = $value !== '' ? $value : 'builtin:shield';
		echo '<select id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '">';
		if ( strpos( $value, 'attachment:' ) === 0 ) {
			/* translators: %d: attachment ID */
			echo '<option value="' . esc_attr( $value ) . '" selected>' . esc_html( sprintf( __( 'Uploaded image (#%d)', 'woo-donation-popup' ), absint( substr( $value, 11 ) ) ) ) . '</option>';
		}
		foreach ( WDP_Icon_Library::get_builtins_for_admin() as $icon ) {
			$icon_value = 'builtin:' . $icon['id'];
			echo '<option value="' . esc_attr( $icon_value ) . '"' . selected( $value, $icon_value, false ) . '>' . esc_html( $icon['label'] ) . '</option>';
		}
		echo '</select>';
	}

	/**
	 * Keyboard-friendly (up/down buttons) header block order.
	 *
	 * @param int  $product_id Product ID.
	 * @param bool $is_custom  Product has its own order.
	 * @return void
	 */
	private static function render_module_order( $product_id, $is_custom ) {
		$defaults = WDP_Form_Modules::defaults();
		$labels   = isset( $defaults['labels'] ) && is_array( $defaults['labels'] ) ? $defaults['labels'] : array();
		$order    = array_values( array_intersect( WDP_Form_Modules::resolve_order( $product_id ), self::HEADER_MODULES ) );

		echo '<div class="form-field wdp-pp-field wdp-pp-field--wide">';
		echo '<span class="wdp-pp-field__label">' . esc_html__( 'Block order', 'woo-donation-popup' ) . '</span>';
		echo '<div class="wdp-pp-field__control">';
		echo '<label class="wdp-pp-inline-check"><input type="checkbox" name="' . esc_attr( self::name( 'module_order_custom' ) ) . '" value="yes" data-wdp-order-toggle' . checked( $is_custom, true, false ) . ' /> ' . esc_html__( 'Use a custom order for this product', 'woo-donation-popup' ) . '</label>';
		echo '<fieldset class="wdp-order" data-wdp-order' . ( $is_custom ? '' : ' disabled' ) . '>';
		echo '<legend class="screen-reader-text">' . esc_html__( 'Order of campaign blocks', 'woo-donation-popup' ) . '</legend>';
		echo '<ol class="wdp-order__list" data-wdp-order-list>';
		foreach ( $order as $module_id ) {
			$label = isset( $labels[ $module_id ] ) ? $labels[ $module_id ] : $module_id;
			echo '<li class="wdp-order__item" data-wdp-order-item>';
			echo '<span class="wdp-order__label">' . esc_html( $label ) . '</span>';
			echo '<input type="hidden" name="' . esc_attr( self::FIELD_NAME . '[module_order][]' ) . '" value="' . esc_attr( $module_id ) . '" />';
			/* translators: %s: block name */
			echo '<button type="button" class="wdp-icon-button" data-wdp-order-move="up" aria-label="' . esc_attr( sprintf( __( 'Move the %s block up', 'woo-donation-popup' ), $label ) ) . '"><span class="dashicons dashicons-arrow-up-alt2" aria-hidden="true"></span></button>';
			/* translators: %s: block name */
			echo '<button type="button" class="wdp-icon-button" data-wdp-order-move="down" aria-label="' . esc_attr( sprintf( __( 'Move the %s block down', 'woo-donation-popup' ), $label ) ) . '"><span class="dashicons dashicons-arrow-down-alt2" aria-hidden="true"></span></button>';
			echo '</li>';
		}
		echo '</ol>';
		echo '</fieldset>';
		echo '<span class="description">' . esc_html__( 'Order of the blocks under the heading; if off, the general order on the Design tab is used. The order of donor and amount fields is fixed.', 'woo-donation-popup' ) . '</span>';
		echo '</div>';
		echo '</div>';
	}

	/**
	 * Shortcode picker + copy.
	 *
	 * @param int $product_id Product ID.
	 * @return void
	 */
	private static function render_shortcode_block( $product_id ) {
		$shortcodes = self::get_shortcodes( $product_id );

		echo '<div class="wdp-pp-block wdp-pp-shortcode">';
		echo '<p class="wdp-pp-heading">' . esc_html__( 'Shortcode', 'woo-donation-popup' ) . '</p>';
		echo '<p class="wdp-pp-lead">' . esc_html__( 'Choose a view, copy the shortcode, and paste it into a page or post.', 'woo-donation-popup' ) . '</p>';
		echo '<div class="wdp-pp-shortcode__row">';
		echo '<label class="wdp-pp-shortcode__label" for="wdp-shortcode-view">' . esc_html_x( 'View', 'section title', 'woo-donation-popup' ) . '</label>';
		echo '<select id="wdp-shortcode-view" data-wdp-shortcode-select aria-controls="wdp-shortcode-output">';
		foreach ( $shortcodes as $shortcode ) {
			echo '<option value="' . esc_attr( $shortcode['code'] ) . '">' . esc_html( $shortcode['label'] ) . '</option>';
		}
		echo '</select>';
		echo '<input type="text" id="wdp-shortcode-output" class="code wdp-pp-shortcode__code" value="' . esc_attr( $shortcodes[0]['code'] ) . '" readonly aria-label="' . esc_attr__( 'Shortcode', 'woo-donation-popup' ) . '" data-wdp-shortcode-output />';
		echo '<button type="button" class="button" data-wdp-copy-target="#wdp-shortcode-output">' . esc_html__( 'Copy', 'woo-donation-popup' ) . '</button>';
		echo '</div>';
		echo '</div>';
	}

	/**
	 * @param int $product_id Product ID.
	 * @return array<int, array{label:string, code:string}>
	 */
	public static function get_shortcodes( $product_id ) {
		$product_id = absint( $product_id );
		$id_attr    = esc_attr( (string) $product_id );
		return array(
			array(
				'label' => __( 'Button (opens in the center)', 'woo-donation-popup' ),
				'code'  => '[wdp_donation_button id="' . $id_attr . '"]',
			),
			array(
				'label' => __( 'Side panel', 'woo-donation-popup' ),
				'code'  => '[wdp_donation_button_panel id="' . $id_attr . '"]',
			),
			array(
				'label' => __( 'Inline form', 'woo-donation-popup' ),
				'code'  => '[wdp_donation_form id="' . $id_attr . '"]',
			),
		);
	}
}

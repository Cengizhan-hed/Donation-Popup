<?php
/**
 * WooCommerce ürün düzenleme ekranındaki "Donation" sekmesi (WooCommerce standart ürün veri sekmesi API'si).
 *
 * Yalnız yeni deneyimin okuduğu ürün ayarları gösterilir; meta anahtarları değişmez (sözleşme). Hesaplanan toplam,
 * elle eklenen tutar ve devreden tutar burada yalnız GÖSTERİLİR; düzenleme ve yeniden hesaplama Kampanyalar sayfasındadır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin\Product;

use DonationPanel\Domain\Addon_Product_Visibility;
use DonationPanel\Domain\Addon_Settings;
use DonationPanel\Domain\Campaign_Goal;
use DonationPanel\Domain\Campaign_Totals;
use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Domain\Donation_Type;
use DonationPanel\Domain\Placement_Settings;
use DonationPanel\Modules\EntryPoints\Donations_List;
use DonationPanel\Support\Price;
use DonationPanel\WooCommerce\Direct\Direct_Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Product_Data_Tab.
 */
final class Product_Data_Tab {

	const TAB_KEY      = 'wdp_donation';
	const PANEL_ID     = 'wdp_donation_product_data';
	const FIELD_NAME   = 'wdp_donation';
	const NONCE_ACTION = 'wdp_save_product_donation';
	const NONCE_FIELD  = 'wdp_product_donation_nonce';
	const CAPABILITY   = 'manage_woocommerce';
	const META_CARRIED = '_wdp_carried_amount';

	/**
	 * WooCommerce kancalarını bağlar.
	 *
	 * @return void
	 */
	public static function register() {
		add_filter( 'woocommerce_product_data_tabs', array( __CLASS__, 'add_tab' ) );
		add_action( 'woocommerce_product_data_panels', array( __CLASS__, 'render_panel' ) );
		add_action( 'woocommerce_admin_process_product_object', array( __CLASS__, 'save' ) );
	}

	/**
	 * Sekmeyi açan düzenleme adresi.
	 *
	 * @param int $product_id Ürün.
	 * @return string
	 */
	public static function get_edit_url( $product_id ) {
		return admin_url( 'post.php?post=' . absint( $product_id ) . '&action=edit' ) . '#' . self::TAB_KEY;
	}

	/**
	 * Ürün veri sekmesini ekler (yalnız bağış formunun desteklediği ürün türlerinde görünür).
	 *
	 * @param array<string, mixed> $tabs Sekmeler.
	 * @return array<string, mixed>
	 */
	public static function add_tab( $tabs ) {
		$tabs = is_array( $tabs ) ? $tabs : array();
		if ( ! current_user_can( self::CAPABILITY ) ) {
			return $tabs;
		}
		$classes = array();
		foreach ( Donation_Scope::supported_types() as $type ) {
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
	 * Ürün kaydedilirken sekme alanlarını yazar (nonce + yetki + alan alan doğrulama).
	 *
	 * @param \WC_Product $product Kaydedilen ürün.
	 * @return void
	 */
	public static function save( $product ) {
		if ( ! $product instanceof \WC_Product ) {
			return;
		}
		$nonce = isset( $_POST[ self::NONCE_FIELD ] ) ? sanitize_text_field( wp_unslash( $_POST[ self::NONCE_FIELD ] ) ) : '';
		if ( '' === $nonce || ! wp_verify_nonce( $nonce, self::NONCE_ACTION ) ) {
			return;
		}
		if ( ! current_user_can( self::CAPABILITY ) || ! current_user_can( 'edit_post', $product->get_id() ) ) {
			return;
		}

		// Her alan Product_Settings::normalize() içinde temizlenir ve doğrulanır.
		$posted = ( isset( $_POST[ self::FIELD_NAME ] ) && is_array( $_POST[ self::FIELD_NAME ] ) ) ? wp_unslash( $_POST[ self::FIELD_NAME ] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized

		$existing = array();
		foreach ( Product_Settings::VALIDATED_META_KEYS as $meta_key ) {
			$existing[ $meta_key ] = $product->get_meta( $meta_key, true );
		}
		$result = Product_Settings::normalize( $posted, $existing, $product->get_id() );

		foreach ( $result['meta'] as $meta_key => $meta_value ) {
			$product->update_meta_data( $meta_key, $meta_value );
		}
		foreach ( $result['notices'] as $message ) {
			\WC_Admin_Meta_Boxes::add_error( $message );
		}
		Donation_Scope::flush( $product->get_id() );
		Donations_List::on_product_settings_save();
	}

	/**
	 * Paneli çizer.
	 *
	 * @return void
	 */
	public static function render_panel() {
		global $post, $product_object;

		if ( ! current_user_can( self::CAPABILITY ) ) {
			return;
		}
		$product = ( $product_object instanceof \WC_Product ) ? $product_object : ( isset( $post->ID ) ? wc_get_product( $post->ID ) : false );
		if ( ! $product ) {
			return;
		}
		$values = self::values( $product );

		echo '<div id="' . esc_attr( self::PANEL_ID ) . '" class="panel woocommerce_options_panel hidden donation-panel-ptab" data-wdp-product-panel data-wdp-supported-types="' . esc_attr( implode( ' ', Donation_Scope::supported_types() ) ) . '">';
		wp_nonce_field( self::NONCE_ACTION, self::NONCE_FIELD );

		self::render_scope( $product, $values );
		self::render_type_picker( $values['donation_type'] );
		self::render_type_fields( $product, $values );

		echo '<div class="donation-panel-ptab__sections">';
		self::render_amount_section( $values );
		self::render_fields_section( $values );
		self::render_addon_section( $values, $product->get_id() );
		echo '</div>';

		self::render_shortcodes( $product->get_id() );
		echo '<p class="screen-reader-text" data-wdp-products-status role="status" aria-live="polite"></p>';
		echo '</div>';
	}

	/**
	 * Her denetimin geçerli değeri.
	 *
	 * @param \WC_Product $product Ürün.
	 * @return array<string, string>
	 */
	private static function values( $product ) {
		$meta     = static function ( $key ) use ( $product ) {
			$value = Addon_Product_Visibility::get_meta( $product, $key );
			return is_scalar( $value ) ? (string) $value : '';
		};
		$flag     = static function ( $key, $default_yes = false ) use ( $meta ) {
			$raw = $meta( $key );
			if ( '' === $raw ) {
				return $default_yes ? 'yes' : 'no';
			}
			return 'yes' === $raw ? 'yes' : 'no';
		};
		$tristate = static function ( $key ) use ( $meta ) {
			$raw = $meta( $key );
			return in_array( $raw, array( 'yes', 'no' ), true ) ? $raw : '';
		};

		$min        = $meta( '_min_custom_price' );
		$max_shares = $meta( '_max_shares' );
		$goal       = $meta( '_progress_bar_limit' );
		$addon_id   = $meta( '_addon_wc_product_id' );
		$addon_fix  = $meta( '_addon_fixed_price' );

		return array(
			'donation_product'          => Donation_Scope::product_flag( $product ),
			'auto_place'                => 'no' === $meta( '_wdp_auto_place' ) ? 'no' : '',
			'direct'                    => $tristate( '_donation_panel_direct' ),
			'donation_type'             => Donation_Type::infer_from_meta(
				array(
					'_allow_custom_price'    => $meta( '_allow_custom_price' ),
					'_allow_multiple_shares' => $meta( '_allow_multiple_shares' ),
					'_enable_progress_bar'   => $meta( '_enable_progress_bar' ),
				)
			),
			'min_custom_price'          => '' !== $min ? $min : '0',
			'max_shares'                => ( '' !== $max_shares && absint( $max_shares ) > 0 ) ? $max_shares : Donation_Type::DEFAULT_MAX_SHARES,
			'progress_bar_limit'        => '' !== $goal ? $goal : Donation_Type::DEFAULT_GOAL,
			'goal_reached_action'       => Campaign_Goal::sanitize_action( $meta( '_goal_reached_action' ) ),
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
			'enable_addon_donation'     => $flag( '_enable_addon_donation' ),
			'addon_toggle_label'        => $meta( '_addon_toggle_label' ),
			'addon_wc_product_id'       => ( '' !== $addon_id && '0' !== $addon_id ) ? $addon_id : '',
			'addon_min_price'           => '' !== $meta( '_addon_min_price' ) ? $meta( '_addon_min_price' ) : '0',
			'addon_fixed_price'         => ( (float) $addon_fix > 0 ) ? $addon_fix : '',
			'addon_donation_message'    => $meta( '_addon_donation_message' ),
		);
	}

	/* ---------------------------------------------------------------------
	 * Alan yardımcıları (woocommerce_wp_* sarmalayıcıları)
	 * ------------------------------------------------------------------- */

	/**
	 * Alan adı.
	 *
	 * @param string $key Alan.
	 * @return string
	 */
	private static function name( $key ) {
		return self::FIELD_NAME . '[' . $key . ']';
	}

	/**
	 * Alan kimliği.
	 *
	 * @param string $key Alan.
	 * @return string
	 */
	private static function id( $key ) {
		return 'wdp_' . $key;
	}

	/**
	 * Metin alanı.
	 *
	 * @param string               $key         Alan.
	 * @param string               $value       Değer.
	 * @param string               $label       Etiket.
	 * @param string               $description Tek cümlelik açıklama.
	 * @param array<string, mixed> $extra       Ek bağımsız değişkenler.
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
	 * Sayı alanı.
	 *
	 * @param string               $key         Alan.
	 * @param string               $value       Değer.
	 * @param string               $label       Etiket.
	 * @param string               $description Açıklama.
	 * @param array<string, mixed> $attributes  Giriş öznitelikleri.
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
	 * Onay kutusu.
	 *
	 * @param string $key         Alan.
	 * @param string $value       yes|no.
	 * @param string $label       Etiket.
	 * @param string $description Açıklama.
	 * @return void
	 */
	private static function checkbox( $key, $value, $label, $description ) {
		woocommerce_wp_checkbox(
			array(
				'id'          => self::id( $key ),
				'name'        => self::name( $key ),
				'value'       => 'yes' === $value ? 'yes' : 'no',
				'cbvalue'     => 'yes',
				'label'       => $label,
				'description' => $description,
				'desc_tip'    => false,
			)
		);
	}

	/**
	 * Seçim kutusu.
	 *
	 * @param string                $key         Alan.
	 * @param string                $value       Değer.
	 * @param string                $label       Etiket.
	 * @param string                $description Açıklama.
	 * @param array<string, string> $options     değer => etiket.
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
	 * Çok satırlı metin alanı.
	 *
	 * @param string               $key         Alan.
	 * @param string               $value       Değer.
	 * @param string               $label       Etiket.
	 * @param string               $description Açıklama.
	 * @param array<string, mixed> $attributes  Öznitelikler (placeholder, maxlength).
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
	 * Genel ayar / açık / kapalı seçenekleri.
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
	 * Açılır bölüm başlangıcı.
	 *
	 * @param string $id    Kimlik.
	 * @param string $title Başlık.
	 * @param string $hint  Tek satırlık özet.
	 * @return void
	 */
	private static function open_section( $id, $title, $hint ) {
		echo '<details class="donation-panel-ptab__section" id="dp-ptab-section-' . esc_attr( $id ) . '">';
		echo '<summary class="donation-panel-ptab__summary"><span class="donation-panel-ptab__title">' . esc_html( $title ) . '</span><span class="donation-panel-ptab__hint">' . esc_html( $hint ) . '</span></summary>';
		echo '<div class="donation-panel-ptab__body options_group">';
	}

	/**
	 * Açılır bölüm sonu.
	 *
	 * @return void
	 */
	private static function close_section() {
		echo '</div></details>';
	}

	/**
	 * Yalnız verilen türlerde görünen kapsayıcı.
	 *
	 * @param string[] $types   Tür kimlikleri.
	 * @param string   $current Seçili tür.
	 * @return void
	 */
	private static function open_type_scope( array $types, $current ) {
		echo '<div class="donation-panel-ptab__scope" data-wdp-type-scope="' . esc_attr( implode( ' ', $types ) ) . '"' . ( in_array( $current, $types, true ) ? '' : ' hidden' ) . '>';
	}

	/* ---------------------------------------------------------------------
	 * Bloklar
	 * ------------------------------------------------------------------- */

	/**
	 * Bağış ürünü bayrağı ve otomatik yerleşim.
	 *
	 * @param \WC_Product          $product Ürün.
	 * @param array<string,string> $values  Değerler.
	 * @return void
	 */
	private static function render_scope( $product, array $values ) {
		$global_is_donation = Donation_Scope::matches_global_scope( $product );
		$global_label       = $global_is_donation ? __( 'Donation product', 'woo-donation-popup' ) : __( 'Regular product', 'woo-donation-popup' );
		$auto_global        = 'yes' === Placement_Settings::value( 'auto_place' ) ? __( 'On', 'woo-donation-popup' ) : __( 'Off', 'woo-donation-popup' );

		echo '<div class="donation-panel-ptab__block options_group">';
		self::select(
			'donation_product',
			$values['donation_product'],
			__( 'Donation product', 'woo-donation-popup' ),
			__( 'On donation products the donation form is used instead of the WooCommerce add-to-cart field, and the product appears in donation lists.', 'woo-donation-popup' ),
			array(
				/* translators: %s: what the general setting currently decides */
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
				''   => sprintf( __( 'General setting (currently: %s)', 'woo-donation-popup' ), $auto_global ),
				'no' => __( 'Off', 'woo-donation-popup' ),
			)
		);
		self::render_direct( $product, $values['direct'] );
		echo '</div>';
	}

	/**
	 * Ödeme davranışı (sepetli / doğrudan): ürün geçersiz kılması + geçerli değer ve kaynağı (ürün > tür > genel).
	 *
	 * @param \WC_Product $product Ürün.
	 * @param string      $value   Kayıtlı ürün değeri (yes|no|'').
	 * @return void
	 */
	private static function render_direct( $product, $value ) {
		$traits   = Direct_Settings::traits_from_product( $product );
		$fallback = Direct_Settings::decide( '', $traits['kind'], $traits['addon'], Direct_Settings::type_choices(), Direct_Settings::global_default() );
		$current  = Direct_Settings::resolve( $product );
		self::select(
			'direct',
			$value,
			__( 'Skip the cart (direct donation)', 'woo-donation-popup' ),
			__( 'Direct: the donor goes from the form straight to payment and nothing is added to the cart. Works with every form style, including the compact card.', 'woo-donation-popup' ),
			array(
				/* translators: %s: current value and where it comes from, e.g. "Direct (from the donation type: Campaign)" */
				''    => sprintf( __( 'Donation type or general setting (now: %s)', 'woo-donation-popup' ), self::direct_text( $fallback ) ),
				'yes' => __( 'Direct (skip the cart)', 'woo-donation-popup' ),
				'no'  => __( 'Through the cart', 'woo-donation-popup' ),
			)
		);
		$screen = '<a href="' . esc_url( admin_url( 'admin.php?page=' . \DonationPanel\Admin\Admin_Bootstrap::SLUG_CHECKOUT ) ) . '">' . esc_html__( 'Donation Panel → Cart and checkout → How donors pay', 'woo-donation-popup' ) . '</a>';
		echo '<p class="form-field donation-panel-ptab__effective" data-wdp-direct-effective="' . esc_attr( $current['enabled'] ? 'direct' : 'cart' ) . '" data-wdp-direct-source="' . esc_attr( $current['source'] ) . '">'
			/* translators: %s: current value and where it comes from */
			. esc_html( sprintf( __( 'Current value: %s', 'woo-donation-popup' ), self::direct_text( $current ) ) )
			. '<br><span class="description">'
			/* translators: %s: link to the settings screen */
			. sprintf( esc_html__( 'Donation type and general settings: %s', 'woo-donation-popup' ), $screen ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- bağlantı yukarıda kaçışlandı.
			. '</span></p>';
	}

	/**
	 * "Doğrudan (kaynak: …)" metni.
	 *
	 * @param array{enabled: bool, source: string, type: string} $resolved Karar.
	 * @return string
	 */
	private static function direct_text( array $resolved ) {
		$value = $resolved['enabled'] ? __( 'Direct (skip the cart)', 'woo-donation-popup' ) : __( 'Through the cart', 'woo-donation-popup' );
		switch ( $resolved['source'] ) {
			case Direct_Settings::SOURCE_PRODUCT:
				$source = __( 'source: this product', 'woo-donation-popup' );
				break;
			case Direct_Settings::SOURCE_TYPE:
				$defs  = Donation_Type::get_definitions();
				$label = Direct_Settings::ADDON === $resolved['type'] ? __( 'Products that offer an add-on donation', 'woo-donation-popup' ) : ( isset( $defs[ $resolved['type'] ]['label'] ) ? $defs[ $resolved['type'] ]['label'] : $resolved['type'] );
				/* translators: %s: donation type name */
				$source = sprintf( __( 'source: donation type "%s"', 'woo-donation-popup' ), $label );
				break;
			case Direct_Settings::SOURCE_FILTER:
				$source = __( 'source: a code filter on this site', 'woo-donation-popup' );
				break;
			default:
				$source = __( 'source: general setting', 'woo-donation-popup' );
		}
		return $value . ' (' . $source . ')';
	}

	/**
	 * Bağış türü seçici (kartlar).
	 *
	 * @param string $current Seçili tür.
	 * @return void
	 */
	private static function render_type_picker( $current ) {
		echo '<fieldset class="donation-panel-ptab__block donation-panel-ptab__types">';
		echo '<legend class="donation-panel-ptab__heading">' . esc_html__( 'Donation type', 'woo-donation-popup' ) . '</legend>';
		echo '<p class="donation-panel-ptab__lead">' . esc_html__( 'Choose how this product’s donation form works; only the selected type’s settings appear below.', 'woo-donation-popup' ) . '</p>';
		echo '<div class="donation-panel-ptab__grid">';
		foreach ( Donation_Type::get_definitions() as $type => $def ) {
			$input_id = 'wdp_donation_type_' . $type;
			$selected = ( $type === $current );
			echo '<label class="donation-panel-ptab__card' . ( $selected ? ' is-selected' : '' ) . '" for="' . esc_attr( $input_id ) . '" data-wdp-type-card>';
			echo '<input type="radio" class="donation-panel-ptab__card-input" id="' . esc_attr( $input_id ) . '" name="' . esc_attr( self::name( 'donation_type' ) ) . '" value="' . esc_attr( $type ) . '" aria-describedby="' . esc_attr( $input_id . '_desc' ) . '" data-wdp-type-input' . checked( $selected, true, false ) . ' />';
			echo '<span class="donation-panel-ptab__card-icon dashicons ' . esc_attr( $def['icon'] ) . '" aria-hidden="true"></span>';
			echo '<span class="donation-panel-ptab__card-text"><span class="donation-panel-ptab__card-title">' . esc_html( $def['label'] ) . '</span>';
			echo '<span class="donation-panel-ptab__card-desc" id="' . esc_attr( $input_id . '_desc' ) . '">' . esc_html( $def['description'] ) . '</span></span>';
			echo '</label>';
		}
		echo '</div></fieldset>';
	}

	/**
	 * Türe bağlı alanlar.
	 *
	 * @param \WC_Product          $product Ürün.
	 * @param array<string,string> $values  Değerler.
	 * @return void
	 */
	private static function render_type_fields( $product, array $values ) {
		$type     = $values['donation_type'];
		$currency = get_woocommerce_currency_symbol();

		echo '<div class="donation-panel-ptab__block options_group">';

		self::open_type_scope( array( Donation_Type::FIXED ), $type );
		$price = $product->get_price();
		if ( '' !== $price && (float) $price > 0 ) {
			/* translators: %s: formatted product price */
			echo '<p class="donation-panel-ptab__note">' . esc_html( sprintf( __( 'The donation amount is the product price: %s. You can change the price on the "General" tab.', 'woo-donation-popup' ), Price::format_price_plain( $price ) ) ) . '</p>';
		} else {
			echo '<p class="donation-panel-ptab__note donation-panel-ptab__note--warn">' . esc_html__( 'This product has no price; enter a regular price on the "General" tab for a fixed amount.', 'woo-donation-popup' ) . '</p>';
		}
		echo '</div>';

		self::open_type_scope( array( Donation_Type::CAMPAIGN ), $type );
		self::number(
			'progress_bar_limit',
			$values['progress_bar_limit'],
			/* translators: %s: currency symbol */
			sprintf( __( 'Goal amount (%s)', 'woo-donation-popup' ), $currency ),
			__( 'Campaign goal at which the progress bar is 100% (in the store’s main currency). Empty or zero cannot be saved.', 'woo-donation-popup' ),
			array(
				'step' => '1',
				'min'  => '1',
			)
		);
		echo '</div>';

		self::open_type_scope( array( Donation_Type::CUSTOM, Donation_Type::CAMPAIGN ), $type );
		echo '<p class="donation-panel-ptab__note">' . esc_html__( 'The donor enters the amount. The WooCommerce General price field may stay empty for these types.', 'woo-donation-popup' ) . '</p>';
		self::number(
			'min_custom_price',
			$values['min_custom_price'],
			/* translators: %s: currency symbol */
			sprintf( __( 'Minimum amount (%s)', 'woo-donation-popup' ), $currency ),
			__( 'The lowest amount the donor can enter. 0 means no minimum.', 'woo-donation-popup' ),
			array( 'step' => '1' )
		);
		echo '</div>';

		self::open_type_scope( array( Donation_Type::SHARES ), $type );
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

		self::open_type_scope( array( Donation_Type::CAMPAIGN ), $type );
		self::render_totals( $product->get_id(), (float) $values['progress_bar_limit'] );
		self::select(
			'goal_reached_action',
			$values['goal_reached_action'],
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
			$values['goal_reached_message'],
			__( 'Message when the goal is reached', 'woo-donation-popup' ),
			__( 'If left empty, the default thank-you text is used (maximum 300 characters).', 'woo-donation-popup' ),
			array(
				'maxlength'   => '300',
				'placeholder' => Campaign_Goal::default_message(),
			)
		);
		echo '</div>';

		echo '</div>';
	}

	/**
	 * Toplanan tutar özeti (salt okunur).
	 *
	 * @param int   $product_id Ürün.
	 * @param float $goal       Hedef.
	 * @return void
	 */
	private static function render_totals( $product_id, $goal ) {
		$total   = Campaign_Totals::get_total_donation_amount( $product_id );
		$manual  = Campaign_Totals::get_manual_total( $product_id );
		$carried = get_post_meta( $product_id, self::META_CARRIED, true );
		$carried = ( '' !== $carried && is_numeric( $carried ) ) ? max( 0.0, (float) $carried ) : 0.0;
		$percent = $goal > 0 ? min( 100, (int) floor( ( $total / $goal ) * 100 ) ) : 0;

		$unconverted   = get_post_meta( $product_id, '_wdp_progress_unconverted_orders', true );
		$unconverted_n = is_array( $unconverted ) ? count( $unconverted ) : 0;

		echo '<div class="donation-panel-ptab__totals" data-wdp-progress>';
		echo '<p class="donation-panel-ptab__totals-title">' . esc_html__( 'Raised so far', 'woo-donation-popup' ) . '</p>';
		echo '<p class="donation-panel-ptab__totals-main"><strong>' . esc_html( Price::format_price_plain( $total ) ) . '</strong> <span>/ ' . esc_html( Price::format_price_plain( $goal ) ) . '</span></p>';
		echo '<div class="donation-panel-ptab__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' . esc_attr( (string) $percent ) . '" aria-label="' . esc_attr__( 'Progress toward goal', 'woo-donation-popup' ) . '"><span style="width:' . esc_attr( (string) $percent ) . '%"></span></div>';
		echo '<dl class="donation-panel-ptab__facts">';
		echo '<div><dt>' . esc_html__( 'Carried over', 'woo-donation-popup' ) . '</dt><dd>' . esc_html( Price::format_price_plain( $carried ) ) . '</dd></div>';
		echo '<div><dt>' . esc_html__( 'Added by hand', 'woo-donation-popup' ) . '</dt><dd>' . esc_html( Price::format_price_plain( $manual ) ) . '</dd></div>';
		echo '<div><dt>' . esc_html__( 'Progress', 'woo-donation-popup' ) . '</dt><dd>' . esc_html( (string) $percent ) . '%</dd></div>';
		echo '</dl>';
		if ( $unconverted_n > 0 ) {
			echo '<p class="donation-panel-ptab__note donation-panel-ptab__note--warn">' . esc_html(
				sprintf(
					/* translators: %d: number of orders */
					_n( '%d order could not be converted', '%d orders could not be converted', $unconverted_n, 'woo-donation-popup' ),
					$unconverted_n
				)
			) . '</p>';
		}
		echo '<p class="donation-panel-ptab__note">' . wp_kses(
			sprintf(
				/* translators: %s: link to the Campaigns screen */
				__( 'These figures are shown for reference. To add an amount by hand or recalculate the total, open %s.', 'woo-donation-popup' ),
				'<a href="' . esc_url( admin_url( 'admin.php?page=donation-panel-campaigns' ) ) . '">' . esc_html__( 'Donation Panel → Campaigns', 'woo-donation-popup' ) . '</a>'
			),
			array(
				'a' => array( 'href' => array() ),
			)
		) . '</p>';
		echo '</div>';
	}

	/**
	 * Tutar seçenekleri.
	 *
	 * @param array<string,string> $values Değerler.
	 * @return void
	 */
	private static function render_amount_section( array $values ) {
		$type = $values['donation_type'];
		self::open_section( 'amount', __( 'Amount options', 'woo-donation-popup' ), __( 'Quick amount buttons, quantity, and processing fee', 'woo-donation-popup' ) );

		self::open_type_scope( array( Donation_Type::CUSTOM, Donation_Type::CAMPAIGN ), $type );
		self::checkbox( 'enable_amount_presets', $values['enable_amount_presets'], __( 'Quick amount buttons', 'woo-donation-popup' ), __( 'Shows one-click amount buttons above the amount field.', 'woo-donation-popup' ) );
		self::text(
			'amount_presets',
			$values['amount_presets'],
			__( 'Amounts', 'woo-donation-popup' ),
			__( 'Whole numbers only; separate with commas, spaces, or semicolons (maximum 6). If left empty, the amounts from the general setting are used. Buttons below the minimum amount are not shown.', 'woo-donation-popup' ),
			array( 'placeholder' => '100, 250, 500' )
		);
		self::number(
			'amount_preset_recommended',
			$values['amount_preset_recommended'],
			__( 'Suggested amount', 'woo-donation-popup' ),
			__( 'Shows a "Most chosen" label on that amount of the list. It is not pre-selected. A value that is not on the list blocks saving.', 'woo-donation-popup' ),
			array(
				'min'  => '1',
				'step' => '1',
			)
		);
		echo '</div>';

		self::open_type_scope( array( Donation_Type::FIXED ), $type );
		self::checkbox( 'enable_quantity', $values['enable_quantity'], __( 'Quantity selector', 'woo-donation-popup' ), __( 'Shows quantity plus/minus buttons on a fixed-amount form. If off, the quantity is always 1.', 'woo-donation-popup' ) );
		echo '</div>';

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
	 * Form alanları.
	 *
	 * @param array<string,string> $values Değerler.
	 * @return void
	 */
	private static function render_fields_section( array $values ) {
		self::open_section( 'fields', __( 'Form fields', 'woo-donation-popup' ), __( 'Email, dedication, and anonymous donation', 'woo-donation-popup' ) );
		self::open_type_scope( array( Donation_Type::FIXED, Donation_Type::CUSTOM, Donation_Type::CAMPAIGN ), $values['donation_type'] );
		self::select( 'enable_email', $values['enable_email'], __( 'Email field', 'woo-donation-popup' ), __( 'Asks the donor for an email address; "Use general setting" follows the Forms and Appearance screen.', 'woo-donation-popup' ), self::tristate_options() );
		self::select( 'enable_dedication', $values['enable_dedication'], __( 'Dedication field', 'woo-donation-popup' ), __( 'Shows a field to write who the donation is on behalf of.', 'woo-donation-popup' ), self::tristate_options() );
		self::text( 'dedication_placeholder', $values['dedication_placeholder'], __( 'Dedication placeholder', 'woo-donation-popup' ), __( 'Sample text shown inside the dedication field when it is empty.', 'woo-donation-popup' ), array( 'custom_attributes' => array( 'maxlength' => '120' ) ) );
		self::select( 'enable_anonymous', $values['enable_anonymous'], __( 'Anonymous donation', 'woo-donation-popup' ), __( 'If checked, the donor name is hidden on public lists; it remains visible on order records.', 'woo-donation-popup' ), self::tristate_options() );
		echo '</div>';
		self::open_type_scope( array( Donation_Type::SHARES ), $values['donation_type'] );
		echo '<p class="donation-panel-ptab__note">' . esc_html__( 'Share-based forms ask for a name and phone number for each share; these fields do not change per product.', 'woo-donation-popup' ) . '</p>';
		echo '</div>';
		self::close_section();
	}

	/**
	 * Ek bağış bölümü.
	 *
	 * @param array<string,string> $values            Değerler.
	 * @param int                  $parent_product_id Ürün.
	 * @return void
	 */
	private static function render_addon_section( array $values, $parent_product_id ) {
		$default_id = Addon_Settings::get_default_addon_wc_product_id();
		$currency   = get_woocommerce_currency_symbol();

		self::open_section( 'addon', __( 'Extra donation', 'woo-donation-popup' ), __( 'A second, smaller donation row added to the form', 'woo-donation-popup' ) );
		self::open_type_scope( array( Donation_Type::CAMPAIGN ), $values['donation_type'] );
		echo '<p class="donation-panel-ptab__note">' . esc_html__( 'On a goal campaign the extra donation is not shown on the form; the settings are used if you switch to other types.', 'woo-donation-popup' ) . '</p>';
		echo '</div>';
		self::checkbox( 'enable_addon_donation', $values['enable_addon_donation'], __( 'Add an extra donation', 'woo-donation-popup' ), __( 'Lets the donor add a small extra donation on top of the main donation.', 'woo-donation-popup' ) );
		self::text(
			'addon_toggle_label',
			$values['addon_toggle_label'],
			_x( 'Button text', 'product data tab', 'woo-donation-popup' ),
			__( 'Text of the button that opens the extra donation.', 'woo-donation-popup' ),
			array(
				'placeholder'       => __( 'Add extra donation', 'woo-donation-popup' ),
				'custom_attributes' => array( 'maxlength' => '80' ),
			)
		);

		$addon_id = ( '' !== $values['addon_wc_product_id'] ) ? absint( $values['addon_wc_product_id'] ) : 0;
		$error    = '';
		if ( $addon_id > 0 ) {
			$check = Addon_Product_Visibility::validate_addon_product_id( $addon_id, (int) $parent_product_id );
			if ( empty( $check['ok'] ) ) {
				$error = (string) $check['error'];
			}
		}
		Addon_Product_Visibility::render_product_search_field(
			array(
				'id'          => self::id( 'addon_wc_product_id' ),
				'name'        => self::name( 'addon_wc_product_id' ),
				'value'       => $addon_id,
				'label'       => __( 'Extra donation product', 'woo-donation-popup' ),
				'description' => $default_id
					? sprintf(
						/* translators: %d: default product ID */
						__( 'WooCommerce product to add to the cart; if empty, the general default (#%d) is used.', 'woo-donation-popup' ),
						$default_id
					)
					: __( 'WooCommerce product to add to the cart; if empty, the general default is used, and if that is also missing the row is not added.', 'woo-donation-popup' ),
				'error'       => $error,
			)
		);
		self::number(
			'addon_min_price',
			$values['addon_min_price'],
			/* translators: %s: currency symbol */
			sprintf( __( 'Minimum amount (%s)', 'woo-donation-popup' ), $currency ),
			__( 'Lower limit applied when the donor types the amount themselves.', 'woo-donation-popup' ),
			array( 'step' => '1' )
		);
		self::number(
			'addon_fixed_price',
			$values['addon_fixed_price'],
			/* translators: %s: currency symbol */
			sprintf( __( 'Fixed amount (%s)', 'woo-donation-popup' ), $currency ),
			__( 'If filled, the extra donation is added at this amount and the minimum amount is ignored.', 'woo-donation-popup' ),
			array(
				'step'        => '1',
				'placeholder' => '0',
			)
		);
		self::textarea(
			'addon_donation_message',
			$values['addon_donation_message'],
			__( 'Extra donation note', 'woo-donation-popup' ),
			__( 'Description shown next to the extra donation row.', 'woo-donation-popup' ),
			array( 'maxlength' => '300' )
		);
		self::close_section();
	}

	/**
	 * Kısa kod seçici + kopyalama.
	 *
	 * @param int $product_id Ürün.
	 * @return void
	 */
	private static function render_shortcodes( $product_id ) {
		$shortcodes = self::get_shortcodes( $product_id );

		echo '<div class="donation-panel-ptab__block donation-panel-ptab__shortcode">';
		echo '<p class="donation-panel-ptab__heading">' . esc_html__( 'Shortcode', 'woo-donation-popup' ) . '</p>';
		echo '<p class="donation-panel-ptab__lead">' . esc_html__( 'Choose a view, copy the shortcode, and paste it into a page or post.', 'woo-donation-popup' ) . '</p>';
		echo '<div class="donation-panel-ptab__shortcode-row">';
		echo '<label class="screen-reader-text" for="wdp-shortcode-view">' . esc_html_x( 'View', 'section title', 'woo-donation-popup' ) . '</label>';
		echo '<select id="wdp-shortcode-view" data-wdp-shortcode-select aria-controls="wdp-shortcode-output">';
		foreach ( $shortcodes as $shortcode ) {
			echo '<option value="' . esc_attr( $shortcode['code'] ) . '">' . esc_html( $shortcode['label'] ) . '</option>';
		}
		echo '</select>';
		echo '<input type="text" id="wdp-shortcode-output" class="code" value="' . esc_attr( $shortcodes[0]['code'] ) . '" readonly aria-label="' . esc_attr__( 'Shortcode', 'woo-donation-popup' ) . '" data-wdp-shortcode-output />';
		echo '<button type="button" class="button" data-wdp-copy-target="#wdp-shortcode-output">' . esc_html__( 'Copy', 'woo-donation-popup' ) . '</button>';
		echo '</div></div>';
	}

	/**
	 * Ürün için kısa kod örnekleri (kısa kod adları ve `id` özniteliği sözleşmedir).
	 *
	 * @param int $product_id Ürün.
	 * @return array<int, array{label: string, code: string}>
	 */
	public static function get_shortcodes( $product_id ) {
		$id_attr = esc_attr( (string) absint( $product_id ) );
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

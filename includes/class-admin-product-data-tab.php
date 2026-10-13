<?php
/**
 * WooCommerce ürün düzenleme ekranındaki "Bağış" sekmesi: bağış tipi, gruplu ayarlar ve kayıt.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
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
	const HEADER_MODULES = array('media', 'impact', 'urgency', 'social_proof', 'progress');

	const MAX_TRUST_ROWS = 3;

	/**
	 * Register WooCommerce hooks.
	 *
	 * @return void
	 */
	public static function register() {
		add_filter('woocommerce_product_data_tabs', array(__CLASS__, 'add_tab'));
		add_action('woocommerce_product_data_panels', array(__CLASS__, 'render_panel'));
		add_action('woocommerce_admin_process_product_object', array(__CLASS__, 'save'));
	}

	/**
	 * Edit link that opens this tab.
	 *
	 * @param int $product_id Product ID.
	 * @return string
	 */
	public static function get_edit_url($product_id) {
		return admin_url('post.php?post=' . absint($product_id) . '&action=edit') . '#' . self::TAB_KEY;
	}

	/**
	 * @param array $tabs Product data tabs.
	 * @return array
	 */
	public static function add_tab($tabs) {
		if (!current_user_can('manage_woocommerce')) {
			return $tabs;
		}

		$classes = array();
		foreach (WDP_Donation_Scope::supported_types() as $type) {
			$classes[] = 'show_if_' . $type;
		}

		$tabs[ self::TAB_KEY ] = array(
			'label'    => __('Bağış', 'woo-donation-popup'),
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
	public static function save($product) {
		try {
			self::save_panel($product);
		} catch (\Throwable $e) {
			if (function_exists('wdp_debug_log')) {
				wdp_debug_log('WDP product tab save failed: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
			}
		}
	}

	/**
	 * @param WC_Product $product Product being saved.
	 * @return void
	 */
	private static function save_panel($product) {
		if (!is_a($product, 'WC_Product')) {
			return;
		}

		$nonce = isset($_POST[ self::NONCE_FIELD ]) ? sanitize_text_field(wp_unslash($_POST[ self::NONCE_FIELD ])) : '';
		if ($nonce === '' || !wp_verify_nonce($nonce, self::NONCE_ACTION)) {
			return;
		}

		if (!current_user_can('manage_woocommerce') || !current_user_can('edit_post', $product->get_id())) {
			return;
		}

		// Sanitized field by field in WDP_Product_Settings_Service::from_request().
		$posted = (isset($_POST[ self::FIELD_NAME ]) && is_array($_POST[ self::FIELD_NAME ])) ? $_POST[ self::FIELD_NAME ] : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized

		$existing = array();
		foreach (WDP_Product_Settings_Service::PRESERVED_FIELDS as $meta_key) {
			$existing[ $meta_key ] = $product->get_meta($meta_key, true);
		}

		foreach (WDP_Product_Settings_Service::from_product_panel($posted, $existing) as $meta_key => $meta_value) {
			$product->update_meta_data($meta_key, $meta_value);
		}
		WDP_Product_Settings_Service::flush_correction_notices();
		if (class_exists('WDP_Donation_Scope')) {
			WDP_Donation_Scope::flush($product->get_id());
		}
	}

	/**
	 * Render the panel.
	 *
	 * @return void
	 */
	public static function render_panel() {
		global $post, $product_object;

		if (!current_user_can('manage_woocommerce')) {
			return;
		}

		$product = ($product_object instanceof WC_Product) ? $product_object : (isset($post->ID) ? wc_get_product($post->ID) : false);
		if (!$product) {
			return;
		}

		$values = self::get_panel_values($product);

		echo '<div id="' . esc_attr(self::PANEL_ID) . '" class="panel woocommerce_options_panel hidden wdp-pp" data-wdp-product-panel data-wdp-supported-types="' . esc_attr(implode(' ', WDP_Donation_Scope::supported_types())) . '">';
		wp_nonce_field(self::NONCE_ACTION, self::NONCE_FIELD);

		self::render_scope_block($product, $values);
		self::render_type_picker($values['donation_type']);
		self::render_type_fields($product, $values);

		echo '<div class="wdp-pp-sections">';
		self::render_amount_section($values);
		self::render_form_fields_section($values);
		self::render_campaign_blocks_section($product->get_id(), $values);
		self::render_sadaka_section($values);
		self::render_appearance_section($values);
		echo '</div>';

		self::render_shortcode_block($product->get_id());

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
	public static function render_progress_summary($product_id, $compact = false) {
		$product_id = absint($product_id);
		$goal_raw   = (string) get_post_meta($product_id, '_progress_bar_limit', true);
		$goal       = (float) ($goal_raw !== '' ? $goal_raw : WDP_Donation_Type::DEFAULT_GOAL);
		$stored     = get_post_meta($product_id, '_wdp_total_donation_amount', true);
		$has_total  = ($stored !== '' && is_numeric($stored));
		$total      = $has_total ? max(0.0, (float) $stored) : 0.0;
		$percent    = $goal > 0 ? min(100, (int) floor(($total / $goal) * 100)) : 0;

		$total_text = $has_total ? WDP_Utils::format_price_plain($total) : __('Henüz hesaplanmadı', 'woo-donation-popup');
		$goal_text  = WDP_Utils::format_price_plain($goal);

		echo '<div class="wdp-progress-summary' . ($compact ? ' wdp-progress-summary--compact' : '') . '" data-wdp-progress data-goal="' . esc_attr((string) $goal) . '">';
		echo '<div class="wdp-progress-summary__text">';
		echo '<span class="wdp-progress-summary__total" data-wdp-progress-total>' . esc_html($total_text) . '</span>';
		echo ' <span class="wdp-progress-summary__goal">/ ' . esc_html($goal_text) . '</span>';
		echo '</div>';
		echo '<div class="wdp-progress-summary__row">';
		echo '<div class="wdp-progress-summary__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' . esc_attr((string) $percent) . '" aria-label="' . esc_attr__('Hedefe ulaşma oranı', 'woo-donation-popup') . '" data-wdp-progress-track>';
		echo '<span class="wdp-progress-summary__bar" style="width:' . esc_attr((string) $percent) . '%" data-wdp-progress-bar></span>';
		echo '</div>';
		echo '<span class="wdp-progress-summary__percent" data-wdp-progress-percent>%' . esc_html((string) $percent) . '</span>';
		echo '<button type="button" class="wdp-icon-button" data-wdp-recalc data-product-id="' . esc_attr((string) $product_id) . '" aria-label="' . esc_attr__('Toplamı yeniden hesapla', 'woo-donation-popup') . '" title="' . esc_attr__('Ödemesi alınmış siparişleri tarayıp toplamı yeniden hesaplar.', 'woo-donation-popup') . '">';
		echo '<span class="dashicons dashicons-update" aria-hidden="true"></span>';
		echo '</button>';
		echo '</div>';
		echo '</div>';
	}

	/**
	 * Current values for every panel control.
	 *
	 * @param WC_Product $product Product.
	 * @return array<string, mixed>
	 */
	private static function get_panel_values($product) {
		$meta = static function ($key) use ($product) {
			$value = $product->get_meta($key, true);
			return is_scalar($value) ? (string) $value : '';
		};
		$flag = static function ($key, $default_yes = false) use ($meta) {
			$raw = $meta($key);
			if ($raw === '') {
				return $default_yes ? 'yes' : 'no';
			}
			return $raw === 'yes' ? 'yes' : 'no';
		};
		$tristate = static function ($key) use ($meta) {
			$raw = $meta($key);
			return in_array($raw, array('yes', 'no'), true) ? $raw : '';
		};

		$repair = array('WDP_Product_Settings_Service', 'repair_unicode_escapes');

		$trust_rows = array();
		$trust_raw  = $meta('_trust_badges');
		if ($trust_raw !== '') {
			foreach (WDP_Form_Modules::sanitize_trust_badges($trust_raw) as $row) {
				$trust_rows[] = array('icon' => $row['icon'], 'text' => call_user_func($repair, $row['text']));
			}
		}

		$min_price  = $meta('_min_custom_price');
		$max_shares = $meta('_max_shares');
		$goal       = $meta('_progress_bar_limit');
		$layout     = sanitize_key($meta('_layout_mode'));
		$density    = $meta('_theme_density');

		$auto_place = $meta('_wdp_auto_place');

		return array(
			'donation_product'             => WDP_Donation_Scope::product_flag($product),
			'auto_place'                   => $auto_place === 'no' ? 'no' : '',
			'donation_type'                => WDP_Donation_Type::infer_from_meta(
				array(
					'_allow_custom_price'    => $meta('_allow_custom_price'),
					'_allow_multiple_shares' => $meta('_allow_multiple_shares'),
					'_enable_progress_bar'   => $meta('_enable_progress_bar'),
				)
			),
			'min_custom_price'             => $min_price !== '' ? $min_price : '0',
			'max_shares'                   => ($max_shares !== '' && absint($max_shares) > 0) ? $max_shares : WDP_Donation_Type::DEFAULT_MAX_SHARES,
			'progress_bar_limit'           => $goal !== '' ? $goal : WDP_Donation_Type::DEFAULT_GOAL,
			'progress_celebrate'           => $flag('_progress_celebrate', true),
			'enable_amount_presets'        => $flag('_enable_amount_presets', true),
			'amount_presets'               => $meta('_amount_presets'),
			'enable_quantity'              => $flag('_enable_quantity', true),
			'enable_cover_fee'             => $flag('_enable_cover_fee'),
			'cover_fee_percent'            => $meta('_cover_fee_percent'),
			'enable_email'                 => $tristate('_enable_email'),
			'enable_dedication'            => $tristate('_enable_dedication'),
			'dedication_placeholder'       => $meta('_dedication_placeholder'),
			'enable_anonymous'             => $tristate('_enable_anonymous'),
			'enable_product_note'          => $flag('_enable_product_note'),
			'product_note_text'            => $meta('_product_note_text'),
			'enable_wizard'                => $flag('_enable_wizard'),
			'enable_field_icons'           => $flag('_enable_field_icons', true),
			'enable_impact_line'           => $flag('_enable_impact_line', true),
			'impact_line_text'             => $meta('_impact_line_text'),
			'enable_urgency'               => $flag('_enable_urgency'),
			'urgency_text'                 => $meta('_urgency_text'),
			'urgency_ends_at'              => $meta('_urgency_ends_at'),
			'enable_social_proof'          => $flag('_enable_social_proof'),
			'social_proof_text'            => $meta('_social_proof_text'),
			'enable_trust_strip'           => $flag('_enable_trust_strip', true),
			'trust_rows'                   => $trust_rows,
			'module_order_custom'          => $meta('_wdp_module_order') !== '',
			'enable_sadaka_donation'       => $flag('_enable_sadaka_donation'),
			'sadaka_toggle_label'          => $meta('_sadaka_toggle_label'),
			'sadaka_wc_product_id'         => ($meta('_sadaka_wc_product_id') !== '' && $meta('_sadaka_wc_product_id') !== '0') ? $meta('_sadaka_wc_product_id') : '',
			'sadaka_min_price'             => $meta('_sadaka_min_price') !== '' ? $meta('_sadaka_min_price') : '0',
			'sadaka_fixed_price'           => ((float) $meta('_sadaka_fixed_price') > 0) ? $meta('_sadaka_fixed_price') : '',
			'sadaka_donation_message'      => $meta('_sadaka_donation_message'),
			'layout_mode'                  => in_array($layout, array('classic', 'campaign', 'story'), true) ? $layout : 'classic',
			'enable_campaign_media'        => $flag('_enable_campaign_media'),
			'theme_inherit_category_color' => $flag('_theme_inherit_category_color'),
			'theme_primary'                => $meta('_theme_primary'),
			'theme_primary_hover'          => $meta('_theme_primary_hover'),
			'theme_modal_bg'               => $meta('_theme_modal_bg'),
			'theme_radius'                 => $meta('_theme_radius'),
			'theme_density'                => in_array($density, array('compact', 'normal', 'spacious'), true) ? $density : '',
		);
	}

	/* ---------------------------------------------------------------------
	 * Field helpers (thin wrappers around woocommerce_wp_*)
	 * ------------------------------------------------------------------- */

	/**
	 * @param string $key Field key.
	 * @return string
	 */
	private static function name($key) {
		return self::FIELD_NAME . '[' . $key . ']';
	}

	/**
	 * @param string $key Field key.
	 * @return string
	 */
	private static function id($key) {
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
	private static function text($key, $value, $label, $description, array $extra = array()) {
		woocommerce_wp_text_input(
			array_merge(
				array(
					'id'          => self::id($key),
					'name'        => self::name($key),
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
	private static function number($key, $value, $label, $description, array $attributes = array()) {
		$placeholder = isset($attributes['placeholder']) ? (string) $attributes['placeholder'] : '';
		unset($attributes['placeholder']);

		self::text(
			$key,
			$value,
			$label,
			$description,
			array(
				'type'              => 'number',
				'placeholder'       => $placeholder,
				'custom_attributes' => array_merge(array('min' => '0', 'step' => 'any'), $attributes),
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
	private static function checkbox($key, $value, $label, $description, array $extra = array()) {
		woocommerce_wp_checkbox(
			array_merge(
				array(
					'id'          => self::id($key),
					'name'        => self::name($key),
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
	private static function select($key, $value, $label, $description, array $options) {
		woocommerce_wp_select(
			array(
				'id'          => self::id($key),
				'name'        => self::name($key),
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
	private static function textarea($key, $value, $label, $description, array $attributes = array()) {
		$placeholder = isset($attributes['placeholder']) ? (string) $attributes['placeholder'] : '';
		unset($attributes['placeholder']);

		woocommerce_wp_textarea_input(
			array(
				'id'                => self::id($key),
				'name'              => self::name($key),
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
			''    => __('Genel ayarı kullan', 'woo-donation-popup'),
			'yes' => __('Açık', 'woo-donation-popup'),
			'no'  => __('Kapalı', 'woo-donation-popup'),
		);
	}

	/**
	 * @param string $id    Section id.
	 * @param string $title Title.
	 * @param string $hint  One-line summary.
	 * @return void
	 */
	private static function open_section($id, $title, $hint) {
		echo '<details class="wdp-pp-section" id="wdp-pp-section-' . esc_attr($id) . '">';
		echo '<summary class="wdp-pp-section__summary">';
		echo '<span class="wdp-pp-section__title">' . esc_html($title) . '</span>';
		echo '<span class="wdp-pp-section__hint">' . esc_html($hint) . '</span>';
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
	private static function open_type_scope(array $types, $current, $class = '') {
		$hidden = in_array($current, $types, true) ? '' : ' hidden';
		echo '<div class="wdp-pp-type-scope' . ($class !== '' ? ' ' . esc_attr($class) : '') . '" data-wdp-type-scope="' . esc_attr(implode(' ', $types)) . '"' . $hidden . '>';
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
	private static function render_scope_block($product, array $values) {
		$global_is_donation = WDP_Donation_Scope::matches_global_scope($product);
		$global_label       = $global_is_donation ? __('Bağış ürünü', 'woo-donation-popup') : __('Normal ürün', 'woo-donation-popup');
		$auto_place_global  = WDP_Placement_Settings::value('auto_place') === 'yes' ? __('Açık', 'woo-donation-popup') : __('Kapalı', 'woo-donation-popup');

		echo '<div class="wdp-pp-block wdp-pp-scope options_group">';
		self::select(
			'donation_product',
			$values['donation_product'],
			__('Bağış ürünü', 'woo-donation-popup'),
			__('Bağış ürünlerinde WooCommerce sepete ekle alanı yerine bağış formu kullanılır ve ürün bağış listelerinde görünür.', 'woo-donation-popup'),
			array(
				/* translators: %s: what the global setting currently decides */
				''    => sprintf(__('Genel ayar (şu an: %s)', 'woo-donation-popup'), $global_label),
				'yes' => __('Bağış ürünü', 'woo-donation-popup'),
				'no'  => __('Normal ürün', 'woo-donation-popup'),
			)
		);
		self::select(
			'auto_place',
			$values['auto_place'],
			__('Otomatik yerleşim', 'woo-donation-popup'),
			__('Kapalıysa formu ürün sayfasına yalnızca kısa kod, blok veya widget ile siz eklersiniz.', 'woo-donation-popup'),
			array(
				/* translators: %s: Açık / Kapalı */
				''   => sprintf(__('Genel ayar (şu an: %s)', 'woo-donation-popup'), $auto_place_global),
				'no' => __('Kapalı', 'woo-donation-popup'),
			)
		);
		echo '</div>';
	}

	/**
	 * @param string $current Selected type.
	 * @return void
	 */
	private static function render_type_picker($current) {
		echo '<fieldset class="wdp-pp-block wdp-type-picker">';
		echo '<legend class="wdp-pp-heading">' . esc_html__('Bağış tipi', 'woo-donation-popup') . '</legend>';
		echo '<p class="wdp-pp-lead">' . esc_html__('Bu ürünün bağış formunun nasıl çalışacağını seçin; altta yalnızca seçili tipin ayarları görünür.', 'woo-donation-popup') . '</p>';
		echo '<div class="wdp-type-picker__grid">';
		foreach (WDP_Donation_Type::get_definitions() as $type => $def) {
			$input_id = 'wdp_donation_type_' . $type;
			$selected = ($type === $current);
			echo '<label class="wdp-type-card' . ($selected ? ' is-selected' : '') . '" for="' . esc_attr($input_id) . '" data-wdp-type-card>';
			echo '<input type="radio" class="wdp-type-card__input" id="' . esc_attr($input_id) . '" name="' . esc_attr(self::name('donation_type')) . '" value="' . esc_attr($type) . '" aria-describedby="' . esc_attr($input_id . '_desc') . '" data-wdp-type-input' . checked($selected, true, false) . ' />';
			echo '<span class="wdp-type-card__icon dashicons ' . esc_attr($def['icon']) . '" aria-hidden="true"></span>';
			echo '<span class="wdp-type-card__text">';
			echo '<span class="wdp-type-card__title">' . esc_html($def['label']) . '</span>';
			echo '<span class="wdp-type-card__desc" id="' . esc_attr($input_id . '_desc') . '">' . esc_html($def['description']) . '</span>';
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
	private static function render_type_fields($product, array $values) {
		$type     = $values['donation_type'];
		$currency = get_woocommerce_currency_symbol();

		echo '<div class="wdp-pp-block wdp-pp-type-fields options_group">';

		self::open_type_scope(array(WDP_Donation_Type::FIXED), $type);
		$price = $product->get_price();
		if ($price !== '' && (float) $price > 0) {
			echo '<p class="wdp-pp-note">';
			/* translators: %s: formatted product price */
			echo esc_html(sprintf(__('Bağış tutarı ürün fiyatıdır: %s. Fiyatı "Genel" sekmesinden değiştirebilirsiniz.', 'woo-donation-popup'), WDP_Utils::format_price_plain($price)));
			echo '</p>';
		} else {
			echo '<p class="wdp-pp-note wdp-pp-note--warning">' . esc_html__('Bu ürünün fiyatı yok; sabit tutar için "Genel" sekmesinden normal fiyat girin.', 'woo-donation-popup') . '</p>';
		}
		echo '</div>';

		self::open_type_scope(array(WDP_Donation_Type::CAMPAIGN), $type);
		/* translators: %s: currency symbol */
		self::number('progress_bar_limit', $values['progress_bar_limit'], sprintf(__('Hedef tutar (%s)', 'woo-donation-popup'), $currency), __('İlerleme çubuğunun %100 sayılacağı kampanya hedefi.', 'woo-donation-popup'), array('step' => '1'));
		echo '</div>';

		self::open_type_scope(array(WDP_Donation_Type::CUSTOM, WDP_Donation_Type::CAMPAIGN), $type);
		/* translators: %s: currency symbol */
		self::number('min_custom_price', $values['min_custom_price'], sprintf(__('En düşük tutar (%s)', 'woo-donation-popup'), $currency), __('Bağışçının yazabileceği en düşük tutar; hedefli kampanyada ürün fiyatı daha düşükse o kullanılır.', 'woo-donation-popup'), array('step' => '1'));
		echo '</div>';

		self::open_type_scope(array(WDP_Donation_Type::SHARES), $type);
		self::number('max_shares', $values['max_shares'], __('En fazla hisse', 'woo-donation-popup'), __('Bağışçının tek seferde seçebileceği en yüksek hisse adedi.', 'woo-donation-popup'), array('min' => '1', 'step' => '1'));
		echo '</div>';

		self::open_type_scope(array(WDP_Donation_Type::CAMPAIGN), $type);
		echo '<div class="form-field wdp-pp-field">';
		echo '<span class="wdp-pp-field__label">' . esc_html__('Toplanan', 'woo-donation-popup') . '</span>';
		echo '<div class="wdp-pp-field__control">';
		self::render_progress_summary($product->get_id());
		echo '<span class="description">' . esc_html__('Ödemesi alınmış siparişlerden hesaplanır; yenile simgesi toplamı baştan hesaplar.', 'woo-donation-popup') . '</span>';
		echo '</div>';
		echo '</div>';
		self::checkbox('progress_celebrate', $values['progress_celebrate'], __('Kutlama animasyonu', 'woo-donation-popup'), __('Bağış eklendiğinde ilerleme çubuğunda kısa bir kutlama gösterir.', 'woo-donation-popup'));
		echo '</div>';

		echo '</div>';
	}

	/**
	 * @param array $values Values.
	 * @return void
	 */
	private static function render_amount_section(array $values) {
		self::open_section('amount', __('Tutar seçenekleri', 'woo-donation-popup'), __('Hızlı tutar düğmeleri, adet ve işlem ücreti', 'woo-donation-popup'));
		self::checkbox('enable_amount_presets', $values['enable_amount_presets'], __('Hızlı tutar düğmeleri', 'woo-donation-popup'), __('Tutar alanının üstünde tek tıkla seçilen tutar düğmeleri gösterir.', 'woo-donation-popup'));
		self::text('amount_presets', $values['amount_presets'], __('Tutarlar', 'woo-donation-popup'), __('Virgülle ayırın (en fazla 6); boş bırakırsanız genel ayardaki tutarlar kullanılır.', 'woo-donation-popup'), array('placeholder' => '100, 250, 500'));
		self::checkbox('enable_quantity', $values['enable_quantity'], __('Adet seçici', 'woo-donation-popup'), __('Sabit tutarlı formda adet artırma/azaltma düğmelerini gösterir.', 'woo-donation-popup'));
		self::checkbox('enable_cover_fee', $values['enable_cover_fee'], __('İşlem ücretini karşıla', 'woo-donation-popup'), __('Bağışçıya ödeme işlem maliyetini de üstlenme seçeneği sunar.', 'woo-donation-popup'));
		self::number('cover_fee_percent', $values['cover_fee_percent'], __('İşlem ücreti (%)', 'woo-donation-popup'), __('Bağış tutarına eklenecek yüzde (en fazla 15).', 'woo-donation-popup'), array('max' => '15', 'step' => '0.1'));
		self::close_section();
	}

	/**
	 * @param array $values Values.
	 * @return void
	 */
	private static function render_form_fields_section(array $values) {
		self::open_section('fields', __('Form alanları', 'woo-donation-popup'), __('E-posta, ithaf, anonim bağış ve not', 'woo-donation-popup'));
		self::select('enable_email', $values['enable_email'], __('E-posta alanı', 'woo-donation-popup'), __('Bağışçıdan e-posta adresi ister; "Genel ayar" Tasarım sekmesindeki seçimi uygular.', 'woo-donation-popup'), self::tristate_options());
		self::select('enable_dedication', $values['enable_dedication'], __('İthaf alanı', 'woo-donation-popup'), __('Bağışın kimin adına yapıldığını yazmak için alan gösterir.', 'woo-donation-popup'), self::tristate_options());
		self::text('dedication_placeholder', $values['dedication_placeholder'], __('İthaf örnek metni', 'woo-donation-popup'), __('İthaf alanı boşken içinde görünen örnek metin.', 'woo-donation-popup'), array('custom_attributes' => array('maxlength' => '120')));
		self::select('enable_anonymous', $values['enable_anonymous'], __('Anonim bağış', 'woo-donation-popup'), __('Bağışçının adının gizli kalmasını seçebileceği kutucuk gösterir.', 'woo-donation-popup'), self::tristate_options());
		self::checkbox('enable_product_note', $values['enable_product_note'], __('Ürün notu', 'woo-donation-popup'), __('Formun üstünde aşağıdaki bilgilendirme notunu gösterir.', 'woo-donation-popup'));
		self::textarea('product_note_text', $values['product_note_text'], __('Not metni', 'woo-donation-popup'), __('Bağışçıya gösterilecek kısa bilgi (en fazla 400 karakter).', 'woo-donation-popup'), array('maxlength' => '400', 'placeholder' => __('Örn: 24 saat içinde video ulaştırılmaktadır.', 'woo-donation-popup')));
		self::checkbox('enable_wizard', $values['enable_wizard'], __('Çok adımlı form', 'woo-donation-popup'), __('Formu bağışçı bilgisi ve tutar olarak adım adım gösterir.', 'woo-donation-popup'));
		self::checkbox('enable_field_icons', $values['enable_field_icons'], __('Alan ikonları', 'woo-donation-popup'), __('Ad, telefon ve e-posta alanlarının başında ikon gösterir.', 'woo-donation-popup'));
		self::close_section();
	}

	/**
	 * @param int   $product_id Product ID.
	 * @param array $values     Values.
	 * @return void
	 */
	private static function render_campaign_blocks_section($product_id, array $values) {
		self::open_section('campaign', __('Kampanya blokları', 'woo-donation-popup'), __('Etki satırı, aciliyet, sosyal kanıt, güven rozetleri ve sıralama', 'woo-donation-popup'));

		self::checkbox('enable_impact_line', $values['enable_impact_line'], __('Etki satırı', 'woo-donation-popup'), __('Başlığın altında bağışın etkisini anlatan kısa bir cümle gösterir.', 'woo-donation-popup'));
		self::text('impact_line_text', $values['impact_line_text'], __('Etki metni', 'woo-donation-popup'), __('Boş bırakırsanız genel etki metni kullanılır.', 'woo-donation-popup'), array('placeholder' => __('Örn: Bir bağışınız bir aileyi ısıtır.', 'woo-donation-popup'), 'custom_attributes' => array('maxlength' => '160')));

		self::checkbox('enable_urgency', $values['enable_urgency'], __('Aciliyet şeridi', 'woo-donation-popup'), __('Kampanyanın süreli olduğunu vurgulayan bir şerit gösterir.', 'woo-donation-popup'));
		self::text('urgency_text', $values['urgency_text'], __('Aciliyet metni', 'woo-donation-popup'), __('Şeritte görünecek metin.', 'woo-donation-popup'), array('custom_attributes' => array('maxlength' => '140')));
		self::text('urgency_ends_at', $values['urgency_ends_at'], __('Bitiş tarihi', 'woo-donation-popup'), __('Bu tarihten sonra şerit otomatik gizlenir (YYYY-AA-GG); boş bırakılabilir.', 'woo-donation-popup'), array('placeholder' => 'YYYY-MM-DD'));

		self::checkbox('enable_social_proof', $values['enable_social_proof'], __('Sosyal kanıt', 'woo-donation-popup'), __('Kaç kişinin bağış yaptığını anlatan bir satır gösterir.', 'woo-donation-popup'));
		self::text('social_proof_text', $values['social_proof_text'], __('Sosyal kanıt metni', 'woo-donation-popup'), __('Satırda görünecek metin.', 'woo-donation-popup'), array('placeholder' => __('Bugün 128 kişi bağış yaptı', 'woo-donation-popup')));

		self::checkbox('enable_trust_strip', $values['enable_trust_strip'], __('Güven rozetleri', 'woo-donation-popup'), __('Formun altında güvenli ödeme gibi kısa güven mesajları gösterir.', 'woo-donation-popup'));
		self::render_repeater(
			'trust_badges',
			__('Rozetler', 'woo-donation-popup'),
			/* translators: %d: max rows */
			sprintf(__('Boş bırakırsanız genel rozetler kullanılır (en fazla %d).', 'woo-donation-popup'), self::MAX_TRUST_ROWS),
			$values['trust_rows'],
			self::MAX_TRUST_ROWS,
			array(
				'icon' => array('label' => __('İkon', 'woo-donation-popup'), 'type' => 'icon'),
				'text' => array('label' => __('Metin', 'woo-donation-popup'), 'type' => 'text'),
			)
		);

		self::render_module_order($product_id, $values['module_order_custom']);

		self::close_section();
	}

	/**
	 * @param array $values Values.
	 * @return void
	 */
	private static function render_sadaka_section(array $values) {
		$default_wc_id = WDP_Utils::get_default_sadaka_wc_product_id();
		$default_label = class_exists('WDP_Templates') ? WDP_Templates::get_default_sadaka_donation_message() : '';
		$currency      = get_woocommerce_currency_symbol();

		self::open_section('sadaka', __('Alt bağış (sadaka)', 'woo-donation-popup'), __('Forma eklenen ikinci, küçük bağış satırı', 'woo-donation-popup'));
		self::open_type_scope(array(WDP_Donation_Type::CAMPAIGN), $values['donation_type']);
		echo '<p class="wdp-pp-note">' . esc_html__('Hedefli kampanyada alt bağış formda gösterilmez; ayarlar diğer tiplere geçerseniz kullanılır.', 'woo-donation-popup') . '</p>';
		echo '</div>';
		self::checkbox('enable_sadaka_donation', $values['enable_sadaka_donation'], __('Alt bağış ekle', 'woo-donation-popup'), __('Bağışçının ana bağışa ek olarak küçük bir bağış eklemesine izin verir.', 'woo-donation-popup'));
		self::text('sadaka_toggle_label', $values['sadaka_toggle_label'], __('Düğme metni', 'woo-donation-popup'), __('Alt bağışı açan düğmenin metni.', 'woo-donation-popup'), array('placeholder' => __('Alt Bağış Ekle', 'woo-donation-popup'), 'custom_attributes' => array('maxlength' => '80')));
		self::number('sadaka_wc_product_id', $values['sadaka_wc_product_id'], __('Alt bağış ürün ID', 'woo-donation-popup'), __('Sepete eklenecek WooCommerce ürünü; boşsa genel varsayılan kullanılır, o da yoksa satır eklenmez.', 'woo-donation-popup'), array('min' => '1', 'step' => '1', 'placeholder' => $default_wc_id ? (string) $default_wc_id : ''));
		/* translators: %s: currency symbol */
		self::number('sadaka_min_price', $values['sadaka_min_price'], sprintf(__('En düşük tutar (%s)', 'woo-donation-popup'), $currency), __('Bağışçı tutarı kendisi yazarken uygulanacak alt sınır.', 'woo-donation-popup'), array('step' => '1'));
		/* translators: %s: currency symbol */
		self::number('sadaka_fixed_price', $values['sadaka_fixed_price'], sprintf(__('Sabit tutar (%s)', 'woo-donation-popup'), $currency), __('Doluysa alt bağış bu tutarla eklenir ve en düşük tutar yok sayılır.', 'woo-donation-popup'), array('step' => '1', 'placeholder' => '0'));
		self::textarea('sadaka_donation_message', $values['sadaka_donation_message'], __('Alt bağış notu', 'woo-donation-popup'), __('Alt bağış satırının yanında görünen açıklama.', 'woo-donation-popup'), array('maxlength' => '300', 'placeholder' => $default_label));
		self::close_section();
	}

	/**
	 * @param array $values Values.
	 * @return void
	 */
	private static function render_appearance_section(array $values) {
		self::open_section('appearance', __('Bu ürüne özel görünüm', 'woo-donation-popup'), __('Yalnızca anlamlı geçersiz kılmalar: ana renk, köşe, düzen, kampanya medyası. Boş bırakılanlar genel Görünüm ayarını kullanır.', 'woo-donation-popup'));
		self::select(
			'layout_mode',
			$values['layout_mode'],
			__('Düzen', 'woo-donation-popup'),
			__('Formun genel yerleşimi; "Hikâye" görseli ve formu yan yana gösterir.', 'woo-donation-popup'),
			array(
				'classic'  => __('Klasik (genel ayar)', 'woo-donation-popup'),
				'campaign' => __('Kampanya', 'woo-donation-popup'),
				'story'    => __('Hikâye (yan yana)', 'woo-donation-popup'),
			)
		);
		self::checkbox('enable_campaign_media', $values['enable_campaign_media'], __('Kampanya medyası', 'woo-donation-popup'), __('Ürünün öne çıkan görselini formda 16:9 kampanya medyası olarak gösterir.', 'woo-donation-popup'));
		self::checkbox('theme_inherit_category_color', $values['theme_inherit_category_color'], __('Kategori rengini kullan', 'woo-donation-popup'), __('Ana rengi Görünüm → kategori renklerinden alır (işaretliyse aşağıdaki renk yerine geçer).', 'woo-donation-popup'));
		$color_extra = array(
			'class'             => 'short wdp-color-field',
			'custom_attributes' => array('maxlength' => '7', 'pattern' => '#?[0-9A-Fa-f]{3,6}'),
		);
		self::text('theme_primary', $values['theme_primary'], __('Ana renk', 'woo-donation-popup'), __('Boş = genel ayar. Hover/active otomatik hesaplanır.', 'woo-donation-popup'), $color_extra + array('placeholder' => __('Genel ayar', 'woo-donation-popup')));
		self::number('theme_radius', $values['theme_radius'], __('Köşe yuvarlaklığı (px)', 'woo-donation-popup'), __('0–24; boş = genel ayar.', 'woo-donation-popup'), array('max' => '24', 'step' => '1', 'placeholder' => __('Genel ayar', 'woo-donation-popup')));
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
	private static function render_repeater($key, $label, $description, array $rows, $max, array $columns) {
		$desc_id = self::id($key) . '_desc';

		echo '<div class="form-field wdp-pp-field wdp-pp-field--wide">';
		echo '<span class="wdp-pp-field__label" id="' . esc_attr(self::id($key) . '_label') . '">' . esc_html($label) . '</span>';
		echo '<div class="wdp-pp-field__control wdp-repeater" data-wdp-repeater data-max="' . esc_attr((string) $max) . '" data-next-index="' . esc_attr((string) count($rows)) . '" role="group" aria-labelledby="' . esc_attr(self::id($key) . '_label') . '" aria-describedby="' . esc_attr($desc_id) . '">';
		echo '<ol class="wdp-repeater__rows" data-wdp-repeater-rows>';
		foreach (array_values($rows) as $index => $row) {
			self::render_repeater_row($key, (string) $index, $row, $columns);
		}
		echo '</ol>';
		echo '<template data-wdp-repeater-template>';
		self::render_repeater_row($key, '__INDEX__', array(), $columns);
		echo '</template>';
		echo '<button type="button" class="button wdp-repeater__add" data-wdp-repeater-add' . (count($rows) >= $max ? ' disabled' : '') . '>';
		echo '<span class="dashicons dashicons-plus-alt2" aria-hidden="true"></span> ' . esc_html__('Satır ekle', 'woo-donation-popup');
		echo '</button>';
		echo '<span class="description" id="' . esc_attr($desc_id) . '">' . esc_html($description) . '</span>';
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
	private static function render_repeater_row($key, $index, array $row, array $columns) {
		echo '<li class="wdp-repeater__row" data-wdp-repeater-row>';
		echo '<div class="wdp-repeater__cells">';
		foreach ($columns as $col => $def) {
			$input_id = self::id($key) . '_' . $index . '_' . $col;
			$name     = self::FIELD_NAME . '[' . $key . '][' . $index . '][' . $col . ']';
			$value    = isset($row[ $col ]) ? (string) $row[ $col ] : '';

			echo '<div class="wdp-repeater__cell wdp-repeater__cell--' . esc_attr($def['type']) . '">';
			echo '<label class="wdp-repeater__label" for="' . esc_attr($input_id) . '">' . esc_html($def['label']) . '</label>';
			if ($def['type'] === 'textarea') {
				echo '<textarea id="' . esc_attr($input_id) . '" name="' . esc_attr($name) . '" rows="2">' . esc_textarea($value) . '</textarea>';
			} elseif ($def['type'] === 'icon') {
				self::render_icon_select($input_id, $name, $value);
			} else {
				echo '<input type="text" id="' . esc_attr($input_id) . '" name="' . esc_attr($name) . '" value="' . esc_attr($value) . '" />';
			}
			echo '</div>';
		}
		echo '</div>';
		echo '<button type="button" class="wdp-icon-button wdp-repeater__remove" data-wdp-repeater-remove aria-label="' . esc_attr__('Satırı sil', 'woo-donation-popup') . '" title="' . esc_attr__('Satırı sil', 'woo-donation-popup') . '">';
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
	private static function render_icon_select($id, $name, $value) {
		$value = $value !== '' ? $value : 'builtin:shield';
		echo '<select id="' . esc_attr($id) . '" name="' . esc_attr($name) . '">';
		if (strpos($value, 'attachment:') === 0) {
			/* translators: %d: attachment ID */
			echo '<option value="' . esc_attr($value) . '" selected>' . esc_html(sprintf(__('Yüklenen görsel (#%d)', 'woo-donation-popup'), absint(substr($value, 11)))) . '</option>';
		}
		foreach (WDP_Icon_Library::get_builtins_for_admin() as $icon) {
			$icon_value = 'builtin:' . $icon['id'];
			echo '<option value="' . esc_attr($icon_value) . '"' . selected($value, $icon_value, false) . '>' . esc_html($icon['label']) . '</option>';
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
	private static function render_module_order($product_id, $is_custom) {
		$defaults = WDP_Form_Modules::defaults();
		$labels   = isset($defaults['labels']) && is_array($defaults['labels']) ? $defaults['labels'] : array();
		$order    = array_values(array_intersect(WDP_Form_Modules::resolve_order($product_id), self::HEADER_MODULES));

		echo '<div class="form-field wdp-pp-field wdp-pp-field--wide">';
		echo '<span class="wdp-pp-field__label">' . esc_html__('Blok sırası', 'woo-donation-popup') . '</span>';
		echo '<div class="wdp-pp-field__control">';
		echo '<label class="wdp-pp-inline-check"><input type="checkbox" name="' . esc_attr(self::name('module_order_custom')) . '" value="yes" data-wdp-order-toggle' . checked($is_custom, true, false) . ' /> ' . esc_html__('Bu ürüne özel sıra kullan', 'woo-donation-popup') . '</label>';
		echo '<fieldset class="wdp-order" data-wdp-order' . ($is_custom ? '' : ' disabled') . '>';
		echo '<legend class="screen-reader-text">' . esc_html__('Kampanya bloklarının sırası', 'woo-donation-popup') . '</legend>';
		echo '<ol class="wdp-order__list" data-wdp-order-list>';
		foreach ($order as $module_id) {
			$label = isset($labels[ $module_id ]) ? $labels[ $module_id ] : $module_id;
			echo '<li class="wdp-order__item" data-wdp-order-item>';
			echo '<span class="wdp-order__label">' . esc_html($label) . '</span>';
			echo '<input type="hidden" name="' . esc_attr(self::FIELD_NAME . '[module_order][]') . '" value="' . esc_attr($module_id) . '" />';
			/* translators: %s: block name */
			echo '<button type="button" class="wdp-icon-button" data-wdp-order-move="up" aria-label="' . esc_attr(sprintf(__('%s bloğunu yukarı taşı', 'woo-donation-popup'), $label)) . '"><span class="dashicons dashicons-arrow-up-alt2" aria-hidden="true"></span></button>';
			/* translators: %s: block name */
			echo '<button type="button" class="wdp-icon-button" data-wdp-order-move="down" aria-label="' . esc_attr(sprintf(__('%s bloğunu aşağı taşı', 'woo-donation-popup'), $label)) . '"><span class="dashicons dashicons-arrow-down-alt2" aria-hidden="true"></span></button>';
			echo '</li>';
		}
		echo '</ol>';
		echo '</fieldset>';
		echo '<span class="description">' . esc_html__('Başlık altındaki blokların sırası; kapalıysa Tasarım sekmesindeki genel sıra kullanılır. Bağışçı ve tutar alanlarının sırası sabittir.', 'woo-donation-popup') . '</span>';
		echo '</div>';
		echo '</div>';
	}

	/**
	 * Shortcode picker + copy.
	 *
	 * @param int $product_id Product ID.
	 * @return void
	 */
	private static function render_shortcode_block($product_id) {
		$shortcodes = self::get_shortcodes($product_id);

		echo '<div class="wdp-pp-block wdp-pp-shortcode">';
		echo '<p class="wdp-pp-heading">' . esc_html__('Kısa kod', 'woo-donation-popup') . '</p>';
		echo '<p class="wdp-pp-lead">' . esc_html__('Görünümü seçin, kısa kodu kopyalayıp sayfa veya yazıya yapıştırın.', 'woo-donation-popup') . '</p>';
		echo '<div class="wdp-pp-shortcode__row">';
		echo '<label class="wdp-pp-shortcode__label" for="wdp-shortcode-view">' . esc_html__('Görünüm', 'woo-donation-popup') . '</label>';
		echo '<select id="wdp-shortcode-view" data-wdp-shortcode-select aria-controls="wdp-shortcode-output">';
		foreach ($shortcodes as $shortcode) {
			echo '<option value="' . esc_attr($shortcode['code']) . '">' . esc_html($shortcode['label']) . '</option>';
		}
		echo '</select>';
		echo '<input type="text" id="wdp-shortcode-output" class="code wdp-pp-shortcode__code" value="' . esc_attr($shortcodes[0]['code']) . '" readonly aria-label="' . esc_attr__('Kısa kod', 'woo-donation-popup') . '" data-wdp-shortcode-output />';
		echo '<button type="button" class="button" data-wdp-copy-target="#wdp-shortcode-output">' . esc_html__('Kopyala', 'woo-donation-popup') . '</button>';
		echo '</div>';
		echo '</div>';
	}

	/**
	 * @param int $product_id Product ID.
	 * @return array<int, array{label:string, code:string}>
	 */
	public static function get_shortcodes($product_id) {
		$product_id = absint($product_id);
		$slug = '';
		$product = function_exists('wc_get_product') ? wc_get_product($product_id) : null;
		if ($product && method_exists($product, 'get_slug')) {
			$slug = (string) $product->get_slug();
		}

		$list = array(
			array('label' => __('Buton (ortada açılır)', 'woo-donation-popup'), 'code' => '[wdp_donation_button id="' . $product_id . '"]'),
			array('label' => __('Sağ panel', 'woo-donation-popup'), 'code' => '[wdp_donation_button_panel id="' . $product_id . '"]'),
			array('label' => __('Sayfa içi form', 'woo-donation-popup'), 'code' => '[wdp_donation_form id="' . $product_id . '"]'),
			array('label' => __('Kimliksiz (ürün sayfasında otomatik)', 'woo-donation-popup'), 'code' => '[wdp_donation_form]'),
			array('label' => __('Kimliksiz sağ panel', 'woo-donation-popup'), 'code' => '[wdp_donation_button_panel]'),
		);
		if ($slug !== '') {
			$list[] = array(
				'label' => __('Slug ile form', 'woo-donation-popup'),
				'code'  => '[wdp_donation_form slug="' . $slug . '"]',
			);
		}
		return $list;
	}
}

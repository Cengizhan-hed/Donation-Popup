<?php
/**
 * Modal / inline form kabuğu, CTA butonları ve güven şeridi.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Modal_Shell_Renderer
 */
class WDP_Modal_Shell_Renderer {

	/**
	 * Hisseli formlar: toplam tutar çubuğu (butonların üstü).
	 *
	 * @return string Safe HTML.
	 */
	public static function render_shares_total_bar() {
		ob_start();
		?>
		<div class="wdp-shares-total-bar" aria-live="polite" hidden>
			<span class="wdp-shares-total-bar__label"><?php echo esc_html__('Toplam Tutar', 'woo-donation-popup'); ?></span>
			<span class="wdp-shares-total-bar__value">—</span>
		</div>
		<?php
		return trim(ob_get_clean());
	}

	/**
	 * Form altı güven satırı (SSL / güvenli ödeme).
	 *
	 * @return string Safe HTML.
	 */
	public static function render_trust_strip() {
		$button_settings = get_option('wdp_button_settings', array());
		if (is_array($button_settings) && isset($button_settings['trust_strip_enabled']) && '1' !== (string) $button_settings['trust_strip_enabled']) {
			return '';
		}

		$product_id = 0;
		if (isset($GLOBALS['wdp_current_donation_product_id'])) {
			$product_id = absint($GLOBALS['wdp_current_donation_product_id']);
		}
		if ($product_id > 0) {
			$flag = get_post_meta($product_id, '_enable_trust_strip', true);
			if ($flag === 'no') {
				return '';
			}
		}

		$badges = class_exists('WDP_Form_Modules')
			? WDP_Form_Modules::resolve_trust_badges($product_id)
			: array();
		if (empty($badges)) {
			return '';
		}

		$multi = count($badges) > 1;
		ob_start();
		?>
		<div class="wdp-trust-strip<?php echo $multi ? ' wdp-trust-strip--multi' : ''; ?>" role="note">
			<?php foreach ($badges as $badge) : ?>
				<?php
				$icon = class_exists('WDP_Icon_Library')
					? WDP_Icon_Library::resolve(isset($badge['icon']) ? (string) $badge['icon'] : 'builtin:shield', 'shield')
					: '';
				$text = isset($badge['text']) ? trim((string) $badge['text']) : '';
				if ($text === '') {
					continue;
				}
				?>
				<span class="wdp-trust-badge">
					<?php if ($icon !== '') : ?>
					<span class="wdp-trust-badge__icon" aria-hidden="true"><?php echo $icon; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></span>
					<?php endif; ?>
					<span class="wdp-trust-badge__text"><?php echo esc_html($text); ?></span>
				</span>
			<?php endforeach; ?>
		</div>
		<?php
		return trim(ob_get_clean());
	}

	/**
	 * Form altı aksiyon butonu (ikon + metin).
	 *
	 * @param string $name  donation_add_to_cart | donation_go_checkout.
	 * @param string $class wdp-btn-primary | wdp-btn-secondary.
	 * @param string $label Visible label.
	 * @return string Safe HTML.
	 */
	public static function render_form_action_button($name, $class, $label, $disabled = false) {
		$icon = $name === 'donation_go_checkout'
			? WDP_Svg_Icons::get_form_button_icon_checkout_svg()
			: WDP_Svg_Icons::get_form_button_icon_cart_svg();

		if ($disabled) {
			$extra = ' disabled aria-disabled="true" class="' . esc_attr($class . ' is-disabled') . '"';
			return sprintf(
				'<button type="submit"%1$s name="%2$s"><span class="wdp-btn__inner">%3$s<span class="wdp-btn__label">%4$s</span></span></button>',
				$extra,
				esc_attr($name),
				$icon,
				esc_html($label)
			);
		}

		// Native disabled: form POST yok. Kaplama erken dokunuşu yakalar (disabled tık yutmaz).
		$extra = ' disabled aria-disabled="true" data-wdp-await-js="1" class="' . esc_attr($class . ' wdp-cta-await-js wdp-loading') . '"';
		$btn   = sprintf(
			'<button type="submit"%1$s name="%2$s"><span class="wdp-btn__inner">%3$s<span class="wdp-btn__label">%4$s</span></span></button>',
			$extra,
			esc_attr($name),
			$icon,
			esc_html($label)
		);
		return '<span class="wdp-cta-gate">' . $btn . '<span class="wdp-cta-gate__hit" aria-hidden="true"></span></span>';
	}

	/**
	 * Sepete ekle + ödemeye git buton grubu.
	 *
	 * @param bool   $checkout_first     Checkout button first.
	 * @param string $text_add_to_cart   Add to cart label.
	 * @param string $text_go_checkout   Checkout label.
	 * @param bool   $disabled           Goal closed.
	 * @return void
	 */
	public static function render_form_action_buttons($checkout_first, $text_add_to_cart, $text_go_checkout, $disabled = false) {
		if ($checkout_first) {
			echo self::render_form_action_button('donation_go_checkout', 'wdp-btn-primary', $text_go_checkout, $disabled);
			echo self::render_form_action_button('donation_add_to_cart', 'wdp-btn-secondary', $text_add_to_cart, $disabled);
			return;
		}

		echo self::render_form_action_button('donation_add_to_cart', 'wdp-btn-secondary', $text_add_to_cart, $disabled);
		echo self::render_form_action_button('donation_go_checkout', 'wdp-btn-primary', $text_go_checkout, $disabled);
	}

	/**
	 * Form footer: shares total bar, CTA buttons, hidden fields.
	 *
	 * @param array $args Footer options.
	 * @return string
	 */
	public static function render_donation_form_actions(array $args) {
		$product_id            = isset($args['product_id']) ? absint($args['product_id']) : 0;
		$allow_multiple_shares = !empty($args['allow_multiple_shares']);
		$use_side_panel        = !empty($args['use_side_panel']);
		$checkout_first        = !empty($args['checkout_first']);

		$button_settings         = WDP_Utils::normalize_legacy_popup_button_text(
			get_option('wdp_button_settings', array())
		);
		$button_text_add_to_cart = !empty($button_settings['button_text_add_to_cart']) ? $button_settings['button_text_add_to_cart'] : __('Sepete Ekle', 'woo-donation-popup');
		$button_text_go_checkout = !empty($button_settings['button_text_go_checkout']) ? $button_settings['button_text_go_checkout'] : __('Ödemeye Git', 'woo-donation-popup');
		$form_button_alignment   = !empty($button_settings['form_button_alignment']) ? $button_settings['form_button_alignment'] : 'left';
		$button_group_classes    = 'wdp-button-group wdp-button-align-' . esc_attr($form_button_alignment);
		if ($use_side_panel) {
			$button_group_classes .= ' wdp-side-panel-form-footer';
		}
		$goal_closed = ($product_id > 0 && class_exists('WDP_Campaign_Goal'))
			? WDP_Campaign_Goal::should_block_new_donations($product_id)
			: false;

		ob_start();
		echo '<div class="' . ($use_side_panel ? 'wdp-side-panel-footer-zone' : 'wdp-form-cta-zone') . '">';
		if ($allow_multiple_shares) {
			echo self::render_shares_total_bar();
		}
		?>
		<div class="<?php echo $button_group_classes; ?>">
			<?php self::render_form_action_buttons($checkout_first, $button_text_add_to_cart, $button_text_go_checkout, $goal_closed); ?>
		</div>
		<?php
		echo self::render_trust_strip();
		echo '</div>';
		?>
		<input type="hidden" name="wdp_product_id" value="<?php echo esc_attr($product_id); ?>">
		<input type="hidden" name="donation_modal" value="1">
		<?php wp_nonce_field('wdp_nonajax_add_to_cart', 'wdp_nonce'); ?>
		<?php
		return trim(ob_get_clean());
	}

	/**
	 * Admin-only notice for an unknown product ID.
	 *
	 * @param int $product_id Product ID.
	 * @return string
	 */
	public static function product_missing_notice($product_id) {
		/* translators: %d: product ID */
		return WDP_Utils::admin_notice_html(sprintf(__('Bağış formu: #%d numaralı ürün bulunamadı. Kısa koddaki ürün ID\'sini kontrol edin.', 'woo-donation-popup'), absint($product_id)));
	}

	/**
	 * Admin-only notice when the product cannot take donations as configured; null when it can.
	 *
	 * Fixed-amount and share forms charge the product price, so they need a price above zero.
	 *
	 * @param WC_Product $product Product.
	 * @return string|null
	 */
	public static function unavailable_notice($product) {
		$type = WDP_Donation_Type::infer_from_meta(
			array(
				'_allow_custom_price'    => $product->get_meta('_allow_custom_price'),
				'_allow_multiple_shares' => $product->get_meta('_allow_multiple_shares'),
				'_enable_progress_bar'   => $product->get_meta('_enable_progress_bar'),
			)
		);
		if (!in_array($type, array(WDP_Donation_Type::FIXED, WDP_Donation_Type::SHARES), true)) {
			return null;
		}
		$price = $product->get_price();
		if (is_numeric($price) && (float) $price > 0) {
			return null;
		}
		/* translators: %d: product ID */
		return WDP_Utils::admin_notice_html(sprintf(__('Bu ürünün fiyatı yok; bağış formu gösterilmiyor (ürün #%d). Fiyatı ürünün "Genel" sekmesinden girin veya bağış tipini "Bağışçı belirler" yapın.', 'woo-donation-popup'), (int) $product->get_id()));
	}

	/**
	 * Multibyte-safe string length.
	 *
	 * @param string $value Text value.
	 * @return int
	 */
	private static function text_length($value) {
		if (function_exists('mb_strlen')) {
			return mb_strlen($value);
		}
		return strlen($value);
	}

	/**
	 * Render donation modal
	 *
	 * @param int    $product_id   Product ID.
	 * @param string $button_text  Button text.
	 * @param string $custom_class Custom CSS class.
	 * @param string $custom_style Custom CSS style.
	 * @param string $display_mode popup|side_panel.
	 * @return string
	 */
	public static function render_donation_modal($product_id, $button_text = '', $custom_class = '', $custom_style = '', $display_mode = 'popup') {
		$product_id = absint($product_id);

		$product = WDP_Donation_Product_Context_Service::get_product($product_id);
		if (!$product) {
			return self::product_missing_notice($product_id);
		}
		$unavailable = self::unavailable_notice($product);
		if ($unavailable !== null) {
			return $unavailable;
		}

		if (empty($button_text)) {
			$button_settings = WDP_Utils::normalize_legacy_popup_button_text(
				get_option('wdp_button_settings', array())
			);
			$button_text = isset($button_settings['popup_button_text']) ? $button_settings['popup_button_text'] : __('Bağış Yap', 'woo-donation-popup');
		}

		$context            = WDP_Donation_Product_Context_Service::build_form_context($product);
		$product_name       = $context['product_name'];
		$product_price      = $context['product_price'];
		$enable_product_note = $context['enable_product_note'];
		$product_note_text  = $context['product_note_text'];
		$show_product_note  = $enable_product_note && $product_note_text !== '';
		$is_long_note       = self::text_length($product_note_text) > 110;
		$modal_note_toggle_id = 'wdp-note-toggle-' . $product_id . '-modal';

		$use_side_panel   = ($display_mode === 'side_panel');
		$modal_id         = $use_side_panel ? ('wdp-side-panel-' . $product_id) : ('wdp-modal-' . $product_id);
		$modal_mode_class = $use_side_panel ? ' wdp-side-panel' : '';
		$allow_custom_price = $context['allow_custom_price'];
		$min_price          = $context['min_price'];
		$allow_multiple_shares = $context['allow_multiple_shares'];
		$max_shares            = $context['max_shares'];
		$enable_progress_bar   = $context['enable_progress_bar'];
		$progress_bar_limit    = $context['progress_bar_limit'];
		$progress_min_price    = $context['progress_min_price'];
		$total_donation        = $context['total_donation'];
		$enable_sadaka_donation = $context['enable_sadaka_donation'];
		$sadaka_context         = WDP_Form_Fields_Renderer::build_sadaka_context($context);
		$sadaka_wc_ready        = class_exists('WDP_Utils')
			? WDP_Utils::resolve_sadaka_wc_product_id($product_id) > 0
			: !empty($context['sadaka_wc_product_id']);
		$show_sadaka_ui         = $enable_sadaka_donation && !$enable_progress_bar && $sadaka_wc_ready;
		$title_style_attr       = class_exists('WDP_Category_Title_Color_Service')
			? WDP_Category_Title_Color_Service::get_title_style_attr($product_id)
			: '';

		WDP_Assets::force_enqueue();

		$button_settings   = WDP_Utils::normalize_legacy_popup_button_text(
			get_option('wdp_button_settings', array())
		);
		$form_button_order = !empty($button_settings['form_button_order']) ? $button_settings['form_button_order'] : 'add_first';
		$checkout_first    = $use_side_panel || $form_button_order === 'checkout_first';

		$form_field_classes = $allow_multiple_shares ? 'wdp-donation-form-fields wdp-has-shareholders' : ($enable_progress_bar ? 'wdp-donation-form-fields wdp-has-progress-bar' : 'wdp-donation-form-fields');
		// 10.30.0: ürün üçlü (genel/açık/kapalı) CTX'te çözülür; genel bayrak doğrudan okunmaz.
		$enable_multi_step = !empty($context['enable_wizard']);
		if ($enable_multi_step) {
			$form_field_classes .= ' wdp-multi-step';
		}
		if (isset($context['enable_field_icons']) && empty($context['enable_field_icons'])) {
			$form_field_classes .= ' wdp-no-field-icons';
		}
		if (isset($context['enable_quantity']) && empty($context['enable_quantity'])) {
			$form_field_classes .= ' wdp-no-quantity';
		}
		$GLOBALS['wdp_current_donation_product_id'] = $product_id;
		if ($use_side_panel) {
			$form_field_classes .= ' wdp-side-panel-form';
		}
		$side_panel_main_class = 'wdp-side-panel-main';
		if ($allow_multiple_shares) {
			$side_panel_main_class .= ' wdp-side-panel-main--shares';
		}

		$shell            = WDP_Campaign_Header_Renderer::resolve_shell_attrs($product_id, $context);
		$theme_style_attr = $shell['style'] !== '' ? ' style="' . esc_attr($shell['style']) . '"' : '';
		$layout_class     = $shell['class'];
		$is_story         = ($shell['layout'] === 'story');

		$progress_html = '';
		if ($enable_progress_bar) {
			$progress_html = WDP_Progress_Form::render_progress_bar($product_id, $progress_bar_limit, $total_donation, true, $progress_min_price);
		}
		$note_html = '';
		if ($show_product_note) {
			$note_html = WDP_Campaign_Header_Renderer::render_product_note_block(
				WDP_Campaign_Header_Renderer::resolve_product_note_display($context),
				$modal_note_toggle_id,
				$is_long_note
			);
		}
		$title_inner    = WDP_Campaign_Header_Renderer::render_modal_product_thumb($product_id)
			. '<span id="' . esc_attr($modal_id) . '-title" class="wdp-modal-title"' . $title_style_attr . '>' . wp_kses_post($product_name) . '</span>';
		$header_modules = WDP_Campaign_Header_Renderer::render_header_modules(
			$product_id,
			$context,
			array(
				'title_html'    => $title_inner,
				'note_html'     => $note_html,
				'progress_html' => '',
			)
		);

		ob_start();
		?>
		<!-- Modal -->
		<div id="<?php echo esc_attr($modal_id); ?>" class="hdf-donation-modal-wrapper wdp-modal<?php echo esc_attr($modal_mode_class); ?><?php echo esc_attr($layout_class); ?><?php echo $custom_class !== '' ? ' ' . esc_attr($custom_class) : ''; ?>" role="dialog" aria-modal="true" aria-labelledby="<?php echo esc_attr($modal_id); ?>-title" aria-describedby="<?php echo esc_attr($modal_id); ?>-description" data-product-id="<?php echo esc_attr($product_id); ?>" data-wdp-unit-price="<?php echo esc_attr($product_price !== '' ? $product_price : ''); ?>" data-wdp-enable-sadaka="<?php echo $show_sadaka_ui ? '1' : '0'; ?>" data-wdp-progress-celebrate="<?php echo (!isset($context['progress_celebrate']) || !empty($context['progress_celebrate'])) ? '1' : '0'; ?>" data-wdp-layout="<?php echo esc_attr($shell['layout']); ?>"<?php echo $use_side_panel ? ' data-wdp-open-mode="side-panel"' : ''; ?><?php echo $theme_style_attr; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above ?> aria-hidden="true">
			<div class="wdp-modal-content<?php echo $use_side_panel ? ' wdp-side-panel-content' : ''; ?>">
				<button type="button" class="wdp-modal-close" aria-label="<?php echo esc_attr__('Modalı Kapat', 'woo-donation-popup'); ?>">&times;</button>
				<?php if ($is_story) : ?><div class="wdp-story-rail"><?php endif; ?>
				<div class="wdp-modal-header">
					<div class="wdp-modal-title-wrapper">
						<?php echo $header_modules; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- composed of escaped fragments ?>
					</div>
				</div>
				<?php if ($progress_html !== '') : ?>
				<?php echo $progress_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				<?php endif; ?>
				<?php if ($is_story) : ?></div><div class="wdp-story-form"><?php endif; ?>
				<div id="<?php echo esc_attr($modal_id); ?>-description" class="screen-reader-text"><?php echo esc_html(sprintf(__('%s için bağış formu', 'woo-donation-popup'), $product_name)); ?></div>

				<form method="post" action="" class="<?php echo esc_attr($form_field_classes); ?>" novalidate>
					<div class="wdp-form-error" style="display: none;"></div>

					<?php if ($use_side_panel) : ?>
					<div class="<?php echo esc_attr($side_panel_main_class); ?>">
					<?php endif; ?>

					<?php
					echo WDP_Form_Fields_Renderer::render_donation_form_fields_body(
						array(
							'allow_multiple_shares'    => $allow_multiple_shares,
							'max_shares'               => $max_shares,
							'enable_progress_bar'      => $enable_progress_bar,
							'progress_min_price'       => $progress_min_price,
							'allow_custom_price'       => $allow_custom_price,
							'min_price'                => $min_price,
							'product_price'            => $product_price,
							'custom_price_placeholder' => $context['custom_price_placeholder'],
							'currency_symbol'          => $context['currency_symbol'],
							'context'                  => $context,
							'product_id'               => $product_id,
						)
					);
					?>

					<?php if ($enable_sadaka_donation && !$enable_progress_bar) : ?>
					<?php echo WDP_Form_Fields_Renderer::render_sadaka_donation_block($sadaka_context); ?>
					<?php endif; ?>

					<?php if ($use_side_panel) : ?>
					</div>
					<?php endif; ?>

					<?php
					echo self::render_donation_form_actions(
						array(
							'product_id'            => $product_id,
							'allow_multiple_shares' => $allow_multiple_shares,
							'use_side_panel'        => $use_side_panel,
							'checkout_first'        => $checkout_first,
						)
					);
					?>
				</form>
				<?php if ($is_story) : ?></div><?php endif; ?>
			</div>
		</div>
		<?php
		return ob_get_clean();
	}

	/**
	 * Render donation form (direct, no modal)
	 *
	 * @param int   $product_id Product ID.
	 * @param array $atts       Shortcode attributes.
	 * @return string
	 */
	public static function render_donation_form($product_id, $atts = array()) {
		$product_id = absint($product_id);

		$defaults = array(
			'button_text' => __('Bağış Yap', 'woo-donation-popup'),
			'title'       => '',
			'show_title'  => 'yes',
			'class'       => '',
		);

		$atts = wp_parse_args($atts, $defaults);

		$product = WDP_Donation_Product_Context_Service::get_product($product_id);
		if (!$product) {
			return self::product_missing_notice($product_id);
		}
		$unavailable = self::unavailable_notice($product);
		if ($unavailable !== null) {
			return $unavailable;
		}

		$context             = WDP_Donation_Product_Context_Service::build_form_context($product);
		$product_name        = $context['product_name'];
		$product_price       = $context['product_price'];
		$enable_product_note = $context['enable_product_note'];
		$product_note_text   = $context['product_note_text'];
		$show_product_note   = $enable_product_note && $product_note_text !== '';
		$is_long_note        = self::text_length($product_note_text) > 110;
		$direct_note_toggle_id = 'wdp-note-toggle-' . $product_id . '-direct';

		$title      = !empty($atts['title']) ? sanitize_text_field($atts['title']) : $product_name;
		$show_title = ($atts['show_title'] === 'yes');

		$form_id      = 'wdp-modal-' . $product_id . '-direct';
		$custom_class = class_exists('WDP_Shortcodes')
			? WDP_Shortcodes::sanitize_class_list($atts['class'])
			: sanitize_html_class((string) $atts['class']);

		$allow_custom_price     = $context['allow_custom_price'];
		$min_price              = $context['min_price'];
		$allow_multiple_shares  = $context['allow_multiple_shares'];
		$max_shares             = $context['max_shares'];
		$enable_progress_bar    = $context['enable_progress_bar'];
		$progress_bar_limit     = $context['progress_bar_limit'];
		$progress_min_price     = $context['progress_min_price'];
		$total_donation         = $context['total_donation'];
		$enable_sadaka_donation = $context['enable_sadaka_donation'];
		$sadaka_context         = WDP_Form_Fields_Renderer::build_sadaka_context($context);
		$sadaka_wc_ready        = class_exists('WDP_Utils')
			? WDP_Utils::resolve_sadaka_wc_product_id($product_id) > 0
			: !empty($context['sadaka_wc_product_id']);
		$show_sadaka_ui         = $enable_sadaka_donation && !$enable_progress_bar && $sadaka_wc_ready;
		$title_style_attr       = class_exists('WDP_Category_Title_Color_Service')
			? WDP_Category_Title_Color_Service::get_title_style_attr($product_id)
			: '';

		$button_settings   = WDP_Utils::normalize_legacy_popup_button_text(
			get_option('wdp_button_settings', array())
		);
		$form_button_order = !empty($button_settings['form_button_order']) ? $button_settings['form_button_order'] : 'add_first';
		$checkout_first    = $form_button_order === 'checkout_first';
		$inline_form_classes = $allow_multiple_shares ? 'wdp-donation-form-fields wdp-has-shareholders' : ($enable_progress_bar ? 'wdp-donation-form-fields wdp-has-progress-bar' : 'wdp-donation-form-fields');
		// 10.30.0: ürün üçlü (genel/açık/kapalı) CTX'te çözülür; genel bayrak doğrudan okunmaz.
		$enable_multi_step = !empty($context['enable_wizard']);
		if ($enable_multi_step) {
			$inline_form_classes .= ' wdp-multi-step';
		}
		if (isset($context['enable_field_icons']) && empty($context['enable_field_icons'])) {
			$inline_form_classes .= ' wdp-no-field-icons';
		}
		if (isset($context['enable_quantity']) && empty($context['enable_quantity'])) {
			$inline_form_classes .= ' wdp-no-quantity';
		}
		$GLOBALS['wdp_current_donation_product_id'] = $product_id;

		$shell            = WDP_Campaign_Header_Renderer::resolve_shell_attrs($product_id, $context);
		$theme_style_attr = $shell['style'] !== '' ? ' style="' . esc_attr($shell['style']) . '"' : '';
		$layout_class     = $shell['class'];
		$is_story         = ($shell['layout'] === 'story');

		$progress_html = '';
		if ($enable_progress_bar) {
			$progress_html = WDP_Progress_Form::render_progress_bar($product_id, $progress_bar_limit, $total_donation, true, $progress_min_price);
		}
		$note_html = '';
		if ($show_product_note) {
			$note_html = WDP_Campaign_Header_Renderer::render_product_note_block(
				WDP_Campaign_Header_Renderer::resolve_product_note_display($context),
				$direct_note_toggle_id,
				$is_long_note
			);
		}
		$title_inner = '';
		if ($show_title) {
			$title_inner = WDP_Campaign_Header_Renderer::render_modal_product_thumb($product_id)
				. '<h2 class="wdp-form-title"' . $title_style_attr . '>' . wp_kses_post($title) . '</h2>';
		}
		$header_modules = WDP_Campaign_Header_Renderer::render_header_modules(
			$product_id,
			$context,
			array(
				'title_html'    => $title_inner,
				'note_html'     => $note_html,
				'progress_html' => '',
			)
		);

		ob_start();
		?>
		<div id="<?php echo esc_attr($form_id); ?>" class="hdf-donation-modal-wrapper wdp-donation-form<?php echo esc_attr($layout_class); ?> <?php echo esc_attr($custom_class); ?>" data-product-id="<?php echo esc_attr($product_id); ?>" data-wdp-display="inline" data-wdp-unit-price="<?php echo esc_attr($product_price !== '' ? $product_price : ''); ?>" data-wdp-enable-sadaka="<?php echo $show_sadaka_ui ? '1' : '0'; ?>" data-wdp-progress-celebrate="<?php echo (!isset($context['progress_celebrate']) || !empty($context['progress_celebrate'])) ? '1' : '0'; ?>" data-wdp-layout="<?php echo esc_attr($shell['layout']); ?>"<?php echo $theme_style_attr; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
			<div class="wdp-modal-content">
				<?php if ($is_story) : ?><div class="wdp-story-rail"><?php endif; ?>
				<?php if ($show_title || $header_modules !== '') : ?>
				<div class="wdp-form-title-wrapper">
					<?php echo $header_modules; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				</div>
				<?php endif; ?>
				<?php if ($progress_html !== '') : ?>
				<?php echo $progress_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				<?php endif; ?>
				<?php if ($is_story) : ?></div><div class="wdp-story-form"><?php endif; ?>

				<form method="post" action="" class="<?php echo esc_attr($inline_form_classes); ?>" novalidate>
					<div class="wdp-form-error" style="display: none;"></div>

					<?php
					echo WDP_Form_Fields_Renderer::render_donation_form_fields_body(
						array(
							'allow_multiple_shares'    => $allow_multiple_shares,
							'max_shares'               => $max_shares,
							'enable_progress_bar'      => $enable_progress_bar,
							'progress_min_price'       => $progress_min_price,
							'allow_custom_price'       => $allow_custom_price,
							'min_price'                => $min_price,
							'product_price'            => $product_price,
							'custom_price_placeholder' => $context['custom_price_placeholder'],
							'currency_symbol'          => $context['currency_symbol'],
							'context'                  => $context,
							'product_id'               => $product_id,
						)
					);
					?>

					<?php if ($enable_sadaka_donation && !$enable_progress_bar) : ?>
					<?php echo WDP_Form_Fields_Renderer::render_sadaka_donation_block($sadaka_context); ?>
					<?php endif; ?>

					<?php
					echo self::render_donation_form_actions(
						array(
							'product_id'            => $product_id,
							'allow_multiple_shares' => $allow_multiple_shares,
							'use_side_panel'        => false,
							'checkout_first'        => $checkout_first,
						)
					);
					?>
				</form>
				<?php if ($is_story) : ?></div><?php endif; ?>
			</div>
		</div>

		<?php
		return ob_get_clean();
	}
}

<?php
/**
 * Bağış formu alanları: bağışçı, ithaf, tutar, sadaka ve modül sırası.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Form_Fields_Renderer
 */
class WDP_Form_Fields_Renderer {

	/**
	 * Body module ids controlled by module_order (header/footer modules excluded).
	 *
	 * @var string[]
	 */
	const BODY_MODULE_IDS = array('donor', 'dedication', 'amount', 'cover_fee');

	/**
	 * Hızlı tutar chip listesi (min altına düşenler elenir).
	 *
	 * @param float|string $min_price  Minimum custom price.
	 * @param int          $product_id Product ID.
	 * @return array<int, float>
	 */
	public static function get_amount_presets($min_price = 0, $product_id = 0) {
		$min      = max(0, (float) $min_price);
		$defaults = array(100, 250, 500, 1000, 2500);
		$button_settings = get_option('wdp_button_settings', array());
		if (!empty($button_settings['amount_presets']) && is_string($button_settings['amount_presets'])) {
			$parts  = preg_split('/[\s,;]+/', $button_settings['amount_presets']);
			$parsed = array();
			if (is_array($parts)) {
				foreach ($parts as $part) {
					$n = (float) str_replace(',', '.', preg_replace('/[^\d.,]/', '', (string) $part));
					if ($n > 0) {
						$parsed[] = $n;
					}
				}
			}
			if (!empty($parsed)) {
				$defaults = $parsed;
			}
		}
		$product_id = absint($product_id);
		if ($product_id <= 0 && !empty($GLOBALS['wdp_current_donation_product_id'])) {
			$product_id = absint($GLOBALS['wdp_current_donation_product_id']);
		}
		if ($product_id > 0) {
			$product_csv = trim((string) get_post_meta($product_id, '_amount_presets', true));
			if ($product_csv !== '' && class_exists('WDP_Form_Modules')) {
				$product_parsed = WDP_Form_Modules::parse_amount_presets_csv($product_csv);
				if (!empty($product_parsed)) {
					$defaults = $product_parsed;
				}
			}
		}
		$presets = apply_filters('wdp_amount_presets', $defaults, $min, $product_id);
		if (!is_array($presets)) {
			$presets = $defaults;
		}

		$out = array();
		foreach ($presets as $value) {
			$n = (float) $value;
			if (!is_finite($n) || $n <= 0) {
				continue;
			}
			if ($min > 0 && $n + 0.0001 < $min) {
				continue;
			}
			$rounded = round($n, 2);
			if (!in_array($rounded, $out, true)) {
				$out[] = $rounded;
			}
		}

		if (empty($out) && $min > 0) {
			foreach (array(1, 2, 5, 10) as $mult) {
				$out[] = round($min * $mult, 2);
			}
		}

		return array_values(array_slice($out, 0, 6));
	}

	/**
	 * Hızlı tutar chip HTML'i.
	 *
	 * @param float|string $min_price       Minimum price.
	 * @param string       $currency_symbol Currency symbol.
	 * @param array        $options         show (bool), input_selector.
	 * @return string Safe HTML.
	 */
	public static function render_amount_presets($min_price = 0, $currency_symbol = '', array $options = array()) {
		$button_settings = get_option('wdp_button_settings', array());
		$enabled         = !empty($button_settings['enable_amount_presets']) && (string) $button_settings['enable_amount_presets'] === '1';
		$show            = array_key_exists('show', $options) ? !empty($options['show']) : $enabled;
		if (isset($options['product_id'])) {
			$pid = absint($options['product_id']);
			if ($pid > 0) {
				$flag = get_post_meta($pid, '_enable_amount_presets', true);
				if ($flag === 'no') {
					$show = false;
				}
			}
		}
		$show = (bool) apply_filters('wdp_show_amount_presets', $show, $min_price);
		if (!$show) {
			return '';
		}

		$presets = self::get_amount_presets($min_price, isset($options['product_id']) ? absint($options['product_id']) : 0);
		if (empty($presets)) {
			return '';
		}

		$symbol         = $currency_symbol !== '' ? $currency_symbol : WDP_Utils::get_display_currency_symbol();
		$group_label    = __('Hızlı tutar seç', 'woo-donation-popup');
		$popular_label  = __('En çok tercih', 'woo-donation-popup');
		$popular_index  = (int) apply_filters('wdp_amount_preset_popular_index', (int) floor(count($presets) / 2), $presets, $min_price);
		if ($popular_index < 0 || $popular_index >= count($presets)) {
			$popular_index = (int) floor(count($presets) / 2);
		}

		ob_start();
		?>
		<div class="wdp-amount-presets" role="group" aria-label="<?php echo esc_attr($group_label); ?>">
			<?php foreach ($presets as $i => $amount) : ?>
				<?php
				$label = class_exists('WDP_Utils')
					? wp_strip_all_tags(WDP_Utils::format_price_html($amount))
					: ($symbol . number_format((float) $amount, 0, ',', '.'));
				$is_popular = ((int) $i === $popular_index);
				$btn_class  = 'wdp-amount-preset' . ($is_popular ? ' is-popular' : '');
				?>
				<button
					type="button"
					class="<?php echo esc_attr($btn_class); ?>"
					data-amount="<?php echo esc_attr((string) $amount); ?>"
					aria-pressed="false"
					<?php if ($is_popular) : ?>
						data-popular-label="<?php echo esc_attr($popular_label); ?>"
					<?php endif; ?>
				><?php echo esc_html($label); ?></button>
			<?php endforeach; ?>
		</div>
		<?php
		return trim(ob_get_clean());
	}

	/**
	 * Özel fiyat satırı — tam genişlik, sol etiket, sayaç yok (adet = 1).
	 *
	 * @param string $min_price       Minimum price attribute.
	 * @param string $placeholder     Input placeholder.
	 * @param string $currency_symbol Currency symbol.
	 * @param array  $options         Row options.
	 * @return string Safe HTML.
	 */
	public static function render_custom_price_amount_row($min_price, $placeholder, $currency_symbol, array $options = array()) {
		$defaults    = array(
			'name'         => 'custom_price',
			'label'        => __('Bağış Tutarı', 'woo-donation-popup'),
			'required'     => true,
			'row_class'    => 'wdp-custom-price-row',
			'input_class'  => 'wdp-custom-price-input',
			'include_qty'  => true,
			'filter_label' => 'wdp_custom_price_label',
			'input_type'   => 'number',
			'show_presets' => true,
		);
		$opts        = array_merge($defaults, $options);
		$input_type  = ($opts['input_type'] === 'text') ? 'text' : 'number';

		$label = apply_filters($opts['filter_label'], $opts['label']);
		$label = is_string($label) ? trim($label) : (string) $opts['label'];
		if ($label === '') {
			$label = (string) $defaults['label'];
		}
		if ($label !== '' && substr($label, -1) !== ':') {
			$label .= ':';
		}
		$placeholder = is_string($placeholder) ? trim($placeholder) : '';
		$ph_lower    = function_exists('mb_strtolower') ? mb_strtolower($placeholder, 'UTF-8') : strtolower($placeholder);
		if ($placeholder === '' || strpos($ph_lower, 'bağış tutarı') !== false || strpos($ph_lower, 'bagis tutari') !== false) {
			$min_numeric = (float) $min_price;
			$placeholder = ($min_numeric > 0 && class_exists('WDP_Utils'))
				? ('min: ' . WDP_Utils::format_amount_for_min_placeholder($min_price))
				: '';
		}
		$label_id      = 'wdp-price-label-' . wp_unique_id();
		$row_class     = trim((string) $opts['row_class']);
		$input_class   = trim((string) $opts['input_class']);
		$required_attr = !empty($opts['required']) ? ' required' : '';
		$min_attr      = '';
		if ($input_type === 'number') {
			$min_attr = ' min="' . esc_attr($min_price) . '" step="1"';
		} elseif ($min_price !== '' && $min_price !== null) {
			$min_attr = ' data-wdp-min-price="' . esc_attr($min_price) . '"';
		}

		$presets_html = '';
		if (!empty($opts['show_presets']) && strpos($row_class, 'sadaka') === false) {
			$preset_opts = array();
			if (isset($opts['product_id'])) {
				$preset_opts['product_id'] = absint($opts['product_id']);
			} elseif (!empty($GLOBALS['wdp_current_donation_product_id'])) {
				$preset_opts['product_id'] = absint($GLOBALS['wdp_current_donation_product_id']);
			}
			$presets_html = self::render_amount_presets($min_price, $currency_symbol, $preset_opts);
		}

		ob_start();
		?>
		<div class="<?php echo esc_attr($row_class); ?>" role="group" aria-labelledby="<?php echo esc_attr($label_id); ?>">
			<span class="wdp-custom-price-row__label" id="<?php echo esc_attr($label_id); ?>"><?php echo esc_html($label); ?></span>
			<?php echo $presets_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in renderer ?>
			<div class="wdp-price-field wdp-custom-price-field">
				<div class="wdp-custom-price-shell">
					<span class="wdp-custom-price-currency" aria-hidden="true"><?php echo esc_html($currency_symbol); ?></span>
					<input type="<?php echo esc_attr($input_type); ?>" name="<?php echo esc_attr($opts['name']); ?>" placeholder="<?php echo esc_attr($placeholder); ?>"<?php echo $min_attr; ?><?php echo $required_attr; ?> class="<?php echo esc_attr($input_class); ?>" inputmode="decimal" autocomplete="off" aria-labelledby="<?php echo esc_attr($label_id); ?>">
				</div>
			</div>
			<?php if (!empty($opts['include_qty'])) : ?>
			<input type="hidden" name="quantity" value="1">
			<?php endif; ?>
		</div>
		<?php
		return trim(ob_get_clean());
	}

	/**
	 * Fixed-price quantity row shared by modal and inline form.
	 *
	 * @param string|float $product_price Product unit price.
	 * @return string
	 */
	public static function render_fixed_price_quantity_row($product_price) {
		ob_start();
		?>
		<div class="wdp-price-quantity-row wdp-fixed-price-counter-row">
			<div class="wdp-line-total-display" role="status" aria-live="polite">
				<span class="screen-reader-text"><?php esc_html_e('Satır tutarı', 'woo-donation-popup'); ?></span>
				<span class="wdp-line-total-value"><?php echo $product_price !== '' ? esc_html(WDP_Utils::format_price_plain($product_price)) : '—'; ?></span>
			</div>
			<div class="wdp-quantity-counter">
				<button type="button" class="wdp-product-quantity-btn wdp-product-quantity-decrease" aria-label="<?php echo esc_attr__('Azalt', 'woo-donation-popup'); ?>"><?php echo WDP_Svg_Icons::get_counter_icon_minus_svg(); ?></button>
				<input type="number" name="quantity" value="1" min="1" max="99" readonly>
				<button type="button" class="wdp-product-quantity-btn wdp-product-quantity-increase" aria-label="<?php echo esc_attr__('Arttır', 'woo-donation-popup'); ?>"><?php echo WDP_Svg_Icons::get_counter_icon_plus_svg(); ?></button>
			</div>
		</div>
		<?php
		return trim(ob_get_clean());
	}

	/**
	 * Progress-bar amount block (presets + custom price, no quantity counter).
	 *
	 * @param string $min_price Minimum price.
	 * @return string Safe HTML.
	 */
	public static function render_progress_amount_block($min_price = '0') {
		$wdp_currency_symbol = WDP_Utils::get_display_currency_symbol();
		$min_numeric         = (float) $min_price;
		$wdp_custom_price_placeholder = ($min_numeric > 0)
			? ('min: ' . WDP_Utils::format_amount_for_min_placeholder($min_price))
			: __('Bağış tutarı *', 'woo-donation-popup');

		$preset_product_id = !empty($GLOBALS['wdp_current_donation_product_id'])
			? absint($GLOBALS['wdp_current_donation_product_id'])
			: 0;

		ob_start();
		?>
		<div class="wdp-form-block wdp-form-block--amount">
		<div class="wdp-price-quantity-row wdp-progress-bar-price-row">
			<?php echo self::render_amount_presets($min_price, $wdp_currency_symbol, array('product_id' => $preset_product_id)); ?>
			<div class="wdp-price-field wdp-progress-bar-price-field">
				<div class="wdp-custom-price-shell">
					<span class="wdp-custom-price-currency" aria-hidden="true"><?php echo esc_html($wdp_currency_symbol); ?></span>
					<input
						type="number"
						name="custom_price"
						value=""
						placeholder="<?php echo esc_attr($wdp_custom_price_placeholder); ?>"
						min="<?php echo esc_attr($min_numeric > 0 ? $min_price : '0'); ?>"
						step="1"
						required
						class="wdp-custom-price-input wdp-progress-bar-price-input"
						data-base-min="<?php echo esc_attr($min_numeric > 0 ? $min_price : ''); ?>"
						inputmode="decimal"
						autocomplete="off"
						aria-label="<?php echo esc_attr__('Bağış tutarı', 'woo-donation-popup'); ?>"
					>
				</div>
			</div>
			<input type="hidden" name="quantity" value="1">
		</div>
		</div>
		<?php
		return trim(ob_get_clean());
	}

	/**
	 * Varsayılan sadaka açıklama metni (ürün özel metni boşken).
	 *
	 * @return string
	 */
	public static function get_default_sadaka_donation_message() {
		return (string) apply_filters(
			'wdp_sadaka_inspirational_message',
			__('İsterseniz bu vesileyle ayrıca bir sadaka bağışı da ekleyebilirsiniz. Her iyilik sessizce bir yere dokunur; sizin niyetiniz, ihtiyaç sahiplerine umut taşıyabilir.', 'woo-donation-popup')
		);
	}

	/**
	 * Ürün sadaka metnini çözümler; boşsa varsayılan metin.
	 *
	 * @param string $message Per-product message from meta.
	 * @return string
	 */
	public static function resolve_sadaka_donation_message($message) {
		$message = is_string($message) ? trim($message) : '';
		if ($message !== '') {
			return $message;
		}

		return trim(self::get_default_sadaka_donation_message());
	}

	/**
	 * İsteğe bağlı alt bağış bloğu.
	 *
	 * @param array $context sadaka_min_price, sadaka_fixed_price, sadaka_wc_product_id, sadaka_price_placeholder, currency_symbol, sadaka_donation_message.
	 * @return string Safe HTML.
	 */
	public static function render_sadaka_donation_block($context) {
		if (!is_array($context)) {
			$context = array();
		}
		$sadaka_min_price = isset($context['sadaka_min_price']) ? (string) $context['sadaka_min_price'] : '0';
		$placeholder      = isset($context['sadaka_price_placeholder']) ? (string) $context['sadaka_price_placeholder'] : '';
		$currency_symbol  = isset($context['currency_symbol']) ? (string) $context['currency_symbol'] : '';
		$message          = isset($context['sadaka_donation_message']) ? (string) $context['sadaka_donation_message'] : '';
		$fixed_raw        = isset($context['sadaka_fixed_price']) ? (string) $context['sadaka_fixed_price'] : '';
		$fixed_float      = ($fixed_raw !== '') ? (float) wc_format_decimal($fixed_raw) : 0.0;
		$is_fixed         = $fixed_float > 0;
		$parent_id        = isset($context['product_id']) ? absint($context['product_id']) : 0;
		$wc_product_id    = 0;
		if (class_exists('WDP_Utils')) {
			$wc_product_id = $parent_id > 0
				? (int) WDP_Utils::resolve_sadaka_wc_product_id($parent_id)
				: 0;
			if ($wc_product_id <= 0) {
				$configured = isset($context['sadaka_wc_product_id']) ? absint($context['sadaka_wc_product_id']) : 0;
				if ($configured > 0 && WDP_Utils::is_valid_sadaka_wc_product($configured)) {
					$wc_product_id = $configured;
				}
			}
		} else {
			$wc_product_id = isset($context['sadaka_wc_product_id']) ? absint($context['sadaka_wc_product_id']) : 0;
		}

		// WC ürünü yoksa butonu gizle; edit_products yetkilisine uyarı göster.
		if ($wc_product_id <= 0) {
			return class_exists('WDP_Utils')
				? WDP_Utils::admin_notice_html(
					__('Alt bağış (sadaka) için geçerli bir WooCommerce ürünü tanımlı değil. Ayarlar → Başarı & Mini Sepet veya ürün Bağış sekmesinden alt bağış ürünü seçin.', 'woo-donation-popup')
				)
				: '';
		}

		$note_text    = self::resolve_sadaka_donation_message($message);
		$toggle_label = isset($context['sadaka_toggle_label']) ? (string) $context['sadaka_toggle_label'] : '';
		if ($toggle_label === '' && class_exists('WDP_Utils')) {
			$toggle_label = WDP_Utils::get_sadaka_toggle_label();
		}
		if ($toggle_label === '') {
			$toggle_label = __('Alt Bağış Ekle', 'woo-donation-popup');
		}
		$toggle_label = apply_filters('wdp_sadaka_toggle_label', $toggle_label);
		$panel_id     = 'wdp-sadaka-panel-' . wp_unique_id();

		if ($is_fixed) {
			$fixed_display = wc_format_decimal($fixed_float, wc_get_price_decimals());
			$label         = apply_filters('wdp_sadaka_price_label', __('Alt Bağış Tutarı', 'woo-donation-popup'));
			$label         = is_string($label) ? trim($label) : __('Alt Bağış Tutarı', 'woo-donation-popup');
			if ($label !== '' && substr($label, -1) !== ':') {
				$label .= ':';
			}
			$label_id = 'wdp-sadaka-fixed-label-' . wp_unique_id();
			ob_start();
			?>
			<div class="wdp-custom-price-row wdp-sadaka-donation__amount wdp-sadaka-donation__amount--fixed" role="group" aria-labelledby="<?php echo esc_attr($label_id); ?>">
				<span class="wdp-custom-price-row__label" id="<?php echo esc_attr($label_id); ?>"><?php echo esc_html($label); ?></span>
				<div class="wdp-price-field wdp-custom-price-field">
					<div class="wdp-custom-price-shell">
						<span class="wdp-custom-price-currency" aria-hidden="true"><?php echo esc_html($currency_symbol); ?></span>
						<input type="number" name="sadaka_custom_price" value="<?php echo esc_attr($fixed_display); ?>" readonly class="wdp-custom-price-input wdp-sadaka-custom-price-input" inputmode="decimal" autocomplete="off" aria-labelledby="<?php echo esc_attr($label_id); ?>">
					</div>
				</div>
			</div>
			<?php
			$amount_row = trim(ob_get_clean());
		} else {
			$amount_row = self::render_custom_price_amount_row(
				$sadaka_min_price,
				$placeholder,
				$currency_symbol,
				array(
					'name'         => 'sadaka_custom_price',
					'label'        => __('Alt Bağış Tutarı', 'woo-donation-popup'),
					'required'     => false,
					'row_class'    => 'wdp-custom-price-row wdp-sadaka-donation__amount',
					'input_class'  => 'wdp-custom-price-input wdp-sadaka-custom-price-input',
					'include_qty'  => false,
					'filter_label' => 'wdp_sadaka_price_label',
				)
			);
		}

		$wrap_attrs = ' data-wdp-sadaka-donation';
		if ($is_fixed) {
			$wrap_attrs .= ' data-wdp-alt-fixed-price="' . esc_attr(wc_format_decimal($fixed_float)) . '"';
		}
		if ($wc_product_id > 0) {
			$wrap_attrs .= ' data-wdp-alt-wc-product-id="' . esc_attr((string) $wc_product_id) . '"';
		}

		ob_start();
		?>
		<div class="wdp-sadaka-donation"<?php echo $wrap_attrs; ?>>
			<button type="button" class="wdp-sadaka-donation__toggle" aria-expanded="false" aria-controls="<?php echo esc_attr($panel_id); ?>">
				<?php echo esc_html($toggle_label); ?>
			</button>
			<div class="wdp-sadaka-donation__panel" id="<?php echo esc_attr($panel_id); ?>" hidden>
				<?php if ($note_text !== '') : ?>
				<p class="wdp-sadaka-donation__message"><?php echo esc_html($note_text); ?></p>
				<?php endif; ?>
				<?php echo $amount_row; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in renderer ?>
			</div>
		</div>
		<?php
		return trim(ob_get_clean());
	}

	/**
	 * Build sadaka render context from product form context.
	 *
	 * @param array $context Product form context.
	 * @return array
	 */
	public static function build_sadaka_context(array $context) {
		return array(
			'product_id'               => isset($context['product_id']) ? absint($context['product_id']) : 0,
			'sadaka_min_price'         => isset($context['sadaka_min_price']) ? $context['sadaka_min_price'] : '0',
			'sadaka_fixed_price'       => isset($context['sadaka_fixed_price']) ? $context['sadaka_fixed_price'] : '',
			'sadaka_wc_product_id'     => isset($context['sadaka_wc_product_id']) ? $context['sadaka_wc_product_id'] : '',
			'sadaka_toggle_label'      => isset($context['sadaka_toggle_label']) ? $context['sadaka_toggle_label'] : '',
			'sadaka_price_placeholder' => isset($context['sadaka_price_placeholder']) ? $context['sadaka_price_placeholder'] : '',
			'currency_symbol'          => isset($context['currency_symbol']) ? $context['currency_symbol'] : '',
			'sadaka_donation_message'  => isset($context['sadaka_donation_message']) ? $context['sadaka_donation_message'] : '',
		);
	}

	/**
	 * Stacked donor fields: name, phone, note, optional email (no dedication).
	 *
	 * @param array $options Context flags (enable_email, …).
	 * @return string Safe HTML.
	 */
	public static function render_donor_contact_stack($options = array()) {
		if (!is_array($options)) {
			$options = array();
		}
		$button       = get_option('wdp_button_settings', array());
		$enable_email = array_key_exists('enable_email', $options)
			? !empty($options['enable_email'])
			: (!empty($button['enable_donor_email']) && (string) $button['enable_donor_email'] === '1');

		$name_hint  = (string) apply_filters('wdp_field_hint_name', '');
		$phone_hint = (string) apply_filters('wdp_field_hint_phone', '');
		$note_hint  = (string) apply_filters('wdp_field_hint_note', '');
		$email_hint = (string) apply_filters('wdp_field_hint_email', '');

		ob_start();
		?>
		<div class="wdp-form-block wdp-form-block--info">
		<div class="wdp-field-stack" role="group" aria-label="<?php echo esc_attr__('Bağışçı iletişim bilgileri', 'woo-donation-popup'); ?>">
			<div class="wdp-field-stack__row wdp-field-stack__row--name">
				<span class="wdp-field-stack__icon"><?php echo WDP_Svg_Icons::field_stack_icon_user_svg(); ?></span>
				<input type="text" class="wdp-field-stack__input" name="donation_full_name" placeholder="<?php echo esc_attr__( 'Ad Soyad *', 'woo-donation-popup' ); ?>" required autocomplete="name" />
				<span class="wdp-field-stack__hint"><?php echo esc_html($name_hint); ?></span>
			</div>
			<div class="wdp-field-stack__row wdp-field-stack__row--phone">
				<div class="wdp-field-stack__phone">
					<?php echo WDP_Phone_Field::render(); ?>
				</div>
				<span class="wdp-field-stack__hint"><?php echo esc_html($phone_hint); ?></span>
			</div>
			<div class="wdp-field-stack__row wdp-field-stack__row--textarea">
				<span class="wdp-field-stack__icon"><?php echo WDP_Svg_Icons::field_stack_icon_note_svg(); ?></span>
				<textarea class="wdp-field-stack__textarea" name="donation_note" rows="1" placeholder="<?php echo esc_attr__( 'Not (isteğe bağlı)', 'woo-donation-popup' ); ?>"></textarea>
				<span class="wdp-field-stack__hint"><?php echo esc_html($note_hint); ?></span>
			</div>
			<?php if ($enable_email) : ?>
			<div class="wdp-field-stack__row wdp-field-stack__row--email">
				<span class="wdp-field-stack__icon"><?php echo WDP_Svg_Icons::field_stack_icon_email_svg(); ?></span>
				<input type="email" class="wdp-field-stack__input" name="donation_email" placeholder="<?php echo esc_attr__( 'E-posta (isteğe bağlı)', 'woo-donation-popup' ); ?>" autocomplete="email" inputmode="email" />
				<span class="wdp-field-stack__hint"><?php echo esc_html($email_hint); ?></span>
			</div>
			<?php endif; ?>
		</div>
		</div>
		<?php
		return trim(ob_get_clean());
	}

	/**
	 * Dedication / anonymous block (separate from donor stack for module_order).
	 *
	 * @param array $options enable_dedication, enable_anonymous, dedication_placeholder.
	 * @return string Safe HTML.
	 */
	public static function render_dedication_block($options = array()) {
		if (!is_array($options)) {
			$options = array();
		}
		$button            = get_option('wdp_button_settings', array());
		$enable_dedication = array_key_exists('enable_dedication', $options)
			? !empty($options['enable_dedication'])
			: (!empty($button['enable_dedication']) && (string) $button['enable_dedication'] === '1');
		$enable_anonymous  = array_key_exists('enable_anonymous', $options)
			? !empty($options['enable_anonymous'])
			: (!empty($button['enable_anonymous']) && (string) $button['enable_anonymous'] === '1');
		$dedication_ph     = !empty($options['dedication_placeholder'])
			? (string) $options['dedication_placeholder']
			: (is_array($button) && !empty($button['dedication_placeholder'])
				? (string) $button['dedication_placeholder']
				: __('Kimin adına? (isteğe bağlı)', 'woo-donation-popup'));

		if (!$enable_dedication && !$enable_anonymous) {
			return '';
		}

		ob_start();
		?>
		<div class="wdp-form-block wdp-form-block--note">
		<div class="wdp-dedication-block">
			<?php if ($enable_dedication) : ?>
			<div class="wdp-field-stack__row wdp-field-stack__row--dedication">
				<input type="text" class="wdp-field-stack__input" name="donation_dedication" placeholder="<?php echo esc_attr($dedication_ph); ?>" maxlength="120" autocomplete="off" />
			</div>
			<?php endif; ?>
			<?php if ($enable_anonymous) : ?>
			<label class="wdp-anonymous-row">
				<input type="checkbox" name="donation_anonymous" value="1" />
				<span><?php echo esc_html__('İsmim gizli kalsın', 'woo-donation-popup'); ?></span>
			</label>
			<?php endif; ?>
		</div>
		</div>
		<?php
		return trim(ob_get_clean());
	}

	/**
	 * Render body modules: always bağışçı formu → ithaf → tutar → cover_fee.
	 * Header modules still follow product module_order; body field UX is fixed.
	 *
	 * @param array $args {
	 *     @type int    $product_id   Product ID.
	 *     @type array  $context      Form context.
	 *     @type array  $donor_opts   Donor/dedication options.
	 *     @type string $amount_html  Pre-built amount block HTML.
	 * }
	 * @return string Safe HTML.
	 */
	public static function render_ordered_body_modules(array $args) {
		$context     = isset($args['context']) && is_array($args['context']) ? $args['context'] : array();
		$donor_opts  = isset($args['donor_opts']) && is_array($args['donor_opts']) ? $args['donor_opts'] : array();
		$amount_html = isset($args['amount_html']) ? (string) $args['amount_html'] : '';

		$chunks = array(
			'donor'      => self::render_donor_contact_stack($donor_opts),
			'dedication' => self::render_dedication_block($donor_opts),
			'amount'     => $amount_html,
			'cover_fee'  => '',
		);

		if (!empty($context['enable_cover_fee']) && class_exists('WDP_Form_Modules')) {
			$chunks['cover_fee'] = WDP_Form_Modules::render_cover_fee(
				isset($context['cover_fee_percent']) ? (float) $context['cover_fee_percent'] : 0
			);
		}

		$html = '';
		foreach (self::BODY_MODULE_IDS as $id) {
			if (!empty($chunks[ $id ])) {
				$html .= $chunks[ $id ];
			}
		}

		return $html;
	}

	/**
	 * Shares | progress fields | standard donor+price body (no shell chrome).
	 *
	 * @param array $args Branch inputs.
	 * @return string
	 */
	public static function render_donation_form_fields_body(array $args) {
		$allow_multiple_shares = !empty($args['allow_multiple_shares']);
		$max_shares            = isset($args['max_shares']) ? $args['max_shares'] : 7;
		$enable_progress_bar   = !empty($args['enable_progress_bar']);
		$progress_min_price    = isset($args['progress_min_price']) ? $args['progress_min_price'] : '0';
		$allow_custom_price    = !empty($args['allow_custom_price']);
		$min_price             = isset($args['min_price']) ? $args['min_price'] : '0';
		$product_price         = isset($args['product_price']) ? $args['product_price'] : '';
		$custom_price_placeholder = isset($args['custom_price_placeholder']) ? $args['custom_price_placeholder'] : '';
		$currency_symbol       = isset($args['currency_symbol']) ? $args['currency_symbol'] : '';
		$context               = isset($args['context']) && is_array($args['context']) ? $args['context'] : array();
		$product_id            = isset($args['product_id']) ? absint($args['product_id']) : 0;

		$donor_opts = array(
			'enable_email'           => !empty($context['enable_email']),
			'enable_dedication'      => !empty($context['enable_dedication']),
			'enable_anonymous'       => !empty($context['enable_anonymous']),
			'dedication_placeholder' => isset($context['dedication_placeholder']) ? $context['dedication_placeholder'] : '',
		);

		ob_start();
		if ($allow_multiple_shares) {
			?>
			<!-- Çoklu Hisse Alanı -->
			<div class="wdp-shares-section">
				<div class="wdp-shares-header">
					<label>Hisse Adedi:</label>
					<div class="wdp-share-counter">
						<button type="button" class="wdp-share-btn wdp-share-btn-decrease" aria-label="<?php echo esc_attr__('Azalt', 'woo-donation-popup'); ?>"><?php echo WDP_Svg_Icons::get_counter_icon_minus_svg(); ?></button>
						<input type="number" name="share_count" value="1" min="1" max="<?php echo esc_attr($max_shares); ?>" readonly>
						<button type="button" class="wdp-share-btn wdp-share-btn-increase" aria-label="<?php echo esc_attr__('Arttır', 'woo-donation-popup'); ?>"><?php echo WDP_Svg_Icons::get_counter_icon_plus_svg(); ?></button>
					</div>
				</div>
				<div class="wdp-shareholders-area">
					<div class="wdp-shareholders-container">
						<div class="wdp-shareholders-scroll">
						<!-- Hissedar formları JavaScript ile eklenecek -->
						</div>
					</div>
				</div>
			</div>
			<?php
		} elseif ($enable_progress_bar) {
			echo self::render_ordered_body_modules(
				array(
					'product_id'  => $product_id,
					'context'     => $context,
					'donor_opts'  => $donor_opts,
					'amount_html' => self::render_progress_amount_block($progress_min_price),
				)
			);
		} else {
			$amount_inner = $allow_custom_price
				? self::render_custom_price_amount_row($min_price, $custom_price_placeholder, $currency_symbol, array('product_id' => $product_id))
				: self::render_fixed_price_quantity_row($product_price);
			$amount_html  = '<div class="wdp-form-block wdp-form-block--amount">' . $amount_inner . '</div>';

			echo self::render_ordered_body_modules(
				array(
					'product_id'  => $product_id,
					'context'     => $context,
					'donor_opts'  => $donor_opts,
					'amount_html' => $amount_html,
				)
			);
		}
		return trim(ob_get_clean());
	}
}

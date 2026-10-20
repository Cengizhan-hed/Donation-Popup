<?php
/**
 * İçerik modülleri: sıra, güven rozetleri, aciliyet, cover-fee ve ürün tema stili.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Form_Modules
 */
class WDP_Form_Modules {

	/**
	 * Default module registry.
	 *
	 * @return array{order:string[],labels:array<string,string>}
	 */
	public static function defaults() {
		$config = include WDP_PLUGIN_DIR . 'includes/config/form-modules.php';
		return is_array($config) ? $config : array('order' => array(), 'labels' => array());
	}

	/**
	 * Allowed module ids.
	 *
	 * @return string[]
	 */
	public static function allowed_ids() {
		$d = self::defaults();
		return isset($d['order']) && is_array($d['order']) ? $d['order'] : array();
	}

	/**
	 * Sanitize module order CSV / array.
	 *
	 * @param mixed $raw Raw order.
	 * @return string[]
	 */
	public static function sanitize_order($raw) {
		$allowed = self::allowed_ids();
		$parts   = array();
		if (is_array($raw)) {
			$parts = $raw;
		} elseif (is_string($raw)) {
			$parts = preg_split('/[\s,;|]+/', $raw);
		}
		$out = array();
		if (is_array($parts)) {
			foreach ($parts as $id) {
				$id = sanitize_key((string) $id);
				if ($id !== '' && in_array($id, $allowed, true) && !in_array($id, $out, true)) {
					$out[] = $id;
				}
			}
		}
		foreach ($allowed as $id) {
			if (!in_array($id, $out, true)) {
				$out[] = $id;
			}
		}
		return $out;
	}

	/**
	 * Resolve module order for a product (meta override or global/default).
	 *
	 * @param int $product_id Product ID.
	 * @return string[]
	 */
	public static function resolve_order($product_id) {
		$product_id = absint($product_id);
		$raw        = '';
		if ($product_id > 0) {
			$raw = get_post_meta($product_id, '_wdp_module_order', true);
		}
		if ($raw === '' || $raw === null) {
			$button = get_option('wdp_button_settings', array());
			$raw    = is_array($button) && !empty($button['module_order']) ? $button['module_order'] : '';
		}
		return self::sanitize_order($raw);
	}

	/**
	 * Decode a JSON list stored in meta (as-is) or posted from a form (slashed).
	 *
	 * @param string $raw Raw JSON.
	 * @return array|null
	 */
	private static function decode_json_list($raw) {
		$decoded = json_decode($raw, true);
		if (!is_array($decoded)) {
			$decoded = json_decode(wp_unslash($raw), true);
		}
		return is_array($decoded) ? $decoded : null;
	}

	/**
	 * Sanitize trust badges (max 3).
	 *
	 * @param mixed $raw Raw.
	 * @return array<int, array{icon:string,text:string}>
	 */
	public static function sanitize_trust_badges($raw) {
		$out = array();
		if (is_string($raw)) {
			$decoded = self::decode_json_list($raw);
			$raw     = is_array($decoded) ? $decoded : array();
		}
		if (!is_array($raw)) {
			return array();
		}
		foreach ($raw as $row) {
			if (!is_array($row)) {
				continue;
			}
			$text = isset($row['text']) ? sanitize_text_field((string) $row['text']) : '';
			if ($text === '') {
				continue;
			}
			$icon = isset($row['icon']) ? (string) $row['icon'] : 'builtin:shield';
			if (class_exists('WDP_Icon_Library')) {
				$icon = WDP_Icon_Library::sanitize_icon_value($icon, 'builtin:shield');
			}
			$out[] = array(
				'icon' => $icon,
				'text' => $text,
			);
			if (count($out) >= 3) {
				break;
			}
		}
		return $out;
	}

	/**
	 * Global + product trust badges for render.
	 *
	 * @param int $product_id Product ID.
	 * @return array<int, array{icon:string,text:string}>
	 */
	public static function resolve_trust_badges($product_id = 0) {
		$button = get_option('wdp_button_settings', array());
		$badges = array();
		if (is_array($button) && !empty($button['trust_badges'])) {
			$badges = self::sanitize_trust_badges($button['trust_badges']);
		}
		if (empty($badges)) {
			$text = is_array($button) && !empty($button['trust_strip_text'])
				? (string) $button['trust_strip_text']
				: __('Güvenli ödeme · SSL korumalı işlem', 'woo-donation-popup');
			$icon = is_array($button) && !empty($button['icon_trust']) ? (string) $button['icon_trust'] : 'builtin:shield';
			$badges = array(
				array(
					'icon' => $icon,
					'text' => $text,
				),
			);
		}

		$product_id = absint($product_id);
		if ($product_id > 0) {
			$extra = get_post_meta($product_id, '_trust_badges', true);
			if ($extra !== '' && $extra !== null) {
				$product_badges = self::sanitize_trust_badges($extra);
				if (!empty($product_badges)) {
					$badges = $product_badges;
				}
			}
		}

		return $badges;
	}

	/**
	 * SOFT parse of an amount presets list — ONLY for READING already stored data / render.
	 *
	 * Tolerant: strips junk characters, accepts decimals and "1.000" style tokens, keeps
	 * positive numbers, max 6. Never use this to validate user input on SAVE; use
	 * validate_amount_presets_for_save() instead (10.29.0 decision Y3/Y4).
	 *
	 * @param string $raw CSV / space / semicolon separated list.
	 * @return float[]
	 */
	public static function parse_amount_presets_csv($raw) {
		$parts = preg_split('/[\s,;]+/', (string) $raw);
		$out   = array();
		if (!is_array($parts)) {
			return $out;
		}
		foreach ($parts as $part) {
			$n = (float) str_replace(',', '.', preg_replace('/[^\d.,]/', '', (string) $part));
			if ($n > 0) {
				$out[] = (floor($n) == $n) ? (float) (int) $n : round($n, 2);
			}
			if (count($out) >= 6) {
				break;
			}
		}
		return $out;
	}

	/**
	 * STRICT validation of the quick amount list on SAVE (admin global + product panel).
	 *
	 * Separators: comma, whitespace, semicolon. Every token must be digits only
	 * (letters, decimals and thousand separators like "1.000" / "1,5" / "5o0" are invalid),
	 * greater than zero, at most 6 tokens. Empty string is valid and yields an empty list.
	 *
	 * @param mixed $raw Raw user input.
	 * @return array{ok:bool,amounts?:int[],error?:string,invalid?:string}
	 */
	public static function validate_amount_presets_for_save($raw) {
		$raw = trim((string) $raw);
		if ($raw === '') {
			return array('ok' => true, 'amounts' => array());
		}

		// Binlik/ondalık nokta ("1.000", "1.5") — ayırıcı değil, geçersiz.
		if (preg_match('/\d+\.\d+/', $raw, $dot_m)) {
			return array(
				'ok'      => false,
				'invalid' => $dot_m[0],
				'error'   => sprintf(
					/* translators: %s: invalid token */
					__('Hızlı tutar düğmeleri yalnız tam sayı olmalı; geçersiz değer: "%s". Tutarları virgül, boşluk veya noktalı virgülle ayırın (ör. 100, 250, 500).', 'woo-donation-popup'),
					$dot_m[0]
				),
			);
		}

		// Türkçe ondalık ("1,5") — tek başına veya boşluk/noktalı virgülle ayrılmış segment.
		// "100,250,500" gibi listeler (virgülden sonra 3+ hane veya 3+ parça) ayırıcı sayılır.
		if (preg_match('/(?:^|[\s;])(\d+,\d{1,2})(?=[\s;]|$)/u', $raw, $dec_m) || preg_match('/^(\d+,\d{1,2})$/u', $raw, $dec_m)) {
			return array(
				'ok'      => false,
				'invalid' => $dec_m[1],
				'error'   => sprintf(
					/* translators: %s: invalid token */
					__('Hızlı tutar düğmeleri yalnız tam sayı olmalı; geçersiz değer: "%s". Tutarları virgül, boşluk veya noktalı virgülle ayırın (ör. 100, 250, 500).', 'woo-donation-popup'),
					$dec_m[1]
				),
			);
		}

		$parts   = preg_split('/[\s,;]+/', $raw, -1, PREG_SPLIT_NO_EMPTY);
		$amounts = array();
		if (!is_array($parts)) {
			$parts = array();
		}
		foreach ($parts as $part) {
			$part = trim((string) $part);
			if ($part === '') {
				continue;
			}
			if (!preg_match('/^\d+$/', $part) || (int) $part <= 0) {
				return array(
					'ok'      => false,
					'invalid' => $part,
					'error'   => sprintf(
						/* translators: %s: invalid token */
						__('Hızlı tutar düğmeleri yalnız tam sayı olmalı; geçersiz değer: "%s". Tutarları virgül, boşluk veya noktalı virgülle ayırın (ör. 100, 250, 500).', 'woo-donation-popup'),
						$part
					),
				);
			}
			$amounts[] = (int) $part;
		}
		if (count($amounts) > 6) {
			return array(
				'ok'    => false,
				'error' => __('En fazla 6 hızlı tutar düğmesi tanımlanabilir.', 'woo-donation-popup'),
			);
		}
		return array('ok' => true, 'amounts' => $amounts);
	}

	/**
	 * Validate the cover-fee percent on SAVE. 0 / empty = fee off; otherwise 0.5–15.
	 *
	 * @param mixed $raw Raw input.
	 * @return array{ok:bool,percent:float,error:string}
	 */
	public static function normalize_cover_fee_percent_for_save($raw) {
		$raw = is_string($raw) ? trim(str_replace(',', '.', $raw)) : $raw;
		if ($raw === '' || $raw === null || $raw === false) {
			return array('ok' => true, 'percent' => 0.0, 'error' => '');
		}
		if (!is_numeric($raw)) {
			return array(
				'ok'      => false,
				'percent' => 0.0,
				'error'   => __('İşlem ücreti yüzdesi sayı olmalı: 0 (kapalı) veya 0,5–15 arası.', 'woo-donation-popup'),
			);
		}
		$value = (float) $raw;
		if ($value == 0.0) {
			return array('ok' => true, 'percent' => 0.0, 'error' => '');
		}
		if ($value < 0.5 || $value > 15) {
			return array(
				'ok'      => false,
				'percent' => 0.0,
				'error'   => __('İşlem ücreti yüzdesi 0 (kapalı) veya 0,5–15 arasında olmalı.', 'woo-donation-popup'),
			);
		}
		return array('ok' => true, 'percent' => round($value, 2), 'error' => '');
	}

	/**
	 * Runtime clamp for display / cart: 0 when off, otherwise within 0.5–15.
	 *
	 * @param mixed $raw Stored or posted value.
	 * @return float
	 */
	public static function clamp_cover_fee_percent_for_runtime($raw) {
		$value = is_numeric($raw) ? (float) $raw : (float) str_replace(',', '.', (string) $raw);
		if ($value <= 0) {
			return 0.0;
		}
		return (float) min(15, max(0.5, $value));
	}

	/**
	 * Which preset is labelled "Önerilen". Never auto-selected.
	 *
	 * 10.29.1 (K2): Label only when a product-configured amount is present in the
	 * visible (min-filtered) list. Empty / missing / not-in-list → no label.
	 * No middle-button fallback; global amount_preset_recommended is ignored.
	 *
	 * @param array $presets    Presets as rendered (after min filter).
	 * @param mixed $configured Product `_amount_preset_recommended` (empty = none).
	 * @return float|null
	 */
	public static function resolve_recommended_amount(array $presets, $configured = null) {
		$presets = array_values($presets);
		if (empty($presets)) {
			return null;
		}
		if ($configured === null || $configured === '') {
			return null;
		}
		$configured = is_numeric($configured) ? (float) $configured : 0.0;
		if ($configured <= 0) {
			return null;
		}
		foreach ($presets as $preset) {
			if (abs((float) $preset - $configured) < 0.005) {
				return (float) $preset;
			}
		}
		return null;
	}

	/**
	 * STRICT save validation for product "Önerilen tutar" (Y3).
	 *
	 * Empty is valid. Non-empty must be a positive integer that appears in $allowed_amounts
	 * (the product list, or the global list when the product list is empty).
	 *
	 * @param mixed $raw             Posted value.
	 * @param int[] $allowed_amounts Allowed amounts (integers).
	 * @return array{ok:bool,value?:string,error?:string}
	 */
	public static function validate_recommended_amount_for_save($raw, array $allowed_amounts) {
		$raw = is_scalar($raw) ? trim((string) $raw) : '';
		if ($raw === '') {
			return array('ok' => true, 'value' => '');
		}
		if (!preg_match('/^\d+$/', $raw) || (int) $raw <= 0) {
			return array(
				'ok'    => false,
				'error' => sprintf(
					/* translators: %s: invalid value */
					__('Önerilen tutar yalnız pozitif tam sayı olmalı; geçersiz değer: "%s".', 'woo-donation-popup'),
					$raw
				),
			);
		}
		$amount = (int) $raw;
		$allowed = array_map('intval', $allowed_amounts);
		if (!in_array($amount, $allowed, true)) {
			return array(
				'ok'    => false,
				'error' => sprintf(
					/* translators: %s: invalid value */
					__('Önerilen tutar hızlı tutar listesinde olmalı; geçersiz değer: "%s".', 'woo-donation-popup'),
					$raw
				),
			);
		}
		return array('ok' => true, 'value' => (string) $amount);
	}

	/**
	 * Product theme CSS vars for modal wrapper.
	 *
	 * @param int   $product_id Product ID.
	 * @param array $context    Form context.
	 * @return string Inline style attribute value (no style="" wrapper).
	 */
	public static function build_product_theme_style($product_id, array $context = array()) {
		$product_id = absint($product_id);
		if ($product_id <= 0) {
			return '';
		}

		$vars = array();

		$primary = isset($context['theme_primary']) ? (string) $context['theme_primary'] : (string) get_post_meta($product_id, '_theme_primary', true);
		$hover   = isset($context['theme_primary_hover']) ? (string) $context['theme_primary_hover'] : (string) get_post_meta($product_id, '_theme_primary_hover', true);
		$radius  = isset($context['theme_radius']) ? $context['theme_radius'] : get_post_meta($product_id, '_theme_radius', true);
		$modal_bg = isset($context['theme_modal_bg']) ? (string) $context['theme_modal_bg'] : (string) get_post_meta($product_id, '_theme_modal_bg', true);
		$density = isset($context['theme_density']) ? (string) $context['theme_density'] : (string) get_post_meta($product_id, '_theme_density', true);
		$inherit = !empty($context['theme_inherit_category']) || get_post_meta($product_id, '_theme_inherit_category_color', true) === 'yes';

		if ($inherit && class_exists('WDP_Category_Title_Color_Service') && method_exists('WDP_Category_Title_Color_Service', 'get_color_for_product')) {
			$cat = WDP_Category_Title_Color_Service::get_color_for_product($product_id);
			if (is_string($cat) && $cat !== '') {
				$primary = $cat;
			}
		} elseif ($inherit && class_exists('WDP_Category_Title_Color_Service')) {
			// Fallback: parse from title style attr hex if helper missing.
			$attr = WDP_Category_Title_Color_Service::get_title_style_attr($product_id);
			if (is_string($attr) && preg_match('/#([0-9a-fA-F]{3,8})/', $attr, $m)) {
				$primary = '#' . $m[1];
			}
		}

		$primary = sanitize_hex_color($primary);
		$hover   = sanitize_hex_color($hover);
		$modal_bg = sanitize_hex_color($modal_bg);

		if ($primary) {
			$vars[] = '--wdp-primary:' . $primary;
			$vars[] = '--wdp-button-primary:' . $primary;
		}
		if ($hover) {
			$vars[] = '--wdp-primary-hover:' . $hover;
			$vars[] = '--wdp-button-primary-hover:' . $hover;
		}
		$radius_int = absint($radius);
		if ($radius_int > 0) {
			$radius_int = min(32, max(4, $radius_int));
			$vars[]     = '--wdp-radius-ui:' . $radius_int . 'px';
			$vars[]     = '--wdp-button-radius:' . $radius_int . 'px';
			$vars[]     = '--wdp-input-radius:' . $radius_int . 'px';
		}
		if ($modal_bg) {
			$vars[] = '--wdp-modal-bg:' . $modal_bg;
		}
		if (in_array($density, array('compact', 'normal', 'spacious'), true)) {
			$vars[] = '--wdp-density:' . ($density === 'normal' ? 'comfortable' : $density);
		}

		return implode(';', $vars);
	}

	/**
	 * Urgency banner HTML.
	 *
	 * @param string $text    Copy.
	 * @param string $ends_at Optional Y-m-d H:i:s or date.
	 * @return string
	 */
	public static function render_urgency($text, $ends_at = '') {
		$text = trim((string) $text);
		if ($text === '') {
			return '';
		}
		$ends_at = trim((string) $ends_at);
		if ($ends_at !== '') {
			$ts = strtotime($ends_at);
			if ($ts && $ts < time()) {
				return '';
			}
		}
		return '<p class="wdp-urgency-banner" role="status"><span class="wdp-urgency-banner__text">' . esc_html($text) . '</span></p>';
	}

	/**
	 * Social proof line.
	 *
	 * @param string $text Copy.
	 * @return string
	 */
	public static function render_social_proof($text) {
		$text = trim((string) $text);
		if ($text === '') {
			return '';
		}
		return '<p class="wdp-social-proof" role="status">' . esc_html($text) . '</p>';
	}

	/**
	 * Cover-fee checkbox row.
	 *
	 * @param float  $percent Fee percent.
	 * @param string $label   Label.
	 * @return string
	 */
	public static function render_cover_fee($percent, $label = '') {
		$percent = self::clamp_cover_fee_percent_for_runtime($percent);
		if ($percent <= 0) {
			return '';
		}
		if ($label === '') {
			$label = sprintf(
				/* translators: %s: percent */
				__('İşlem maliyetini karşıla (+%%%s)', 'woo-donation-popup'),
				rtrim(rtrim(number_format($percent, 2, ',', ''), '0'), ',')
			);
		}
		ob_start();
		?>
		<label class="wdp-cover-fee">
			<input type="checkbox" name="donation_cover_fee" value="1" data-wdp-cover-fee-percent="<?php echo esc_attr((string) $percent); ?>" />
			<span class="wdp-cover-fee__label"><?php echo esc_html($label); ?></span>
		</label>
		<div class="wdp-form-total" data-wdp-form-total hidden>
			<span class="wdp-form-total__label"><?php echo esc_html__('Toplam', 'woo-donation-popup'); ?></span>
			<span class="wdp-form-total__value">—</span>
		</div>
		<?php
		return trim(ob_get_clean());
	}
}

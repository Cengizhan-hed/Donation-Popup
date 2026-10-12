<?php
/**
 * İçerik modülleri: sıra, güven rozetleri, SSS, aciliyet, cover-fee ve ürün tema stili.
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
	 * Sanitize FAQ JSON items (max 5).
	 *
	 * @param mixed $raw Raw JSON string or array.
	 * @return array<int, array{q:string,a:string}>
	 */
	public static function sanitize_faq_items($raw) {
		$items = array();
		if (is_string($raw)) {
			$decoded = json_decode(wp_unslash($raw), true);
			if (is_array($decoded)) {
				$raw = $decoded;
			} else {
				// Plain lines: Q|A per line
				$lines = preg_split('/\r\n|\r|\n/', wp_unslash($raw));
				$raw   = array();
				if (is_array($lines)) {
					foreach ($lines as $line) {
						$line = trim((string) $line);
						if ($line === '' || strpos($line, '|') === false) {
							continue;
						}
						list($q, $a) = array_map('trim', explode('|', $line, 2));
						$raw[]       = array('q' => $q, 'a' => $a);
					}
				}
			}
		}
		if (!is_array($raw)) {
			return array();
		}
		foreach ($raw as $row) {
			if (!is_array($row)) {
				continue;
			}
			$q = isset($row['q']) ? sanitize_text_field((string) $row['q']) : '';
			$a = isset($row['a']) ? sanitize_textarea_field((string) $row['a']) : '';
			if ($q === '' || $a === '') {
				continue;
			}
			$items[] = array('q' => $q, 'a' => $a);
			if (count($items) >= 5) {
				break;
			}
		}
		return $items;
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
			$decoded = json_decode(wp_unslash($raw), true);
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
	 * Parse amount presets CSV (max 6).
	 *
	 * @param string $raw CSV.
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
	 * FAQ accordion HTML.
	 *
	 * @param array $items FAQ items.
	 * @return string
	 */
	public static function render_faq(array $items) {
		$items = self::sanitize_faq_items($items);
		if (empty($items)) {
			return '';
		}
		ob_start();
		echo '<div class="wdp-faq" role="group" aria-label="' . esc_attr__('Sık sorulan sorular', 'woo-donation-popup') . '">';
		foreach ($items as $i => $item) {
			$id = 'wdp-faq-' . (int) $i . '-' . wp_unique_id();
			echo '<details class="wdp-faq__item">';
			echo '<summary class="wdp-faq__q" id="' . esc_attr($id) . '">' . esc_html($item['q']) . '</summary>';
			echo '<div class="wdp-faq__a">' . esc_html($item['a']) . '</div>';
			echo '</details>';
		}
		echo '</div>';
		return trim(ob_get_clean());
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
		$percent = (float) $percent;
		if ($percent <= 0) {
			return '';
		}
		$percent = min(15, max(0.5, $percent));
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
		<?php
		return trim(ob_get_clean());
	}
}

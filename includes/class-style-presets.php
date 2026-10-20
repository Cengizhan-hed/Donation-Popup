<?php
/**
 * Stil paketi listeleme, uygulama, özel paket kaydı ve import/export.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Style_Presets
 */
class WDP_Style_Presets {

	const OPTION_CUSTOM_PACKS = 'wdp_custom_style_presets';

	/**
	 * Built-in + custom packs.
	 *
	 * @return array<string, array>
	 */
	public static function get_all() {
		$builtin = include WDP_PLUGIN_DIR . 'includes/config/style-presets.php';
		if (!is_array($builtin)) {
			$builtin = array();
		}
		$custom = get_option(self::OPTION_CUSTOM_PACKS, array());
		if (!is_array($custom)) {
			$custom = array();
		}
		return array_merge($builtin, $custom);
	}

	/**
	 * @param string $id Preset id.
	 * @return array|null
	 */
	public static function get($id) {
		$all = self::get_all();
		$id  = sanitize_key((string) $id);
		return isset($all[ $id ]) && is_array($all[ $id ]) ? $all[ $id ] : null;
	}

	/**
	 * Admin cards payload (no heavy token dumps in labels).
	 *
	 * @return array<int, array{id:string,label:string,description:string}>
	 */
	public static function get_cards_for_admin() {
		$cards = array();
		foreach (self::get_all() as $id => $pack) {
			$swatch = '';
			if (!empty($pack['swatch'])) {
				$swatch = (string) $pack['swatch'];
			} elseif (!empty($pack['button']['brand_color'])) {
				$swatch = (string) $pack['button']['brand_color'];
			} elseif (!empty($pack['button']['button_primary_color'])) {
				$swatch = (string) $pack['button']['button_primary_color'];
			}
			$cards[] = array(
				'id'          => (string) $id,
				'label'       => isset($pack['label']) ? (string) $pack['label'] : (string) $id,
				'description' => isset($pack['description']) ? (string) $pack['description'] : '',
				'swatch'      => $swatch,
			);
		}
		return $cards;
	}

	/**
	 * Full packs for JS apply (field fill).
	 *
	 * @return array<string, array>
	 */
	public static function get_packs_for_js() {
		$out = array();
		foreach (self::get_all() as $id => $pack) {
			$out[ $id ] = array(
				'label'       => isset($pack['label']) ? (string) $pack['label'] : $id,
				'description' => isset($pack['description']) ? (string) $pack['description'] : '',
				'button'      => isset($pack['button']) && is_array($pack['button']) ? $pack['button'] : array(),
				'shareholder' => isset($pack['shareholder']) && is_array($pack['shareholder']) ? $pack['shareholder'] : array(),
				'progress'    => isset($pack['progress']) && is_array($pack['progress']) ? $pack['progress'] : array(),
				'success'     => isset($pack['success']) && is_array($pack['success']) ? $pack['success'] : array(),
			);
		}
		return $out;
	}

	/**
	 * Apply a preset to stored options (merge into each option group).
	 *
	 * @param string $id Preset id.
	 * @return bool
	 */
	public static function apply_to_options($id) {
		$pack = self::get($id);
		if (!$pack) {
			return false;
		}

		if (!empty($pack['button']) && is_array($pack['button'])) {
			$current = get_option('wdp_button_settings', array());
			if (!is_array($current)) {
				$current = array();
			}
			$merged = array_merge($current, $pack['button']);
			$merged['style_preset_id'] = sanitize_key($id);
			if (isset($merged['ui_border_radius'])) {
				$r = absint($merged['ui_border_radius']);
				$merged['button_border_radius']       = $r;
				$merged['modal_border_radius']        = $r;
				$merged['input_border_radius']        = $r;
				$merged['popup_button_border_radius'] = $r;
			}
			if (!empty($pack['shareholder']['shareholder_density']) && empty($merged['form_density'])) {
				$merged['form_density'] = $pack['shareholder']['shareholder_density'];
			}
			// Sync global brand color + derived palette from preset primary.
			if (!empty($merged['button_primary_color']) && class_exists('WDP_Color_Palette')) {
				$merged = WDP_Color_Palette::apply_to_button_settings($merged, $merged['button_primary_color']);
			} elseif (!empty($merged['button_primary_color'])) {
				$merged['brand_color'] = sanitize_hex_color($merged['button_primary_color']) ?: $merged['button_primary_color'];
			}
			update_option('wdp_button_settings', $merged, false);
		}

		if (!empty($pack['shareholder']) && is_array($pack['shareholder'])) {
			$current = get_option('wdp_shareholder_settings', array());
			if (!is_array($current)) {
				$current = array();
			}
			$merged_share = array_merge($current, $pack['shareholder']);
			$brand_for_share = '';
			$button_opt = get_option('wdp_button_settings', array());
			if (is_array($button_opt) && !empty($button_opt['brand_color'])) {
				$brand_for_share = (string) $button_opt['brand_color'];
			} elseif (!empty($pack['button']['brand_color'])) {
				$brand_for_share = (string) $pack['button']['brand_color'];
			} elseif (!empty($pack['button']['button_primary_color'])) {
				$brand_for_share = (string) $pack['button']['button_primary_color'];
			}
			if ($brand_for_share && class_exists('WDP_Color_Palette')) {
				$merged_share = WDP_Color_Palette::apply_to_shareholder_settings($merged_share, $brand_for_share);
			}
			update_option('wdp_shareholder_settings', $merged_share, false);
		}

		if (!empty($pack['progress']) && is_array($pack['progress'])) {
			$current = get_option('wdp_progress_bar_settings', array());
			if (!is_array($current)) {
				$current = array();
			}
			update_option('wdp_progress_bar_settings', array_merge($current, $pack['progress']), false);
		}

		if (!empty($pack['success']) && is_array($pack['success'])) {
			$current = get_option('wdp_success_settings', array());
			if (!is_array($current)) {
				$current = array();
			}
			update_option('wdp_success_settings', array_merge($current, $pack['success']), false);
		}

		update_option('wdp_cache_version', (string) time(), false);
		return true;
	}

	/**
	 * Export current visual options as a portable pack JSON structure.
	 *
	 * @param string $label Pack label.
	 * @return array
	 */
	public static function export_current($label = '') {
		$button = get_option('wdp_button_settings', array());
		$share  = get_option('wdp_shareholder_settings', array());
		$prog   = get_option('wdp_progress_bar_settings', array());
		$succ   = get_option('wdp_success_settings', array());

		$button_keys = array(
			'button_primary_color', 'button_primary_hover', 'button_checkout_color', 'button_checkout_hover',
			'ui_border_radius', 'modal_background_color', 'title_color', 'title_font_size', 'close_button_color',
			'input_border_color', 'label_color', 'label_font_size', 'label_font_weight', 'placeholder_color', 'form_gap',
			'icon_field_user', 'icon_field_note', 'icon_field_email', 'icon_cart', 'icon_checkout', 'icon_trust',
			'trust_strip_enabled', 'trust_strip_text', 'enable_field_icons',
			'form_density', 'glass_blur_px', 'glass_fill_opacity', 'elevation_level', 'overlay_tint', 'overlay_opacity',
			'body_font_family', 'motion_intensity', 'chip_style', 'module_order', 'trust_badges',
			'enable_donor_email', 'enable_dedication', 'enable_anonymous', 'dedication_placeholder',
			'enable_privacy_notice', 'privacy_notice_text', 'privacy_notice_url',
		);
		$share_keys = array(
			'shareholder_card_bg', 'shareholder_card_border', 'shareholder_card_radius',
			'shareholder_header_bg', 'shareholder_header_color', 'shareholder_header_bg_hover',
			'shareholders_area_bg', 'shareholders_area_border', 'shareholder_density', 'shareholder_layout',
		);
		$prog_keys = array(
			'container_bg', 'container_border', 'track_bg', 'fill_color', 'pending_bg', 'preview_bg',
			'bar_height', 'enable_celebrate',
		);
		$succ_keys = array(
			'success_button_color', 'success_button_hover', 'success_button_radius',
			'success_message_bg', 'success_message_color', 'success_message_border',
			'mini_cart_bg', 'mini_cart_border', 'mini_cart_radius',
		);

		$pick = static function ($src, $keys) {
			$out = array();
			if (!is_array($src)) {
				return $out;
			}
			foreach ($keys as $k) {
				if (array_key_exists($k, $src)) {
					$out[ $k ] = $src[ $k ];
				}
			}
			return $out;
		};

		return array(
			'version'     => 1,
			'exported_at' => gmdate('c'),
			'label'       => $label !== '' ? $label : __('Özel paket', 'woo-donation-popup'),
			'description' => __('Mevcut ayarlardan dışa aktarıldı', 'woo-donation-popup'),
			'button'      => $pick($button, $button_keys),
			'shareholder' => $pick($share, $share_keys),
			'progress'    => $pick($prog, $prog_keys),
			'success'     => $pick($succ, $succ_keys),
		);
	}

	/**
	 * Import a pack into custom presets store and optionally apply.
	 *
	 * @param array $pack   Pack data.
	 * @param bool  $apply  Apply after save.
	 * @return string|WP_Error Preset id or error.
	 */
	public static function import_pack(array $pack, $apply = true) {
		$label = isset($pack['label']) ? sanitize_text_field((string) $pack['label']) : __('İçe aktarılan paket', 'woo-donation-popup');
		$id    = 'custom_' . substr(md5(wp_json_encode($pack) . microtime()), 0, 10);

		$clean = array(
			'label'       => $label,
			'description' => isset($pack['description']) ? sanitize_text_field((string) $pack['description']) : '',
			'button'      => isset($pack['button']) && is_array($pack['button']) ? self::sanitize_token_map($pack['button']) : array(),
			'shareholder' => isset($pack['shareholder']) && is_array($pack['shareholder']) ? self::sanitize_token_map($pack['shareholder']) : array(),
			'progress'    => isset($pack['progress']) && is_array($pack['progress']) ? self::sanitize_token_map($pack['progress']) : array(),
			'success'     => isset($pack['success']) && is_array($pack['success']) ? self::sanitize_token_map($pack['success']) : array(),
		);

		$custom = get_option(self::OPTION_CUSTOM_PACKS, array());
		if (!is_array($custom)) {
			$custom = array();
		}
		$custom[ $id ] = $clean;
		update_option(self::OPTION_CUSTOM_PACKS, $custom, false);

		if ($apply) {
			self::apply_to_options($id);
		}

		return $id;
	}

	/**
	 * @param array $map Token map.
	 * @return array
	 */
	private static function sanitize_token_map(array $map) {
		$out = array();
		foreach ($map as $key => $value) {
			$k = sanitize_key((string) $key);
			if ($k === '') {
				continue;
			}
			if (is_string($value) && preg_match('/^#[0-9a-fA-F]{3,8}$/', $value)) {
				$out[ $k ] = sanitize_hex_color($value) ? sanitize_hex_color($value) : '#036a37';
			} elseif (is_numeric($value)) {
				$out[ $k ] = (string) absint($value);
			} else {
				$out[ $k ] = sanitize_text_field((string) $value);
			}
		}
		return $out;
	}
}

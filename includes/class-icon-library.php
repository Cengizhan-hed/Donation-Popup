<?php
/**
 * Hazır SVG ikon seti, attachment çözümleme ve buton ikonları JS verisi.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Icon_Library
 */
class WDP_Icon_Library {

	/**
	 * Built-in SVG set (key => markup without wrapper).
	 *
	 * @return array<string, string>
	 */
	public static function get_builtins() {
		return array(
			'user'     => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1c0 .55.45 1 1 1h14c.55 0 1-.45 1-1v-1c0-2.66-5.33-4-8-4z"/></svg>',
			'note'     => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
			'email'    => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
			'phone'    => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg>',
			'cart'     => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>',
			'checkout' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>',
			'shield'   => '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 9.5C8 19.2 5 15.5 5 11V6l7-3z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M9.5 12.2l1.8 1.8 3.7-3.8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>',
			'heart'    => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
			'gift'     => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20 7h-2.2c.1-.3.2-.7.2-1 0-1.7-1.3-3-3-3-1.1 0-2 .5-2.6 1.4C11.8 3.5 10.9 3 9.8 3c-1.7 0-3 1.3-3 3 0 .3.1.7.2 1H4c-1.1 0-2 .9-2 2v2c0 .6.4 1 1 1h1v9c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-9h1c.6 0 1-.4 1-1V9c0-1.1-.9-2-2-2zM9.8 5c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zm5 0c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zM5 19v-7h6v7H5zm14 0h-6v-7h6v7z"/></svg>',
			'star'     => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 17.3l6.2 3.7-1.6-7.1L22 9.2l-7.2-.6L12 2 9.2 8.6 2 9.2l5.4 4.7-1.6 7.1L12 17.3z"/></svg>',
			'check'    => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>',
			'users'    => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
			'clock'    => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>',
			'lock'     => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10z"/></svg>',
			'continue' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></svg>',
		);
	}

	/**
	 * Admin picker list.
	 *
	 * @return array<int, array{id:string,label:string,svg:string}>
	 */
	public static function get_builtins_for_admin() {
		$labels = array(
			'user'     => __('Kullanıcı', 'woo-donation-popup'),
			'note'     => __('Not', 'woo-donation-popup'),
			'email'    => __('E-posta', 'woo-donation-popup'),
			'phone'    => __('Telefon', 'woo-donation-popup'),
			'cart'     => __('Sepet', 'woo-donation-popup'),
			'checkout' => __('Ödeme / Kalkan', 'woo-donation-popup'),
			'shield'   => __('Kalkan', 'woo-donation-popup'),
			'heart'    => __('Kalp', 'woo-donation-popup'),
			'gift'     => __('Hediye', 'woo-donation-popup'),
			'star'     => __('Yıldız', 'woo-donation-popup'),
			'check'    => __('Onay', 'woo-donation-popup'),
			'continue' => __('Devam', 'woo-donation-popup'),
			'users'    => __('Topluluk', 'woo-donation-popup'),
			'clock'    => __('Saat', 'woo-donation-popup'),
			'lock'     => __('Kilit', 'woo-donation-popup'),
		);
		$list = array();
		foreach (self::get_builtins() as $id => $svg) {
			$list[] = array(
				'id'    => $id,
				'label' => isset($labels[ $id ]) ? $labels[ $id ] : $id,
				'svg'   => $svg,
			);
		}
		return $list;
	}

	/**
	 * Resolve icon setting value to safe SVG/HTML.
	 *
	 * Value formats:
	 * - builtin:user
	 * - attachment:123
	 * - empty → fallback builtin key
	 *
	 * @param string $value        Setting value.
	 * @param string $fallback_key Builtin key.
	 * @param string $class        Optional CSS class on svg/img wrapper content.
	 * @return string Safe HTML.
	 */
	public static function resolve($value, $fallback_key = 'user', $class = '') {
		$value = trim((string) $value);
		$builtins = self::get_builtins();
		$fallback_key = isset($builtins[ $fallback_key ]) ? $fallback_key : 'user';

		if ($value === '') {
			return self::wrap_svg($builtins[ $fallback_key ], $class);
		}

		if (strpos($value, 'builtin:') === 0) {
			$key = substr($value, 8);
			$key = sanitize_key($key);
			if (isset($builtins[ $key ])) {
				return self::wrap_svg($builtins[ $key ], $class);
			}
			return self::wrap_svg($builtins[ $fallback_key ], $class);
		}

		if (strpos($value, 'attachment:') === 0) {
			$id = absint(substr($value, 11));
			if ($id > 0) {
				$url = wp_get_attachment_url($id);
				$mime = get_post_mime_type($id);
				if ($url && is_string($mime) && strpos($mime, 'image/') === 0) {
					$cls = $class !== '' ? ' class="' . esc_attr($class) . '"' : '';
					return '<img src="' . esc_url($url) . '" alt="" width="22" height="22"' . $cls . ' loading="lazy" decoding="async" />';
				}
			}
			return self::wrap_svg($builtins[ $fallback_key ], $class);
		}

		// Bare builtin id.
		$key = sanitize_key($value);
		if (isset($builtins[ $key ])) {
			return self::wrap_svg($builtins[ $key ], $class);
		}

		return self::wrap_svg($builtins[ $fallback_key ], $class);
	}

	/**
	 * @param string $svg   Inner svg.
	 * @param string $class Class name.
	 * @return string
	 */
	private static function wrap_svg($svg, $class = '') {
		if ($class === '') {
			return $svg;
		}
		if (strpos($svg, 'class=') !== false) {
			return preg_replace('/class="/', 'class="' . esc_attr($class) . ' ', $svg, 1);
		}
		return preg_replace('/<svg\b/', '<svg class="' . esc_attr($class) . '"', $svg, 1);
	}

	/**
	 * Icon settings from button options with defaults.
	 *
	 * @return array<string, string>
	 */
	public static function get_settings_map() {
		$settings = get_option('wdp_button_settings', array());
		if (!is_array($settings)) {
			$settings = array();
		}
		$defaults = array(
			'icon_field_user'  => 'builtin:user',
			'icon_field_note'  => 'builtin:note',
			'icon_field_email' => 'builtin:email',
			'icon_cart'        => 'builtin:cart',
			'icon_checkout'    => 'builtin:checkout',
			'icon_trust'       => 'builtin:shield',
			'icon_continue'    => 'builtin:continue',
			'enable_field_icons' => '1',
		);
		$map = array();
		foreach ($defaults as $key => $def) {
			$map[ $key ] = isset($settings[ $key ]) && $settings[ $key ] !== ''
				? sanitize_text_field((string) $settings[ $key ])
				: $def;
		}
		return $map;
	}

	/**
	 * Localized button icons for JS.
	 *
	 * @return array<string, string>
	 */
	public static function get_button_icons_for_js() {
		$map = self::get_settings_map();
		return array(
			'cart'     => self::resolve($map['icon_cart'], 'cart', 'wdp-btn__icon'),
			'checkout' => self::resolve($map['icon_checkout'], 'checkout', 'wdp-btn__icon'),
			'continue' => self::resolve($map['icon_continue'], 'continue', 'wdp-btn__icon'),
			'user'     => self::resolve($map['icon_field_user'], 'user', 'wdp-field-stack__svg'),
			'note'     => self::resolve($map['icon_field_note'], 'note', 'wdp-field-stack__svg'),
			'email'    => self::resolve($map['icon_field_email'], 'email', 'wdp-field-stack__svg'),
			'trust'    => self::resolve($map['icon_trust'], 'shield'),
		);
	}

	/**
	 * Sanitize icon value from request.
	 *
	 * @param mixed  $value Raw.
	 * @param string $default Default.
	 * @return string
	 */
	public static function sanitize_icon_value($value, $default = 'builtin:user') {
		$value = sanitize_text_field((string) wp_unslash($value));
		if ($value === '') {
			return $default;
		}
		if (preg_match('/^builtin:[a-z0-9_-]+$/', $value)) {
			$key = substr($value, 8);
			$builtins = self::get_builtins();
			return isset($builtins[ $key ]) ? $value : $default;
		}
		if (preg_match('/^attachment:(\d+)$/', $value, $m)) {
			$id = absint($m[1]);
			return $id > 0 ? 'attachment:' . $id : $default;
		}
		$key = sanitize_key($value);
		$builtins = self::get_builtins();
		if (isset($builtins[ $key ])) {
			return 'builtin:' . $key;
		}
		return $default;
	}
}

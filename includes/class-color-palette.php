<?php
/**
 * Tek bir marka renginden açık/koyu ton paleti üretir.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Color_Palette
 */
class WDP_Color_Palette {

	/**
	 * Build a cohesive brand palette from one hex color.
	 *
	 * @param string $hex Primary brand color.
	 * @return array<string,string>
	 */
	public static function from_hex($hex) {
		$hex = self::normalize_hex($hex);
		if ($hex === '') {
			$hex = '#0f608b';
		}

		$rgb = self::hex_to_rgb($hex);
		$hsl = self::rgb_to_hsl($rgb[0], $rgb[1], $rgb[2]);

		$primary = $hex;
		$hover   = self::hsl_to_hex(self::clamp($hsl[0], 0, 360), self::clamp($hsl[1] * 1.05, 0, 100), self::clamp($hsl[2] - 8, 8, 92));
		$dark    = self::hsl_to_hex(self::clamp($hsl[0], 0, 360), self::clamp($hsl[1] * 1.08, 0, 100), self::clamp($hsl[2] - 16, 6, 88));
		$soft    = self::mix_hex($primary, '#ffffff', 0.88);
		$soft_2  = self::mix_hex($primary, '#ffffff', 0.94);
		$muted   = self::mix_hex($primary, '#ffffff', 0.72);
		$border  = self::mix_hex($primary, '#e2e8f0', 0.55);
		$track   = self::mix_hex($primary, '#f1f5f9', 0.82);
		$pending = self::mix_hex($primary, '#ffffff', 0.42);
		$preview = self::mix_hex($primary, '#94a3b8', 0.35);
		$checkout = self::hsl_to_hex(self::clamp($hsl[0] + 8, 0, 360), self::clamp(min(92, $hsl[1] + 6), 0, 100), self::clamp($hsl[2] + 6, 18, 55));
		$checkout_hover = self::mix_hex($checkout, '#0f172a', 0.18);
		$on_primary = self::contrast_ink($primary);

		return array(
			'primary'         => $primary,
			'primary_hover'   => $hover,
			'primary_dark'    => $dark,
			'primary_soft'    => $soft,
			'primary_soft_2'  => $soft_2,
			'primary_muted'   => $muted,
			'primary_border'  => $border,
			'on_primary'      => $on_primary,
			'checkout'        => $checkout,
			'checkout_hover'  => $checkout_hover,
			'progress_fill'   => $primary,
			'progress_pending'=> $pending,
			'progress_preview'=> $preview,
			'progress_track'  => $track,
			'success'         => $checkout,
		);
	}

	/**
	 * Apply palette onto button / form settings keys.
	 *
	 * @param array  $settings Existing settings.
	 * @param string $hex      Brand color.
	 * @return array
	 */
	public static function apply_to_button_settings(array $settings, $hex) {
		$p = self::from_hex($hex);
		$settings['brand_color']            = $p['primary'];
		$settings['button_primary_color']   = $p['primary'];
		$settings['button_primary_hover']   = $p['primary_hover'];
		$settings['popup_button_color']     = $p['primary'];
		$settings['popup_button_hover']     = $p['primary_hover'];
		$settings['popup_button_text_color']= $p['on_primary'];
		$settings['button_checkout_color']  = $p['checkout'];
		$settings['button_checkout_hover']  = $p['checkout_hover'];
		$settings['cart_item_price_color']  = $p['primary'];
		// Form chrome — global marka; tek tek ayar kaydı sonra override eder.
		$settings['title_color']            = $p['primary_dark'];
		$settings['label_color']            = $p['primary_dark'];
		$settings['input_border_color']     = $p['primary_border'];
		return $settings;
	}

	/**
	 * Apply palette onto progress bar option array.
	 *
	 * @param array  $progress Progress settings.
	 * @param string $hex      Brand color.
	 * @return array
	 */
	public static function apply_to_progress_settings(array $progress, $hex) {
		$p = self::from_hex($hex);
		$progress['fill_color']        = $p['progress_fill'];
		$progress['pending_bg']        = $p['progress_pending'];
		$progress['preview_bg']        = $p['progress_preview'];
		$progress['track_bg']          = $p['progress_track'];
		$progress['percentage_text']   = $p['primary_dark'];
		$progress['container_border']  = $p['primary_border'];
		$progress['container_bg']      = '#ffffff';
		return $progress;
	}

	/**
	 * Apply palette onto success screen option array.
	 *
	 * @param array  $success Success settings.
	 * @param string $hex     Brand color.
	 * @return array
	 */
	public static function apply_to_success_settings(array $success, $hex) {
		$p = self::from_hex($hex);
		$success['success_button_color']  = $p['primary'];
		$success['success_button_hover']  = $p['primary_hover'];
		$success['success_message_color'] = $p['primary'];
		$success['cart_item_price_color'] = $p['primary'];
		$success['success_message_bg']     = $p['primary_soft_2'];
		$success['success_message_border'] = $p['primary_border'];
		$success['mini_cart_bg']           = $p['primary_soft_2'];
		$success['mini_cart_border']       = $p['primary_border'];
		return $success;
	}

	/**
	 * Apply palette onto shareholder (hisseli) option array.
	 *
	 * @param array  $share Shareholder settings.
	 * @param string $hex   Brand color.
	 * @return array
	 */
	public static function apply_to_shareholder_settings(array $share, $hex) {
		$p = self::from_hex($hex);
		$share['shareholder_header_bg']          = $p['primary'];
		$share['shareholder_header_bg_hover']    = $p['primary_hover'];
		$share['shareholder_header_color']       = $p['on_primary'];
		$share['shareholders_scrollbar_color']   = $p['primary'];
		$share['share_counter_button_color']     = $p['primary'];
		$share['shareholder_card_border']        = $p['primary_border'];
		$share['shareholders_area_bg']           = $p['primary_soft_2'];
		$share['shareholders_area_border']       = $p['primary_border'];
		return $share;
	}

	/**
	 * CSS custom properties block (without selector braces).
	 *
	 * @param string $hex Brand color.
	 * @return string
	 */
	public static function to_css_variables($hex) {
		$p = self::from_hex($hex);
		$lines = array(
			'--wdp-primary: ' . $p['primary'],
			'--wdp-primary-hover: ' . $p['primary_hover'],
			'--wdp-primary-dark: ' . $p['primary_dark'],
			'--wdp-primary-soft: ' . $p['primary_soft'],
			'--wdp-primary-soft-2: ' . $p['primary_soft_2'],
			'--wdp-primary-muted: ' . $p['primary_muted'],
			'--wdp-primary-border: ' . $p['primary_border'],
			'--wdp-on-primary: ' . $p['on_primary'],
			'--wdp-success: ' . $p['success'],
			'--wdp-autofill-row-bg: ' . $p['primary_soft_2'],
			'--wdp-a-soft: color-mix(in srgb, ' . $p['primary'] . ' 10%, transparent)',
			'--wdp-a-border: color-mix(in srgb, ' . $p['primary'] . ' 22%, transparent)',
		);
		$out = '';
		foreach ($lines as $line) {
			$out .= '  ' . $line . ";\n";
		}
		return $out;
	}

	/**
	 * @param string $hex Hex color.
	 * @return string
	 */
	public static function normalize_hex($hex) {
		$hex = is_string($hex) ? trim($hex) : '';
		$san = sanitize_hex_color($hex);
		return $san ? $san : '';
	}

	/**
	 * @param string $hex Hex.
	 * @return array{0:int,1:int,2:int}
	 */
	private static function hex_to_rgb($hex) {
		$hex = ltrim($hex, '#');
		if (strlen($hex) === 3) {
			$hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
		}
		return array(
			hexdec(substr($hex, 0, 2)),
			hexdec(substr($hex, 2, 2)),
			hexdec(substr($hex, 4, 2)),
		);
	}

	/**
	 * @param int $r Red.
	 * @param int $g Green.
	 * @param int $b Blue.
	 * @return array{0:float,1:float,2:float} H,S,L
	 */
	private static function rgb_to_hsl($r, $g, $b) {
		$r /= 255;
		$g /= 255;
		$b /= 255;
		$max = max($r, $g, $b);
		$min = min($r, $g, $b);
		$l = ($max + $min) / 2;
		$d = $max - $min;
		if ($d < 0.00001) {
			return array(0.0, 0.0, $l * 100);
		}
		$s = $d / (1 - abs(2 * $l - 1));
		if ($max === $r) {
			$h = fmod((($g - $b) / $d), 6);
		} elseif ($max === $g) {
			$h = (($b - $r) / $d) + 2;
		} else {
			$h = (($r - $g) / $d) + 4;
		}
		$h *= 60;
		if ($h < 0) {
			$h += 360;
		}
		return array($h, $s * 100, $l * 100);
	}

	/**
	 * @param float $h Hue.
	 * @param float $s Saturation %.
	 * @param float $l Lightness %.
	 * @return string
	 */
	private static function hsl_to_hex($h, $s, $l) {
		$s /= 100;
		$l /= 100;
		$c = (1 - abs(2 * $l - 1)) * $s;
		$x = $c * (1 - abs(fmod($h / 60, 2) - 1));
		$m = $l - $c / 2;
		if ($h < 60) {
			$r = $c; $g = $x; $b = 0;
		} elseif ($h < 120) {
			$r = $x; $g = $c; $b = 0;
		} elseif ($h < 180) {
			$r = 0; $g = $c; $b = $x;
		} elseif ($h < 240) {
			$r = 0; $g = $x; $b = $c;
		} elseif ($h < 300) {
			$r = $x; $g = 0; $b = $c;
		} else {
			$r = $c; $g = 0; $b = $x;
		}
		return sprintf(
			'#%02x%02x%02x',
			(int) round(($r + $m) * 255),
			(int) round(($g + $m) * 255),
			(int) round(($b + $m) * 255)
		);
	}

	/**
	 * Mix hex toward another (amount = weight of $toward).
	 *
	 * @param string $from   From hex.
	 * @param string $toward Toward hex.
	 * @param float  $amount 0–1.
	 * @return string
	 */
	private static function mix_hex($from, $toward, $amount) {
		$a = self::hex_to_rgb(self::normalize_hex($from) ?: '#036a37');
		$b = self::hex_to_rgb(self::normalize_hex($toward) ?: '#ffffff');
		$t = self::clamp($amount, 0, 1);
		return sprintf(
			'#%02x%02x%02x',
			(int) round($a[0] + ($b[0] - $a[0]) * $t),
			(int) round($a[1] + ($b[1] - $a[1]) * $t),
			(int) round($a[2] + ($b[2] - $a[2]) * $t)
		);
	}

	/**
	 * Pick white or near-black ink for contrast on $bg.
	 *
	 * @param string $bg Background hex.
	 * @return string
	 */
	private static function contrast_ink($bg) {
		$rgb = self::hex_to_rgb(self::normalize_hex($bg) ?: '#036a37');
		$yiq = (($rgb[0] * 299) + ($rgb[1] * 587) + ($rgb[2] * 114)) / 1000;
		return ($yiq >= 160) ? '#0f172a' : '#ffffff';
	}

	/**
	 * @param float $v Value.
	 * @param float $min Min.
	 * @param float $max Max.
	 * @return float
	 */
	private static function clamp($v, $min, $max) {
		if ($v < $min) {
			return $min;
		}
		if ($v > $max) {
			return $max;
		}
		return $v;
	}
}

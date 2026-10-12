<?php
/**
 * Form / sayaç SVG ikonları ve kses kuralları.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Svg_Icons
 */
class WDP_Svg_Icons {

	/**
	 * Allowed tags for form action button SVG icons.
	 *
	 * @return array<string, array<string, bool>>
	 */
	public static function form_button_svg_kses() {
		return array(
			'svg'      => array(
				'class'           => true,
				'viewbox'         => true,
				'xmlns'           => true,
				'fill'            => true,
				'aria-hidden'     => true,
				'focusable'       => true,
			),
			'path'     => array(
				'd'               => true,
				'fill'            => true,
				'stroke'          => true,
				'stroke-width'    => true,
				'stroke-linecap'  => true,
				'stroke-linejoin' => true,
			),
			'rect'     => array(
				'x'               => true,
				'y'               => true,
				'width'           => true,
				'height'          => true,
				'rx'              => true,
				'fill'            => true,
				'stroke'          => true,
				'stroke-width'    => true,
			),
			'circle'   => array(
				'cx'              => true,
				'cy'              => true,
				'r'               => true,
				'fill'            => true,
				'stroke'          => true,
				'stroke-width'    => true,
			),
			'polyline' => array(
				'points'          => true,
				'fill'            => true,
				'stroke'          => true,
				'stroke-width'    => true,
				'stroke-linecap'  => true,
				'stroke-linejoin' => true,
			),
		);
	}

	/**
	 * Sayaç — eksi (kalın çizgi).
	 *
	 * @return string Safe HTML.
	 */
	public static function get_counter_icon_minus_svg() {
		$svg = '<svg class="wdp-counter-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
			. '<path d="M5.5 12h13" stroke="currentColor" stroke-width="2.75" stroke-linecap="round"/>'
			. '</svg>';

		return wp_kses($svg, self::form_button_svg_kses());
	}

	/**
	 * Sayaç — artı (kalın çizgi).
	 *
	 * @return string Safe HTML.
	 */
	public static function get_counter_icon_plus_svg() {
		$svg = '<svg class="wdp-counter-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
			. '<path d="M12 5.5v13M5.5 12h13" stroke="currentColor" stroke-width="2.75" stroke-linecap="round"/>'
			. '</svg>';

		return wp_kses($svg, self::form_button_svg_kses());
	}

	/**
	 * Sepete ekle — alışveriş arabası.
	 *
	 * @return string Safe HTML.
	 */
	public static function get_form_button_icon_cart_svg() {
		if (class_exists('WDP_Icon_Library')) {
			$map = WDP_Icon_Library::get_settings_map();
			return WDP_Icon_Library::resolve($map['icon_cart'], 'cart', 'wdp-btn__icon');
		}
		$svg = '<svg class="wdp-btn__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
			. '<path d="M3.75 3.75h2.2l1.95 10.9a1.65 1.65 0 0 0 1.62 1.35h7.98a1.65 1.65 0 0 0 1.6-1.22l1.55-5.78H8.2" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/>'
			. '<circle cx="10" cy="19.25" r="1.6" fill="currentColor"/>'
			. '<circle cx="17.25" cy="19.25" r="1.6" fill="currentColor"/>'
			. '</svg>';

		return wp_kses($svg, self::form_button_svg_kses());
	}

	/**
	 * Ödemeye git — kalkan + onay.
	 *
	 * @return string Safe HTML.
	 */
	public static function get_form_button_icon_checkout_svg() {
		if (class_exists('WDP_Icon_Library')) {
			$map = WDP_Icon_Library::get_settings_map();
			return WDP_Icon_Library::resolve($map['icon_checkout'], 'checkout', 'wdp-btn__icon');
		}
		$svg = '<svg class="wdp-btn__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
			. '<path d="M12 2.75 19.25 6.1v5.65c0 4.05-2.78 7.3-7.25 8.6-4.47-1.3-7.25-4.55-7.25-8.6V6.1L12 2.75z" stroke="currentColor" stroke-width="2.35" stroke-linejoin="round"/>'
			. '<path d="M8.25 12.1 10.6 14.45 16.1 8.95" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/>'
			. '</svg>';

		return wp_kses($svg, self::form_button_svg_kses());
	}

	/**
	 * Bağışa devam — artı (yeni bağış ekle).
	 *
	 * @return string Safe HTML.
	 */
	public static function get_form_button_icon_continue_svg() {
		if (class_exists('WDP_Icon_Library')) {
			$map = WDP_Icon_Library::get_settings_map();
			return WDP_Icon_Library::resolve($map['icon_continue'], 'continue', 'wdp-btn__icon');
		}
		$svg = '<svg class="wdp-btn__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
			. '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.35"/>'
			. '<path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2.35" stroke-linecap="round"/>'
			. '</svg>';

		return wp_kses($svg, self::form_button_svg_kses());
	}

	/**
	 * Inline SVG icons for premium field stack (filled, consistent weight).
	 *
	 * @return string
	 */
	public static function field_stack_icon_user_svg() {
		if (class_exists('WDP_Icon_Library')) {
			$map = WDP_Icon_Library::get_settings_map();
			return WDP_Icon_Library::resolve($map['icon_field_user'], 'user', 'wdp-field-stack__svg');
		}
		$svg = '<svg class="wdp-field-stack__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1c0 .55.45 1 1 1h14c.55 0 1-.45 1-1v-1c0-2.66-5.33-4-8-4z"/></svg>';
		return wp_kses(
			$svg,
			array(
				'svg'  => array(
					'class'       => true,
					'viewbox'     => true,
					'aria-hidden' => true,
					'focusable'   => true,
				),
				'path' => array(
					'fill' => true,
					'd'    => true,
				),
			)
		);
	}

	/**
	 * @return string
	 */
	public static function field_stack_icon_note_svg() {
		if (class_exists('WDP_Icon_Library')) {
			$map = WDP_Icon_Library::get_settings_map();
			return WDP_Icon_Library::resolve($map['icon_field_note'], 'note', 'wdp-field-stack__svg');
		}
		$svg = '<svg class="wdp-field-stack__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>';
		return wp_kses(
			$svg,
			array(
				'svg'  => array(
					'class'       => true,
					'viewbox'     => true,
					'aria-hidden' => true,
					'focusable'   => true,
				),
				'path' => array(
					'fill' => true,
					'd'    => true,
				),
			)
		);
	}

	/**
	 * @return string
	 */
	public static function field_stack_icon_email_svg() {
		if (class_exists('WDP_Icon_Library')) {
			$map = WDP_Icon_Library::get_settings_map();
			return WDP_Icon_Library::resolve($map['icon_field_email'], 'email', 'wdp-field-stack__svg');
		}
		$svg = '<svg class="wdp-field-stack__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>';
		return wp_kses(
			$svg,
			array(
				'svg'  => array(
					'class'       => true,
					'viewbox'     => true,
					'aria-hidden' => true,
					'focusable'   => true,
				),
				'path' => array(
					'fill' => true,
					'd'    => true,
				),
			)
		);
	}
}

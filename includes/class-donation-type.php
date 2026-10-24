<?php
/**
 * Ürün bağış tipi (sabit / bağışçı belirler / hisseli / hedefli kampanya) ile eski meta bayrakları arasındaki eşleme.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Single "donation type" projection over the legacy product meta flags.
 *
 * The type is never stored on its own: `_allow_custom_price`, `_allow_multiple_shares`
 * and `_enable_progress_bar` stay the single source of truth that the front end reads.
 */
class WDP_Donation_Type {
	const FIXED    = 'fixed';
	const CUSTOM   = 'custom';
	const SHARES   = 'shares';
	const CAMPAIGN = 'campaign';

	const DEFAULT_MAX_SHARES = '7';
	const DEFAULT_GOAL       = '100000';

	/**
	 * Type ids in display order.
	 *
	 * @return string[]
	 */
	public static function ids() {
		return array(self::FIXED, self::CUSTOM, self::SHARES, self::CAMPAIGN);
	}

	/**
	 * @param mixed $type Raw type.
	 * @return bool
	 */
	public static function is_valid($type) {
		return is_string($type) && in_array($type, self::ids(), true);
	}

	/**
	 * @param mixed  $type     Raw type.
	 * @param string $fallback Returned when the value is not a known type.
	 * @return string
	 */
	public static function sanitize($type, $fallback = self::FIXED) {
		$type = is_scalar($type) ? sanitize_key((string) $type) : '';
		return self::is_valid($type) ? $type : $fallback;
	}

	/**
	 * Labels and one-line descriptions for admin UI.
	 *
	 * @return array<string, array{label:string, description:string, icon:string}>
	 */
	public static function get_definitions() {
		return array(
			self::FIXED    => array(
				'label'       => __('Fixed amount', 'woo-donation-popup'),
				'description' => __('The product’s WooCommerce price is used; the donor only chooses a quantity.', 'woo-donation-popup'),
				'icon'        => 'dashicons-tag',
			),
			self::CUSTOM   => array(
				'label'       => __('Custom amount', 'woo-donation-popup'),
				'description' => __('The donor enters the amount; you can set a minimum if you want.', 'woo-donation-popup'),
				'icon'        => 'dashicons-edit',
			),
			self::SHARES   => array(
				'label'       => __('Share-based', 'woo-donation-popup'),
				'description' => __('The donor chooses the number of shares and enters a name for each share.', 'woo-donation-popup'),
				'icon'        => 'dashicons-groups',
			),
			self::CAMPAIGN => array(
				'label'       => __('Goal-based campaign', 'woo-donation-popup'),
				'description' => __('The goal amount and progress bar are shown; the donor enters the amount.', 'woo-donation-popup'),
				'icon'        => 'dashicons-chart-bar',
			),
		);
	}

	/**
	 * @param string $type Type id.
	 * @return string
	 */
	public static function get_label($type) {
		$defs = self::get_definitions();
		$type = self::sanitize($type);
		return $defs[ $type ]['label'];
	}

	/**
	 * Infer type from legacy flags, mirroring the front-end render priority
	 * (shares → progress → custom amount → fixed price).
	 *
	 * @param bool $allow_custom_price    `_allow_custom_price`.
	 * @param bool $allow_multiple_shares `_allow_multiple_shares`.
	 * @param bool $enable_progress_bar   `_enable_progress_bar`.
	 * @return string
	 */
	public static function infer_from_flags($allow_custom_price, $allow_multiple_shares, $enable_progress_bar) {
		if ($allow_multiple_shares) {
			return self::SHARES;
		}
		if ($enable_progress_bar) {
			return self::CAMPAIGN;
		}
		if ($allow_custom_price) {
			return self::CUSTOM;
		}
		return self::FIXED;
	}

	/**
	 * Infer type from a meta map (only the strict `yes` value counts, like the front end).
	 *
	 * @param array $meta Meta key => value.
	 * @return string
	 */
	public static function infer_from_meta(array $meta) {
		$is_yes = static function ($key) use ($meta) {
			return isset($meta[ $key ]) && $meta[ $key ] === 'yes';
		};

		return self::infer_from_flags(
			$is_yes('_allow_custom_price'),
			$is_yes('_allow_multiple_shares'),
			$is_yes('_enable_progress_bar')
		);
	}

	/**
	 * Current type of a product.
	 *
	 * @param int $product_id Product ID.
	 * @return string
	 */
	public static function for_product($product_id) {
		$product_id = absint($product_id);
		if (!$product_id) {
			return self::FIXED;
		}

		$meta = array();
		foreach (array_keys(self::to_meta(self::FIXED)) as $key) {
			$meta[ $key ] = get_post_meta($product_id, $key, true);
		}

		return self::infer_from_meta($meta);
	}

	/**
	 * Legacy boolean flags a type implies.
	 *
	 * @param string $type Type id.
	 * @return array{allow_custom_price:bool, allow_multiple_shares:bool, enable_progress_bar:bool}
	 */
	public static function to_flags($type) {
		$type = self::sanitize($type);

		return array(
			'allow_custom_price'    => in_array($type, array(self::CUSTOM, self::CAMPAIGN), true),
			'allow_multiple_shares' => $type === self::SHARES,
			'enable_progress_bar'   => $type === self::CAMPAIGN,
		);
	}

	/**
	 * Legacy meta values a type writes.
	 *
	 * @param string $type Type id.
	 * @return array<string, string>
	 */
	public static function to_meta($type) {
		$flags = self::to_flags($type);

		return array(
			'_allow_custom_price'    => $flags['allow_custom_price'] ? 'yes' : 'no',
			'_allow_multiple_shares' => $flags['allow_multiple_shares'] ? 'yes' : 'no',
			'_enable_progress_bar'   => $flags['enable_progress_bar'] ? 'yes' : 'no',
		);
	}

	/**
	 * WP_Query meta_query selecting products of a type (same priority as infer_from_flags()).
	 *
	 * @param string $type Type id.
	 * @return array
	 */
	public static function get_meta_query($type) {
		$type = self::sanitize($type, '');
		if ($type === '') {
			return array();
		}

		$is_yes = static function ($key) {
			return array(
				'key'     => $key,
				'value'   => 'yes',
				'compare' => '=',
			);
		};
		$is_not_yes = static function ($key) {
			return array(
				'relation' => 'OR',
				array(
					'key'     => $key,
					'compare' => 'NOT EXISTS',
				),
				array(
					'key'     => $key,
					'value'   => 'yes',
					'compare' => '!=',
				),
			);
		};

		switch ($type) {
			case self::SHARES:
				return array($is_yes('_allow_multiple_shares'));
			case self::CAMPAIGN:
				return array(
					'relation' => 'AND',
					$is_yes('_enable_progress_bar'),
					$is_not_yes('_allow_multiple_shares'),
				);
			case self::CUSTOM:
				return array(
					'relation' => 'AND',
					$is_yes('_allow_custom_price'),
					$is_not_yes('_allow_multiple_shares'),
					$is_not_yes('_enable_progress_bar'),
				);
			default:
				return array(
					'relation' => 'AND',
					$is_not_yes('_allow_custom_price'),
					$is_not_yes('_allow_multiple_shares'),
					$is_not_yes('_enable_progress_bar'),
				);
		}
	}
}

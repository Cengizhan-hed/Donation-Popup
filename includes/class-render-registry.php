<?php
/**
 * Aynı istekte hangi ürün formunun / modal id'sinin basıldığını tutar; yinelenen HTML'i engeller.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Per-request registry of rendered donation forms and modal shells.
 */
class WDP_Render_Registry {

	/** @var array<int, true> */
	private static $forms = array();

	/** @var array<int, true> Trigger / Donate buttons printed for a product in this request. */
	private static $triggers = array();

	/** @var array<string, true> */
	private static $modals = array();

	/**
	 * Claim an inline form slot. False when this product's form already ran in this request.
	 *
	 * @param int $product_id Product ID.
	 * @return bool
	 */
	public static function claim_form($product_id) {
		$product_id = absint($product_id);
		if ($product_id <= 0) {
			return false;
		}
		if (isset(self::$forms[ $product_id ])) {
			return false;
		}
		self::$forms[ $product_id ] = true;
		return true;
	}

	/**
	 * @param int $product_id Product ID.
	 * @return bool
	 */
	public static function has_form($product_id) {
		return isset(self::$forms[ absint($product_id) ]);
	}

	/**
	 * Duplicate inline form: visitors get '', editors get an HTML comment.
	 *
	 * @param int $product_id Product ID.
	 * @return string
	 */
	public static function duplicate_form_notice($product_id) {
		$product_id = absint($product_id);
		if (!function_exists('current_user_can') || !current_user_can('edit_products')) {
			return '';
		}
		return '<!-- wdp: form already rendered #' . $product_id . ' -->';
	}

	/**
	 * Record that a Donate trigger button was printed for this product.
	 *
	 * @param int $product_id Product ID.
	 * @return void
	 */
	public static function mark_trigger($product_id) {
		$product_id = absint($product_id);
		if ($product_id > 0) {
			self::$triggers[ $product_id ] = true;
		}
	}

	/**
	 * @param int $product_id Product ID.
	 * @return bool
	 */
	public static function has_trigger($product_id) {
		return isset(self::$triggers[ absint($product_id) ]);
	}

	/**
	 * Form or trigger already printed for this product in the request.
	 *
	 * @param int $product_id Product ID.
	 * @return bool
	 */
	public static function has_product_ui($product_id) {
		$product_id = absint($product_id);
		return self::has_form($product_id) || self::has_trigger($product_id);
	}

	/**
	 * Template override skip notice for editors.
	 *
	 * @param int $product_id Product ID.
	 * @return string
	 */
	public static function duplicate_ui_notice($product_id) {
		$product_id = absint($product_id);
		if (!function_exists('current_user_can') || !current_user_can('edit_products')) {
			return '';
		}
		return '<!-- wdp: form or button already rendered #' . $product_id . ' -->';
	}

	/**
	 * Claim a modal/side-panel DOM id. False when that id is already in the page.
	 *
	 * Buttons may render many times; the shell HTML must not.
	 *
	 * @param string $modal_id wdp-modal-ID or wdp-side-panel-ID.
	 * @return bool
	 */
	public static function claim_modal($modal_id) {
		$modal_id = sanitize_html_class((string) $modal_id);
		if ($modal_id === '') {
			return false;
		}
		if (isset(self::$modals[ $modal_id ])) {
			return false;
		}
		self::$modals[ $modal_id ] = true;
		return true;
	}

	/**
	 * @param string $modal_id Modal element id.
	 * @return bool
	 */
	public static function has_modal($modal_id) {
		return isset(self::$modals[ sanitize_html_class((string) $modal_id) ]);
	}

	/**
	 * Modal DOM id for a product and display mode.
	 *
	 * @param int    $product_id Product ID.
	 * @param string $mode       popup|side_panel.
	 * @return string
	 */
	public static function modal_id($product_id, $mode = 'popup') {
		$product_id = absint($product_id);
		return $mode === 'side_panel' ? ('wdp-side-panel-' . $product_id) : ('wdp-modal-' . $product_id);
	}

	/**
	 * @return void
	 */
	public static function reset() {
		self::$forms    = array();
		self::$triggers = array();
		self::$modals   = array();
	}
}

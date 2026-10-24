<?php
/**
 * Bağış modalı / form HTML facade — uygulama includes/templates/ altında.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Templates
 *
 * Public API facade. Implementation lives in:
 * - WDP_Svg_Icons
 * - WDP_Form_Fields_Renderer
 * - WDP_Campaign_Header_Renderer
 * - WDP_Modal_Shell_Renderer
 */
class WDP_Templates {

	/**
	 * Sayaç — eksi (kalın çizgi).
	 *
	 * @return string Safe HTML.
	 */
	public static function get_counter_icon_minus_svg() {
		return WDP_Svg_Icons::get_counter_icon_minus_svg();
	}

	/**
	 * Sayaç — artı (kalın çizgi).
	 *
	 * @return string Safe HTML.
	 */
	public static function get_counter_icon_plus_svg() {
		return WDP_Svg_Icons::get_counter_icon_plus_svg();
	}

	/**
	 * Sepete ekle — alışveriş arabası.
	 *
	 * @return string Safe HTML.
	 */
	public static function get_form_button_icon_cart_svg() {
		return WDP_Svg_Icons::get_form_button_icon_cart_svg();
	}

	/**
	 * Ödemeye git — kalkan + onay.
	 *
	 * @return string Safe HTML.
	 */
	public static function get_form_button_icon_checkout_svg() {
		return WDP_Svg_Icons::get_form_button_icon_checkout_svg();
	}

	/**
	 * Bağışa devam — artı (yeni bağış ekle).
	 *
	 * @return string Safe HTML.
	 */
	public static function get_form_button_icon_continue_svg() {
		return WDP_Svg_Icons::get_form_button_icon_continue_svg();
	}

	/**
	 * Hızlı tutar düğmesi listesi (min altına düşenler elenir).
	 *
	 * @param float|string $min_price  Minimum custom price.
	 * @param int          $product_id Product ID.
	 * @return array<int, float>
	 */
	public static function get_amount_presets($min_price = 0, $product_id = 0) {
		return WDP_Form_Fields_Renderer::get_amount_presets($min_price, $product_id);
	}

	/**
	 * Hızlı tutar düğmesi HTML'i.
	 *
	 * @param float|string $min_price       Minimum price.
	 * @param string       $currency_symbol Currency symbol.
	 * @param array        $options         show (bool), input_selector.
	 * @return string Safe HTML.
	 */
	public static function render_amount_presets($min_price = 0, $currency_symbol = '', array $options = array()) {
		return WDP_Form_Fields_Renderer::render_amount_presets($min_price, $currency_symbol, $options);
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
		return WDP_Form_Fields_Renderer::render_custom_price_amount_row($min_price, $placeholder, $currency_symbol, $options);
	}

	/**
	 * Varsayılan addon açıklama metni (ürün özel metni boşken).
	 *
	 * @return string
	 */
	public static function get_default_addon_donation_message() {
		return WDP_Form_Fields_Renderer::get_default_addon_donation_message();
	}

	/**
	 * Ürün addon metnini çözümler; boşsa varsayılan metin.
	 *
	 * @param string $message Per-product message from meta.
	 * @return string
	 */
	public static function resolve_addon_donation_message($message) {
		return WDP_Form_Fields_Renderer::resolve_addon_donation_message($message);
	}

	/**
	 * İsteğe bağlı alt bağış bloğu.
	 *
	 * @param array $context Addon context.
	 * @return string Safe HTML.
	 */
	public static function render_addon_donation_block($context) {
		return WDP_Form_Fields_Renderer::render_addon_donation_block(is_array($context) ? $context : array());
	}

	/**
	 * Stacked donor fields: name, phone, note, optional email (no dedication).
	 *
	 * @param array $options Context flags.
	 * @return string Safe HTML.
	 */
	public static function render_donor_contact_stack($options = array()) {
		return WDP_Form_Fields_Renderer::render_donor_contact_stack($options);
	}

	/**
	 * Dedication / anonymous block (separate from donor for module_order).
	 *
	 * @param array $options Context flags.
	 * @return string Safe HTML.
	 */
	public static function render_dedication_block($options = array()) {
		return WDP_Form_Fields_Renderer::render_dedication_block($options);
	}

	/**
	 * Render body modules in product module_order.
	 *
	 * @param array $args product_id, context, donor_opts, amount_html.
	 * @return string Safe HTML.
	 */
	public static function render_ordered_body_modules(array $args) {
		return WDP_Form_Fields_Renderer::render_ordered_body_modules($args);
	}

	/**
	 * Shares | progress fields | standard donor+price body (no shell chrome).
	 *
	 * @param array $args Branch inputs.
	 * @return string
	 */
	public static function render_donation_form_fields_body(array $args) {
		return WDP_Form_Fields_Renderer::render_donation_form_fields_body($args);
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
		return WDP_Render_Guard::html(
			static function () use ($product_id, $button_text, $custom_class, $custom_style, $display_mode) {
				return WDP_Modal_Shell_Renderer::render_donation_modal($product_id, $button_text, $custom_class, $custom_style, $display_mode);
			},
			absint($product_id),
			'render_donation_modal'
		);
	}

	/**
	 * Render donation form (direct, no modal)
	 *
	 * @param int   $product_id Product ID.
	 * @param array $atts       Shortcode attributes.
	 * @return string
	 */
	public static function render_donation_form($product_id, $atts = array()) {
		return WDP_Render_Guard::html(
			static function () use ($product_id, $atts) {
				return WDP_Modal_Shell_Renderer::render_donation_form($product_id, is_array($atts) ? $atts : array());
			},
			absint($product_id),
			'render_donation_form'
		);
	}
}

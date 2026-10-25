<?php
/**
 * Yedek düğme: sayfada hiçbir giriş çizilmediyse eklentinin kendi düğmesi (çift giriş asla).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

defined( 'ABSPATH' ) || exit;

/**
 * Yedek giriş düğmesi.
 */
class Fallback_Button {

	/** Late priority for the automatic entry-point fallback. */
	const FALLBACK_PRIORITY = 999;

	/**
	 * Custom page templates that omit the Woo add-to-cart element never
	 * hit the template override or summary hooks. auto_place=yes still means the
	 * Donate control belongs on the product page; print it once if nothing else did.
	 *
	 * @return void
	 */
	public static function render_builder_fallback() {
		if ( ! function_exists( 'is_product' ) || ! is_product() ) {
			return;
		}
		if ( Auto_Placement::template_override_used() ) {
			return;
		}
		$product = Product_Resolver::current_product();
		if ( ! $product || ! \WDP_Donation_Scope::is_donation_product( $product ) ) {
			return;
		}
		if ( \WDP_Render_Registry::has_product_ui( (int) $product->get_id() ) ) {
			return;
		}
		if ( ! Auto_Placement::should_auto_place( $product ) ) {
			return;
		}
		echo '<div class="wdp-auto-place-fallback">'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		self::render_placed_form();
		echo '</div>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Fallback when the template filter did not run; never doubles after a successful override.
	 *
	 * @return void
	 */
	public static function render_fallback_placed_form() {
		if ( Auto_Placement::template_override_used() ) {
			return;
		}
		$product = Product_Resolver::current_product();
		if ( ! $product ) {
			return;
		}
		if ( \WDP_Render_Registry::has_product_ui( (int) $product->get_id() ) ) {
			if ( function_exists( 'current_user_can' ) && current_user_can( 'edit_products' ) ) {
				echo \WDP_Render_Registry::duplicate_ui_notice( (int) $product->get_id() ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			}
			return;
		}
		self::render_placed_form();
	}

	/**
	 * @return void
	 */
	public static function render_placed_form() {
		echo '<div class="wdp-product-page-entry">'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo \WDP_Render_Guard::html( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			static function () {
				return Auto_Placement::placed_markup();
			},
			Product_Resolver::current_product_id(),
			'auto_place'
		);
		echo '</div>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}

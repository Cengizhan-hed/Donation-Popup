<?php
/**
 * Ürün sayfası görünüm çözümleyicisi + native cart CSS kapsamı.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class ProductPageDisplayTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options[ WDP_Placement_Settings::OPTION ] = array(
			'auto_place'     => 'yes',
			'display'        => 'button_panel',
			'donation_scope' => 'all',
		);
		WDP_Placement_Settings::flush();
	}

	private function product(int $id): WC_Product {
		$p                               = new WC_Product($id);
		$p->type                         = 'simple';
		WDP_Test_State::$products[ $id ] = $p;
		return $p;
	}

	public function test_auto_place_uses_placement_display(): void {
		$p = $this->product(31);
		$this->assertSame('button_panel', WDP_Product_Page_Integration::resolve_product_page_display($p));
	}

	public function test_shortcode_form_wins_over_placement(): void {
		$p              = $this->product(32);
		$p->description = '[wdp_donation_form id="32"]';
		$this->assertSame('inline', WDP_Product_Page_Integration::resolve_product_page_display($p));
	}

	public function test_shortcode_panel_button(): void {
		$p              = $this->product(33);
		$p->description = '[wdp_donation_button_panel id="33"]';
		$this->assertSame('button_panel', WDP_Product_Page_Integration::resolve_product_page_display($p));
	}

	public function test_shortcode_popup_button(): void {
		$p                     = $this->product(34);
		$p->short_description  = '[wdp_donation_button id="34"]';
		WDP_Test_State::$options[ WDP_Placement_Settings::OPTION ]['display'] = 'inline';
		WDP_Placement_Settings::flush();
		$this->assertSame('button_popup', WDP_Product_Page_Integration::resolve_product_page_display($p));
	}

	public function test_auto_place_off_without_shortcode_is_empty(): void {
		$p = $this->product(35);
		$p->update_meta_data('_wdp_auto_place', 'no');
		WDP_Donation_Scope::flush();
		$this->assertSame('', WDP_Product_Page_Integration::resolve_product_page_display($p));
	}

	public function test_hide_cart_css_spares_loop_forms(): void {
		$css = WDP_Product_Page_Integration::hide_native_cart_css();
		$this->assertStringContainsString('form.cart:not(.wdp-form)', $css);
		$this->assertStringContainsString('.related form.cart', $css);
		$this->assertStringContainsString('.upsells form.cart', $css);
		$this->assertStringContainsString('ul.products form.cart', $css);
		$this->assertStringContainsString('wp-block-woocommerce-related-products', $css);
		$this->assertStringContainsString('wp-block-woocommerce-product-collection', $css);
		$this->assertStringContainsString('sticky-add-to-cart', $css);
		$this->assertStringNotContainsString('.wdp-donation-product form.cart', $css);
		$this->assertStringNotContainsString('.storefront', $css);
		$this->assertStringNotContainsString('.fusion-', $css);
		$this->assertStringNotContainsString('.ct-', $css);
		$this->assertStringNotContainsString('.related{', $css);
		$this->assertStringNotContainsString('.related {', $css);
		$this->assertStringNotContainsString('ul.products{', $css);
		$this->assertStringNotContainsString('.upsells{', $css);
	}

	public function test_unhook_removes_woo_single_add_to_cart(): void {
		$this->product(41);
		WDP_Test_State::$queried_id = 41;
		WDP_Test_State::$is_product = true;
		$GLOBALS['product']         = WDP_Test_State::$products[41];
		add_action('woocommerce_single_product_summary', 'woocommerce_template_single_add_to_cart');
		add_action('wp_footer', 'storefront_sticky_single_add_to_cart');
		$GLOBALS['wp_filter']       = array(
			'wp_footer' => (object) array(
				'callbacks' => array(
					999 => array(
						array(
							'function'      => 'storefront_sticky_single_add_to_cart',
							'accepted_args' => 1,
						),
					),
				),
			),
		);
		WDP_Product_Page_Integration::on_wp();
		$summary = WDP_Test_State::$actions['woocommerce_single_product_summary'] ?? array();
		$footer  = WDP_Test_State::$actions['wp_footer'] ?? array();
		$this->assertNotContains('woocommerce_template_single_add_to_cart', $summary);
		$this->assertNotContains('storefront_sticky_single_add_to_cart', $footer);
		$this->assertContains(array('WDP_Product_Page_Integration', 'render_fallback_placed_form'), $summary);
		unset($GLOBALS['wp_filter']);
	}

	public function test_unhook_runs_when_auto_place_meta_off(): void {
		$p = $this->product(42);
		$p->update_meta_data('_wdp_auto_place', 'no');
		WDP_Donation_Scope::flush(42);
		WDP_Test_State::$queried_id = 42;
		WDP_Test_State::$is_product = true;
		$GLOBALS['product']         = $p;
		add_action('woocommerce_single_product_summary', 'woocommerce_template_single_add_to_cart');
		WDP_Product_Page_Integration::on_wp();
		$summary = WDP_Test_State::$actions['woocommerce_single_product_summary'] ?? array();
		$this->assertNotContains('woocommerce_template_single_add_to_cart', $summary);
		$this->assertNotContains(array('WDP_Product_Page_Integration', 'render_fallback_placed_form'), $summary);
	}

	public function test_placed_markup_panel_contains_display_attr(): void {
		$p                           = $this->product(36);
		WDP_Test_State::$queried_id  = 36;
		WDP_Test_State::$is_product  = true;
		$GLOBALS['product']          = $p;
		WDP_Render_Registry::reset();
		$html                        = WDP_Product_Page_Integration::placed_markup();
		$this->assertStringContainsString('data-wdp-display="button_panel"', $html);
		$this->assertStringContainsString('wdp-open-side-panel', $html);
	}
}

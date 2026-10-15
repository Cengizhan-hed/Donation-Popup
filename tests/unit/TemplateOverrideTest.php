<?php
/**
 * WooCommerce simple add-to-cart şablon override.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class TemplateOverrideTest extends TestCase {
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
		$p                           = new WC_Product($id);
		$p->type                     = 'simple';
		WDP_Test_State::$products[ $id ] = $p;
		WDP_Test_State::$queried_id  = $id;
		WDP_Test_State::$is_product  = true;
		$GLOBALS['product']          = $p;
		return $p;
	}

	public function test_returns_plugin_template_for_donation_product(): void {
		$this->product(10);
		$path = WDP_Product_Page_Integration::filter_wc_get_template(
			'/theme/simple.php',
			WDP_Product_Page_Integration::SIMPLE_ATC_TEMPLATE,
			array(),
			'',
			''
		);
		$this->assertSame(WDP_Product_Page_Integration::plugin_simple_template_path(), $path);
		$this->assertTrue(WDP_Product_Page_Integration::template_override_used());
		$this->assertFileExists($path);
	}

	public function test_non_donation_product_untouched(): void {
		$p       = $this->product(11);
		$p->type = 'variable';
		WDP_Donation_Scope::flush(11);
		$path = WDP_Product_Page_Integration::filter_wc_get_template(
			'/theme/simple.php',
			WDP_Product_Page_Integration::SIMPLE_ATC_TEMPLATE
		);
		$this->assertSame('/theme/simple.php', $path);
		$this->assertFalse(WDP_Product_Page_Integration::template_override_used());
	}

	public function test_setting_off_does_not_register_hooks(): void {
		WDP_Test_State::$options[ WDP_Placement_Settings::OPTION ] = array('auto_place' => 'no');
		WDP_Placement_Settings::flush();
		WDP_Product_Page_Integration::init();
		$this->assertFalse(WDP_Product_Page_Integration::hooks_added());
		$this->assertArrayNotHasKey('wc_get_template', WDP_Test_State::$filters);
	}

	public function test_duplicate_ui_skips_template_markup(): void {
		$this->product(12);
		WDP_Test_State::$caps[] = 'edit_products';
		WDP_Render_Registry::mark_trigger(12);
		$html = WDP_Product_Page_Integration::template_override_markup();
		$this->assertStringContainsString('form veya buton zaten basıldı #12', $html);
	}

	public function test_other_templates_not_rewritten(): void {
		$this->product(13);
		$path = WDP_Product_Page_Integration::filter_wc_get_template('/theme/x.php', 'cart/cart.php');
		$this->assertSame('/theme/x.php', $path);
	}
}

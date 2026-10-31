<?php
/**
 * WooCommerce simple add-to-cart şablon override.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class TemplateOverrideTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options[ \DonationPanel\Domain\Placement_Settings::OPTION ] = array(
			'auto_place'     => 'yes',
			'display'        => 'button_panel',
			'donation_scope' => 'all',
		);
		\DonationPanel\Domain\Placement_Settings::flush();
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
		$path = \DonationPanel\Modules\EntryPoints\Auto_Placement::filter_wc_get_template(
			'/theme/simple.php',
			\DonationPanel\Modules\EntryPoints\Auto_Placement::SIMPLE_ATC_TEMPLATE,
			array(),
			'',
			''
		);
		$this->assertSame(\DonationPanel\Modules\EntryPoints\Auto_Placement::plugin_simple_template_path(), $path);
		$this->assertTrue(\DonationPanel\Modules\EntryPoints\Auto_Placement::template_override_used());
		$this->assertFileExists($path);
	}

	public function test_non_donation_product_untouched(): void {
		$p       = $this->product(11);
		$p->type = 'variable';
		\DonationPanel\Domain\Donation_Scope::flush(11);
		$path = \DonationPanel\Modules\EntryPoints\Auto_Placement::filter_wc_get_template(
			'/theme/simple.php',
			\DonationPanel\Modules\EntryPoints\Auto_Placement::SIMPLE_ATC_TEMPLATE
		);
		$this->assertSame('/theme/simple.php', $path);
		$this->assertFalse(\DonationPanel\Modules\EntryPoints\Auto_Placement::template_override_used());
	}

	public function test_setting_off_does_not_register_hooks(): void {
		WDP_Test_State::$options[ \DonationPanel\Domain\Placement_Settings::OPTION ] = array('auto_place' => 'no');
		\DonationPanel\Domain\Placement_Settings::flush();
		\DonationPanel\Modules\EntryPoints\Auto_Placement::init();
		$this->assertFalse(\DonationPanel\Modules\EntryPoints\Auto_Placement::hooks_added());
		$this->assertArrayNotHasKey('wc_get_template', WDP_Test_State::$filters);
	}

	public function test_duplicate_ui_skips_template_markup(): void {
		$this->product(12);
		WDP_Test_State::$caps[] = 'edit_products';
		\DonationPanel\Modules\EntryPoints\Render_Registry::mark_trigger(12);
		$html = \DonationPanel\Modules\EntryPoints\Auto_Placement::template_override_markup();
		$this->assertStringContainsString('form or button already rendered #12', $html);
	}

	public function test_other_templates_not_rewritten(): void {
		$this->product(13);
		$path = \DonationPanel\Modules\EntryPoints\Auto_Placement::filter_wc_get_template('/theme/x.php', 'cart/cart.php');
		$this->assertSame('/theme/x.php', $path);
	}
}

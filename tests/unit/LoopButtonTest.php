<?php
/**
 * Mağaza döngüsü Bağış Yap butonu.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class LoopButtonTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options[ WDP_Placement_Settings::OPTION ] = array(
			'auto_place'     => 'yes',
			'loop_button'    => 'panel',
			'donation_scope' => 'all',
		);
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'popup_button_text' => 'Bağış Yap',
		);
		WDP_Placement_Settings::flush();
	}

	private function product(int $id): WC_Product {
		$p       = new WC_Product($id);
		$p->type = 'simple';
		$p->slug = 'bagis-' . $id;
		WDP_Test_State::$products[ $id ] = $p;
		return $p;
	}

	public function test_loop_link_becomes_donate_with_lazy_panel(): void {
		$p    = $this->product(20);
		$html = WDP_Product_Page_Integration::loop_button_html('<a class="button">Sepete ekle</a>', $p);
		$this->assertStringContainsString('Bağış Yap', $html);
		$this->assertStringContainsString('wdp-open-modal', $html);
		$this->assertStringContainsString('data-wdp-lazy="1"', $html);
		$this->assertStringContainsString('data-wdp-mode="side_panel"', $html);
		$this->assertStringContainsString('data-product-id="20"', $html);
		$this->assertStringNotContainsString('Sepete ekle', $html);
	}

	public function test_non_donation_untouched(): void {
		$p       = $this->product(21);
		$p->type = 'variable';
		WDP_Donation_Scope::flush(21);
		$orig = '<a class="button">Sepete ekle</a>';
		$this->assertSame($orig, WDP_Product_Page_Integration::loop_button_html($orig, $p));
	}

	public function test_add_to_cart_text_and_ajax_support(): void {
		$p = $this->product(22);
		$this->assertSame('Bağış Yap', WDP_Product_Page_Integration::filter_add_to_cart_text('Sepete ekle', $p));
		$this->assertFalse(WDP_Product_Page_Integration::filter_product_supports(true, 'ajax_add_to_cart', $p));
		$url = WDP_Product_Page_Integration::filter_add_to_cart_url('https://example.test/?add-to-cart=22', $p);
		$this->assertStringContainsString('/product/', $url);
	}
}

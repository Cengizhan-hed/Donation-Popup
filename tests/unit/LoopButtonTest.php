<?php
/**
 * Mağaza döngüsü Bağış Yap butonu.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class LoopButtonTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		\DonationPanel\Modules\EntryPoints\Render_Registry::reset();
		WDP_Test_State::$options[ \DonationPanel\Domain\Placement_Settings::OPTION ] = array(
			'auto_place'     => 'yes',
			'loop_button'    => 'panel',
			'donation_scope' => 'all',
		);
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'popup_button_text' => 'Bağış Yap',
		);
		\DonationPanel\Domain\Placement_Settings::flush();
	}

	private function product(int $id): WC_Product {
		$p       = new WC_Product($id);
		$p->type = 'simple';
		$p->slug = 'bagis-' . $id;
		WDP_Test_State::$products[ $id ] = $p;
		return $p;
	}

	public function test_loop_button_links_to_the_product_page_in_every_mode(): void {
		$p    = $this->product(20);
		$html = \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::loop_button_html('<a class="button">Sepete ekle</a>', $p);
		$this->assertStringContainsString('Bağış Yap', $html);
		$this->assertStringContainsString('<a href="', $html);
		$this->assertStringContainsString('bagis-20', $html);
		$this->assertStringContainsString('wdp-loop-donate', $html);
		$this->assertStringNotContainsString('wdp-open-modal', $html);
		$this->assertStringNotContainsString('data-wdp-lazy', $html);
		$this->assertStringNotContainsString('Sepete ekle', $html);
	}

	public function test_loop_button_opens_the_form_with_js_and_never_draws_a_second_entry(): void {
		$p    = $this->product(23);
		$html = \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::loop_button_html('<a class="button">Sepete ekle</a>', $p);
		$this->assertStringContainsString('href="', $html);
		$this->assertStringContainsString('data-wdp-form="23"', $html);
		$this->assertStringContainsString('data-wdp-kind="side_panel"', $html);
		$this->assertTrue(\DonationPanel\Modules\EntryPoints\Render_Registry::has_trigger(23));
		// Aynı üründe ikinci kart: yalnız bağlantı, form girişi yok.
		$again = \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::loop_button_html('<a class="button">Sepete ekle</a>', $p);
		$this->assertStringContainsString('wdp-loop-donate', $again);
		$this->assertStringNotContainsString('data-wdp-form', $again);
	}

	public function test_same_card_second_filter_pass_keeps_form_attributes(): void {
		// 12.3: blok temada aynı kart önce döngü bağlantısı, sonra render_block süzgecinden geçer; ikinci geçiş kendi
		// düğmemizi aynen korur (eskiden öznitelikler silinip kart formu açmıyordu).
		$p     = $this->product(26);
		$first = \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::loop_button_html('<a class="button">Sepete ekle</a>', $p);
		$this->assertStringContainsString('data-wdp-form="26"', $first);
		$block = '<div class="wp-block-button">' . $first . '</div>';
		$again = \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::loop_button_html($block, $p);
		$this->assertSame($first, $again);
	}

	public function test_loop_link_mode_has_no_form_hook(): void {
		WDP_Test_State::$options[ \DonationPanel\Domain\Placement_Settings::OPTION ]['loop_button'] = 'link';
		\DonationPanel\Domain\Placement_Settings::flush();
		$html = \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::loop_button_html('<a class="button">Sepete ekle</a>', $this->product(24));
		$this->assertStringNotContainsString('data-wdp-form', $html);
	}

	public function test_non_donation_untouched(): void {
		$p       = $this->product(21);
		$p->type = 'variable';
		\DonationPanel\Domain\Donation_Scope::flush(21);
		$orig = '<a class="button">Sepete ekle</a>';
		$this->assertSame($orig, \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::loop_button_html($orig, $p));
	}

	public function test_add_to_cart_text_and_ajax_support(): void {
		$p = $this->product(22);
		$this->assertSame('Bağış Yap', \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::filter_add_to_cart_text('Sepete ekle', $p));
		$this->assertFalse(\DonationPanel\Modules\EntryPoints\Loop_Price_Filters::filter_product_supports(true, 'ajax_add_to_cart', $p));
		$url = \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::filter_add_to_cart_url('https://example.test/?add-to-cart=22', $p);
		$this->assertStringContainsString('/product/', $url);
	}
}

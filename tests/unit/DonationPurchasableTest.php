<?php
/**
 * 10.34.0 — fiyatsız custom/campaign purchasable; kart; varsayılan tutarlar; ücret ondalığı.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class DonationPurchasableTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		\DonationPanel\Domain\Donation_Scope::flush();
		WDP_Test_State::$options[ \DonationPanel\Domain\Placement_Settings::OPTION ] = array(
			'donation_scope' => 'all',
		);
		\DonationPanel\Domain\Placement_Settings::flush();
	}

	private function product(int $id, string $type = 'custom'): WC_Product {
		$p        = new WC_Product($id);
		$p->type  = 'simple';
		$p->price = '';
		$p->purchasable = false;
		WDP_Test_State::$products[ $id ] = $p;
		$meta = array(
			'_allow_custom_price'    => $type === 'custom' || $type === 'campaign' ? 'yes' : '',
			'_allow_multiple_shares' => $type === 'shares' ? 'yes' : '',
			'_enable_progress_bar'   => $type === 'campaign' ? 'yes' : '',
			'_min_custom_price'      => '5',
		);
		WDP_Test_State::$post_meta[ $id ] = $meta;
		$p->meta = $meta;
		return $p;
	}

	public function test_empty_price_custom_is_purchasable(): void {
		$p = $this->product(41, 'custom');
		$this->assertTrue(\DonationPanel\WooCommerce\Donation_Purchasable::filter_is_purchasable(false, $p));
	}

	public function test_empty_price_campaign_is_purchasable(): void {
		$p = $this->product(42, 'campaign');
		$this->assertTrue(\DonationPanel\WooCommerce\Donation_Purchasable::filter_is_purchasable(false, $p));
	}

	public function test_fixed_empty_price_stays_not_purchasable(): void {
		$p = $this->product(43, 'fixed');
		$p->purchasable = false;
		$this->assertFalse(\DonationPanel\WooCommerce\Donation_Purchasable::filter_is_purchasable(false, $p));
	}

	public function test_already_purchasable_unchanged(): void {
		$p = $this->product(44, 'custom');
		$this->assertTrue(\DonationPanel\WooCommerce\Donation_Purchasable::filter_is_purchasable(true, $p));
	}

	public function test_default_presets_follow_decimals(): void {
		WDP_Test_State::$price_decimals = 2;
		$this->assertSame(array(5, 10, 25, 50, 100), WDP_Form_Modules::default_amount_preset_values());
		WDP_Test_State::$price_decimals = 0;
		$this->assertSame(array(100, 250, 500, 1000, 2500), WDP_Form_Modules::default_amount_preset_values());
	}

	public function test_cover_fee_rounds_to_price_decimals(): void {
		WDP_Test_State::$price_decimals = 2;
		$this->assertSame(13.13, \DonationPanel\WooCommerce\Cart_Hooks::apply_cover_fee_to_amount(12.5, 5));
		WDP_Test_State::$price_decimals = 0;
		$this->assertSame(13.0, \DonationPanel\WooCommerce\Cart_Hooks::apply_cover_fee_to_amount(12.5, 5));
	}

	public function test_campaign_goal_empty_is_zero_not_default(): void {
		$p = $this->product(45, 'campaign');
		WDP_Test_State::$post_meta[45]['_progress_bar_limit'] = '';
		$p->meta['_progress_bar_limit'] = '';
		$this->assertSame(0.0, \DonationPanel\Domain\Campaign_Goal::resolve_goal_amount($p));
	}

	public function test_js_currency_settings_shape(): void {
		$c = \WDP_Utils::get_js_currency_settings();
		$this->assertArrayHasKey('code', $c);
		$this->assertArrayHasKey('symbol', $c);
		$this->assertArrayHasKey('decimals', $c);
		$this->assertArrayHasKey('thousandSeparator', $c);
		$this->assertArrayHasKey('decimalSeparator', $c);
		$this->assertArrayHasKey('symbolPosition', $c);
		$this->assertSame('TRY', $c['code']);
	}

	public function test_card_custom_shows_min_not_fixed_price(): void {
		$p = $this->product(46, 'custom');
		$p->price = '40';
		WDP_Test_State::$post_meta[46]['_min_custom_price'] = '5';
		$p->meta['_min_custom_price'] = '5';
		$html = $this->cardHtml($p, array('show_price' => 'yes', 'button' => 'popup'));
		$this->assertStringContainsString('min.', $html);
		$this->assertStringNotContainsString('Dilediğin tutar', $html);
		$this->assertDoesNotMatchRegularExpression('/<article[^>]*>\\s*<a /', $html);
		$this->assertStringContainsString('<button type="button" class="wdp-card__cta', $html);
		$this->assertStringContainsString('wdp-card__title"><a href=', $html);
		$this->assertStringContainsString('data-wdp-lazy="1"', $html);
	}

	public function test_card_campaign_hides_bar_without_goal(): void {
		$p = $this->product(47, 'campaign');
		WDP_Test_State::$post_meta[47]['_progress_bar_limit'] = '';
		$p->meta['_progress_bar_limit'] = '';
		$html = $this->cardHtml($p, array('show_price' => 'yes', 'show_progress' => 'yes', 'button' => 'panel'));
		$this->assertStringNotContainsString('wdp-card__progress', $html);
		$this->assertStringNotContainsString('100000', $html);
	}

	public function test_card_campaign_shows_zero_collected_and_goal(): void {
		$p = $this->product(48, 'campaign');
		WDP_Test_State::$post_meta[48]['_progress_bar_limit'] = '3000';
		$p->meta['_progress_bar_limit'] = '3000';
		$html = $this->cardHtml($p, array('show_price' => 'yes', 'show_progress' => 'yes'), array(48 => 0.0));
		$this->assertStringContainsString('wdp-card__progress', $html);
		$this->assertStringContainsString('wdp-card__price', $html);
	}

	public function test_progress_amount_block_has_visible_label(): void {
		$html = WDP_Form_Fields_Renderer::render_progress_amount_block('5');
		$this->assertStringContainsString('wdp-custom-price-row__label', $html);
		$this->assertStringContainsString('Bağış Tutarı', $html);
		$this->assertStringContainsString('aria-labelledby', $html);
	}

	public function test_custom_price_row_has_visible_label(): void {
		$html = WDP_Form_Fields_Renderer::render_custom_price_amount_row('10', '', '₺');
		$this->assertStringContainsString('wdp-custom-price-row__label', $html);
		$this->assertStringContainsString('Bağış Tutarı', $html);
		$this->assertStringContainsString('name="custom_price"', $html);
	}

	public function test_fixed_price_row_has_no_amount_label(): void {
		$html = WDP_Form_Fields_Renderer::render_fixed_price_quantity_row('6000');
		$this->assertStringNotContainsString('wdp-custom-price-row__label', $html);
		$this->assertStringNotContainsString('Bağış Tutarı', $html);
		$this->assertStringContainsString('wdp-fixed-price-counter-row', $html);
		$this->assertStringContainsString('wdp-line-total-display', $html);
		$this->assertStringContainsString('wdp-quantity-counter', $html);
		$this->assertStringContainsString('screen-reader-text', $html);
	}

	public function test_tabs_skip_uncategorized_and_empty_ancestors(): void {
		$p = $this->product(49, 'custom');
		$p->category_ids = array(3, 1);
		WDP_Test_State::$terms[1] = (object) array(
			'term_id'    => 1,
			'slug'       => 'uncategorized',
			'name'       => 'Uncategorized',
			'parent'     => 0,
			'term_order' => 0,
		);
		WDP_Test_State::$terms[3] = (object) array(
			'term_id'    => 3,
			'slug'       => 'appeals',
			'name'       => 'Appeals',
			'parent'     => 0,
			'term_order' => 0,
		);
		WDP_Test_State::$options['default_product_cat'] = 1;
		$method = new ReflectionMethod('DonationPanel\\Modules\\EntryPoints\\Donations_List', 'build_tabs');
		$method->setAccessible(true);
		$tabs = $method->invoke(null, array($p));
		$slugs = array_column($tabs, 'slug');
		$this->assertContains('appeals', $slugs);
		$this->assertNotContains('uncategorized', $slugs);
	}

	/**
	 * @param WC_Product $product Product.
	 * @param array      $atts    Atts.
	 * @param array      $totals  Totals.
	 */
	private function cardHtml($product, array $atts = array(), array $totals = array()): string {
		$atts = \DonationPanel\Modules\EntryPoints\Donations_List::sanitize_atts($atts);
		$method = new ReflectionMethod('DonationPanel\\Modules\\EntryPoints\\Donations_List', 'card_html');
		$method->setAccessible(true);
		return (string) $method->invoke(null, $product, $atts, $totals, 1);
	}
}

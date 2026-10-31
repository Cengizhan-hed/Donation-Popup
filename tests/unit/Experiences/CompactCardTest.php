<?php
/**
 * 122-compact: compact bağış kartı — ayar sınırları, hızlı tutar seçimi, görünüm verisi, şablon (4 adım tek grid, pasifler
 * inert/aria-hidden, tutar seçili gelmez), kısa kod/blok/Elementor `layout` eşlemesi, order-pay gömülü görünüm bayrağı.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Frontend\Template_Loader;
use DonationPanel\Modules\EntryPoints\Elementor\Donation_Form_Widget;
use DonationPanel\Modules\Experiences\Compact_Card;
use DonationPanel\Modules\Experiences\Form_Context;
use DonationPanel\WooCommerce\Direct\Pay_Embed;
use PHPUnit\Framework\TestCase;

final class CompactCardTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		unset( $_GET[ Pay_Embed::QUERY ] );
	}

	/**
	 * @param array<string, mixed> $extra Ek eski bağlam.
	 * @return array<string, mixed>
	 */
	private function model( array $extra = array() ): array {
		return Form_Context::from_legacy(
			array_merge(
				array(
					'product_id'                => 7,
					'product_name'              => 'Su Kuyusu <b>Bağışı</b>',
					'allow_custom_price'        => true,
					'min_price'                 => '5',
					'enable_amount_presets'     => true,
					'amount_presets'            => '10 25 50 100',
					'amount_preset_recommended' => '100',
					'enable_email'              => true,
					'enable_dedication'         => true,
					'currency_symbol'           => '£',
				),
				$extra
			)
		);
	}

	private function card(): Compact_Card {
		return new Compact_Card(
			new Template_Loader(
				WDP_PLUGIN_DIR,
				static function () {
					return array();
				}
			)
		);
	}

	public function test_settings_are_clamped_and_fall_back_safely(): void {
		$this->assertSame( 3, Compact_Card::normalize_settings( array() )['quick'] );
		$this->assertSame( 0, Compact_Card::normalize_settings( array( 'quick' => -4 ) )['quick'] );
		$this->assertSame( 3, Compact_Card::normalize_settings( array( 'quick' => 99 ) )['quick'] );
		$this->assertSame( 3, Compact_Card::normalize_settings( array( 'quick' => 'abc' ) )['quick'] );
		$this->assertSame( 2, Compact_Card::normalize_settings( array( 'quick' => '2' ) )['quick'] );
		$this->assertFalse( Compact_Card::normalize_settings( array() )['reset_hidden'] );
		$this->assertTrue( Compact_Card::normalize_settings( array( 'reset_hidden' => '1' ) )['reset_hidden'] );
		$this->assertSame( '', Compact_Card::normalize_settings( array( 'first_text' => array( 'x' ) ) )['first_text'] );
	}

	public function test_quick_amounts_keep_order_and_include_recommended(): void {
		$this->assertSame( array( 10.0, 25.0, 50.0 ), Compact_Card::quick_amounts( array( 10, 25, 50, 100 ), 3 ) );
		$this->assertSame( array(), Compact_Card::quick_amounts( array( 10, 25 ), 0 ) );
		$this->assertSame( array( 10.0, 25.0, 100.0 ), Compact_Card::quick_amounts( array( 10, 25, 50, 100 ), 3, 100.0 ) );
		$this->assertSame( array( 100.0 ), Compact_Card::quick_amounts( array( 10, 25, 50, 100 ), 1, 100.0 ) );
		$this->assertSame( array( 10.0, 25.0 ), Compact_Card::quick_amounts( array( 10, 25 ), 3, 999.0 ) );
		$this->assertSame( array( 25.0 ), Compact_Card::quick_amounts( array( 0, -5, 25 ), 3 ) );
	}

	public function test_view_for_custom_amount_product(): void {
		$view = Compact_Card::view( $this->model(), Compact_Card::normalize_settings( array() ), null );
		$this->assertFalse( $view['fixed'] );
		$this->assertTrue( $view['custom'] );
		$this->assertSame( array( 10.0, 25.0, 100.0 ), $view['quick'] );
		$this->assertSame( 100.0, $view['recommended'] );
		$this->assertSame( array(), $view['campaign'] );
		$this->assertSame( array( 'donation_full_name', 'donation_phone' ), array_column( $view['fields'], 'name' ) );
		$this->assertFalse( $view['tax_relief'] );
	}

	public function test_view_campaign_zero_state_uses_real_total_only(): void {
		$model             = $this->model();
		$model['campaign'] = array(
			'raised'  => '£0',
			'goal'    => '£5,000',
			'percent' => 0,
			'donors'  => 0,
		);
		$zero              = Compact_Card::view( $model, Compact_Card::normalize_settings( array() ), 0.0 );
		$this->assertTrue( $zero['campaign']['zero'] );
		$this->assertContains( $zero['first_text'], array( 'Be the first to give', 'İlk bağışı siz yapın' ) );
		$this->assertSame( '', $zero['impact'] );

		$raised = Compact_Card::view( $model, Compact_Card::normalize_settings( array( 'first_text' => 'Join us' ) ), 12.5 );
		$this->assertFalse( $raised['campaign']['zero'] );
		$this->assertSame( 'Join us', $raised['first_text'] );
	}

	public function test_fixed_price_product_has_no_amount_field(): void {
		$model = Form_Context::from_legacy(
			array(
				'product_id'         => 8,
				'product_name'       => 'Kurban',
				'product_price'      => '250',
				'allow_custom_price' => false,
			)
		);
		$this->assertSame( 'fixed', $model['kind'] );
		$view = Compact_Card::view( $model, Compact_Card::normalize_settings( array() ), null );
		$this->assertTrue( $view['fixed'] );
		$this->assertFalse( $view['custom'] );
		$this->assertSame( array(), $view['quick'] );
	}

	public function test_shares_are_not_supported_and_fall_back(): void {
		$model = Form_Context::from_legacy(
			array(
				'product_id'            => 9,
				'product_price'         => '100',
				'allow_multiple_shares' => true,
			)
		);
		$this->assertFalse( Compact_Card::supports( $model ) );
		$this->assertSame( '', $this->card()->render( $model ) );
	}

	public function test_template_four_steps_in_one_grid_nothing_preselected(): void {
		$html = $this->card()->render(
			$this->model(),
			array(
				'rest_url'     => 'https://example.org/wp-json/donation-panel/v1/',
				'checkout_url' => 'https://example.org/checkout/',
			)
		);
		$this->assertStringContainsString( 'data-dp-compact', $html );
		// 12.3 compact v2: sepetli akış 2 adım (tutar, bilgiler + "Ödemeye geç"); ara ödeme adımı ve teşekkür yok.
		$this->assertSame( 2, substr_count( $html, 'class="donation-panel-compact__step' ) );
		$this->assertSame( 1, substr_count( $html, 'donation-panel-compact__step is-on' ) );
		$this->assertSame( 1, substr_count( $html, 'inert aria-hidden="true"' ) );
		$this->assertStringContainsString( 'data-steps="2"', $html );
		$this->assertStringContainsString( '>1/2<', $html );
		$this->assertStringNotContainsString( 'data-dp-cstep="pay"', $html );
		$this->assertSame( 1, substr_count( $html, 'data-dp-cpay ' ) );
		$this->assertMatchesRegularExpression( '#data-dp-cpay data-label="[^"]*%s[^"]*"#', $html );
		$this->assertStringNotContainsString( 'donation-panel-compact__note', $html );
		// Güven satırı (varsayılan açık): satır içi SVG kilit, iki adımda.
		$this->assertSame( 2, substr_count( $html, 'class="donation-panel-compact__trust"' ) );
		$this->assertStringContainsString( 'width="14" height="14"', $html );
		$this->assertStringNotContainsString( 'checked', $html );
		$this->assertSame( 3, substr_count( $html, 'data-dp-cquick' ) );
		$this->assertSame( 1, substr_count( $html, 'class="donation-panel-compact__rec"' ) );
		$this->assertStringContainsString( 'inputmode="decimal"', $html );
		$this->assertStringContainsString( 'autocomplete="name"', $html );
		$this->assertStringNotContainsString( 'autocomplete="email"', $html );
		$this->assertStringNotContainsString( 'donation_email', $html );
		$this->assertStringContainsString( 'autocomplete="tel"', $html );
		$this->assertStringContainsString( 'aria-disabled="true"', $html );
		$this->assertStringContainsString( 'aria-live="polite"', $html );
		$this->assertStringNotContainsString( '<b>', $html, 'ürün adı kaçışlanır' );
		$this->assertStringNotContainsString( 'nonce', strtolower( $html ) );
		// Sepet akışında (doğrudan bağış kapalı) ödeme katmanı ve çerçeve yok.
		$this->assertStringNotContainsString( '<iframe', $html );
		$this->assertStringContainsString( 'width="20" height="20"', $html );
	}

	public function test_direct_mode_renders_payment_layer_template(): void {
		$model           = $this->model();
		$model['direct'] = true;
		$html            = $this->card()->render( $model, array( 'rest_url' => 'https://example.org/wp-json/donation-panel/v1/' ) );
		$this->assertStringContainsString( 'data-direct="1"', $html );
		// Doğrudan akış: 3 sayılan adım + teşekkür.
		$this->assertSame( 4, substr_count( $html, 'class="donation-panel-compact__step' ) );
		$this->assertSame( 3, substr_count( $html, 'inert aria-hidden="true"' ) );
		$this->assertStringContainsString( 'data-steps="3"', $html );
		$this->assertStringContainsString( '>2/3<', $html );
		$this->assertStringContainsString( '<template data-dp-tpl>', $html );
		$this->assertStringContainsString( 'data-dp-cframe', $html );
		$this->assertMatchesRegularExpression( '#<template data-dp-tpl>.*<iframe.*</template>#s', $html );
	}

	public function test_v2_campaign_amounts_trust_impact_and_tax_relief(): void {
		// Ham tutarla biçim: tam sayıda ondalık yok (Woo biçimi), hedef "/ £X" ile aynı satırda.
		$model             = $this->model();
		$model['campaign'] = array(
			'raised'  => '0,00 ₺',
			'goal'    => '3.000,00 ₺',
			'percent' => 0,
			'donors'  => 0,
		);
		$view              = Compact_Card::view( $model, Compact_Card::normalize_settings( array() ), 0.0, 3000.0 );
		$this->assertStringNotContainsString( ',00', $view['campaign']['raised'] . $view['campaign']['goal'] );
		$this->assertStringContainsString( '3.000', $view['campaign']['goal'] );
		$this->assertTrue( $view['trust'] );
		$this->assertSame( 2, $view['steps'] );
		$this->assertFalse( Compact_Card::normalize_settings( array( 'trust' => false ) )['trust'] );
		$this->assertTrue( Compact_Card::normalize_settings( array( 'trust' => '1' ) )['trust'] );

		// Etki kademeleri yalnız düz metin; seçilen tutarın ifadesi için satır yeri ayrılır.
		$model           = $this->model();
		$model['impact'] = array(
			'tiers'   => array(
				array(
					'unit'  => 10.0,
					'one'   => '{count} <b>meal</b>',
					'other' => '{count} meals',
				),
				array(
					'unit' => 0,
					'one'  => 'yok',
				),
			),
			'presets' => array(),
		);
		$view            = Compact_Card::view( $model, Compact_Card::normalize_settings( array() ), null );
		$this->assertSame(
			array(
				array(
					'unit'  => 10.0,
					'one'   => '{count} meal',
					'other' => '{count} meals',
				),
			),
			$view['impact_tiers']
		);
		$html = $this->card()->render( $model );
		$this->assertStringContainsString( 'data-impact="', $html );
		$this->assertStringContainsString( 'data-dp-ceffect', $html );

		// Güven satırı kapalı: çizilmez.
		WDP_Test_State::$options['donation_panel_settings'] = array( 'compact' => array( 'trust' => false ) );
		$this->assertStringNotContainsString( 'donation-panel-compact__trust', $this->card()->render( $this->model() ) );
	}

	public function test_v2_tax_relief_has_title_short_text_and_details_not_a_bare_checkbox(): void {
		WDP_Test_State::$options['donation_panel_settings'] = array(
			'tax_relief' => array(
				'title' => 'Boost your donation by 25% with Gift Aid',
				'text'  => 'I am a UK taxpayer and understand the declaration.',
			),
		);
		$model          = $this->model();
		$model['steps'] = array(
			array(
				'id'    => 'tax_relief',
				'label' => 'Tax relief',
			),
		);
		$model['direct'] = true;
		$html            = $this->card()->render( $model );
		$this->assertStringContainsString( '<b>Boost your donation by 25% with Gift Aid</b>', $html );
		$this->assertStringContainsString( 'data-dp-ctax-more', $html );
		$this->assertStringContainsString( 'aria-expanded="false"', $html );
		$this->assertStringContainsString( 'data-dp-ctax-sheet', $html );
		$this->assertSame( 2, substr_count( $html, 'I am a UK taxpayer and understand the declaration.' ), 'kısa hal + tam metin' );
		// Onay etiketi yalnız ekran okuyucu metni; tek başına görünür "Yes, I make this declaration" yok.
		$this->assertMatchesRegularExpression( '#<span class="donation-panel-sr">[^<]+</span>\s*<span class="donation-panel-compact__taxs" aria-hidden="true">#', $html );
		$this->assertStringNotContainsString( 'donation-panel-check__t', $html );
		$this->assertStringContainsString( 'data-dp-crecap-tax-row hidden', $html );
	}

	public function test_elementor_layout_maps_to_shortcode_attribute(): void {
		list( $tag, $atts ) = Donation_Form_Widget::shortcode_from_settings(
			array(
				'display' => 'inline',
				'layout'  => 'compact',
			)
		);
		$this->assertSame( 'wdp_donation_form', $tag );
		$this->assertSame( 'compact', $atts['layout'] );

		list( , $full ) = Donation_Form_Widget::shortcode_from_settings( array( 'display' => 'inline' ) );
		$this->assertArrayNotHasKey( 'layout', $full, 'varsayılan (Full): öznitelikler bugünküyle aynı' );

		list( $popup_tag, $popup ) = Donation_Form_Widget::shortcode_from_settings(
			array(
				'display' => 'popup',
				'layout'  => 'compact',
			)
		);
		$this->assertSame( 'wdp_donation_button', $popup_tag );
		$this->assertArrayNotHasKey( 'layout', $popup );
	}

	public function test_pay_embed_flag_only_on_order_pay(): void {
		$this->assertFalse( Pay_Embed::requested() );
		$this->assertSame( '/theme/page.php', Pay_Embed::template( '/theme/page.php' ) );
		$_GET[ Pay_Embed::QUERY ] = '1';
		$this->assertTrue( Pay_Embed::requested() );
		// Test ortamında order-pay sayfası değil: tema şablonu değişmez.
		$this->assertSame( '/theme/page.php', Pay_Embed::template( '/theme/page.php' ) );
		$_GET[ Pay_Embed::QUERY ] = 'yes';
		$this->assertFalse( Pay_Embed::requested() );
	}
}

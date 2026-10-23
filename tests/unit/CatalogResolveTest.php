<?php
/**
 * E2E katalog işaretleri + tip çıkarımı (WP sorgusu yok).
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class CatalogResolveTest extends TestCase {
	public static function setUpBeforeClass(): void {
		require_once dirname(__DIR__) . '/e2e/helpers/catalog-resolve.php';
	}

	public function test_plugin_markers(): void {
		$this->assertTrue(wdp_e2e_catalog_has_plugin_marker('[wdp_donations ids="1"]'));
		$this->assertTrue(wdp_e2e_catalog_has_plugin_marker('<!-- wp:wdp/donation-form -->'));
		$this->assertTrue(wdp_e2e_catalog_has_plugin_marker('{"widgetType":"wdp-donations"}'));
		$this->assertFalse(wdp_e2e_catalog_has_plugin_marker('Avada fusion form'));
	}

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_infer_type_matches_plugin(): void {
		$this->assertSame('shares', wdp_e2e_catalog_infer_type(array('_allow_multiple_shares' => 'yes')));
		$this->assertSame('campaign', wdp_e2e_catalog_infer_type(array('_enable_progress_bar' => 'yes')));
		$this->assertSame('custom', wdp_e2e_catalog_infer_type(array('_allow_custom_price' => 'yes')));
		$this->assertSame('fixed', wdp_e2e_catalog_infer_type(array()));
		$this->assertSame(
			WDP_Donation_Type::infer_from_meta(array('_allow_custom_price' => 'yes', '_enable_progress_bar' => 'yes')),
			wdp_e2e_catalog_infer_type(array('_allow_custom_price' => 'yes', '_enable_progress_bar' => 'yes'))
		);
	}

	public function test_detect_type_calls_plugin_for_product(): void {
		WDP_Test_State::$post_meta[42] = array('_allow_multiple_shares' => 'yes');
		$this->assertSame(
			'shares',
			wdp_e2e_catalog_detect_type(42, array('_allow_custom_price' => 'yes'))
		);
		$this->assertSame(WDP_Donation_Type::for_product(42), wdp_e2e_catalog_detect_type(42, array()));
	}

	public function test_explain_flag_and_why_have_no_raw_values(): void {
		$this->assertTrue(wdp_e2e_catalog_wants_explain(array('--explain')));
		$this->assertTrue(wdp_e2e_catalog_wants_explain(array('foo', 'explain')));
		$this->assertFalse(wdp_e2e_catalog_wants_explain(array()));
		$this->assertFalse(wdp_e2e_catalog_wants_explain(array('--json')));
		putenv('WDP_E2E_CATALOG_EXPLAIN=1');
		$this->assertTrue(wdp_e2e_catalog_wants_explain(array()));
		putenv('WDP_E2E_CATALOG_EXPLAIN');
		$this->assertFalse(wdp_e2e_catalog_wants_explain(array()));
		$this->assertSame('açık', wdp_e2e_catalog_flag_state('yes'));
		$this->assertSame('kapalı', wdp_e2e_catalog_flag_state('1'));
		$this->assertSame('kapalı', wdp_e2e_catalog_flag_state('on'));
		$states = wdp_e2e_catalog_flag_states(array('_allow_multiple_shares' => 'yes', '_enable_progress_bar' => 'no'));
		$this->assertSame('açık', $states['_allow_multiple_shares']);
		$this->assertSame('kapalı', $states['_enable_progress_bar']);
		$why = wdp_e2e_catalog_type_why('shares', $states, 'WDP_Donation_Type::for_product');
		$this->assertStringContainsString('WDP_Donation_Type::for_product', $why);
		$this->assertStringContainsString('_allow_multiple_shares=açık', $why);
		$this->assertStringNotContainsString('yes', $why);
		$this->assertStringNotContainsString('@', $why);
	}

	public function test_path_from_permalink(): void {
		$this->assertSame('/bagis/vacip-kurbani/', wdp_e2e_catalog_path_from_url('https://ornek.test/bagis/vacip-kurbani/'));
		$this->assertSame('/magaza/', wdp_e2e_catalog_path_from_url('/magaza/'));
		$this->assertSame('', wdp_e2e_catalog_path_from_url(''));
	}

	public function test_nav_target_keeps_query(): void {
		$this->assertSame(
			'/?post_type=product&p=915',
			wdp_e2e_catalog_nav_target_from_url('https://ikramaid.uk/?post_type=product&p=915')
		);
		$this->assertSame('/', wdp_e2e_catalog_nav_target_from_url('https://ikramaid.uk/'));
		$this->assertSame('/?p=916', wdp_e2e_catalog_nav_target_from_url('/?p=916'));
	}

	public function test_eval_file_does_not_emit_during_phpunit(): void {
		$this->assertTrue(function_exists('wdp_e2e_catalog_resolve'));
		$this->assertFalse(defined('WP_CLI') && WP_CLI);
	}

	public function test_related_and_upsell_ids_from_product(): void {
		$p              = new WC_Product(41);
		$p->related_ids = array(41, 9, 10);
		$p->upsell_ids  = array(7, 8, 41);
		WDP_Test_State::$products[41] = $p;
		$ids = wdp_e2e_catalog_related_ids($p);
		$this->assertSame(array(9, 10), $ids['related_ids']);
		$this->assertSame(array(7, 8), $ids['upsell_ids']);
		$empty = wdp_e2e_catalog_related_ids(new WC_Product(99));
		$this->assertSame(array(), $empty['related_ids']);
		$this->assertSame(array(), $empty['upsell_ids']);
	}

	public function test_catalog_display_uses_plugin_resolver(): void {
		WDP_Test_State::$options[ WDP_Placement_Settings::OPTION ] = array(
			'auto_place'     => 'yes',
			'display'        => 'button_panel',
			'donation_scope' => 'all',
		);
		WDP_Placement_Settings::flush();
		$p       = new WC_Product(41);
		$p->type = 'simple';
		WDP_Test_State::$products[41] = $p;
		$this->assertSame('button_panel', wdp_e2e_catalog_product_display($p));
		$p->description = '[wdp_donation_form]';
		$this->assertSame('inline', wdp_e2e_catalog_product_display($p));
	}
}

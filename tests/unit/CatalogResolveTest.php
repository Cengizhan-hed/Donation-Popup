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

	public function test_path_from_permalink(): void {
		$this->assertSame('/bagis/vacip-kurbani/', wdp_e2e_catalog_path_from_url('https://ornek.test/bagis/vacip-kurbani/'));
		$this->assertSame('/magaza/', wdp_e2e_catalog_path_from_url('/magaza/'));
		$this->assertSame('', wdp_e2e_catalog_path_from_url(''));
	}

	public function test_eval_file_does_not_emit_during_phpunit(): void {
		$this->assertTrue(function_exists('wdp_e2e_catalog_resolve'));
		$this->assertFalse(defined('WP_CLI') && WP_CLI);
	}
}

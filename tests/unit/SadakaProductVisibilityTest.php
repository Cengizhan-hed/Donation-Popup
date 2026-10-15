<?php
/**
 * Alt bağış bağlantıları bilgi amaçlıdır; bağış kapsamı ve listeleri etkilemez.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class SadakaProductVisibilityTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options[ WDP_Placement_Settings::OPTION ] = array(
			'donation_scope'      => 'all',
			'donation_categories' => array(),
		);
		WDP_Sadaka_Product_Visibility::init();
	}

	private function product(int $id, string $type = 'simple'): WC_Product {
		$p       = new WC_Product($id);
		$p->type = $type;
		$p->name = 'Ürün ' . $id;
		WDP_Test_State::$products[ $id ] = $p;
		return $p;
	}

	public function test_sadaka_line_remains_donation_product_and_listed(): void {
		WDP_Test_State::$options['wdp_success_settings'] = array('sadaka_wc_product_id' => 99);
		$line = $this->product(99);
		WDP_Sadaka_Product_Visibility::flush();

		$this->assertContains(99, WDP_Sadaka_Product_Visibility::get_all_ids());
		$this->assertTrue(WDP_Sadaka_Product_Visibility::is_sadaka_line_product(99));
		// Kapsam "all" — alt bağış bağlantısı bağış ürünü olmayı bozmaz.
		$this->assertTrue(WDP_Donation_Scope::is_donation_product($line));
	}

	public function test_explicit_donation_flag_still_tracked_as_sadaka_line(): void {
		$line = $this->product(20);
		WDP_Test_State::$options['wdp_success_settings'] = array('sadaka_wc_product_id' => 20);
		WDP_Test_State::$post_meta[20][ WDP_Donation_Scope::META ] = 'yes';
		WDP_Sadaka_Product_Visibility::flush();

		$this->assertTrue(WDP_Sadaka_Product_Visibility::is_sadaka_line_product(20));
		$this->assertTrue(WDP_Donation_Scope::is_donation_product($line));
	}

	public function test_per_product_sadaka_meta_requires_enable_flag(): void {
		$parent = $this->product(10);
		$line   = $this->product(20);
		unset($parent, $line);
		WDP_Test_State::$post_meta[10]['_sadaka_wc_product_id'] = 20;
		WDP_Sadaka_Product_Visibility::flush();
		$this->assertNotContains(20, WDP_Sadaka_Product_Visibility::get_all_ids());

		WDP_Test_State::$post_meta[10]['_enable_sadaka_donation'] = 'yes';
		WDP_Sadaka_Product_Visibility::flush();
		$ids = WDP_Sadaka_Product_Visibility::get_all_ids();
		$this->assertContains(20, $ids);
		$this->assertTrue(WDP_Sadaka_Product_Visibility::is_sadaka_line_product(20));
		$this->assertTrue(WDP_Donation_Scope::is_donation_product(WDP_Test_State::$products[20]));
	}

	public function test_stale_meta_on_disabled_parent_ignored(): void {
		$this->product(294);
		$this->product(10691);
		$this->product(10721);
		WDP_Test_State::$post_meta[50]['_sadaka_wc_product_id']   = 294;
		WDP_Test_State::$post_meta[50]['_enable_sadaka_donation'] = 'no';
		WDP_Test_State::$post_meta[51]['_sadaka_wc_product_id']   = 10691;
		WDP_Test_State::$post_meta[51]['_enable_sadaka_donation'] = '';
		WDP_Test_State::$post_meta[10]['_sadaka_wc_product_id']   = 10721;
		WDP_Test_State::$post_meta[10]['_enable_sadaka_donation'] = 'yes';

		WDP_Sadaka_Product_Visibility::flush();
		$ids = WDP_Sadaka_Product_Visibility::get_all_ids();
		$this->assertContains(10721, $ids);
		$this->assertNotContains(294, $ids);
		$this->assertNotContains(10691, $ids);
	}

	public function test_self_reference_never_collected(): void {
		$this->product(10);
		WDP_Test_State::$post_meta[10]['_enable_sadaka_donation'] = 'yes';
		WDP_Test_State::$post_meta[10]['_sadaka_wc_product_id']   = 10;
		WDP_Sadaka_Product_Visibility::flush();
		$this->assertNotContains(10, WDP_Sadaka_Product_Visibility::get_all_ids());
	}

	public function test_hiding_methods_removed(): void {
		$this->assertFalse(method_exists(WDP_Sadaka_Product_Visibility::class, 'filter_is_donation_product'));
		$this->assertFalse(method_exists(WDP_Sadaka_Product_Visibility::class, 'filter_donations_query_args'));
		$this->assertFalse(method_exists(WDP_Sadaka_Product_Visibility::class, 'exclude_from_front_queries'));
		$this->assertFalse(method_exists(WDP_Sadaka_Product_Visibility::class, 'exclude_from_wc_product_query'));
		$this->assertFalse(method_exists(WDP_Sadaka_Product_Visibility::class, 'exclude_from_rest_product_query'));
		$this->assertFalse(method_exists(WDP_Sadaka_Product_Visibility::class, 'exclude_from_data_store_query'));
		$this->assertFalse(method_exists(WDP_Sadaka_Product_Visibility::class, 'needs_visibility_advice'));
	}

	public function test_non_sadaka_donation_product_unchanged(): void {
		$p = $this->product(5);
		WDP_Test_State::$post_meta[5][ WDP_Donation_Scope::META ] = 'yes';
		$this->assertTrue(WDP_Donation_Scope::is_donation_product($p));
		$this->assertFalse(WDP_Sadaka_Product_Visibility::is_sadaka_line_product(5));
	}

	public function test_validate_rejects_self_and_variable(): void {
		$this->product(10);
		$variable = $this->product(30, 'variable');
		unset($variable);

		$self = WDP_Sadaka_Product_Visibility::validate_sadaka_product_id(10, 10);
		$this->assertFalse($self['ok']);

		$bad = WDP_Sadaka_Product_Visibility::validate_sadaka_product_id(30, 10);
		$this->assertFalse($bad['ok']);

		$ok = WDP_Sadaka_Product_Visibility::validate_sadaka_product_id(0, 10);
		$this->assertTrue($ok['ok']);
	}

	public function test_referrer_labels_list_enabled_parents(): void {
		$this->product(10);
		$this->product(20);
		WDP_Test_State::$post_meta[10]['_enable_sadaka_donation'] = 'yes';
		WDP_Test_State::$post_meta[10]['_sadaka_wc_product_id']   = 20;
		WDP_Sadaka_Product_Visibility::flush();

		$labels = WDP_Sadaka_Product_Visibility::get_referrer_labels(20);
		$this->assertNotEmpty($labels);
		$this->assertStringContainsString('10', implode(' ', $labels));
	}

	public function test_clear_visibility_caches_bumps_list_cache(): void {
		WDP_Test_State::$options['wdp_list_cache_version'] = 3;
		WDP_Test_State::$transients[ WDP_Sadaka_Product_Visibility::TRANSIENT ] = array(1, 2);
		WDP_Sadaka_Product_Visibility::clear_visibility_caches();
		$this->assertArrayNotHasKey(WDP_Sadaka_Product_Visibility::TRANSIENT, WDP_Test_State::$transients);
		$this->assertSame(4, (int) WDP_Test_State::$options['wdp_list_cache_version']);
	}
}

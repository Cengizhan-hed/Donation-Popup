<?php
/**
 * Alt bağış bağlantıları bilgi amaçlıdır; bağış kapsamı ve listeleri etkilemez.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class AddonProductVisibilityTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options[ \DonationPanel\Domain\Placement_Settings::OPTION ] = array(
			'donation_scope'      => 'all',
			'donation_categories' => array(),
		);
		\DonationPanel\Domain\Addon_Product_Visibility::init();
	}

	private function product(int $id, string $type = 'simple'): WC_Product {
		$p       = new WC_Product($id);
		$p->type = $type;
		$p->name = 'Ürün ' . $id;
		WDP_Test_State::$products[ $id ] = $p;
		return $p;
	}

	public function test_addon_line_remains_donation_product_and_listed(): void {
		WDP_Test_State::$options['wdp_success_settings'] = array('sadaka_wc_product_id' => 99);
		$line = $this->product(99);
		\DonationPanel\Domain\Addon_Product_Visibility::flush();

		$this->assertContains(99, \DonationPanel\Domain\Addon_Product_Visibility::get_all_ids());
		$this->assertTrue(\DonationPanel\Domain\Addon_Product_Visibility::is_addon_line_product(99));
		// Kapsam "all" — alt bağış bağlantısı bağış ürünü olmayı bozmaz.
		$this->assertTrue(\DonationPanel\Domain\Donation_Scope::is_donation_product($line));
	}

	public function test_explicit_donation_flag_still_tracked_as_addon_line(): void {
		$line = $this->product(20);
		WDP_Test_State::$options['wdp_success_settings'] = array('sadaka_wc_product_id' => 20);
		WDP_Test_State::$post_meta[20][ \DonationPanel\Domain\Donation_Scope::META ] = 'yes';
		\DonationPanel\Domain\Addon_Product_Visibility::flush();

		$this->assertTrue(\DonationPanel\Domain\Addon_Product_Visibility::is_addon_line_product(20));
		$this->assertTrue(\DonationPanel\Domain\Donation_Scope::is_donation_product($line));
	}

	public function test_per_product_addon_meta_requires_enable_flag(): void {
		$parent = $this->product(10);
		$line   = $this->product(20);
		unset($parent, $line);
		WDP_Test_State::$post_meta[10]['_addon_wc_product_id'] = 20;
		\DonationPanel\Domain\Addon_Product_Visibility::flush();
		$this->assertNotContains(20, \DonationPanel\Domain\Addon_Product_Visibility::get_all_ids());

		WDP_Test_State::$post_meta[10]['_enable_addon_donation'] = 'yes';
		\DonationPanel\Domain\Addon_Product_Visibility::flush();
		$ids = \DonationPanel\Domain\Addon_Product_Visibility::get_all_ids();
		$this->assertContains(20, $ids);
		$this->assertTrue(\DonationPanel\Domain\Addon_Product_Visibility::is_addon_line_product(20));
		$this->assertTrue(\DonationPanel\Domain\Donation_Scope::is_donation_product(WDP_Test_State::$products[20]));
	}

	public function test_stale_meta_on_disabled_parent_ignored(): void {
		$this->product(294);
		$this->product(10691);
		$this->product(10721);
		WDP_Test_State::$post_meta[50]['_addon_wc_product_id']   = 294;
		WDP_Test_State::$post_meta[50]['_enable_addon_donation'] = 'no';
		WDP_Test_State::$post_meta[51]['_addon_wc_product_id']   = 10691;
		WDP_Test_State::$post_meta[51]['_enable_addon_donation'] = '';
		WDP_Test_State::$post_meta[10]['_addon_wc_product_id']   = 10721;
		WDP_Test_State::$post_meta[10]['_enable_addon_donation'] = 'yes';

		\DonationPanel\Domain\Addon_Product_Visibility::flush();
		$ids = \DonationPanel\Domain\Addon_Product_Visibility::get_all_ids();
		$this->assertContains(10721, $ids);
		$this->assertNotContains(294, $ids);
		$this->assertNotContains(10691, $ids);
	}

	public function test_self_reference_never_collected(): void {
		$this->product(10);
		WDP_Test_State::$post_meta[10]['_enable_addon_donation'] = 'yes';
		WDP_Test_State::$post_meta[10]['_addon_wc_product_id']   = 10;
		\DonationPanel\Domain\Addon_Product_Visibility::flush();
		$this->assertNotContains(10, \DonationPanel\Domain\Addon_Product_Visibility::get_all_ids());
	}

	public function test_hiding_methods_removed(): void {
		$this->assertFalse(method_exists(\DonationPanel\Domain\Addon_Product_Visibility::class, 'filter_is_donation_product'));
		$this->assertFalse(method_exists(\DonationPanel\Domain\Addon_Product_Visibility::class, 'filter_donations_query_args'));
		$this->assertFalse(method_exists(\DonationPanel\Domain\Addon_Product_Visibility::class, 'exclude_from_front_queries'));
		$this->assertFalse(method_exists(\DonationPanel\Domain\Addon_Product_Visibility::class, 'exclude_from_wc_product_query'));
		$this->assertFalse(method_exists(\DonationPanel\Domain\Addon_Product_Visibility::class, 'exclude_from_rest_product_query'));
		$this->assertFalse(method_exists(\DonationPanel\Domain\Addon_Product_Visibility::class, 'exclude_from_data_store_query'));
		$this->assertFalse(method_exists(\DonationPanel\Domain\Addon_Product_Visibility::class, 'needs_visibility_advice'));
	}

	public function test_non_addon_donation_product_unchanged(): void {
		$p = $this->product(5);
		WDP_Test_State::$post_meta[5][ \DonationPanel\Domain\Donation_Scope::META ] = 'yes';
		$this->assertTrue(\DonationPanel\Domain\Donation_Scope::is_donation_product($p));
		$this->assertFalse(\DonationPanel\Domain\Addon_Product_Visibility::is_addon_line_product(5));
	}

	public function test_validate_rejects_self_and_variable(): void {
		$this->product(10);
		$variable = $this->product(30, 'variable');
		unset($variable);

		$self = \DonationPanel\Domain\Addon_Product_Visibility::validate_addon_product_id(10, 10);
		$this->assertFalse($self['ok']);

		$bad = \DonationPanel\Domain\Addon_Product_Visibility::validate_addon_product_id(30, 10);
		$this->assertFalse($bad['ok']);

		$ok = \DonationPanel\Domain\Addon_Product_Visibility::validate_addon_product_id(0, 10);
		$this->assertTrue($ok['ok']);
	}

	public function test_referrer_labels_list_enabled_parents(): void {
		$this->product(10);
		$this->product(20);
		WDP_Test_State::$post_meta[10]['_enable_addon_donation'] = 'yes';
		WDP_Test_State::$post_meta[10]['_addon_wc_product_id']   = 20;
		\DonationPanel\Domain\Addon_Product_Visibility::flush();

		$labels = \DonationPanel\Domain\Addon_Product_Visibility::get_referrer_labels(20);
		$this->assertNotEmpty($labels);
		$this->assertStringContainsString('10', implode(' ', $labels));
	}

	public function test_clear_visibility_caches_bumps_list_cache(): void {
		WDP_Test_State::$options['wdp_list_cache_version'] = 3;
		WDP_Test_State::$transients[ \DonationPanel\Domain\Addon_Product_Visibility::TRANSIENT ] = array(1, 2);
		\DonationPanel\Domain\Addon_Product_Visibility::clear_visibility_caches();
		$this->assertArrayNotHasKey(\DonationPanel\Domain\Addon_Product_Visibility::TRANSIENT, WDP_Test_State::$transients);
		$this->assertSame(4, (int) WDP_Test_State::$options['wdp_list_cache_version']);
	}
}

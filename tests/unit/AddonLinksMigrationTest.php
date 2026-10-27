<?php
/**
 * Version_Migrations 10.28.4: geçersiz alt bağış bağlantılarının temizlenmesi.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class AddonLinksMigrationTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	private function product(int $id, string $type = 'simple'): WC_Product {
		$p       = new WC_Product($id);
		$p->type = $type;
		$p->name = 'Ürün ' . $id;
		WDP_Test_State::$products[ $id ] = $p;
		return $p;
	}

	public function test_cleans_self_ref_enable_off_and_missing(): void {
		$this->product(10);
		$this->product(20);
		$this->product(30);

		WDP_Test_State::$post_meta[10]['_enable_addon_donation'] = 'yes';
		WDP_Test_State::$post_meta[10]['_addon_wc_product_id']   = 10; // self
		WDP_Test_State::$post_meta[20]['_enable_addon_donation'] = 'no';
		WDP_Test_State::$post_meta[20]['_addon_wc_product_id']   = 30; // enable off
		WDP_Test_State::$post_meta[30]['_enable_addon_donation'] = 'yes';
		WDP_Test_State::$post_meta[30]['_addon_wc_product_id']   = 999; // missing
		WDP_Test_State::$post_meta[40]['_enable_addon_donation'] = 'yes';
		WDP_Test_State::$post_meta[40]['_addon_wc_product_id']   = 20; // valid
		$this->product(40);

		$summary = \DonationPanel\Core\Version_Migrations::step_10_28_4(false);
		$this->assertStringContainsString('cleaned:3', $summary);
		$this->assertStringContainsString('valid:1', $summary);

		$this->assertArrayNotHasKey('_addon_wc_product_id', WDP_Test_State::$post_meta[10]);
		$this->assertArrayNotHasKey('_addon_wc_product_id', WDP_Test_State::$post_meta[20]);
		$this->assertArrayNotHasKey('_addon_wc_product_id', WDP_Test_State::$post_meta[30]);
		$this->assertSame(20, (int) WDP_Test_State::$post_meta[40]['_addon_wc_product_id']);

		$audit = WDP_Test_State::$options[ \DonationPanel\Domain\Addon_Product_Visibility::AUDIT_OPTION ];
		$this->assertIsArray($audit);
		$this->assertSame(3, (int) $audit['cleaned']);
		$this->assertSame(1, (int) $audit['valid']);
	}

	public function test_step_is_idempotent(): void {
		$this->product(10);
		$this->product(20);
		WDP_Test_State::$post_meta[10]['_enable_addon_donation'] = 'yes';
		WDP_Test_State::$post_meta[10]['_addon_wc_product_id']   = 20;

		\DonationPanel\Core\Version_Migrations::step_10_28_4(false);
		$meta_after = WDP_Test_State::$post_meta;
		\DonationPanel\Core\Version_Migrations::step_10_28_4(false);
		$this->assertSame(20, (int) WDP_Test_State::$post_meta[10]['_addon_wc_product_id']);
		$this->assertSame($meta_after[10], WDP_Test_State::$post_meta[10]);
	}
}

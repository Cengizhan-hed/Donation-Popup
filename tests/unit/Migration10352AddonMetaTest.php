<?php
/**
 * 10.35.2: ek bağış ("sadaka" -> "addon") ürün meta göçü: idempotent, eski anahtar korunur, okuma yedeği.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class Migration10352AddonMetaTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	private function legacy_fixture(): void {
		WDP_Test_State::$post_meta[10] = array(
			'_enable_sadaka_donation'  => 'yes',
			'_sadaka_wc_product_id'    => '20',
			'_sadaka_min_price'        => '5',
			'_sadaka_fixed_price'      => '10',
			'_sadaka_donation_message' => 'Teşekkürler ğüşiöç',
			'_sadaka_toggle_label'     => 'Ek bağış',
		);
		WDP_Test_State::$post_meta[11] = array( '_unrelated' => 'x' );
		WDP_Test_State::$options['wdp_sadaka_links_audit'] = array( 'rows' => array( 1 ) );
	}

	public function test_legacy_keys_are_read_before_migration(): void {
		$this->legacy_fixture();
		$this->assertSame('20', (string) WDP_Addon_Product_Visibility::get_meta(10, '_addon_wc_product_id'));
		$this->assertSame('yes', WDP_Addon_Product_Visibility::get_meta(10, '_enable_addon_donation'));
	}

	public function test_migration_copies_to_new_keys_keeps_old_and_is_idempotent(): void {
		$this->legacy_fixture();
		WDP_Migrations::step_10_35_2(false);

		$meta = WDP_Test_State::$post_meta[10];
		$this->assertSame('yes', $meta['_enable_addon_donation']);
		$this->assertSame('20', $meta['_addon_wc_product_id']);
		$this->assertSame('Teşekkürler ğüşiöç', $meta['_addon_donation_message']);
		$this->assertSame('yes', $meta['_enable_sadaka_donation'], 'eski anahtar okuma yedeği olarak kalır');
		$this->assertArrayNotHasKey('_addon_wc_product_id', WDP_Test_State::$post_meta[11]);
		$this->assertSame(array( 'rows' => array( 1 ) ), WDP_Test_State::$options['wdp_addon_links_audit']);

		$snapshot = WDP_Test_State::$post_meta;
		$options  = WDP_Test_State::$options;
		$summary  = WDP_Migrations::step_10_35_2(false);
		$this->assertSame($snapshot, WDP_Test_State::$post_meta, 'ikinci çalıştırma değişiklik yapmaz');
		$this->assertSame($options, WDP_Test_State::$options);
		$this->assertStringContainsString('copied:0', $summary);
	}

	public function test_new_key_wins_over_legacy_and_not_overwritten(): void {
		$this->legacy_fixture();
		WDP_Test_State::$post_meta[10]['_addon_min_price'] = '7';
		WDP_Migrations::step_10_35_2(false);
		$this->assertSame('7', WDP_Test_State::$post_meta[10]['_addon_min_price']);
		$this->assertSame('7', (string) WDP_Addon_Product_Visibility::get_meta(10, '_addon_min_price'));
	}

	public function test_fresh_install_copies_nothing(): void {
		$this->legacy_fixture();
		WDP_Migrations::step_10_35_2(true);
		$this->assertArrayNotHasKey('_addon_min_price', WDP_Test_State::$post_meta[10]);
	}
}

<?php
/**
 * 6-C uyumluluk sözleşmesi: kısa kodlar + öznitelikleri, kanca adları, eski meta/seçenek anahtarları
 * "sadaka" -> "addon" iç adlandırmasından sonra da eskisi gibi çalışır.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class CompatibilityContractTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	private static function src(string $rel): string {
		return (string) file_get_contents(dirname(__DIR__, 2) . '/' . $rel);
	}

	public function test_shortcode_tags_unchanged(): void {
		$src = self::src('src/Modules/EntryPoints/class-shortcodes.php');
		foreach (array( 'wdp_donation_button', 'wdp_donation_button_panel', 'wdp_donation_form', 'wdp_donations' ) as $tag) {
			$this->assertMatchesRegularExpression("/add_shortcode\\(\\s*'" . $tag . "'/", $src, $tag);
		}
	}

	public function test_shortcode_attributes_unchanged(): void {
		$src = self::src('src/Modules/EntryPoints/class-shortcodes.php');
		foreach (array( 'id', 'slug', 'sku', 'text', 'button_text', 'class', 'title', 'show_title' ) as $att) {
			$this->assertMatchesRegularExpression("/'" . $att . "'\\s+=>/", $src, 'öznitelik ' . $att);
		}
		$this->assertStringContainsString("'wdp_donation_form'", $src);
	}

	public function test_old_hook_names_still_fired_in_source(): void {
		$all = '';
		foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(dirname(__DIR__, 2) . '/includes')) as $f) {
			if (substr((string) $f, -4) === '.php') {
				$all .= (string) file_get_contents((string) $f);
			}
		}
		foreach (array(
			'wdp_sadaka_cart_thumbnail_size',
			'wdp_sadaka_line_product_ids',
			'wdp_sadaka_wc_product_id',
			'wdp_sadaka_inspirational_message',
			'wdp_sadaka_toggle_label',
			'wdp_sadaka_price_label',
		) as $hook) {
			$this->assertMatchesRegularExpression("/apply_filters\\(\\s*'" . $hook . "'/", $all, $hook);
		}
	}

	public function test_old_filter_still_applies_behaviourally(): void {
		WDP_Test_State::$filters['wdp_sadaka_line_product_ids'] = static function ($ids) {
			$ids[] = 777;
			return $ids;
		};
		WDP_Addon_Product_Visibility::flush();
		$this->assertContains(777, WDP_Addon_Product_Visibility::get_all_ids());
	}

	public function test_legacy_product_meta_and_option_keys_readable(): void {
		WDP_Test_State::$post_meta[5] = array(
			'_enable_sadaka_donation' => 'yes',
			'_sadaka_min_price'       => '3',
		);
		$this->assertSame('yes', WDP_Addon_Product_Visibility::get_meta(5, '_enable_addon_donation'));
		$this->assertSame('3', (string) WDP_Addon_Product_Visibility::get_meta(5, '_addon_min_price'));
		$this->assertTrue(WDP_Addon_Product_Visibility::parent_has_addon_enabled(5));
		WDP_Test_State::$options['wdp_sadaka_links_audit'] = array( 'rows' => array() );
		WDP_Migrations::step_10_35_2(false);
		$this->assertArrayHasKey('wdp_sadaka_links_audit', WDP_Test_State::$options);
		$this->assertArrayHasKey('wdp_addon_links_audit', WDP_Test_State::$options);
	}

	public function test_protected_runtime_keys_unchanged(): void {
		$cart = self::src('includes/class-cart.php');
		$this->assertStringContainsString("'wdp_sadaka_donation'", $cart);
		$this->assertStringContainsString("'wdp_sadaka_linked_wc_product'", $cart);
		$this->assertStringContainsString("'wdp_sadaka_donation'", self::src('includes/traits/trait-wdp-ajax-cart-add.php'));
	}
}

<?php
/**
 * Bozuk / sınır dışı meta kayıttan sonra güvenli varsayılanlar.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class RobustMetaTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_clamps_on_save(): void {
		$meta = WDP_Product_Settings_Service::from_request(
			array(
				'cover_fee_percent'  => '99',
				'max_shares'         => '500',
				'theme_radius'       => '80',
				'min_custom_price'   => '-12',
				'progress_bar_limit' => '-1',
				'donation_type'      => 'campaign',
				'theme_primary'      => 'not-a-color',
				'layout_mode'        => 'neon',
			)
		);
		$this->assertSame('20', $meta['_cover_fee_percent']);
		$this->assertSame(100, $meta['_max_shares']);
		$this->assertSame('40', $meta['_theme_radius']);
		$this->assertSame('0', $meta['_min_custom_price']);
		$this->assertSame(WDP_Donation_Type::DEFAULT_GOAL, $meta['_progress_bar_limit']);
		$this->assertSame('', $meta['_theme_primary']);
		$this->assertSame('classic', $meta['_layout_mode']);
	}

	public function test_invalid_trust_json_becomes_empty(): void {
		$meta = WDP_Product_Settings_Service::from_request(
			array(
				'trust_badges' => '{not json',
			)
		);
		$this->assertSame('', $meta['_trust_badges']);
	}

	public function test_unknown_layout_on_read_is_classic(): void {
		$p = new WC_Product(8);
		$p->type = 'simple';
		WDP_Test_State::$products[8] = $p;
		WDP_Test_State::$post_meta[8] = array('_layout_mode' => '???', '_cover_fee_percent' => '50');
		$context = WDP_Donation_Product_Context_Service::build_form_context($p);
		$this->assertSame('classic', $context['layout_mode']);
		$this->assertEquals(20, $context['cover_fee_percent']);
	}

	public function test_broken_sadaka_product_id_is_numeric(): void {
		$meta = WDP_Product_Settings_Service::from_request(
			array(
				'sadaka_wc_product_id' => 'abc',
			)
		);
		$this->assertTrue($meta['_sadaka_wc_product_id'] === '' || $meta['_sadaka_wc_product_id'] === 0);
	}
}

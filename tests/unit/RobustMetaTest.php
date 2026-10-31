<?php
/**
 * Bozuk / sınır dışı meta kayıttan sonra güvenli varsayılanlar.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Admin\Product\Product_Settings;
use PHPUnit\Framework\TestCase;

final class RobustMetaTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_clamps_on_save(): void {
		$result = Product_Settings::normalize(
			array(
				'cover_fee_percent'  => '99',
				'max_shares'         => '500',
				'min_custom_price'   => '-12',
				'progress_bar_limit' => '-1',
				'donation_type'      => 'campaign',
			)
		);
		$meta   = $result['meta'];
		// Sınır dışı yüzde sessizce kısılmaz; reddedilir (kayıtlı değer yoksa yazılmaz) ve uyarı üretir.
		$this->assertArrayNotHasKey('_cover_fee_percent', $meta);
		// Hisse >50 ve hedef ≤0 reddedilir (sessiz varsayılan hedef yok).
		$this->assertArrayNotHasKey('_max_shares', $meta);
		$this->assertArrayNotHasKey('_progress_bar_limit', $meta);
		$this->assertSame('0', $meta['_min_custom_price']);
		$this->assertNotEmpty($result['notices']);
	}

	public function test_rejected_values_keep_the_stored_ones(): void {
		$result = Product_Settings::normalize(
			array(
				'donation_type'      => 'campaign',
				'progress_bar_limit' => '0',
				'cover_fee_percent'  => '99',
				'max_shares'         => '500',
			),
			array(
				'_progress_bar_limit' => '2500',
				'_cover_fee_percent'  => '3',
				'_max_shares'         => '9',
			)
		);
		$this->assertSame('2500', $result['meta']['_progress_bar_limit']);
		$this->assertSame('3', $result['meta']['_cover_fee_percent']);
		$this->assertSame('9', $result['meta']['_max_shares']);
	}

	public function test_unknown_layout_on_read_is_classic(): void {
		$p = new WC_Product(8);
		$p->type = 'simple';
		WDP_Test_State::$products[8] = $p;
		WDP_Test_State::$post_meta[8] = array('_layout_mode' => '???', '_cover_fee_percent' => '50');
		$context = \DonationPanel\Domain\Product_Context::build_form_context($p);
		$this->assertSame('classic', $context['layout_mode']);
		// 10.29.0: çalışma anı üst sınırı 15 (önceki 20).
		$this->assertEquals(15, $context['cover_fee_percent']);
	}

	public function test_broken_addon_product_id_is_numeric(): void {
		$meta = Product_Settings::normalize(array('addon_wc_product_id' => 'abc'))['meta'];
		$this->assertSame('', $meta['_addon_wc_product_id']);
	}
}

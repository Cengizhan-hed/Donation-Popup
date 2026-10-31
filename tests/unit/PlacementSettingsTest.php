<?php
/**
 * wdp_placement_settings normalizer ve yükseltmede auto_place=no.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class PlacementSettingsTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_normalize_fills_defaults_and_drops_unknown(): void {
		$out = \DonationPanel\Domain\Placement_Settings::normalize(array('auto_place' => 'YES', 'bogus' => 1, 'position' => 'nowhere'));
		$this->assertSame('yes', $out['auto_place']);
		$this->assertSame('replace_cart', $out['position']);
		$this->assertArrayNotHasKey('bogus', $out);
		$this->assertSame(array(), $out['donation_categories']);
	}

	public function test_missing_option_reads_as_auto_place_no(): void {
		$settings = \DonationPanel\Domain\Placement_Settings::get();
		$this->assertSame('no', $settings['auto_place']);
	}

	public function test_categories_are_unique_ints(): void {
		$out = \DonationPanel\Domain\Placement_Settings::normalize(array('donation_categories' => array('3', '3', 'x', 7)));
		$this->assertSame(array(3, 7), $out['donation_categories']);
	}
}

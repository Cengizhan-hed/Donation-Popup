<?php
/**
 * [wdp_donations] nitelik sanitizasyonu.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class DonationsListAttsTest extends TestCase {
	public function test_defaults_and_unknown_values(): void {
		$atts = \DonationPanel\Modules\EntryPoints\Donations_List::sanitize_atts(array('orderby' => 'hack', 'columns' => 99, 'button' => 'magic', 'tabs' => 'maybe'));
		$this->assertSame('menu_order', $atts['orderby']);
		$this->assertSame(3, $atts['columns']);
		$this->assertSame('panel', $atts['button']);
		$this->assertSame('yes', $atts['tabs']);
		$this->assertSame(48, $atts['limit']);
	}

	public function test_lists_and_bounds(): void {
		$atts = \DonationPanel\Modules\EntryPoints\Donations_List::sanitize_atts(
			array(
				'categories'    => 'kurban, su',
				'ids'           => '1,2,2,abc',
				'limit'         => 0,
				'excerpt_words' => 80,
				'gap'           => 100,
			)
		);
		$this->assertSame(array('kurban', 'su'), $atts['categories']);
		$this->assertSame(array(1, 2), $atts['ids']);
		$this->assertSame(48, $atts['limit']);
		$this->assertSame(18, $atts['excerpt_words']);
		$this->assertSame(24, $atts['gap']);
	}
}

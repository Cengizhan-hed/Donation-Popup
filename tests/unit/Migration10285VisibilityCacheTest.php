<?php
/**
 * 10.28.5: alt bağış görünürlük önbellek temizliği.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class Migration10285VisibilityCacheTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_step_clears_transient_and_bumps_list_cache(): void {
		WDP_Test_State::$options['wdp_list_cache_version'] = 7;
		WDP_Test_State::$transients[ \DonationPanel\Domain\Addon_Product_Visibility::TRANSIENT ] = array(10691);
		// Geçerli denetim satırı korunmalı (yeniden silinmez).
		WDP_Test_State::$options[ \DonationPanel\Domain\Addon_Product_Visibility::AUDIT_OPTION ] = array(
			'rows' => array(
				array('status' => 'valid', 'parent_id' => 10, 'addon_id' => 20),
			),
		);

		$summary = \DonationPanel\Core\Version_Migrations::step_10_28_5(false);

		$this->assertStringContainsString('list_cache:7→8', $summary);
		$this->assertStringContainsString('bumped:yes', $summary);
		$this->assertArrayNotHasKey(\DonationPanel\Domain\Addon_Product_Visibility::TRANSIENT, WDP_Test_State::$transients);
		$audit = WDP_Test_State::$options[ \DonationPanel\Domain\Addon_Product_Visibility::AUDIT_OPTION ];
		$this->assertSame('valid', $audit['rows'][0]['status']);
		$this->assertSame(20, (int) $audit['rows'][0]['addon_id']);

		// İkinci çağrı: liste önbelleği tekrar artmaz.
		$summary2 = \DonationPanel\Core\Version_Migrations::step_10_28_5(false);
		$this->assertStringContainsString('list_cache:8→8', $summary2);
		$this->assertStringContainsString('bumped:no', $summary2);
		$this->assertSame(8, (int) WDP_Test_State::$options['wdp_list_cache_version']);
	}

	public function test_steps_include_10_28_5(): void {
		$steps = \DonationPanel\Core\Version_Migrations::steps();
		$this->assertArrayHasKey('10.28.5', $steps);
	}
}

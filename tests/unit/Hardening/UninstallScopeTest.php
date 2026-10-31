<?php
/**
 * #14: kaldırma yalnız eklentinin kesin anahtarlarını siler; başka eklentilerin verisine dokunmaz.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Uninstall;
use PHPUnit\Framework\TestCase;

final class UninstallScopeTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_generic_prefixes_are_not_deleted(): void {
		foreach ( array( '_enable_foo', '_theme_color_other', '_addon_other_plugin', 'wdp_other', '_wdp_x_unknown_owned' ) as $key ) {
			if ( '_wdp_x_unknown_owned' === $key ) {
				$this->assertTrue( Uninstall::should_delete_product_meta_key( $key ), $key );
				continue;
			}
			$this->assertFalse( Uninstall::should_delete_product_meta_key( $key ), $key );
		}
		$this->assertTrue( Uninstall::should_delete_product_meta_key( '_enable_progress_bar' ) );
		$this->assertTrue( Uninstall::should_delete_product_meta_key( '_theme_primary' ) );
		$this->assertTrue( Uninstall::should_delete_product_meta_key( '_addon_min_price' ) );
	}

	public function test_cleanup_keeps_foreign_meta_and_options_and_clears_own_transients(): void {
		WDP_Test_State::$options['wdp_delete_data_on_uninstall'] = '1';
		WDP_Test_State::$options['wdp_button_settings']          = array( 'x' => 1 );
		WDP_Test_State::$options['wdp_foreign_plugin_option']    = 'keep';
		WDP_Test_State::$options['_transient_donation_panel_rl_abc']         = 3;
		WDP_Test_State::$options['_transient_timeout_donation_panel_rt_abc'] = 3;
		WDP_Test_State::$options['_transient_dp_progress_5_GBP']             = 3;
		WDP_Test_State::$options['_transient_foreign_cache']                 = 'keep';
		WDP_Test_State::$products[1]   = new WC_Product( 1 );
		WDP_Test_State::$post_types[1] = 'product';
		WDP_Test_State::$post_meta[1]  = array(
			'_enable_progress_bar' => 'yes',
			'_enable_foreign'      => 'keep',
			'_theme_foreign'       => 'keep',
			'_addon_foreign'       => 'keep',
			'_wdp_manual_total'    => '5',
		);

		Uninstall::cleanup_site();

		$this->assertArrayNotHasKey( '_enable_progress_bar', WDP_Test_State::$post_meta[1] );
		$this->assertArrayNotHasKey( '_wdp_manual_total', WDP_Test_State::$post_meta[1] );
		$this->assertSame( 'keep', WDP_Test_State::$post_meta[1]['_enable_foreign'] );
		$this->assertSame( 'keep', WDP_Test_State::$post_meta[1]['_theme_foreign'] );
		$this->assertSame( 'keep', WDP_Test_State::$post_meta[1]['_addon_foreign'] );
		$this->assertArrayNotHasKey( 'wdp_button_settings', WDP_Test_State::$options );
		$this->assertSame( 'keep', WDP_Test_State::$options['wdp_foreign_plugin_option'] );
		$this->assertArrayNotHasKey( '_transient_donation_panel_rl_abc', WDP_Test_State::$options );
		$this->assertArrayNotHasKey( '_transient_timeout_donation_panel_rt_abc', WDP_Test_State::$options );
		$this->assertArrayNotHasKey( '_transient_dp_progress_5_GBP', WDP_Test_State::$options );
		$this->assertSame( 'keep', WDP_Test_State::$options['_transient_foreign_cache'] );
	}
}

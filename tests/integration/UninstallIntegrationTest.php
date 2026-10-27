<?php
/**
 * Gerçek WP + WooCommerce: "verileri sil" yalnız eklentinin kendi anahtarlarını siler; başka eklentinin ürün meta'sına,
 * seçeneklerine ve siparişlere dokunmaz.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Uninstall;

final class UninstallIntegrationTest extends WDP_Integration_Test_Case {

	/** @var mixed */
	private $settings_backup;

	protected function setUp(): void {
		parent::setUp();
		$this->settings_backup = get_option( 'donation_panel_settings', null );
	}

	protected function tearDown(): void {
		if ( null === $this->settings_backup ) {
			delete_option( 'donation_panel_settings' );
		} else {
			update_option( 'donation_panel_settings', $this->settings_backup );
		}
		parent::tearDown();
	}

	public function test_uninstall_removes_own_data_but_not_other_plugins_meta_options_or_orders(): void {
		$product = $this->create_product(
			'25',
			array(
				// Eklentinin kendi anahtarları (silinmeli).
				'_wdp_total_donation_amount' => '123',
				'_enable_addon_donation'     => 'yes',
				// Başka eklenti/temanın anahtarları; genel önekleri paylaşır (silinmemeli).
				'_enable_other_plugin_feature' => 'keep-1',
				'_theme_layout_choice'         => 'keep-2',
				'_addon_other_plugin_data'     => 'keep-3',
				'_wdp_not_ours_but_prefixed'   => 'maybe',
			)
		);
		$pid   = $product->get_id();
		$order = $this->create_order( $pid, 25.0, 'completed' );
		foreach ( $order->get_items() as $item ) {
			$item->add_meta_data( 'wdp_donor_name', 'Ayşe Yılmaz', true );
			$item->save();
		}
		update_option( 'some_other_plugin_option', 'keep' );
		$this->option_names[] = 'some_other_plugin_option';
		update_option( 'donation_panel_settings', array( 'general' => array( 'delete_data_on_uninstall' => true ) ) );
		set_transient( 'donation_panel_rl_integration_probe', 3, 600 );

		Uninstall::cleanup_site();
		wp_cache_flush(); // uninstall doğrudan SQL siler; sonraki istek taze önbellekle başlar.

		$this->assertSame( '', (string) get_post_meta( $pid, '_wdp_total_donation_amount', true ), 'Kendi toplam meta\'sı silinmeli.' );
		$this->assertSame( 'keep-1', get_post_meta( $pid, '_enable_other_plugin_feature', true ), 'Başka eklentinin _enable_ meta\'sı kalmalı.' );
		$this->assertSame( 'keep-2', get_post_meta( $pid, '_theme_layout_choice', true ), 'Başka eklentinin _theme_ meta\'sı kalmalı.' );
		$this->assertSame( 'keep-3', get_post_meta( $pid, '_addon_other_plugin_data', true ), 'Başka eklentinin _addon_ meta\'sı kalmalı.' );
		$this->assertSame( 'keep', get_option( 'some_other_plugin_option' ) );
		$this->assertFalse( get_transient( 'donation_panel_rl_integration_probe' ), 'Eklentinin geçici kayıtları silinmeli.' );

		$loaded = wc_get_order( $order->get_id() );
		$this->assertNotNull( $loaded, 'Sipariş silinmemeli.' );
		$names = array();
		foreach ( $loaded->get_items() as $item ) {
			$names[] = $item->get_meta( 'wdp_donor_name' );
		}
		$this->assertSame( array( 'Ayşe Yılmaz' ), $names, 'Bağışçı verisi sipariş kaleminde kalmalı.' );
	}
}

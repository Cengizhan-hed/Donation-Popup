<?php
/**
 * E0: Logger (kişisel veri yazmaz), Assets kaydı, Plugin tek girişi.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Plugin;
use DonationPanel\Frontend\Assets;
use DonationPanel\Support\Logger;
use PHPUnit\Framework\TestCase;

final class E0LoggerAndPluginTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		Plugin::reset();
	}

	public function test_logger_masks_email_phone_and_sensitive_context(): void {
		$captured = array();
		$logger   = new Logger(static function ($level, $message, $context) use (&$captured) {
			$captured = array( $level, $message, $context );
		});
		$logger->error('Failed for ayse@example.org phone +90 532 123 45 67', array(
			'order_id'    => 15,
			'donor_email' => 'ayse@example.org',
			'Phone'       => '05321234567',
			'nested'      => array( 'full_name' => 'Ayse Yilmaz', 'amount' => 25 ),
			'note'        => 'in memory of X',
			'free'        => 'contact bob@example.com',
		));

		$this->assertSame('error', $captured[0]);
		$this->assertSame('Failed for [email] phone [number]', $captured[1]);
		$this->assertSame(15, $captured[2]['order_id']);
		$this->assertSame('[redacted]', $captured[2]['donor_email']);
		$this->assertSame('[redacted]', $captured[2]['Phone']);
		$this->assertSame('[redacted]', $captured[2]['nested']['full_name']);
		$this->assertSame(25, $captured[2]['nested']['amount']);
		$this->assertSame('[redacted]', $captured[2]['note']);
		$this->assertSame('contact [email]', $captured[2]['free']);
	}

	public function test_logger_without_woocommerce_is_a_noop(): void {
		(new Logger())->info('hello');
		$this->assertTrue(true);
	}

	public function test_plugin_boot_is_idempotent_and_wires_hooks(): void {
		$first  = Plugin::boot(WDP_PLUGIN_DIR, WDP_PLUGIN_URL);
		$second = Plugin::boot(WDP_PLUGIN_DIR, WDP_PLUGIN_URL);
		$this->assertSame($first, $second);
		$this->assertSame($first, Plugin::instance());

		$this->assertCount(1, WDP_Test_State::$actions['plugins_loaded']);
		$this->assertCount(1, WDP_Test_State::$actions['rest_api_init']);
		$this->assertCount(1, WDP_Test_State::$actions['wp_enqueue_scripts']);

		$container = $first->container();
		$this->assertInstanceOf(Container::class, $container);
		$this->assertSame($container->get(Module_Registry::class), $container->get(Module_Registry::class));
		$this->assertSame(array(), $container->get(Module_Registry::class)->slugs());
	}

	public function test_plugins_loaded_runs_migrations_and_import_once(): void {
		WDP_Test_State::$options['wdp_delete_data_on_uninstall'] = '1';
		$plugin = Plugin::boot(WDP_PLUGIN_DIR, WDP_PLUGIN_URL);
		$plugin->on_plugins_loaded();
		$this->assertTrue(WDP_Test_State::$options['donation_panel_settings']['general']['delete_data_on_uninstall']);
		$snapshot = WDP_Test_State::$options;
		$plugin->on_plugins_loaded();
		$this->assertSame($snapshot, WDP_Test_State::$options);
		$this->assertSame('1', WDP_Test_State::$options['wdp_delete_data_on_uninstall']);
	}

	public function test_assets_handle_and_missing_files_are_skipped(): void {
		$this->assertSame('donation-panel-example', Assets::handle('Example'));
		$assets = new Assets(WDP_PLUGIN_DIR, WDP_PLUGIN_URL);
		$assets->define('ghost', 'assets/build/ghost/index.js', 'assets/build/ghost/index.css');
		$assets->register_all();
		$this->assertTrue(true);
	}
}

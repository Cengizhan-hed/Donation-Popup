<?php
/**
 * E0: Logger (kişisel veri yazmaz), Assets kaydı, Plugin tek girişi.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Plugin;
use DonationPanel\Frontend\Assets;
use DonationPanel\Support\Logger;
use PHPUnit\Framework\TestCase;

final class LoggerAndPluginTest extends TestCase {

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
		// Yeni modüller (side_cart, ...) listeye eklenebilir: çekirdek ikisi her zaman kayıtlı.
		$this->assertSame(array('entry_points', 'experiences'), array_slice($container->get(Module_Registry::class)->slugs(), 0, 2));
		$this->assertTrue($container->get(Module_Registry::class)->is_enabled('experiences'), 'Tek deneyim: experiences varsayilan acik.');
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

	public function test_enqueue_before_wp_enqueue_scripts_is_deferred_without_duplicates(): void {
		$dir = sys_get_temp_dir() . '/wdp-assets-' . uniqid();
		mkdir($dir . '/assets/build/blk', 0777, true);
		file_put_contents($dir . '/assets/build/blk/index.js', '//');
		$assets = new Assets($dir, 'https://example.test/p');
		$assets->define('blk', 'assets/build/blk/index.js', '');
		add_action('wp_enqueue_scripts', array( $assets, 'register_all' ), 5);

		$assets->enqueue('blk');
		$assets->enqueue('blk');
		$this->assertArrayNotHasKey('__enqueued_scripts', WDP_Test_State::$options);

		WDP_Test_State::$did_actions['wp_enqueue_scripts'] = 1;
		do_action('wp_enqueue_scripts');
		$this->assertSame(array( 'donation-panel-blk' ), WDP_Test_State::$options['__enqueued_scripts']);

		unlink($dir . '/assets/build/blk/index.js');
		rmdir($dir . '/assets/build/blk');
		rmdir($dir . '/assets/build');
		rmdir($dir . '/assets');
		rmdir($dir);
	}
}

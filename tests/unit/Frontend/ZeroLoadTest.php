<?php
/**
 * 12.1 sıfır yük kuralları (CLAUDE.md §24): ön yüz kapısı, tembel varlık kaydı, autoload, ek sorgusuz kapsam okuması.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Settings;
use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Frontend\Assets;
use DonationPanel\Frontend\Front_Gate;
use PHPUnit\Framework\TestCase;

if (!function_exists('__return_true')) {
	function __return_true() {
		return true;
	}
}
if (!function_exists('__return_empty_string')) {
	function __return_empty_string() {
		return '';
	}
}

final class ZeroLoadTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_front_gate_is_open_by_default(): void {
		$this->assertFalse(Front_Gate::disabled());
	}

	public function test_front_gate_closes_with_setting_or_filter(): void {
		WDP_Test_State::$options[ Settings::OPTION_NAME ] = array( 'general' => array( 'disable_frontend' => true ) );
		$this->assertTrue(Front_Gate::disabled(), 'general.disable_frontend ayarı ön yüzü kapatır.');

		WDP_Test_State::reset();
		add_filter('donation_panel_front_disabled', '__return_true');
		$this->assertTrue(Front_Gate::disabled(), 'Filtre ön yüzü kapatır (DONATION_PANEL_DISABLE sabiti ile aynı yol).');
	}

	public function test_disabled_front_enqueues_nothing(): void {
		$dir = sys_get_temp_dir() . '/wdp-zl-' . uniqid();
		mkdir($dir . '/assets/build/blk', 0777, true);
		file_put_contents($dir . '/assets/build/blk/index.js', '//');
		$assets = new Assets($dir, 'https://example.test/p');
		$assets->define('blk', 'assets/build/blk/index.js', '');

		add_filter('donation_panel_front_disabled', '__return_true');
		$assets->enqueue('blk');
		$this->assertArrayNotHasKey('__scripts', WDP_Test_State::$options, 'Kapıdayken kayıt bile yok.');
		$this->assertArrayNotHasKey('__enqueued_scripts', WDP_Test_State::$options);

		unlink($dir . '/assets/build/blk/index.js');
		rmdir($dir . '/assets/build/blk');
		rmdir($dir . '/assets/build');
		rmdir($dir . '/assets');
		rmdir($dir);
	}

	public function test_silent_shortcodes_cover_every_public_tag_and_return_empty(): void {
		Front_Gate::register_silent_shortcodes();
		foreach (array( 'wdp_donation_button', 'wdp_donation_button_panel', 'wdp_donation_form', 'wdp_donations', 'donation_panel_experience', 'donation_panel_progress', 'donation_panel_social_proof', 'donation_panel_side_cart', 'donation_panel_account' ) as $tag) {
			$this->assertArrayHasKey($tag, WDP_Test_State::$shortcodes, $tag);
			$this->assertSame('', call_user_func(WDP_Test_State::$shortcodes[ $tag ]), $tag);
		}
	}

	public function test_ensure_autoload_is_idempotent_and_writes_missing_defaults_as_autoloaded_options(): void {
		Settings::ensure_autoload();
		$this->assertSame('1', WDP_Test_State::$options[ Settings::AUTOLOAD_FLAG ]);
		$this->assertArrayHasKey(Settings::OPTION_NAME, WDP_Test_State::$options, 'Eksik ayar kaydı, her istekte sorgu harcamasın diye yazılır.');
		$this->assertArrayHasKey('wdp_placement_settings', WDP_Test_State::$options);
		$snapshot = WDP_Test_State::$options;

		Settings::ensure_autoload();
		$this->assertSame($snapshot, WDP_Test_State::$options, 'İkinci çağrı hiçbir şey yazmaz.');
	}

	public function test_uninstall_lists_every_option_key_the_plugin_writes(): void {
		$known = \DonationPanel\Core\Uninstall::option_names();
		$found = array();
		$it    = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(dirname(__DIR__, 3) . '/src', \FilesystemIterator::SKIP_DOTS));
		foreach ($it as $file) {
			if ('php' !== $file->getExtension()) {
				continue;
			}
			$code = (string) file_get_contents($file->getPathname());
			if (preg_match_all("/(?:get|update|add|delete)_option\\(\\s*'((?:wdp|donation_panel)_[a-z0-9_]+)'|\\\$flag\\s*=\\s*'(wdp_[a-z0-9_]+)'|const\\s+[A-Z_]*(?:OPTION|FLAG|LOCK)[A-Z_]*\\s*=\\s*'((?:wdp|donation_panel)_[a-z0-9_]+)'/", $code, $m)) {
				foreach (array_merge($m[1], $m[2], $m[3]) as $name) {
					if ('' !== $name) {
						$found[ $name ] = $file->getFilename();
					}
				}
			}
		}
		$this->assertNotEmpty($found);
		foreach ($found as $name => $where) {
			$this->assertContains($name, $known, "Kaldırmada silinmeyen seçenek: $name ($where)");
		}
	}

	public function test_donation_flag_is_read_from_post_meta_cache_not_from_product_meta_data(): void {
		WDP_Test_State::$post_meta[5] = array( Donation_Scope::META => 'yes' );
		$product                      = new class() {
			public function get_id() {
				return 5;
			}

			public function get_meta($key = '', $single = true) {
				throw new \LogicException('WC_Data::get_meta ürün başına ek read_meta_data sorgusu açar.');
			}
		};
		$this->assertSame('yes', Donation_Scope::product_flag($product));
	}
}

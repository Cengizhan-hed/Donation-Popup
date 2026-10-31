<?php
/**
 * i18n altyapısı — Domain Path, textdomain.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class I18nInfraTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_plugin_header_has_domain_path(): void {
		$header = (string) file_get_contents(WDP_PLUGIN_FILE);
		$this->assertMatchesRegularExpression('/^\s*\*\s*Domain Path:\s*\/languages/m', $header);
		$this->assertMatchesRegularExpression('/^\s*\*\s*Text Domain:\s*woo-donation-popup/m', $header);
	}

	public function test_load_textdomain_uses_languages_dir(): void {
		\DonationPanel\Core\Bootstrap::load_textdomain();
		$td = WDP_Test_State::$options['__textdomain'] ?? array();
		$this->assertSame('woo-donation-popup', $td['domain'] ?? '');
		$this->assertStringEndsWith('/languages', (string) ($td['plugin_rel_path'] ?? ''));
	}

	public function test_textdomain_hooked_on_init(): void {
		\DonationPanel\Core\Bootstrap::run();
		$this->assertNotEmpty(WDP_Test_State::$actions['init'] ?? array());
		$found = false;
		foreach (WDP_Test_State::$actions['init'] as $cb) {
			if ($cb === array(\DonationPanel\Core\Bootstrap::class, 'load_textdomain')) {
				$found = true;
				break;
			}
		}
		$this->assertTrue($found, 'load_textdomain init kancasında olmalı');
	}
}

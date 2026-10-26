<?php
/**
 * Telefon alanı: varsayılan ülke ve sıra WooCommerce mağaza ülkesinden; sabit Türkiye varsayımı yok.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

if (!class_exists('WDP_Test_WC_Countries', false)) {
	class WDP_Test_WC_Countries {
		/** @var string */
		public static $base = 'GB';

		public function get_base_country() {
			return self::$base;
		}

		public function get_countries() {
			return array(
				'GB' => 'United Kingdom (UK)',
				'TR' => 'Türkiye',
				'IL' => 'Israel',
				'US' => 'United States (US)',
			);
		}

		public function get_country_calling_code($cc) {
			$map = array('IL' => '+972', 'GB' => '+44', 'TR' => '+90', 'US' => '+1');
			return isset($map[ $cc ]) ? $map[ $cc ] : '';
		}
	}
	class WDP_Test_WC_Root {
		public $countries;
		/** WooCommerce yokmuş gibi davranan diğer testler için boş özellikler. */
		public $cart     = null;
		public $session  = null;
		public $customer = null;

		public function __construct() {
			$this->countries = new WDP_Test_WC_Countries();
		}
	}
}
if (!function_exists('WC')) {
	function WC() {
		static $wc = null;
		if ($wc === null) {
			$wc = new WDP_Test_WC_Root();
		}
		return $wc;
	}
}

final class PhoneFieldLocaleTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		$GLOBALS['wdp_test_locale'] = 'en_US';
	}

	protected function tearDown(): void {
		WDP_Test_WC_Countries::$base = 'GB';
		unset($GLOBALS['wdp_test_locale']);
	}

	public function test_default_country_is_the_store_country(): void {
		WDP_Test_WC_Countries::$base = 'GB';
		$this->assertSame('gb', WDP_Phone_Field::get_default_country_iso());
		WDP_Test_WC_Countries::$base = 'TR';
		$this->assertSame('tr', WDP_Phone_Field::get_default_country_iso());
	}

	public function test_store_country_is_listed_first_and_others_follow_by_name(): void {
		WDP_Test_WC_Countries::$base = 'GB';
		$keys = array_keys(WDP_Phone_Field::get_countries());
		$this->assertSame('gb', $keys[0]);
		WDP_Test_WC_Countries::$base = 'TR';
		$keys = array_keys(WDP_Phone_Field::get_countries());
		$this->assertSame('tr', $keys[0]);
	}

	public function test_country_missing_from_plugin_list_is_added_from_woocommerce(): void {
		WDP_Test_WC_Countries::$base = 'IL';
		$countries = WDP_Phone_Field::get_countries();
		$this->assertArrayHasKey('il', $countries);
		$this->assertSame('972', $countries['il']['dial']);
		$this->assertSame('Israel', $countries['il']['name']);
		$this->assertSame('il', WDP_Phone_Field::get_default_country_iso());
		$len = WDP_Phone_Field::get_national_length_for_iso('il');
		$this->assertSame(7, $len['min']);
		$this->assertSame(12, $len['max']);
	}

	public function test_filter_overrides_default_but_unknown_value_falls_back_to_store_country(): void {
		WDP_Test_WC_Countries::$base = 'GB';
		WDP_Test_State::$filters['wdp_phone_default_country'] = static function () {
			return 'us';
		};
		$this->assertSame('us', WDP_Phone_Field::get_default_country_iso());
		WDP_Test_State::$filters['wdp_phone_default_country'] = static function () {
			return 'zz';
		};
		$this->assertSame('gb', WDP_Phone_Field::get_default_country_iso());
	}

	public function test_rendered_field_uses_store_country_dial_code(): void {
		WDP_Test_WC_Countries::$base = 'GB';
		$html = WDP_Phone_Field::render(array('name' => 'donation_phone'));
		$this->assertStringContainsString('data-default-country="gb"', $html);
		$this->assertStringContainsString('data-dial-code="44"', $html);
		$this->assertStringContainsString('+44', $html);
		$this->assertStringNotContainsString('+90', $html);
	}

	public function test_no_country_is_excluded_by_default_but_filter_can_exclude(): void {
		WDP_Test_WC_Countries::$base = 'GB';
		$this->assertArrayHasKey('il', WDP_Phone_Field::get_countries());
		WDP_Test_State::$filters['wdp_phone_excluded_countries'] = static function () {
			return array('IL');
		};
		$this->assertArrayNotHasKey('il', WDP_Phone_Field::get_countries());
		$this->assertArrayHasKey('gb', WDP_Phone_Field::get_countries());
	}
}

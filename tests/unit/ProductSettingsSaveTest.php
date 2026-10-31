<?php
/**
 * Ürün "Donation" sekmesi gönderiminin meta eşlemesi (Product_Settings::normalize).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Admin\Product\Product_Settings;
use DonationPanel\Domain\Donation_Type;
use PHPUnit\Framework\TestCase;

final class ProductSettingsSaveTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_donation_type_decides_the_three_legacy_flags(): void {
		$meta = Product_Settings::normalize(array('donation_type' => 'campaign', 'progress_bar_limit' => '1000'))['meta'];
		$this->assertSame('yes', $meta['_allow_custom_price']);
		$this->assertSame('no', $meta['_allow_multiple_shares']);
		$this->assertSame('yes', $meta['_enable_progress_bar']);
	}

	public function test_unknown_donation_type_falls_back_to_fixed(): void {
		$meta = Product_Settings::normalize(array('donation_type' => 'everything'))['meta'];
		$this->assertSame(Donation_Type::FIXED, Donation_Type::infer_from_meta($meta));
	}

	public function test_every_type_saves_and_infers_back(): void {
		foreach (Donation_Type::ids() as $type) {
			$meta = Product_Settings::normalize(array('donation_type' => $type, 'progress_bar_limit' => '500'))['meta'];
			$this->assertSame($type, Donation_Type::infer_from_meta($meta), $type);
		}
	}

	public function test_only_the_managed_meta_keys_are_written(): void {
		$keys = array_keys(Product_Settings::normalize(array('donation_type' => 'campaign', 'progress_bar_limit' => '500'))['meta']);
		sort($keys);
		$managed = Product_Settings::managed_meta_keys();
		sort($managed);
		$this->assertSame($managed, $keys, 'sözleşme: yazılan anahtarlar = sekmenin anahtarları');
		foreach (array('_enable_urgency', '_theme_primary', '_trust_badges', '_layout_mode', '_enable_wizard', '_enable_product_note', '_wdp_manual_total', '_wdp_carried_amount', '_wdp_total_donation_amount') as $never) {
			$this->assertNotContains($never, $managed, $never);
		}
	}

	public function test_unchecked_checkboxes_are_saved_as_no(): void {
		$meta = Product_Settings::normalize(array('donation_type' => 'fixed'))['meta'];
		$this->assertSame('no', $meta['_enable_quantity']);
		$this->assertSame('no', $meta['_enable_amount_presets']);
		$this->assertSame('no', $meta['_enable_cover_fee']);
		$this->assertSame('no', $meta['_enable_addon_donation']);
	}

	public function test_tristate_fields(): void {
		$meta = Product_Settings::normalize(
			array(
				'enable_email'      => 'yes',
				'enable_dedication' => 'no',
				'enable_anonymous'  => '',
			)
		)['meta'];
		$this->assertArrayNotHasKey('_enable_email', $meta);
		$this->assertSame('no', $meta['_enable_dedication']);
		$this->assertSame('', $meta['_enable_anonymous']);

		$this->assertSame('yes', Product_Settings::parse_tristate_flag(true));
		$this->assertSame('', Product_Settings::parse_tristate_flag(false));
		$this->assertSame('', Product_Settings::parse_tristate_flag(null));
		$this->assertSame('yes', Product_Settings::parse_tristate_flag('ON'));
		$this->assertSame('no', Product_Settings::parse_tristate_flag(' No '));
		$this->assertSame('', Product_Settings::parse_tristate_flag('maybe'));
	}

	public function test_turkish_characters_survive_and_are_slash_safe(): void {
		$meta = Product_Settings::normalize(
			array(
				'dedication_placeholder'  => 'Anısına: Şükrü Çağlayan ğüöı',
				'addon_toggle_label'     => 'Ek bağış ekle',
				'addon_donation_message' => "İyilik gizlice ulaşır;\nniyetiniz umut olur.",
			)
		)['meta'];
		$this->assertSame('Anısına: Şükrü Çağlayan ğüöı', $meta['_dedication_placeholder']);
		$this->assertSame('Ek bağış ekle', $meta['_addon_toggle_label']);
		$this->assertStringContainsString('niyetiniz umut olur', $meta['_addon_donation_message']);
	}

	public function test_text_limits_count_characters_not_bytes(): void {
		$meta = Product_Settings::normalize(array('dedication_placeholder' => str_repeat('İ', 150)))['meta'];
		$this->assertSame(120, mb_strlen($meta['_dedication_placeholder']));
	}

	public function test_max_shares_zero_or_empty_falls_back_to_default(): void {
		$this->assertSame('', Product_Settings::normalize(array('max_shares' => '0'))['meta']['_max_shares']);
		$this->assertSame('', Product_Settings::normalize(array('max_shares' => ''))['meta']['_max_shares']);
		$this->assertSame('5', Product_Settings::normalize(array('max_shares' => '5'))['meta']['_max_shares']);
	}

	public function test_goal_is_only_validated_for_campaigns_and_never_wiped_by_hidden_fields(): void {
		$result = Product_Settings::normalize(
			array('donation_type' => 'custom', 'progress_bar_limit' => '1500'),
			array('_progress_bar_limit' => '1500')
		);
		$this->assertSame('1500', $result['meta']['_progress_bar_limit']);
		$this->assertSame(array(), $result['notices']);
	}

	public function test_goal_accepts_thousand_separators_and_rejects_nonsense(): void {
		$this->assertSame('100000', Product_Settings::normalize(array('donation_type' => 'campaign', 'progress_bar_limit' => '100.000'))['meta']['_progress_bar_limit']);
		$bad = Product_Settings::normalize(array('donation_type' => 'campaign', 'progress_bar_limit' => 'abc'), array('_progress_bar_limit' => '800'));
		$this->assertSame('800', $bad['meta']['_progress_bar_limit']);
		$this->assertNotEmpty($bad['notices']);
	}

	public function test_goal_reached_message_is_limited_to_300_characters(): void {
		$meta = Product_Settings::normalize(array('goal_reached_message' => str_repeat('ş', 350)))['meta'];
		$this->assertSame(300, mb_strlen($meta['_goal_reached_message']));
		$this->assertSame('message', $meta['_goal_reached_action']);
	}

	public function test_addon_prices_are_cleaned(): void {
		$meta = Product_Settings::normalize(array('addon_min_price' => '-3', 'addon_fixed_price' => '25'))['meta'];
		$this->assertSame('0', $meta['_addon_min_price']);
		$this->assertSame('25', $meta['_addon_fixed_price']);
	}

	public function test_donation_product_and_auto_place_choices(): void {
		$meta = Product_Settings::normalize(array('donation_product' => 'yes', 'auto_place' => 'no'))['meta'];
		$this->assertSame('yes', $meta['_wdp_donation_product']);
		$this->assertSame('no', $meta['_wdp_auto_place']);
		$meta = Product_Settings::normalize(array('donation_product' => 'x', 'auto_place' => ''))['meta'];
		$this->assertSame('', $meta['_wdp_donation_product']);
		$this->assertSame('', $meta['_wdp_auto_place']);
	}
}

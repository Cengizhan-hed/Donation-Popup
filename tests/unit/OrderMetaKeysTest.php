<?php
/**
 * Fixed order item meta keys, labels and legacy key compatibility.
 *
 * @package WDP\Tests
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * @covers Order_Meta_Keys
 */
final class OrderMetaKeysTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_builds_fixed_keys_for_single_donation(): void {
		$meta = \DonationPanel\WooCommerce\Order_Meta_Keys::build_item_meta(
			array(
				'full_name'         => 'Ayşe Yılmaz',
				'phone'             => '+90 555 000 00 00',
				'email'             => 'ayse@example.com',
				'note'              => 'Not',
				'dedication'        => 'Annem için',
				'anonymous'         => '1',
				'cover_fee'         => '1',
				'cover_fee_percent' => 3,
			)
		);

		$this->assertSame(
			array(
				'wdp_donor_name'    => 'Ayşe Yılmaz',
				'wdp_donor_phone'   => '+90 555 000 00 00',
				'wdp_donation_note' => 'Not',
				'wdp_donor_email'   => 'ayse@example.com',
				'wdp_dedication'    => 'Annem için',
				'wdp_anonymous'     => 'yes',
				'wdp_cover_fee'     => '3',
			),
			$meta
		);
	}

	public function test_builds_fixed_keys_for_shareholders(): void {
		$meta = \DonationPanel\WooCommerce\Order_Meta_Keys::build_item_meta(
			array(
				'share_count'  => 2,
				'shareholders' => array(
					1 => array('name' => 'Ali', 'phone' => '111', 'note' => 'n1'),
					2 => array('name' => 'Veli', 'email' => 'veli@example.com'),
				),
			)
		);

		$this->assertSame(2, $meta['wdp_share_count']);
		$this->assertSame('Ali', $meta['wdp_shareholder_1_name']);
		$this->assertSame('111', $meta['wdp_shareholder_1_phone']);
		$this->assertSame('n1', $meta['wdp_shareholder_1_note']);
		$this->assertSame('veli@example.com', $meta['wdp_shareholder_2_email']);
		$this->assertArrayNotHasKey('wdp_donor_name', $meta);
		foreach (array_keys($meta) as $key) {
			$this->assertTrue(\DonationPanel\WooCommerce\Order_Meta_Keys::is_fixed_key($key), $key);
		}
	}

	public function test_labels_for_fixed_and_shareholder_keys(): void {
		$this->assertSame('Bağışçı Adı', \DonationPanel\WooCommerce\Order_Meta_Keys::get_label('wdp_donor_name'));
		$this->assertSame('Hisse Sayısı', \DonationPanel\WooCommerce\Order_Meta_Keys::get_label('wdp_share_count'));
		$this->assertSame('3. Hissedar Telefonu', \DonationPanel\WooCommerce\Order_Meta_Keys::get_label('wdp_shareholder_3_phone'));
		$this->assertNull(\DonationPanel\WooCommerce\Order_Meta_Keys::get_label('_custom_price'));
	}

	public function test_display_meta_key_filter_maps_only_plugin_keys(): void {
		$ours  = new WDP_Fake_Meta('wdp_shareholder_2_email', 'x@example.com');
		$other = new WDP_Fake_Meta('Renk', 'Mavi');

		$this->assertSame('2. Hissedar E-postası', \DonationPanel\WooCommerce\Order_Meta_Keys::filter_display_meta_key('wdp_shareholder_2_email', $ours));
		$this->assertSame('Renk', \DonationPanel\WooCommerce\Order_Meta_Keys::filter_display_meta_key('Renk', $other));
	}

	public function test_display_value_for_language_independent_flags(): void {
		$this->assertSame('Evet', \DonationPanel\WooCommerce\Order_Meta_Keys::format_display_value('wdp_anonymous', 'yes'));
		$this->assertSame('+%3', \DonationPanel\WooCommerce\Order_Meta_Keys::format_display_value('wdp_cover_fee', '3'));
		$this->assertSame('Evet', \DonationPanel\WooCommerce\Order_Meta_Keys::format_display_value('wdp_cover_fee', 'yes'));
		$this->assertSame('Ali', \DonationPanel\WooCommerce\Order_Meta_Keys::format_display_value('wdp_donor_name', 'Ali'));
	}

	public function test_maps_legacy_translated_keys(): void {
		$this->assertSame('wdp_donor_name', \DonationPanel\WooCommerce\Order_Meta_Keys::legacy_to_fixed_key('Bağışçı Adı'));
		$this->assertSame('wdp_donor_email', \DonationPanel\WooCommerce\Order_Meta_Keys::legacy_to_fixed_key('Bağışçı E-posta'));
		$this->assertSame('wdp_share_count', \DonationPanel\WooCommerce\Order_Meta_Keys::legacy_to_fixed_key('Hisse Sayısı'));
		$this->assertSame('wdp_shareholder_12_email', \DonationPanel\WooCommerce\Order_Meta_Keys::legacy_to_fixed_key('12. Hissedar E-postası'));
		$this->assertSame('wdp_shareholder_1_note', \DonationPanel\WooCommerce\Order_Meta_Keys::legacy_to_fixed_key('1. Hissedar Notu'));
		$this->assertNull(\DonationPanel\WooCommerce\Order_Meta_Keys::legacy_to_fixed_key('Renk'));
	}

	public function test_reads_item_data_from_new_and_legacy_keys(): void {
		$item = new WDP_Fake_Order_Item(
			10,
			100.0,
			1,
			array(
				'Bağışçı Adı'            => 'Eski Ad',
				'wdp_donor_name'         => 'Yeni Ad',
				'Bağışçı E-posta'        => 'eski@example.com',
				'2. Hissedar Telefonu'   => '222',
				'_custom_price'          => 100,
			)
		);

		$data = \DonationPanel\WooCommerce\Order_Meta_Keys::get_item_donation_data($item);

		$this->assertSame('Yeni Ad', $data['wdp_donor_name']['value']);
		$this->assertSame('wdp_donor_name', $data['wdp_donor_name']['key']);
		$this->assertSame('Bağışçı E-posta', $data['wdp_donor_email']['key']);
		$this->assertSame('222', $data['wdp_shareholder_2_phone']['value']);
		$this->assertArrayNotHasKey('_custom_price', $data);
	}

	public function test_privacy_anonymizes_new_and_legacy_keys(): void {
		$item = new WDP_Fake_Order_Item(
			10,
			100.0,
			1,
			array(
				'wdp_donor_name'         => 'Ayşe',
				'Bağışçı E-posta'        => 'ayse@example.com',
				'wdp_shareholder_1_name' => 'Başkası',
				'wdp_anonymous'          => 'yes',
			)
		);

		$this->assertTrue(\DonationPanel\Privacy\Order_Privacy::anonymize_item($item, 'ayse@example.com', false));
		$this->assertSame('[deleted]', $item->meta['wdp_donor_name']);
		$this->assertSame('[deleted]', $item->meta['Bağışçı E-posta']);
		// Shareholder 1 is not the requester (no billing / own e-mail match).
		$this->assertSame('Başkası', $item->meta['wdp_shareholder_1_name']);
		$this->assertSame('yes', $item->meta['wdp_anonymous']);
		$this->assertFalse(\DonationPanel\Privacy\Order_Privacy::anonymize_item($item, 'ayse@example.com', false));
	}
}

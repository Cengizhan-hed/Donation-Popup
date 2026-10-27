<?php
/**
 * 10.27.0'da kaldırılan form içi modülün artık kaydedilmediği, sıralamada yer almadığı ve çıktıya girmediği testleri.
 *
 * Kaldırılan anahtarlar tek kaynaktan (Version_Migrations sabitleri) okunur.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class RemovedFormModuleTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	/**
	 * Panel field names of the removed module (meta key without the leading underscore).
	 *
	 * @return string[]
	 */
	private function removed_fields(): array {
		return array_map(
			static function ($key) {
				return ltrim($key, '_');
			},
			\DonationPanel\Core\Version_Migrations::REMOVED_PRODUCT_META
		);
	}

	private function removed_payload(): array {
		$payload = array();
		foreach ($this->removed_fields() as $field) {
			$payload[ $field ] = $field === 'enable_' . \DonationPanel\Core\Version_Migrations::REMOVED_MODULE_IDS[0]
				? 'yes'
				: '[{"q":"Soru","a":"Cevap"}]';
		}
		return $payload;
	}

	public function test_product_panel_no_longer_saves_removed_meta(): void {
		$meta = WDP_Product_Settings_Service::from_product_panel($this->removed_payload());

		foreach (\DonationPanel\Core\Version_Migrations::REMOVED_PRODUCT_META as $key) {
			$this->assertArrayNotHasKey($key, $meta);
		}
		foreach (WDP_Product_Settings_Service::get_settings_meta_keys() as $key) {
			$this->assertNotContains($key, \DonationPanel\Core\Version_Migrations::REMOVED_PRODUCT_META);
		}
	}

	public function test_legacy_ajax_request_no_longer_saves_removed_meta(): void {
		$meta = WDP_Product_Settings_Service::from_request($this->removed_payload());

		foreach (\DonationPanel\Core\Version_Migrations::REMOVED_PRODUCT_META as $key) {
			$this->assertArrayNotHasKey($key, $meta);
		}
	}

	public function test_removed_module_is_not_an_orderable_module(): void {
		foreach (\DonationPanel\Core\Version_Migrations::REMOVED_MODULE_IDS as $id) {
			$this->assertNotContains($id, WDP_Form_Modules::allowed_ids());
			$this->assertNotContains($id, WDP_Form_Modules::sanitize_order($id . ',media,trust'));
		}
	}

	public function test_stored_order_is_ignored_and_default_order_is_fixed(): void {
		$removed = \DonationPanel\Core\Version_Migrations::REMOVED_MODULE_IDS[0];
		WDP_Test_State::$post_meta[42]['_wdp_module_order'] = $removed . ',urgency,media';
		WDP_Test_State::$options['wdp_button_settings']     = array('module_order' => 'progress,media');

		$order = WDP_Form_Modules::resolve_order();

		$this->assertNotContains($removed, $order);
		$this->assertSame(WDP_Form_Modules::allowed_ids(), $order);
		$this->assertSame(array('media', 'impact'), array_slice($order, 0, 2));
	}

}

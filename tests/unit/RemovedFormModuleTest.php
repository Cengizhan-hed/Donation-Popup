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
		$meta = \DonationPanel\Admin\Product\Product_Settings::normalize($this->removed_payload())['meta'];

		foreach (\DonationPanel\Core\Version_Migrations::REMOVED_PRODUCT_META as $key) {
			$this->assertArrayNotHasKey($key, $meta);
		}
		foreach (\DonationPanel\Admin\Product\Product_Settings::managed_meta_keys() as $key) {
			$this->assertNotContains($key, \DonationPanel\Core\Version_Migrations::REMOVED_PRODUCT_META);
		}
	}
}

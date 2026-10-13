<?php
/**
 * 10.27.0'da kaldırılan form içi modülün artık kaydedilmediği, sıralamada yer almadığı ve çıktıya girmediği testleri.
 *
 * Kaldırılan anahtarlar tek kaynaktan (WDP_Migrations sabitleri) okunur.
 *
 * @package WooCommerce\Donation_Popup
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
			WDP_Migrations::REMOVED_PRODUCT_META
		);
	}

	private function removed_payload(): array {
		$payload = array();
		foreach ($this->removed_fields() as $field) {
			$payload[ $field ] = $field === 'enable_' . WDP_Migrations::REMOVED_MODULE_IDS[0]
				? 'yes'
				: '[{"q":"Soru","a":"Cevap"}]';
		}
		return $payload;
	}

	public function test_product_panel_no_longer_saves_removed_meta(): void {
		$meta = WDP_Product_Settings_Service::from_product_panel($this->removed_payload());

		foreach (WDP_Migrations::REMOVED_PRODUCT_META as $key) {
			$this->assertArrayNotHasKey($key, $meta);
		}
		foreach (WDP_Product_Settings_Service::get_settings_meta_keys() as $key) {
			$this->assertNotContains($key, WDP_Migrations::REMOVED_PRODUCT_META);
		}
	}

	public function test_legacy_ajax_request_no_longer_saves_removed_meta(): void {
		$meta = WDP_Product_Settings_Service::from_request($this->removed_payload());

		foreach (WDP_Migrations::REMOVED_PRODUCT_META as $key) {
			$this->assertArrayNotHasKey($key, $meta);
		}
	}

	public function test_removed_module_is_not_an_orderable_module(): void {
		foreach (WDP_Migrations::REMOVED_MODULE_IDS as $id) {
			$this->assertNotContains($id, WDP_Form_Modules::allowed_ids());
			$this->assertNotContains($id, WDP_Form_Modules::sanitize_order($id . ',media,trust'));
		}
	}

	public function test_stored_order_with_removed_module_still_resolves(): void {
		$removed = WDP_Migrations::REMOVED_MODULE_IDS[0];
		WDP_Test_State::$post_meta[42]['_wdp_module_order'] = $removed . ',urgency,media';

		$order = WDP_Form_Modules::resolve_order(42);

		$this->assertNotContains($removed, $order);
		$this->assertSame(array('urgency', 'media'), array_slice($order, 0, 2));
	}

	/**
	 * The 10.26.0 crash: the context carried the removed module data as a JSON string.
	 */
	public function test_header_modules_ignore_stale_context_and_render_no_removed_markup(): void {
		$removed = WDP_Migrations::REMOVED_MODULE_IDS[0];
		WDP_Test_State::$post_meta[42]['_wdp_module_order'] = $removed . ',urgency,social_proof';
		WDP_Test_State::$post_meta[42]['_impact_line_text']  = 'Bir aileye ulaşır';

		$context = $this->removed_payload() + array(
			'enable_urgency'      => true,
			'urgency_text'        => 'Son gün',
			'enable_social_proof' => true,
			'social_proof_text'   => '120 kişi bağış yaptı',
		);
		$context[ 'enable_' . $removed ] = true;

		$html = WDP_Campaign_Header_Renderer::render_header_modules(42, $context);

		$this->assertStringContainsString('wdp-impact-line', $html);
		$this->assertStringNotContainsString('wdp-' . $removed, $html);
		$this->assertStringNotContainsString('<details', $html);
	}
}

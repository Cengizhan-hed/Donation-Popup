<?php
/**
 * Render koruması: hata ziyaretçiye boş, ürün editörüne uyarı döner; açık buffer'lar kapanır.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class RenderGuardTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	private function failing(): callable {
		return static function () {
			ob_start();
			echo '<div class="half-rendered">';
			ob_start();
			echo '<form>';
			throw new TypeError('render_x(): Argument #1 must be of type array, string given');
		};
	}

	public function test_visitor_gets_empty_string_and_buffers_are_closed(): void {
		$level = ob_get_level();

		$html = WDP_Render_Guard::html($this->failing(), 12, 'test');

		$this->assertSame('', $html);
		$this->assertSame($level, ob_get_level());
	}

	public function test_product_editor_gets_admin_notice_without_partial_markup(): void {
		WDP_Test_State::$caps = array('edit_products');

		$html = WDP_Render_Guard::html($this->failing(), 12, 'test');

		$this->assertStringContainsString('class="wdp-admin-notice"', $html);
		$this->assertStringContainsString('role="note"', $html);
		$this->assertStringContainsString('#12', $html);
		$this->assertStringNotContainsString('half-rendered', $html);
		$this->assertStringNotContainsString('<form', $html);
	}

	public function test_successful_render_passes_through(): void {
		$this->assertSame('<p>ok</p>', WDP_Render_Guard::html(static function () {
			return '<p>ok</p>';
		}));
	}

	public function test_value_returns_fallback_on_error(): void {
		$level = ob_get_level();
		$value = WDP_Render_Guard::value($this->failing(), array('kept' => true), 'schema');

		$this->assertSame(array('kept' => true), $value);
		$this->assertSame($level, ob_get_level());
	}

	public function test_admin_notice_is_hidden_from_visitors_and_escaped_for_editors(): void {
		$this->assertSame('', WDP_Utils::admin_notice_html('Ürün bulunamadı'));

		WDP_Test_State::$caps = array('edit_products');
		$html = WDP_Utils::admin_notice_html('<b>Ürün</b> bulunamadı');

		$this->assertSame('<div class="wdp-admin-notice" role="note">&lt;b&gt;Ürün&lt;/b&gt; bulunamadı</div>', $html);
	}

	public function test_legacy_settings_helpers_accept_corrupt_option_values(): void {
		$this->assertSame(array(), WDP_Utils::migrate_button_shadow_to_sc_modal('corrupt'));
		$this->assertIsArray(WDP_Utils::normalize_legacy_popup_button_text(null));
	}
}

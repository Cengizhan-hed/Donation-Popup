<?php
/**
 * Render koruması: hata ziyaretçiye boş, ürün editörüne uyarı döner; açık buffer'lar kapanır.
 *
 * @package DonationPanel
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

		$html = \DonationPanel\Modules\EntryPoints\Render_Guard::html($this->failing(), 12, 'test');

		$this->assertSame('', $html);
		$this->assertSame($level, ob_get_level());
	}

	public function test_live_frontend_hides_render_notice_even_for_editors(): void {
		WDP_Test_State::$caps = array('edit_products');
		$html = \DonationPanel\Modules\EntryPoints\Render_Guard::html($this->failing(), 12, 'test');
		$this->assertSame('', $html);
	}

	public function test_wp_admin_gets_admin_notice_without_partial_markup(): void {
		WDP_Test_State::$caps     = array('edit_products');
		WDP_Test_State::$is_admin = true;

		$html = \DonationPanel\Modules\EntryPoints\Render_Guard::html($this->failing(), 12, 'test');

		$this->assertStringContainsString('class="wdp-admin-notice"', $html);
		$this->assertStringContainsString('role="note"', $html);
		$this->assertStringContainsString('#12', $html);
		$this->assertStringNotContainsString('half-rendered', $html);
		$this->assertStringNotContainsString('<form', $html);
	}

	public function test_successful_render_passes_through(): void {
		$this->assertSame('<p>ok</p>', \DonationPanel\Modules\EntryPoints\Render_Guard::html(static function () {
			return '<p>ok</p>';
		}));
	}

	public function test_value_returns_fallback_on_error(): void {
		$level = ob_get_level();
		$value = \DonationPanel\Modules\EntryPoints\Render_Guard::value($this->failing(), array('kept' => true), 'schema');

		$this->assertSame(array('kept' => true), $value);
		$this->assertSame($level, ob_get_level());
	}

	public function test_admin_notice_is_hidden_from_visitors_and_escaped_for_editors(): void {
		$this->assertSame('', \DonationPanel\Support\Admin_Notice::admin_notice_html('Ürün bulunamadı'));

		WDP_Test_State::$caps = array('edit_products');
		$this->assertSame('', \DonationPanel\Support\Admin_Notice::admin_notice_html('Canlı sitede yöneticiye de gizlenir'));

		WDP_Test_State::$is_admin = true;
		$html = \DonationPanel\Support\Admin_Notice::admin_notice_html('<b>Ürün</b> bulunamadı');

		$this->assertSame('<div class="wdp-admin-notice" role="note">&lt;b&gt;Ürün&lt;/b&gt; bulunamadı</div>', $html);

		WDP_Test_State::$is_admin = false;
		WDP_Test_State::$caps     = array('edit_products');
		$_GET['fb-edit']         = '1';
		\DonationPanel\Modules\EntryPoints\Builder_Detect::reset();
		$preview = \DonationPanel\Support\Admin_Notice::admin_notice_html('Önizleme notu');
		$this->assertStringContainsString('wdp-admin-notice', $preview);
	}

	public function test_legacy_settings_helpers_accept_corrupt_option_values(): void {
		$this->assertIsArray(\DonationPanel\Domain\Button_Settings::normalize_legacy_popup_button_text(null));
	}
}

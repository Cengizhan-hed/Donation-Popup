<?php
/**
 * Sayfa oluşturucu önizlemesi yalnızca edit_products yetkisiyle.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class BuilderDetectTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_visitor_never_sees_preview(): void {
		$_GET['fb-edit'] = '1';
		$this->assertFalse(WDP_Builder_Detect::is_builder_preview());
	}

	public function test_editor_with_avada_param(): void {
		WDP_Test_State::$caps[] = 'edit_products';
		$_GET['fb-edit']        = '1';
		$this->assertTrue(WDP_Builder_Detect::is_builder_preview());
	}

	public function test_divi_param(): void {
		WDP_Test_State::$caps[] = 'edit_products';
		$_GET['et_fb']          = '1';
		WDP_Builder_Detect::reset();
		$this->assertTrue(WDP_Builder_Detect::is_builder_preview());
	}
}

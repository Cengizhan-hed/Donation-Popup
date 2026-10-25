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

	public function test_editor_with_edit_query_param(): void {
		WDP_Test_State::$caps[] = 'edit_products';
		$_GET['x-edit']         = '1';
		$this->assertTrue(WDP_Builder_Detect::is_builder_preview());
	}

	public function test_fb_query_param(): void {
		WDP_Test_State::$caps[] = 'edit_products';
		$_GET['et_fb']          = '1';
		WDP_Builder_Detect::reset();
		$this->assertTrue(WDP_Builder_Detect::is_builder_preview());
	}

	public function test_unknown_builder_edit_param_works_without_adapter(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$caps[] = 'edit_products';
		$_GET['acme_builder_edit'] = '1';
		WDP_Builder_Detect::reset();
		$this->assertTrue(WDP_Builder_Detect::is_builder_preview());
	}

	public function test_plain_request_is_not_preview(): void {
		WDP_Test_State::$caps[] = 'edit_products';
		$_GET['paged'] = '2';
		$this->assertFalse(WDP_Builder_Detect::is_builder_preview());
	}
}

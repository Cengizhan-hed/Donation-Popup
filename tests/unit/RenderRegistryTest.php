<?php
/**
 * WDP_Render_Registry: form bir kez, modal id bir kez.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class RenderRegistryTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_form_claimed_once(): void {
		$this->assertTrue(WDP_Render_Registry::claim_form(12));
		$this->assertFalse(WDP_Render_Registry::claim_form(12));
		$this->assertTrue(WDP_Render_Registry::has_form(12));
		$this->assertTrue(WDP_Render_Registry::claim_form(13));
	}

	public function test_duplicate_notice_only_for_editors(): void {
		WDP_Render_Registry::claim_form(12);
		$this->assertSame('', WDP_Render_Registry::duplicate_form_notice(12));
		WDP_Test_State::$caps[] = 'edit_products';
		$this->assertSame('<!-- wdp: form already rendered #12 -->', WDP_Render_Registry::duplicate_form_notice(12));
	}

	public function test_modal_ids_are_unique_per_mode(): void {
		$id = WDP_Render_Registry::modal_id(4, 'popup');
		$this->assertSame('wdp-modal-4', $id);
		$this->assertTrue(WDP_Render_Registry::claim_modal($id));
		$this->assertFalse(WDP_Render_Registry::claim_modal($id));
		$panel = WDP_Render_Registry::modal_id(4, 'side_panel');
		$this->assertTrue(WDP_Render_Registry::claim_modal($panel));
	}
}

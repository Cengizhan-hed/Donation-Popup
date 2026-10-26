<?php
/**
 * Render_Registry: form bir kez, modal id bir kez.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class RenderRegistryTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_form_claimed_once(): void {
		$this->assertTrue(\DonationPanel\Modules\EntryPoints\Render_Registry::claim_form(12));
		$this->assertFalse(\DonationPanel\Modules\EntryPoints\Render_Registry::claim_form(12));
		$this->assertTrue(\DonationPanel\Modules\EntryPoints\Render_Registry::has_form(12));
		$this->assertTrue(\DonationPanel\Modules\EntryPoints\Render_Registry::claim_form(13));
	}

	public function test_duplicate_notice_only_for_editors(): void {
		\DonationPanel\Modules\EntryPoints\Render_Registry::claim_form(12);
		$this->assertSame('', \DonationPanel\Modules\EntryPoints\Render_Registry::duplicate_form_notice(12));
		WDP_Test_State::$caps[] = 'edit_products';
		$this->assertSame('<!-- wdp: form already rendered #12 -->', \DonationPanel\Modules\EntryPoints\Render_Registry::duplicate_form_notice(12));
	}

	public function test_modal_ids_are_unique_per_mode(): void {
		$id = \DonationPanel\Modules\EntryPoints\Render_Registry::modal_id(4, 'popup');
		$this->assertSame('wdp-modal-4', $id);
		$this->assertTrue(\DonationPanel\Modules\EntryPoints\Render_Registry::claim_modal($id));
		$this->assertFalse(\DonationPanel\Modules\EntryPoints\Render_Registry::claim_modal($id));
		$panel = \DonationPanel\Modules\EntryPoints\Render_Registry::modal_id(4, 'side_panel');
		$this->assertTrue(\DonationPanel\Modules\EntryPoints\Render_Registry::claim_modal($panel));
	}
}

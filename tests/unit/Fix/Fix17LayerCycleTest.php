<?php
/**
 * #17: Domain katmanı Modules\ ve WooCommerce\Cart_Hooks'a bağımlı değildir (döngüsel bağımlılık yok).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Modules\EntryPoints\Donations_List;
use PHPUnit\Framework\TestCase;

final class Fix17LayerCycleTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_domain_has_no_references_to_modules_or_cart_hooks(): void {
		$root = dirname( __DIR__, 3 ) . '/src/Domain';
		foreach ( glob( $root . '/*.php' ) as $file ) {
			$source = (string) file_get_contents( $file );
			$this->assertDoesNotMatchRegularExpression( '/DonationPanel\\\\Modules\\\\/', $source, basename( $file ) );
			$this->assertDoesNotMatchRegularExpression( '/Cart_Hooks/', $source, basename( $file ) );
		}
	}

	public function test_list_cache_is_bumped_through_the_totals_changed_action(): void {
		Donations_List::reset_bump_guard();
		Donations_List::init();
		$this->assertNotEmpty( WDP_Test_State::$actions['donation_panel_totals_changed'] ?? array() );
	}
}

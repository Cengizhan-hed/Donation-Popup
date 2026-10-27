<?php
/**
 * #20: vergi indirimi beyanı denetim izi: bağışçının gördüğü metnin özeti + zaman damgası, ek bağış satırı da işaretli.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Core\Container;
use DonationPanel\Core\Settings;
use DonationPanel\Frontend\Template_Loader;
use DonationPanel\Modules\TaxRelief\Tax_Relief_Declaration;
use DonationPanel\Modules\TaxRelief\Tax_Relief_Module;
use PHPUnit\Framework\TestCase;

final class Fix20TaxReliefAuditTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	private function module(): Tax_Relief_Module {
		$container = new Container();
		$container->singleton( Settings::class, static function () {
			return new Settings();
		} );
		$container->singleton( Template_Loader::class, static function () {
			return new Template_Loader( WDP_PLUGIN_DIR, static function () {
				return array();
			} );
		} );
		$module = new Tax_Relief_Module();
		$module->register( $container );
		return $module;
	}

	private function request(): object {
		return new class() {
			public function get_route() {
				return '/donation-panel/v1/cart/add';
			}

			public function get_param( $key ) {
				return 'donation_tax_relief' === $key ? '1' : null;
			}
		};
	}

	public function test_hash_is_of_text_shown_at_declaration_time_not_text_at_order_time(): void {
		$module = $this->module();
		$module->capture_request( null, null, $this->request() );
		$shown = Tax_Relief_Declaration::hash( $module->declaration_text() );
		$data  = $module->add_cart_item_data( array() );

		// Metin sonradan değişir (yönetici ayarı).
		WDP_Test_State::$options[ Settings::OPTION_NAME ] = array( 'tax_relief' => array( 'text' => 'Completely new wording' ) );
		$item = new class() {
			public $meta = array();

			public function update_meta_data( $k, $v ) {
				$this->meta[ $k ] = $v;
			}
		};
		$module->write_order_meta( $item, 'k', $data, $item );
		$this->assertSame( $shown, $item->meta[ Tax_Relief_Declaration::META_HASH ] );
		$this->assertNotSame( Tax_Relief_Declaration::hash( 'Completely new wording' ), $item->meta[ Tax_Relief_Declaration::META_HASH ] );
	}

	public function test_declaration_timestamp_is_recorded(): void {
		$module = $this->module();
		$module->capture_request( null, null, $this->request() );
		$before = time();
		$data   = $module->add_cart_item_data( array() );
		$item   = new class() {
			public $meta = array();

			public function update_meta_data( $k, $v ) {
				$this->meta[ $k ] = $v;
			}
		};
		$module->write_order_meta( $item, 'k', $data, $item );
		$this->assertArrayHasKey( Tax_Relief_Declaration::META_AT, $item->meta );
		$this->assertGreaterThanOrEqual( $before, strtotime( (string) $item->meta[ Tax_Relief_Declaration::META_AT ] ) );
	}

	public function test_addon_line_in_same_request_carries_the_declaration(): void {
		$module = $this->module();
		$module->capture_request( null, null, $this->request() );
		$main  = $module->add_cart_item_data( array() );
		$addon = $module->add_cart_item_data( array( 'wdp_sadaka_donation' => true ) );
		$this->assertSame( '1', $addon[ Tax_Relief_Declaration::CART_KEY ] );
		$this->assertSame( $main[ Tax_Relief_Declaration::CART_HASH_KEY ], $addon[ Tax_Relief_Declaration::CART_HASH_KEY ] );

		// Ek bağış olmayan sonraki satıra bulaşmaz.
		$other = $module->add_cart_item_data( array( 'x' => 1 ) );
		$this->assertArrayNotHasKey( Tax_Relief_Declaration::CART_KEY, $other );
	}
}

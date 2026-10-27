<?php
/**
 * E6: teşekkür özeti (kişi bilgisi yok), vergi indirimi beyanı (hash, sipariş meta, ek adım), modül varsayılanları.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Plugin;
use DonationPanel\Core\Settings;
use DonationPanel\Frontend\Template_Loader;
use DonationPanel\Modules\TaxRelief\Tax_Relief_Declaration;
use DonationPanel\Modules\TaxRelief\Tax_Relief_Module;
use DonationPanel\Modules\Thanks\Thanks_Summary;
use PHPUnit\Framework\TestCase;

final class E6ThanksTaxReliefTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	/**
	 * Sipariş kalemi sahtesi.
	 *
	 * @param array<string, mixed> $meta Meta.
	 */
	private function item( int $product_id, string $name, float $total, array $meta = array() ) {
		return new class( $product_id, $name, $total, $meta ) {
			public $meta = array();
			private $pid;
			private $name;
			private $total;
			public function __construct( $pid, $name, $total, $meta ) {
				$this->pid   = $pid;
				$this->name  = $name;
				$this->total = $total;
				$this->meta  = $meta;
			}
			public function get_product_id() {
				return $this->pid;
			}
			public function get_name() {
				return $this->name;
			}
			public function get_total() {
				return $this->total;
			}
			public function get_meta( $key, $single = true ) {
				unset( $single );
				return $this->meta[ $key ] ?? '';
			}
			public function update_meta_data( $key, $value ) {
				$this->meta[ $key ] = $value;
			}
			public function get_product() {
				return null;
			}
		};
	}

	/**
	 * Sipariş sahtesi.
	 *
	 * @param array<int, object> $items Kalemler.
	 */
	private function order( array $items ) {
		return new class( $items ) {
			public $meta = array();
			private $items;
			public function __construct( $items ) {
				$this->items = $items;
			}
			public function get_items() {
				return $this->items;
			}
			public function get_currency() {
				return 'GBP';
			}
			public function update_meta_data( $key, $value ) {
				$this->meta[ $key ] = $value;
			}
			public function get_meta( $key, $single = true ) {
				unset( $single );
				return $this->meta[ $key ] ?? '';
			}
		};
	}

	public function test_summary_has_no_personal_data_even_when_item_has_donor_meta(): void {
		$item  = $this->item(
			7,
			'Water Well',
			100.0,
			array(
				'_custom_price'   => 100.0,
				'wdp_donor_name'  => 'Ayşe Yılmaz',
				'wdp_donor_phone' => '+44 7000 000000',
				'wdp_dedication'  => 'In memory of Ali',
			)
		);
		$other = $this->item( 8, 'T-shirt', 20.0 );

		$summary = Thanks_Summary::build( $this->order( array( $item, $other ) ) );

		$this->assertCount( 1, $summary['lines'] );
		$this->assertSame( 'Water Well', $summary['lines'][0]['project'] );
		$this->assertSame( 100.0, $summary['total'] );
		$this->assertSame( 'GBP', $summary['currency'] );
		$this->assertSame( Thanks_Summary::LINE_KEYS, array_keys( $summary['lines'][0] ) );
		$flat = wp_json_encode( $summary );
		foreach ( array( 'Ayşe', '7000', 'Ali' ) as $secret ) {
			$this->assertStringNotContainsString( $secret, (string) $flat );
		}
		$this->assertStringNotContainsString( 'Ayşe', Thanks_Summary::share_text( $summary ) );
		$this->assertStringContainsString( 'Water Well', Thanks_Summary::share_text( $summary ) );
	}

	public function test_summary_is_empty_without_donation_lines(): void {
		$this->assertSame( array(), Thanks_Summary::build( $this->order( array( $this->item( 8, 'T-shirt', 20.0 ) ) ) ) );
		$this->assertSame( array(), Thanks_Summary::build( null ) );
		$this->assertSame( '', Thanks_Summary::share_text( array() ) );
	}

	public function test_summary_totals_multiple_donation_lines(): void {
		$summary = Thanks_Summary::build(
			$this->order( array( $this->item( 1, 'A', 10.5, array( '_custom_price' => 10.5 ) ), $this->item( 2, 'B', 4.25, array( '_custom_price' => 4.25 ) ) ) )
		);
		$this->assertSame( 14.75, $summary['total'] );
		$this->assertCount( 2, $summary['lines'] );
	}

	public function test_declaration_ticked_only_on_explicit_consent(): void {
		foreach ( array( '1', 1, true, 'yes', 'on', 'true' ) as $yes ) {
			$this->assertTrue( Tax_Relief_Declaration::is_ticked( $yes ) );
		}
		foreach ( array( null, '', '0', 0, false, 'no', 'maybe', array( 1 ) ) as $no ) {
			$this->assertFalse( Tax_Relief_Declaration::is_ticked( $no ) );
		}
	}

	public function test_declaration_hash_is_stable_and_text_sensitive(): void {
		$a = Tax_Relief_Declaration::hash( "I   declare\n this." );
		$this->assertSame( $a, Tax_Relief_Declaration::hash( ' I declare this. ' ) );
		$this->assertSame( 64, strlen( $a ) );
		$this->assertNotSame( $a, Tax_Relief_Declaration::hash( 'I declare that.' ) );
		$this->assertSame( hash( 'sha256', 'Türkçe beyan ğüşiöç' ), Tax_Relief_Declaration::hash( 'Türkçe beyan ğüşiöç' ) );
	}

	public function test_order_meta_only_when_declared(): void {
		$this->assertSame( array(), Tax_Relief_Declaration::order_meta( array( 'donation_data' => array( 'full_name' => 'X' ) ), 'text' ) );
		$meta = Tax_Relief_Declaration::order_meta( array( Tax_Relief_Declaration::CART_KEY => '1' ), 'text' );
		$this->assertSame( 'yes', $meta['_wdp_tax_relief_declared'] );
		$this->assertSame( Tax_Relief_Declaration::hash( 'text' ), $meta['_wdp_tax_relief_text_hash'] );
	}

	public function test_texts_use_settings_then_generic_default(): void {
		$defaults = Tax_Relief_Declaration::texts( array() );
		$this->assertNotSame( '', $defaults['text'] );
		$this->assertStringNotContainsStringIgnoringCase( 'gift aid', $defaults['text'] . $defaults['title'] . $defaults['step_label'] );
		$custom = Tax_Relief_Declaration::texts( array( 'text' => 'Custom wording', 'title' => '  ' ) );
		$this->assertSame( 'Custom wording', $custom['text'] );
		$this->assertSame( $defaults['title'], $custom['title'] );
	}

	private function tax_module(): Tax_Relief_Module {
		$container = new Container();
		$container->singleton(
			Settings::class,
			static function () {
				return new Settings();
			}
		);
		$container->singleton(
			Template_Loader::class,
			static function () {
				return new Template_Loader( WDP_PLUGIN_DIR, static function () {
					return array();
				} );
			}
		);
		$module = new Tax_Relief_Module();
		$module->register( $container );
		return $module;
	}

	public function test_step_is_appended_once_and_core_steps_kept(): void {
		$module = $this->tax_module();
		$steps  = array(
			array( 'id' => 'amount', 'label' => 'Amount' ),
			array( 'id' => 'details', 'label' => 'Details' ),
		);
		$out = $module->add_step( $steps, 5 );
		$this->assertSame( array( 'amount', 'details', 'tax_relief' ), array_column( $out, 'id' ) );
		$this->assertSame( array( 'amount', 'details', 'tax_relief' ), array_column( $module->add_step( $out, 5 ), 'id' ) );
	}

	public function test_step_markup_checkbox_is_not_prechecked(): void {
		$module = $this->tax_module();
		ob_start();
		$module->render_step( array() );
		$html = (string) ob_get_clean();
		$this->assertStringContainsString( 'name="donation_tax_relief"', $html );
		$this->assertStringContainsString( 'type="checkbox"', $html );
		$this->assertStringNotContainsString( 'checked', $html );
		$this->assertStringNotContainsString( ' required', $html );
	}

	public function test_cart_flag_follows_rest_request_only_and_is_one_shot(): void {
		$module  = $this->tax_module();
		$request = new class() {
			public $route = '/donation-panel/v1/cart/add';
			public $params = array( 'donation_tax_relief' => '1' );
			public function get_route() {
				return $this->route;
			}
			public function get_param( $key ) {
				return $this->params[ $key ] ?? null;
			}
		};
		$module->capture_request( null, null, $request );
		$data = $module->add_cart_item_data( array( 'x' => 1 ) );
		$this->assertSame( '1', $data[ Tax_Relief_Declaration::CART_KEY ] );
		$again = $module->add_cart_item_data( array( 'x' => 1 ) );
		$this->assertArrayNotHasKey( Tax_Relief_Declaration::CART_KEY, $again );

		$request->params = array();
		$module->capture_request( null, null, $request );
		$this->assertArrayNotHasKey( Tax_Relief_Declaration::CART_KEY, $module->add_cart_item_data( array() ) );

		$request->params = array( 'donation_tax_relief' => '1' );
		$request->route  = '/wc/store/v1/cart/add-item';
		$module->capture_request( null, null, $request );
		$this->assertArrayNotHasKey( Tax_Relief_Declaration::CART_KEY, $module->add_cart_item_data( array() ) );
	}

	public function test_order_and_item_get_meta_and_donor_fields_are_untouched(): void {
		$module = $this->tax_module();
		$item   = $this->item( 1, 'A', 5.0, array( 'wdp_donor_name' => 'Çağlar Öztürk', 'wdp_dedication' => 'Şükrü için' ) );
		$order  = $this->order( array( $item ) );
		$module->write_order_meta( $item, 'k', array( Tax_Relief_Declaration::CART_KEY => '1' ), $order );
		$this->assertSame( 'yes', $item->meta['_wdp_tax_relief_declared'] );
		$this->assertSame( 'yes', $order->meta['_wdp_tax_relief_declared'] );
		$this->assertSame( $item->meta['_wdp_tax_relief_text_hash'], $order->meta['_wdp_tax_relief_text_hash'] );
		$this->assertSame( 'Çağlar Öztürk', $item->meta['wdp_donor_name'] );
		$this->assertSame( 'Şükrü için', $item->meta['wdp_dedication'] );

		$item2  = $this->item( 1, 'A', 5.0 );
		$order2 = $this->order( array( $item2 ) );
		$module->write_order_meta( $item2, 'k', array(), $order2 );
		$this->assertSame( array(), $order2->meta );
		$this->assertSame( array(), $item2->meta );
	}

	public function test_modules_are_registered_and_default_off(): void {
		$registry = new Module_Registry( new Settings() );
		Plugin::register_modules( $registry );
		$this->assertContains( 'thanks', $registry->slugs() );
		$this->assertContains( 'tax_relief', $registry->slugs() );
		$this->assertFalse( $registry->is_enabled( 'thanks' ) );
		$this->assertFalse( $registry->is_enabled( 'tax_relief' ) );
		( new Settings() )->update( array( 'modules' => array( 'thanks' => true ) ) );
		$registry = new Module_Registry( new Settings() );
		Plugin::register_modules( $registry );
		$this->assertTrue( $registry->is_enabled( 'thanks' ) );
		$this->assertFalse( $registry->is_enabled( 'tax_relief' ) );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_disabled_modules_load_no_files(): void {
		( new Settings() )->update( array( 'modules' => array( 'campaign' => false, 'experiences' => false, 'impact' => false ) ) );
		$registry = new Module_Registry( new Settings() );
		Plugin::register_modules( $registry );
		$registry->boot( new Container() );
		$loaded = array_filter(
			get_included_files(),
			static function ( $file ) {
				return false !== strpos( $file, '/src/Modules/Thanks/' ) || false !== strpos( $file, '/src/Modules/TaxRelief/' );
			}
		);
		$this->assertSame( array(), array_values( $loaded ) );
	}
}

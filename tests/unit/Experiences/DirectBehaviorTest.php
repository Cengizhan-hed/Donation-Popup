<?php
/**
 * 12.3 kurgu ayrımı: doğrudan (sepetsiz) bağış = ödeme davranışı, düzenden bağımsız. Öncelik ürün > bağış türü > genel
 * (Direct_Settings::decide), ek bağış sunan üründe tür ayarı ana türden önce; yönetici alanları (Sepet ve ödeme →
 * Bağışçılar nasıl öder) ayarda görünen = uygulanan; ürün meta sözleşmesi (`_donation_panel_direct`) geriye dönük aynı;
 * compact kısa kod oluşturucu ve Rehber bölümleri.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Admin\Admin_Bootstrap;
use DonationPanel\Admin\Compact_Tools;
use DonationPanel\Admin\Field_Registry;
use DonationPanel\Admin\Guide;
use DonationPanel\Admin\Settings_Store;
use DonationPanel\Core\Settings;
use DonationPanel\Modules\Experiences\Form_Context;
use DonationPanel\WooCommerce\Direct\Direct_Settings;
use PHPUnit\Framework\TestCase;

final class DirectBehaviorTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$caps = array( 'manage_woocommerce' );
	}

	/**
	 * @param int                  $id   Ürün.
	 * @param array<string, mixed> $meta Meta.
	 * @return object
	 */
	private function product( int $id, array $meta = array() ) {
		WDP_Test_State::$post_meta[ $id ] = $meta;
		return new class( $id ) {
			/** @var int */
			private $id;
			public function __construct( int $id ) {
				$this->id = $id;
			}
			public function get_id() {
				return $this->id;
			}
			public function get_name() {
				return 'Bağış';
			}
			public function get_price() {
				return '0';
			}
			public function get_meta( $key, $single = true ) {
				return get_post_meta( $this->id, $key, true );
			}
		};
	}

	/**
	 * @param array<string, mixed> $patch Ayar yaması (grup => anahtar => değer).
	 */
	private function settings( array $patch ): void {
		( new Settings() )->update( $patch );
	}

	public function test_priority_product_over_type_over_global(): void {
		$choices = array(
			'fixed'    => '',
			'custom'   => 'direct',
			'shares'   => 'cart',
			'campaign' => '',
			'addon'    => '',
		);
		// Ürün her şeyi ezer.
		$this->assertSame( array( 'enabled' => false, 'source' => 'product', 'type' => '' ), Direct_Settings::decide( 'no', 'custom', false, $choices, true ) );
		$this->assertSame( array( 'enabled' => true, 'source' => 'product', 'type' => '' ), Direct_Settings::decide( 'yes', 'shares', false, $choices, false ) );
		// Tür genel ayarı ezer (iki yönde).
		$this->assertSame( array( 'enabled' => true, 'source' => 'type', 'type' => 'custom' ), Direct_Settings::decide( '', 'custom', false, $choices, false ) );
		$this->assertSame( array( 'enabled' => false, 'source' => 'type', 'type' => 'shares' ), Direct_Settings::decide( '', 'shares', false, $choices, true ) );
		// Tür "genel ayarı kullan" → genel.
		$this->assertSame( array( 'enabled' => true, 'source' => 'global', 'type' => '' ), Direct_Settings::decide( '', 'fixed', false, $choices, true ) );
		$this->assertSame( array( 'enabled' => false, 'source' => 'global', 'type' => '' ), Direct_Settings::decide( '', 'campaign', false, $choices, false ) );
		// Geçersiz ürün/tür değeri yok sayılır.
		$this->assertSame( 'global', Direct_Settings::decide( 'maybe', 'fixed', false, array( 'fixed' => 'sometimes' ), false )['source'] );
	}

	public function test_addon_type_wins_over_the_base_type_and_falls_through_when_unset(): void {
		$choices = array(
			'custom' => 'direct',
			'addon'  => 'cart',
		);
		$this->assertSame( array( 'enabled' => false, 'source' => 'type', 'type' => 'addon' ), Direct_Settings::decide( '', 'custom', true, $choices, true ) );
		$choices['addon'] = '';
		$this->assertSame( array( 'enabled' => true, 'source' => 'type', 'type' => 'custom' ), Direct_Settings::decide( '', 'custom', true, $choices, false ) );
		// Ek bağış yoksa ek bağış ayarı uygulanmaz.
		$this->assertSame( 'custom', Direct_Settings::decide( '', 'custom', false, array( 'addon' => 'cart', 'custom' => 'direct' ), false )['type'] );
		// Ürün yine en üstte.
		$this->assertSame( 'product', Direct_Settings::decide( 'yes', 'custom', true, array( 'addon' => 'cart' ), false )['source'] );
	}

	public function test_admin_fields_exist_with_help_and_three_choices(): void {
		$sections = Field_Registry::sections( Admin_Bootstrap::SLUG_CHECKOUT );
		$this->assertSame( 'payment', array_key_first( $sections ), 'Bağışçılar nasıl öder bölümü Sepet ve ödeme ekranının başında' );
		$fields = Field_Registry::fields_for( Admin_Bootstrap::SLUG_CHECKOUT );
		$this->assertSame( 'payment', $fields['direct.enabled']['section'] );
		foreach ( Direct_Settings::types() as $type ) {
			$id = 'direct.type_' . $type;
			$this->assertArrayHasKey( $id, $fields, $id );
			$this->assertSame( 'payment', $fields[ $id ]['section'] );
			$this->assertSame( 'select', $fields[ $id ]['type'] );
			$this->assertSame( array( '', 'cart', 'direct' ), array_map( 'strval', array_keys( $fields[ $id ]['options'] ) ) );
			$this->assertNotSame( '', $fields[ $id ]['help'] );
			$this->assertSame( '', Settings::schema()['direct'][ 'type_' . $type ]['default'], 'varsayılan: genel ayarı kullan (davranış değişmez)' );
		}
	}

	public function test_saved_type_setting_is_what_the_form_applies(): void {
		$store = new Settings_Store( new Settings() );
		$this->assertInstanceOf( WP_Error::class, $store->sanitize_value( 'direct.type_campaign', 'maybe' ) );
		$this->assertIsArray( $store->save( array( 'direct.type_custom' => 'direct', 'direct.enabled' => false ) ) );

		$product = $this->product( 41, array( '_allow_custom_price' => 'yes' ) );
		$model   = Form_Context::from_legacy(
			array(
				'product_id'         => 41,
				'allow_custom_price' => true,
			),
			$product
		);
		$this->assertSame( 'custom', $model['kind'] );
		$this->assertTrue( $model['direct'], 'tür ayarı "doğrudan" → form doğrudan gönderir' );
		$this->assertSame( 'type', Direct_Settings::resolve( $product, $model )['source'] );

		// Ürün geçersiz kılar (sözleşme meta anahtarı aynı).
		WDP_Test_State::$post_meta[41][ Direct_Settings::META ] = 'no';
		$model = Form_Context::from_legacy( array( 'product_id' => 41, 'allow_custom_price' => true ), $product );
		$this->assertFalse( $model['direct'] );
		$this->assertSame( 'product', Direct_Settings::resolve( $product, $model )['source'] );

		// Tür "genel ayarı kullan" + genel açık → doğrudan.
		unset( WDP_Test_State::$post_meta[41][ Direct_Settings::META ] );
		$store->save( array( 'direct.type_custom' => '', 'direct.enabled' => true ) );
		$this->assertSame( array( 'enabled' => true, 'source' => 'global', 'type' => '' ), Direct_Settings::resolve( $product, $model ) );
	}

	public function test_global_switch_and_product_meta_contract_unchanged(): void {
		$product = $this->product( 42 );
		$this->assertFalse( Direct_Settings::enabled_for( $product ), 'varsayılan kapalı' );
		$this->settings( array( 'direct' => array( 'enabled' => true ) ) );
		$this->assertTrue( Direct_Settings::enabled_for( $product ) );
		WDP_Test_State::$post_meta[42]['_donation_panel_direct'] = 'no';
		$this->assertFalse( Direct_Settings::enabled_for( $product ) );
		WDP_Test_State::$post_meta[42]['_donation_panel_direct'] = 'yes';
		$this->settings( array( 'direct' => array( 'enabled' => false ) ) );
		$this->assertTrue( Direct_Settings::enabled_for( $product ) );
		// Süzgeç son sözü söyler; kaynak "filter".
		WDP_Test_State::$filters['donation_panel_direct_enabled'] = static fn() => false;
		$this->assertSame( array( 'enabled' => false, 'source' => 'filter', 'type' => '' ), Direct_Settings::resolve( $product ) );
	}

	public function test_direct_hides_the_addon_choice_but_keeps_the_decision_stable(): void {
		$legacy  = array(
			'product_id'            => 43,
			'allow_custom_price'    => true,
			'enable_addon_donation' => true,
			'addon_wc_product_id'   => 99,
			'addon_toggle_label'    => 'Sadaka ekle',
		);
		$product = $this->product( 43 );

		$this->settings( array( 'direct' => array( 'enabled' => true, 'type_addon' => 'cart' ) ) );
		$model = Form_Context::from_legacy( $legacy, $product );
		$this->assertFalse( $model['direct'], 'ek bağış türü "sepetli" genel "doğrudan"ı ezer' );
		$this->assertIsArray( $model['addon'], 'sepetli akışta ek bağış seçeneği görünür' );

		$this->settings( array( 'direct' => array( 'type_addon' => 'direct' ) ) );
		$model = Form_Context::from_legacy( $legacy, $product );
		$this->assertTrue( $model['direct'] );
		$this->assertNull( $model['addon'], 'doğrudan siparişte ek bağış satırı yok: seçenek gösterilmez (sessiz kayıp yok)' );
		$this->assertTrue( $model['addon_offered'] );
		$this->assertTrue( Direct_Settings::enabled_for( $product, $model ), 'REST kontrolü formla aynı kararı verir' );
	}

	public function test_compact_shortcode_builder_and_guide_sections(): void {
		$this->assertSame( '[wdp_donation_form id="12" layout="compact"]', Compact_Tools::shortcode( 12 ) );
		$this->assertSame( '[wdp_donation_form layout="compact"]', Compact_Tools::shortcode( 0 ) );
		$this->assertSame( array( 'desktop', 'tablet', 'mobile' ), array_keys( Compact_Tools::HEIGHTS ) );
		foreach ( Compact_Tools::HEIGHTS as $key => $pair ) {
			$this->assertGreaterThan( 200, $pair[0], $key . ' ölçülmüş yükseklik' );
			$this->assertGreaterThanOrEqual( $pair[0], $pair[1], $key . ' hedefli kart en az hedefsiz kadar' );
		}

		$guide = Guide::sections();
		$this->assertArrayHasKey( 'compact', $guide );
		$this->assertArrayHasKey( 'direct', $guide );
		$this->assertStringContainsString( 'layout="compact"', $guide['compact']['code'] );
		$this->assertSame( Admin_Bootstrap::SLUG_FORMS, $guide['compact']['link'][0] );
		$this->assertSame( Admin_Bootstrap::SLUG_CHECKOUT, $guide['direct']['link'][0] );
		$text = implode( ' ', $guide['direct']['body'] );
		foreach ( array( 'Cart and checkout', 'How donors pay', 'Product data', 'compact card', 'Open the payment page instead' ) as $needle ) {
			$this->assertStringContainsString( $needle, $text );
		}
		$svg = Guide::figure( 'direct' );
		$this->assertStringContainsString( 'role="img"', $svg );
		$this->assertMatchesRegularExpression( '/<svg width="\d+" height="\d+"/', $svg, 'satır içi SVG width/height' );
	}
}

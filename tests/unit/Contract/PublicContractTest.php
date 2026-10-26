<?php
/**
 * Dışa açık sözleşme (12.0.0): kısa kodlar, bloklar, işlevler, kanca adları, veri anahtarları ve eski küresel adların
 * yönetici köprüsü. Kaldırma ya da yeniden adlandırma bu testi kırar.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Compat\Public_Contract;
use PHPUnit\Framework\TestCase;

final class PublicContractTest extends TestCase {

	/**
	 * docs/HOOKS.md "Eski sözleşme" altındaki 47 kanca/süzgeç adı (değişmez liste).
	 */
	private const DOCUMENTED_HOOKS = array(
		'wdp_allow_multiple_entries', 'wdp_amount_presets', 'wdp_builder_preview_context_product', 'wdp_builder_preview_product',
		'wdp_campaign_media_url', 'wdp_client_context', 'wdp_convert_amount', 'wdp_critical_css_page_type', 'wdp_defer_frontend_assets',
		'wdp_defer_frontend_styles', 'wdp_donations_card_html', 'wdp_donations_query_args', 'wdp_enable_side_cart_recovery',
		'wdp_field_hint_email', 'wdp_field_hint_name', 'wdp_field_hint_note', 'wdp_field_hint_phone', 'wdp_form_context', 'wdp_impact_line',
		'wdp_is_builder_preview', 'wdp_is_donation_product', 'wdp_lazy_idle_prefetch', 'wdp_min_donation_amount', 'wdp_modal_product_thumb_alt',
		'wdp_modal_product_thumb_url', 'wdp_order_exchange_rate', 'wdp_phone_countries', 'wdp_phone_default_country', 'wdp_phone_excluded_countries',
		'wdp_phone_national_length_rules', 'wdp_progress_convert_amount', 'wdp_progress_live_rate', 'wdp_progress_paid_statuses',
		'wdp_rate_limit_ip_max', 'wdp_reload_after_add_to_cart', 'wdp_resolve_product', 'wdp_sadaka_cart_thumbnail_size', 'wdp_sadaka_line_product_ids',
		'wdp_sadaka_price_label', 'wdp_sadaka_toggle_label', 'wdp_sadaka_wc_product_id', 'wdp_should_enqueue_assets', 'wdp_show_amount_presets',
		'wdp_split_client_data', 'wdp_supported_product_types', 'wdp_trust_proxy_headers', 'wdp_use_js_bundle',
	);

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['wdp_test_locale'] );
	}

	private static function source(): string {
		static $all = null;
		if ( null === $all ) {
			$all  = '';
			$root = dirname( __DIR__, 3 );
			foreach ( array( '/src', '/templates', '/blocks' ) as $dir ) {
				$it = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $root . $dir, FilesystemIterator::SKIP_DOTS ) );
				foreach ( $it as $f ) {
					if ( 'php' === $f->getExtension() ) {
						$all .= (string) file_get_contents( (string) $f );
					}
				}
			}
		}
		return $all;
	}

	public function test_every_documented_hook_is_either_active_or_retired(): void {
		$listed = array_merge( Public_Contract::ACTIVE_HOOKS, Public_Contract::RETIRED_HOOKS );
		sort( $listed );
		$documented = self::DOCUMENTED_HOOKS;
		sort( $documented );
		$this->assertSame( $documented, $listed, 'Sözleşme listesi HOOKS.md ile aynı olmalı.' );
		$this->assertSame( array(), array_values( array_intersect( Public_Contract::ACTIVE_HOOKS, Public_Contract::RETIRED_HOOKS ) ) );
	}

	public function test_active_hooks_are_still_fired_and_retired_hooks_are_not(): void {
		$src = self::source();
		foreach ( array_merge( Public_Contract::ACTIVE_HOOKS, array( 'donation_panel_convert_amount' ) ) as $hook ) {
			$this->assertMatchesRegularExpression( "/(apply_filters|do_action)\\(\\s*'" . $hook . "'/", $src, 'etkin kanca çağrılmıyor: ' . $hook );
		}
		foreach ( Public_Contract::RETIRED_HOOKS as $hook ) {
			$this->assertDoesNotMatchRegularExpression( "/(apply_filters|do_action)\\(\\s*'" . $hook . "'/", $src, 'emekli kanca hâlâ çağrılıyor: ' . $hook );
		}
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_shortcodes_are_registered_with_unchanged_names(): void {
		eval( 'class WooCommerce {}' ); // phpcs:ignore Squiz.PHP.Eval.Discouraged -- yalnız bu ayrı süreçte WooCommerce varmış gibi davranır.
		Public_Contract::register();
		foreach ( array( 'wdp_donation_button', 'wdp_donation_button_panel', 'wdp_donation_form', 'wdp_donations' ) as $tag ) {
			$this->assertArrayHasKey( $tag, WDP_Test_State::$shortcodes, $tag );
		}
		$this->assertSame( array( \DonationPanel\Modules\EntryPoints\Shortcodes::class, 'donation_button_panel_shortcode' ), WDP_Test_State::$shortcodes['wdp_donation_button_panel'] );
		$this->assertSame( array( \DonationPanel\Modules\EntryPoints\Donations_List::class, 'shortcode' ), WDP_Test_State::$shortcodes['wdp_donations'] );
	}

	public function test_shortcode_attributes_are_still_accepted(): void {
		$src = (string) file_get_contents( dirname( __DIR__, 3 ) . '/src/Modules/EntryPoints/class-shortcodes.php' );
		foreach ( array( 'id', 'slug', 'sku', 'text', 'button_text', 'class', 'title', 'show_title' ) as $att ) {
			$this->assertMatchesRegularExpression( "/'" . $att . "'\\s+=>/", $src, 'öznitelik ' . $att );
		}
	}

	public function test_block_names_remain(): void {
		$root = dirname( __DIR__, 3 );
		$json = array();
		foreach ( (array) glob( $root . '/blocks/*/block.json' ) as $file ) {
			$data   = json_decode( (string) file_get_contents( $file ), true );
			$json[] = is_array( $data ) ? (string) ( $data['name'] ?? '' ) : '';
		}
		foreach ( Public_Contract::BLOCKS as $block ) {
			$this->assertContains( $block, $json );
		}
	}

	public function test_php_helper_functions_exist_and_answer_without_woocommerce_loaded_yet(): void {
		$GLOBALS['wdp_test_locale'] = 'en_US';
		Public_Contract::declare_functions();
		$this->assertTrue( function_exists( 'wdp_render_donation_button' ) );
		$this->assertTrue( function_exists( 'wdp_render_donation_form' ) );
		$this->assertStringContainsString( 'Product not found (ID: 99)', wdp_render_donation_button( 99 ) );
		$this->assertStringContainsString( 'Product not found (ID: 98)', wdp_render_donation_form( 98, array( 'class' => 'x' ) ) );
	}

	public function test_data_keys_remain_in_source(): void {
		$src = self::source();
		foreach ( Public_Contract::DATA_KEYS as $group => $keys ) {
			foreach ( $keys as $key ) {
				$this->assertStringContainsString( "'" . $key . "'", $src, $group . ': ' . $key );
			}
		}
	}

	public function test_old_hook_still_applies_behaviourally(): void {
		WDP_Test_State::$filters['wdp_sadaka_line_product_ids'] = static function ( $ids ) {
			$ids[] = 777;
			return $ids;
		};
		\DonationPanel\Domain\Addon_Product_Visibility::flush();
		$this->assertContains( 777, \DonationPanel\Domain\Addon_Product_Visibility::get_all_ids() );
	}

	public function test_old_amount_presets_filter_is_redirected_from_the_new_one(): void {
		WDP_Test_State::$filters['wdp_amount_presets'] = static function ( $presets ) {
			$presets[] = 777;
			return $presets;
		};
		$this->assertSame( array( 5, 777 ), Public_Contract::filter_amount_presets( array( 5 ), 12 ) );
	}

	public function test_old_toggle_label_filter_is_redirected_to_the_form_model(): void {
		WDP_Test_State::$filters['wdp_sadaka_toggle_label'] = static function ( $label ) {
			return $label . '!';
		};
		$model = Public_Contract::filter_form_model( array( 'addon' => array( 'label' => 'Ek bağış' ) ) );
		$this->assertSame( 'Ek bağış!', $model['addon']['label'] );
		$this->assertSame( array( 'kind' => 'fixed' ), Public_Contract::filter_form_model( array( 'kind' => 'fixed' ) ) );
	}

	public function test_legacy_product_meta_and_option_keys_remain_readable(): void {
		WDP_Test_State::$post_meta[5] = array(
			'_enable_sadaka_donation' => 'yes',
			'_sadaka_min_price'       => '3',
		);
		$this->assertSame( 'yes', \DonationPanel\Domain\Addon_Product_Visibility::get_meta( 5, '_enable_addon_donation' ) );
		$this->assertSame( '3', (string) \DonationPanel\Domain\Addon_Product_Visibility::get_meta( 5, '_addon_min_price' ) );
		$this->assertTrue( \DonationPanel\Domain\Addon_Product_Visibility::parent_has_addon_enabled( 5 ) );
		WDP_Test_State::$options['wdp_sadaka_links_audit'] = array( 'rows' => array() );
		\DonationPanel\Core\Version_Migrations::step_10_35_2( false );
		$this->assertArrayHasKey( 'wdp_sadaka_links_audit', WDP_Test_State::$options );
		$this->assertArrayHasKey( 'wdp_addon_links_audit', WDP_Test_State::$options );
	}

	public function test_retired_frontend_ajax_actions_are_not_registered_any_more(): void {
		$src = self::source();
		foreach ( Public_Contract::RETIRED_AJAX_ACTIONS as $action ) {
			$this->assertStringNotContainsString( "wp_ajax_nopriv_{$action}", $src, $action );
			$this->assertStringNotContainsString( "wp_ajax_{$action}", $src, $action );
		}
	}

	public function test_admin_bridge_resolves_old_global_class_names_to_the_new_classes(): void {
		$this->assertTrue( class_exists( 'WDP_Donation_Type' ) );
		$this->assertSame( \DonationPanel\Domain\Donation_Type::FIXED, WDP_Donation_Type::FIXED );
		$this->assertSame( \DonationPanel\Domain\Donation_Type::class, ( new ReflectionClass( 'WDP_Donation_Type' ) )->getName() );
		$this->assertTrue( class_exists( 'WDP_Placement_Settings' ) );
		$this->assertTrue( class_exists( 'WDP_Utils' ) );
		$this->assertSame( '#ffffff', WDP_Utils::coerce_solid_hex_background( 'nonsense' ) );
	}
}

<?php
/**
 * E0: dışa açık sözleşme (kancalar, kısa kodlar, AJAX eylemleri, meta anahtarları) kaynakta durur.
 *
 * Yeni mimari bu adların hiçbirini değiştirmez; kaldırma/yeniden adlandırma bu testi kırar.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class E0PublicApiContractTest extends TestCase {

	/**
	 * Tüm eski kaynağı tek metin olarak okur.
	 *
	 * @return string
	 */
	private static function legacy_source(): string {
		static $all = null;
		if ( null === $all ) {
			$all  = '';
			$root = dirname( __DIR__, 3 );
			$it   = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $root . '/includes', FilesystemIterator::SKIP_DOTS ) );
			foreach ( $it as $f ) {
				if ( 'php' === $f->getExtension() ) {
					$all .= (string) file_get_contents( (string) $f );
				}
			}
			$all .= (string) file_get_contents( $root . '/woo-donation-popup.php' );
		}
		return $all;
	}

	public function test_all_public_filters_and_actions_are_still_fired(): void {
		$hooks = array(
			'wdp_allow_multiple_entries', 'wdp_amount_presets', 'wdp_builder_preview_context_product', 'wdp_builder_preview_product',
			'wdp_campaign_media_url', 'wdp_client_context', 'wdp_donations_card_html', 'wdp_donations_query_args',
			'wdp_enable_side_cart_recovery', 'wdp_field_hint_email', 'wdp_field_hint_name', 'wdp_field_hint_note',
			'wdp_field_hint_phone', 'wdp_form_context', 'wdp_impact_line', 'wdp_is_builder_preview', 'wdp_is_donation_product',
			'wdp_lazy_idle_prefetch', 'wdp_meta_pixel_has_consent', 'wdp_meta_woocommerce_purchase_integration_active',
			'wdp_min_donation_amount', 'wdp_modal_product_thumb_alt', 'wdp_modal_product_thumb_url', 'wdp_order_exchange_rate',
			'wdp_phone_countries', 'wdp_phone_default_country', 'wdp_phone_excluded_countries', 'wdp_phone_national_length_rules',
			'wdp_product_schema', 'wdp_progress_convert_amount', 'wdp_progress_live_rate', 'wdp_progress_paid_statuses',
			'wdp_rate_limit_ip_max', 'wdp_reload_after_add_to_cart', 'wdp_resolve_product', 'wdp_sadaka_cart_thumbnail_size',
			'wdp_sadaka_line_product_ids', 'wdp_sadaka_price_label', 'wdp_sadaka_toggle_label', 'wdp_sadaka_wc_product_id',
			'wdp_should_enqueue_assets', 'wdp_show_amount_presets', 'wdp_supported_product_types', 'wdp_trust_proxy_headers',
			'wdp_use_js_bundle',
		);
		$src   = self::legacy_source();
		foreach ( $hooks as $hook ) {
			$this->assertMatchesRegularExpression( "/(apply_filters|do_action)\\(\\s*'" . $hook . "'/", $src, $hook );
		}
	}

	public function test_shortcodes_and_frontend_ajax_actions_remain_registered(): void {
		$src = self::legacy_source();
		foreach ( array( 'wdp_donation_button', 'wdp_donation_button_panel', 'wdp_donation_form', 'wdp_donations' ) as $tag ) {
			$this->assertMatchesRegularExpression( "/add_shortcode\\(\\s*'" . $tag . "'/", $src, $tag );
		}
		foreach ( array( 'wdp_ajax_add_to_cart', 'wdp_get_cart_contents', 'wdp_get_cart_count', 'wdp_get_fresh_nonces', 'wdp_get_product_info', 'wdp_get_product_name', 'wdp_remove_cart_item', 'wdp_render_modal', 'wdp_verify_submission_in_cart' ) as $action ) {
			$this->assertStringContainsString( "wp_ajax_nopriv_{$action}", $src, $action );
			$this->assertStringContainsString( "wp_ajax_{$action}", $src, $action );
		}
	}

	public function test_order_and_product_meta_keys_remain(): void {
		$src = self::legacy_source();
		foreach ( array( 'wdp_donor_name', 'wdp_donor_phone', 'wdp_donor_email', 'wdp_donation_note', '_enable_sadaka_donation', '_sadaka_min_price', '_enable_addon_donation', '_addon_min_price', 'wdp_sadaka_donation', 'wdp_sadaka_linked_wc_product' ) as $key ) {
			$this->assertStringContainsString( "'" . $key . "'", $src, $key );
		}
	}

	public function test_block_names_remain(): void {
		$root = dirname( __DIR__, 3 );
		$json = array();
		foreach ( (array) glob( $root . '/blocks/*/block.json' ) as $file ) {
			$data   = json_decode( (string) file_get_contents( $file ), true );
			$json[] = is_array( $data ) ? (string) ( $data['name'] ?? '' ) : '';
		}
		$this->assertContains( 'wdp/donation-form', $json );
		$this->assertContains( 'wdp/donations', $json );
	}
}

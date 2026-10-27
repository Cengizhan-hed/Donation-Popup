<?php
/**
 * Dışa açık uyumluluk sözleşmesi (TEK dosya): eski sürümlerden beri sitelerin, temaların ve parça kodlarının
 * kullandığı adlar burada yaşar ve yeni koda yönlendirilir. Bu dosya dışında eski bir ad bulunmaz.
 *
 * - Kısa kodlar: `[wdp_donation_button]`, `[wdp_donation_button_panel]` (`id`), `[wdp_donation_form]`, `[wdp_donations]`.
 *   Adları ve öznitelikleri (`id, slug, sku, text, button_text, class, title, show_title`) değişmez.
 * - PHP yardımcı işlevleri: `wdp_render_donation_button()`, `wdp_render_donation_form()` (giriş dosyasında tanımlı ince sarmalayıcılar;
 *   işi `render_for_product()` yapar).
 * - Kanca adları (docs/HOOKS.md "Eski sözleşme"): etkin olanlar kodda çalışmaya devam eder; arayüzü kaldırılanlar
 *   `RETIRED_HOOKS` altında listelenir (ekleyen kodu bozmaz, ancak artık çağrılmaz).
 * - Veri anahtarları: sipariş kalemi / ürün / sepet / seçenek anahtarları (`DATA_KEYS`); göç ve testler bunlara bakar.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Compat;

use DonationPanel\Modules\EntryPoints\Blocks;
use DonationPanel\Modules\EntryPoints\Donations_List;
use DonationPanel\Modules\EntryPoints\Elementor\Elementor_Compat;
use DonationPanel\Modules\EntryPoints\Shortcodes;

defined( 'ABSPATH' ) || exit;

/**
 * Public_Contract.
 */
final class Public_Contract {

	/**
	 * Kısa kod adı => işleyici (Shortcodes yöntemi ya da Donations_List).
	 */
	const SHORTCODES = array(
		'wdp_donation_button'       => 'donation_button_shortcode',
		'wdp_donation_button_panel' => 'donation_button_panel_shortcode',
		'wdp_donation_form'         => 'donation_form_shortcode',
		'wdp_donations'             => 'list',
	);

	/**
	 * Blok adları.
	 */
	const BLOCKS = array( 'wdp/donation-form', 'wdp/donations' );

	/**
	 * Hâlâ çalışan eski kanca/süzgeç adları (kodda uygulanır).
	 */
	const ACTIVE_HOOKS = array(
		'wdp_allow_multiple_entries',
		'wdp_amount_presets',
		'wdp_builder_preview_context_product',
		'wdp_builder_preview_product',
		'wdp_convert_amount',
		'wdp_donations_card_html',
		'wdp_donations_query_args',
		'wdp_form_context',
		'wdp_is_builder_preview',
		'wdp_is_donation_product',
		'wdp_min_donation_amount',
		'wdp_order_exchange_rate',
		'wdp_phone_countries',
		'wdp_phone_default_country',
		'wdp_phone_excluded_countries',
		'wdp_phone_national_length_rules',
		'wdp_progress_convert_amount',
		'wdp_progress_live_rate',
		'wdp_progress_paid_statuses',
		'wdp_rate_limit_ip_max',
		'wdp_resolve_product',
		'wdp_sadaka_cart_thumbnail_size',
		'wdp_sadaka_line_product_ids',
		'wdp_sadaka_toggle_label',
		'wdp_sadaka_wc_product_id',
		'wdp_supported_product_types',
		'wdp_trust_proxy_headers',
	);

	/**
	 * Arayüzü kaldırılan eski kancalar: adları sözleşmede kalır, artık çağrılmaz (eklentinin eski modal/form arayüzüne aitti).
	 */
	const RETIRED_HOOKS = array(
		'wdp_campaign_media_url',
		'wdp_client_context',
		'wdp_critical_css_page_type',
		'wdp_defer_frontend_assets',
		'wdp_defer_frontend_styles',
		'wdp_enable_side_cart_recovery',
		'wdp_field_hint_email',
		'wdp_field_hint_name',
		'wdp_field_hint_note',
		'wdp_field_hint_phone',
		'wdp_impact_line',
		'wdp_lazy_idle_prefetch',
		'wdp_modal_product_thumb_alt',
		'wdp_modal_product_thumb_url',
		'wdp_reload_after_add_to_cart',
		'wdp_sadaka_price_label',
		'wdp_should_enqueue_assets',
		'wdp_show_amount_presets',
		'wdp_split_client_data',
		'wdp_use_js_bundle',
	);

	/**
	 * Kaldırılan ön yüz AJAX eylemleri (eski modal/form arayüzünün uçları; artık kayıtlı değil, yerine REST `donation-panel/v1`).
	 */
	const RETIRED_AJAX_ACTIONS = array(
		'wdp_ajax_add_to_cart',
		'wdp_get_cart_contents',
		'wdp_get_cart_count',
		'wdp_get_fresh_nonces',
		'wdp_get_product_info',
		'wdp_get_product_name',
		'wdp_remove_cart_item',
		'wdp_render_modal',
		'wdp_verify_submission_in_cart',
	);

	/**
	 * Veri sözleşmesi: sipariş kalemi, ürün, sepet ve seçenek anahtarları (adları değişmez).
	 */
	const DATA_KEYS = array(
		'order_item' => array( 'wdp_donor_name', 'wdp_donor_phone', 'wdp_donor_email', 'wdp_donation_note', 'wdp_dedication', 'wdp_anonymous', 'wdp_cover_fee', 'wdp_share_count' ),
		'product'    => array( '_enable_addon_donation', '_addon_min_price', '_enable_sadaka_donation', '_sadaka_min_price', '_wdp_total_donation_amount', '_wdp_manual_total', '_wdp_donor_count', '_wdp_donation_product' ),
		'cart'       => array( 'donation_data', 'custom_price', 'wdp_sadaka_donation', 'wdp_sadaka_linked_wc_product', 'wdp_input_currency', 'wdp_base_unit_price', 'unique_submission_key' ),
		'options'    => array( 'wdp_button_settings', 'wdp_success_settings', 'wdp_shareholder_settings', 'wdp_progress_bar_settings', 'wdp_modal_layout_settings', 'wdp_placement_settings', 'wdp_version', 'wdp_cache_version' ),
	);

	/**
	 * Kısa kodları, blokları ve Elementor ince katmanını kaydeder (WooCommerce yüklüyken).
	 *
	 * @return void
	 */
	public static function register() {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}
		foreach ( self::SHORTCODES as $tag => $handler ) {
			$callback = 'list' === $handler ? array( Donations_List::class, 'shortcode' ) : array( Shortcodes::class, $handler );
			add_shortcode( $tag, $callback );
		}
		Blocks::init();
		Elementor_Compat::init();

		add_filter( 'donation_panel_amount_presets', array( __CLASS__, 'filter_amount_presets' ), 20, 2 );
		add_filter( 'donation_panel_form_model', array( __CLASS__, 'filter_form_model' ), 20, 1 );
	}

	/**
	 * Bir giriş noktasını çizer (kısa kod, blok ve Elementor ince katmanının ortak çağrısı).
	 *
	 * @param string               $tag  `wdp_donation_button` | `wdp_donation_button_panel` | `wdp_donation_form`.
	 * @param array<string, mixed> $atts Öznitelikler.
	 * @return string
	 */
	public static function render( $tag, array $atts ) {
		switch ( $tag ) {
			case 'wdp_donation_button':
				return Shortcodes::donation_button_shortcode( $atts );
			case 'wdp_donation_button_panel':
				return Shortcodes::donation_button_panel_shortcode( $atts );
			default:
				return Shortcodes::donation_form_shortcode( $atts );
		}
	}

	/**
	 * PHP yardımcı işlevlerinin çekirdeği: ürünü doğrular, yoksa eski ileti metinleriyle uyarı döner.
	 *
	 * @param string               $tag        Kısa kod adı.
	 * @param int                  $product_id Ürün kimliği.
	 * @param array<string, mixed> $atts       Öznitelikler.
	 * @return string
	 */
	public static function render_for_product( $tag, $product_id, array $atts ) {
		if ( ! function_exists( 'wc_get_product' ) ) {
			return '<p style="color:red;">' . esc_html__( 'WooCommerce is not active.', 'woo-donation-popup' ) . '</p>';
		}
		if ( ! wc_get_product( $product_id ) ) {
			/* translators: %d: product ID. */
			return '<p style="color:red;">' . esc_html( sprintf( __( 'Product not found (ID: %d). Please check the product ID.', 'woo-donation-popup' ), $product_id ) ) . '</p>';
		}
		return self::render( $tag, array_merge( $atts, array( 'id' => $product_id ) ) );
	}

	/**
	 * Eski `wdp_amount_presets` süzgecini yeni hızlı tutar süzgecine yönlendirir.
	 *
	 * @param array<int, float|int|string> $presets    Tutarlar.
	 * @param int                          $product_id Ürün kimliği.
	 * @return array<int, float|int|string>
	 */
	public static function filter_amount_presets( $presets, $product_id ) {
		/**
		 * Eski süzgeç (sözleşme): hızlı tutarlar.
		 *
		 * @param array $presets    Tutarlar.
		 * @param float $min        En düşük tutar (bilinmiyorsa 0).
		 * @param int   $product_id Ürün kimliği.
		 */
		$filtered = apply_filters( 'wdp_amount_presets', $presets, 0.0, (int) $product_id ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi.
		return is_array( $filtered ) ? $filtered : $presets;
	}

	/**
	 * Eski `wdp_sadaka_toggle_label` süzgecini form modelindeki ek bağış etiketine uygular.
	 *
	 * @param array<string, mixed> $model Form modeli.
	 * @return array<string, mixed>
	 */
	public static function filter_form_model( $model ) {
		if ( is_array( $model ) && isset( $model['addon']['label'] ) && is_array( $model['addon'] ) ) {
			$model['addon']['label'] = (string) apply_filters( 'wdp_sadaka_toggle_label', (string) $model['addon']['label'] ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi.
		}
		return $model;
	}
}

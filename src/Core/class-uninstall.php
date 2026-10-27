<?php
/**
 * Eklenti kaldırma: ürün ayarları ve eklenti seçenekleri; sipariş/HPOS dokunulmaz.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Core;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Uninstall helpers (also loaded from uninstall.php without the rest of the plugin).
 */
class Uninstall {

	/**
	 * WooCommerce / WordPress core product meta that must never be deleted.
	 *
	 * @return string[]
	 */
	public static function protected_core_meta_keys() {
		return array(
			'_price',
			'_regular_price',
			'_sale_price',
			'_stock',
			'_stock_status',
			'_sku',
			'_manage_stock',
			'_virtual',
			'_downloadable',
			'_tax_status',
			'_tax_class',
			'_weight',
			'_length',
			'_width',
			'_height',
			'_thumbnail_id',
			'_product_image_gallery',
			'_sold_individually',
			'_backorders',
			'_upsell_ids',
			'_crosssell_ids',
			'total_sales',
			'_wc_average_rating',
			'_wc_rating_count',
			'_wc_review_count',
			'_product_attributes',
			'_default_attributes',
			'_purchase_note',
			'_featured',
			'_visibility',
			'_product_version',
			'_download_limit',
			'_download_expiry',
			'_downloadable_files',
			'_variation_description',
			'_sale_price_dates_from',
			'_sale_price_dates_to',
			'_low_stock_amount',
		);
	}

	/**
	 * Exact product meta keys owned by this plugin (inventory from get_post_meta / update_post_meta / get_meta).
	 *
	 * @return string[]
	 */
	public static function product_meta_keys() {
		return array(
			'_allow_custom_price',
			'_min_custom_price',
			'_allow_multiple_shares',
			'_max_shares',
			'_enable_progress_bar',
			'_progress_bar_limit',
			'_goal_reached_action',
			'_goal_reached_message',
			'_enable_product_note',
			'_product_note_text',
			'_enable_addon_donation',
			'_addon_min_price',
			'_addon_fixed_price',
			'_addon_donation_message',
			'_addon_toggle_label',
			'_addon_wc_product_id',
			'_enable_sadaka_donation',
			'_sadaka_min_price',
			'_sadaka_fixed_price',
			'_sadaka_donation_message',
			'_sadaka_toggle_label',
			'_sadaka_wc_product_id',
			'_enable_trust_strip',
			'_enable_quantity',
			'_enable_amount_presets',
			'_enable_wizard',
			'_enable_field_icons',
			'_enable_impact_line',
			'_progress_celebrate',
			'_impact_line_text',
			'_amount_presets',
			'_amount_preset_recommended',
			'_enable_email',
			'_enable_dedication',
			'_enable_anonymous',
			'_dedication_placeholder',
			'_trust_badges',
			'_theme_primary',
			'_theme_primary_hover',
			'_theme_radius',
			'_theme_modal_bg',
			'_theme_preset_id',
			'_theme_density',
			'_theme_inherit_category_color',
			'_layout_mode',
			'_enable_campaign_media',
			'_enable_urgency',
			'_urgency_text',
			'_urgency_ends_at',
			'_enable_social_proof',
			'_social_proof_text',
			'_enable_cover_fee',
			'_cover_fee_percent',
			'_wdp_module_order',
			'_wdp_donation_product',
			'_wdp_auto_place',
			'_wdp_total_donation_amount',
			'_wdp_manual_total',
			'_wdp_campaign_starts_at',
			'_wdp_campaign_ends_at',
			'_wdp_donor_count',
			'_wdp_progress_unconverted_orders',
			'_enable_faq',
			'_faq_items',
		);
	}

	/**
	 * Safe LIKE prefixes (plugin-owned only; unique to this plugin). Applied only on product / product_variation rows.
	 * Generic prefixes such as `_enable_`, `_theme_`, `_addon_` are NOT here: those keys are matched exactly by
	 * product_meta_keys() so other plugins' meta is never touched.
	 *
	 * @return string[]
	 */
	public static function product_meta_prefixes() {
		return array(
			'_wdp_',
			'_sadaka_',
			'_donation_panel_',
		);
	}

	/**
	 * Exact option names owned by this plugin (current and legacy).
	 *
	 * @return string[]
	 */
	public static function option_names() {
		return array(
			'donation_panel_settings',
			'donation_panel_migrations',
			'donation_panel_migrations_lock',
			'donation_panel_migrations_error',
			'wdp_version',
			'wdp_db_version',
			'wdp_previous_version',
			'wdp_migration_log',
			'wdp_migration_lock',
			'wdp_notice_placement_intro',
			'wdp_settings_backup_10_27',
			'wdp_settings_backup_10_27_restored',
			'wdp_success_settings',
			'wdp_button_settings',
			'wdp_cache_version',
			'wdp_list_cache_version',
			'wdp_delete_data_on_uninstall',
			'wdp_legacy_render_count',
			'wdp_addon_links_audit',
			'wdp_sadaka_links_audit',
			'wdp_upgrade_new_default',
		);
	}

	/**
	 * Transient name prefixes owned by this plugin (without the `_transient_` part).
	 *
	 * @return string[]
	 */
	public static function transient_prefixes() {
		return array(
			'donation_panel_rl_',
			'donation_panel_rt_',
			'dp_progress_',
			'dp_social_stats_',
			'dp_social_page_',
			'wdp_list_',
			'wdp_addon_line_ids',
			'wdp_sadaka_line_ids',
			'wdp_donor_count_',
		);
	}

	/**
	 * Whether a product meta key belongs to this plugin and is safe to delete on uninstall.
	 *
	 * @param string $key Meta key.
	 * @return bool
	 */
	public static function should_delete_product_meta_key( $key ) {
		$key = is_scalar( $key ) ? (string) $key : '';
		if ( '' === $key || in_array( $key, self::protected_core_meta_keys(), true ) ) {
			return false;
		}
		if ( in_array( $key, self::product_meta_keys(), true ) ) {
			return true;
		}
		foreach ( self::product_meta_prefixes() as $prefix ) {
			if ( strpos( $key, $prefix ) === 0 ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * "Kaldırınca verileri sil" açık mı: yeni ayar (`donation_panel_settings`) varsa o, yoksa eski seçenek.
	 *
	 * @return bool
	 */
	private static function deletion_enabled() {
		$settings = get_option( 'donation_panel_settings', array() );
		if ( is_array( $settings ) && isset( $settings['general'] ) && is_array( $settings['general'] ) && array_key_exists( 'delete_data_on_uninstall', $settings['general'] ) ) {
			return (bool) $settings['general']['delete_data_on_uninstall'];
		}
		return '1' === (string) get_option( 'wdp_delete_data_on_uninstall', '0' );
	}

	/**
	 * Remove plugin data for the current site when the uninstall flag is on.
	 *
	 * @return void
	 */
	public static function cleanup_site() {
		global $wpdb;

		if ( ! self::deletion_enabled() ) {
			return;
		}

		if ( ! isset( $wpdb ) || ! is_object( $wpdb ) ) {
			return;
		}

		foreach ( self::option_names() as $option_name ) {
			delete_option( $option_name );
		}
		foreach ( self::transient_prefixes() as $prefix ) {
			self::delete_options_like( $wpdb, '_transient_' . $prefix );
			self::delete_options_like( $wpdb, '_transient_timeout_' . $prefix );
			self::delete_options_like( $wpdb, '_site_transient_' . $prefix );
			self::delete_options_like( $wpdb, '_site_transient_timeout_' . $prefix );
		}

		self::delete_product_meta( $wpdb );

		if ( function_exists( 'wp_cache_delete' ) ) {
			wp_cache_delete( 'alloptions', 'options' );
			wp_cache_delete( 'notoptions', 'options' );
		}
		if ( function_exists( 'wp_cache_flush_group' ) ) {
			wp_cache_flush_group( 'wdp_donations' );
			wp_cache_flush_group( 'wdp_product_info' );
			wp_cache_flush_group( 'wdp_products' );
		}
	}

	/**
	 * @param \wpdb   $wpdb  Database.
	 * @param string $prefix Option name prefix (no wildcard).
	 * @return void
	 */
	private static function delete_options_like( $wpdb, $prefix ) {
		$like = $wpdb->esc_like( $prefix ) . '%';
		$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- özel toplu işlem (göç/kaldırma); WordPress API toplu meta/seçenek silmeyi desteklemez.
			$wpdb->prepare(
				"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
				$like
			)
		);
	}

	/**
	 * Delete plugin product meta (never orders / order items / HPOS).
	 *
	 * @param \wpdb $wpdb Database.
	 * @return void
	 */
	private static function delete_product_meta( $wpdb ) {
		$keys = self::product_meta_keys();
		if ( ! empty( $keys ) ) {
			$placeholders = implode( ',', array_fill( 0, count( $keys ), '%s' ) );
			$sql          = "DELETE pm FROM {$wpdb->postmeta} pm
				INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				WHERE p.post_type IN ('product', 'product_variation')
				AND pm.meta_key IN ({$placeholders})";
			$wpdb->query( $wpdb->prepare( $sql, $keys ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- yer tutucu sayısı anahtar listesi uzunluğundan üretilir; toplu kaldırma.
		}

		foreach ( self::product_meta_prefixes() as $prefix ) {
			$like = $wpdb->esc_like( $prefix ) . '%';
			$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- özel toplu işlem (göç/kaldırma); WordPress API toplu meta/seçenek silmeyi desteklemez.
				$wpdb->prepare(
					"DELETE pm FROM {$wpdb->postmeta} pm
					INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
					WHERE p.post_type IN ('product', 'product_variation')
					AND pm.meta_key LIKE %s",
					$like
				)
			);
		}
	}
}

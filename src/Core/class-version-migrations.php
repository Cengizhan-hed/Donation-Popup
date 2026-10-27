<?php
/**
 * Veritabanı geçişleri: sıralı, idempotent ve loglanan adımlar (wdp_db_version).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Core;

use DonationPanel\Domain\Addon_Product_Visibility;
use DonationPanel\Domain\Addon_Settings;
use DonationPanel\Domain\Amount_Presets;
use DonationPanel\Domain\Placement_Settings;
use DonationPanel\Modules\EntryPoints\Donations_List;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Runs ordered, idempotent data migrations once per plugin version.
 *
 * Every step must be safe to run twice and must not change values the user chose,
 * except values whose meaning changed or whose feature was removed.
 */
class Version_Migrations {

	const OPTION                 = 'wdp_db_version';
	const PREVIOUS_OPTION        = 'wdp_previous_version';
	const LOG_OPTION             = 'wdp_migration_log';
	const NOTICE_OPTION          = 'wdp_notice_placement_intro';
	const BACKUP_OPTION          = 'wdp_settings_backup_10_27';
	const BACKUP_RESTORED_OPTION = 'wdp_settings_backup_10_27_restored';
	const LOCK                   = 'wdp_migration_lock';
	const LOCK_TTL               = 300;
	const BATCH                  = 500;

	/** Option names that may appear in the 10.27 settings backup (plus nested product_meta). */
	const BACKUP_OPTION_KEYS = array(
		'wdp_button_settings',
		'wdp_success_settings',
		'wdp_shareholder_settings',
		'wdp_progress_bar_settings',
		'wdp_modal_layout_settings',
		'wdp_placement_settings',
		'wdp_meta_tracking_settings',
		'wdp_category_title_colors',
		'wdp_custom_style_presets',
	);

	/** Product meta of the removed in-form FAQ module (10.27.0). */
	const REMOVED_PRODUCT_META = array( '_enable_faq', '_faq_items' );

	/** Module ids removed from module order lists (10.27.0). */
	const REMOVED_MODULE_IDS = array( 'faq' );

	/** Keys removed from global option arrays (10.27.0; defensive — imported/hand-edited options). */
	const REMOVED_OPTION_KEYS = array( 'enable_faq', 'faq_items' );

	/** Global option arrays the plugin owns. */
	const SETTINGS_OPTIONS = array(
		'wdp_button_settings',
		'wdp_success_settings',
		'wdp_shareholder_settings',
		'wdp_progress_bar_settings',
		'wdp_modal_layout_settings',
	);

	/** @var bool */
	private static $hooked = false;

	/**
	 * @return void
	 */
	public static function init() {
		if ( self::$hooked ) {
			return;
		}
		self::$hooked = true;
		add_action( 'admin_init', array( __CLASS__, 'maybe_run_for_admin' ), 5 );
		add_action( 'admin_init', array( __CLASS__, 'maybe_dismiss_notice' ), 20 );
		add_action( 'admin_notices', array( __CLASS__, 'maybe_admin_notice' ) );
		add_action( 'upgrader_process_complete', array( __CLASS__, 'on_upgrader_complete' ), 10, 2 );
	}

	/**
	 * Ordered steps: version => callable(bool $is_fresh_install).
	 *
	 * @return array<string, callable>
	 */
	public static function steps() {
		return array(
			'10.27.0' => array( __CLASS__, 'step_10_27_0' ),
			'10.28.1' => array( __CLASS__, 'step_10_28_1' ),
			'10.28.4' => array( __CLASS__, 'step_10_28_4' ),
			'10.28.5' => array( __CLASS__, 'step_10_28_5' ),
			'10.29.0' => array( __CLASS__, 'step_10_29_0' ),
			'10.29.1' => array( __CLASS__, 'step_10_29_1' ),
			'10.30.0' => array( __CLASS__, 'step_10_30_0' ),
			'10.31.0' => array( __CLASS__, 'step_10_31_0' ),
			'10.32.0' => array( __CLASS__, 'step_10_32_0' ),
			'10.33.0' => array( __CLASS__, 'step_10_33_0' ),
			'10.34.0' => array( __CLASS__, 'step_10_34_0' ),
			'10.35.2' => array( __CLASS__, 'step_10_35_2' ),
		);
	}

	/**
	 * Target schema version (the plugin version).
	 *
	 * @return string
	 */
	public static function target_version() {
		return defined( 'WDP_VERSION' ) ? (string) WDP_VERSION : '0';
	}

	/**
	 * @return bool
	 */
	public static function needs_run() {
		$stored = get_option( self::OPTION, false );
		return false === $stored || version_compare( (string) $stored, self::target_version(), '<' );
	}

	/**
	 * admin_init entry point: only for a user who can manage options.
	 *
	 * @return void
	 */
	public static function maybe_run_for_admin() {
		// admin-ajax/admin-post ziyaretçi istekleri de admin_init tetikler; göç yalnız yetkili yönetici isteğinde.
		if ( ! function_exists( 'current_user_can' ) || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		self::maybe_run();
	}

	/**
	 * Run pending steps when the stored schema version is behind.
	 *
	 * @return void
	 */
	public static function maybe_run() {
		if ( ! self::needs_run() ) {
			return;
		}
		self::run();
	}

	/**
	 * Run after this plugin was updated through the WordPress upgrader.
	 *
	 * @param mixed $upgrader Upgrader instance.
	 * @param mixed $options  Upgrade options.
	 * @return void
	 */
	public static function on_upgrader_complete( $upgrader, $options ) {
		if ( ! is_array( $options ) || ( $options['type'] ?? '' ) !== 'plugin' || ! defined( 'WDP_PLUGIN_FILE' ) ) {
			return;
		}
		$basename = function_exists( 'plugin_basename' ) ? plugin_basename( WDP_PLUGIN_FILE ) : '';
		$plugins  = isset( $options['plugins'] ) ? (array) $options['plugins'] : ( isset( $options['plugin'] ) ? array( $options['plugin'] ) : array() );
		if ( '' !== $basename && in_array( $basename, $plugins, true ) ) {
			self::maybe_run();
		}
	}

	/**
	 * Record the version stored before Bootstrap::update_version() overwrites it.
	 *
	 * @param mixed $previous Previous wdp_version value (false when absent).
	 * @return void
	 */
	public static function remember_previous_version( $previous ) {
		if ( false === $previous || '' === $previous || false !== get_option( self::OPTION, false ) ) {
			return;
		}
		if ( get_option( self::PREVIOUS_OPTION, false ) === false ) {
			update_option( self::PREVIOUS_OPTION, sanitize_text_field( (string) $previous ), false );
		}
	}

	/**
	 * Run pending steps under a lock.
	 *
	 * @return bool True when all pending steps completed.
	 */
	public static function run() {
		if ( get_transient( self::LOCK ) ) {
			return false;
		}
		set_transient( self::LOCK, '1', self::LOCK_TTL );

		$ok = true;
		try {
			$stored   = get_option( self::OPTION, false );
			$is_fresh = self::is_fresh_install();
			$current  = false === $stored ? '0' : (string) $stored;
			$target   = self::target_version();

			foreach ( self::steps() as $version => $callback ) {
				if ( version_compare( $version, $current, '<=' ) || version_compare( $version, $target, '>' ) ) {
					continue;
				}
				$summary = call_user_func( $callback, $is_fresh );
				self::log( $version, is_string( $summary ) ? $summary : 'ok' );
				update_option( self::OPTION, $version, false );
				$current = $version;
			}

			update_option( self::OPTION, $target, false );
			delete_option( self::PREVIOUS_OPTION );
		} catch ( \Throwable $e ) {
			$ok = false;
			self::log( 'error', $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine() );
		}

		delete_transient( self::LOCK );
		return $ok;
	}

	/**
	 * A site counts as an upgrade when it has no schema version but carries data of an older release.
	 *
	 * @return bool
	 */
	public static function is_fresh_install() {
		if ( get_option( self::OPTION, false ) !== false ) {
			return false;
		}
		if ( get_option( self::PREVIOUS_OPTION, false ) !== false ) {
			return false;
		}
		$version = get_option( 'wdp_version', false );
		if ( false !== $version && self::target_version() !== (string) $version ) {
			return false;
		}
		foreach ( self::SETTINGS_OPTIONS as $option ) {
			if ( get_option( $option, false ) !== false ) {
				return false;
			}
		}
		return get_option( 'wdp_legacy_render_count', false ) === false;
	}

	/**
	 * 10.28.1: restore settings wiped by the rejected 10.28.0 step (when a backup exists),
	 * then write WooCommerce placement defaults (auto_place on for upgrades too).
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string Summary for the log.
	 */
	public static function step_10_28_1( $is_fresh ) {
		$restore   = self::restore_settings_backup_10_27();
		$placement = self::write_placement_settings_10_28_1();

		return sprintf(
			'restore:%s placement:%s fresh:%s',
			$restore,
			$placement,
			$is_fresh ? 'yes' : 'no'
		);
	}

	/**
	 * 10.30.0: Form alanları — aydınlatma bağlantısı varsayılan anahtarları (veri silinmez).
	 *
	 * - `enable_privacy_notice` yoksa '0'
	 * - `privacy_notice_text` yoksa varsayılan metin
	 * - `privacy_notice_url` yoksa ''
	 * Mevcut ürün notu / ithaf metinleri kırpılmaz.
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string Summary for the log.
	 */
	public static function step_10_30_0( $is_fresh ) {
		$flag = 'wdp_migrated_10_30_0';
		if ( $is_fresh ) {
			update_option( $flag, '1', false );
			return 'skipped (fresh install)';
		}

		$button = get_option( 'wdp_button_settings', false );
		$added  = array();
		if ( ! is_array( $button ) ) {
			$button = array();
		}
		if ( ! array_key_exists( 'enable_privacy_notice', $button ) ) {
			$button['enable_privacy_notice'] = '0';
			$added[]                         = 'enable_privacy_notice';
		}
		if ( ! array_key_exists( 'privacy_notice_text', $button ) ) {
			$button['privacy_notice_text'] = __( 'Your personal data is processed under the privacy notice.', 'woo-donation-popup' );
			$added[]                       = 'privacy_notice_text';
		}
		if ( ! array_key_exists( 'privacy_notice_url', $button ) ) {
			$button['privacy_notice_url'] = '';
			$added[]                      = 'privacy_notice_url';
		}
		if ( $added ) {
			update_option( 'wdp_button_settings', $button, false );
		}

		update_option( $flag, '1', false );
		return 'privacy_keys:' . ( $added ? implode( ',', $added ) : 'none' );
	}

	/**
	 * 10.31.0: Kampanya blokları — toplanan yeniden hesap planı + aydınlatma varsayılanı.
	 *
	 * - Progress açık ürünlerde toplam yeniden hesap planlanır (veri silinmez).
	 * - Aydınlatma metni yalnız eski varsayılanla birebir aynıysa yeni varsayılana güncellenir;
	 *   özel metinler dokunulmaz. Anahtar yoksa yeni varsayılan eklenir.
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string Summary for the log.
	 */
	public static function step_10_31_0( $is_fresh ) {
		$flag = 'wdp_migrated_10_31_0';
		if ( get_option( $flag ) ) {
			return 'already';
		}

		$old_privacy = __( 'Your personal data is processed under the privacy notice.', 'woo-donation-popup' );
		$new_privacy = __(
			'Your personal data is processed to complete your donation and is shared with our field teams abroad. See the privacy notice for details.',
			'woo-donation-popup'
		);
		// Stored pre-i18n defaults are compared as machine-stable literals (not gettext output).
		$old_privacy_values = array(
			$old_privacy,
			'Kişisel verileriniz Aydınlatma Metni kapsamında işlenir.',
		);

		$privacy_action = 'none';
		$button         = get_option( 'wdp_button_settings', false );
		if ( ! is_array( $button ) ) {
			$button = array();
		}
		if ( ! array_key_exists( 'privacy_notice_text', $button ) ) {
			$button['privacy_notice_text'] = $new_privacy;
			update_option( 'wdp_button_settings', $button, false );
			$privacy_action = 'added';
		} elseif ( in_array( trim( (string) $button['privacy_notice_text'] ), $old_privacy_values, true ) ) {
			$button['privacy_notice_text'] = $new_privacy;
			update_option( 'wdp_button_settings', $button, false );
			$privacy_action = 'updated_default';
		}

		// 12.0.0: otomatik toplam yeniden hesabı kaldırıldı; toplamlar yalnız yöneticinin onayıyla (Kampanyalar ekranı) yazılır.
		$scheduled = 0;

		update_option( $flag, '1', false );
		return sprintf(
			'privacy:%s recalc_scheduled:%d fresh:%s',
			$privacy_action,
			$scheduled,
			$is_fresh ? 'yes' : 'no'
		);
	}

	/**
	 * 10.32.0: Aydınlatma — uzun varsayılan etiketleri boşalt (kısa varsayılan geçerli olsun).
	 *
	 * Kayıtlı etiket 10.30.0 veya 10.31.0 varsayılan metinlerinden birebir biriyse '' yapılır;
	 * özel yazılmış metinlere dokunulmaz. Veri silinmez (yalnız eşleşen varsayılan temizlenir).
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string Summary for the log.
	 */
	public static function step_10_32_0( $is_fresh ) {
		$flag = 'wdp_migrated_10_32_0';
		if ( get_option( $flag ) ) {
			return 'already';
		}
		if ( $is_fresh ) {
			update_option( $flag, '1', false );
			return 'skipped (fresh install)';
		}

		$legacy_defaults = array(
			__( 'Your personal data is processed under the privacy notice.', 'woo-donation-popup' ),
			__(
				'Your personal data is processed to complete your donation and is shared with our field teams abroad. See the privacy notice for details.',
				'woo-donation-popup'
			),
			// Non-translated copies that may have been stored from prior migrations.
			'Kişisel verileriniz Aydınlatma Metni kapsamında işlenir.',
			'Kişisel verileriniz bağışınızın gerçekleştirilmesi için işlenir ve yurt dışındaki saha ekiplerimizle paylaşılır. Ayrıntı için Aydınlatma Metni\'ne bakın.',
		);
		$legacy_defaults = array_values( array_unique( $legacy_defaults ) );

		$action = 'none';
		$button = get_option( 'wdp_button_settings', false );
		if ( is_array( $button ) && array_key_exists( 'privacy_notice_text', $button ) ) {
			$current = trim( (string) $button['privacy_notice_text'] );
			if ( '' !== $current && in_array( $current, $legacy_defaults, true ) ) {
				$button['privacy_notice_text'] = '';
				update_option( 'wdp_button_settings', $button, false );
				$action = 'cleared_legacy_default';
			}
		}

		update_option( $flag, '1', false );
		return 'privacy:' . $action;
	}

	/**
	 * 10.33.0: liste önbelleği sürümünü artır (bayat HTML düşsün). Veri silinmez.
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string Summary for the log.
	 */
	public static function step_10_33_0( $is_fresh ) {
		$flag = 'wdp_migrated_10_33_0';
		if ( get_option( $flag ) ) {
			return 'already';
		}
		Donations_List::reset_bump_guard();
		Donations_List::bump_cache();
		update_option( $flag, '1', false );
		return $is_fresh ? 'list cache initialized' : 'list cache bumped';
	}

	/**
	 * 10.34.0: liste kartı HTML değişti (bağlantı, fiyat, ilerleme). Yalnız önbellek sürümü artar; veri silinmez.
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string Summary for the log.
	 */
	public static function step_10_34_0( $is_fresh ) {
		$flag = 'wdp_migrated_10_34_0';
		if ( get_option( $flag ) ) {
			return 'already';
		}
		Donations_List::reset_bump_guard();
		Donations_List::bump_cache();
		update_option( $flag, '1', false );
		return $is_fresh ? 'list cache initialized' : 'list cache bumped';
	}

	/**
	 * 10.35.2: ek bağış iç adlandırması ("sadaka" -> "addon"). Ürün meta + denetim seçeneği yeni adlara KOPYALANIR.
	 *
	 * Idempotent: yalnız yeni anahtarı OLMAYAN ürünlere yazar; eski anahtar silinmez (okuma yedeği).
	 * Sipariş öğe metası değişmez (geçmiş kayıt).
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string Summary for the log.
	 */
	public static function step_10_35_2( $is_fresh ) {
		$map    = Addon_Product_Visibility::LEGACY_META;
		$copied = 0;
		if ( ! $is_fresh ) {
			$ids = array();
			if ( class_exists( 'WDP_Test_State' ) ) {
				$ids = array_keys( (array) \WDP_Test_State::$post_meta );
			} else {
				global $wpdb;
				$keys = array_values( $map );
				$in   = implode( ',', array_fill( 0, count( $keys ), '%s' ) );
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare,WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
				$ids = $wpdb->get_col( $wpdb->prepare( "SELECT DISTINCT post_id FROM {$wpdb->postmeta} WHERE meta_key IN ($in)", $keys ) );
			}
			foreach ( (array) $ids as $pid ) {
				foreach ( $map as $new => $old ) {
					if ( ! empty( get_post_meta( (int) $pid, $new, false ) ) || empty( get_post_meta( (int) $pid, $old, false ) ) ) {
						continue;
					}
					update_post_meta( (int) $pid, $new, get_post_meta( (int) $pid, $old, true ) );
					++$copied;
				}
			}
		}
		// Denetim seçeneği: yeni ad yoksa eskiden kopyala (eski silinmez).
		if ( get_option( 'wdp_addon_links_audit', false ) === false ) {
			$old_audit = get_option( 'wdp_sadaka_links_audit', false );
			if ( false !== $old_audit ) {
				update_option( 'wdp_addon_links_audit', $old_audit, false );
			}
		}
		delete_transient( 'wdp_sadaka_line_ids' );
		Addon_Product_Visibility::flush();
		return 'addon meta copied:' . $copied;
	}

	/**
	 * 10.29.1 (K2): genel `amount_preset_recommended` kaldırılır (ürün meta korunur).
	 *
	 * Idempotent. Yeni kurulumda anahtar zaten yoktur.
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string Summary for the log.
	 */
	public static function step_10_29_1( $is_fresh ) {
		$flag = 'wdp_migrated_10_29_1';
		if ( $is_fresh ) {
			update_option( $flag, '1', false );
			return 'skipped (fresh install)';
		}

		$removed = 'no';
		$button  = get_option( 'wdp_button_settings', false );
		if ( is_array( $button ) && array_key_exists( 'amount_preset_recommended', $button ) ) {
			unset( $button['amount_preset_recommended'] );
			update_option( 'wdp_button_settings', $button, false );
			$removed = 'yes';
		}

		update_option( $flag, '1', false );
		return 'global_recommended_removed:' . $removed;
	}

	/**
	 * 10.29.0: "Tutar seçenekleri" veri onarımı (yalnız güncellemelerde; yeni kurulum atlanır).
	 *
	 * - Ürün `_cover_fee_percent`: 15'ten büyük → 15; (0, 0.5) → 0.5 (çalışma anı sınırlarıyla aynı; 0 = kapalı korunur).
	 * - Genel `amount_presets`: 6'dan fazla değer varsa ilk 6 tam sayıya kısaltılır (Y6). Yeni değer uydurulmaz.
	 *
	 * Idempotent: ikinci çalıştırmada değiştirilecek bir şey kalmaz.
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string Summary for the log.
	 */
	public static function step_10_29_0( $is_fresh ) {
		$flag = 'wdp_migrated_10_29_0';
		if ( $is_fresh ) {
			update_option( $flag, '1', false );
			return 'skipped (fresh install)';
		}

		$fee_fixed = 0;
		foreach ( self::find_products_with_meta_key( '_cover_fee_percent' ) as $product_id ) {
			$raw = get_post_meta( $product_id, '_cover_fee_percent', true );
			if ( '' === $raw || null === $raw || ! is_numeric( $raw ) ) {
				continue;
			}
			$value = (float) $raw;
			if ( $value <= 0 ) {
				continue;
			}
			$clamped = (float) min( 15, max( 0.5, $value ) );
			if ( abs( $clamped - $value ) > 0.00001 ) {
				update_post_meta( $product_id, '_cover_fee_percent', (string) $clamped );
				++$fee_fixed;
			}
		}

		$presets_trimmed = false;
		$button          = get_option( 'wdp_button_settings', false );
		if ( is_array( $button ) && isset( $button['amount_presets'] ) && is_string( $button['amount_presets'] ) ) {
			$tokens = preg_split( '/[\s,;]+/', trim( $button['amount_presets'] ), -1, PREG_SPLIT_NO_EMPTY );
			if ( is_array( $tokens ) && count( $tokens ) > 6 ) {
				$kept = Amount_Presets::parse_csv( $button['amount_presets'] );
				if ( ! empty( $kept ) ) {
					$button['amount_presets'] = implode( ', ', array_map( 'intval', $kept ) );
					update_option( 'wdp_button_settings', $button, false );
					$presets_trimmed = true;
				}
			}
		}

		update_option( $flag, '1', false );

		return sprintf(
			'cover_fee_fixed:%d global_presets_trimmed:%s',
			$fee_fixed,
			$presets_trimmed ? 'yes' : 'no'
		);
	}

	/**
	 * Product IDs that carry a non-empty value for a meta key (batched).
	 *
	 * @param string $meta_key Meta key.
	 * @return int[]
	 */
	private static function find_products_with_meta_key( $meta_key ) {
		global $wpdb;
		if ( isset( $wpdb ) && is_object( $wpdb ) ) {
			$out   = array();
			$after = 0;
			do {
				$ids = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- özel toplu işlem (göç/kaldırma); WordPress API toplu meta/seçenek silmeyi desteklemez.
					$wpdb->prepare(
						"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value <> '' AND post_id > %d ORDER BY post_id ASC LIMIT %d",
						$meta_key,
						$after,
						self::BATCH
					)
				);
				$ids = array_map( 'absint', (array) $ids );
				foreach ( $ids as $post_id ) {
					$after = max( $after, $post_id );
					$out[] = $post_id;
				}
				$batch_full = ( count( $ids ) === self::BATCH );
			} while ( $batch_full );
			return $out;
		}

		$out = array();
		if ( class_exists( 'WDP_Test_State' ) && ! empty( \WDP_Test_State::$post_meta ) ) {
			foreach ( \WDP_Test_State::$post_meta as $pid => $meta ) {
				if ( isset( $meta[ $meta_key ] ) && '' !== $meta[ $meta_key ] ) {
					$out[] = (int) $pid;
				}
			}
		}
		return $out;
	}

	/**
	 * 10.28.5: alt bağış görünürlük/dışlama önbelleklerini temizle; liste önbelleğini artır.
	 * Geçerli bağlantılara dokunmaz (10.28.4 denetim tablosu korunur).
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string Summary for the log.
	 */
	public static function step_10_28_5( $is_fresh ) {
		$flag   = 'wdp_sadaka_visibility_cache_cleared';
		$before = (int) get_option( 'wdp_list_cache_version', 1 );

		// Transient her zaman temizlenir; liste önbelleği yalnızca bir kez artırılır (idempotent).
		Addon_Product_Visibility::flush();

		$bumped = false;
		if ( get_option( $flag, false ) === false ) {
			Donations_List::bump_cache();
			update_option( $flag, '1', false );
			$bumped = true;
		}

		$after = (int) get_option( 'wdp_list_cache_version', 1 );

		return sprintf(
			'addon_visibility_caches cleared list_cache:%d→%d bumped:%s fresh:%s',
			$before,
			$after,
			$bumped ? 'yes' : 'no',
			$is_fresh ? 'yes' : 'no'
		);
	}

	/**
	 * 10.28.4: temizle geçersiz / kapalı alt bağış (_addon_wc_product_id) bağlantılarını.
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string Summary for the log.
	 */
	public static function step_10_28_4( $is_fresh ) {
		$audit   = self::audit_and_clean_addon_links();
		$cleaned = isset( $audit['cleaned'] ) ? (int) $audit['cleaned'] : 0;
		$valid   = isset( $audit['valid'] ) ? (int) $audit['valid'] : 0;
		$rows    = isset( $audit['rows'] ) && is_array( $audit['rows'] ) ? $audit['rows'] : array();

		update_option(
			Addon_Product_Visibility::AUDIT_OPTION,
			array(
				'time'    => time(),
				'fresh'   => $is_fresh ? 1 : 0,
				'cleaned' => $cleaned,
				'valid'   => $valid,
				'rows'    => $rows,
			),
			false
		);

		Addon_Product_Visibility::flush();

		$reasons = array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) || ( isset( $row['status'] ) ? $row['status'] : '' ) !== 'cleaned' ) {
				continue;
			}
			$r             = isset( $row['reason'] ) ? (string) $row['reason'] : 'other';
			$reasons[ $r ] = isset( $reasons[ $r ] ) ? $reasons[ $r ] + 1 : 1;
		}
		$reason_bits = array();
		foreach ( $reasons as $code => $count ) {
			$reason_bits[] = $code . '=' . $count;
		}

		return sprintf(
			'addon_links cleaned:%d valid:%d %s fresh:%s',
			$cleaned,
			$valid,
			$reason_bits ? implode( ',', $reason_bits ) : 'reasons:none',
			$is_fresh ? 'yes' : 'no'
		);
	}

	/**
	 * Scan _addon_wc_product_id; clear self-ref, missing, non-simple, or enable-off leftovers.
	 *
	 * @return array{cleaned:int,valid:int,rows:array<int,array<string,mixed>>}
	 */
	public static function audit_and_clean_addon_links() {
		$rows    = array();
		$cleaned = 0;
		$valid   = 0;

		$parent_ids = self::find_products_with_addon_meta();
		foreach ( $parent_ids as $parent_id ) {
			$parent_id = absint( $parent_id );
			$raw_id    = absint( Addon_Product_Visibility::get_meta( $parent_id, '_addon_wc_product_id' ) );
			if ( $raw_id <= 0 ) {
				continue;
			}

			$enabled = Addon_Product_Visibility::parent_has_addon_enabled( $parent_id );

			$reason = '';
			if ( $raw_id === $parent_id ) {
				$reason = 'self_ref';
			} elseif ( ! $enabled ) {
				$reason = 'enable_off';
			} elseif ( ! Addon_Settings::is_valid_addon_wc_product( $raw_id ) ) {
				$product = function_exists( 'wc_get_product' ) ? wc_get_product( $raw_id ) : null;
				$reason  = $product ? 'not_simple_or_status' : 'missing';
			}

			$parent_label = Addon_Product_Visibility::product_label( $parent_id );
			$addon_label  = Addon_Product_Visibility::product_label( $raw_id );

			if ( '' !== $reason ) {
				delete_post_meta( $parent_id, '_addon_wc_product_id' );
				delete_post_meta( $parent_id, '_sadaka_wc_product_id' );
				++$cleaned;
				$rows[] = array(
					'parent_id'    => $parent_id,
					'parent_label' => $parent_label,
					'sadaka_id'    => $raw_id,
					'sadaka_label' => $addon_label,
					'status'       => 'cleaned',
					'reason'       => $reason,
				);
				continue;
			}

			++$valid;
			$rows[] = array(
				'parent_id'    => $parent_id,
				'parent_label' => $parent_label,
				'sadaka_id'    => $raw_id,
				'sadaka_label' => $addon_label,
				'status'       => 'valid',
				'reason'       => '',
			);
		}

		// Genel varsayılanı da tabloya ekle (silinmez; yalnızca görünürlük).
		$default = (int) Addon_Settings::get_default_addon_wc_product_id();
		if ( $default > 0 ) {
			$ok     = Addon_Settings::is_valid_addon_wc_product( $default );
			$rows[] = array(
				'parent_id'    => 0,
				'parent_label' => __( 'General default (Success tab)', 'woo-donation-popup' ),
				'sadaka_id'    => $default,
				'sadaka_label' => Addon_Product_Visibility::product_label( $default ),
				'status'       => $ok ? 'valid' : 'invalid_default',
				'reason'       => $ok ? '' : 'missing_or_invalid',
			);
		}

		return array(
			'cleaned' => $cleaned,
			'valid'   => $valid,
			'rows'    => $rows,
		);
	}

	/**
	 * @return int[]
	 */
	private static function find_products_with_addon_meta() {
		if ( function_exists( 'get_posts' ) ) {
			$found = get_posts(
				array(
					'post_type'              => 'product',
					'post_status'            => 'any',
					'numberposts'            => self::BATCH,
					'fields'                 => 'ids',
					'suppress_filters'       => true, // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.SuppressFilters_suppress_filters -- yalnız kimlik listesi; filtreler sonucu bozmasın.
					'no_found_rows'          => true,
					'update_post_meta_cache' => true,
					'update_post_term_cache' => false,
					'meta_query'             => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
						array(
							'key'     => '_addon_wc_product_id',
							'value'   => 0,
							'compare' => '>',
							'type'    => 'NUMERIC',
						),
					),
				)
			);
			if ( ! empty( $found ) ) {
				return array_map( 'absint', (array) $found );
			}
		}

		if ( class_exists( 'WDP_Test_State' ) && ! empty( \WDP_Test_State::$post_meta ) ) {
			$out = array();
			foreach ( \WDP_Test_State::$post_meta as $pid => $meta ) {
				$linked = $meta['_addon_wc_product_id'] ?? ( $meta['_sadaka_wc_product_id'] ?? 0 );
				if ( absint( $linked ) > 0 ) {
					$out[] = (int) $pid;
				}
			}
			return $out;
		}

		return array();
	}

	/**
	 * Restore options (+ optional product_meta) from wdp_settings_backup_10_27, then rename the backup.
	 * Idempotent: no-op when the backup is missing or already renamed to *_restored.
	 *
	 * @return string skipped|restored|already
	 */
	public static function restore_settings_backup_10_27() {
		if ( get_option( self::BACKUP_RESTORED_OPTION, false ) !== false ) {
			return 'already';
		}

		$backup = get_option( self::BACKUP_OPTION, false );
		if ( ! is_array( $backup ) || array() === $backup ) {
			return 'skipped';
		}

		$options_restored = 0;
		foreach ( $backup as $key => $value ) {
			$key = (string) $key;
			if ( 'product_meta' === $key || '' === $key ) {
				continue;
			}
			update_option( $key, $value, false );
			++$options_restored;
		}

		// Drop known plugin options that 10.28.0 may have left when they are absent from the backup.
		foreach ( self::BACKUP_OPTION_KEYS as $option_key ) {
			if ( ! array_key_exists( $option_key, $backup ) && get_option( $option_key, null ) !== null ) {
				delete_option( $option_key );
			}
		}

		$meta_restored = 0;
		$meta_removed  = 0;
		if ( isset( $backup['product_meta'] ) && is_array( $backup['product_meta'] ) ) {
			foreach ( $backup['product_meta'] as $post_id => $metas ) {
				$post_id = absint( $post_id );
				if ( $post_id <= 0 || ! is_array( $metas ) ) {
					continue;
				}
				$kept_keys = array();
				foreach ( $metas as $meta_key => $meta_value ) {
					$meta_key = (string) $meta_key;
					if ( '' === $meta_key ) {
						continue;
					}
					update_post_meta( $post_id, $meta_key, $meta_value );
					$kept_keys[ $meta_key ] = true;
					++$meta_restored;
				}
				$current = get_post_meta( $post_id );
				if ( is_array( $current ) ) {
					foreach ( array_keys( $current ) as $meta_key ) {
						$meta_key = (string) $meta_key;
						if ( strpos( $meta_key, '_theme_' ) === 0 && ! isset( $kept_keys[ $meta_key ] ) ) {
							delete_post_meta( $post_id, $meta_key );
							++$meta_removed;
						}
					}
				}
			}
		}

		update_option( self::BACKUP_RESTORED_OPTION, $backup, false );
		delete_option( self::BACKUP_OPTION );

		return sprintf( 'ok options:%d meta:%d removed:%d', $options_restored, $meta_restored, $meta_removed );
	}

	/**
	 * Force WooCommerce page placement defaults for 10.28.1 (auto_place on for upgrades).
	 *
	 * @return string auto_place value written.
	 */
	private static function write_placement_settings_10_28_1() {
		$defaults = Placement_Settings::defaults();
		$stored   = get_option( Placement_Settings::OPTION, false );
		$stored   = is_array( $stored ) ? $stored : array();

		$stored['auto_place']  = 'yes';
		$stored['display']     = $defaults['display'];
		$stored['loop_button'] = $defaults['loop_button'];
		$stored['hide_price']  = $defaults['hide_price'];
		if ( ! isset( $stored['position'] ) ) {
			$stored['position'] = $defaults['position'];
		}

		$saved = Placement_Settings::save( $stored );
		return isset( $saved['auto_place'] ) ? (string) $saved['auto_place'] : 'yes';
	}

	/**
	 * 10.27.0: remove the in-form FAQ module data, write placement settings, fill missing option keys.
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string Summary for the log.
	 */
	public static function step_10_27_0( $is_fresh ) {
		$removed_meta = self::delete_removed_product_meta();
		$orders       = self::strip_removed_modules_from_product_orders();
		$options      = self::strip_removed_keys_from_options();
		$placement    = self::write_placement_settings( $is_fresh );
		$filled       = self::fill_stored_options();

		if ( ! $is_fresh && get_option( self::NOTICE_OPTION, false ) === false ) {
			update_option( self::NOTICE_OPTION, '1', false );
		}

		return sprintf(
			'meta:%d order:%d options:%d placement:%s filled:%d fresh:%s',
			$removed_meta,
			$orders,
			$options,
			$placement,
			$filled,
			$is_fresh ? 'yes' : 'no'
		);
	}

	/**
	 * Write every wdp_placement_settings key. Upgrades keep auto_place=no unless the user already saved.
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string auto_place value written.
	 */
	private static function write_placement_settings( $is_fresh ) {
		$defaults = Placement_Settings::defaults();
		$stored   = get_option( Placement_Settings::OPTION, false );
		if ( ! is_array( $stored ) ) {
			$defaults['auto_place'] = $is_fresh ? 'yes' : 'no';
			Placement_Settings::save( $defaults );
			return $defaults['auto_place'];
		}
		if ( ! isset( $stored['auto_place'] ) ) {
			$stored['auto_place'] = $is_fresh ? 'yes' : 'no';
		}
		$saved = Placement_Settings::save( $stored );
		return isset( $saved['auto_place'] ) ? (string) $saved['auto_place'] : 'no';
	}

	/**
	 * Eski ayar normalleştiricisi 12.0.0'da kaldırıldı (ayarlar artık Core\Settings şemasıyla doldurulur); bu adım
	 * log biçimini korumak için 0 döndürür.
	 *
	 * @return int Yeniden yazılan seçenek sayısı (her zaman 0).
	 */
	private static function fill_stored_options() {
		return 0;
	}

	/**
	 * @return void
	 */
	public static function maybe_dismiss_notice() {
		if ( ! isset( $_GET['wdp_dismiss_placement'] ) || ! current_user_can( 'manage_woocommerce' ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}
		$nonce = isset( $_GET['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( '' === $nonce || ! wp_verify_nonce( $nonce, 'wdp_dismiss_placement' ) ) {
			return;
		}
		delete_option( self::NOTICE_OPTION );
	}

	/**
	 * One-time, dismissible notice after an upgrade that added product-page placement.
	 *
	 * @return void
	 */
	public static function maybe_admin_notice() {
		if ( get_option( self::NOTICE_OPTION, '' ) !== '1' || ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		// Only on plugin settings and the Plugins screens (not every admin page).
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		$ok     = false;
		if ( $screen ) {
			$id = (string) $screen->id;
			if ( 'plugins' === $id || 'plugins-network' === $id || false !== strpos( $id, 'wdp-popup-settings' ) ) {
				$ok = true;
			}
		}
		if ( ! $ok && isset( $_GET['page'] ) && 'wdp-popup-settings' === sanitize_key( wp_unslash( $_GET['page'] ) ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$ok = true;
		}
		if ( ! $ok ) {
			return;
		}
		$settings = admin_url( 'admin.php?page=wdp-popup-settings#placement' );
		$url      = wp_nonce_url( add_query_arg( 'wdp_dismiss_placement', '1' ), 'wdp_dismiss_placement' );
		echo '<div class="notice notice-info is-dismissible"><p>';
		echo esc_html__( 'On WooCommerce product and shop pages, “Donate” can be used instead of “Add to cart”.', 'woo-donation-popup' );
		echo ' <a href="' . esc_url( $settings ) . '">' . esc_html__( 'Settings → Product page and list', 'woo-donation-popup' ) . '</a>';
		echo ' · <a href="' . esc_url( $url ) . '">' . esc_html__( 'Hide', 'woo-donation-popup' ) . '</a>';
		echo '</p></div>';
	}

	/**
	 * @return int Number of meta keys processed.
	 */
	private static function delete_removed_product_meta() {
		$count = 0;
		foreach ( self::REMOVED_PRODUCT_META as $key ) {
			delete_post_meta_by_key( $key );
			++$count;
		}
		return $count;
	}

	/**
	 * Remove deleted module ids from per-product `_wdp_module_order` in batches.
	 *
	 * @return int Updated products.
	 */
	private static function strip_removed_modules_from_product_orders() {
		global $wpdb;
		if ( ! isset( $wpdb ) || ! is_object( $wpdb ) ) {
			return 0;
		}

		$updated = 0;
		foreach ( self::REMOVED_MODULE_IDS as $module_id ) {
			$after = 0;
			do {
				$ids = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- özel toplu işlem (göç/kaldırma); WordPress API toplu meta/seçenek silmeyi desteklemez.
					$wpdb->prepare(
						"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value LIKE %s AND post_id > %d ORDER BY post_id ASC LIMIT %d",
						'_wdp_module_order',
						'%' . $wpdb->esc_like( $module_id ) . '%',
						$after,
						self::BATCH
					)
				);
				$ids = array_map( 'absint', (array) $ids );
				foreach ( $ids as $post_id ) {
					$after = max( $after, $post_id );
					$value = (string) get_post_meta( $post_id, '_wdp_module_order', true );
					$clean = self::strip_ids_from_csv( $value );
					if ( $clean !== $value ) {
						update_post_meta( $post_id, '_wdp_module_order', $clean );
						++$updated;
					}
				}
				$batch_full = ( count( $ids ) === self::BATCH );
			} while ( $batch_full );
		}
		return $updated;
	}

	/**
	 * Remove deleted keys and module ids from the plugin's global option arrays.
	 *
	 * @return int Updated options.
	 */
	private static function strip_removed_keys_from_options() {
		$updated = 0;
		foreach ( self::SETTINGS_OPTIONS as $option ) {
			$value = get_option( $option, false );
			if ( ! is_array( $value ) ) {
				continue;
			}
			$clean = $value;
			foreach ( self::REMOVED_OPTION_KEYS as $key ) {
				unset( $clean[ $key ] );
			}
			if ( isset( $clean['module_order'] ) && is_string( $clean['module_order'] ) ) {
				$clean['module_order'] = self::strip_ids_from_csv( $clean['module_order'] );
			}
			if ( $clean !== $value ) {
				update_option( $option, $clean, false );
				++$updated;
			}
		}
		return $updated;
	}

	/**
	 * @param string $csv Comma-separated module ids.
	 * @return string Same list without removed ids ('' when nothing is left).
	 */
	public static function strip_ids_from_csv( $csv ) {
		$ids  = array_filter(
			array_map( 'trim', explode( ',', (string) $csv ) ),
			static function ( $id ) {
				return '' !== $id;
			}
		);
		$kept = array_values( array_diff( $ids, self::REMOVED_MODULE_IDS ) );
		if ( count( $kept ) === count( $ids ) ) {
			return (string) $csv;
		}
		return implode( ',', $kept );
	}

	/**
	 * @param string $version Step version (or 'error').
	 * @param string $message Summary.
	 * @return void
	 */
	private static function log( $version, $message ) {
		$log   = get_option( self::LOG_OPTION, array() );
		$log   = is_array( $log ) ? $log : array();
		$log[] = array(
			'version' => (string) $version,
			'message' => (string) $message,
			'time'    => time(),
		);
		update_option( self::LOG_OPTION, array_slice( $log, -20 ), false );

		if ( function_exists( 'wdp_debug_log' ) ) {
			wdp_debug_log( 'WDP migration ' . $version . ': ' . $message );
		}
	}
}

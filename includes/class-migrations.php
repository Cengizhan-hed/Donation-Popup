<?php
/**
 * Veritabanı geçişleri: sıralı, idempotent ve loglanan adımlar (wdp_db_version).
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Runs ordered, idempotent data migrations once per plugin version.
 *
 * Every step must be safe to run twice and must not change values the user chose,
 * except values whose meaning changed or whose feature was removed.
 */
class WDP_Migrations {

	const OPTION          = 'wdp_db_version';
	const PREVIOUS_OPTION = 'wdp_previous_version';
	const LOG_OPTION      = 'wdp_migration_log';
	const NOTICE_OPTION   = 'wdp_notice_placement_intro';
	const LOCK            = 'wdp_migration_lock';
	const LOCK_TTL        = 300;
	const BATCH           = 500;

	/** Product meta of the removed in-form FAQ module (10.27.0). */
	const REMOVED_PRODUCT_META = array('_enable_faq', '_faq_items');

	/** Module ids removed from module order lists (10.27.0). */
	const REMOVED_MODULE_IDS = array('faq');

	/** Keys removed from global option arrays (10.27.0; defensive — imported/hand-edited options). */
	const REMOVED_OPTION_KEYS = array('enable_faq', 'faq_items');

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
		if (self::$hooked) {
			return;
		}
		self::$hooked = true;
		add_action('admin_init', array(__CLASS__, 'maybe_run'), 5);
		add_action('admin_init', array(__CLASS__, 'maybe_dismiss_notice'), 20);
		add_action('admin_notices', array(__CLASS__, 'maybe_admin_notice'));
		add_action('upgrader_process_complete', array(__CLASS__, 'on_upgrader_complete'), 10, 2);
	}

	/**
	 * Ordered steps: version => callable(bool $is_fresh_install).
	 *
	 * @return array<string, callable>
	 */
	public static function steps() {
		return array(
			'10.27.0' => array(__CLASS__, 'step_10_27_0'),
			'10.28.0' => array(__CLASS__, 'step_10_28_0'),
		);
	}

	/**
	 * Target schema version (the plugin version).
	 *
	 * @return string
	 */
	public static function target_version() {
		return defined('WDP_VERSION') ? (string) WDP_VERSION : '0';
	}

	/**
	 * @return bool
	 */
	public static function needs_run() {
		$stored = get_option(self::OPTION, false);
		return $stored === false || version_compare((string) $stored, self::target_version(), '<');
	}

	/**
	 * admin_init / activation entry point.
	 *
	 * @return void
	 */
	public static function maybe_run() {
		if (!self::needs_run()) {
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
	public static function on_upgrader_complete($upgrader, $options) {
		if (!is_array($options) || ($options['type'] ?? '') !== 'plugin' || !defined('WDP_PLUGIN_FILE')) {
			return;
		}
		$basename = function_exists('plugin_basename') ? plugin_basename(WDP_PLUGIN_FILE) : '';
		$plugins  = isset($options['plugins']) ? (array) $options['plugins'] : (isset($options['plugin']) ? array($options['plugin']) : array());
		if ($basename !== '' && in_array($basename, $plugins, true)) {
			self::maybe_run();
		}
	}

	/**
	 * Record the version stored before WDP_Plugin_Bootstrap::update_version() overwrites it.
	 *
	 * @param mixed $previous Previous wdp_version value (false when absent).
	 * @return void
	 */
	public static function remember_previous_version($previous) {
		if ($previous === false || $previous === '' || get_option(self::OPTION, false) !== false) {
			return;
		}
		if (get_option(self::PREVIOUS_OPTION, false) === false) {
			update_option(self::PREVIOUS_OPTION, sanitize_text_field((string) $previous), false);
		}
	}

	/**
	 * Run pending steps under a lock.
	 *
	 * @return bool True when all pending steps completed.
	 */
	public static function run() {
		if (get_transient(self::LOCK)) {
			return false;
		}
		set_transient(self::LOCK, '1', self::LOCK_TTL);

		$ok = true;
		try {
			$stored   = get_option(self::OPTION, false);
			$is_fresh = self::is_fresh_install();
			$current  = $stored === false ? '0' : (string) $stored;
			$target   = self::target_version();

			foreach (self::steps() as $version => $callback) {
				if (version_compare($version, $current, '<=') || version_compare($version, $target, '>')) {
					continue;
				}
				$summary = call_user_func($callback, $is_fresh);
				self::log($version, is_string($summary) ? $summary : 'ok');
				update_option(self::OPTION, $version, false);
				$current = $version;
			}

			update_option(self::OPTION, $target, false);
			delete_option(self::PREVIOUS_OPTION);
		} catch (\Throwable $e) {
			$ok = false;
			self::log('error', $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
		}

		delete_transient(self::LOCK);
		return $ok;
	}

	/**
	 * A site counts as an upgrade when it has no schema version but carries data of an older release.
	 *
	 * @return bool
	 */
	public static function is_fresh_install() {
		if (get_option(self::OPTION, false) !== false) {
			return false;
		}
		if (get_option(self::PREVIOUS_OPTION, false) !== false) {
			return false;
		}
		$version = get_option('wdp_version', false);
		if ($version !== false && (string) $version !== self::target_version()) {
			return false;
		}
		foreach (self::SETTINGS_OPTIONS as $option) {
			if (get_option($option, false) !== false) {
				return false;
			}
		}
		return get_option('wdp_legacy_render_count', false) === false;
	}

	/**
	 * 10.28.0: backup settings, map visual options to tokens, drop dead keys, slim product theme metas.
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string Summary for the log.
	 */
	public static function step_10_28_0($is_fresh) {
		$backup_keys = array_merge(
			self::SETTINGS_OPTIONS,
			array(
				'wdp_placement_settings',
				'wdp_meta_tracking_settings',
				'wdp_category_title_colors',
				'wdp_custom_style_presets',
			)
		);
		$backup = array();
		foreach ($backup_keys as $option) {
			$val = get_option($option, null);
			if ($val !== null) {
				$backup[ $option ] = $val;
			}
		}
		if (!$is_fresh && get_option('wdp_settings_backup_10_27', false) === false) {
			update_option('wdp_settings_backup_10_27', $backup, false);
		}

		$button = get_option('wdp_button_settings', array());
		$button = is_array($button) ? $button : array();
		$brand  = '';
		if (!empty($button['brand_color'])) {
			$brand = sanitize_hex_color($button['brand_color']);
		}
		if (!$brand && !empty($button['button_primary_color'])) {
			$brand = sanitize_hex_color($button['button_primary_color']);
		}
		if (!$brand) {
			$brand = '#1d5fa8';
		}
		$button['brand_color']          = $brand;
		$button['button_primary_color'] = $brand;
		if (empty($button['title_size'])) {
			$px = isset($button['title_font_size']) ? (int) $button['title_font_size'] : 22;
			$button['title_size'] = $px <= 20 ? 'S' : ($px >= 26 ? 'L' : 'M');
		}
		if (isset($button['form_density'])) {
			if ($button['form_density'] === 'compact') {
				$button['form_density'] = 'tight';
			} elseif ($button['form_density'] === 'spacious') {
				$button['form_density'] = 'comfortable';
			}
		}
		$radius = isset($button['ui_border_radius']) ? max(0, min(24, (int) $button['ui_border_radius'])) : 10;
		$button['ui_border_radius'] = (string) $radius;
		$mapped_density = isset($button['form_density']) ? (string) $button['form_density'] : 'normal';

		$dead_button_keys = array(
			'glass_blur_px',
			'glass_fill_opacity',
			'modal_background_color',
			'motion_intensity',
			'chip_style',
			'elevation_level',
			'form_button_alignment',
			'button_checkout_color',
			'button_checkout_hover',
		);
		foreach ($dead_button_keys as $key) {
			unset($button[ $key ]);
		}
		foreach (array_keys($button) as $key) {
			if (strpos((string) $key, 'button_shadow_') === 0) {
				unset($button[ $key ]);
			}
		}
		update_option('wdp_button_settings', $button, false);

		$progress = get_option('wdp_progress_bar_settings', array());
		if (is_array($progress)) {
			unset($progress['percentage_bg'], $progress['percentage_text']);
			update_option('wdp_progress_bar_settings', $progress, false);
		}

		$share = get_option('wdp_shareholder_settings', array());
		if (is_array($share)) {
			foreach (array('shareholder_card_shadow', 'shareholder_card_radius', 'shareholders_area_radius', 'shareholder_progress_status_label') as $key) {
				unset($share[ $key ]);
			}
			update_option('wdp_shareholder_settings', $share, false);
		}

		$removed_theme_meta = 0;
		foreach (array('_theme_primary_hover', '_theme_modal_bg', '_theme_preset_id', '_theme_density') as $meta_key) {
			delete_post_meta_by_key($meta_key);
			$removed_theme_meta++;
		}

		// Re-apply token fields after any normalizer fill (legacy normalizers may not know 2C keys).
		$button = get_option('wdp_button_settings', array());
		if (is_array($button)) {
			$button['form_density'] = $mapped_density;
			$button['ui_border_radius'] = (string) $radius;
			if (!empty($button['brand_color']) || !empty($button['button_primary_color'])) {
				$button['brand_color'] = !empty($button['brand_color']) ? $button['brand_color'] : $button['button_primary_color'];
			}
			foreach ($dead_button_keys as $key) {
				unset($button[ $key ]);
			}
			foreach (array_keys($button) as $key) {
				if (strpos((string) $key, 'button_shadow_') === 0) {
					unset($button[ $key ]);
				}
			}
			update_option('wdp_button_settings', $button, false);
		}
		$progress = get_option('wdp_progress_bar_settings', array());
		if (is_array($progress)) {
			unset($progress['percentage_bg'], $progress['percentage_text']);
			update_option('wdp_progress_bar_settings', $progress, false);
		}
		$share = get_option('wdp_shareholder_settings', array());
		if (is_array($share)) {
			foreach (array('shareholder_card_shadow', 'shareholder_card_radius', 'shareholders_area_radius', 'shareholder_progress_status_label') as $key) {
				unset($share[ $key ]);
			}
			update_option('wdp_shareholder_settings', $share, false);
		}

		return sprintf(
			'backup:%s brand:%s theme_meta:%d fresh:%s',
			isset($backup['wdp_button_settings']) ? 'yes' : 'no',
			$brand,
			$removed_theme_meta,
			$is_fresh ? 'yes' : 'no'
		);
	}

	/**
	 * 10.27.0: remove the in-form FAQ module data, write placement settings, fill missing option keys.
	 *
	 * @param bool $is_fresh Fresh install.
	 * @return string Summary for the log.
	 */
	public static function step_10_27_0($is_fresh) {
		$removed_meta = self::delete_removed_product_meta();
		$orders       = self::strip_removed_modules_from_product_orders();
		$options      = self::strip_removed_keys_from_options();
		$placement    = self::write_placement_settings($is_fresh);
		$filled       = self::fill_stored_options();

		if (!$is_fresh && get_option(self::NOTICE_OPTION, false) === false) {
			update_option(self::NOTICE_OPTION, '1', false);
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
	private static function write_placement_settings($is_fresh) {
		$defaults = WDP_Placement_Settings::defaults();
		$stored   = get_option(WDP_Placement_Settings::OPTION, false);
		if (!is_array($stored)) {
			$defaults['auto_place'] = $is_fresh ? 'yes' : 'no';
			WDP_Placement_Settings::save($defaults);
			return $defaults['auto_place'];
		}
		if (!isset($stored['auto_place'])) {
			$stored['auto_place'] = $is_fresh ? 'yes' : 'no';
		}
		$saved = WDP_Placement_Settings::save($stored);
		return isset($saved['auto_place']) ? (string) $saved['auto_place'] : 'no';
	}

	/**
	 * Re-run each global option through its normalizer so missing keys get defaults.
	 *
	 * @return int Options rewritten.
	 */
	private static function fill_stored_options() {
		if (!class_exists('WDP_Admin_Settings_Normalizer')) {
			return 0;
		}
		return (int) WDP_Admin_Settings_Normalizer::rewrite_stored_options();
	}

	/**
	 * @return void
	 */
	public static function maybe_dismiss_notice() {
		if (!isset($_GET['wdp_dismiss_placement']) || !current_user_can('manage_woocommerce')) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}
		$nonce = isset($_GET['_wpnonce']) ? sanitize_text_field(wp_unslash($_GET['_wpnonce'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ($nonce === '' || !wp_verify_nonce($nonce, 'wdp_dismiss_placement')) {
			return;
		}
		delete_option(self::NOTICE_OPTION);
	}

	/**
	 * One-time, dismissible notice after an upgrade that added product-page placement.
	 *
	 * @return void
	 */
	public static function maybe_admin_notice() {
		if (get_option(self::NOTICE_OPTION, '') !== '1' || !current_user_can('manage_woocommerce')) {
			return;
		}
		// Yalnızca eklenti ayarları ve Eklentiler ekranı (tüm admin'e yayılmaz).
		$screen = function_exists('get_current_screen') ? get_current_screen() : null;
		$ok     = false;
		if ($screen && isset($screen->id)) {
			$id = (string) $screen->id;
			if ($id === 'plugins' || $id === 'plugins-network' || strpos($id, 'wdp-popup-settings') !== false) {
				$ok = true;
			}
		}
		if (!$ok && isset($_GET['page']) && (string) $_GET['page'] === 'wdp-popup-settings') { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$ok = true;
		}
		if (!$ok) {
			return;
		}
		$settings = admin_url('admin.php?page=wdp-popup-settings#placement');
		$url      = wp_nonce_url(add_query_arg('wdp_dismiss_placement', '1'), 'wdp_dismiss_placement');
		echo '<div class="notice notice-info is-dismissible"><p>';
		echo esc_html__('Ürün sayfası otomatik yerleşimi eklendi; mevcut düzeniniz korunması için kapalı.', 'woo-donation-popup');
		echo ' <a href="' . esc_url($settings) . '">' . esc_html__('Ayarlar → Ürün sayfası ve liste', 'woo-donation-popup') . '</a>';
		echo ' · <a href="' . esc_url($url) . '">' . esc_html__('Gizle', 'woo-donation-popup') . '</a>';
		echo '</p></div>';
	}

	/**
	 * @return int Number of meta keys processed.
	 */
	private static function delete_removed_product_meta() {
		$count = 0;
		foreach (self::REMOVED_PRODUCT_META as $key) {
			delete_post_meta_by_key($key);
			$count++;
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
		if (!isset($wpdb) || !is_object($wpdb)) {
			return 0;
		}

		$updated = 0;
		foreach (self::REMOVED_MODULE_IDS as $module_id) {
			$after = 0;
			do {
				$ids = $wpdb->get_col(
					$wpdb->prepare(
						"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value LIKE %s AND post_id > %d ORDER BY post_id ASC LIMIT %d",
						'_wdp_module_order',
						'%' . $wpdb->esc_like($module_id) . '%',
						$after,
						self::BATCH
					)
				);
				$ids = array_map('absint', (array) $ids);
				foreach ($ids as $post_id) {
					$after = max($after, $post_id);
					$value = (string) get_post_meta($post_id, '_wdp_module_order', true);
					$clean = self::strip_ids_from_csv($value);
					if ($clean !== $value) {
						update_post_meta($post_id, '_wdp_module_order', $clean);
						$updated++;
					}
				}
			} while (count($ids) === self::BATCH);
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
		foreach (self::SETTINGS_OPTIONS as $option) {
			$value = get_option($option, false);
			if (!is_array($value)) {
				continue;
			}
			$clean = $value;
			foreach (self::REMOVED_OPTION_KEYS as $key) {
				unset($clean[$key]);
			}
			if (isset($clean['module_order']) && is_string($clean['module_order'])) {
				$clean['module_order'] = self::strip_ids_from_csv($clean['module_order']);
			}
			if ($clean !== $value) {
				update_option($option, $clean, false);
				$updated++;
			}
		}
		return $updated;
	}

	/**
	 * @param string $csv Comma-separated module ids.
	 * @return string Same list without removed ids ('' when nothing is left).
	 */
	public static function strip_ids_from_csv($csv) {
		$ids  = array_filter(array_map('trim', explode(',', (string) $csv)), 'strlen');
		$kept = array_values(array_diff($ids, self::REMOVED_MODULE_IDS));
		if (count($kept) === count($ids)) {
			return (string) $csv;
		}
		return implode(',', $kept);
	}

	/**
	 * @param string $version Step version (or 'error').
	 * @param string $message Summary.
	 * @return void
	 */
	private static function log($version, $message) {
		$log   = get_option(self::LOG_OPTION, array());
		$log   = is_array($log) ? $log : array();
		$log[] = array(
			'version' => (string) $version,
			'message' => (string) $message,
			'time'    => time(),
		);
		update_option(self::LOG_OPTION, array_slice($log, -20), false);

		if (function_exists('wdp_debug_log')) {
			wdp_debug_log('WDP migration ' . $version . ': ' . $message);
		}
	}
}

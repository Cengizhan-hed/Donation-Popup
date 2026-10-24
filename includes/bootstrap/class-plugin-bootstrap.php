<?php
/**
 * HPOS uyumluluğu, bağımlılık yükleme, sürüm güncelleme ve WC kontrolü.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Central bootstrap for plugin lifecycle and runtime.
 */
final class WDP_Plugin_Bootstrap {
	/**
	 * Boot plugin.
	 *
	 * @return void
	 */
	public static function run() {
		self::register_hpos_compatibility();
		self::load_dependencies();
		WDP_Migrations::init();

		add_action('init', array(__CLASS__, 'load_textdomain'));
		add_action('plugins_loaded', array(__CLASS__, 'launch_plugin'));
		add_action('plugins_loaded', array(__CLASS__, 'update_version'));
	}

	/**
	 * Load plugin translations on init (WP 6.7+ just-in-time; avoid early-load notice).
	 *
	 * @return void
	 */
	public static function load_textdomain() {
		load_plugin_textdomain(
			'woo-donation-popup',
			false,
			dirname(plugin_basename(WDP_PLUGIN_FILE)) . '/languages'
		);
	}

	/**
	 * Launch runtime modules.
	 *
	 * @return void
	 */
	public static function launch_plugin() {
		if (!class_exists('WooCommerce')) {
			add_action('admin_notices', array(__CLASS__, 'woocommerce_missing_notice'));
			return;
		}

		$GLOBALS['woo_donation_popup'] = new Woo_Donation_Popup();
		if (is_admin()) {
			$GLOBALS['woo_donation_popup_admin'] = new Woo_Donation_Popup_Admin();
		}
	}

	/**
	 * Show dependency warning.
	 *
	 * @return void
	 */
	public static function woocommerce_missing_notice() {
		?>
		<div class="notice notice-error">
			<p><?php esc_html_e('WooCommerce Donation Modal Popup eklentisi için WooCommerce eklentisinin yüklü ve aktif olması gerekiyor.', 'woo-donation-popup'); ?></p>
		</div>
		<?php
	}

	/**
	 * Update plugin version metadata and caches.
	 *
	 * @return void
	 */
	public static function update_version() {
		$stored_version  = get_option('wdp_version', false);
		$current_version = $stored_version === false ? '1.0' : $stored_version;

		if ($current_version === WDP_VERSION) {
			return;
		}

		if (class_exists('WDP_Migrations')) {
			WDP_Migrations::remember_previous_version($stored_version);
		}

		update_option('wdp_version', WDP_VERSION);
		update_option('wdp_cache_version', time());
		self::clear_all_caches();
	}

	/**
	 * Clear plugin-related caches.
	 *
	 * @return void
	 */
	public static function clear_all_caches() {
		if (function_exists('wc_delete_product_transients')) {
			wc_delete_product_transients();
		}
	}

	/**
	 * Register HPOS compatibility.
	 *
	 * @return void
	 */
	private static function register_hpos_compatibility() {
		add_action(
			'before_woocommerce_init',
			static function() {
				if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
					\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', WDP_PLUGIN_FILE, true);
				}
			}
		);
	}

	/**
	 * Include runtime dependencies.
	 *
	 * WDP_* classes autoload from flat includes/class-*.php files.
	 *
	 * @return void
	 */
	private static function load_dependencies() {
		require_once WDP_PLUGIN_DIR . 'includes/class-exceptions.php';
		require_once WDP_PLUGIN_DIR . 'includes/class-autoloader.php';
		require_once WDP_PLUGIN_DIR . 'includes/class-woo-donation-popup.php';
		require_once WDP_PLUGIN_DIR . 'includes/class-woo-donation-popup-admin.php';
		require_once WDP_PLUGIN_DIR . 'includes/bootstrap/class-legacy-frontend.php';
	}
}

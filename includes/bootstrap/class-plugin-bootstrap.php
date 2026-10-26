<?php
/**
 * HPOS uyumluluğu, bağımlılık yükleme, sürüm güncelleme ve WC kontrolü.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
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
		WDP_Compat_Loader::init();
		// Önizleme (`?dp_preview=1`): sınıf yalnız istekte parametre varken yüklenir; yetki `plugins_loaded` 1'de denetlenir.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- yalnız varlık denetimi; salt okunur görünüm.
		if ( isset( $_GET['dp_preview'] ) ) {
			\DonationPanel\Modules\Preview\Preview::init();
		}
		// WP-CLI komutu: yalnız WP_CLI tanımlıyken yüklenir.
		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			\DonationPanel\Cli\Cli_Command::register();
		}
		\DonationPanel\Core\Plugin::boot();

		add_action( 'init', array( __CLASS__, 'load_textdomain' ) );
		// Kanca sırası 20 (docs/MIMARI.md "Kanca sırası"): çekirdek göç/modüller (src/Core, 20) ile aynı öncelik; kayıt sırasıyla önce çekirdek çalışır.
		add_action( 'plugins_loaded', array( __CLASS__, 'launch_plugin' ), 20 );
		add_action( 'plugins_loaded', array( __CLASS__, 'update_version' ), 20 );
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
			dirname( plugin_basename( WDP_PLUGIN_FILE ) ) . '/languages'
		);
	}

	/**
	 * Launch runtime modules.
	 *
	 * @return void
	 */
	public static function launch_plugin() {
		if ( ! class_exists( 'WooCommerce' ) ) {
			add_action( 'admin_notices', array( __CLASS__, 'woocommerce_missing_notice' ) );
			return;
		}

		$GLOBALS['woo_donation_popup'] = new Woo_Donation_Popup();
		if ( is_admin() ) {
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
			<p><?php esc_html_e( 'The WooCommerce Donation Modal Popup plugin requires WooCommerce to be installed and active.', 'woo-donation-popup' ); ?></p>
		</div>
		<?php
	}

	/**
	 * Update plugin version metadata and caches.
	 *
	 * @return void
	 */
	public static function update_version() {
		$stored_version  = get_option( 'wdp_version', false );
		$current_version = $stored_version === false ? '1.0' : $stored_version;

		if ( $current_version === WDP_VERSION ) {
			return;
		}

		if ( class_exists( 'WDP_Migrations' ) ) {
			WDP_Migrations::remember_previous_version( $stored_version );
		}

		update_option( 'wdp_version', WDP_VERSION );
		update_option( 'wdp_cache_version', time() );
		self::clear_all_caches();
	}

	/**
	 * Clear plugin-related caches.
	 *
	 * @return void
	 */
	public static function clear_all_caches() {
		if ( function_exists( 'wc_delete_product_transients' ) ) {
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
			static function () {
				if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
					\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', WDP_PLUGIN_FILE, true );
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
		// Faz 7 çekirdeği (DonationPanel\): eski autoloader ile birlikte yüklenir.
		require_once WDP_PLUGIN_DIR . 'src/Core/class-autoloader.php';
		\DonationPanel\Core\Autoloader::register( WDP_PLUGIN_DIR . 'src' );
		require_once WDP_PLUGIN_DIR . 'includes/class-woo-donation-popup.php';
		require_once WDP_PLUGIN_DIR . 'includes/class-woo-donation-popup-admin.php';
		require_once WDP_PLUGIN_DIR . 'includes/bootstrap/class-legacy-frontend.php';
	}
}

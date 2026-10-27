<?php
/**
 * Eklenti başlatıcısı: etkinleştirme/devre dışı bırakma, HPOS uyumu, çeviri, sürüm güncelleme ve çekirdeğin başlatılması.
 *
 * Giriş dosyası (`woo-donation-popup.php`) yalnız sabitleri tanımlar, ad alanlı yükleyiciyi kaydeder ve `run()` çağırır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Core;

use DonationPanel\Modules\Preview\Preview;

defined( 'ABSPATH' ) || exit;

/**
 * Bootstrap.
 */
final class Bootstrap {

	/**
	 * Eklentiyi başlatır (giriş dosyası yüklenirken bir kez).
	 *
	 * @return void
	 */
	public static function run() {
		self::register_hpos_compatibility();
		Version_Migrations::init();

		// Önizleme (`?dp_preview=1`): sınıf yalnız istekte parametre varken yüklenir; yetki `plugins_loaded` 1'de denetlenir.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- yalnız varlık denetimi; salt okunur görünüm.
		if ( isset( $_GET['dp_preview'] ) ) {
			Preview::init();
		}
		// WP-CLI komutu: yalnız WP_CLI tanımlıyken yüklenir.
		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			\DonationPanel\Cli\Cli_Command::register();
		}
		Plugin::boot();

		add_action( 'init', array( __CLASS__, 'load_textdomain' ) );
		// Kanca sırası 20 (docs/MIMARI.md "Kanca sırası"): çekirdek göç/modüller ile aynı öncelik; kayıt sırasıyla önce çekirdek çalışır.
		add_action( 'plugins_loaded', array( __CLASS__, 'launch_plugin' ), 20 );
		add_action( 'plugins_loaded', array( __CLASS__, 'update_version' ), 20 );
	}

	/**
	 * Etkinleştirme: yeni kurulumda varsayılanlar, önbellek sürümü, bekleyen göçler.
	 *
	 * @return void
	 */
	public static function activate() {
		Settings::seed_fresh_install();
		update_option( 'wdp_cache_version', time() );
		Version_Migrations::maybe_run();
	}

	/**
	 * Devre dışı bırakma (temizlik gerekmez; veri korunur).
	 *
	 * @return void
	 */
	public static function deactivate() {
	}

	/**
	 * Çeviri dosyalarını yükler.
	 *
	 * @return void
	 */
	public static function load_textdomain() {
		load_plugin_textdomain( // phpcs:ignore PluginCheck.CodeAnalysis.DiscouragedFunctions.load_plugin_textdomainFound -- eklenti WordPress.org dışında dağıtılır; çeviriler languages/ klasöründedir.
			'woo-donation-popup',
			false,
			dirname( plugin_basename( WDP_PLUGIN_FILE ) ) . '/languages'
		);
	}

	/**
	 * WooCommerce yoksa uyarı gösterir (yönetici katmanı `Plugin::on_plugins_loaded` içinde kendi kancalarını bağlar).
	 *
	 * @return void
	 */
	public static function launch_plugin() {
		if ( ! class_exists( 'WooCommerce' ) ) {
			add_action( 'admin_notices', array( __CLASS__, 'woocommerce_missing_notice' ) );
		}
	}

	/**
	 * WooCommerce eksik uyarısı.
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
	 * Sürüm değişince önbellek sürümünü yeniler (göçler Version_Migrations ile ayrı çalışır).
	 *
	 * @return void
	 */
	public static function update_version() {
		$stored_version  = get_option( 'wdp_version', false );
		$current_version = false === $stored_version ? '1.0' : $stored_version;

		if ( WDP_VERSION === $current_version ) {
			return;
		}

		Version_Migrations::remember_previous_version( $stored_version );

		update_option( 'wdp_version', WDP_VERSION );
		update_option( 'wdp_cache_version', time() );
		if ( function_exists( 'wc_delete_product_transients' ) ) {
			wc_delete_product_transients();
		}
	}

	/**
	 * HPOS (özel sipariş tabloları) uyumluluğunu bildirir.
	 *
	 * @return void
	 */
	private static function register_hpos_compatibility() {
		add_action( 'before_woocommerce_init', array( __CLASS__, 'declare_woocommerce_compatibility' ) );
	}

	/**
	 * HPOS ve blok sepet/ödeme uyumluluğunu bildirir (WooCommerce "uyumsuz/belirsiz" göstermesin).
	 *
	 * Sepet/ödeme kancaları Store API ve klasik yolda e2e ile doğrulanır; blok sepet/ödeme için ek bağış satırı
	 * ve bağışçı alanları Store API uzantısı üzerinden taşınır.
	 *
	 * @return void
	 */
	public static function declare_woocommerce_compatibility() {
		if ( ! class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
			return;
		}
		foreach ( array( 'custom_order_tables', 'cart_checkout_blocks' ) as $feature ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( $feature, WDP_PLUGIN_FILE, true );
		}
	}
}

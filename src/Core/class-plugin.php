<?php
/**
 * Eklentinin tek girişi: kabı kurar, kancaları bağlar, modülleri açar.
 *
 * `boot()` `Bootstrap::run()` içinden çağrılır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Core;

use DonationPanel\Compat\Public_Contract;
use DonationPanel\Domain\Addon_Product_Visibility;
use DonationPanel\Domain\Campaign_Totals;
use DonationPanel\Frontend\Assets;
use DonationPanel\Frontend\Template_Loader;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Http\Rest\Ping_Controller;
use DonationPanel\Modules\EntryPoints\Donations_List;
use DonationPanel\Modules\EntryPoints\Entry_Points_Module;
use DonationPanel\Support\Logger;
use DonationPanel\WooCommerce\Cart_Hooks;
use DonationPanel\WooCommerce\Donation_Purchasable;
use DonationPanel\WooCommerce\Order_Hooks;

defined( 'ABSPATH' ) || exit;

/**
 * Plugin.
 */
final class Plugin {

	/**
	 * Tek örnek.
	 *
	 * @var Plugin|null
	 */
	private static $instance = null;

	/**
	 * Bağımlılık kabı.
	 *
	 * @var Container
	 */
	private $container;

	/**
	 * Kancalar bağlandı mı.
	 *
	 * @var bool
	 */
	private $started = false;

	/**
	 * Eklenti kök dizini.
	 *
	 * @var string
	 */
	private $plugin_dir;

	/**
	 * Eklenti kök URL'si.
	 *
	 * @var string
	 */
	private $plugin_url;

	/**
	 * Tek giriş: örneği kurar ve başlatır (tekrar çağrı güvenlidir).
	 *
	 * @param string $plugin_dir Eklenti kök dizini (varsayılan WDP_PLUGIN_DIR).
	 * @param string $plugin_url Eklenti kök URL'si (varsayılan WDP_PLUGIN_URL).
	 * @return Plugin
	 */
	public static function boot( $plugin_dir = '', $plugin_url = '' ) {
		if ( null === self::$instance ) {
			self::$instance = new self(
				'' !== $plugin_dir ? $plugin_dir : ( defined( 'WDP_PLUGIN_DIR' ) ? (string) WDP_PLUGIN_DIR : '' ),
				'' !== $plugin_url ? $plugin_url : ( defined( 'WDP_PLUGIN_URL' ) ? (string) WDP_PLUGIN_URL : '' )
			);
		}
		self::$instance->start();
		return self::$instance;
	}

	/**
	 * Örneği döndürür (boot edilmemişse null).
	 *
	 * @return Plugin|null
	 */
	public static function instance() {
		return self::$instance;
	}

	/**
	 * Test için tek örneği sıfırlar.
	 *
	 * @return void
	 */
	public static function reset() {
		self::$instance = null;
	}

	/**
	 * Kurucu (yalnız boot() çağırır).
	 *
	 * @param string $plugin_dir Kök dizin.
	 * @param string $plugin_url Kök URL.
	 */
	private function __construct( $plugin_dir, $plugin_url ) {
		$this->plugin_dir = $plugin_dir;
		$this->plugin_url = $plugin_url;
		$this->container  = new Container();
		$this->register_services();
	}

	/**
	 * Kap.
	 *
	 * @return Container
	 */
	public function container() {
		return $this->container;
	}

	/**
	 * Kancaları bağlar.
	 *
	 * @return void
	 */
	private function start() {
		if ( $this->started ) {
			return;
		}
		$this->started = true;

		add_action( 'plugins_loaded', array( $this, 'on_plugins_loaded' ), 20 );
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
		add_action( 'wp_enqueue_scripts', array( $this->container->get( Assets::class ), 'register_all' ), 5 );
	}

	/**
	 * Hizmetleri kaba tanımlar.
	 *
	 * @return void
	 */
	private function register_services() {
		$c = $this->container;

		$c->instance( Container::class, $c );
		$c->singleton(
			Settings::class,
			static function () {
				return new Settings();
			}
		);
		$c->singleton(
			Logger::class,
			static function () {
				return new Logger();
			}
		);
		$c->singleton(
			Rate_Limiter::class,
			static function () {
				return new Rate_Limiter();
			}
		);
		$c->singleton(
			Module_Registry::class,
			static function ( Container $container ) {
				$registry = new Module_Registry( $container->get( Settings::class ) );
				Plugin::register_modules( $registry );
				return $registry;
			}
		);
		$c->singleton(
			Template_Loader::class,
			function () {
				return new Template_Loader( $this->plugin_dir );
			}
		);
		$c->singleton(
			Assets::class,
			function () {
				return new Assets( $this->plugin_dir, $this->plugin_url );
			}
		);
		$c->singleton(
			Migrations::class,
			static function ( Container $container ) {
				$migrations = new Migrations();
				$importer   = new Legacy_Settings_Importer( $container->get( Settings::class ) );
				$migrations->add_step(
					'settings_import_v1',
					1,
					static function () use ( $importer ) {
						$importer->import();
					}
				);
				$migrations->add_step(
					'release_12_upgrade',
					2,
					static function () {
						( new Release_12_Upgrade() )->run();
					}
				);
				return $migrations;
			}
		);
	}

	/**
	 * Modül tanımları. Her modül burada slug + sınıf adıyla (yüklenmeden) kaydolur.
	 *
	 * @param Module_Registry $registry Kayıt defteri.
	 * @return void
	 */
	public static function register_modules( Module_Registry $registry ) {
		$registry->add( Entry_Points_Module::SLUG, Entry_Points_Module::class, true );
		// Sınıf adı metin olarak verilir: modül kapalıyken dosyası hiç yüklenmez.
		$registry->add( 'experiences', 'DonationPanel\\Modules\\Experiences\\Experiences_Module', true );
		$registry->add( 'side_cart', 'DonationPanel\\Modules\\SideCart\\Side_Cart_Module', false );

		$registry->add( 'campaign', 'DonationPanel\\Modules\\Campaign\\Campaign_Module', true );
		$registry->add( 'impact', 'DonationPanel\\Modules\\Impact\\Impact_Module', true );
		$registry->add( 'social_proof', 'DonationPanel\\Modules\\SocialProof\\Social_Proof_Module', false );
		$registry->add( 'thanks', 'DonationPanel\\Modules\\Thanks\\Thanks_Module', false );
		$registry->add( 'tax_relief', 'DonationPanel\\Modules\\TaxRelief\\Tax_Relief_Module', false );

		$registry->add( 'donor_account', 'DonationPanel\\Modules\\DonorAccount\\Donor_Account_Module', false );
	}

	/**
	 * Göçleri çalıştırır, modülleri açar.
	 *
	 * @return void
	 */
	public function on_plugins_loaded() {
		$this->container->get( Migrations::class )->run();

		$this->register_core_hooks();
		Public_Contract::register();

		$registry = $this->container->get( Module_Registry::class );
		$registry->boot( $this->container );

		// Ekran geçişi (E8Q): küçük sınıf, yalnız yönetim alanında; admin.ui değerinden bağımsız.
		if ( is_admin() ) {
			\DonationPanel\Admin\Ui_Switch::init();
		}

		// Yeni yönetici ekranı (E7): yalnız yönetim alanında ve `admin.ui = new` iken sınıf yüklenir.
		if ( is_admin() && Settings::admin_ui_is_new() ) {
			\DonationPanel\Admin\Admin_Bootstrap::init( $this->container, $this->plugin_dir, $this->plugin_url );
		}

		/**
		 * Modüller başlatıldıktan sonra çalışır.
		 *
		 * @param string[] $active Başlatılan modül slug'ları.
		 */
		do_action( 'donation_panel_modules_booted', $registry->active_slugs() );
	}

	/**
	 * WooCommerce kancalarını bağlar: sepet/sipariş/toplam/gizlilik. WooCommerce yoksa hiçbir şey bağlanmaz.
	 *
	 * @return void
	 */
	private function register_core_hooks() {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}
		Campaign_Totals::init();
		Cart_Hooks::init();
		Order_Hooks::init();
		Addon_Product_Visibility::init();
		Donation_Purchasable::init();
		Donations_List::init();
		( new \DonationPanel\WooCommerce\Checkout\Checkout_Prefill() )->register();
	}

	/**
	 * REST rotalarını kaydeder.
	 *
	 * @return void
	 */
	public function register_rest_routes() {
		$controllers = array(
			new Ping_Controller( $this->container->get( Rate_Limiter::class ), $this->container->get( Module_Registry::class ) ),
		);

		/**
		 * REST denetleyici listesini genişletir.
		 *
		 * @param array<int, mixed> $controllers Rest_Controller örnekleri.
		 */
		$controllers = (array) apply_filters( 'donation_panel_rest_controllers', $controllers );
		foreach ( $controllers as $controller ) {
			if ( is_object( $controller ) && method_exists( $controller, 'register_routes' ) ) {
				$controller->register_routes();
			}
		}
	}
}

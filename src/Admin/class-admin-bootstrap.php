<?php
/**
 * Yeni yönetici deneyiminin girişi (E7). Yalnız `admin.ui = new` iken yüklenir; eski ekran yerinde kalır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Admin_Bootstrap.
 */
final class Admin_Bootstrap {

	const CAPABILITY    = 'manage_woocommerce';
	const SLUG_SETTINGS = 'donation-panel';
	const SLUG_GUIDE    = 'donation-panel-guide';
	const SLUG_WIZARD   = 'donation-panel-setup';

	/**
	 * Tekrar kurulumu önler.
	 *
	 * @var bool
	 */
	private static $booted = false;

	/**
	 * Bağımlılık kabı.
	 *
	 * @var Container
	 */
	private $container;

	/**
	 * Varlık yöneticisi.
	 *
	 * @var Admin_Assets
	 */
	private $assets;

	/**
	 * Ayar ekranı örneği.
	 *
	 * @var Settings_Page|null
	 */
	private $settings_page = null;

	/**
	 * Sihirbaz örneği.
	 *
	 * @var Setup_Wizard|null
	 */
	private $wizard = null;

	/**
	 * Giriş.
	 *
	 * @param Container $container  Kap.
	 * @param string    $plugin_dir Eklenti kök dizini.
	 * @param string    $plugin_url Eklenti kök URL'si.
	 * @return void
	 */
	public static function init( Container $container, $plugin_dir, $plugin_url ) {
		if ( self::$booted ) {
			return;
		}
		self::$booted = true;
		$instance     = new self( $container, $plugin_dir, $plugin_url );
		$instance->hooks();
	}

	/**
	 * Test için sıfırlar.
	 *
	 * @return void
	 */
	public static function reset() {
		self::$booted = false;
	}

	/**
	 * Kurucu.
	 *
	 * @param Container $container  Kap.
	 * @param string    $plugin_dir Kök dizin.
	 * @param string    $plugin_url Kök URL.
	 */
	private function __construct( Container $container, $plugin_dir, $plugin_url ) {
		$this->container = $container;
		$this->assets    = new Admin_Assets( $plugin_dir, $plugin_url );
	}

	/**
	 * Kancaları bağlar.
	 *
	 * @return void
	 */
	private function hooks() {
		add_action( 'admin_menu', array( $this, 'register_menu' ), 30 );
		add_action( 'admin_init', array( $this->settings_page(), 'register' ) );
		add_action( 'admin_post_' . Setup_Wizard::ACTION, array( $this->wizard(), 'handle' ) );
		add_action( 'admin_enqueue_scripts', array( $this->assets, 'enqueue' ) );
	}

	/**
	 * Ayar ekranı.
	 *
	 * @return Settings_Page
	 */
	private function settings_page() {
		if ( null !== $this->settings_page ) {
			return $this->settings_page;
		}
		$this->settings_page = new Settings_Page( $this->container->get( Settings::class ), $this->container->get( Module_Registry::class ) );
		return $this->settings_page;
	}

	/**
	 * Sihirbaz.
	 *
	 * @return Setup_Wizard
	 */
	private function wizard() {
		if ( null === $this->wizard ) {
			$this->wizard = new Setup_Wizard( $this->container->get( Settings::class ) );
		}
		return $this->wizard;
	}

	/**
	 * WooCommerce menüsü altına sayfaları ekler (sihirbaz menüde görünmez).
	 *
	 * @return void
	 */
	public function register_menu() {
		$guide = new Guide();

		$hooks   = array();
		$hooks[] = add_submenu_page(
			'woocommerce',
			__( 'Donation Panel', 'woo-donation-popup' ),
			__( 'Donation Panel', 'woo-donation-popup' ),
			self::CAPABILITY,
			self::SLUG_SETTINGS,
			array( $this->settings_page(), 'render' )
		);
		$hooks[] = add_submenu_page(
			'woocommerce',
			__( 'Donation Panel guide', 'woo-donation-popup' ),
			__( 'Donation Panel guide', 'woo-donation-popup' ),
			self::CAPABILITY,
			self::SLUG_GUIDE,
			array( $guide, 'render' )
		);
		// `options.php` üst öğesi: sayfa vardır ama menüde görünmez.
		$hooks[] = add_submenu_page(
			'options.php',
			__( 'Quick setup', 'woo-donation-popup' ),
			__( 'Quick setup', 'woo-donation-popup' ),
			self::CAPABILITY,
			self::SLUG_WIZARD,
			array( $this->wizard(), 'render' )
		);

		foreach ( $hooks as $hook ) {
			if ( is_string( $hook ) && '' !== $hook ) {
				$this->assets->own( $hook );
				add_action( 'load-' . $hook, array( $guide, 'add_help_tabs' ) );
			}
		}
	}
}

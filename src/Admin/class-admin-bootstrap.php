<?php
/**
 * Yönetici girişi: TEK üst düzey "Donation Panel" menüsü, alt sayfalar, eski adreslerin yönlendirmesi, REST uçları.
 *
 * WooCommerce menüsü altında eklenti girişi YOKTUR. Yetki `manage_woocommerce`.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Settings;
use DonationPanel\Http\Rate_Limiter;

defined( 'ABSPATH' ) || exit;

/**
 * Admin_Bootstrap.
 */
final class Admin_Bootstrap {

	const CAPABILITY      = 'manage_woocommerce';
	const SLUG_OVERVIEW   = 'donation-panel';
	const SLUG_CAMPAIGNS  = 'donation-panel-campaigns';
	const SLUG_FORMS      = 'donation-panel-forms';
	const SLUG_CHECKOUT   = 'donation-panel-checkout';
	const SLUG_ACCOUNT    = 'donation-panel-account';
	const SLUG_PRIVACY    = 'donation-panel-privacy';
	const SLUG_TOOLS      = 'donation-panel-tools';
	const SLUG_GUIDE      = 'donation-panel-guide';
	const SLUG_WIZARD     = 'donation-panel-setup';
	const LEGACY_SETTINGS = 'wdp-popup-settings';

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
	 * Sayfa çizicileri.
	 *
	 * @var Pages|null
	 */
	private $pages = null;

	/**
	 * Ayar deposu.
	 *
	 * @var Settings_Store|null
	 */
	private $store = null;

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
	 * Eski ekran adresleri => yeni karşılığı (yer imi uyumu).
	 *
	 * @return array<string, string>
	 */
	public static function legacy_redirects() {
		return array(
			self::LEGACY_SETTINGS => self::SLUG_OVERVIEW,
		);
	}

	/**
	 * Menüdeki alt sayfaların sırası: slug => çizici yöntem.
	 *
	 * @return array<string, string>
	 */
	public static function page_methods() {
		return array(
			self::SLUG_OVERVIEW  => 'render_overview',
			self::SLUG_CAMPAIGNS => 'render_campaigns',
			self::SLUG_FORMS     => 'render_forms',
			self::SLUG_CHECKOUT  => 'render_checkout',
			self::SLUG_ACCOUNT   => 'render_account',
			self::SLUG_PRIVACY   => 'render_privacy',
			self::SLUG_TOOLS     => 'render_tools',
		);
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
		add_filter( 'donation_panel_rest_controllers', array( $this, 'add_rest_controller' ) );
		if ( ! is_admin() ) {
			return;
		}
		// Ürün düzenleme "Donation" sekmesi, ürün listesi sütunu/toplu işlemleri (WooCommerce standart kancaları).
		\DonationPanel\Admin\Product\Product_Admin::init();
		add_action( 'admin_page_access_denied', array( $this, 'redirect_legacy' ), 1 );
		add_action( 'admin_menu', array( $this, 'register_menu' ), 30 );
		add_action( 'admin_enqueue_scripts', array( $this->assets, 'enqueue' ) );
		if ( defined( 'WDP_PLUGIN_FILE' ) ) {
			add_filter( 'plugin_action_links_' . plugin_basename( WDP_PLUGIN_FILE ), array( $this, 'action_links' ) );
		}
	}

	/**
	 * Ayar deposu.
	 *
	 * @return Settings_Store
	 */
	private function store() {
		if ( null === $this->store ) {
			$this->store = new Settings_Store( $this->container->get( Settings::class ), $this->container->get( Module_Registry::class ) );
		}
		return $this->store;
	}

	/**
	 * Sayfa çizicileri.
	 *
	 * @return Pages
	 */
	private function pages() {
		if ( null === $this->pages ) {
			$this->pages = new Pages( $this->container->get( Settings::class ), $this->store() );
		}
		return $this->pages;
	}

	/**
	 * Yönetici REST denetleyicisini listeye ekler.
	 *
	 * @param array<int, mixed> $controllers Denetleyiciler.
	 * @return array<int, mixed>
	 */
	public function add_rest_controller( $controllers ) {
		$controllers   = (array) $controllers;
		$controllers[] = new Admin_Controller( $this->container->get( Rate_Limiter::class ), $this->container->get( Settings::class ), $this->store() );
		return $controllers;
	}

	/**
	 * Eski ekran adreslerini yenisine yönlendirir.
	 *
	 * @return void
	 */
	public function redirect_legacy() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- yalnız adres eşlemesi, veri işlenmez.
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
		$map  = self::legacy_redirects();
		if ( '' === $page || ! isset( $map[ $page ] ) || ! current_user_can( self::CAPABILITY ) ) {
			return;
		}
		wp_safe_redirect( self::url( $map[ $page ] ) );
		exit;
	}

	/**
	 * Eklentiler listesindeki "Ayarlar" bağlantısı.
	 *
	 * @param string[] $links Bağlantılar.
	 * @return string[]
	 */
	public function action_links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( self::url( self::SLUG_OVERVIEW ) ) . '">' . esc_html__( 'Settings', 'woo-donation-popup' ) . '</a>' );
		return $links;
	}

	/**
	 * Yönetici ekran adresi.
	 *
	 * @param string $slug Sayfa.
	 * @return string
	 */
	public static function url( $slug ) {
		return admin_url( 'admin.php?page=' . $slug );
	}

	/**
	 * Menü simgesi: kalp (base64 SVG; WordPress yönetici renk şemasıyla boyanır).
	 *
	 * @return string
	 */
	public static function menu_icon() {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="black" d="M12 21s-8-4.9-8-11.2A4.8 4.8 0 0 1 12 6.6 4.8 4.8 0 0 1 20 9.8C20 16.1 12 21 12 21z"/></svg>';
		return 'data:image/svg+xml;base64,' . base64_encode( $svg ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- WordPress menü simgesi biçimi.
	}

	/**
	 * Tek üst düzey menüyü ve alt sayfaları ekler (sihirbaz menüde görünmez).
	 *
	 * @return void
	 */
	public function register_menu() {
		$guide   = new Guide();
		$wizard  = new Setup_Wizard( $this->container->get( Settings::class ), $this->store() );
		$labels  = Field_Registry::pages();
		$pages   = $this->pages();
		$hooks   = array();
		$methods = self::page_methods();

		$hooks[] = add_menu_page(
			__( 'Donation Panel', 'woo-donation-popup' ),
			__( 'Donation Panel', 'woo-donation-popup' ),
			self::CAPABILITY,
			self::SLUG_OVERVIEW,
			array( $pages, $methods[ self::SLUG_OVERVIEW ] ),
			self::menu_icon(),
			56.5
		);

		foreach ( $labels as $slug => $label ) {
			$callback = self::SLUG_GUIDE === $slug ? array( $guide, 'render' ) : array( $pages, $methods[ $slug ] );
			$hook     = add_submenu_page(
				self::SLUG_OVERVIEW,
				$label . ' - ' . __( 'Donation Panel', 'woo-donation-popup' ),
				$label,
				self::CAPABILITY,
				$slug,
				$callback
			);
			if ( self::SLUG_GUIDE === $slug && is_string( $hook ) ) {
				add_action( 'load-' . $hook, array( $guide, 'add_help_tabs' ) );
			}
			$hooks[] = $hook;
		}

		// `options.php` üst öğesi: sayfa vardır ama menüde görünmez.
		$hooks[] = add_submenu_page(
			'options.php',
			__( 'Quick setup', 'woo-donation-popup' ),
			__( 'Quick setup', 'woo-donation-popup' ),
			self::CAPABILITY,
			self::SLUG_WIZARD,
			array( $wizard, 'render' )
		);

		foreach ( $hooks as $hook ) {
			$this->assets->own( $hook );
		}
	}
}

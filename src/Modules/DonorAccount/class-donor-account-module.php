<?php
/**
 * Bağışçı hesabı modülü (isteğe bağlı; varsayılan KAPALI).
 *
 * - Header simgesi: kısa kod `[donation_panel_account]` ve blok `donation-panel/account` (giriş penceresini açar).
 * - Giriş / kayıt / şifre sıfırlama: WordPress + WooCommerce işlevleriyle (REST; bkz. Account_Controller).
 * - Bağışlarım: WooCommerce Hesabım içinde yeni uç nokta (`my-donations`).
 * - Misafir bağışlarını e-posta doğrulamasıyla hesaba bağlama.
 * - Ödeme sayfası: WooCommerce'in kayıt kutusunun üstüne açıklama (kutuyu WooCommerce çizer).
 *
 * Ayar: `modules.donor_account` (kapalıyken bu dosya yüklenmez). Tema/oluşturucuya özel kod yok.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\DonorAccount;

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Interface;
use DonationPanel\Frontend\Assets;
use DonationPanel\Http\Rate_Limiter;

defined( 'ABSPATH' ) || exit;

/**
 * Donor_Account_Module.
 */
final class Donor_Account_Module implements Module_Interface {

	const SLUG      = 'donor_account';
	const SHORTCODE = 'donation_panel_account';
	const ENDPOINT  = 'my-donations';

	/**
	 * Bağımlılık kabı.
	 *
	 * @var Container|null
	 */
	private $container;

	/**
	 * Bu sayfada pencere gerekli mi.
	 *
	 * @var bool
	 */
	private $needs_dialog = false;

	/**
	 * Kancaları kaydeder.
	 *
	 * @param Container $container Bağımlılık kabı.
	 * @return void
	 */
	public function register( Container $container ) {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}
		$this->container = $container;
		$container->get( Assets::class )->define( self::SLUG, 'assets/build/donor-account/index.js', 'assets/build/donor-account/index.css' );

		add_action( 'init', array( $this, 'init' ) );
		add_action( 'wp_loaded', array( $this, 'maybe_flush_rewrite' ) );
		add_filter( 'donation_panel_rest_controllers', array( $this, 'add_rest_controller' ) );
		add_filter( 'woocommerce_get_query_vars', array( $this, 'add_query_var' ) );
		add_filter( 'woocommerce_account_menu_items', array( $this, 'add_menu_item' ) );
		add_filter( 'woocommerce_endpoint_' . self::endpoint() . '_title', array( $this, 'endpoint_title' ) );
		add_action( 'woocommerce_account_' . self::endpoint() . '_endpoint', array( $this, 'render_donations' ) );
		add_action( 'woocommerce_before_checkout_registration_form', array( $this, 'checkout_note' ) );
		add_action( 'wp_footer', array( $this, 'print_dialog' ), 5 );
	}

	/**
	 * Uç nokta adı (filtrelenebilir).
	 *
	 * @return string
	 */
	public static function endpoint() {
		/**
		 * Hesabım içindeki Bağışlarım uç noktasının adı.
		 *
		 * @param string $endpoint Varsayılan `my-donations`.
		 */
		$endpoint = sanitize_key( (string) apply_filters( 'donation_panel_account_endpoint', self::ENDPOINT ) );
		return '' !== $endpoint ? $endpoint : self::ENDPOINT;
	}

	/**
	 * Bağışlarım sayfası adresi.
	 *
	 * @return string
	 */
	public static function donations_url() {
		$account = function_exists( 'wc_get_page_permalink' ) ? (string) wc_get_page_permalink( 'myaccount' ) : '';
		return function_exists( 'wc_get_endpoint_url' ) ? (string) wc_get_endpoint_url( self::endpoint(), '', $account ) : $account;
	}

	/**
	 * Kısa kod ve bloğu kaydeder.
	 *
	 * @return void
	 */
	public function init() {
		add_shortcode( self::SHORTCODE, array( $this, 'render_trigger' ) );
		if ( function_exists( 'register_block_type' ) ) {
			register_block_type( __DIR__ . '/block', array( 'render_callback' => array( $this, 'render_trigger' ) ) );
		}
	}

	/**
	 * Uç nokta eklenince bağlantı kuralları bir kez yenilenir.
	 *
	 * @return void
	 */
	public function maybe_flush_rewrite() {
		// Ek sorgu yok: `rewrite_rules` zaten otomatik yüklenir; uç nokta kurallarda yoksa bir kez yenilenir.
		// Kural listesi boşsa (düz bağlantılar) yenilenecek bir şey yoktur.
		$rules = get_option( 'rewrite_rules' );
		if ( ! is_array( $rules ) || ! $rules ) {
			return;
		}
		foreach ( array_keys( $rules ) as $pattern ) {
			if ( false !== strpos( (string) $pattern, self::endpoint() ) ) {
				return;
			}
		}
		flush_rewrite_rules( false );
	}

	/**
	 * REST denetleyicisini listeye ekler.
	 *
	 * @param array<int, mixed> $controllers Denetleyiciler.
	 * @return array<int, mixed>
	 */
	public function add_rest_controller( $controllers ) {
		$controllers   = (array) $controllers;
		$controllers[] = new Account_Controller( $this->container->get( Rate_Limiter::class ) );
		return $controllers;
	}

	/**
	 * WooCommerce uç nokta listesine ekler.
	 *
	 * @param array<string, string> $vars Sorgu değişkenleri.
	 * @return array<string, string>
	 */
	public function add_query_var( $vars ) {
		$vars                     = (array) $vars;
		$vars[ self::endpoint() ] = self::endpoint();
		return $vars;
	}

	/**
	 * Hesabım menüsüne "Bağışlarım" ekler (Çıkış'tan önce).
	 *
	 * @param array<string, string> $items Menü.
	 * @return array<string, string>
	 */
	public function add_menu_item( $items ) {
		$items = (array) $items;
		$new   = array();
		$added = false;
		foreach ( $items as $key => $label ) {
			if ( 'customer-logout' === $key ) {
				$new[ self::endpoint() ] = __( 'My donations', 'woo-donation-popup' );
				$added                   = true;
			}
			$new[ $key ] = $label;
		}
		if ( ! $added ) {
			$new[ self::endpoint() ] = __( 'My donations', 'woo-donation-popup' );
		}
		return $new;
	}

	/**
	 * Uç nokta başlığı.
	 *
	 * @return string
	 */
	public function endpoint_title() {
		return __( 'My donations', 'woo-donation-popup' );
	}

	/**
	 * Varlıkları kuyruğa alır.
	 *
	 * @return void
	 */
	private function enqueue() {
		$assets = $this->container->get( Assets::class );
		if ( did_action( 'wp_enqueue_scripts' ) ) {
			$assets->enqueue( self::SLUG );
			return;
		}
		// Blok temalarında içerik, `wp_enqueue_scripts` çalışmadan ÖNCE çizilir: varlıklar kayıttan sonra kuyruğa alınır.
		add_action(
			'wp_enqueue_scripts',
			static function () use ( $assets ) {
				$assets->enqueue( self::SLUG );
			},
			20
		);
	}

	/**
	 * REST taban adresi.
	 *
	 * @return string
	 */
	private function rest_base() {
		return esc_url_raw( rest_url( 'donation-panel/v1/account' ) );
	}

	/**
	 * Kısa kod / blok çıktısı: header simgesi.
	 *
	 * @return string
	 */
	public function render_trigger() {
		$logged_in = is_user_logged_in();
		$this->enqueue();
		if ( ! $logged_in ) {
			$this->needs_dialog = true;
		}
		$account = function_exists( 'wc_get_page_permalink' ) ? (string) wc_get_page_permalink( 'myaccount' ) : '';
		return Account_Renderer::trigger( $logged_in, $account );
	}

	/**
	 * Giriş penceresini sayfa sonunda bir kez basar.
	 *
	 * @return void
	 */
	public function print_dialog() {
		static $printed = false;
		if ( $printed || ! $this->needs_dialog || is_user_logged_in() ) {
			return;
		}
		$printed = true;
		$html    = Account_Renderer::dialog(
			array(
				'rest'           => $this->rest_base(),
				'msg-login'      => __( 'Email or password is incorrect. Try again or reset your password.', 'woo-donation-popup' ),
				'msg-fail'       => __( 'Something went wrong. Please try again.', 'woo-donation-popup' ),
				'msg-rate'       => __( 'Too many attempts. Please wait a moment and try again.', 'woo-donation-popup' ),
				'msg-email'      => __( 'Enter a valid email address.', 'woo-donation-popup' ),
				'msg-pass'       => __( 'Password must be at least 8 characters.', 'woo-donation-popup' ),
				'title-login'    => __( 'Welcome', 'woo-donation-popup' ),
				'lead-login'     => __( 'Log in to see your donations, receipts and videos in one place.', 'woo-donation-popup' ),
				'lead-register'  => __( 'Make your next gift even quicker.', 'woo-donation-popup' ),
				'lead-reset'     => __( 'Enter your email and we will send a link.', 'woo-donation-popup' ),
				'title-register' => __( 'Create an account', 'woo-donation-popup' ),
				'title-reset'    => __( 'Reset password', 'woo-donation-popup' ),
				'title-sent'     => __( 'Check your email', 'woo-donation-popup' ),
			),
			Account_Controller::registration_enabled()
		);
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Account_Renderer tüm değerleri kaçışlar.
	}

	/**
	 * Bağışlarım uç noktası içeriği.
	 *
	 * @return void
	 */
	public function render_donations() {
		$this->enqueue();
		$page = Donation_History::page( get_current_user_id(), 1, 10 );
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- belirteç okuma; onay POST + nonce ile yapılır.
		$token   = isset( $_GET['dp_link_guest'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['dp_link_guest'] ) ) : '';
		$link_ui = Account_Renderer::link_section( '' !== $token ? 'confirm' : 'request', $token );
		$html    = Account_Renderer::donations_page(
			$page['rows'],
			$page['pages'],
			array(
				'rest'     => $this->rest_base(),
				'checkout' => function_exists( 'wc_get_checkout_url' ) ? esc_url_raw( wc_get_checkout_url() ) : '',
				'msg-fail' => __( 'Something went wrong. Please try again.', 'woo-donation-popup' ),
				'msg-sent' => __( 'We sent a verification link to your account email.', 'woo-donation-popup' ),
				'msg-rate' => __( 'Too many attempts. Please wait a moment and try again.', 'woo-donation-popup' ),
				'msg-bad'  => __( 'This link is invalid or has expired. Request a new one.', 'woo-donation-popup' ),
				'msg-done' => __( 'Your earlier gifts were added to your account.', 'woo-donation-popup' ),
				'msg-none' => __( 'No earlier guest gifts were found for this email.', 'woo-donation-popup' ),
			),
			$link_ui,
			$this->summary_header()
		);
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Account_Renderer tüm değerleri kaçışlar.
	}

	/**
	 * Bağışlarım üst paneli verisi (ad, baş harfler, toplam / bağış sayısı / bu yıl).
	 *
	 * @return array<string, string>
	 */
	private function summary_header() {
		$user = wp_get_current_user();
		if ( ! $user || ! $user->exists() ) {
			return array();
		}
		$name = trim( (string) $user->display_name );
		$name = '' !== $name ? $name : trim( (string) $user->user_login );
		if ( '' === $name ) {
			return array();
		}
		$words    = preg_split( '/\s+/u', $name );
		$initials = '';
		foreach ( array_slice( is_array( $words ) ? $words : array(), 0, 2 ) as $word ) {
			$initials .= function_exists( 'mb_substr' ) ? mb_strtoupper( mb_substr( $word, 0, 1 ) ) : strtoupper( substr( $word, 0, 1 ) );
		}
		$stats = Donation_History::summary( (int) $user->ID );
		$money = static function ( $amount ) {
			return function_exists( 'wc_price' ) ? (string) wc_price( (float) $amount ) : (string) $amount;
		};
		return array(
			'name'       => $name,
			'initials'   => $initials,
			'total_html' => $money( $stats['total'] ),
			'count'      => number_format_i18n( (int) $stats['count'] ),
			'year_html'  => $money( $stats['year'] ),
		);
	}

	/**
	 * Ödeme sayfası kayıt kutusunun üstüne açıklama.
	 *
	 * @return void
	 */
	public function checkout_note() {
		$this->enqueue();
		echo Account_Renderer::checkout_note(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Account_Renderer kaçışlar.
	}
}

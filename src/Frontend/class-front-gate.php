<?php
/**
 * Ön yüz kapısı: `DONATION_PANEL_DISABLE` sabiti ya da `general.disable_frontend` ayarı açıkken bağışçı yüzeyleri
 * (kısa kod, blok, otomatik yerleşim, varlık kuyruğu, çekmeceler) çıktı VERMEZ. Yönetici ekranı ve REST etkilenmez;
 * sepet/sipariş kancaları çalışmaya devam eder (sepetteki bağış kaybolmaz).
 *
 * Kısa kodlar kaydedilmiş kalır ve boş döner: sayfa içeriğinde ham `[kısa_kod]` metni görünmez.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Frontend;

defined( 'ABSPATH' ) || exit;

/**
 * Front_Gate.
 */
class Front_Gate {

	/**
	 * Dışa açık kısa kod adları (çıktısı kapıdayken boş döner).
	 *
	 * @var string[]
	 */
	const SHORTCODES = array(
		'wdp_donation_button',
		'wdp_donation_button_panel',
		'wdp_donation_form',
		'wdp_donations',
		'donation_panel_experience',
		'donation_panel_progress',
		'donation_panel_social_proof',
		'donation_panel_side_cart',
		'donation_panel_account',
	);

	/**
	 * Ön yüz kapalı mı (sabit ya da ayar; `donation_panel_front_disabled` filtresiyle de değiştirilebilir).
	 *
	 * @return bool
	 */
	public static function disabled() {
		$off = defined( 'DONATION_PANEL_DISABLE' ) && DONATION_PANEL_DISABLE;
		if ( ! $off && function_exists( 'get_option' ) ) {
			$stored = get_option( \DonationPanel\Core\Settings::OPTION_NAME, array() );
			$off    = is_array( $stored ) && ! empty( $stored['general']['disable_frontend'] );
		}
		/**
		 * Ön yüzü kapatır ya da açar.
		 *
		 * @param bool $off Kapalı mı.
		 */
		return (bool) apply_filters( 'donation_panel_front_disabled', $off );
	}

	/**
	 * Bu istek ön yüz isteği mi (yönetici, REST, cron, WP-CLI değil) VE ön yüz kapalı mı.
	 * `plugins_loaded` aşamasında çağrılabilir: REST yalnız adres örüntüsünden anlaşılır.
	 *
	 * @return bool
	 */
	public static function front_request_disabled() {
		if ( is_admin() || ( function_exists( 'wp_doing_cron' ) && wp_doing_cron() ) || ( defined( 'WP_CLI' ) && WP_CLI ) ) {
			return false;
		}
		$uri        = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- yalnız alt dize karşılaştırması.
		$rest_route = isset( $_GET['rest_route'] ) ? (string) wp_unslash( $_GET['rest_route'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended,WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- yalnız alt dize karşılaştırması.
		$prefix     = function_exists( 'rest_get_url_prefix' ) ? rest_get_url_prefix() : 'wp-json';
		if ( '' !== $rest_route || self::is_rest_path( $uri, $prefix ) ) {
			return false;
		}
		return self::disabled();
	}

	/**
	 * İstek yolu REST önekiyle (site yolundan sonra, yolun BAŞINDA) başlıyor mu. Sayfa yolunun ortasındaki `/wp-json/`
	 * (ör. kullanıcı içeriği `/blog/wp-json/x`) kapıyı atlatmaz.
	 *
	 * @param string $uri    REQUEST_URI.
	 * @param string $prefix REST öneki (`wp-json`).
	 * @return bool
	 */
	private static function is_rest_path( $uri, $prefix ) {
		$path  = (string) wp_parse_url( $uri, PHP_URL_PATH );
		$bases = array();
		foreach ( array( home_url(), site_url() ) as $url ) {
			$bases[] = rtrim( (string) wp_parse_url( $url, PHP_URL_PATH ), '/' );
		}
		foreach ( array_unique( $bases ) as $base ) {
			if ( 0 === strpos( $path, $base . '/' . $prefix . '/' ) || 0 === strpos( $path, $base . '/index.php/' . $prefix . '/' ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Kapıdayken dışa açık kısa kodları boş döndürür (ham metin görünmesin).
	 *
	 * @return void
	 */
	public static function register_silent_shortcodes() {
		foreach ( self::SHORTCODES as $tag ) {
			add_shortcode( $tag, '__return_empty_string' );
		}
	}
}

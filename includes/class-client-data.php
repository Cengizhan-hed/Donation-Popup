<?php
/**
 * Ön yüz istemci verisinin (telefon ülke listesi + çeviri sözlüğü) sayfa HTML'inden çıkarılması.
 *
 * Ürün/mağaza sayfasına ~28 KB'lık `wdp_ajax` verisi gömülmez; küçük çekirdek (`wdp_ajax`) satır içi
 * kalır, ülke listesi ve sözlük ayrı, önbelleğe alınabilir bir betik olarak (paketle aynı ertelenmiş
 * yoldan) gelir ve `window.wdp_ajax` nesnesine eklenir. Paket yüklenmeden önce çalışır (bağımlılık sırası),
 * yani ön yüz tarafında eşzamanlı okuma sözleşmesi aynı kalır. Kapatma: `wdp_split_client_data` süzgeci.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class WDP_Client_Data
 */
class WDP_Client_Data {

	/** Betik tutamacı. */
	const HANDLE = 'wdp-client-data-js';

	/** Sorgu değişkeni (değer: yerel ayar kodu). */
	const QUERY_VAR = 'wdp_client_data';

	/**
	 * @return void
	 */
	public static function init() {
		add_action( 'init', array( __CLASS__, 'maybe_serve' ), 99 );
	}

	/**
	 * Bölme etkin mi (varsayılan evet).
	 *
	 * @return bool
	 */
	public static function is_enabled() {
		/**
		 * Telefon ülke listesi ve çeviri sözlüğünü sayfa HTML'inden ayrı betiğe taşır (varsayılan açık).
		 *
		 * @param bool $split Böl.
		 */
		return (bool) apply_filters( 'wdp_split_client_data', true ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- wdp_ öneki eklentiye ait.
	}

	/**
	 * Verilen yerel ayar için betik adresi (önbellek anahtarı: yerel ayar + eklenti sürümü + çeviri dosyası zamanı).
	 *
	 * @return string
	 */
	public static function url() {
		$locale = (string) get_locale();
		return add_query_arg(
			array(
				self::QUERY_VAR => $locale,
				'ver'           => self::version_key( $locale ),
			),
			home_url( '/' )
		);
	}

	/**
	 * Önbellek sürümü: eklenti sürümü + çeviri dosyalarının değişim zamanı.
	 *
	 * @param string $locale Yerel ayar.
	 * @return string
	 */
	private static function version_key( $locale ) {
		$stamp = '';
		$files = array(
			WDP_PLUGIN_DIR . 'languages/woo-donation-popup-' . $locale . '.mo',
			WP_LANG_DIR . '/plugins/woo-donation-popup-' . $locale . '.mo',
		);
		foreach ( $files as $file ) {
			if ( is_readable( $file ) ) {
				$stamp .= (string) filemtime( $file );
			}
		}
		return WDP_VERSION . '-' . substr( md5( $locale . $stamp ), 0, 8 );
	}

	/**
	 * Betik gövdesi: `window.wdp_ajax` nesnesine ülke listesi ve sözlük ekler.
	 *
	 * @return string
	 */
	public static function build_script() {
		$countries = class_exists( 'WDP_Phone_Field' ) ? WDP_Phone_Field::get_countries_for_js() : array();
		$dict      = class_exists( 'WDP_Js_I18n' ) ? WDP_Js_I18n::dictionary() : array();
		return '(function(w){var a=w.wdp_ajax=w.wdp_ajax||{};a.phone=a.phone||{};a.phone.countries=' . wp_json_encode( $countries ) . ';a.i18n_dict=' . wp_json_encode( (object) $dict ) . ';})(window);';
	}

	/**
	 * `?wdp_client_data=<yerel ayar>` isteğini yanıtlar (herkese açık, salt okunur, kişi verisi yok).
	 *
	 * @return void
	 */
	public static function maybe_serve() {
		if ( ! isset( $_GET[ self::QUERY_VAR ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- herkese açık, salt okunur, önbelleğe alınabilir yanıt.
			return;
		}
		$locale = sanitize_text_field( wp_unslash( (string) $_GET[ self::QUERY_VAR ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! preg_match( '/^[a-z]{2,3}(?:_[A-Z]{2})?(?:_[a-z0-9]+)?$/', $locale ) ) {
			status_header( 400 );
			exit;
		}
		$switched = false;
		if ( get_locale() !== $locale && function_exists( 'switch_to_locale' ) ) {
			$switched = switch_to_locale( $locale );
		}
		$body = self::build_script();
		if ( $switched && function_exists( 'restore_previous_locale' ) ) {
			restore_previous_locale();
		}
		status_header( 200 );
		header( 'Content-Type: application/javascript; charset=utf-8' );
		header( 'X-Content-Type-Options: nosniff' );
		header( 'Cache-Control: public, max-age=86400' );
		echo $body; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- wp_json_encode çıktısından oluşan betik.
		exit;
	}
}

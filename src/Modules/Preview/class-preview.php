<?php
/**
 * Önizleme: `?dp_preview=1` ile, yalnız oturumu açık ve `manage_woocommerce` yetkili kullanıcı için, ilgili modül
 * ayardan kapalı olsa bile tüm modülleri o istek için görünür kılar (yeni form, kampanya kartı, etki ifadeleri,
 * sosyal kanıt, yan sepet, bağışçı hesabı, teşekkür ekranı, vergi indirimi beyanı).
 *
 * - Salt okunur görünüm: ayar YAZILMAZ; yalnız o istek için bellekte açılır (`Settings::set_preview`).
 * - Diğer herkes için etkisizdir; önbellek dostu: önizleme yanıtına no-cache başlıkları ve `DONOTCACHEPAGE` eklenir.
 * - Bu dosya yalnız istekte `dp_preview` varken yüklenir (bkz. `Bootstrap::run`).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Preview;

use DonationPanel\Core\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Preview.
 */
final class Preview {

	/**
	 * Sorgu parametresi.
	 */
	const QUERY_ARG = 'dp_preview';

	/**
	 * Gereken yetki.
	 */
	const CAPABILITY = 'manage_woocommerce';

	/**
	 * İstek önizleme istiyor mu (yalnız `dp_preview=1`; salt okunur, nonce gerekmez).
	 *
	 * @return bool
	 */
	public static function is_requested() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- salt okunur görünüm; yetki ayrıca denetlenir.
		return isset( $_GET[ self::QUERY_ARG ] ) && '1' === sanitize_text_field( wp_unslash( $_GET[ self::QUERY_ARG ] ) );
	}

	/**
	 * Kancayı bağlar (modül kaydından önce, `plugins_loaded` 1).
	 *
	 * @return void
	 */
	public static function init() {
		if ( ! self::is_requested() ) {
			return;
		}
		add_action(
			'plugins_loaded',
			static function () {
				self::activate();
			},
			1
		);
	}

	/**
	 * Oturum ve yetki uygunsa önizlemeyi bu istek için açar.
	 *
	 * @return bool Açıldıysa true.
	 */
	public static function activate() {
		if ( ! self::is_requested() || ! is_user_logged_in() || ! current_user_can( self::CAPABILITY ) ) {
			return false;
		}

		Settings::set_preview( true );

		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- önbellek eklentilerinin standart sabiti.
		}
		add_action( 'send_headers', 'nocache_headers' );
		add_action( 'admin_bar_menu', array( __CLASS__, 'admin_bar_node' ), 100 );
		return true;
	}

	/**
	 * Yönetici çubuğuna "Önizlemeyi kapat" bağlantısı (yalnız önizleme açıkken).
	 *
	 * @param \WP_Admin_Bar $bar Yönetici çubuğu.
	 * @return void
	 */
	public static function admin_bar_node( $bar ) {
		if ( ! is_object( $bar ) || ! method_exists( $bar, 'add_node' ) ) {
			return;
		}
		$bar->add_node(
			array(
				'id'    => 'donation-panel-preview',
				'title' => esc_html__( 'Donation Panel preview: exit', 'woo-donation-popup' ),
				'href'  => esc_url( remove_query_arg( self::QUERY_ARG ) ),
			)
		);
	}

	/**
	 * Verilen adres için önizleme bağlantısı (yönetici için; ayar ekranı bu biçimi kullanabilir).
	 *
	 * @param string $url Sayfa adresi.
	 * @return string
	 */
	public static function link_for( $url ) {
		return add_query_arg( self::QUERY_ARG, '1', (string) $url );
	}
}

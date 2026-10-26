<?php
/**
 * Eski ve yeni yönetici ekranı arasında geçiş (E8Q): bilgi kutusu, nonce'lu POST işlemi, eklentiler listesi bağlantısı.
 * `admin.ui` değerinden bağımsız her yönetim isteğinde yüklenir; yalnız `admin.ui` yazar (başka ayar değişmez).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

use DonationPanel\Core\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Ui_Switch.
 */
final class Ui_Switch {

	const CAPABILITY      = 'manage_woocommerce';
	const ACTION_SWITCH   = 'donation_panel_switch_ui';
	const ACTION_DISMISS  = 'donation_panel_dismiss_ui_notice';
	const NONCE_SWITCH    = 'donation_panel_switch_ui';
	const NONCE_DISMISS   = 'donation_panel_dismiss_ui_notice';
	const USER_META       = 'donation_panel_ui_notice_dismissed';
	const SLUG_NEW        = 'donation-panel';
	const SLUG_LEGACY     = 'wdp-popup-settings';
	const PLUGIN_BASENAME = 'woo-donation-popup/woo-donation-popup.php';

	/**
	 * Kancaları bağlar (yalnız yönetim alanında çağrılır).
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'admin_post_' . self::ACTION_SWITCH, array( __CLASS__, 'handle_switch' ) );
		add_action( 'admin_post_' . self::ACTION_DISMISS, array( __CLASS__, 'handle_dismiss' ) );
		add_filter( 'plugin_action_links_' . self::PLUGIN_BASENAME, array( __CLASS__, 'action_links' ) );
	}

	/**
	 * Hedef ekranın yönetim adresi.
	 *
	 * @param string $ui `new` ya da `legacy`.
	 * @return string
	 */
	public static function screen_url( $ui ) {
		return admin_url( 'admin.php?page=' . ( 'new' === $ui ? self::SLUG_NEW : self::SLUG_LEGACY ) );
	}

	/**
	 * Eklentiler listesi: "Settings" bağlantısı etkin ekrana gider.
	 *
	 * @param array<int|string, string> $links Mevcut bağlantılar.
	 * @return array<int|string, string>
	 */
	public static function action_links( $links ) {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			return $links;
		}
		$ui   = Settings::admin_ui_is_new() ? 'new' : 'legacy';
		$link = '<a href="' . esc_url( self::screen_url( $ui ) ) . '">' . esc_html__( 'Settings', 'woo-donation-popup' ) . '</a>';
		return array_merge( array( 'settings' => $link ), is_array( $links ) ? $links : array() );
	}

	/**
	 * Yalnız `admin.ui` yazar (aynı değerse hiçbir şey yazmaz). Yetki/nonce çağıranda denetlenir.
	 *
	 * @param string $ui `new` ya da `legacy`.
	 * @return string Geçerli seçim (`new`/`legacy`); bilinmeyen değerde mevcut durum.
	 */
	public static function apply( $ui ) {
		$ui = sanitize_key( (string) $ui );
		if ( ! in_array( $ui, Settings::ADMIN_UIS, true ) ) {
			return Settings::admin_ui_is_new() ? 'new' : 'legacy';
		}
		$settings = new Settings();
		if ( (string) $settings->get( 'admin.ui', 'legacy' ) !== $ui ) {
			$settings->update( array( 'admin' => array( 'ui' => $ui ) ) );
		}
		return $ui;
	}

	/**
	 * Ekran değiştirme POST'u: yetki + nonce, `admin.ui` yazar, seçilen ekrana yönlendirir.
	 *
	 * @return void
	 */
	public static function handle_switch() {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'woo-donation-popup' ), '', array( 'response' => 403 ) );
		}
		check_admin_referer( self::NONCE_SWITCH );

		$ui = isset( $_POST['ui'] ) ? sanitize_key( wp_unslash( $_POST['ui'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- check_admin_referer yukarıda.
		$ui = self::apply( $ui );

		wp_safe_redirect( self::screen_url( $ui ) );
		exit;
	}

	/**
	 * Kutuyu bu kullanıcı için kapatır (kullanıcı başına bir kez).
	 *
	 * @param int $user_id Kullanıcı.
	 * @return void
	 */
	public static function dismiss( $user_id ) {
		if ( (int) $user_id > 0 ) {
			update_user_meta( (int) $user_id, self::USER_META, '1' );
		}
	}

	/**
	 * Kapatma POST'u: yetki + nonce, kullanıcı meta'sı, eski ekrana dönüş.
	 *
	 * @return void
	 */
	public static function handle_dismiss() {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'woo-donation-popup' ), '', array( 'response' => 403 ) );
		}
		check_admin_referer( self::NONCE_DISMISS );
		self::dismiss( get_current_user_id() );
		wp_safe_redirect( self::screen_url( 'legacy' ) );
		exit;
	}

	/**
	 * Eski ekranda kutu gösterilmeli mi.
	 *
	 * @param int $user_id Kullanıcı.
	 * @return bool
	 */
	public static function should_show_notice( $user_id ) {
		return current_user_can( self::CAPABILITY )
			&& ! Settings::admin_ui_is_new()
			&& '1' !== (string) get_user_meta( (int) $user_id, self::USER_META, true );
	}

	/**
	 * Eski ayar ekranının üstündeki bilgi kutusu (WordPress'in `notice` stiliyle).
	 *
	 * @return void
	 */
	public static function render_legacy_notice() {
		if ( ! self::should_show_notice( get_current_user_id() ) ) {
			return;
		}
		$action = esc_url( admin_url( 'admin-post.php' ) );

		echo '<div class="notice notice-info inline wdp-ui-switch" role="region" aria-label="' . esc_attr__( 'New Donation Panel experience', 'woo-donation-popup' ) . '">';
		echo '<p><strong>' . esc_html__( 'The new Donation Panel experience is ready', 'woo-donation-popup' ) . '</strong></p>';
		echo '<p>' . esc_html__( 'Try the new simple admin screen. Your settings and orders are kept, and you can switch back to this classic screen at any time.', 'woo-donation-popup' ) . '</p>';
		echo '<div>';
		echo '<form method="post" action="' . $action . '" style="display:inline">'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- $action kaçışlı.
		echo '<input type="hidden" name="action" value="' . esc_attr( self::ACTION_SWITCH ) . '">';
		echo '<input type="hidden" name="ui" value="new">';
		echo '<input type="hidden" name="_wpnonce" value="' . esc_attr( wp_create_nonce( self::NONCE_SWITCH ) ) . '">';
		echo '<button type="submit" class="button button-primary">' . esc_html__( 'Open the new admin screen', 'woo-donation-popup' ) . '</button>';
		echo '</form> ';
		echo '<form method="post" action="' . $action . '" style="display:inline">'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- $action kaçışlı.
		echo '<input type="hidden" name="action" value="' . esc_attr( self::ACTION_DISMISS ) . '">';
		echo '<input type="hidden" name="_wpnonce" value="' . esc_attr( wp_create_nonce( self::NONCE_DISMISS ) ) . '">';
		echo '<button type="submit" class="button">' . esc_html__( 'Dismiss', 'woo-donation-popup' ) . '</button>';
		echo '</form>';
		echo '</div></div>';
	}

	/**
	 * Yeni ekranın üstündeki "klasik ekrana dön" kutusu (POST + nonce).
	 *
	 * @return string Kaçışlı HTML.
	 */
	public static function render_back_to_classic() {
		$html  = '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="dpa-inline dpa-switch-back">';
		$html .= '<input type="hidden" name="action" value="' . esc_attr( self::ACTION_SWITCH ) . '">';
		$html .= '<input type="hidden" name="ui" value="legacy">';
		$html .= '<input type="hidden" name="_wpnonce" value="' . esc_attr( wp_create_nonce( self::NONCE_SWITCH ) ) . '">';
		$html .= '<button type="submit" class="button" id="dpa-back-classic">' . esc_html__( 'Back to the classic screen', 'woo-donation-popup' ) . '</button> ';
		$html .= '<span class="dpa-row__help">' . esc_html__( 'The classic screen keeps all your settings and will be removed in 12.0.', 'woo-donation-popup' ) . '</span>';
		$html .= '</form>';
		return $html;
	}
}

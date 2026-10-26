<?php
/**
 * Gizlilik araçları: hesap verisi için WordPress dışa aktarma/silme, gizlilik politikası önerisi, eski çerez temizliği.
 *
 * Sipariş kalemi verisi (ithaf, bağışçı/hissedar alanları) eski `WDP_Privacy` sınıfında kalır (aynı kayıtçı hedefleri).
 * Bu sınıf modül ayarından bağımsız HER ZAMAN yüklenir; yalnız ilgili isteklerde iş yapar.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Privacy;

use DonationPanel\Modules\DonorAccount\Guest_Link_Token;

defined( 'ABSPATH' ) || exit;

/**
 * Privacy_Tools.
 */
final class Privacy_Tools {

	/**
	 * Kaldırılmış ziyaretçi çerezinin adı (yalnız eski çerezi silmek için).
	 */
	const LEGACY_COOKIE = 'wdp_vid';

	/**
	 * Kancaları bağlar (tekrar çağrı çift kayıt üretmez).
	 *
	 * @return void
	 */
	public static function init() {
		static $done = false;
		if ( $done ) {
			return;
		}
		$done = true;

		add_filter( 'wp_privacy_personal_data_exporters', array( __CLASS__, 'register_exporter' ), 11 );
		add_filter( 'wp_privacy_personal_data_erasers', array( __CLASS__, 'register_eraser' ), 6 );
		add_action( 'admin_init', array( __CLASS__, 'add_policy_content' ) );
		add_action( 'init', array( __CLASS__, 'expire_legacy_cookie' ), 1 );
	}

	/**
	 * Dışa aktarıcı kaydı.
	 *
	 * @param array<string, mixed> $exporters Kayıtlı dışa aktarıcılar.
	 * @return array<string, mixed>
	 */
	public static function register_exporter( $exporters ) {
		$exporters['donation-panel-account'] = array(
			'exporter_friendly_name' => __( 'Donor account link data', 'woo-donation-popup' ),
			'callback'               => array( __CLASS__, 'export_account_data' ),
		);
		return $exporters;
	}

	/**
	 * Silici kaydı.
	 *
	 * @param array<string, mixed> $erasers Kayıtlı silciler.
	 * @return array<string, mixed>
	 */
	public static function register_eraser( $erasers ) {
		$erasers['donation-panel-account'] = array(
			'eraser_friendly_name' => __( 'Donor account link data', 'woo-donation-popup' ),
			'callback'             => array( __CLASS__, 'erase_account_data' ),
		);
		return $erasers;
	}

	/**
	 * E-postaya ait kullanıcının bekleyen "misafir bağışlarını bağla" kaydı (karma dışa aktarılmaz).
	 *
	 * @param string $email_address İstek sahibi e-postası.
	 * @param int    $page          Sayfa (tek sayfa).
	 * @return array{data: array<int, array<string, mixed>>, done: bool}
	 */
	public static function export_account_data( $email_address, $page = 1 ) {
		unset( $page );
		$out    = array(
			'data' => array(),
			'done' => true,
		);
		$record = self::guest_link_record( $email_address );
		if ( null === $record ) {
			return $out;
		}

		$out['data'][] = array(
			'group_id'          => 'donation-panel-account',
			'group_label'       => __( 'Donor account link', 'woo-donation-popup' ),
			'group_description' => __( 'A pending request to link earlier guest donations to your account.', 'woo-donation-popup' ),
			'item_id'           => 'donation-panel-guest-link-' . (int) $record['user_id'],
			'data'              => array(
				array(
					'name'  => __( 'E-mail to confirm', 'woo-donation-popup' ),
					'value' => (string) $record['email'],
				),
				array(
					'name'  => __( 'Link expires', 'woo-donation-popup' ),
					'value' => gmdate( 'Y-m-d H:i:s', (int) $record['expires'] ) . ' UTC',
				),
			),
		);
		return $out;
	}

	/**
	 * Bekleyen bağlama kaydını tamamen siler.
	 *
	 * @param string $email_address İstek sahibi e-postası.
	 * @param int    $page          Sayfa (tek sayfa).
	 * @return array{items_removed: bool, items_retained: bool, messages: array<int, string>, done: bool}
	 */
	public static function erase_account_data( $email_address, $page = 1 ) {
		unset( $page );
		$response = array(
			'items_removed'  => false,
			'items_retained' => false,
			'messages'       => array(),
			'done'           => true,
		);
		$record   = self::guest_link_record( $email_address );
		if ( null === $record ) {
			return $response;
		}
		delete_user_meta( (int) $record['user_id'], Guest_Link_Token::META );
		$response['items_removed'] = true;
		return $response;
	}

	/**
	 * Kullanıcının saklanan bağlama kaydı (süresi dolmuş olsa da; silme için).
	 *
	 * @param string $email_address E-posta.
	 * @return array{user_id: int, email: string, expires: int}|null
	 */
	private static function guest_link_record( $email_address ) {
		$email = sanitize_email( (string) $email_address );
		if ( '' === $email || ! is_email( $email ) || ! function_exists( 'get_user_by' ) ) {
			return null;
		}
		$user = get_user_by( 'email', $email );
		if ( ! $user || empty( $user->ID ) ) {
			return null;
		}
		$record = get_user_meta( (int) $user->ID, Guest_Link_Token::META, true );
		if ( ! is_array( $record ) || empty( $record ) ) {
			return null;
		}
		return array(
			'user_id' => (int) $user->ID,
			'email'   => isset( $record['email'] ) ? (string) $record['email'] : '',
			'expires' => isset( $record['expires'] ) ? (int) $record['expires'] : 0,
		);
	}

	/**
	 * WordPress "Gizlilik Politikası Kılavuzu"na yalnız öneri metni ekler (sayfa/politika yazmaz).
	 *
	 * @return void
	 */
	public static function add_policy_content() {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}
		wp_add_privacy_policy_content(
			__( 'Donation Panel for WooCommerce', 'woo-donation-popup' ),
			wp_kses_post( self::policy_text() )
		);
	}

	/**
	 * Öneri metni (HTML, çevrilebilir, kısa).
	 *
	 * @return string
	 */
	public static function policy_text() {
		$html  = '<p class="privacy-policy-tutorial">' . esc_html__( 'Suggested text. Review it and adapt it to how your site uses the plugin.', 'woo-donation-popup' ) . '</p>';
		$html .= '<h2>' . esc_html__( 'Donations', 'woo-donation-popup' ) . '</h2>';
		$html .= '<p>' . esc_html__( 'When you donate, we store the details you enter on the donation form with the order: your name, e-mail and phone number, an optional dedication or note, the names and contact details of any shareholders you enter, and whether you asked to stay anonymous. This data is kept on the order for as long as the order itself is kept (accounting and legal obligations).', 'woo-donation-popup' ) . '</p>';
		$html .= '<h2>' . esc_html__( 'Donor account', 'woo-donation-popup' ) . '</h2>';
		$html .= '<p>' . esc_html__( 'If the donor account is enabled and you ask to link earlier guest donations, a short-lived confirmation request is stored with your user profile and is deleted as soon as it is used or expires.', 'woo-donation-popup' ) . '</p>';
		$html .= '<h2>' . esc_html__( 'Cookies and tracking', 'woo-donation-popup' ) . '</h2>';
		$html .= '<p>' . esc_html__( 'The plugin does not set its own cookies and does not use tracking or advertising services. Cart and checkout cookies are set by WooCommerce. Request limits use a one-way hash of the visitor address and are kept for a few minutes.', 'woo-donation-popup' ) . '</p>';
		return $html;
	}

	/**
	 * Kaldırılan `wdp_vid` çerezini tarayıcıda siler ve istek içinde yok sayar (idempotent; çerez yoksa hiçbir şey yapmaz).
	 *
	 * @return void
	 */
	public static function expire_legacy_cookie() {
		if ( ! isset( $_COOKIE[ self::LEGACY_COOKIE ] ) ) {
			return;
		}
		unset( $_COOKIE[ self::LEGACY_COOKIE ] );
		if ( ( defined( 'WDP_UNIT_TEST' ) && WDP_UNIT_TEST ) || headers_sent() ) {
			return;
		}
		$path   = ( defined( 'COOKIEPATH' ) && '' !== COOKIEPATH ) ? COOKIEPATH : '/';
		$secure = function_exists( 'is_ssl' ) ? (bool) is_ssl() : false;
		setcookie(
			self::LEGACY_COOKIE,
			'',
			array(
				'expires'  => time() - DAY_IN_SECONDS,
				'path'     => $path,
				'secure'   => $secure,
				'httponly' => true,
				'samesite' => 'Lax',
			)
		);
	}
}

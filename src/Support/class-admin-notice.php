<?php
/**
 * Yalnız yönetim alanında/oluşturucu önizlemesinde görünen küçük uyarı.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Support;

use DonationPanel\Modules\EntryPoints\Builder_Detect;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Admin_Notice
 */
class Admin_Notice {

	/**
	 * Notice shown only to shop editors in place of a form that cannot be displayed.
	 *
	 * Visitors always get an empty string, so a misconfigured shortcode never shows them an error.
	 *
	 * @param string $message Plain-text message.
	 * @return string Safe HTML (or '').
	 */
	public static function admin_notice_html( $message ) {
		if ( ! self::notes_visible() ) {
			return '';
		}
		$message = trim( (string) $message );
		if ( '' === $message ) {
			return '';
		}
		return self::style_tag() . '<div class="wdp-admin-notice" role="note">' . esc_html( $message ) . '</div>';
	}

	/**
	 * Mağaza yöneticisine (`manage_woocommerce`) ipucu; ziyaretçiye her zaman boş döner. Ön yüzde YALNIZ editör
	 * önizlemesinde görünür (CLAUDE.md §25: yönetici notları canlı sayfada ne ziyaretçiye ne yöneticiye görünür).
	 *
	 * Kısa kod/blok yanlış yapılandırıldığında (ör. bağış kapsamı dışı ürün) yönetici nedenini editörde görsün,
	 * ziyaretçi hata görmesin diye kullanılır.
	 *
	 * @param string $message Düz metin ileti.
	 * @return string Güvenli HTML (ya da '').
	 */
	public static function manager_notice_html( $message ) {
		$message = trim( (string) $message );
		if ( '' === $message || ! function_exists( 'current_user_can' ) || ! current_user_can( 'manage_woocommerce' ) || ! self::notes_visible() ) {
			return '';
		}
		return self::style_tag() . '<div class="wdp-admin-notice" role="note">' . esc_html( $message ) . '</div>';
	}

	/**
	 * Notlar bu istekte görünür mü: editör önizlemesi (blok editörü sunucu çizimi, WP önizlemesi/Özelleştirici,
	 * ince uyumluluk katmanının işaretlediği oluşturucu editörü) ya da yönetim ekranı (AJAX değil).
	 *
	 * @return bool
	 */
	private static function notes_visible() {
		$in_admin = function_exists( 'is_admin' ) && is_admin()
			&& ! ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() );
		return $in_admin || Builder_Detect::is_editor_preview();
	}

	/**
	 * Notun küçük stili: notun hemen önünde satır içi, istek başına bir kez (stilsiz kare yok, CLAUDE.md §25).
	 *
	 * @return string
	 */
	private static function style_tag() {
		static $done = false;
		if ( $done ) {
			return '';
		}
		$done = true;
		return '<style id="donation-panel-inline-notice">.wdp-admin-notice{box-sizing:border-box;margin:12px 0;padding:10px 14px;border:1px solid #f0b849;border-left-width:4px;border-radius:4px;background:#fcf9e8;color:#1e1e1e;font-size:14px;line-height:1.5}</style>';
	}
}

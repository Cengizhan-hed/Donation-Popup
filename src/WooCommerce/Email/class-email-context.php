<?php
/**
 * E-posta bağlamı: yalnız bir WooCommerce e-postası çizilirken doludur (sızıntı yok).
 *
 * Başlangıç `woocommerce_email_header` (e-posta nesnesinden müşteri/yönetici), düzeltme `woocommerce_email_before_order_table`
 * (`$sent_to_admin`), bitiş `woocommerce_email_footer`. Sipariş ekranı ve ön yüz bu durumdan etkilenmez.
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce\Email;

defined( 'ABSPATH' ) || exit;

/**
 * Email_Context.
 */
final class Email_Context {

	const CUSTOMER = 'customer';
	const ADMIN    = 'admin';

	/**
	 * Geçerli mod ('' = e-posta dışı).
	 *
	 * @var string
	 */
	private static $mode = '';

	/**
	 * Geçerli mod.
	 *
	 * @return string '', 'customer' veya 'admin'.
	 */
	public static function mode() {
		return self::$mode;
	}

	/**
	 * E-posta başlığı: alıcı türü e-posta nesnesinden; bilinmiyorsa en kısıtlayıcı mod (müşteri).
	 *
	 * @param mixed $heading Başlık (kullanılmaz).
	 * @param mixed $email   WC_Email.
	 * @return void
	 */
	public static function on_header( $heading = '', $email = null ) {
		unset( $heading );
		if ( is_object( $email ) && method_exists( $email, 'is_customer_email' ) && ! $email->is_customer_email() ) {
			self::$mode = self::ADMIN;
			return;
		}
		self::$mode = self::CUSTOMER;
	}

	/**
	 * Sipariş tablosu öncesi: `$sent_to_admin` kesin bilgidir.
	 *
	 * @param mixed $order         Sipariş (kullanılmaz).
	 * @param mixed $sent_to_admin Yöneticiye mi.
	 * @return void
	 */
	public static function on_before_table( $order = null, $sent_to_admin = false ) {
		unset( $order );
		self::$mode = $sent_to_admin ? self::ADMIN : self::CUSTOMER;
	}

	/**
	 * E-posta bitti: bağlamı kapatır.
	 *
	 * @return void
	 */
	public static function end() {
		self::$mode = '';
	}

	/**
	 * Testler için bağlamı ayarlar.
	 *
	 * @param string $mode '', customer, admin.
	 * @return void
	 */
	public static function set( $mode ) {
		self::$mode = in_array( $mode, array( self::CUSTOMER, self::ADMIN ), true ) ? $mode : '';
	}
}

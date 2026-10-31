<?php
/**
 * E-posta kancaları: yalnız WooCommerce standart e-posta kancaları (tema/eklenti/sayfa oluşturucuya özel kod yok).
 *
 * Yalnız kanca KAYDI yapar; sınıflar ilk e-posta çizilirken yüklenir (ön yüzde çıktı/istek/sorgu 0).
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce\Email;

defined( 'ABSPATH' ) || exit;

/**
 * Email_Hooks.
 */
final class Email_Hooks {

	/**
	 * Kancaları bağlar.
	 *
	 * @return void
	 */
	public static function init() {
		// Bağlam: yalnız e-posta çizilirken dolu.
		add_action( 'woocommerce_email_header', array( Email_Context::class, 'on_header' ), 1, 2 );
		add_action( 'woocommerce_email_before_order_table', array( Email_Context::class, 'on_before_table' ), 1, 2 );
		// Düz metin şablonlarında başlık/altlık kancası yoktur: sipariş tablosu kancaları her iki sürümde de çalışır.
		add_action( 'woocommerce_email_after_order_table', array( Email_Context::class, 'end' ), 99 );
		add_action( 'woocommerce_email_footer', array( Email_Context::class, 'end' ), 99 );
		add_action( 'woocommerce_email_sent', array( Email_Context::class, 'end' ), 99 );
		// Süzgeç ve teşekkür bölümü.
		add_filter( 'woocommerce_order_item_get_formatted_meta_data', array( Email_Meta_Filter::class, 'filter' ), 20, 2 );
		add_action( 'woocommerce_email_before_order_table', array( Email_Thanks::class, 'render' ), 5, 4 );
	}
}

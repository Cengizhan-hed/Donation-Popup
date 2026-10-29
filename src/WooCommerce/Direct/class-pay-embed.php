<?php
/**
 * Compact kartın ödeme katmanı için WooCommerce order-pay sayfasının yalın (gömülü) görünümü.
 *
 * `?donation_panel_embed=1` ile açılan order-pay sayfası tema başlığı/altbilgisi olmadan, yalnız WooCommerce'in standart
 * ödeme formuyla (`[woocommerce_checkout]` → order-pay) çizilir; `wp_head`/`wp_footer` korunur (ödeme geçidinin betikleri ve
 * stilleri kendi standart yolundan yüklenir). Ödeme, doğrulama, 3D Secure ve yönlendirmeler tamamen geçidin ve WooCommerce'indir;
 * eklenti kart verisi görmez. WooCommerce ödeme sayfalarında zaten `X-Frame-Options: SAMEORIGIN` gönderir
 * (`wc_send_frame_options_header`): sayfa yalnız aynı kökenli çerçevede açılabilir.
 *
 * Bayrak yoksa ya da sayfa order-pay değilse hiçbir şey değişmez (yalnız bir `isset` denetimi).
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce\Direct;

use DonationPanel\Frontend\Template_Loader;

defined( 'ABSPATH' ) || exit;

/**
 * Pay_Embed.
 */
final class Pay_Embed {

	/** Sorgu bayrağı. */
	const QUERY = 'donation_panel_embed';

	/** Şablon adı (`templates/donation-panel/` altında; tema geçersiz kılabilir). */
	const TEMPLATE = 'payment/embed.php';

	/**
	 * Kancaları kaydeder (bayrak yoksa yalnız `template_include` süzgeci; içinde tek `isset`).
	 *
	 * @return void
	 */
	public static function register() {
		add_filter( 'template_include', array( __CLASS__, 'template' ), 99 );
		if ( self::requested() ) {
			// Gömülü görünümde yönetici çubuğu yok (çerçeve içinde ikinci çubuk olmasın).
			add_filter( 'show_admin_bar', '__return_false' );
		}
	}

	/**
	 * Gömülü görünüm istendi mi.
	 *
	 * @return bool
	 */
	public static function requested() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Yalnız görünüm bayrağı; veri işlenmez.
		return isset( $_GET[ self::QUERY ] ) && '1' === sanitize_key( wp_unslash( (string) $_GET[ self::QUERY ] ) );
	}

	/**
	 * order-pay sayfası + bayrak: yalın şablon.
	 *
	 * @param string $template Tema şablonu.
	 * @return string
	 */
	public static function template( $template ) {
		if ( ! self::requested() || ! function_exists( 'is_checkout_pay_page' ) || ! is_checkout_pay_page() ) {
			return $template;
		}
		$file = ( new Template_Loader( defined( 'WDP_PLUGIN_DIR' ) ? WDP_PLUGIN_DIR : dirname( __DIR__, 3 ) . '/' ) )->locate( self::TEMPLATE );
		return '' !== $file && is_file( $file ) ? $file : $template;
	}
}

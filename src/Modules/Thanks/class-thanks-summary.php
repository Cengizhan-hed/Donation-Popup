<?php
/**
 * Teşekkür ekranı özeti: siparişteki bağış satırlarından KİŞİ BİLGİSİZ özet üretir (saf mantık).
 *
 * Çıktıda bağışçının adı, telefonu, e-postası, ithafı, notu, adresi yoktur; yalnız proje adı, tutar, para birimi.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Thanks;

defined( 'ABSPATH' ) || exit;

/**
 * Thanks_Summary.
 */
final class Thanks_Summary {

	/**
	 * Özetteki izinli anahtarlar (kişi verisi sızıntısını testle sabitler).
	 *
	 * @var string[]
	 */
	const LINE_KEYS = array( 'product_id', 'project', 'amount' );

	/**
	 * Sipariş satırı bağış satırı mı: ürün bağış kapsamında ya da bağış tutarı meta alanı var.
	 *
	 * @param object $item Sipariş kalemi (WC_Order_Item_Product benzeri).
	 * @return bool
	 */
	public static function is_donation_line( $item ) {
		if ( ! is_object( $item ) ) {
			return false;
		}
		if ( method_exists( $item, 'get_meta' ) && '' !== (string) $item->get_meta( '_custom_price', true ) ) {
			return true;
		}
		if ( class_exists( 'WDP_Donation_Scope' ) && method_exists( $item, 'get_product' ) ) {
			$product = $item->get_product();
			return $product && \WDP_Donation_Scope::is_donation_product( $product );
		}
		return false;
	}

	/**
	 * Özeti üretir. Bağış satırı yoksa boş dizi döner (modül hiçbir şey basmaz).
	 *
	 * @param object        $order       Sipariş (WC_Order benzeri: get_items, get_currency).
	 * @param callable|null $is_donation function ( object $item ): bool; yoksa `is_donation_line`.
	 * @return array{lines: array<int, array{product_id: int, project: string, amount: float}>, total: float, currency: string}|array{}
	 */
	public static function build( $order, $is_donation = null ) {
		if ( ! is_object( $order ) || ! method_exists( $order, 'get_items' ) ) {
			return array();
		}
		$detect = is_callable( $is_donation ) ? $is_donation : array( __CLASS__, 'is_donation_line' );
		$lines  = array();
		$total  = 0.0;
		foreach ( (array) $order->get_items() as $item ) {
			if ( ! is_object( $item ) || ! call_user_func( $detect, $item ) ) {
				continue;
			}
			$amount  = round( (float) $item->get_total(), 6 );
			$lines[] = array(
				'product_id' => (int) $item->get_product_id(),
				'project'    => wp_strip_all_tags( (string) $item->get_name() ),
				'amount'     => $amount,
			);
			$total  += $amount;
		}
		if ( ! $lines ) {
			return array();
		}
		return array(
			'lines'    => $lines,
			'total'    => round( $total, 6 ),
			'currency' => (string) $order->get_currency(),
		);
	}

	/**
	 * Paylaşım metni: kişi bilgisi içermez (yalnız proje adı).
	 *
	 * @param array<string, mixed> $summary `build` çıktısı.
	 * @return string
	 */
	public static function share_text( array $summary ) {
		if ( empty( $summary['lines'] ) ) {
			return '';
		}
		/* translators: %s: project (campaign) name. */
		return sprintf( __( 'I just donated to %s.', 'woo-donation-popup' ), (string) $summary['lines'][0]['project'] );
	}
}

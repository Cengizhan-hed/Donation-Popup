<?php
/**
 * Yarım kalan doğrudan bağış siparişleri: süresi geçen bekleyen/başarısız siparişi iptal eder (hesapta/panoda kafa karıştırmaz).
 *
 * - Zamanlama YALNIZ ilk doğrudan sipariş üretilince kurulur (sayfa yüklerinde iş yok); olay saatlik çalışır.
 * - İptal edilen sipariş sonradan ödenirse (geç gelen geçit bildirimi) WooCommerce `payment_complete` iptal durumunu da kabul eder.
 * - Yalnız `_donation_panel_direct` işaretli siparişlere dokunur; süre `donation_panel_direct_pending_ttl` süzgeciyle (sn).
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce\Direct;

defined( 'ABSPATH' ) || exit;

/**
 * Direct_Cleanup.
 */
final class Direct_Cleanup {

	/** Zamanlanmış olay. */
	const HOOK = 'donation_panel_direct_cleanup';

	/** Her çalışmada en çok bu kadar sipariş. */
	const BATCH = 50;

	/**
	 * Olay işleyicisini kaydeder.
	 *
	 * @return void
	 */
	public static function register() {
		add_action( self::HOOK, array( __CLASS__, 'run' ) );
	}

	/**
	 * Olayı (yoksa) zamanlar.
	 *
	 * @return void
	 */
	public static function schedule() {
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'hourly', self::HOOK );
		}
	}

	/**
	 * Bekleme süresi (sn).
	 *
	 * @return int
	 */
	public static function ttl() {
		/**
		 * Ödenmeyen doğrudan bağış siparişi kaç saniye sonra iptal edilsin (en az 1 saat).
		 *
		 * @param int $seconds Süre (varsayılan 24 saat).
		 */
		return max( HOUR_IN_SECONDS, (int) apply_filters( 'donation_panel_direct_pending_ttl', DAY_IN_SECONDS ) );
	}

	/**
	 * Olay işleyicisi.
	 *
	 * @return void
	 */
	public static function run() {
		self::cancel_stale();
	}

	/**
	 * Süresi geçen yarım siparişleri iptal eder.
	 *
	 * @return int İptal edilen sipariş sayısı.
	 */
	public static function cancel_stale() {
		if ( ! function_exists( 'wc_get_orders' ) ) {
			return 0;
		}
		$orders = wc_get_orders(
			array(
				'limit'        => self::BATCH,
				'status'       => array( 'pending', 'failed' ),
				'date_created' => '<' . ( time() - self::ttl() ),
				'meta_query'   => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- tek anahtarlı, saatlik iş.
					array(
						'key'   => Direct_Order_Factory::FLAG_META,
						'value' => 'yes',
					),
				),
			)
		);
		$count  = 0;
		foreach ( $orders as $order ) {
			if ( $order instanceof \WC_Order && $order->has_status( array( 'pending', 'failed' ) ) ) {
				$order->update_status( 'cancelled', __( 'Direct donation was not paid in time and was cancelled automatically.', 'woo-donation-popup' ) );
				++$count;
			}
		}
		if ( self::BATCH === count( $orders ) ) {
			// Geriye kalan varsa kısa süre sonra bir kez daha.
			wp_schedule_single_event( time() + 5 * MINUTE_IN_SECONDS, self::HOOK );
		}
		return $count;
	}
}

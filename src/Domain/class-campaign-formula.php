<?php
/**
 * Kampanya toplamı formülü (tek yer): saklanan toplam = devreden tutar + kampanya başlangıcından sonra ÖDENMİŞ
 * siparişlerdeki bağış tutarları (iade düşülmüş, ana para birimine çevrilmiş).
 *
 * Gösterilen toplam bu değere ek olarak elle eklenen tutarı (`_wdp_manual_total`) içerir (bkz. `Campaign_Totals`).
 * Yönetici ekranı yalnız buradan: önizleme (`preview`, yazmaz), devreden tutar düzenleme (`set_carried`) ve onaylı
 * uygulama (`apply`). Her yazma ürün meta günlüğüne düşer. Toplu/otomatik yeniden hesaplama yoktur.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * Campaign_Formula.
 */
final class Campaign_Formula {

	/**
	 * Devreden tutar (ana para birimi; yönetici elle düzenleyebilir).
	 */
	const META_CARRIED = '_wdp_carried_amount';

	/**
	 * Kampanya başlangıcı (Unix zaman damgası; göçte göç anı).
	 */
	const META_START = '_wdp_campaign_start';

	/**
	 * Saklanan toplam.
	 */
	const META_TOTAL = '_wdp_total_donation_amount';

	/**
	 * Değişiklik günlüğü (kim, ne zaman, eski/yeni).
	 */
	const META_LOG = '_wdp_totals_log';

	/**
	 * Günlükte tutulan en çok kayıt.
	 */
	const LOG_LIMIT = 100;

	/**
	 * Para birimi küsuratı eşiği.
	 */
	const EPSILON = 0.005;

	/**
	 * Devreden tutar.
	 *
	 * @param int $product_id Ürün.
	 * @return float
	 */
	public static function get_carried( $product_id ) {
		$raw = get_post_meta( absint( $product_id ), self::META_CARRIED, true );
		return ( '' !== $raw && is_numeric( $raw ) ) ? max( 0.0, (float) $raw ) : 0.0;
	}

	/**
	 * Kampanya başlangıcı (Unix) ya da null (başlangıç sınırı yok: tüm ödenmiş siparişler).
	 *
	 * @param int $product_id Ürün.
	 * @return int|null
	 */
	public static function get_start( $product_id ) {
		$raw = get_post_meta( absint( $product_id ), self::META_START, true );
		return ( '' !== $raw && is_numeric( $raw ) && (int) $raw > 0 ) ? (int) $raw : null;
	}

	/**
	 * Saklanan toplam ya da null (hiç yazılmamış).
	 *
	 * @param int $product_id Ürün.
	 * @return float|null
	 */
	public static function get_stored_total( $product_id ) {
		$raw = get_post_meta( absint( $product_id ), self::META_TOTAL, true );
		return ( '' !== $raw && is_numeric( $raw ) ) ? max( 0.0, (float) $raw ) : null;
	}

	/**
	 * Siparişin "sayılma anı": ödeme tarihi, yoksa tamamlanma tarihi, yoksa oluşturma tarihi (çevrimdışı
	 * yöntemlerde ödeme tarihi boştur). 0: tarih okunamadı.
	 *
	 * @param object $order Sipariş.
	 * @return int Unix.
	 */
	public static function order_counting_ts( $order ) {
		foreach ( array( 'get_date_paid', 'get_date_completed', 'get_date_created' ) as $method ) {
			if ( ! is_object( $order ) || ! method_exists( $order, $method ) ) {
				continue;
			}
			$date = $order->$method();
			if ( is_object( $date ) && method_exists( $date, 'getTimestamp' ) && (int) $date->getTimestamp() > 0 ) {
				return (int) $date->getTimestamp();
			}
		}
		return 0;
	}

	/**
	 * Sipariş kampanya başlangıcından ÖNCE mi sayıldı (toplamı devreden tutarın içindedir)? Tarih okunamazsa ya da
	 * başlangıç yoksa false.
	 *
	 * @param object $order      Sipariş.
	 * @param int    $product_id Ürün.
	 * @return bool
	 */
	public static function is_order_before_start( $order, $product_id ) {
		$start = self::get_start( $product_id );
		if ( null === $start ) {
			return false;
		}
		$ts = self::order_counting_ts( $order );
		return $ts > 0 && $ts < $start;
	}

	/**
	 * Y-m-d (site saat dilimi) -> Unix; gün başı ya da gün sonu. Geçersizse null.
	 *
	 * @param mixed $value      Tarih dizgesi.
	 * @param bool  $end_of_day True: 23:59:59.
	 * @return int|null
	 */
	public static function parse_date( $value, $end_of_day = false ) {
		$value = is_scalar( $value ) ? trim( (string) $value ) : '';
		if ( '' === $value || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
			return null;
		}
		$tz = function_exists( 'wp_timezone' ) ? wp_timezone() : new \DateTimeZone( 'UTC' );
		$dt = \DateTimeImmutable::createFromFormat( 'Y-m-d H:i:s', $value . ( $end_of_day ? ' 23:59:59' : ' 00:00:00' ), $tz );
		return $dt ? $dt->getTimestamp() : null;
	}

	/**
	 * Formülle hesaplar (SALT OKUNUR; hiçbir şey yazmaz, sipariş bayrağı bile). `$from` boşsa kampanya başlangıcı,
	 * `$to` boşsa üst sınır yok.
	 *
	 * @param int      $product_id Ürün.
	 * @param int|null $from       Sayılan siparişlerin ilk anı (Unix).
	 * @param int|null $to         Sayılan siparişlerin son anı (Unix).
	 * @param bool     $collect    True: sayılan siparişleri `orders_hit` içinde döndür (uygulama için).
	 * @return array{carried:float,start:int|null,from:int|null,to:int|null,orders:int,new_sum:float,computed:float,unconverted:int,orders_hit:array<int,object>}
	 */
	public static function compute( $product_id, $from = null, $to = null, $collect = false ) {
		$product_id = absint( $product_id );
		$from       = null === $from ? self::get_start( $product_id ) : $from;
		$carried    = self::get_carried( $product_id );
		$out        = array(
			'carried'     => $carried,
			'start'       => self::get_start( $product_id ),
			'from'        => $from,
			'to'          => $to,
			'orders'      => 0,
			'new_sum'     => 0.0,
			'computed'    => round( $carried, 2 ),
			'unconverted' => 0,
			'orders_hit'  => array(),
		);
		if ( ! $product_id || ! function_exists( 'wc_get_orders' ) ) {
			return $out;
		}

		$statuses = array();
		foreach ( Campaign_Totals::get_progress_paid_statuses() as $status ) {
			$statuses[] = 'wc-' . $status;
		}
		if ( ! $statuses ) {
			return $out;
		}

		$page     = 1;
		$per_page = 200;
		do {
			$query = wc_get_orders(
				array(
					'type'     => 'shop_order',
					'status'   => $statuses,
					'limit'    => $per_page,
					'page'     => $page,
					'paginate' => true,
					'return'   => 'objects',
				)
			);
			if ( empty( $query ) || empty( $query->orders ) ) {
				break;
			}
			foreach ( $query->orders as $order ) {
				if ( ! is_object( $order ) ) {
					continue;
				}
				$lines = Campaign_Totals::compute_order_progress_lines( $order, true, false, false );
				if ( ! isset( $lines[ $product_id ] ) ) {
					continue;
				}
				if ( ! empty( $lines[ $product_id ]['unconverted'] ) ) {
					++$out['unconverted'];
				}
				if ( ! Campaign_Totals::is_order_in_period_dates( $order, $product_id ) ) {
					continue;
				}
				$ts = self::order_counting_ts( $order );
				if ( $ts > 0 && ( ( null !== $from && $ts < $from ) || ( null !== $to && $ts > $to ) ) ) {
					continue;
				}
				$amount = (float) $lines[ $product_id ]['amount'];
				if ( $amount <= 0 ) {
					continue;
				}
				$out['new_sum'] += $amount;
				++$out['orders'];
				if ( $collect ) {
					$out['orders_hit'][] = $order;
				}
			}
			++$page;
		} while ( $page <= (int) $query->max_num_pages );

		$out['new_sum']  = round( $out['new_sum'], 2 );
		$out['computed'] = round( $carried + $out['new_sum'], 2 );
		return $out;
	}

	/**
	 * Önizleme (YAZMAZ): saklanan, hesaplanan, fark, sipariş sayısı.
	 *
	 * @param int      $product_id Ürün.
	 * @param int|null $from       Başlangıç (Unix) ya da null = kampanya başlangıcı.
	 * @param int|null $to         Bitiş (Unix) ya da null.
	 * @return array<string, mixed>
	 */
	public static function preview( $product_id, $from = null, $to = null ) {
		$calc   = self::compute( $product_id, $from, $to );
		$stored = self::get_stored_total( $product_id );
		unset( $calc['orders_hit'] );
		$calc['stored'] = $stored;
		$calc['diff']   = null === $stored ? null : round( $calc['computed'] - $stored, 2 );
		return $calc;
	}

	/**
	 * Devreden tutarı yazar; saklanan toplam aynı farkla kayar (formül tutarlı kalır). Günlüğe düşer.
	 *
	 * @param int   $product_id Ürün.
	 * @param float $amount     Yeni devreden tutar (>= 0).
	 * @param int   $user_id    İşlemi yapan kullanıcı.
	 * @return array{old:float,new:float,stored:float}
	 */
	public static function set_carried( $product_id, $amount, $user_id ) {
		$product_id = absint( $product_id );
		$old        = self::get_carried( $product_id );
		$new        = round( max( 0.0, (float) $amount ), 2 );
		$stored     = self::get_stored_total( $product_id );
		$next       = null === $stored ? $new : max( 0.0, $stored + ( $new - $old ) );
		update_post_meta( $product_id, self::META_CARRIED, $new );
		Campaign_Totals::update_product_donation_total( $product_id, $next, true );
		self::log(
			$product_id,
			array(
				'type'    => 'carried',
				'user'    => (int) $user_id,
				'old'     => $old,
				'new'     => $new,
				'old_tot' => $stored,
				'new_tot' => round( $next, 2 ),
			)
		);
		return array(
			'old'    => $old,
			'new'    => $new,
			'stored' => round( $next, 2 ),
		);
	}

	/**
	 * Önizlenen sonucu YAZAR (yalnız yönetici onayıyla). `$expected` önizlemede görülen hesaplanan toplamdır; arada
	 * değiştiyse yazılmaz (`stale`). Bitiş tarihi geçmişteyse reddedilir (sonraki siparişler artımlı toplamda kaybolurdu).
	 *
	 * @param int      $product_id Ürün.
	 * @param int|null $from       Başlangıç (Unix) ya da null.
	 * @param int|null $to         Bitiş (Unix) ya da null.
	 * @param float    $expected   Onaylanan hesaplanan toplam.
	 * @param int      $user_id    Kullanıcı.
	 * @return array{ok:bool,reason:string,result:array<string,mixed>}
	 */
	public static function apply( $product_id, $from, $to, $expected, $user_id ) {
		$product_id = absint( $product_id );
		if ( null !== $to && $to < time() ) {
			return array(
				'ok'     => false,
				'reason' => 'end_in_past',
				'result' => array(),
			);
		}
		$calc = self::compute( $product_id, $from, $to, true );
		if ( abs( $calc['computed'] - (float) $expected ) > self::EPSILON ) {
			$calc['stale'] = true;
			unset( $calc['orders_hit'] );
			return array(
				'ok'     => false,
				'reason' => 'stale',
				'result' => $calc,
			);
		}

		$old_total = self::get_stored_total( $product_id );
		$old_start = self::get_start( $product_id );
		if ( null !== $from ) {
			update_post_meta( $product_id, self::META_START, (int) $from );
		}
		// Aralıktaki ödenmiş ama henüz sayılmamış siparişleri sayılmış işaretle (sonraki iade/iptal tutarlı kalsın).
		foreach ( $calc['orders_hit'] as $order ) {
			if ( ! Campaign_Totals::is_order_counted_in_progress( $order ) ) {
				Campaign_Totals::count_order_in_progress_totals( $order );
			}
		}
		Campaign_Totals::update_product_donation_total( $product_id, $calc['computed'], true );
		self::log(
			$product_id,
			array(
				'type'      => 'recalc',
				'user'      => (int) $user_id,
				'old'       => $old_total,
				'new'       => $calc['computed'],
				'carried'   => $calc['carried'],
				'orders'    => $calc['orders'],
				'from'      => $from,
				'to'        => $to,
				'old_start' => $old_start,
			)
		);
		unset( $calc['orders_hit'] );
		$calc['stored'] = $calc['computed'];
		$calc['diff']   = 0.0;
		return array(
			'ok'     => true,
			'reason' => 'applied',
			'result' => $calc,
		);
	}

	/**
	 * Günlüğü okur (en yeni sonda).
	 *
	 * @param int $product_id Ürün.
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_log( $product_id ) {
		$log = get_post_meta( absint( $product_id ), self::META_LOG, true );
		return is_array( $log ) ? $log : array();
	}

	/**
	 * Günlüğe kayıt ekler (kim, ne zaman, eski/yeni; kişisel veri yok, yalnız kullanıcı kimliği).
	 *
	 * @param int                  $product_id Ürün.
	 * @param array<string, mixed> $entry      Kayıt.
	 * @return void
	 */
	private static function log( $product_id, array $entry ) {
		$log   = self::get_log( $product_id );
		$log[] = array( 'at' => time() ) + $entry;
		if ( count( $log ) > self::LOG_LIMIT ) {
			$log = array_slice( $log, -self::LOG_LIMIT );
		}
		update_post_meta( $product_id, self::META_LOG, $log );
	}
}

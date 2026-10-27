<?php
/**
 * Sosyal kanıt verisi (K3): yalnız toplu gerçek veri; kişi bilgisi yok.
 *
 * Ad, e-posta, telefon, ithaf, not, adres hiçbir yanıta girmez: yalnız tutar ve zaman döner (`name` anahtarı
 * yanıt biçimi sabit kalsın diye vardır, her zaman boştur; ön yüz "A kind donor" yazar).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\SocialProof;

use DonationPanel\Domain\Campaign_Goal;
use DonationPanel\Domain\Campaign_Totals;
use DonationPanel\Domain\Progress_Currency;
use DonationPanel\Modules\Campaign\Progress_Renderer;

defined( 'ABSPATH' ) || exit;

/**
 * Donation_Feed.
 */
final class Donation_Feed {

	/**
	 * Sayfa başına üst sınır.
	 */
	const MAX_PER_PAGE = 20;

	/**
	 * Bir istekte taranacak en çok sipariş.
	 */
	const MAX_SCAN = 250;

	/**
	 * İstatistik önbellek süresi (sn).
	 */
	const STATS_TTL = 300;

	/**
	 * Sayfa listesi önbellek süresi (sn); liste önbellek sürümü değişince de geçersiz olur.
	 */
	const PAGE_TTL = 60;

	/**
	 * Erişilebilecek en büyük sayfa (taramayı sınırlar).
	 */
	const MAX_PAGE = 50;

	/**
	 * Sayfa başına değeri sınırlar.
	 *
	 * @param mixed $raw Ham değer.
	 * @return int 1..MAX_PER_PAGE (varsayılan 5).
	 */
	public static function clamp_per_page( $raw ) {
		$value = is_numeric( $raw ) ? (int) $raw : 5;
		return max( 1, min( self::MAX_PER_PAGE, $value ) );
	}

	/**
	 * Yanıt girdisi: yalnız izinli alanlar (saf; test edilebilir).
	 *
	 * @param array<string, mixed> $raw `amount`, `timestamp` (diğer anahtarlar yok sayılır; ad asla alınmaz).
	 * @return array{name: string, amount: float, timestamp: int}
	 */
	public static function build_entry( array $raw ) {
		return array(
			'name'      => '',
			'amount'    => max( 0.0, isset( $raw['amount'] ) ? (float) $raw['amount'] : 0.0 ),
			'timestamp' => isset( $raw['timestamp'] ) ? (int) $raw['timestamp'] : 0,
		);
	}

	/**
	 * Ödenmiş siparişlerden sayfalı bağış listesi.
	 *
	 * @param int $product_id 0 = tüm bağış ürünleri.
	 * @param int $page       Sayfa (1'den).
	 * @param int $per_page   Sayfa başına.
	 * @return array{items: array<int, array<string, mixed>>, page: int, per_page: int, has_more: bool}
	 */
	public static function page( $product_id, $page, $per_page ) {
		$product_id = absint( $product_id );
		$page       = max( 1, min( self::MAX_PAGE, (int) $page ) );
		$per_page   = self::clamp_per_page( $per_page );

		// Genel uç: sipariş taraması pahalı olduğundan sonuç kısa süre önbelleğe alınır (anahtar kümesi sınırlı:
		// ürün x sayfa<=50 x sayfa boyutu<=20 x para birimi; liste önbellek sürümü bağış verisi değişince artar).
		$cache_key = 'dp_social_page_' . md5( implode( '|', array( $product_id, $page, $per_page, Progress_Currency::get_active_currency(), (int) get_option( 'wdp_list_cache_version', 1 ) ) ) );
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		$result = self::build_page( $product_id, $page, $per_page );
		set_transient( $cache_key, $result, self::PAGE_TTL );
		return $result;
	}

	/**
	 * Sayfayı siparişlerden üretir (önbelleksiz).
	 *
	 * @param int $product_id Ürün (0 = tümü).
	 * @param int $page       Sayfa.
	 * @param int $per_page   Sayfa başına.
	 * @return array{items: array<int, array<string, mixed>>, page: int, per_page: int, has_more: bool}
	 */
	private static function build_page( $product_id, $page, $per_page ) {
		$skip     = ( $page - 1 ) * $per_page;
		$items    = array();
		$matched  = 0;
		$has_more = false;

		foreach ( self::paid_orders( self::MAX_SCAN ) as $order ) {
			$amount = self::order_amount( $order, $product_id );
			if ( $amount <= 0 ) {
				continue;
			}
			++$matched;
			if ( $matched <= $skip ) {
				continue;
			}
			if ( count( $items ) >= $per_page ) {
				$has_more = true;
				break;
			}
			$items[] = self::format_entry( self::entry_for_order( $order, $product_id, $amount ) );
		}

		return array(
			'items'    => $items,
			'page'     => $page,
			'per_page' => $per_page,
			'has_more' => $has_more,
		);
	}

	/**
	 * Toplu sayılar: bağışçı sayısı, bugünkü bağış sayısı, toplanan (gösterim birimi).
	 *
	 * @param int $product_id 0 = tüm bağış ürünleri.
	 * @return array{donors: int, today: int, raised: float}
	 */
	public static function stats( $product_id ) {
		$product_id = absint( $product_id );
		$currency   = Progress_Currency::get_active_currency();
		$cache_key  = 'dp_social_stats_' . $product_id . '_' . $currency;
		$cached     = get_transient( $cache_key );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		if ( $product_id > 0 ) {
			$donors = (int) Campaign_Totals::get_donor_count( $product_id );
			$raised = Campaign_Goal::get_confirmed_total( $product_id );
		} else {
			$donors = 0;
			$raised = 0.0;
		}

		$today_start = function_exists( 'current_datetime' ) ? (int) current_datetime()->setTime( 0, 0 )->getTimestamp() : (int) strtotime( 'today', time() );
		$today       = 0;
		foreach ( self::paid_orders( self::MAX_SCAN ) as $order ) {
			$amount = self::order_amount( $order, $product_id );
			if ( $amount <= 0 ) {
				continue;
			}
			if ( 0 === $product_id ) {
				++$donors;
				$raised += $amount;
			}
			$created = is_object( $order ) && method_exists( $order, 'get_date_created' ) ? $order->get_date_created() : null;
			if ( $created && $today_start > 0 && (int) $created->getTimestamp() >= $today_start ) {
				++$today;
			}
		}

		$raised_display = (float) Progress_Currency::from_store_amount( $raised );
		$stats          = array(
			'donors' => (int) $donors,
			'today'  => $today,
			'raised' => $raised_display,
		);
		set_transient( $cache_key, $stats, self::STATS_TTL );
		return $stats;
	}

	/**
	 * Yanıt biçimi (gösterim birimi, göreli zaman).
	 *
	 * @param array{name: string, amount: float, timestamp: int} $entry Girdi.
	 * @return array<string, mixed>
	 */
	public static function format_entry( array $entry ) {
		$display = (float) Progress_Currency::from_store_amount( $entry['amount'] );
		$ago     = '';
		if ( $entry['timestamp'] > 0 && function_exists( 'human_time_diff' ) ) {
			/* translators: %s: time span, e.g. "3 hours" */
			$ago = sprintf( __( '%s ago', 'woo-donation-popup' ), human_time_diff( $entry['timestamp'], time() ) );
		}
		return array(
			'name'   => $entry['name'],
			'amount' => $display,
			'label'  => Progress_Renderer::money( $display ),
			'date'   => $entry['timestamp'] > 0 ? gmdate( 'c', $entry['timestamp'] ) : '',
			'ago'    => $ago,
		);
	}

	/**
	 * Siparişten girdi üretir.
	 *
	 * @param object $order      Sipariş.
	 * @param int    $product_id Ürün (0 = tümü).
	 * @param float  $amount     Ana birimde tutar.
	 * @return array{name: string, amount: float, timestamp: int}
	 */
	private static function entry_for_order( $order, $product_id, $amount ) {
		$created = method_exists( $order, 'get_date_created' ) ? $order->get_date_created() : null;
		$entry   = self::build_entry(
			array(
				'amount'    => $amount,
				'timestamp' => $created ? (int) $created->getTimestamp() : 0,
			)
		);

		/**
		 * Herkese açık bağış girdisini değiştirir. Kişi verisi (e-posta, telefon, not) eklenmemelidir.
		 *
		 * @param array{name: string, amount: float, timestamp: int} $entry Girdi.
		 * @param object                                             $order Sipariş.
		 */
		$filtered = apply_filters( 'donation_panel_social_proof_entry', $entry, $order );
		return is_array( $filtered ) ? $filtered : $entry;
	}

	/**
	 * Ürün (ya da herhangi bir bağış ürünü) için siparişteki tutar (ana birim).
	 *
	 * @param object $order      Sipariş.
	 * @param int    $product_id Ürün (0 = toplam).
	 * @return float
	 */
	private static function order_amount( $order, $product_id ) {
		$amounts = (array) Campaign_Totals::compute_order_progress_amounts( $order );
		if ( $product_id > 0 ) {
			return isset( $amounts[ $product_id ] ) ? (float) $amounts[ $product_id ] : 0.0;
		}
		$sum = 0.0;
		foreach ( $amounts as $value ) {
			$sum += (float) $value;
		}
		return $sum;
	}

	/**
	 * En yeni ödenmiş siparişler (sayfa sayfa, en çok $limit).
	 *
	 * @param int $limit Üst sınır.
	 * @return \Generator<int, object>
	 */
	private static function paid_orders( $limit ) {
		if ( ! function_exists( 'wc_get_orders' ) ) {
			return;
		}
		$statuses = array();
		foreach ( Campaign_Totals::get_progress_paid_statuses() as $status ) {
			$statuses[] = 'wc-' . $status;
		}
		if ( ! $statuses ) {
			return;
		}
		$per   = 50;
		$page  = 1;
		$count = 0;
		do {
			$query = wc_get_orders(
				array(
					'type'     => 'shop_order',
					'status'   => $statuses,
					'limit'    => $per,
					'page'     => $page,
					'orderby'  => 'date',
					'order'    => 'DESC',
					'paginate' => true,
					'return'   => 'objects',
				)
			);
			if ( empty( $query ) || empty( $query->orders ) ) {
				return;
			}
			foreach ( $query->orders as $order ) {
				if ( ++$count > $limit ) {
					return;
				}
				yield $order;
			}
			++$page;
		} while ( $page <= (int) $query->max_num_pages );
	}
}

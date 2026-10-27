<?php
/**
 * Kampanya toplamları: sipariş durumuna göre artımlı toplam, bağışçı sayısı ve önbellekler.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

use DonationPanel\Core\Uninstall;
use DonationPanel\Support\Debug;
use DonationPanel\Modules\EntryPoints\Donations_List;
use DonationPanel\WooCommerce\Order_Meta_Keys;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Campaign_Totals
 */
class Campaign_Totals {

	/**
	 * WooCommerce ürün kayıt kancası bir kez eklendi mi.
	 *
	 * @var bool
	 */
	private static $wc_product_cache_invalidation_hook_registered = false;

	/**
	 * Kancaları bağlar: sipariş durumu/iade/silme/çöp ile artımlı toplam, ürün değişince önbellek temizliği.
	 *
	 * @return void
	 */
	public static function init() {
		// Ödenmiş durumlar (wdp_progress_paid_statuses) sayılır; ödenmemişe düşünce / silme / çöpte düşülür.
		add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'sync_order_donation_totals_on_status_change' ), 20, 4 );
		add_action( 'woocommerce_order_refunded', array( __CLASS__, 'sync_order_donation_totals_on_refund' ), 20, 2 );
		add_action( 'before_delete_post', array( __CLASS__, 'uncount_order_progress_on_delete' ), 5, 2 );
		add_action( 'wp_trash_post', array( __CLASS__, 'uncount_order_progress_on_trash' ), 5, 1 );
		add_action( 'untrashed_post', array( __CLASS__, 'recount_order_progress_on_untrash' ), 10, 1 );

		// Ürün ya da bağışa ilişkin ürün meta'sı değişince toplam/bağışçı sayısı önbelleğini tek merkezden temizle.
		add_action( 'updated_post_meta', array( __CLASS__, 'maybe_invalidate_product_donation_caches_on_meta' ), 10, 4 );
		add_action( 'added_post_meta', array( __CLASS__, 'maybe_invalidate_product_donation_caches_on_meta' ), 10, 4 );
		add_action( 'deleted_post_meta', array( __CLASS__, 'maybe_invalidate_product_donation_caches_on_meta' ), 10, 4 );
		add_action( 'save_post_product', array( __CLASS__, 'invalidate_product_donation_caches_on_product_save' ), 10, 3 );
		if ( did_action( 'woocommerce_loaded' ) ) {
			self::register_wc_product_cache_invalidation_hook();
		} else {
			add_action( 'woocommerce_loaded', array( __CLASS__, 'register_wc_product_cache_invalidation_hook' ), 1 );
		}

		// Ürün çöpe gider veya kalıcı silinirken önbellekte yetim anahtar kalmasın (object cache / Redis).
		add_action( 'before_delete_post', array( __CLASS__, 'purge_product_donation_caches_on_delete' ), 10, 2 );
		add_action( 'wp_trash_post', array( __CLASS__, 'purge_product_donation_caches_on_trash' ), 10, 1 );
	}

	/**
	 * Gösterilen toplam = siparişlerden hesaplanan toplam + elle eklenen tutar (`_wdp_manual_total`).
	 *
	 * İlerleme çubuğu, kampanya kartı, ürün bilgisi ve sepet/REST yanıtları toplamı yalnız buradan okur.
	 *
	 * @since 10.2.0
	 * @param int $product_id Product ID. Sadece bu ürün için yapılan bağışlar sayılır.
	 * @return float Displayed total for this specific product only.
	 */
	public static function get_total_donation_amount( $product_id ) {
		$product_id = absint( $product_id );
		if ( ! $product_id ) {
			return 0.0;
		}
		return self::get_calculated_total_donation_amount( $product_id ) + self::get_manual_total( $product_id );
	}

	/**
	 * Elle eklenen tutar (ana para birimi; sitede sipariş olmayan bağışlar: elden, havale vb.). Hiçbir komut ya da
	 * göç bu değeri silmez veya azaltmaz.
	 *
	 * @param int $product_id Product ID.
	 * @return float
	 */
	public static function get_manual_total( $product_id ) {
		$product_id = absint( $product_id );
		if ( ! $product_id ) {
			return 0.0;
		}
		$raw = get_post_meta( $product_id, '_wdp_manual_total', true );
		return ( '' !== $raw && is_numeric( $raw ) ) ? max( 0.0, (float) $raw ) : 0.0;
	}

	/**
	 * Siparişlerden hesaplanan toplam (elle eklenen hariç): ödenmiş siparişler (wdp_progress_paid_statuses).
	 *
	 * ÖNEMLİ: Bu fonksiyon SADECE belirtilen ürün ID'si için yapılan bağışları sayar.
	 * Her ürün için ayrı progress bar olduğundan, ürünler birbirine karışmaz.
	 *
	 * @since 11.0.0
	 * @param int $product_id Product ID.
	 * @return float
	 */
	public static function get_calculated_total_donation_amount( $product_id ) {
		$product_id = absint( $product_id );

		if ( ! $product_id ) {
			return 0.0;
		}

		// Cache key - her ürün için ayrı cache
		$cache_key = 'wdp_total_donation_' . $product_id;

		// Try to get from cache first
		$cached = wp_cache_get( $cache_key, 'wdp_donations' );
		if ( false !== $cached ) {
			return floatval( $cached );
		}

		$meta_total = get_post_meta( $product_id, '_wdp_total_donation_amount', true );
		if ( '' !== $meta_total && is_numeric( $meta_total ) ) {
			$meta_total = max( 0.0, floatval( $meta_total ) );
			wp_cache_set( $cache_key, $meta_total, 'wdp_donations', HOUR_IN_SECONDS );
			return $meta_total;
		}

		// Meta boş: ağır tarama YOK (ne ziyaretçi isteğinde ne arka planda); toplam ilk sayılan siparişle ya da yöneticinin
		// Kampanyalar ekranındaki onaylı hesabıyla oluşur. Şimdilik 0 göster.
		wp_cache_set( $cache_key, 0.0, 'wdp_donations', MINUTE_IN_SECONDS );

		return 0.0;
	}

	/**
	 * Ürün için tamamlanmış bağışçı sayısı.
	 *
	 * @param int $product_id Product ID.
	 * @return int
	 */
	public static function get_donor_count( $product_id ) {
		$product_id = absint( $product_id );
		if ( ! $product_id ) {
			return 0;
		}
		$cache_key = 'wdp_donor_count_' . $product_id;
		$cached    = wp_cache_get( $cache_key, 'wdp_donations' );
		if ( false !== $cached ) {
			return max( 0, (int) $cached );
		}
		$meta  = get_post_meta( $product_id, '_wdp_donor_count', true );
		$count = ( '' !== $meta && is_numeric( $meta ) ) ? max( 0, (int) $meta ) : 0;
		wp_cache_set( $cache_key, $count, 'wdp_donations', HOUR_IN_SECONDS );
		return $count;
	}

	/**
	 * Bulk displayed totals (cached _wdp_total_donation_amount + manual amount; empty meta = 0, no N+1 recalculation).
	 *
	 * @param int[] $product_ids Product IDs.
	 * @return array<int, float>
	 */
	public static function get_totals_for_products( array $product_ids ) {
		$out = array();
		foreach ( $product_ids as $product_id ) {
			$product_id = absint( $product_id );
			if ( $product_id <= 0 ) {
				continue;
			}
			$meta               = get_post_meta( $product_id, '_wdp_total_donation_amount', true );
			$calculated         = ( '' !== $meta && is_numeric( $meta ) ) ? max( 0.0, (float) $meta ) : 0.0;
			$out[ $product_id ] = $calculated + self::get_manual_total( $product_id );
		}
		return $out;
	}

	/**
	 * Sipariş/iade bayrak meta değerini okur (HPOS + post_meta yedek).
	 *
	 * @param int|\WC_Abstract_Order $order_or_id Sipariş veya ID.
	 * @param string                $meta_key    Meta anahtarı.
	 * @return string
	 */
	public static function get_order_flag_meta( $order_or_id, $meta_key ) {
		$order = is_object( $order_or_id ) ? $order_or_id : wc_get_order( $order_or_id );
		if ( $order && is_a( $order, 'WC_Abstract_Order' ) ) {
			$value = $order->get_meta( $meta_key, true );
			if ( '' !== $value && null !== $value ) {
				return (string) $value;
			}
		}

		$order_id = $order ? $order->get_id() : absint( $order_or_id );
		if ( $order_id ) {
			return (string) get_post_meta( $order_id, $meta_key, true );
		}

		return '';
	}

	/**
	 * Sipariş/iade bayrak meta değerini yazar (HPOS + post_meta yedek).
	 *
	 * @param int|\WC_Abstract_Order $order_or_id Sipariş veya ID.
	 * @param string                $meta_key    Meta anahtarı.
	 * @param string                $value       Değer.
	 * @return void
	 */
	public static function set_order_flag_meta( $order_or_id, $meta_key, $value ) {
		$order = is_object( $order_or_id ) ? $order_or_id : wc_get_order( $order_or_id );
		if ( $order && is_a( $order, 'WC_Abstract_Order' ) ) {
			$order->update_meta_data( $meta_key, $value );
			$order->save();
			return;
		}

		$order_id = absint( $order_or_id );
		if ( $order_id ) {
			update_post_meta( $order_id, $meta_key, $value );
		}
	}

	/**
	 * Ödemesi alınmış sayılan sipariş durumları (progress bar toplamı için).
	 *
	 * @return string[] Durum slug'ları ("wc-" öneki olmadan).
	 */
	public static function get_progress_paid_statuses() {
		/**
		 * Progress bar toplamına dahil edilen sipariş durumları.
		 *
		 * @param string[] $statuses Varsayılan: processing, completed.
		 */
		$statuses = apply_filters( 'wdp_progress_paid_statuses', array( 'processing', 'completed' ) ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
		if ( ! is_array( $statuses ) ) {
			$statuses = array( 'processing', 'completed' );
		}

		$out = array();
		foreach ( $statuses as $status ) {
			$status = self::normalize_order_status_slug( $status );
			if ( '' !== $status ) {
				$out[] = $status;
			}
		}

		return array_values( array_unique( $out ) );
	}

	/**
	 * Geriye dönük uyumluluk: eski "completed" kancası (dış kod çağırabilir).
	 *
	 * @param int $order_id WooCommerce order id.
	 * @return void
	 */
	public static function sync_order_donation_totals_on_complete( $order_id ) {
		$order_id = absint( $order_id );
		$order    = $order_id ? wc_get_order( $order_id ) : null;
		if ( $order ) {
			self::count_order_in_progress_totals( $order );
		}
	}

	/**
	 * woocommerce_order_status_changed: ödenmiş duruma geçince say, iade/iptal/başarısızda geri al.
	 *
	 * @param int           $order_id Order ID.
	 * @param string        $from     Old status.
	 * @param string        $to       New status.
	 * @param \WC_Order|null $order    Order object.
	 * @return void
	 */
	public static function sync_order_donation_totals_on_status_change( $order_id, $from = '', $to = '', $order = null ) {
		unset( $from );

		if ( ! is_object( $order ) ) {
			$order_id = absint( $order_id );
			$order    = $order_id ? wc_get_order( $order_id ) : null;
		}
		if ( ! $order || is_a( $order, 'WC_Order_Refund' ) ) {
			return;
		}

		$to = self::normalize_order_status_slug( $to );

		// Ödenmiş duruma geçince say; herhangi bir ödenmemiş duruma (on-hold, pending, trash…) düşünce düş.
		if ( in_array( $to, self::get_progress_paid_statuses(), true ) ) {
			self::count_order_in_progress_totals( $order );
		} elseif ( self::is_order_counted_in_progress( $order ) ) {
			self::uncount_order_from_progress_totals( $order );
		}
	}

	/**
	 * Sipariş kalıcı silinmeden / çöpe gitmeden önce progress toplamından düş.
	 *
	 * @param int          $post_id Post ID.
	 * @param \WP_Post|null $post    Post.
	 * @return void
	 */
	public static function uncount_order_progress_on_delete( $post_id, $post = null ) {
		$post_id = absint( $post_id );
		if ( $post_id <= 0 ) {
			return;
		}
		$type = ( $post instanceof \WP_Post ) ? $post->post_type : get_post_type( $post_id );
		if ( 'shop_order' !== $type ) {
			// HPOS: post_type boş olabilir; sipariş nesnesi dene.
			if ( ! function_exists( 'wc_get_order' ) ) {
				return;
			}
		}
		$order = function_exists( 'wc_get_order' ) ? wc_get_order( $post_id ) : null;
		if ( ! $order || is_a( $order, 'WC_Order_Refund' ) ) {
			return;
		}
		self::uncount_order_from_progress_totals( $order );
	}

	/**
	 * Sipariş çöpe taşındığında.
	 *
	 * @param int $post_id Post ID.
	 * @return void
	 */
	public static function uncount_order_progress_on_trash( $post_id ) {
		self::uncount_order_progress_on_delete( $post_id, null );
	}

	/**
	 * Sipariş çöpten çıkınca, hâlâ ödenmiş durumdaysa yeniden say.
	 *
	 * @param int $post_id Post ID.
	 * @return void
	 */
	public static function recount_order_progress_on_untrash( $post_id ) {
		$post_id = absint( $post_id );
		if ( ! $post_id || ! function_exists( 'wc_get_order' ) ) {
			return;
		}
		$order = wc_get_order( $post_id );
		if ( ! $order || is_a( $order, 'WC_Order_Refund' ) ) {
			return;
		}
		$status = method_exists( $order, 'get_status' )
			? self::normalize_order_status_slug( $order->get_status() )
			: '';
		if ( in_array( $status, self::get_progress_paid_statuses(), true ) ) {
			self::count_order_in_progress_totals( $order );
		}
	}

	/**
	 * Sipariş progress toplamlarına daha önce eklendi mi? (yeni bayrak veya eski _wdp_donation_totals_applied)
	 *
	 * @param \WC_Abstract_Order $order Order.
	 * @return bool
	 */
	public static function is_order_counted_in_progress( $order ) {
		return self::get_order_flag_meta( $order, '_wdp_progress_counted' ) === 'yes'
			|| self::get_order_flag_meta( $order, '_wdp_donation_totals_applied' ) === 'yes';
	}

	/**
	 * Siparişi ürün toplamlarına ekle (bir kez).
	 *
	 * @param \WC_Abstract_Order $order Order.
	 * @return bool True if totals changed.
	 */
	public static function count_order_in_progress_totals( $order ) {
		if ( ! is_object( $order ) ) {
			return false;
		}

		if ( self::get_order_flag_meta( $order, '_wdp_progress_counted' ) === 'yes' ) {
			return false;
		}

		$amounts = self::compute_order_progress_amounts( $order );

		// Eski sürüm (yalnızca "completed") zaten saymış: toplamlara dokunmadan yeni bayrağa taşı.
		if ( self::get_order_flag_meta( $order, '_wdp_donation_totals_applied' ) === 'yes' ) {
			self::store_order_progress_state( $order, $amounts );
			return false;
		}

		foreach ( $amounts as $product_id => $amount ) {
			if ( $amount <= 0 ) {
				continue;
			}
			if ( null === self::update_product_donation_total( $product_id, $amount, false, (int) $order->get_id() ) ) {
				continue;
			}
			self::bump_product_donor_count( $product_id, 1 );
		}

		self::store_order_progress_state( $order, $amounts );
		return true;
	}

	/**
	 * Sayılmış siparişi ürün toplamlarından düş ve bayrağı kaldır.
	 *
	 * @param \WC_Abstract_Order $order Order.
	 * @return bool True if totals changed.
	 */
	public static function uncount_order_from_progress_totals( $order ) {
		if ( ! is_object( $order ) || ! self::is_order_counted_in_progress( $order ) ) {
			return false;
		}

		$amounts = self::get_order_progress_amounts( $order );
		foreach ( $amounts as $product_id => $amount ) {
			if ( $amount <= 0 ) {
				continue;
			}
			// Başlangıçtan önce sayılan sipariş devreden tutarın içindedir; saklanan toplamdan düşülmez.
			if ( Campaign_Formula::is_order_before_start( $order, $product_id ) ) {
				continue;
			}
			self::update_product_donation_total( $product_id, -$amount );
			self::bump_product_donor_count( $product_id, -1 );
		}

		$flag_keys = array( '_wdp_progress_counted', '_wdp_progress_amounts', '_wdp_donation_totals_applied' );
		foreach ( $flag_keys as $flag_key ) {
			$order->delete_meta_data( $flag_key );
		}
		$order->save_meta_data();

		// get_order_flag_meta() post_meta yedeğine de bakar; eski kopyalar bayrağı geri getirmesin.
		$order_id = method_exists( $order, 'get_id' ) ? absint( $order->get_id() ) : 0;
		if ( $order_id ) {
			foreach ( $flag_keys as $flag_key ) {
				delete_post_meta( $order_id, $flag_key );
			}
		}

		return true;
	}

	/**
	 * Kısmi/tam iade (woocommerce_order_refunded): iade edilen satır tutarını ürün toplamından düş.
	 *
	 * @param int $order_id  Parent order id.
	 * @param int $refund_id Refund order id.
	 * @return void
	 */
	public static function sync_order_donation_totals_on_refund( $order_id, $refund_id ) {
		$refund_id = absint( $refund_id );
		if ( ! $refund_id ) {
			return;
		}

		$refund = wc_get_order( $refund_id );
		if ( ! $refund || ! is_a( $refund, 'WC_Order_Refund' ) ) {
			return;
		}

		$order = wc_get_order( absint( $order_id ) );
		if ( ! $order ) {
			return;
		}

		self::apply_refund_to_progress_totals( $order, $refund );
	}

	/**
	 * Refund satırlarını sayılmış sipariş tutarlarından düş.
	 *
	 * Tam iadede durum önce "refunded" olur ve sipariş zaten geri alınmıştır; bu durumda bir şey yapılmaz.
	 *
	 * @param \WC_Abstract_Order $order  Parent order.
	 * @param \WC_Abstract_Order $refund Refund.
	 * @return float Total deducted.
	 */
	public static function apply_refund_to_progress_totals( $order, $refund ) {
		if ( ! is_object( $order ) || ! is_object( $refund ) ) {
			return 0.0;
		}
		if ( self::get_order_flag_meta( $refund, '_wdp_donation_totals_reverted' ) === 'yes' ) {
			return 0.0;
		}
		if ( ! self::is_order_counted_in_progress( $order ) ) {
			return 0.0;
		}

		$stored     = $order->get_meta( '_wdp_progress_amounts', true );
		$has_stored = is_array( $stored );
		// Eski sipariş: tutarlar iade düşülmüş hâliyle hesaplanır (bu iade dahil).
		$amounts = $has_stored ? self::sanitize_progress_amounts( $stored ) : self::compute_order_progress_amounts( $order );

		$deducted = 0.0;
		foreach ( $refund->get_items() as $item ) {
			if ( ! $item instanceof \WC_Order_Item_Product ) {
				continue;
			}
			$product_id = absint( $item->get_product_id() );
			if ( ! $product_id ) {
				continue;
			}

			$refunded = abs( floatval( $item->get_total() ) );
			if ( $refunded <= 0 ) {
				continue;
			}
			// Başlangıçtan önce sayılan sipariş devreden tutarın içindedir; saklanan toplamdan düşülmez.
			if ( Campaign_Formula::is_order_before_start( $order, $product_id ) ) {
				continue;
			}

			if ( $has_stored ) {
				$available = isset( $amounts[ $product_id ] ) ? $amounts[ $product_id ] : 0.0;
				$refunded  = min( $refunded, $available );
				if ( $refunded <= 0 ) {
					continue;
				}
				$amounts[ $product_id ] = max( 0.0, $available - $refunded );
				if ( $amounts[ $product_id ] <= 0 ) {
					self::bump_product_donor_count( $product_id, -1 );
				}
			}

			self::update_product_donation_total( $product_id, -$refunded );
			$deducted += $refunded;
		}

		self::store_order_progress_state( $order, $amounts );
		self::set_order_flag_meta( $refund, '_wdp_donation_totals_reverted', 'yes' );

		return $deducted;
	}

	/**
	 * Ürün → sayılan tutar (iade edilen satır tutarları düşülmüş; kampanya dönemi dışındaki sipariş sayılmaz).
	 *
	 * @param \WC_Abstract_Order $order Order.
	 * @return array<int,float>
	 */
	public static function compute_order_progress_amounts( $order ) {
		$amounts = array();
		foreach ( self::compute_order_progress_lines( $order, true, true, true ) as $product_id => $line ) {
			if ( $line['amount'] > 0 ) {
				$amounts[ $product_id ] = $line['amount'];
			}
		}
		return $amounts;
	}

	/**
	 * Sipariş satırlarını ürün bazında ana para birimine çevirir (salt okunur çözümleme çekirdeği).
	 *
	 * `$refunds` kapalıysa iade düşülmez, `$period` kapalıysa kampanya dönemi denetlenmez; `$log` kapalıysa
	 * dönüştürülemeyen satır günlüğe/ürün metasına yazılmaz (kuru çalıştırma çözümlemesi için).
	 *
	 * @param \WC_Abstract_Order $order   Order.
	 * @param bool              $refunds İade tutarı düşülsün mü.
	 * @param bool              $period  Kampanya dönemi uygulansın mı.
	 * @param bool              $log     Dönüştürülemeyen satır kaydedilsin mi.
	 * @return array<int, array{amount:float, foreign:bool, unconverted:bool}>
	 */
	public static function compute_order_progress_lines( $order, $refunds = true, $period = true, $log = true ) {
		$lines = array();
		if ( ! is_object( $order ) || ! method_exists( $order, 'get_items' ) ) {
			return $lines;
		}

		$currency = Progress_Currency::get_order_currency( $order );

		foreach ( $order->get_items() as $item_id => $item ) {
			if ( ! $item instanceof \WC_Order_Item_Product ) {
				continue;
			}
			$product_id = absint( $item->get_product_id() );
			if ( ! $product_id ) {
				continue;
			}

			if ( $period && ! self::is_order_in_campaign_period( $order, $product_id ) ) {
				continue;
			}

			$line_total = self::resolve_donation_line_total( $item );
			if ( $refunds && method_exists( $order, 'get_total_refunded_for_item' ) ) {
				$line_total -= abs( floatval( $order->get_total_refunded_for_item( $item_id ) ) );
			}
			$line_total = max( 0.0, $line_total );
			if ( $line_total <= 0 ) {
				continue;
			}

			$foreign       = false;
			$unconverted   = false;
			$line_currency = self::resolve_donation_line_currency( $item, $currency );
			$foreign       = '' !== $line_currency && Progress_Currency::get_base_currency() !== $line_currency;
			$converted     = Progress_Currency::convert_to_base( $line_total, $line_currency, $order );
			if ( empty( $converted['ok'] ) ) {
				if ( $log ) {
					self::log_progress_conversion_skip( $order, $product_id, isset( $converted['reason'] ) ? (string) $converted['reason'] : 'unknown' );
				}
				$lines[ $product_id ] = array(
					'amount'      => isset( $lines[ $product_id ] ) ? $lines[ $product_id ]['amount'] : 0.0,
					'foreign'     => true,
					'unconverted' => true,
				);
				continue;
			}
			$line_total = (float) $converted['amount'];

			$prev                 = isset( $lines[ $product_id ] ) ? $lines[ $product_id ] : array(
				'amount'      => 0.0,
				'foreign'     => false,
				'unconverted' => false,
			);
			$lines[ $product_id ] = array(
				'amount'      => $prev['amount'] + max( 0.0, $line_total ),
				'foreign'     => $prev['foreign'] || $foreign,
				'unconverted' => $prev['unconverted'],
			);
		}

		return $lines;
	}

	/**
	 * Ürünün kampanya dönemi (varsa): `_wdp_campaign_starts_at` / `_wdp_campaign_ends_at` (Y-m-d, site saat dilimi,
	 * bitiş günün sonuna dahil) ve `donation_panel_campaign_period` süzgeci. Dönem tanımlı değilse null (tüm zamanlar).
	 *
	 * @param int $product_id Product ID.
	 * @return array{start:int|null,end:int|null}|null Unix zaman damgaları.
	 */
	public static function get_campaign_period( $product_id ) {
		$product_id = absint( $product_id );
		$parse      = static function ( $value, $end_of_day ) {
			$value = is_scalar( $value ) ? trim( (string) $value ) : '';
			if ( '' === $value || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
				return null;
			}
			$tz = function_exists( 'wp_timezone' ) ? wp_timezone() : new \DateTimeZone( 'UTC' );
			$dt = \DateTimeImmutable::createFromFormat( 'Y-m-d H:i:s', $value . ( $end_of_day ? ' 23:59:59' : ' 00:00:00' ), $tz );
			return $dt ? $dt->getTimestamp() : null;
		};
		$start      = $product_id ? $parse( get_post_meta( $product_id, '_wdp_campaign_starts_at', true ), false ) : null;
		$end        = $product_id ? $parse( get_post_meta( $product_id, '_wdp_campaign_ends_at', true ), true ) : null;
		$period     = ( null === $start && null === $end ) ? null : array(
			'start' => $start,
			'end'   => $end,
		);

		/**
		 * Ürün toplamına yalnız bu aralıktaki siparişleri katar (sipariş oluşturma tarihi).
		 *
		 * @param array{start:int|null,end:int|null}|null $period     Dönem ya da null.
		 * @param int                                     $product_id Ürün kimliği.
		 */
		$filtered = apply_filters( 'donation_panel_campaign_period', $period, $product_id );
		return is_array( $filtered ) && ( isset( $filtered['start'] ) || isset( $filtered['end'] ) )
			? array(
				'start' => isset( $filtered['start'] ) ? (int) $filtered['start'] : null,
				'end'   => isset( $filtered['end'] ) ? (int) $filtered['end'] : null,
			)
			: null;
	}

	/**
	 * Sipariş sayılabilir mi: kampanya dönemi (varsa) içinde VE kampanya başlangıcından (`_wdp_campaign_start`;
	 * göç anı) önce sayılmış değil mi? Başlangıçtan önceki siparişler devreden tutarın içindedir (formül: bkz.
	 * `Campaign_Formula`).
	 *
	 * @param \WC_Abstract_Order $order      Order.
	 * @param int               $product_id Product ID.
	 * @return bool
	 */
	public static function is_order_in_campaign_period( $order, $product_id ) {
		return self::is_order_in_period_dates( $order, $product_id ) && ! Campaign_Formula::is_order_before_start( $order, $product_id );
	}

	/**
	 * Sipariş (oluşturma tarihi) ürünün tanımlı kampanya döneminde mi (`_wdp_campaign_starts_at`/`_ends_at`)? Dönem
	 * yoksa ya da tarih okunamazsa true.
	 *
	 * Tarih olarak oluşturma tarihi seçildi: ödeme tarihi çevrimdışı yöntemlerde (havale/çek) boştur; oluşturma
	 * tarihi her siparişte vardır ve bağışçının bağış yaptığı anı gösterir.
	 *
	 * @param \WC_Abstract_Order $order      Order.
	 * @param int               $product_id Product ID.
	 * @return bool
	 */
	public static function is_order_in_period_dates( $order, $product_id ) {
		$period = self::get_campaign_period( $product_id );
		if ( null === $period || ! is_object( $order ) || ! method_exists( $order, 'get_date_created' ) ) {
			return true;
		}
		$created = $order->get_date_created();
		$ts      = is_object( $created ) && method_exists( $created, 'getTimestamp' ) ? (int) $created->getTimestamp() : 0;
		if ( $ts <= 0 ) {
			return true;
		}
		if ( null !== $period['start'] && $ts < $period['start'] ) {
			return false;
		}
		if ( null !== $period['end'] && $ts > $period['end'] ) {
			return false;
		}
		return true;
	}

	/**
	 * İşlem ücreti toplanana girmez: satırdaki wdp_cover_fee yüzdesinden bağış kısmını ayır.
	 *
	 * Kayıt: cover_fee işaretliyken sipariş satır meta `wdp_cover_fee` = yüzde string (veya eski 'yes').
	 * `_custom_price` / satır total şişirilmiş tutardır → bağış = total / (1 + pct/100).
	 *
	 * @param object $item Order line item.
	 * @param float  $line Gross line total.
	 * @return float Net donation amount.
	 */
	public static function strip_cover_fee_from_line_total( $item, $line ) {
		$line = max( 0.0, (float) $line );
		if ( $line <= 0 || ! is_object( $item ) || ! method_exists( $item, 'get_meta' ) ) {
			return $line;
		}

		$fee_raw = $item->get_meta( Order_Meta_Keys::COVER_FEE );
		$pct     = 0.0;
		if ( '' !== $fee_raw && null !== $fee_raw && is_numeric( $fee_raw ) ) {
			$pct = (float) $fee_raw;
		} elseif ( 'yes' === (string) $fee_raw && method_exists( $item, 'get_product_id' ) ) {
			$product = function_exists( 'wc_get_product' ) ? wc_get_product( absint( $item->get_product_id() ) ) : null;
			if ( $product && method_exists( $product, 'get_meta' ) ) {
				$pct = (float) $product->get_meta( '_cover_fee_percent' );
			}
		}

		if ( $pct <= 0 ) {
			return $line;
		}

		$net      = $line / ( 1.0 + ( $pct / 100.0 ) );
		$decimals = function_exists( 'wc_get_price_decimals' ) ? (int) wc_get_price_decimals() : 2;
		return max( 0.0, round( $net, $decimals ) );
	}

	/**
	 * Tek yazım noktası: _wdp_total_donation_amount (delta veya mutlak), negatif olmaz, önbellekler temizlenir.
	 *
	 * Delta modunda toplam henüz hiç yazılmamışsa ('' meta) devreden tutardan başlar.
	 *
	 * @param int   $product_id Product id.
	 * @param float $amount     Delta (positive/negative) or absolute total.
	 * @param bool  $absolute   True to set the total instead of adding.
	 * @param int   $order_id   Delta'yı doğuran sipariş (yazılmamış toplamda "başka ödenmiş sipariş var mı" denetiminde hariç tutulur).
	 * @return float|null New total, or null when nothing was written.
	 */
	public static function update_product_donation_total( $product_id, $amount, $absolute = false, $order_id = 0 ) {
		$product_id = absint( $product_id );
		if ( ! $product_id || ! is_numeric( $amount ) ) {
			return null;
		}
		$amount = floatval( $amount );

		if ( $absolute ) {
			$next_total = max( 0.0, $amount );
		} else {
			if ( 0.0 === (float) $amount ) {
				return null;
			}
			$current = get_post_meta( $product_id, '_wdp_total_donation_amount', true );
			if ( '' === $current || ! is_numeric( $current ) ) {
				// Toplam hiç yazılmamış. Ürünün daha önce ödenmiş siparişleri varsa artımlı yazım toplamı YANLIŞ başlatır:
				// yazma, ürünü "hesap bekliyor" işaretle; yönetici Kampanyalar'da onaylı hesabı yapar.
				if ( $amount < 0 && ! Campaign_Formula::$applying ) {
					// Yazılmamış toplamdan düşüm anlamsızdır (sipariş toplama hiç girmedi); hesap onayını bekler.
					return null;
				}
				if ( ! Campaign_Formula::$applying ) {
					if ( 'yes' === (string) get_post_meta( $product_id, Campaign_Formula::META_PENDING, true )
						|| Campaign_Formula::has_other_paid_orders( $product_id, (int) $order_id ) ) {
						update_post_meta( $product_id, Campaign_Formula::META_PENDING, 'yes' );
						self::clear_product_donation_total_caches( $product_id );
						return null;
					}
				}
				// Önceki sipariş yok: formülün başlangıç değeri devreden tutardır (varsayılan 0).
				$current = Campaign_Formula::get_carried( $product_id );
			}
			$next_total = max( 0.0, floatval( $current ) + $amount );
		}

		update_post_meta( $product_id, '_wdp_total_donation_amount', $next_total );
		self::clear_product_donation_total_caches( $product_id );

		return $next_total;
	}

	/**
	 * Ürünün toplam/bağışçı sayısı önbelleklerini, bağış listesi önbelleğini ve kapsam önbelleğini temizler.
	 *
	 * @param int $product_id Product ID.
	 * @return void
	 */
	public static function invalidate_product_donation_caches( $product_id ) {
		$product_id = absint( $product_id );
		if ( ! $product_id ) {
			return;
		}
		// Progress sayaçları (meta wp-cli ile değişince de düşsün).
		wp_cache_delete( 'wdp_total_donation_' . $product_id, 'wdp_donations' );
		wp_cache_delete( 'wdp_donor_count_' . $product_id, 'wdp_donations' );
		Donations_List::bump_cache();
		Donation_Scope::flush( $product_id );
	}

	/**
	 * Kalıcı silmeden hemen önce (ürün yazı tipi).
	 *
	 * @param int          $post_id Post ID.
	 * @param \WP_Post|null $post    Post object.
	 * @return void
	 */
	public static function purge_product_donation_caches_on_delete( $post_id, $post = null ) {
		$post_id = absint( $post_id );
		if ( $post_id <= 0 ) {
			return;
		}

		if ( $post instanceof \WP_Post ) {
			if ( 'product' !== $post->post_type ) {
				return;
			}
		} elseif ( get_post_type( $post_id ) !== 'product' ) {
			return;
		}

		self::purge_product_donation_caches_for_removal( $post_id );
	}

	/**
	 * Ürün çöpe taşındığında.
	 *
	 * @param int $post_id Post ID.
	 * @return void
	 */
	public static function purge_product_donation_caches_on_trash( $post_id ) {
		$post_id = absint( $post_id );
		if ( $post_id <= 0 || get_post_type( $post_id ) !== 'product' ) {
			return;
		}

		self::purge_product_donation_caches_for_removal( $post_id );
	}

	/**
	 * Invalidate caches when a product post is saved (price, title, stock, etc.).
	 *
	 * @param int     $post_id Post ID.
	 * @param \WP_Post $post    Post object.
	 * @param bool    $update  Whether this is an update.
	 * @return void
	 */
	public static function invalidate_product_donation_caches_on_product_save( $post_id, $post, $update ) {
		unset( $post, $update );

		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}

		if ( wp_is_post_revision( $post_id ) ) {
			return;
		}

		if ( function_exists( 'wp_is_post_autosave' ) && wp_is_post_autosave( $post_id ) ) {
			return;
		}

		self::invalidate_product_donation_caches( (int) $post_id );
	}

	/**
	 * Invalidate caches after WooCommerce persists a product (CRUD / admin / REST).
	 *
	 * @param int $product_id Product ID.
	 * @return void
	 */
	public static function invalidate_product_donation_caches_on_wc_product( $product_id ) {
		self::invalidate_product_donation_caches( absint( $product_id ) );
	}

	/**
	 * Invalidate caches when donation-related product meta is added or updated.
	 *
	 * @param int    $meta_id    Meta row ID (unused).
	 * @param int    $object_id  Post ID.
	 * @param string $meta_key   Meta key.
	 * @param mixed  $meta_value Meta value (unused).
	 * @return void
	 */
	public static function maybe_invalidate_product_donation_caches_on_meta( $meta_id, $object_id, $meta_key, $meta_value ) {
		unset( $meta_id, $meta_value );

		$object_id = absint( $object_id );
		if ( $object_id <= 0 || '' === $meta_key ) {
			return;
		}

		if ( get_post_type( $object_id ) !== 'product' ) {
			return;
		}

		$progress_keys = array(
			'_wdp_total_donation_amount',
			'_wdp_manual_total',
			'_wdp_donor_count',
			'_wdp_progress_unconverted_orders',
			'_wdp_campaign_starts_at',
			'_wdp_campaign_ends_at',
		);
		if ( ! self::is_donation_popup_product_info_meta_key( $meta_key ) && ! in_array( $meta_key, $progress_keys, true ) ) {
			return;
		}

		self::invalidate_product_donation_caches( $object_id );
	}

	/**
	 * Register WC product save hook once (safe if called early or after woocommerce_loaded).
	 *
	 * @return void
	 */
	public static function register_wc_product_cache_invalidation_hook() {
		if ( self::$wc_product_cache_invalidation_hook_registered ) {
			return;
		}
		self::$wc_product_cache_invalidation_hook_registered = true;
		add_action( 'woocommerce_update_product', array( __CLASS__, 'invalidate_product_donation_caches_on_wc_product' ), 10, 1 );
	}

	/**
	 * "wc-completed" → "completed".
	 *
	 * @param mixed $status Raw status.
	 * @return string
	 */
	private static function normalize_order_status_slug( $status ) {
		$status = sanitize_key( (string) $status );
		return strpos( $status, 'wc-' ) === 0 ? substr( $status, 3 ) : $status;
	}

	/**
	 * Dönüşülemeyen satır: kişisel veri yok, günlük + ürün sayacı.
	 *
	 * @param \WC_Abstract_Order $order      Order.
	 * @param int               $product_id Product.
	 * @param string            $reason     Reason code.
	 * @return void
	 */
	private static function log_progress_conversion_skip( $order, $product_id, $reason ) {
		$order_id = ( is_object( $order ) && method_exists( $order, 'get_id' ) ) ? absint( $order->get_id() ) : 0;
		Debug::log(
			sprintf(
				'progress convert skip order=%d product=%d reason=%s',
				$order_id,
				absint( $product_id ),
				sanitize_key( $reason )
			)
		);
		$product_id = absint( $product_id );
		if ( $product_id ) {
			$key     = '_wdp_progress_unconverted_orders';
			$skipped = get_post_meta( $product_id, $key, true );
			$list    = is_array( $skipped ) ? $skipped : array();
			if ( $order_id && ! in_array( $order_id, $list, true ) ) {
				$list[] = $order_id;
				update_post_meta( $product_id, $key, array_values( array_slice( $list, -50 ) ) );
			}
		}
	}

	/**
	 * Siparişte saklanan sayılmış tutarlar (eski siparişte hesaplanır).
	 *
	 * @param \WC_Abstract_Order $order Order.
	 * @return array<int,float>
	 */
	private static function get_order_progress_amounts( $order ) {
		$stored = $order->get_meta( '_wdp_progress_amounts', true );
		if ( is_array( $stored ) ) {
			return self::sanitize_progress_amounts( $stored );
		}
		return self::compute_order_progress_amounts( $order );
	}

	/**
	 * @param array<int|string, mixed> $amounts Raw amounts.
	 * @return array<int,float>
	 */
	private static function sanitize_progress_amounts( array $amounts ) {
		$out = array();
		foreach ( $amounts as $product_id => $amount ) {
			$product_id = absint( $product_id );
			if ( $product_id && is_numeric( $amount ) ) {
				$out[ $product_id ] = max( 0.0, (float) $amount );
			}
		}
		return $out;
	}

	/**
	 * Bayrak + tutarları siparişe yaz (_wdp_progress_counted = yes).
	 *
	 * @param \WC_Abstract_Order $order   Order.
	 * @param array<int, float> $amounts Ürün kimliği => tutar.
	 * @return void
	 */
	private static function store_order_progress_state( $order, array $amounts ) {
		$order->update_meta_data( '_wdp_progress_counted', 'yes' );
		$order->update_meta_data( '_wdp_progress_amounts', self::sanitize_progress_amounts( $amounts ) );
		$order->save_meta_data();
	}

	/**
	 * Satır tutarının para birimi: `_custom_price` bağışçının yazdığı birimdedir (`_wdp_input_currency`; sepette
	 * ödemeden önce para birimi değiştirilmiş olabilir). Damga yoksa ya da tutar satır toplamından geliyorsa sipariş birimi.
	 *
	 * @param \WC_Order_Item_Product $item           Order line item.
	 * @param string                $order_currency Sipariş para birimi.
	 * @return string
	 */
	private static function resolve_donation_line_currency( $item, $order_currency ) {
		$custom_price = $item->get_meta( '_custom_price' );
		if ( '' === $custom_price || ! is_numeric( $custom_price ) || floatval( $custom_price ) <= 0 ) {
			return $order_currency;
		}
		$input = strtoupper( trim( (string) $item->get_meta( '_wdp_input_currency' ) ) );
		return '' !== $input ? $input : $order_currency;
	}

	/**
	 * Resolve effective donation total for an order line.
	 *
	 * @param \WC_Order_Item_Product $item Order line item.
	 * @return float
	 */
	private static function resolve_donation_line_total( $item ) {
		$custom_price = $item->get_meta( '_custom_price' );
		if ( '' !== $custom_price && is_numeric( $custom_price ) && floatval( $custom_price ) > 0 ) {
			$line = floatval( $custom_price ) * max( 1, intval( $item->get_quantity() ) );
		} else {
			$line = max( 0.0, floatval( $item->get_total() ) );
		}

		return self::strip_cover_fee_from_line_total( $item, $line );
	}

	/**
	 * Progress toplamı ve ürün bilgisi önbellek anahtarlarını temizle.
	 *
	 * @param int $product_id Product ID.
	 * @return void
	 */
	private static function clear_product_donation_total_caches( $product_id ) {
		wp_cache_delete( 'wdp_total_donation_' . $product_id, 'wdp_donations' );
		wp_cache_delete( 'wdp_donor_count_' . $product_id, 'wdp_donations' );
		self::invalidate_product_donation_caches( $product_id );
	}

	/**
	 * Bağışçı sayacını artır/azalt.
	 *
	 * @param int $product_id Product id.
	 * @param int $delta      +1 / -1.
	 * @return void
	 */
	private static function bump_product_donor_count( $product_id, $delta ) {
		$product_id = absint( $product_id );
		$delta      = (int) $delta;
		if ( ! $product_id || 0 === $delta ) {
			return;
		}
		$current = (int) get_post_meta( $product_id, '_wdp_donor_count', true );
		self::set_product_donor_count( $product_id, $current + $delta );
	}

	/**
	 * @param int $product_id Product id.
	 * @param int $count      New count (clamped to >= 0).
	 * @return void
	 */
	private static function set_product_donor_count( $product_id, $count ) {
		update_post_meta( $product_id, '_wdp_donor_count', max( 0, (int) $count ) );
		wp_cache_delete( 'wdp_donor_count_' . $product_id, 'wdp_donations' );
	}

	/**
	 * Ürün kaldırıldığında / çöpe gittiğinde ürün + progress bar ile ilgili tüm WDP önbellek anahtarlarını sil.
	 *
	 * @param int $product_id Product ID.
	 * @return void
	 */
	private static function purge_product_donation_caches_for_removal( $product_id ) {
		$product_id = absint( $product_id );
		if ( ! $product_id ) {
			return;
		}

		self::invalidate_product_donation_caches( $product_id );
		wp_cache_delete( 'wdp_total_donation_' . $product_id, 'wdp_donations' );
	}

	/**
	 * Anahtar eklentinin ürün meta envanterinde mi (bkz. Uninstall::product_meta_keys).
	 *
	 * @param string $meta_key Meta key.
	 * @return bool
	 */
	private static function is_donation_popup_product_info_meta_key( $meta_key ) {
		static $lookup = null;

		if ( null === $lookup ) {
			$lookup = array_fill_keys( Uninstall::product_meta_keys(), true );
		}

		return isset( $lookup[ $meta_key ] );
	}
}

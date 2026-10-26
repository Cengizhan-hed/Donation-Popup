<?php
/**
 * Bağışlarım veri modeli: bir kullanıcının siparişlerinden bağış satırları (yalnız kendi siparişleri).
 *
 * - Sipariş okuma WooCommerce API'siyle (HPOS uyumlu: `wc_get_orders`, doğrudan SQL yok).
 * - Bağış alanları eski ve yeni meta anahtarlarıyla `WDP_Order_Meta_Keys` üzerinden okunur.
 * - Makbuz = WooCommerce sipariş görüntüleme bağlantısı; tekrar bağış = ürün sayfası.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\DonorAccount;

defined( 'ABSPATH' ) || exit;

/**
 * Donation_History.
 */
final class Donation_History {

	/**
	 * Siparişe bağlı video bağlantısı meta anahtarı (bağışçıya iletilen video; yoksa Video düğmesi çizilmez).
	 */
	const META_VIDEO_URL = '_donation_panel_video_url';

	/**
	 * Durum -> ton (hap rengi): ok | wait | bad.
	 *
	 * @param string $status Durum slug'ı (`wc-` öneksiz).
	 * @return string
	 */
	public static function tone( $status ) {
		$status = (string) $status;
		if ( in_array( $status, array( 'completed', 'processing' ), true ) ) {
			return 'ok';
		}
		if ( in_array( $status, array( 'cancelled', 'failed', 'refunded' ), true ) ) {
			return 'bad';
		}
		return 'wait';
	}

	/**
	 * Siparişin video bağlantısı (yalnız http/https; `donation_panel_donation_video_url` filtresiyle özelleştirilir).
	 *
	 * @param object $order WC_Order.
	 * @return string
	 */
	public static function video_url( $order ) {
		$url = method_exists( $order, 'get_meta' ) ? (string) $order->get_meta( self::META_VIDEO_URL, true ) : '';
		/**
		 * Bağışçıya iletilen videonun bağlantısı.
		 *
		 * @param string $url   Sipariş meta alanından okunan bağlantı (yoksa boş).
		 * @param object $order Sipariş.
		 */
		$url = (string) apply_filters( 'donation_panel_donation_video_url', $url, $order );
		return preg_match( '#^https?://#i', $url ) ? $url : '';
	}

	/**
	 * Üst özet (toplam, bağış sayısı, bu yıl): yalnız ödenmiş/işlenen siparişlerin mağaza birimindeki bağışları.
	 *
	 * @param array<int, object> $orders         Siparişler (kullanıcının).
	 * @param string             $store_currency Mağaza para birimi.
	 * @param int                $year           Yıl (bu yıl).
	 * @return array{total: float, count: int, year: float}
	 */
	public static function aggregate( array $orders, $store_currency, $year ) {
		$out = array(
			'total' => 0.0,
			'count' => 0,
			'year'  => 0.0,
		);
		foreach ( $orders as $order ) {
			if ( ! is_object( $order ) || 'ok' !== self::tone( (string) $order->get_status() ) ) {
				continue;
			}
			$created = method_exists( $order, 'get_date_created' ) ? $order->get_date_created() : null;
			$in_year = $created && method_exists( $created, 'format' ) && (int) $created->format( 'Y' ) === (int) $year;
			foreach ( self::rows_for_order( $order ) as $row ) {
				++$out['count'];
				if ( (string) $order->get_currency() !== (string) $store_currency ) {
					continue;
				}
				$out['total'] += (float) $row['amount'];
				if ( $in_year ) {
					$out['year'] += (float) $row['amount'];
				}
			}
		}
		return $out;
	}

	/**
	 * Kullanıcının üst özeti (en çok 200 sipariş taranır; WooCommerce sipariş API'si, HPOS uyumlu).
	 *
	 * @param int $user_id Kullanıcı.
	 * @return array{total: float, count: int, year: float}
	 */
	public static function summary( $user_id ) {
		$empty = array(
			'total' => 0.0,
			'count' => 0,
			'year'  => 0.0,
		);
		if ( (int) $user_id <= 0 || ! function_exists( 'wc_get_orders' ) ) {
			return $empty;
		}
		$orders = wc_get_orders(
			array(
				'customer_id' => (int) $user_id,
				'limit'       => 200,
				'orderby'     => 'date',
				'order'       => 'DESC',
				'type'        => 'shop_order',
				'status'      => array( 'wc-completed', 'wc-processing' ),
			)
		);
		$store  = function_exists( 'get_woocommerce_currency' ) ? (string) get_woocommerce_currency() : '';
		return self::aggregate( array_filter( (array) $orders, 'is_object' ), $store, (int) gmdate( 'Y' ) );
	}

	/**
	 * Bir sayfa sipariş döndürür.
	 *
	 * @param int           $user_id  Kullanıcı (0 ise boş).
	 * @param int           $page     Sayfa (1'den).
	 * @param int           $per_page Sayfa başına sipariş.
	 * @param callable|null $fetch    Test için: function ( $user_id, $page, $per_page ): array{orders: array, total: int}.
	 * @return array{rows: array<int, array<string, mixed>>, total: int, pages: int, page: int}
	 */
	public static function page( $user_id, $page = 1, $per_page = 10, $fetch = null ) {
		$user_id  = (int) $user_id;
		$page     = max( 1, (int) $page );
		$per_page = min( 50, max( 1, (int) $per_page ) );
		if ( $user_id <= 0 ) {
			return array(
				'rows'  => array(),
				'total' => 0,
				'pages' => 0,
				'page'  => $page,
			);
		}
		$result = is_callable( $fetch ) ? call_user_func( $fetch, $user_id, $page, $per_page ) : self::fetch_orders( $user_id, $page, $per_page );
		$rows   = array();
		foreach ( (array) $result['orders'] as $order ) {
			// Güvence: başka kullanıcının siparişi asla satıra girmez.
			if ( ! is_object( $order ) || (int) $order->get_customer_id() !== $user_id ) {
				continue;
			}
			foreach ( self::rows_for_order( $order ) as $row ) {
				$rows[] = $row;
			}
		}
		$total = (int) $result['total'];
		return array(
			'rows'  => $rows,
			'total' => $total,
			'pages' => (int) ceil( $total / $per_page ),
			'page'  => $page,
		);
	}

	/**
	 * WooCommerce'ten kullanıcının siparişlerini sayfalı alır.
	 *
	 * @param int $user_id  Kullanıcı.
	 * @param int $page     Sayfa.
	 * @param int $per_page Sayfa başına.
	 * @return array{orders: array<int, object>, total: int}
	 */
	private static function fetch_orders( $user_id, $page, $per_page ) {
		if ( ! function_exists( 'wc_get_orders' ) ) {
			return array(
				'orders' => array(),
				'total'  => 0,
			);
		}
		$found = wc_get_orders(
			array(
				'customer_id' => $user_id,
				'limit'       => $per_page,
				'paged'       => $page,
				'paginate'    => true,
				'orderby'     => 'date',
				'order'       => 'DESC',
				'type'        => 'shop_order',
				'status'      => array_keys( wc_get_order_statuses() ),
			)
		);
		return array(
			'orders' => isset( $found->orders ) ? (array) $found->orders : array(),
			'total'  => isset( $found->total ) ? (int) $found->total : 0,
		);
	}

	/**
	 * Bir siparişin bağış satırları.
	 *
	 * @param object $order WC_Order.
	 * @return array<int, array<string, mixed>>
	 */
	public static function rows_for_order( $order ) {
		$rows = array();
		foreach ( (array) $order->get_items() as $item ) {
			$data       = \WDP_Order_Meta_Keys::get_item_donation_data( $item );
			$custom     = method_exists( $item, 'get_meta' ) ? $item->get_meta( '_custom_price', true ) : '';
			$has_amount = '' !== (string) $custom && null !== $custom;
			if ( empty( $data ) && ! $has_amount ) {
				continue;
			}
			$product_id = method_exists( $item, 'get_product_id' ) ? (int) $item->get_product_id() : 0;
			$status     = (string) $order->get_status();
			$image      = '';
			$campaign   = null;
			if ( $product_id > 0 ) {
				if ( function_exists( 'get_the_post_thumbnail_url' ) ) {
					$image = (string) get_the_post_thumbnail_url( $product_id, 'thumbnail' );
				}
				if ( class_exists( '\\DonationPanel\\Modules\\Campaign\\Progress_Data' ) ) {
					$progress = \DonationPanel\Modules\Campaign\Progress_Data::for_product( $product_id );
					$campaign = is_array( $progress ) && isset( $progress['percent'] ) ? (float) $progress['percent'] : null;
				}
			}
			$store_currency = function_exists( 'get_woocommerce_currency' ) ? (string) get_woocommerce_currency() : '';
			$created        = method_exists( $order, 'get_date_created' ) ? $order->get_date_created() : null;
			$rows[]         = array(
				'order_id'    => (int) $order->get_id(),
				'product_id'  => $product_id,
				'image'       => $image,
				'amount'      => round( (float) $item->get_total(), 6 ),
				'tone'        => self::tone( $status ),
				'video_url'   => self::video_url( $order ),
				'campaign'    => $campaign,
				'can_repeat'  => '' !== $store_currency && $store_currency === (string) $order->get_currency(),
				'date'        => ( $created && function_exists( 'wc_format_datetime' ) ) ? (string) wc_format_datetime( $created ) : '',
				'project'     => (string) $item->get_name(),
				'type'        => self::type_label( $product_id ),
				'amount_html' => function_exists( 'wc_price' ) ? (string) wc_price( (float) $item->get_total(), array( 'currency' => (string) $order->get_currency() ) ) : (string) $item->get_total(),
				'status'      => $status,
				'status_text' => self::status_text( $status ),
				'dedication'  => isset( $data[ \WDP_Order_Meta_Keys::DEDICATION ]['value'] ) ? (string) $data[ \WDP_Order_Meta_Keys::DEDICATION ]['value'] : '',
				'receipt_url' => (string) $order->get_view_order_url(),
				'repeat_url'  => self::repeat_url( $product_id ),
			);
		}
		return $rows;
	}

	/**
	 * Durum metni (WooCommerce'in kendi çevirisi).
	 *
	 * @param string $status Durum slug'ı (`wc-` öneksiz).
	 * @return string
	 */
	private static function status_text( $status ) {
		return function_exists( 'wc_get_order_status_name' ) ? (string) wc_get_order_status_name( $status ) : $status;
	}

	/**
	 * Bağış türü: ürünün ilk kategorisi (WooCommerce standardı); yoksa boş.
	 *
	 * @param int $product_id Ürün.
	 * @return string
	 */
	private static function type_label( $product_id ) {
		if ( $product_id <= 0 || ! function_exists( 'get_the_terms' ) ) {
			return '';
		}
		$terms = get_the_terms( $product_id, 'product_cat' );
		if ( ! is_array( $terms ) || empty( $terms ) ) {
			return '';
		}
		$first = reset( $terms );
		return is_object( $first ) ? (string) $first->name : '';
	}

	/**
	 * Tekrar bağış bağlantısı: yalnız yayımlanmış ürünün sayfası.
	 *
	 * @param int $product_id Ürün.
	 * @return string
	 */
	private static function repeat_url( $product_id ) {
		if ( $product_id <= 0 || 'publish' !== get_post_status( $product_id ) ) {
			return '';
		}
		return (string) get_permalink( $product_id );
	}
}

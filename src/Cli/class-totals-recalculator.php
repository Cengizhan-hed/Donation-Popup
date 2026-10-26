<?php
/**
 * Geriye dönük toplam hesabı: ürün başına eski toplam -> hesaplanan toplam (kuru çalıştırma YAZMAZ).
 *
 * Mevcut `WDP_Utils` mantığını (sipariş tutarı, iade, para birimi dönüşümü) kullanır; siparişin içeriğini
 * DEĞİŞTİRMEZ. Uygulamada yalnız farklı çıkan ürünler yazılır (ürün toplam/bağışçı sayısı meta + eklentinin kendi
 * `_wdp_progress_*` sayım bayrakları; çift sayımı önlemek için).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Cli;

defined( 'ABSPATH' ) || exit;

/**
 * Totals_Recalculator.
 */
final class Totals_Recalculator {

	const META_TOTAL  = '_wdp_total_donation_amount';
	const META_DONORS = '_wdp_donor_count';

	/**
	 * Toplam farkı eşiği (para birimi küsuratı).
	 */
	const EPSILON = 0.005;

	/**
	 * Tüm bağış ürünleri: eklentinin toplamını tuttuğu ya da bağış ürünü sayılan ürünler.
	 *
	 * @return int[]
	 */
	public function all_product_ids() {
		$posts = get_posts(
			array(
				'post_type'   => 'product',
				'post_status' => 'any',
				'numberposts' => -1,
				'fields'      => 'ids',
			)
		);
		$ids   = array();
		foreach ( (array) $posts as $id ) {
			$id = absint( $id );
			if ( ! $id ) {
				continue;
			}
			$has_total = '' !== get_post_meta( $id, self::META_TOTAL, true );
			if ( $has_total || ( class_exists( 'WDP_Donation_Scope' ) && \WDP_Donation_Scope::is_donation_product( $id ) ) ) {
				$ids[] = $id;
			}
		}
		return $ids;
	}

	/**
	 * Hesaplar. VARSAYILAN HER ZAMAN KURU ÇALIŞTIRMA: yazma yalnız `$dry_run` false VE `$allow_write` true
	 * (CLI'da `--apply --i-understand`) iken olur. `$dry_run` false ama izin yoksa istisna fırlatılır, hiçbir şey yazılmaz.
	 *
	 * Yazma yalnız hesaplanan toplamı/bağışçı sayısını günceller; elle eklenen tutara (`_wdp_manual_total`) asla dokunmaz.
	 *
	 * @param int[] $product_ids Ürün kimlikleri.
	 * @param bool  $dry_run     True (varsayılan) ise hiçbir yazma yok.
	 * @param bool  $allow_write Yazma için ayrı açık izin (varsayılan kapalı).
	 * @return array{rows: array<int, array<string, mixed>>, changed: int, written: int, unconverted: int}
	 * @throws \RuntimeException Yazma isteği izinsizse.
	 */
	public function run( array $product_ids, $dry_run = true, $allow_write = false ) {
		if ( ! $dry_run && ! $allow_write ) {
			throw new \RuntimeException( 'recalc-totals: write mode is disabled; pass the explicit write permission (--apply --i-understand).' );
		}
		$ids      = array_values( array_unique( array_filter( array_map( 'absint', $product_ids ) ) ) );
		$computed = \WDP_Utils::recalculate_product_donation_totals( $ids, true );
		$analysis = $this->analyze( $ids );

		$rows    = array();
		$changed = array();
		$unconv  = 0;
		foreach ( $ids as $id ) {
			$new       = isset( $computed[ $id ] ) ? $computed[ $id ] : array(
				'total'       => 0.0,
				'donors'      => 0,
				'orders'      => 0,
				'unconverted' => 0,
			);
			$old_total = get_post_meta( $id, self::META_TOTAL, true );
			$old_donor = get_post_meta( $id, self::META_DONORS, true );
			$old_total = ( '' === $old_total || ! is_numeric( $old_total ) ) ? null : (float) $old_total;
			$old_donor = ( '' === $old_donor || ! is_numeric( $old_donor ) ) ? null : (int) $old_donor;

			$differs = null === $old_total
				|| null === $old_donor
				|| abs( $old_total - (float) $new['total'] ) >= self::EPSILON
				|| $old_donor !== (int) $new['donors'];
			if ( $differs ) {
				$changed[] = $id;
			}
			$unconv += (int) $new['unconverted'];

			$new_total   = round( (float) $new['total'], 2 );
			$rows[ $id ] = array(
				'product_id'  => $id,
				'old_total'   => $old_total,
				'new_total'   => $new_total,
				'old_donors'  => $old_donor,
				'new_donors'  => (int) $new['donors'],
				'orders'      => (int) $new['orders'],
				'unconverted' => (int) $new['unconverted'],
				'changed'     => $differs,
				'written'     => false,
			) + self::migration_suggestion( $old_total, $new_total, \WDP_Utils::get_manual_total( $id ), isset( $analysis[ $id ] ) ? $analysis[ $id ] : self::empty_breakdown(), (int) $new['unconverted'] );
		}

		$written = 0;
		if ( ! $dry_run && $changed ) {
			\WDP_Utils::recalculate_product_donation_totals( $changed, false );
			foreach ( $changed as $id ) {
				$rows[ $id ]['written'] = true;
				++$written;
			}
		}

		return array(
			'rows'        => array_values( $rows ),
			'changed'     => count( $changed ),
			'written'     => $written,
			'unconverted' => $unconv,
		);
	}

	/**
	 * Boş neden ayrıştırması.
	 *
	 * @return array{counted:float, refunds:float, period_out:float, statuses:array<string,float>, foreign_lines:int}
	 */
	private static function empty_breakdown() {
		return array(
			'counted'       => 0.0,
			'refunds'       => 0.0,
			'period_out'    => 0.0,
			'statuses'      => array(),
			'foreign_lines' => 0,
		);
	}

	/**
	 * Göç ÖNERİSİ (uygulanmaz): fark = saklanan - yeni hesaplanan.
	 *
	 * - fark > 0: elle_eklenen = fark (bağışçının gördüğü sayı değişmez).
	 * - fark < 0: elle_eklenen = 0; gösterilen toplam ARTAR (saklanan değer aşağı çekilmez; karar için işaretlenir).
	 *
	 * Neden ayrıştırması: fark, sırayla durum (ödenmemiş siparişler), dönem dışı, iade bileşenlerine paylaştırılır;
	 * kalan elle giriş sayılır. Negatif farkta para birimi (yabancı birimli satır var) ya da veri yok.
	 *
	 * @param float|null          $old_total       Saklanan toplam.
	 * @param float               $new_total       Yeni hesaplanan.
	 * @param float               $manual_existing Mevcut elle eklenen.
	 * @param array<string,mixed> $breakdown       Çözümleme.
	 * @param int                 $unconverted     Kuru bulunamayan satır sayısı.
	 * @return array<string, mixed>
	 */
	public static function migration_suggestion( $old_total, $new_total, $manual_existing, array $breakdown, $unconverted = 0 ) {
		$statuses   = isset( $breakdown['statuses'] ) ? (array) $breakdown['statuses'] : array();
		$status_sum = 0.0;
		foreach ( $statuses as $key => $sum ) {
			if ( 'refunded' !== $key ) {
				$status_sum += (float) $sum;
			}
		}
		// Tam iade edilmiş (durumu "refunded") siparişler iade bileşenine yazılır.
		$refund_sum = (float) ( isset( $breakdown['refunds'] ) ? $breakdown['refunds'] : 0.0 ) + (float) ( isset( $statuses['refunded'] ) ? $statuses['refunded'] : 0.0 );
		$period_sum = (float) ( isset( $breakdown['period_out'] ) ? $breakdown['period_out'] : 0.0 );
		$foreign    = (int) ( isset( $breakdown['foreign_lines'] ) ? $breakdown['foreign_lines'] : 0 );

		$parts = array(
			'status' => 0.0,
			'period' => 0.0,
			'refund' => 0.0,
			'manual' => 0.0,
		);
		$diff  = null;
		$label = '-';
		if ( null === $old_total ) {
			$label = 'no_data';
		} else {
			$diff = round( $old_total - $new_total, 2 );
			if ( $diff > self::EPSILON ) {
				$left = $diff;
				foreach ( array(
					'status' => $status_sum,
					'period' => $period_sum,
					'refund' => $refund_sum,
				) as $name => $cand ) {
					$take           = min( max( 0.0, $cand ), $left );
					$parts[ $name ] = round( $take, 2 );
					$left           = round( $left - $take, 2 );
				}
				$parts['manual'] = max( 0.0, $left );
				arsort( $parts );
				$label = (string) key( $parts );
				if ( $unconverted > 0 && 'manual' === $label ) {
					$label = 'currency';
				}
			} elseif ( $diff < -self::EPSILON ) {
				$label = ( $foreign > 0 || $unconverted > 0 ) ? 'currency' : 'no_data';
			} else {
				$diff = 0.0;
			}
		}

		$suggested = ( null !== $diff && $diff > 0 ) ? $diff : 0.0;
		$old_shown = null === $old_total ? 0.0 : $old_total;
		$after     = round( $new_total + (float) $manual_existing + $suggested, 2 );
		return array(
			'diff'              => $diff,
			'manual_existing'   => round( (float) $manual_existing, 2 ),
			'suggested_manual'  => $suggested,
			'display_after'     => $after,
			'display_increases' => $after > $old_shown + self::EPSILON && null !== $old_total,
			'reason'            => $label,
			'breakdown'         => array(
				'status'            => round( $status_sum, 2 ),
				'status_detail'     => array_map(
					static function ( $v ) {
						return round( (float) $v, 2 );
					},
					$statuses
				),
				'period_out'        => round( $period_sum, 2 ),
				'refund'            => round( $refund_sum, 2 ),
				'foreign_lines'     => $foreign,
				'unconverted_lines' => (int) $unconverted,
				'assigned'          => array_map(
					static function ( $v ) {
						return round( (float) $v, 2 );
					},
					$parts
				),
			),
		);
	}

	/**
	 * SALT OKUNUR neden çözümlemesi: ürün başına, durum/dönem/iade bileşenlerini ayrı ayrı toplar. Siparişlere,
	 * ürünlere ya da seçeneklere hiçbir şey yazmaz (dönüştürülemeyen satır günlüğü bile kapalı). Kişisel veri okunmaz.
	 *
	 * @param int[] $ids Ürün kimlikleri.
	 * @return array<int, array{counted:float, refunds:float, period_out:float, statuses:array<string,float>, foreign_lines:int}>
	 */
	private function analyze( array $ids ) {
		$out = array();
		foreach ( $ids as $id ) {
			$out[ $id ] = self::empty_breakdown();
		}
		if ( ! $ids || ! function_exists( 'wc_get_orders' ) ) {
			return $out;
		}
		$paid = \WDP_Utils::get_progress_paid_statuses();
		$all  = function_exists( 'wc_get_order_statuses' ) ? array_keys( (array) wc_get_order_statuses() ) : array();
		if ( ! $all ) {
			$all = array( 'wc-completed', 'wc-processing', 'wc-on-hold', 'wc-pending', 'wc-cancelled', 'wc-failed', 'wc-refunded' );
		}

		$page = 1;
		do {
			$query = wc_get_orders(
				array(
					'type'     => 'shop_order',
					'status'   => $all,
					'limit'    => 200,
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
				$full = \WDP_Utils::compute_order_progress_lines( $order, false, false, false );
				$hits = array_intersect_key( $full, $out );
				if ( ! $hits ) {
					continue;
				}
				$net    = \WDP_Utils::compute_order_progress_lines( $order, true, false, false );
				$status = method_exists( $order, 'get_status' ) ? sanitize_key( (string) $order->get_status() ) : '';
				$status = 0 === strpos( $status, 'wc-' ) ? substr( $status, 3 ) : $status;
				foreach ( $hits as $pid => $line ) {
					if ( $line['foreign'] ) {
						++$out[ $pid ]['foreign_lines'];
					}
					if ( $line['amount'] <= 0 ) {
						continue;
					}
					if ( in_array( $status, $paid, true ) ) {
						$net_amount = isset( $net[ $pid ] ) ? $net[ $pid ]['amount'] : 0.0;
						if ( \WDP_Utils::is_order_in_campaign_period( $order, $pid ) ) {
							$out[ $pid ]['counted'] += $net_amount;
							$out[ $pid ]['refunds'] += max( 0.0, $line['amount'] - $net_amount );
						} else {
							$out[ $pid ]['period_out'] += $net_amount;
						}
					} else {
						$key                             = '' === $status ? 'other' : $status;
						$out[ $pid ]['statuses'][ $key ] = ( isset( $out[ $pid ]['statuses'][ $key ] ) ? $out[ $pid ]['statuses'][ $key ] : 0.0 ) + $line['amount'];
					}
				}
			}
			++$page;
		} while ( $page <= (int) $query->max_num_pages );

		return $out;
	}
}

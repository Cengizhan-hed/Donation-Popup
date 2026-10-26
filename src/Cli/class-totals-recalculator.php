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
	 * Hesaplar; `$dry_run` kapalıysa yalnız farklı ürünleri yazar.
	 *
	 * @param int[] $product_ids Ürün kimlikleri.
	 * @param bool  $dry_run     True ise hiçbir yazma yok.
	 * @return array{rows: array<int, array<string, mixed>>, changed: int, written: int, unconverted: int}
	 */
	public function run( array $product_ids, $dry_run ) {
		$ids      = array_values( array_unique( array_filter( array_map( 'absint', $product_ids ) ) ) );
		$computed = \WDP_Utils::recalculate_product_donation_totals( $ids, true );

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

			$rows[ $id ] = array(
				'product_id'  => $id,
				'old_total'   => $old_total,
				'new_total'   => round( (float) $new['total'], 2 ),
				'old_donors'  => $old_donor,
				'new_donors'  => (int) $new['donors'],
				'orders'      => (int) $new['orders'],
				'unconverted' => (int) $new['unconverted'],
				'changed'     => $differs,
				'written'     => false,
			);
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
}

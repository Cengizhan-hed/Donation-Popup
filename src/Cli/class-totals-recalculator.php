<?php
/**
 * Kampanya toplamı önizlemesi (SALT OKUNUR): ürün başına saklanan -> formülle hesaplanan toplam.
 *
 * Formül tek yerdedir (`Campaign_Formula`): devreden tutar + kampanya başlangıcından sonra ödenmiş siparişler.
 * Bu sınıf hiçbir şey yazmaz; yazma yalnız yönetici onayıyla Kampanyalar ekranında yapılır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Cli;

use DonationPanel\Domain\Campaign_Formula;
use DonationPanel\Domain\Campaign_Totals;
use DonationPanel\Domain\Donation_Scope;

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
			if ( $has_total || ( Donation_Scope::is_donation_product( $id ) ) ) {
				$ids[] = $id;
			}
		}
		return $ids;
	}

	/**
	 * Önizleme satırlarını üretir. Yazma YOKTUR (sınıfın başka kipi yoktur).
	 *
	 * @param int[] $product_ids Ürün kimlikleri.
	 * @return array{rows: array<int, array<string, mixed>>, changed: int, unconverted: int}
	 */
	public function run( array $product_ids ) {
		$ids       = array_values( array_unique( array_filter( array_map( 'absint', $product_ids ) ) ) );
		$rows      = array();
		$changed   = 0;
		$unconv    = 0;
		$donors_of = static function ( $id ) {
			$raw = get_post_meta( $id, self::META_DONORS, true );
			return ( '' === $raw || ! is_numeric( $raw ) ) ? null : (int) $raw;
		};
		foreach ( $ids as $id ) {
			$p       = Campaign_Formula::preview( $id );
			$differs = null === $p['stored'] || abs( (float) $p['diff'] ) >= self::EPSILON;
			if ( $differs ) {
				++$changed;
			}
			$unconv     += (int) $p['unconverted'];
			$rows[ $id ] = array(
				'product_id'  => $id,
				'stored'      => $p['stored'],
				'computed'    => $p['computed'],
				'diff'        => $p['diff'],
				'carried'     => $p['carried'],
				'start'       => $p['start'],
				'orders'      => (int) $p['orders'],
				'donors'      => $donors_of( $id ),
				'unconverted' => (int) $p['unconverted'],
				'manual'      => Campaign_Totals::get_manual_total( $id ),
				'changed'     => $differs,
			);
		}
		return array(
			'rows'        => array_values( $rows ),
			'changed'     => $changed,
			'unconverted' => $unconv,
		);
	}
}

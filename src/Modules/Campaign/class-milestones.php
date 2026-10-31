<?php
/**
 * Ara hedefler: ürün metasından (`_donation_panel_milestones`) saf ayrıştırma ve vuruş hesabı.
 *
 * Biçim: her satır `yüzde=etiket` (1–100), ör. `40=Well 1`. Kişi verisi içermez.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Campaign;

defined( 'ABSPATH' ) || exit;

/**
 * Milestones.
 */
final class Milestones {

	/**
	 * Ürün meta anahtarı.
	 */
	const META_KEY = '_donation_panel_milestones';

	/**
	 * En çok ara hedef sayısı.
	 */
	const MAX = 6;

	/**
	 * Ham metni ayrıştırır (geçersiz satırlar atlanır; yüzdeye göre sıralı; tekrarsız).
	 *
	 * @param string $raw Ham metin.
	 * @return array<int, array{at: float, label: string}>
	 */
	public static function parse( $raw ) {
		$out = array();
		foreach ( preg_split( '/\r\n|\r|\n/', (string) $raw ) as $line ) {
			$line = trim( (string) $line );
			if ( '' === $line || false === strpos( $line, '=' ) ) {
				continue;
			}
			list( $at, $label ) = array_map( 'trim', explode( '=', $line, 2 ) );
			if ( ! is_numeric( $at ) ) {
				continue;
			}
			$at = (float) $at;
			if ( $at <= 0 || $at > 100 ) {
				continue;
			}
			$label = sanitize_text_field( $label );
			if ( '' === $label ) {
				continue;
			}
			$out[ (string) $at ] = array(
				'at'    => $at,
				'label' => $label,
			);
		}
		$out = array_values( $out );
		usort(
			$out,
			static function ( $a, $b ) {
				return $a['at'] <=> $b['at'];
			}
		);
		return array_slice( $out, 0, self::MAX );
	}

	/**
	 * Yüzdeye göre vuruş durumu ekler.
	 *
	 * @param array<int, array{at: float, label: string}> $milestones Ara hedefler.
	 * @param float                                       $percent    Gerçekleşen yüzde (0–100).
	 * @return array<int, array{at: float, label: string, hit: bool}>
	 */
	public static function with_hits( array $milestones, $percent ) {
		$out = array();
		foreach ( $milestones as $milestone ) {
			$milestone['hit'] = (float) $percent + 0.00001 >= $milestone['at'];
			$out[]            = $milestone;
		}
		return $out;
	}

	/**
	 * Ürünün ara hedefleri.
	 *
	 * @param int $product_id Ürün.
	 * @return array<int, array{at: float, label: string}>
	 */
	public static function for_product( $product_id ) {
		$raw = (string) get_post_meta( (int) $product_id, self::META_KEY, true );
		$all = self::parse( $raw );

		/**
		 * Kampanya ara hedeflerini değiştirir.
		 *
		 * @param array<int, array{at: float, label: string}> $all        Ara hedefler.
		 * @param int                                         $product_id Ürün.
		 */
		$filtered = apply_filters( 'donation_panel_milestones', $all, (int) $product_id );
		return is_array( $filtered ) ? array_values( $filtered ) : $all;
	}
}

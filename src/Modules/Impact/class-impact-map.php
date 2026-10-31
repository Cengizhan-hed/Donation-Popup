<?php
/**
 * Etki ifadeleri: tutar -> somut karşılık ("40 = 1 food parcel"). Saf ayrıştırma ve hesap.
 *
 * Biçim: her satır `birim=tekil|çoğul` (çoğul yoksa tekil kullanılır); `{count}` adet yerine geçer.
 * Örnek: `40={count} food parcel|{count} food parcels`. Bir tutar için, tutara en yakın ALT birim seçilir
 * ve adet = tam bölüm.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Impact;

defined( 'ABSPATH' ) || exit;

/**
 * Impact_Map.
 */
final class Impact_Map {

	/**
	 * Ürün meta anahtarı.
	 */
	const META_KEY = '_donation_panel_impact';

	/**
	 * En çok kademe sayısı.
	 */
	const MAX_TIERS = 8;

	/**
	 * Ham metni kademelere ayrıştırır (birime göre artan).
	 *
	 * @param string $raw Ham metin.
	 * @return array<int, array{unit: float, one: string, other: string}>
	 */
	public static function parse( $raw ) {
		$tiers = array();
		foreach ( preg_split( '/\r\n|\r|\n/', (string) $raw ) as $line ) {
			$line = trim( (string) $line );
			if ( '' === $line || false === strpos( $line, '=' ) ) {
				continue;
			}
			list( $unit, $phrase ) = array_map( 'trim', explode( '=', $line, 2 ) );
			if ( ! is_numeric( $unit ) || (float) $unit <= 0 ) {
				continue;
			}
			$forms = array_map( 'sanitize_text_field', explode( '|', $phrase, 2 ) );
			$one   = trim( (string) $forms[0] );
			if ( '' === $one ) {
				continue;
			}
			$other                           = isset( $forms[1] ) && '' !== trim( $forms[1] ) ? trim( $forms[1] ) : $one;
			$tiers[ (string) (float) $unit ] = array(
				'unit'  => (float) $unit,
				'one'   => $one,
				'other' => $other,
			);
		}
		$tiers = array_values( $tiers );
		usort(
			$tiers,
			static function ( $a, $b ) {
				return $a['unit'] <=> $b['unit'];
			}
		);
		return array_slice( $tiers, 0, self::MAX_TIERS );
	}

	/**
	 * Tutarın karşılığı; kademeden küçükse null.
	 *
	 * @param float                                                        $amount Tutar.
	 * @param array<int, array{unit: float, one: string, other: string}> $tiers  Kademeler.
	 * @return array{count: int, text: string}|null
	 */
	public static function describe( $amount, array $tiers ) {
		$chosen = null;
		foreach ( $tiers as $tier ) {
			if ( (float) $amount + 0.00001 >= $tier['unit'] ) {
				$chosen = $tier;
			}
		}
		if ( null === $chosen ) {
			return null;
		}
		$count = (int) floor( ( (float) $amount + 0.00001 ) / $chosen['unit'] );
		$count = max( 1, $count );
		$form  = 1 === $count ? $chosen['one'] : $chosen['other'];
		$num   = function_exists( 'number_format_i18n' ) ? (string) number_format_i18n( $count ) : (string) $count;
		return array(
			'count' => $count,
			'text'  => str_replace( '{count}', $num, $form ),
		);
	}

	/**
	 * Hazır tutarlar için ifadeler (karşılığı olmayanlar atlanır).
	 *
	 * @param float[]                                                      $amounts Tutarlar.
	 * @param array<int, array{unit: float, one: string, other: string}> $tiers   Kademeler.
	 * @return array<int, array{amount: float, text: string}>
	 */
	public static function for_amounts( array $amounts, array $tiers ) {
		$out = array();
		foreach ( $amounts as $amount ) {
			$described = self::describe( (float) $amount, $tiers );
			if ( null !== $described ) {
				$out[] = array(
					'amount' => (float) $amount,
					'text'   => $described['text'],
				);
			}
		}
		return $out;
	}

	/**
	 * Ürünün kademeleri: ürün metası, yoksa site ayarı; `donation_panel_impact_map` ile değişir.
	 *
	 * @param int    $product_id Ürün.
	 * @param string $site_raw   Site geneli ham metin (ayar `impact.map`).
	 * @return array<int, array{unit: float, one: string, other: string}>
	 */
	public static function tiers_for_product( $product_id, $site_raw = '' ) {
		$raw   = (string) get_post_meta( (int) $product_id, self::META_KEY, true );
		$tiers = self::parse( '' !== trim( $raw ) ? $raw : $site_raw );

		/**
		 * Etki ifadesi kademelerini değiştirir.
		 *
		 * @param array<int, array{unit: float, one: string, other: string}> $tiers      Kademeler.
		 * @param int                                                        $product_id Ürün.
		 */
		$filtered = apply_filters( 'donation_panel_impact_map', $tiers, (int) $product_id );
		return is_array( $filtered ) ? array_values( $filtered ) : $tiers;
	}
}

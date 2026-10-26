<?php
/**
 * Kampanya ilerleme verisi: mevcut kampanya sınıflarından okur, kişi verisi içermez.
 *
 * Toplamlar mağaza ana para biriminde tutulur; gösterim değerleri etkin para birimine
 * yalnız `donation_panel_convert_amount` filtresiyle çevrilir (varsayılan: dönüşüm yok).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Campaign;

use DonationPanel\Domain\Campaign_Goal;
use DonationPanel\Domain\Campaign_Totals;
use DonationPanel\Domain\Progress_Currency;

defined( 'ABSPATH' ) || exit;

/**
 * Progress_Data.
 */
final class Progress_Data {

	/**
	 * Önbellek süresi (sn).
	 */
	const CACHE_TTL = 30;

	/**
	 * Bir ürünün ilerleme verisi; kampanya kapalıysa null.
	 *
	 * @param int $product_id Ürün.
	 * @return array<string, mixed>|null
	 */
	public static function for_product( $product_id ) {
		$product_id = absint( $product_id );
		if ( $product_id < 1 || ! Campaign_Goal::is_campaign_product( $product_id ) ) {
			return null;
		}
		$goal = Campaign_Goal::resolve_goal_amount( $product_id );
		if ( $goal <= 0 ) {
			return null;
		}

		$currency  = Progress_Currency::get_active_currency();
		$cache_key = 'dp_progress_' . $product_id . '_' . $currency;
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$raised = Campaign_Goal::get_confirmed_total( $product_id );
		$donors = (int) Campaign_Totals::get_donor_count( $product_id );
		$data   = self::build(
			array(
				'product_id' => $product_id,
				'raised'     => $raised,
				'goal'       => $goal,
				'donors'     => $donors,
				'milestones' => Milestones::for_product( $product_id ),
				'reached'    => Campaign_Goal::is_goal_reached( $product_id ),
				'decimals'   => function_exists( 'wc_get_price_decimals' ) ? (int) wc_get_price_decimals() : 2,
				'symbol'     => function_exists( 'get_woocommerce_currency_symbol' ) ? html_entity_decode( (string) get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8' ) : '',
				'currency'   => $currency,
			)
		);
		set_transient( $cache_key, $data, self::CACHE_TTL );
		return $data;
	}

	/**
	 * Girdiden yanıt gövdesi üretir (saf; test edilebilir).
	 *
	 * @param array<string, mixed> $in product_id, raised, goal, donors, milestones, reached, decimals, symbol, currency.
	 * @return array<string, mixed>
	 */
	public static function build( array $in ) {
		$goal    = max( 0.0, (float) $in['goal'] );
		$raised  = max( 0.0, (float) $in['raised'] );
		$percent = $goal > 0 ? min( 100.0, ( $raised / $goal ) * 100.0 ) : 0.0;
		$percent = round( $percent, 1 );

		return array(
			'product_id' => (int) $in['product_id'],
			'raised'     => self::display_amount( $raised ),
			'goal'       => self::display_amount( $goal ),
			'remaining'  => self::display_amount( max( 0.0, $goal - $raised ) ),
			'percent'    => $percent,
			'donors'     => max( 0, (int) $in['donors'] ),
			'reached'    => ! empty( $in['reached'] ),
			'milestones' => Milestones::with_hits( (array) $in['milestones'], $percent ),
			'currency'   => array(
				'code'     => (string) $in['currency'],
				'symbol'   => (string) $in['symbol'],
				'decimals' => max( 0, (int) $in['decimals'] ),
			),
		);
	}

	/**
	 * Ana birimdeki tutarı gösterim birimine çevirir (filtre yoksa aynı).
	 *
	 * @param float $amount Ana birimde tutar.
	 * @return float
	 */
	private static function display_amount( $amount ) {
		return (float) Progress_Currency::from_store_amount( $amount );
		return (float) $amount;
	}
}

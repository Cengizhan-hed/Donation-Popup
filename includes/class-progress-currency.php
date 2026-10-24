<?php
/**
 * Progress toplanan tutar: para birimi dönüşümü (kur kaynağı filtreyle; eklentiye özel okuyucular includes/compat/ altında).
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Progress_Currency
 */
class WDP_Progress_Currency {

	/**
	 * Mağaza ana para birimi.
	 *
	 * @return string
	 */
	public static function get_base_currency() {
		if (function_exists('get_woocommerce_currency')) {
			return strtoupper((string) get_woocommerce_currency());
		}
		return 'TRY';
	}

	/**
	 * Sipariş para birimi.
	 *
	 * @param WC_Abstract_Order|null $order Order.
	 * @return string
	 */
	public static function get_order_currency($order) {
		if (is_object($order) && method_exists($order, 'get_currency')) {
			$c = strtoupper((string) $order->get_currency());
			if ($c !== '') {
				return $c;
			}
		}
		return self::get_base_currency();
	}

	/**
	 * Siparişe kaydedilmiş kur (1 birim ana para → X sipariş para birimi).
	 * Kaynak: `wdp_order_exchange_rate` filtresi (standart Woo verisinde kur yoktur).
	 *
	 * @param WC_Abstract_Order|null $order    Order.
	 * @param string                 $currency Order currency.
	 * @return float|null Rate or null if unknown.
	 */
	public static function get_order_rate($order, $currency = '') {
		$currency = strtoupper($currency !== '' ? $currency : self::get_order_currency($order));
		$base     = self::get_base_currency();
		if ($currency === '' || $currency === $base) {
			return 1.0;
		}
		if (!is_object($order) || !method_exists($order, 'get_meta')) {
			return self::get_live_rate($currency);
		}

		/**
		 * Siparişe kaydedilmiş kur (1 ana birim = X sipariş para birimi).
		 * Çoklu para birimi eklentilerinin okuyucuları includes/compat/ altındadır.
		 *
		 * @param float|null        $rate     Rate or null when unknown.
		 * @param WC_Abstract_Order $order    Order.
		 * @param string            $currency Order currency.
		 * @param string            $base     Store base currency.
		 */
		$stored = apply_filters('wdp_order_exchange_rate', null, $order, $currency, $base);
		if ($stored !== null && is_numeric($stored) && (float) $stored > 0) {
			return (float) $stored;
		}

		return self::get_live_rate($currency);
	}

	/**
	 * Canlı kur (`wdp_progress_live_rate` filtresi); yoksa null.
	 *
	 * @param string $currency Currency code.
	 * @return float|null
	 */
	public static function get_live_rate($currency) {
		$currency = strtoupper((string) $currency);
		$base     = self::get_base_currency();
		if ($currency === '' || $currency === $base) {
			return 1.0;
		}

		/**
		 * Canlı kur (çoklu para birimi bağdaştırıcıları bu filtreye bağlanır).
		 *
		 * @param float|null $rate     Rate (order_currency per 1 base) or null.
		 * @param string     $currency Order currency.
		 * @param string     $base     Base currency.
		 */
		$filtered = apply_filters('wdp_progress_live_rate', null, $currency, $base);
		if ($filtered !== null && is_numeric($filtered) && (float) $filtered > 0) {
			return (float) $filtered;
		}

		return null;
	}

	/**
	 * Sipariş para birimindeki tutarı mağaza ana para birimine çevir.
	 * Kural: fiyat_sipariş = fiyat_ana * rate → ana = sipariş / rate.
	 *
	 * @param float                  $amount   Amount in order currency.
	 * @param string                 $currency Order currency.
	 * @param WC_Abstract_Order|null $order    Optional order (for stored rate).
	 * @return array{ok:bool,amount:float,reason:string}
	 */
	public static function convert_to_base($amount, $currency, $order = null) {
		$amount   = (float) $amount;
		$currency = strtoupper((string) $currency);
		$base     = self::get_base_currency();

		$result = array(
			'ok'     => true,
			'amount' => $amount,
			'reason' => '',
		);

		if ($amount == 0.0 || $currency === '' || $currency === $base) {
			/**
			 * Progress tutar dönüşümü (filtrelenebilir).
			 *
			 * @param array                  $result   ok/amount/reason.
			 * @param float                  $amount   Original.
			 * @param string                 $currency From.
			 * @param string                 $base     To.
			 * @param WC_Abstract_Order|null $order    Order.
			 */
			return apply_filters('wdp_progress_convert_amount', $result, $amount, $currency, $base, $order);
		}

		$rate = self::get_order_rate($order, $currency);
		if ($rate === null || $rate <= 0) {
			$result['ok']     = false;
			$result['amount'] = 0.0;
			$result['reason'] = 'missing_rate';
			return apply_filters('wdp_progress_convert_amount', $result, $amount, $currency, $base, $order);
		}

		$result['amount'] = $amount / $rate;
		return apply_filters('wdp_progress_convert_amount', $result, $amount, $currency, $base, $order);
	}
}

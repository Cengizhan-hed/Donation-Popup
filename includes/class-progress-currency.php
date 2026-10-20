<?php
/**
 * Progress toplanan tutar: para birimi dönüşümü (Curcy uyumlu, sert bağımlılık yok).
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
	 * Curcy: wmc_order_info[currency]['rate'] veya wmc_order_rate; WOOCS: _woocs_order_rate.
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

		// Curcy: order info array keyed by currency.
		$info = $order->get_meta('wmc_order_info', true);
		if (!is_array($info)) {
			$info = $order->get_meta('_wmc_order_info', true);
		}
		if (is_array($info)) {
			if (isset($info[ $currency ]) && is_array($info[ $currency ]) && isset($info[ $currency ]['rate'])) {
				$rate = (float) $info[ $currency ]['rate'];
				if ($rate > 0) {
					return $rate;
				}
			}
			// Bazı sürümler tek düzey 'rate' + 'currency' tutar.
			if (isset($info['rate'], $info['currency']) && strtoupper((string) $info['currency']) === $currency) {
				$rate = (float) $info['rate'];
				if ($rate > 0) {
					return $rate;
				}
			}
		}

		foreach (array('wmc_order_rate', '_wmc_order_rate', '_woocs_order_rate', 'woocs_order_rate') as $key) {
			$raw = $order->get_meta($key, true);
			if ($raw !== '' && $raw !== null && is_numeric($raw) && (float) $raw > 0) {
				return (float) $raw;
			}
		}

		return self::get_live_rate($currency);
	}

	/**
	 * Curcy / WOOCS canlı kur listesi; yoksa null.
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

		if (class_exists('WOOMULTI_CURRENCY_Data') && method_exists('WOOMULTI_CURRENCY_Data', 'get_ins')) {
			$settings = WOOMULTI_CURRENCY_Data::get_ins();
			if (is_object($settings) && method_exists($settings, 'get_list_currencies')) {
				$list = $settings->get_list_currencies();
				if (is_array($list) && isset($list[ $currency ]['rate']) && (float) $list[ $currency ]['rate'] > 0) {
					return (float) $list[ $currency ]['rate'];
				}
			}
		}

		/**
		 * Canlı kur yedeği (Curcy dışı eklentiler).
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
	 * Curcy kuralı: fiyat_sipariş = fiyat_ana * rate → ana = sipariş / rate.
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

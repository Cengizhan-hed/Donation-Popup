<?php
/**
 * Progress toplanan tutar: para birimi dönüşümü (kur kaynağı yalnız belgelenmiş filtreler; çekirdek hiçbir çoklu para birimi eklentisini tanımaz).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Progress_Currency
 */
class Progress_Currency {

	/**
	 * Mağaza ana para birimi (WooCommerce ayarı `woocommerce_currency`).
	 * Çoklu para birimi kullanılan sitelerde `get_woocommerce_currency()` ziyaretçinin seçtiği birimi döndürebilir;
	 * ana birim her zaman WooCommerce ayarıdır (fiyatlar ve ilerleme toplamı bu birimde tutulur).
	 *
	 * @return string
	 */
	public static function get_base_currency() {
		$option = function_exists( 'get_option' ) ? strtoupper( trim( (string) get_option( 'woocommerce_currency', '' ) ) ) : '';
		if ( '' !== $option ) {
			return $option;
		}
		return self::get_active_currency();
	}

	/**
	 * Ziyaretçinin gördüğü (etkin) para birimi: `get_woocommerce_currency()`.
	 *
	 * @return string
	 */
	public static function get_active_currency() {
		if ( function_exists( 'get_woocommerce_currency' ) ) {
			return strtoupper( (string) get_woocommerce_currency() );
		}
		return '';
	}

	/**
	 * Bağışçının yazdığı tutarı ($from biriminde) mağaza ana para birimine çevir.
	 * Sepete konan ürün fiyatı ana birimdedir; çoklu para birimi eklentisi gösterirken geri çevirir.
	 *
	 * @param float  $amount Tutar ($from biriminde).
	 * @param string $from   Tutarın para birimi (boşsa dönüşüm yok).
	 * @return float
	 */
	public static function to_store_amount( $amount, $from = '' ) {
		$amount = (float) $amount;
		$from   = strtoupper( (string) $from );
		$base   = self::get_base_currency();
		if ( '' === $from || '' === $base || $from === $base ) {
			return $amount;
		}
		return round( self::convert_amount( $amount, $from, $base, array( 'context' => 'cart_line' ) ), 8 );
	}

	/**
	 * Ana para birimindeki tutarı $to birimine çevir (gösterim için; boşsa etkin para birimi).
	 *
	 * @param float  $amount Tutar (ana birimde).
	 * @param string $to     Hedef para birimi.
	 * @return float
	 */
	public static function from_store_amount( $amount, $to = '' ) {
		$amount = (float) $amount;
		$to     = strtoupper( (string) $to );
		$base   = self::get_base_currency();
		if ( '' === $to ) {
			$to = self::get_active_currency();
		}
		if ( '' === $to || '' === $base || $to === $base ) {
			return $amount;
		}
		$dp = function_exists( 'wc_get_price_decimals' ) ? (int) wc_get_price_decimals() : 2;
		return round( self::convert_amount( $amount, $base, $to, array( 'context' => 'cart_display' ) ), max( 0, $dp ) );
	}

	/**
	 * Sipariş para birimi.
	 *
	 * @param \WC_Abstract_Order|null $order Order.
	 * @return string
	 */
	public static function get_order_currency( $order ) {
		if ( is_object( $order ) && method_exists( $order, 'get_currency' ) ) {
			$c = strtoupper( (string) $order->get_currency() );
			if ( $c !== '' ) {
				return $c;
			}
		}
		return self::get_base_currency();
	}

	/**
	 * Siparişe kaydedilmiş kur (1 birim ana para → X sipariş para birimi).
	 * Kaynak: `wdp_order_exchange_rate` filtresi (standart Woo verisinde kur yoktur).
	 *
	 * @param \WC_Abstract_Order|null $order    Order.
	 * @param string                 $currency Order currency.
	 * @return float|null Rate or null if unknown.
	 */
	public static function get_order_rate( $order, $currency = '' ) {
		$currency = strtoupper( $currency !== '' ? $currency : self::get_order_currency( $order ) );
		$base     = self::get_base_currency();
		if ( $currency === '' || $currency === $base ) {
			return 1.0;
		}
		if ( ! is_object( $order ) || ! method_exists( $order, 'get_meta' ) ) {
			return self::get_live_rate( $currency );
		}

		/**
		 * Siparişe kaydedilmiş kur (1 ana birim = X sipariş para birimi).
		 * Çoklu para birimi eklentisi kullanan siteler bu filtreye site koduyla bağlanır (docs/site-snippets/).
		 *
		 * @param float|null        $rate     Rate or null when unknown.
		 * @param \WC_Abstract_Order $order    Order.
		 * @param string            $currency Order currency.
		 * @param string            $base     Store base currency.
		 */
		$stored = apply_filters( 'wdp_order_exchange_rate', null, $order, $currency, $base );
		if ( $stored !== null && is_numeric( $stored ) && (float) $stored > 0 ) { // @phpstan-ignore function.alreadyNarrowedType
			return (float) $stored;
		}

		return self::get_live_rate( $currency );
	}

	/**
	 * Canlı kur (`wdp_progress_live_rate` filtresi); yoksa null.
	 *
	 * @param string $currency Currency code.
	 * @return float|null
	 */
	public static function get_live_rate( $currency ) {
		$currency = strtoupper( (string) $currency );
		$base     = self::get_base_currency();
		if ( $currency === '' || $currency === $base ) {
			return 1.0;
		}

		/**
		 * Canlı kur (çoklu para birimi kullanan siteler bu filtreye site koduyla bağlanır).
		 *
		 * @param float|null $rate     Rate (order_currency per 1 base) or null.
		 * @param string     $currency Order currency.
		 * @param string     $base     Base currency.
		 */
		$filtered = apply_filters( 'wdp_progress_live_rate', null, $currency, $base );
		if ( $filtered !== null && is_numeric( $filtered ) && (float) $filtered > 0 ) { // @phpstan-ignore function.alreadyNarrowedType
			return (float) $filtered;
		}

		return null;
	}

	/**
	 * Genel tutar dönüşümü (`donation_panel_convert_amount` filtresi; eski ad `wdp_convert_amount` de çalışır). Varsayılan: dönüşüm YOK, tutar olduğu gibi döner.
	 * Çoklu para birimi kullanan siteler filtreye site koduyla bağlanır (docs/site-snippets/).
	 *
	 * @param float                $amount Amount in $from.
	 * @param string               $from   Kaynak para birimi (ISO).
	 * @param string               $to     Hedef para birimi (ISO).
	 * @param array<string, mixed> $context Bağlam (ör. 'order').
	 * @return float
	 */
	public static function convert_amount( $amount, $from, $to, $context = array() ) {
		$amount = (float) $amount;
		$from   = strtoupper( (string) $from );
		$to     = strtoupper( (string) $to );
		if ( $from === $to || $from === '' || $to === '' ) {
			return $amount;
		}

		/**
		 * Genel tutar dönüşümü: $amount tutarını $from para biriminden $to para birimine çevir.
		 * Varsayılan olarak çekirdek dönüşüm yapmaz (tutar aynen döner).
		 *
		 * @param float                $amount  Tutar ($from biriminde).
		 * @param string               $from    Kaynak para birimi.
		 * @param string               $to      Hedef para birimi.
		 * @param array<string, mixed> $context Bağlam.
		 */
		$filtered = apply_filters( 'donation_panel_convert_amount', $amount, $from, $to, $context );
		$filtered = is_numeric( $filtered ) ? (float) $filtered : $amount; // @phpstan-ignore function.alreadyNarrowedType

		// Eski ad (geriye dönük uyum; mevcut site snippet'leri).
		$legacy = apply_filters( 'wdp_convert_amount', $filtered, $from, $to, $context );
		return is_numeric( $legacy ) ? (float) $legacy : $filtered; // @phpstan-ignore function.alreadyNarrowedType
	}

	/**
	 * Sipariş para birimindeki tutarı mağaza ana para birimine çevir.
	 * Kural: fiyat_sipariş = fiyat_ana * rate → ana = sipariş / rate.
	 *
	 * @param float                  $amount   Amount in order currency.
	 * @param string                 $currency Order currency.
	 * @param \WC_Abstract_Order|null $order    Optional order (for stored rate).
	 * @return array{ok:bool,amount:float,reason:string}
	 */
	public static function convert_to_base( $amount, $currency, $order = null ) {
		$amount   = (float) $amount;
		$currency = strtoupper( (string) $currency );
		$base     = self::get_base_currency();

		$result = array(
			'ok'     => true,
			'amount' => $amount,
			'reason' => '',
		);

		if ( $amount == 0.0 || $currency === '' || $currency === $base ) {
			/**
			 * Progress tutar dönüşümü (filtrelenebilir).
			 *
			 * @param array                  $result   ok/amount/reason.
			 * @param float                  $amount   Original.
			 * @param string                 $currency From.
			 * @param string                 $base     To.
			 * @param \WC_Abstract_Order|null $order    Order.
			 */
			return apply_filters( 'wdp_progress_convert_amount', $result, $amount, $currency, $base, $order );
		}

		$rate = self::get_order_rate( $order, $currency );
		if ( $rate === null || $rate <= 0 ) {
			// Kur yok: genel dönüşüm filtresi (varsayılan: tutar aynen döner = dönüşüm yok → eksik kur sayılır).
			$converted = self::convert_amount( $amount, $currency, $base, array( 'order' => $order ) );
			if ( abs( $converted - $amount ) > 0.0000001 ) {
				$result['amount'] = $converted;
				return apply_filters( 'wdp_progress_convert_amount', $result, $amount, $currency, $base, $order );
			}
			$result['ok']     = false;
			$result['amount'] = 0.0;
			$result['reason'] = 'missing_rate';
			return apply_filters( 'wdp_progress_convert_amount', $result, $amount, $currency, $base, $order );
		}

		$result['amount'] = $amount / $rate;
		return apply_filters( 'wdp_progress_convert_amount', $result, $amount, $currency, $base, $order );
	}
}

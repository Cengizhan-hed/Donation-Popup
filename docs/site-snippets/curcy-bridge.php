<?php
/**
 * Curcy / WOOCS / WPML köprüsü: Donation Panel çekirdeğinin belgelenmiş filtrelerine bağlanır.
 *
 * KURULUM (Code Snippets): bu dosyanın ilk satırındaki `<?php` HARİÇ tümünü yeni bir snippet'e yapıştırın,
 * "Run snippet everywhere" seçin, kaydedip etkinleştirin. Ayrıntı: docs/site-snippets/README.md
 *
 * Bağlandığı filtreler (hepsi çekirdekte tanımlı):
 * - wdp_order_exchange_rate : siparişe yazılmış kur (Curcy wmc_order_info / wmc_order_rate, WOOCS _woocs_order_rate)
 * - wdp_progress_live_rate  : Curcy canlı kur listesi
 * - wdp_client_context      : çerez adları, değiştirici seçicileri, olay adları (para birimi/dil)
 * - donation_panel_convert_amount : genel tutar dönüşümü ($from -> $to; Curcy canlı kurlarıyla çapraz dönüşüm).
 *     Çekirdek bunu, bağışçının seçili para biriminde yazdığı tutarı mağaza ana para birimine çevirmek (sepete konan
 *     ürün fiyatı ana birimdedir; Curcy gösterirken geri çevirir) ve kampanya toplamı için kullanır.
 *     ESKİ sürüm bu snippet'i `wdp_convert_amount` adıyla bağlıyordu; eski snippet'i GÜNCELLEYİN (ikisini birden
 *     etkinleştirmeyin: çift dönüşüm olur).
 *
 * @package Site_Snippets
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'WDP_Site_Curcy_Bridge' ) ) {

	/**
	 * Class WDP_Site_Curcy_Bridge
	 */
	class WDP_Site_Curcy_Bridge {

		/**
		 * Filtreleri kaydet.
		 *
		 * @return void
		 */
		public static function init() {
			add_filter( 'wdp_order_exchange_rate', array( __CLASS__, 'order_rate' ), 10, 4 );
			add_filter( 'wdp_progress_live_rate', array( __CLASS__, 'live_rate' ), 10, 3 );
			add_filter( 'wdp_client_context', array( __CLASS__, 'client_context' ), 10, 1 );
			add_filter( 'donation_panel_convert_amount', array( __CLASS__, 'convert_amount' ), 10, 4 );
		}

		/**
		 * Siparişe yazılmış kur: Curcy wmc_order_info / wmc_order_rate, WOOCS _woocs_order_rate.
		 *
		 * @param float|null $rate     Önceki değer.
		 * @param mixed      $order    Order.
		 * @param string     $currency Order currency.
		 * @param string     $base     Base currency (kullanılmaz).
		 * @return float|null
		 */
		public static function order_rate( $rate, $order, $currency, $base = '' ) {
			unset( $base );
			if ( null !== $rate || ! is_object( $order ) || ! method_exists( $order, 'get_meta' ) ) {
				return $rate;
			}
			$currency = strtoupper( (string) $currency );

			$info = $order->get_meta( 'wmc_order_info', true );
			if ( ! is_array( $info ) ) {
				$info = $order->get_meta( '_wmc_order_info', true );
			}
			if ( is_array( $info ) ) {
				if ( isset( $info[ $currency ] ) && is_array( $info[ $currency ] ) && isset( $info[ $currency ]['rate'] ) ) {
					$value = (float) $info[ $currency ]['rate'];
					if ( $value > 0 ) {
						return $value;
					}
				}
				// Bazı sürümler tek düzey 'rate' + 'currency' tutar.
				if ( isset( $info['rate'], $info['currency'] ) && strtoupper( (string) $info['currency'] ) === $currency ) {
					$value = (float) $info['rate'];
					if ( $value > 0 ) {
						return $value;
					}
				}
			}

			foreach ( array( 'wmc_order_rate', '_wmc_order_rate', '_woocs_order_rate', 'woocs_order_rate' ) as $key ) {
				$raw = $order->get_meta( $key, true );
				if ( '' !== $raw && null !== $raw && is_numeric( $raw ) && (float) $raw > 0 ) {
					return (float) $raw;
				}
			}
			return $rate;
		}

		/**
		 * Curcy canlı kur listesi (1 ana birim = X $currency).
		 *
		 * @param float|null $rate     Önceki değer.
		 * @param string     $currency Currency code.
		 * @param string     $base     Base currency (kullanılmaz).
		 * @return float|null
		 */
		public static function live_rate( $rate, $currency, $base = '' ) {
			unset( $base );
			if ( null !== $rate ) {
				return $rate;
			}
			$currency = strtoupper( (string) $currency );
			if ( class_exists( 'WOOMULTI_CURRENCY_Data' ) && method_exists( 'WOOMULTI_CURRENCY_Data', 'get_ins' ) ) {
				$settings = WOOMULTI_CURRENCY_Data::get_ins();
				if ( is_object( $settings ) && method_exists( $settings, 'get_list_currencies' ) ) {
					$list = $settings->get_list_currencies();
					if ( is_array( $list ) && isset( $list[ $currency ]['rate'] ) && (float) $list[ $currency ]['rate'] > 0 ) {
						return (float) $list[ $currency ]['rate'];
					}
				}
			}
			return $rate;
		}

		/**
		 * Genel tutar dönüşümü: Curcy canlı kurlarıyla ($from → ana birim → $to).
		 * Curcy oranı "1 ana birim = X birim": ana = tutar / oran($from); sonuç = ana * oran($to).
		 * Örnek (1 TRY = 0,02 EUR): 100 EUR -> TRY = 100 / 0,02 * 1 = 5000.
		 * Kur bilinmiyorsa tutar olduğu gibi döner (dönüşüm yok).
		 *
		 * @param float                $amount  Tutar ($from biriminde).
		 * @param string               $from    Kaynak para birimi.
		 * @param string               $to      Hedef para birimi.
		 * @param array<string, mixed> $context Bağlam (kullanılmaz).
		 * @return float
		 */
		public static function convert_amount( $amount, $from, $to, $context = array() ) {
			unset( $context );
			$from_rate = self::list_rate( $from );
			$to_rate   = self::list_rate( $to );
			if ( null === $from_rate || null === $to_rate ) {
				return $amount;
			}
			return (float) $amount / $from_rate * $to_rate;
		}

		/**
		 * Curcy listesindeki kur (1 ana birim = X birim); ana birim için 1.0.
		 *
		 * @param string $currency Currency code.
		 * @return float|null
		 */
		private static function list_rate( $currency ) {
			$currency = strtoupper( (string) $currency );
			// Curcy ile get_woocommerce_currency() ziyaretçinin SEÇİLİ birimidir; ana birim mağaza seçeneğidir.
			$base = strtoupper( (string) get_option( 'woocommerce_currency', '' ) );
			if ( '' !== $base && $base === $currency ) {
				return 1.0;
			}
			return self::live_rate( null, $currency );
		}

		/**
		 * Ön yüz para birimi/dil sinyali: çerez adları, değiştirici seçicileri, olaylar.
		 *
		 * @param array<string, mixed> $context Çekirdek bağlamı.
		 * @return array<string, mixed>
		 */
		public static function client_context( $context ) {
			$context = is_array( $context ) ? $context : array();
			$merge   = static function ( $key, $add, $prepend = false ) use ( &$context ) {
				$cur             = isset( $context[ $key ] ) && is_array( $context[ $key ] ) ? $context[ $key ] : array();
				$context[ $key ] = array_values( array_unique( $prepend ? array_merge( $add, $cur ) : array_merge( $cur, $add ) ) );
			};
			$merge( 'currency_cookies', array( 'wmc_current_currency' ), true );
			$merge( 'currency_cookies', array( 'woocommerce_currency', 'wmc_currency', 'woocs_current_currency' ) );
			$merge( 'lang_cookies', array( 'wp-wpml_current_language', 'wpml_language' ) );
			$merge( 'switcher_selectors', array( '.wmc-currency', '.wmc-currency-wrapper', '.woocommerce-currency-switcher', '.woocs_currency' ) );
			$merge( 'change_events', array( 'wmc_currency_changed', 'woocs_currency_changed', 'curcy_currency_changed' ) );
			return $context;
		}
	}

	WDP_Site_Curcy_Bridge::init();
}

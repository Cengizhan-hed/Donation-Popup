<?php
/**
 * Doğrudan (sepetsiz) bağış: tek kalemlik bekleyen (pending) sipariş üretir; sepete dokunmaz.
 *
 * - Doğrulama sepet akışıyla AYNI sunucu kurallarıdır (Field_Validator, hedef kapalı, en düşük tutar).
 * - İdempotency: istemci `submission_key` anahtarı sipariş meta alanında (karma) saklanır; aynı anahtarla gelen ikinci istek
 *   yeni sipariş üretmez, mevcut siparişin durumuna göre ödeme (order-pay) ya da teşekkür bağlantısı döner. Eşzamanlı iki
 *   istek `add_option` kilidiyle (atomik) sıraya girer. Aynı anahtar başka içerikle gelirse 422.
 * - Sipariş kalemi meta alanları sepet akışıyla aynı yazıcıdan geçer (`woocommerce_checkout_create_order_line_item`).
 * - Eklenti ödeme tamamlama/purchase kancası ÇAĞIRMAZ; durum geçişlerini ödeme geçidi ve WooCommerce yapar.
 * - Kart verisi eklentiye girmez: ödeme order-pay sayfasında geçidin kendi alanlarıyla yapılır.
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce\Direct;

use DonationPanel\Domain\Campaign_Goal;
use DonationPanel\Http\Client_Ip;
use DonationPanel\Domain\Progress_Currency;
use DonationPanel\Modules\Experiences\Field_Validator;
use DonationPanel\WooCommerce\Cart_Data;
use DonationPanel\WooCommerce\Cart_Hooks;

defined( 'ABSPATH' ) || exit;

/**
 * Direct_Order_Factory.
 */
final class Direct_Order_Factory {

	/** Doğrudan bağış siparişi işareti. */
	const FLAG_META = '_donation_panel_direct';

	/** İdempotency anahtarı (karma). */
	const KEY_META = '_donation_panel_direct_key';

	/** İstemci (IP/kullanıcı) karması: bekleyen sipariş üst sınırı için. */
	const CLIENT_META = '_donation_panel_direct_client';

	/** İstemci + tarayıcı belirteci karması (ince alt sınır). */
	const TOKEN_META = '_donation_panel_direct_token';

	/** Anahtarı üreten tarayıcı belirtecinin tuzlu karması (anahtar sahipliği; IP'den bağımsız). */
	const OWNER_META = '_donation_panel_direct_owner';

	/** Site geneli bekleyen adet sayacı (kısa ömürlü transient). */
	const SITE_QTY_TRANSIENT = 'donation_panel_direct_site_qty';

	/** İçerik parmak izi (karma). */
	const FINGERPRINT_META = '_donation_panel_direct_fp';

	/** Kilit seçeneği öneki (kısa ömürlü). */
	const GUARD_PREFIX = 'donation_panel_dl_';

	/** Kilit en çok bu kadar sn tutulur; eskiyen kilit devralınır. */
	const LOCK_TTL = 60;

	/**
	 * Siparişi üretir ya da (aynı anahtarla) mevcut olanı döndürür.
	 *
	 * @param object               $product \WC_Product.
	 * @param array<string, mixed> $model   Form modeli (Form_Context).
	 * @param array<string, mixed> $input   İstek girdisi (cart/add ile aynı alanlar + `submission_key`).
	 * @return array{ok: bool, status: int, message: string, errors: array<string, string>, order: \WC_Order|null, reused: bool, code: string}
	 */
	public function submit( $product, array $model, array $input ) {
		if ( ! empty( $model['closed'] ) ) {
			$closed = isset( $model['closed_message'] ) && '' !== $model['closed_message'] ? (string) $model['closed_message'] : __( 'This campaign is no longer accepting donations.', 'woo-donation-popup' );
			return $this->fail( 409, $closed, 'donation_panel_campaign_closed' );
		}

		$key = isset( $input['submission_key'] ) && is_scalar( $input['submission_key'] ) ? Cart_Data::text( (string) $input['submission_key'], 100 ) : '';
		if ( '' === $key ) {
			return $this->fail( 400, __( 'The request is missing its submission key.', 'woo-donation-popup' ), 'donation_panel_direct_key_required' );
		}

		$validated = Field_Validator::validate( $model, $input );
		if ( empty( $validated['valid'] ) ) {
			return $this->fail( 400, __( 'Please check the highlighted fields.', 'woo-donation-popup' ), 'donation_panel_cart_rejected', (array) $validated['errors'] );
		}
		$rule = $this->rule_error( $product, $model, (float) $validated['amount'] );
		if ( '' !== $rule['message'] ) {
			return $this->fail( 400, $rule['message'], 'donation_panel_cart_rejected', $rule['errors'] );
		}

		$plan = $this->plan( $product, $model, $input, $validated );
		$max  = self::max_quantity();
		if ( (int) $plan['quantity'] > $max ) {
			/* translators: %d: maximum quantity. */
			return $this->fail( 400, sprintf( __( 'Please choose a number between 1 and %d.', 'woo-donation-popup' ), $max ), 'donation_panel_cart_rejected', array( 'quantity' => sprintf( __( 'Please choose a number between 1 and %d.', 'woo-donation-popup' ), $max ) ) );
		}
		// Sipariş kalemi oluşmadan önce sepete ekleme ile aynı satın alınabilirlik/stok/ekleme doğrulamaları.
		$purchase = $this->purchase_error( $product, (int) $plan['quantity'] );
		if ( '' !== $purchase ) {
			return $this->fail( 409, $purchase, 'donation_panel_direct_unavailable' );
		}
		$key_hash    = md5( 'donation_panel_direct|' . $key );
		$fingerprint = md5( (string) wp_json_encode( $plan['fingerprint'] ) );

		if ( ! $this->acquire( $key_hash ) ) {
			return $this->fail( 409, __( 'Your donation is already being processed. Please wait a moment.', 'woo-donation-popup' ), 'donation_panel_direct_busy' );
		}
		try {
			$token    = isset( $input['client_token'] ) && is_scalar( $input['client_token'] ) ? preg_replace( '/[^A-Za-z0-9_\-]/', '', Cart_Data::text( (string) $input['client_token'], 64 ) ) : '';
			$owner    = self::token_hash( (string) $token );
			$existing = $this->find( $key_hash );
			if ( $existing ) {
				// Mevcut siparişin ödeme/teşekkür adresi yalnız anahtarı üreten istemciye (aynı tarayıcı belirteci) döner;
				// anahtarı bilen ya da tahmin eden başkası adresi (order key dahil) alamaz.
				if ( (string) $existing->get_meta( self::OWNER_META ) !== $owner || (string) $existing->get_meta( self::FINGERPRINT_META ) !== $fingerprint ) {
					return $this->fail( 422, __( 'This submission key was already used for a different donation.', 'woo-donation-popup' ), 'donation_panel_direct_key_reused' );
				}
				return $this->done( $existing, true );
			}
			$ip   = self::client_hash();
			$fine = self::client_hash( (string) $token );

			// Katman 1 (SERT, sunucunun zorladığı): IP/hesap başına tüm hâlâ-bekleyen/başarısız siparişler + toplam adet. İstemci
			// belirteciyle atlatılamaz; bekleyenler Direct_Cleanup ile kısa sürede iptal edildiği için kendiliğinden boşalır.
			// IP belirlenemiyorsa ya da özel/yerel aralıktaysa (güvenilen vekil yapılandırılmamış: herkes aynı adreste toplanır) sert IP
			// sınırı yerine siteye ait genel sınır uygulanır; ince belirteç sınırı her durumda kalır.
			if ( self::ip_is_reliable() ) {
				$hard = $this->waiting_orders( self::CLIENT_META, $ip, 0, self::max_pending_per_ip() );
				if ( count( $hard ) >= self::max_pending_per_ip() || $this->waiting_quantity( $hard ) + (int) $plan['quantity'] > self::max_pending_quantity() ) {
					return $this->over_limit( $hard, $fingerprint );
				}
			} elseif ( $this->site_waiting_count() >= self::max_pending_site() || $this->site_waiting_quantity() + (int) $plan['quantity'] > self::max_pending_site_quantity() ) {
				// IP güvenilmez: IP sınırı yerine siteye ait cömert genel sınır (tüm bekleyen doğrudan siparişler + toplam adet).
				// Hafif: sayı tek COUNT sorgusuyla (sipariş nesnesi yüklenmez), adet kısa ömürlü sayaçla.
				return $this->over_limit_site( $fingerprint, $owner );
			}
			// Katman 2 (ince): aynı IP içinde tarayıcı belirteci başına (ortak IP'deki bağışçılar birbirini tüketmez).
			$fine_orders = $this->waiting_orders( self::TOKEN_META, $fine, HOUR_IN_SECONDS, self::max_pending() );
			if ( count( $fine_orders ) >= self::max_pending() ) {
				return $this->over_limit( $fine_orders, $fingerprint );
			}
			$plan['client'] = $ip;
			$plan['token']  = $fine;
			$plan['owner']  = $owner;
			$order          = $this->create( $product, $plan, $key_hash, $fingerprint );
			if ( $order instanceof \WC_Order ) {
				$this->site_quantity_add( (int) $plan['quantity'] );
			}
		} finally {
			$this->release( $key_hash );
		}
		if ( is_wp_error( $order ) && 'donation_panel_direct_stock' === $order->get_error_code() ) {
			return $this->fail( 409, $order->get_error_message(), 'donation_panel_direct_unavailable' );
		}
		if ( is_wp_error( $order ) ) {
			// Kişisel veri içermeyen tanılama günlüğü (yalnız WP_DEBUG_LOG açıkken).
			if ( defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
				error_log( 'donation-panel: direct order could not be created (' . $order->get_error_code() . ')' ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- yalnız WP_DEBUG_LOG açıkken, kişisel veri yok.
			}
			return $this->fail( 500, __( 'The donation could not be started. Please try again.', 'woo-donation-popup' ), 'donation_panel_direct_failed' );
		}
		return $this->done( $order, false );
	}

	/**
	 * Tek doğrudan siparişte en çok adet (varsayılan 20).
	 *
	 * @return int
	 */
	public static function max_quantity() {
		/**
		 * Tek doğrudan bağış siparişindeki en çok adet/hisse.
		 *
		 * @param int $max Üst sınır.
		 */
		return max( 1, (int) apply_filters( 'donation_panel_direct_max_quantity', 20 ) );
	}

	/**
	 * İnce alt sınır: IP + tarayıcı belirteci başına son 1 saatte bekleyen/başarısız doğrudan sipariş (varsayılan 10).
	 *
	 * @return int
	 */
	public static function max_pending() {
		/**
		 * IP + tarayıcı belirteci başına son bir saatte bekleyen/başarısız doğrudan sipariş sınırı. Belirteci istemci
		 * seçtiğinden bu sınır tek başına güvenlik sağlamaz; sert sınır `donation_panel_direct_max_pending_ip` ile ayrıdır.
		 *
		 * @param int $max Üst sınır.
		 */
		return max( 1, (int) apply_filters( 'donation_panel_direct_max_pending', 10 ) );
	}

	/**
	 * SERT sınır: IP (girişliyse hesap) başına hâlâ bekleyen/başarısız doğrudan sipariş sayısı (varsayılan 50; zaman penceresi yok).
	 *
	 * @return int
	 */
	public static function max_pending_per_ip() {
		/**
		 * IP/hesap başına bekleyen/başarısız doğrudan bağış siparişi sert sınırı. Ortak IP'de (CGNAT, vekil) meşru
		 * kullanımda ulaşılmayacak kadar cömert; bekleyenler kısa sürede iptal edildiği için kendiliğinden boşalır.
		 *
		 * @param int $max Üst sınır.
		 */
		return max( 1, (int) apply_filters( 'donation_panel_direct_max_pending_ip', 50 ) );
	}

	/**
	 * IP/hesap başına bekleyen siparişlerin toplam adet sınırı (stok rezervasyonu istismarına karşı; varsayılan 500).
	 *
	 * @return int
	 */
	public static function max_pending_quantity() {
		/**
		 * IP/hesap başına bekleyen/başarısız doğrudan siparişlerin toplam adedi.
		 *
		 * @param int $max Üst sınır.
		 */
		return max( 1, (int) apply_filters( 'donation_panel_direct_max_pending_quantity', 500 ) );
	}

	/**
	 * Siteye ait genel sınır (IP güvenilmezken): tüm bekleyen/başarısız doğrudan siparişler (varsayılan 500).
	 *
	 * @return int
	 */
	public static function max_pending_site() {
		/**
		 * IP güvenilmezken (güvenilen vekil ayarsız) tüm site için bekleyen/başarısız doğrudan sipariş sınırı.
		 *
		 * @param int $max Üst sınır.
		 */
		return max( 1, (int) apply_filters( 'donation_panel_direct_max_pending_site', 500 ) );
	}

	/**
	 * Siteye ait genel toplam adet sınırı (IP güvenilmezken; varsayılan 5000).
	 *
	 * @return int
	 */
	public static function max_pending_site_quantity() {
		/**
		 * IP güvenilmezken tüm bekleyen/başarısız doğrudan siparişlerin toplam adedi.
		 *
		 * @param int $max Üst sınır.
		 */
		return max( 1, (int) apply_filters( 'donation_panel_direct_max_pending_site_quantity', 5000 ) );
	}

	/**
	 * Sert IP sınırı için IP güvenilir mi: girişli hesap her zaman; aksi halde genel (özel/yerel/ayrılmış olmayan) geçerli IP.
	 *
	 * @return bool
	 */
	private static function ip_is_reliable() {
		return Client_Ip::is_reliable();
	}

	/**
	 * Tarayıcı belirtecinin tuzlu karması (yalnız anahtar sahipliği için; IP'den bağımsız). Belirteç yoksa ''.
	 *
	 * @param string $token Belirteç.
	 * @return string
	 */
	private static function token_hash( $token ) {
		return '' === $token ? '' : hash_hmac( 'sha256', 'donation_panel_direct_owner|' . $token, wp_salt( 'auth' ) );
	}

	/**
	 * Sitedeki bekleyen/başarısız doğrudan sipariş sayısı (tek COUNT sorgusu; sipariş nesnesi yüklenmez).
	 *
	 * @return int
	 */
	private function site_waiting_count() {
		$result = wc_get_orders(
			array(
				'limit'      => 1,
				'paginate'   => true,
				'return'     => 'ids',
				'status'     => array( 'pending', 'failed' ),
				'meta_query' => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- tek anahtarlı, yalnız sayım.
					array(
						'key'   => self::FLAG_META,
						'value' => 'yes',
					),
				),
			)
		);
		return is_object( $result ) && isset( $result->total ) ? (int) $result->total : 0;
	}

	/**
	 * Sitedeki bekleyen doğrudan siparişlerin toplam adedi: kısa ömürlü sayaç (30 sn); süresi dolunca bir kez hesaplanır,
	 * sipariş açıldıkça artırılır. Her istekte sipariş nesnesi yüklenmez.
	 *
	 * @return int
	 */
	private function site_waiting_quantity() {
		$cached = get_transient( self::SITE_QTY_TRANSIENT );
		if ( is_numeric( $cached ) ) {
			return (int) $cached;
		}
		$total = $this->waiting_quantity( $this->waiting_orders( self::FLAG_META, 'yes', 0, self::max_pending_site() ) );
		set_transient( self::SITE_QTY_TRANSIENT, $total, 30 );
		return $total;
	}

	/**
	 * Yeni siparişin adedini sayaca ekler (sayaç yoksa sonraki okuma yeniden hesaplar).
	 *
	 * @param int $quantity Adet.
	 * @return void
	 */
	private function site_quantity_add( $quantity ) {
		$cached = get_transient( self::SITE_QTY_TRANSIENT );
		if ( is_numeric( $cached ) ) {
			set_transient( self::SITE_QTY_TRANSIENT, (int) $cached + max( 0, (int) $quantity ), 30 );
		}
	}

	/**
	 * İstemci kimliği karması: girişli kullanıcı hesabı, değilse IP (+ varsa tarayıcı belirteci). Kişisel veri düz saklanmaz.
	 * Ters vekil/CDN arkasındaki sitelerde doğru IP için `donation_panel_trusted_proxies` süzgecini ayarlayın (bkz. Client_Ip).
	 *
	 * @param string|null $token null: yalnız IP/hesap (sert sınır); metin: IP + belirteç (ince sınır).
	 * @return string
	 */
	public static function client_hash( $token = null ) {
		$user_id = get_current_user_id();
		// IPv6 /64 önekine indirgenir (aynı önek içinde adres döndürerek sınır atlatılamaz); karma site tuzlu HMAC'tir.
		$who = $user_id > 0 ? 'u' . $user_id : Client_Ip::key();
		if ( null !== $token && $user_id < 1 ) {
			$who .= '|' . $token;
		}
		return hash_hmac( 'sha256', 'donation_panel_direct_client|' . $who, wp_salt( 'auth' ) );
	}

	/**
	 * Bekleyen/başarısız doğrudan siparişler.
	 *
	 * @param string $meta_key Meta anahtarı (CLIENT_META | TOKEN_META).
	 * @param string $hash     Karma.
	 * @param int    $window   Saniye cinsinden pencere; 0 = pencere yok.
	 * @param int    $cap      Üst sınır (sorgu cap + 1 sipariş getirir).
	 * @return \WC_Order[]
	 */
	private function waiting_orders( $meta_key, $hash, $window, $cap ) {
		$args = array(
			'limit'      => (int) $cap + 1,
			'status'     => array( 'pending', 'failed' ),
			'meta_query' => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- tek anahtarlı, küçük sınırlı sorgu.
				array(
					'key'   => $meta_key,
					'value' => $hash,
				),
			),
		);
		if ( $window > 0 ) {
			$args['date_created'] = '>' . ( time() - (int) $window );
		}
		return array_values(
			array_filter(
				wc_get_orders( $args ),
				static function ( $order ) {
					return $order instanceof \WC_Order;
				}
			)
		);
	}

	/**
	 * Siparişlerin toplam kalem adedi.
	 *
	 * @param \WC_Order[] $orders Siparişler.
	 * @return int
	 */
	private function waiting_quantity( array $orders ) {
		$total = 0;
		foreach ( $orders as $order ) {
			foreach ( $order->get_items() as $item ) {
				$total += (int) $item->get_quantity();
			}
		}
		return $total;
	}

	/**
	 * Sınır aşıldı: yeni sipariş AÇILMAZ; aynı içerikli bekleyen sipariş varsa o yeniden kullanılır, yoksa uyarılır.
	 *
	 * @param \WC_Order[] $orders      Bekleyen siparişler.
	 * @param string      $fingerprint Yeni isteğin içerik parmak izi.
	 * @return array<string, mixed>
	 */
	private function over_limit( array $orders, $fingerprint ) {
		foreach ( $orders as $candidate ) {
			if ( $candidate->has_status( 'pending' ) && (string) $candidate->get_meta( self::FINGERPRINT_META ) === $fingerprint ) {
				return $this->done( $candidate, true );
			}
		}
		return $this->fail( 429, __( 'You have several unpaid donations waiting. Please complete or wait for them to expire before starting another.', 'woo-donation-popup' ), 'donation_panel_direct_too_many' );
	}

	/**
	 * Site genel sınırı aşıldı (IP güvenilmezken): yeni sipariş AÇILMAZ; yalnız aynı tarayıcı belirtecine ait, aynı içerikli
	 * bekleyen sipariş varsa o yeniden kullanılır, yoksa uyarılır.
	 *
	 * @param string $fingerprint Yeni isteğin içerik parmak izi.
	 * @param string $owner       Tarayıcı belirteci karması.
	 * @return array<string, mixed>
	 */
	private function over_limit_site( $fingerprint, $owner ) {
		if ( '' !== $owner ) {
			$candidates = wc_get_orders(
				array(
					'limit'      => 1,
					'status'     => array( 'pending' ),
					'meta_query' => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- yalnız sınır aşılınca, tek sorgu.
						'relation' => 'AND',
						array(
							'key'   => self::OWNER_META,
							'value' => $owner,
						),
						array(
							'key'   => self::FINGERPRINT_META,
							'value' => $fingerprint,
						),
					),
				)
			);
			if ( ! empty( $candidates ) && $candidates[0] instanceof \WC_Order ) {
				return $this->done( $candidates[0], true );
			}
		}
		return $this->fail( 429, __( 'You have several unpaid donations waiting. Please complete or wait for them to expire before starting another.', 'woo-donation-popup' ), 'donation_panel_direct_too_many' );
	}

	/**
	 * Sepete ekleme ile aynı doğrulamalar: satın alınabilirlik, stok, tekil satış ve `woocommerce_add_to_cart_validation`.
	 *
	 * @param object $product  \WC_Product.
	 * @param int    $quantity Adet.
	 * @return string Hata iletisi; boşsa geçerli.
	 */
	private function purchase_error( $product, $quantity ) {
		$quantity = max( 1, (int) $quantity );
		if ( ! $product->is_purchasable() ) {
			return __( 'This donation is not available right now.', 'woo-donation-popup' );
		}
		if ( ! $product->is_in_stock() || ! $product->has_enough_stock( $quantity ) ) {
			return __( 'This donation is out of stock.', 'woo-donation-popup' );
		}
		if ( $product->is_sold_individually() && $quantity > 1 ) {
			return __( 'This donation can only be made once per order.', 'woo-donation-popup' );
		}
		// REST isteğinde WooCommerce oturumu yüklü değildir; doğrulayıcıların `wc_add_notice` çağrısı için yalnız oturum
		// nesnesi başlatılır (sepet yüklenmez; çerez yalnız oturumda veri varsa yazılır, ileti hemen temizlenir).
		if ( function_exists( 'WC' ) && WC() && null === WC()->session && method_exists( WC(), 'initialize_session' ) ) {
			WC()->initialize_session();
		}
		$product_id = (int) $product->get_id();
		/** This filter is documented in woocommerce/includes/class-wc-cart.php. */
		$passed = (bool) Cart_Hooks::run_in_plugin_flow(
			static function () use ( $product_id, $quantity ) {
				return apply_filters( 'woocommerce_add_to_cart_validation', true, $product_id, $quantity ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
			}
		);
		$notice = '';
		if ( function_exists( 'wc_get_notices' ) ) {
			$notices = wc_get_notices( 'error' );
			if ( ! $passed && is_array( $notices ) && ! empty( $notices ) ) {
				$first  = reset( $notices );
				$text   = is_array( $first ) && isset( $first['notice'] ) ? $first['notice'] : $first;
				$notice = is_scalar( $text ) ? wp_strip_all_tags( (string) $text ) : '';
			}
			// Doğrulayıcıların kuyruğa aldığı sepet iletileri REST yanıtında/oturumda kalmasın.
			if ( function_exists( 'wc_clear_notices' ) ) {
				wc_clear_notices();
			}
		}
		if ( $passed ) {
			return '';
		}
		return '' !== $notice ? $notice : __( 'This donation cannot be started right now.', 'woo-donation-popup' );
	}

	/**
	 * Eski sunucu kuralları (hedef kapalı, en düşük tutar) — sepet akışıyla aynı.
	 *
	 * @param object               $product Ürün.
	 * @param array<string, mixed> $model   Model.
	 * @param float                $amount  Tutar.
	 * @return array{message: string, errors: array<string, string>}
	 */
	private function rule_error( $product, array $model, $amount ) {
		try {
			Campaign_Goal::assert_accepts_donation( $product );
		} catch ( \Exception $e ) {
			return array(
				'message' => $e->getMessage(),
				'errors'  => array(),
			);
		}
		if ( ! empty( $model['allow_custom'] ) ) {
			$min   = method_exists( $product, 'get_meta' ) ? $product->get_meta( '_min_custom_price' ) : '';
			$error = (string) Cart_Hooks::get_donation_amount_error( $amount, $min, (int) $product->get_id(), true, Progress_Currency::get_active_currency() );
			if ( '' !== $error ) {
				return array(
					'message' => $error,
					'errors'  => array( 'amount' => $error ),
				);
			}
		}
		return array(
			'message' => '',
			'errors'  => array(),
		);
	}

	/**
	 * Sipariş planı: kalem tutarı (mağaza para biriminde), adet, bağış verisi.
	 *
	 * @param object               $product   Ürün.
	 * @param array<string, mixed> $model     Model.
	 * @param array<string, mixed> $input     Girdi.
	 * @param array<string, mixed> $validated Field_Validator sonucu.
	 * @return array<string, mixed>
	 */
	private function plan( $product, array $model, array $input, array $validated ) {
		$kind     = isset( $model['kind'] ) ? (string) $model['kind'] : '';
		$decimals = isset( $model['decimals'] ) ? (int) $model['decimals'] : 2;
		$quantity = max( 1, (int) $validated['quantity'] );
		$amount   = (float) $validated['amount'];
		$data     = Cart_Data::donation_data( $model, $input );

		$fee = 0.0;
		if ( ! empty( $input['donation_cover_fee'] ) && 'false' !== $input['donation_cover_fee'] && ! empty( $model['cover_fee'] ) ) {
			$fee = (float) $model['cover_fee'];
			if ( $fee > 0 ) {
				$data['cover_fee']         = '1';
				$data['cover_fee_percent'] = $fee;
			}
		}

		$custom      = ! empty( $model['allow_custom'] ) ? Cart_Data::with_fee( $amount, $fee, $decimals ) : null;
		$active      = Progress_Currency::get_active_currency();
		$line_total  = 0.0;
		$line_values = array( 'donation_data' => $data );
		if ( null !== $custom ) {
			$quantity                    = 1;
			$line_total                  = (float) Progress_Currency::to_store_amount( $custom, $active );
			$line_values['custom_price'] = (float) $custom;
			if ( '' !== $active ) {
				$line_values['wdp_input_currency'] = $active;
			}
		} else {
			$unit       = isset( $model['unit_price'] ) ? (float) $model['unit_price'] : 0.0;
			$line_total = Cart_Data::with_fee( $unit, $fee, $decimals ) * $quantity;
		}
		$line_total = (float) wc_format_decimal( $line_total, $decimals );

		if ( '' !== $kind ) {
			$line_values['donation_panel_kind'] = sanitize_key( $kind );
		}
		$type = isset( $input['donation_type'] ) && is_scalar( $input['donation_type'] ) ? sanitize_key( (string) $input['donation_type'] ) : '';
		if ( '' !== $type && ! in_array( $type, array_column( isset( $model['types'] ) && is_array( $model['types'] ) ? $model['types'] : array(), 'value' ), true ) ) {
			$type = '';
		}
		if ( '' !== $type ) {
			$line_values['donation_panel_type'] = $type;
		}

		return array(
			'total'       => $line_total,
			'quantity'    => $quantity,
			'values'      => $line_values,
			'data'        => $data,
			'fingerprint' => array( (int) $product->get_id(), $line_total, Progress_Currency::get_base_currency(), $quantity, $data, $type ),
		);
	}

	/**
	 * Siparişi oluşturur.
	 *
	 * @param object               $product     Ürün.
	 * @param array<string, mixed> $plan        Plan.
	 * @param string               $key_hash    Anahtar karması.
	 * @param string               $fingerprint İçerik parmak izi.
	 * @return \WC_Order|\WP_Error
	 */
	private function create( $product, array $plan, $key_hash, $fingerprint ) {
		$order = wc_create_order(
			array(
				'status'      => 'pending',
				'customer_id' => get_current_user_id(),
				'created_via' => 'donation_panel_direct',
			)
		);
		if ( is_wp_error( $order ) ) {
			return $order;
		}
		// Tutar mağaza ana birimine çevrilerek hesaplandı (Progress_Currency::to_store_amount); sipariş de o birimde.
		$order->set_currency( Progress_Currency::get_base_currency() );

		$item = new \WC_Order_Item_Product();
		$item->set_product( $product );
		$item->set_quantity( (int) $plan['quantity'] );
		$item->set_subtotal( (string) $plan['total'] );
		$item->set_total( (string) $plan['total'] );
		$order->add_item( $item );

		// Sepet akışıyla aynı kanca: bağış verisi tek yazıcıdan (Donation_Order_Meta + Order_Meta_Keys) sipariş kalemine yazılır.
		/** This action is documented in woocommerce/includes/class-wc-checkout.php. */
		do_action( 'woocommerce_checkout_create_order_line_item', $item, 'donation_panel_direct', $plan['values'], $order ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

		$this->fill_customer( $order, (array) $plan['data'] );
		$order->set_customer_ip_address( \WC_Geolocation::get_ip_address() );
		$order->set_customer_user_agent( wc_get_user_agent() );
		$order->update_meta_data( self::FLAG_META, 'yes' );
		$order->update_meta_data( self::KEY_META, $key_hash );
		$order->update_meta_data( self::CLIENT_META, isset( $plan['client'] ) ? (string) $plan['client'] : '' );
		$order->update_meta_data( self::TOKEN_META, isset( $plan['token'] ) ? (string) $plan['token'] : '' );
		$order->update_meta_data( self::OWNER_META, isset( $plan['owner'] ) ? (string) $plan['owner'] : '' );
		$order->update_meta_data( self::FINGERPRINT_META, $fingerprint );
		$order->calculate_totals( true );
		$order->add_order_note( __( 'Direct donation started. Waiting for payment.', 'woo-donation-popup' ) );
		$order->save();

		// Yalnız stok yönetimli üründe: bekleyen sipariş stoğu rezerve eder (WooCommerce ödeme akışıyla aynı); yetmiyorsa sipariş açılmaz.
		// Rezervasyonun kötüye kullanımı: adet üst sınırı, istemci başına bekleyen sipariş sınırı ve kısa temizleme süresiyle kısıtlıdır.
		if ( function_exists( 'wc_reserve_stock_for_order' ) && $product->managing_stock() ) {
			try {
				wc_reserve_stock_for_order( $order );
			} catch ( \Exception $e ) {
				$order->delete( true );
				return new \WP_Error( 'donation_panel_direct_stock', $e->getMessage() );
			}
		}

		Direct_Cleanup::schedule();
		return $order;
	}

	/**
	 * Fatura alanlarını bağışçının yazdığından doldurur (hiçbir alan silinmez/maskelenmez).
	 *
	 * @param \WC_Order            $order Sipariş.
	 * @param array<string, mixed> $data  Bağış verisi.
	 * @return void
	 */
	private function fill_customer( $order, array $data ) {
		$name = isset( $data['full_name'] ) ? trim( (string) $data['full_name'] ) : '';
		if ( '' !== $name ) {
			$pos = strrpos( $name, ' ' );
			if ( false === $pos ) {
				$order->set_billing_first_name( $name );
			} else {
				$order->set_billing_first_name( trim( substr( $name, 0, $pos ) ) );
				$order->set_billing_last_name( trim( substr( $name, $pos + 1 ) ) );
			}
		}
		$email = isset( $data['email'] ) ? (string) $data['email'] : '';
		if ( '' === $email ) {
			$user  = function_exists( 'wp_get_current_user' ) ? wp_get_current_user() : null;
			$email = $user && $user->exists() ? (string) $user->user_email : '';
		}
		if ( '' !== $email ) {
			$order->set_billing_email( $email );
		}
		if ( ! empty( $data['phone'] ) ) {
			$order->set_billing_phone( (string) $data['phone'] );
		}
	}

	/**
	 * Aynı anahtarın etkin siparişi (iptal/iade edilmiş olanlar yok sayılır: yeniden denemeye izin verir).
	 *
	 * @param string $key_hash Anahtar karması.
	 * @return \WC_Order|null
	 */
	private function find( $key_hash ) {
		$orders = wc_get_orders(
			array(
				'limit'      => 1,
				'orderby'    => 'date',
				'order'      => 'DESC',
				'status'     => array( 'pending', 'failed', 'on-hold', 'processing', 'completed' ),
				'meta_query' => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- tek anahtarlı, indeksli arama.
					array(
						'key'   => self::KEY_META,
						'value' => $key_hash,
					),
				),
			)
		);
		return ! empty( $orders ) && $orders[0] instanceof \WC_Order ? $orders[0] : null;
	}

	/**
	 * Sonuç: durum ödeme bekliyorsa order-pay, ödenmişse teşekkür bağlantısı.
	 *
	 * @param \WC_Order $order  Sipariş.
	 * @param bool      $reused Mevcut sipariş mi.
	 * @return array{ok: bool, status: int, message: string, errors: array<string, string>, order: \WC_Order, reused: bool, code: string}
	 */
	private function done( $order, $reused ) {
		return array(
			'ok'      => true,
			'status'  => 200,
			'message' => '',
			'errors'  => array(),
			'order'   => $order,
			'reused'  => (bool) $reused,
			'code'    => '',
		);
	}

	/**
	 * Hata sonucu.
	 *
	 * @param int                   $status  HTTP durumu.
	 * @param string                $message İleti.
	 * @param string                $code    Makine kodu.
	 * @param array<string, string> $errors  Alan hataları.
	 * @return array{ok: bool, status: int, message: string, errors: array<string, string>, order: null, reused: bool, code: string}
	 */
	private function fail( $status, $message, $code, array $errors = array() ) {
		return array(
			'ok'      => false,
			'status'  => (int) $status,
			'message' => (string) $message,
			'errors'  => $errors,
			'order'   => null,
			'reused'  => false,
			'code'    => (string) $code,
		);
	}

	/**
	 * Atomik kilit (`add_option` eşsiz ad: ikinci eşzamanlı çağrı başarısız olur).
	 *
	 * @param string $key_hash Anahtar karması.
	 * @return bool
	 */
	private function acquire( $key_hash ) {
		$name = self::GUARD_PREFIX . $key_hash;
		if ( add_option( $name, time(), '', false ) ) {
			return true;
		}
		$since = (int) get_option( $name, 0 );
		if ( $since > 0 && ( time() - $since ) > self::LOCK_TTL ) {
			delete_option( $name );
			return (bool) add_option( $name, time(), '', false );
		}
		return false;
	}

	/**
	 * Kilidi bırakır.
	 *
	 * @param string $key_hash Anahtar karması.
	 * @return void
	 */
	private function release( $key_hash ) {
		delete_option( self::GUARD_PREFIX . $key_hash );
	}
}

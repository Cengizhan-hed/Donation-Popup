<?php
/**
 * Merkezi yardımcı sınıf; log, JSON yanıt, addon çözümü, progress bar ve önbellek.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once WDP_PLUGIN_DIR . 'includes/traits/trait-wdp-utils-price.php';
require_once WDP_PLUGIN_DIR . 'includes/traits/trait-wdp-utils-order-meta.php';
require_once WDP_PLUGIN_DIR . 'includes/traits/trait-wdp-utils-legacy-settings.php';



/**
 * Class WDP_Utils
 */
class WDP_Utils {
	use WDP_Utils_Price_Trait;
	use WDP_Utils_Order_Meta_Trait;
	use WDP_Utils_Legacy_Settings_Trait;


	/**
	 * Debug logging enabled flag.
	 *
	 * @var bool
	 */
	private static $debug_enabled = false;

	/**
	 * Whether woocommerce_update_product cache hook was registered.
	 *
	 * @var bool
	 */
	private static $wc_product_cache_invalidation_hook_registered = false;

	/**
	 * Initialize the utility class.
	 *
	 * @since 10.0
	 * @return void
	 */
	public static function init() {
		self::$debug_enabled = (bool) ( defined( 'WP_DEBUG' ) && WP_DEBUG );

		// Progress bar toplamlarını artımlı güncelle (büyük sipariş hacminde tam taramayı azaltır).
		// Ödenmiş durumlar (wdp_progress_paid_statuses) sayılır; ödenmemişe düşünce / silme / çöpte düşülür.
		add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'sync_order_donation_totals_on_status_change' ), 20, 4 );
		add_action( 'woocommerce_order_refunded', array( __CLASS__, 'sync_order_donation_totals_on_refund' ), 20, 2 );
		add_action( 'before_delete_post', array( __CLASS__, 'uncount_order_progress_on_delete' ), 5, 2 );
		add_action( 'wp_trash_post', array( __CLASS__, 'uncount_order_progress_on_trash' ), 5, 1 );
		add_action( 'untrashed_post', array( __CLASS__, 'recount_order_progress_on_untrash' ), 10, 1 );
		add_action( 'wdp_recalculate_product_donation_total', array( __CLASS__, 'cron_recalculate_product_donation_total' ), 10, 1 );

		// Ürün veya bağışa ilişkin ürün meta'sı değişince get_product_info / sepet AJAX önbelleğini tek merkezden temizle.
		add_action( 'updated_post_meta', array( __CLASS__, 'maybe_invalidate_product_donation_caches_on_meta' ), 10, 4 );
		add_action( 'added_post_meta', array( __CLASS__, 'maybe_invalidate_product_donation_caches_on_meta' ), 10, 4 );
		add_action( 'deleted_post_meta', array( __CLASS__, 'maybe_invalidate_product_donation_caches_on_meta' ), 10, 4 );
		add_action( 'save_post_product', array( __CLASS__, 'invalidate_product_donation_caches_on_product_save' ), 10, 3 );
		if ( did_action( 'woocommerce_loaded' ) ) {
			self::register_wc_product_cache_invalidation_hook();
		} else {
			add_action( 'woocommerce_loaded', array( __CLASS__, 'register_wc_product_cache_invalidation_hook' ), 1 );
		}

		// Ürün çöpe gider veya kalıcı silinirken önbellekte yetim anahtar kalmasın (object cache / Redis).
		add_action( 'before_delete_post', array( __CLASS__, 'purge_product_donation_caches_on_delete' ), 10, 2 );
		add_action( 'wp_trash_post', array( __CLASS__, 'purge_product_donation_caches_on_trash' ), 10, 1 );
	}

	/**
	 * Register WC product save hook once (safe if called early or after woocommerce_loaded).
	 *
	 * @return void
	 */
	public static function register_wc_product_cache_invalidation_hook() {
		if ( self::$wc_product_cache_invalidation_hook_registered ) {
			return;
		}
		self::$wc_product_cache_invalidation_hook_registered = true;
		add_action( 'woocommerce_update_product', array( __CLASS__, 'invalidate_product_donation_caches_on_wc_product' ), 10, 1 );
	}

	/**
	 * WooCommerce fiyat HTML'i; gereksiz sondaki ondalıkları kaldırır (ör. tam sayılarda ",00" yok).
	 *
	 * @param float|string $amount Ham tutar.
	 * @param array        $args   wc_price() için ek argümanlar.
	 * @return string Güvenli HTML.
	 */
	/**
	 * Decode HTML entities to UTF-8 text (e.g. &#8378; → ₺).
	 *
	 * @param string $text Raw text.
	 * @return string
	 */

	/**
	 * Alt bağış satırı için ürün meta'sındaki WooCommerce ürün ID'si.
	 *
	 * @param int|WC_Product $parent_product Ana bağış ürünü.
	 * @return int Geçerli WC ürün ID veya 0.
	 */
	public static function resolve_addon_wc_product_id( $parent_product ) {
		$configured = self::get_configured_addon_wc_product_id( $parent_product );
		if ( $configured <= 0 ) {
			return 0;
		}

		/**
		 * Alt bağış sepet satırında kullanılacak WooCommerce ürün ID.
		 *
		 * @param int $configured Ürün meta _addon_wc_product_id.
		 * @param int $parent_id  Ana bağış ürün ID.
		 */
		$parent_id  = $parent_product instanceof WC_Product
			? (int) $parent_product->get_id()
			: absint( $parent_product );
		$filtered   = apply_filters( 'wdp_sadaka_wc_product_id', $configured, $parent_id );
		$product_id = absint( $filtered );

		return self::is_valid_addon_wc_product( $product_id ) ? $product_id : 0;
	}

	/**
	 * Addon sepet satırı için kullanılabilir WC ürünü (gizli/katalog ürünleri dahil).
	 *
	 * @param int $product_id Product ID.
	 * @return bool
	 */
	public static function is_valid_addon_wc_product( $product_id ) {
		$product_id = absint( $product_id );
		if ( $product_id <= 0 ) {
			return false;
		}

		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			return false;
		}
		if ( method_exists( $product, 'exists' ) && ! $product->exists() ) {
			return false;
		}

		$type = method_exists( $product, 'get_type' ) ? (string) $product->get_type() : '';
		if ( $type !== '' && $type !== 'simple' ) {
			return false;
		}

		$status = $product->get_status();
		return in_array( $status, array( 'publish', 'private' ), true );
	}

	/**
	 * Genel alt bağış WC ürün ID (Başarı & Mini Sepet).
	 * 0 değeri, zorunlu yapılandırma eksik olduğunu ifade eder.
	 *
	 * @return int
	 */
	public static function get_default_addon_wc_product_id() {
		$settings = get_option( 'wdp_success_settings', array() );
		$id       = 0;
		if ( is_array( $settings ) && ! empty( $settings['sadaka_wc_product_id'] ) ) {
			$id = absint( $settings['sadaka_wc_product_id'] );
		}
		return $id > 0 ? $id : 0;
	}

	/**
	 * Alt bağış aç/kapa buton metni (ürün meta → genel ayar → varsayılan).
	 *
	 * @param WC_Product|int|null $parent_product Ana bağış ürünü.
	 * @return string
	 */
	public static function get_addon_toggle_label( $parent_product = null ) {
		if ( $parent_product !== null ) {
			$parent = $parent_product instanceof WC_Product ? $parent_product : wc_get_product( (int) $parent_product );
			if ( $parent ) {
				$per_product = trim( (string) WDP_Addon_Product_Visibility::get_meta( $parent, '_addon_toggle_label' ) );
				if ( $per_product !== '' ) {
					return sanitize_text_field( $per_product );
				}
			}
		}

		$settings = get_option( 'wdp_success_settings', array() );
		if ( is_array( $settings ) && ! empty( $settings['sadaka_toggle_label'] ) ) {
			$label = sanitize_text_field( $settings['sadaka_toggle_label'] );
			if ( $label !== '' ) {
				return $label;
			}
		}

		return __( 'Add add-on donation', 'woo-donation-popup' );
	}

	/**
	 * Ürün meta veya genel ayar alt bağış WC ürün ID'si.
	 *
	 * @param WC_Product|int $parent_product Ana bağış ürünü.
	 * @return int
	 */
	public static function get_configured_addon_wc_product_id( $parent_product ) {
		$parent = $parent_product instanceof WC_Product ? $parent_product : wc_get_product( (int) $parent_product );
		if ( ! $parent ) {
			return self::get_default_addon_wc_product_id();
		}

		$per_product = absint( WDP_Addon_Product_Visibility::get_meta( $parent, '_addon_wc_product_id' ) );
		if ( $per_product > 0 ) {
			return $per_product;
		}

		return self::get_default_addon_wc_product_id();
	}

	/**
	 * Alt bağış sabit fiyatı (ürün meta). 0 = özel tutar modu.
	 *
	 * @param WC_Product|int $parent_product Ana bağış ürünü.
	 * @return float
	 */
	public static function get_addon_fixed_price( $parent_product ) {
		$parent = $parent_product instanceof WC_Product ? $parent_product : wc_get_product( (int) $parent_product );
		if ( ! $parent ) {
			return 0.0;
		}

		$raw = WDP_Addon_Product_Visibility::get_meta( $parent, '_addon_fixed_price' );
		if ( $raw === '' || $raw === null ) {
			return 0.0;
		}

		$value = (float) wc_format_decimal( $raw );
		return $value > 0 ? $value : 0.0;
	}

	/**
	 * Yerel biçimli alt bağış tutarını sayıya çevirir (5.566 / 5,566 / 5566).
	 *
	 * @param mixed $raw Ham tutar.
	 * @return float|null Geçerli sayı veya null.
	 */
	public static function parse_addon_amount( $raw ) {
		if ( $raw === null || $raw === '' ) {
			return null;
		}
		if ( is_int( $raw ) || is_float( $raw ) ) {
			$n = (float) $raw;
			return is_finite( $n ) ? $n : null;
		}
		$s = preg_replace( '/\s+/u', '', (string) $raw );
		if ( $s === '' || $s === null ) {
			return null;
		}
		$has_comma = strpos( $s, ',' ) !== false;
		$has_dot   = strpos( $s, '.' ) !== false;
		if ( $has_comma && $has_dot ) {
			// 1.234,56 → 1234.56
			if ( strrpos( $s, ',' ) > strrpos( $s, '.' ) ) {
				$s = str_replace( '.', '', $s );
				$s = str_replace( ',', '.', $s );
			} else {
				// 1,234.56 → 1234.56
				$s = str_replace( ',', '', $s );
			}
		} elseif ( $has_comma ) {
			$parts = explode( ',', $s );
			if ( count( $parts ) > 2 ) {
				$s = implode( '', $parts );
			} elseif ( count( $parts ) === 2 && strlen( $parts[1] ) === 3 && ctype_digit( $parts[1] ) && ctype_digit( str_replace( '-', '', $parts[0] ) ) ) {
				// 5,566 → binlik
				$s = $parts[0] . $parts[1];
			} else {
				// 5,5 / 5,56 → ondalık
				$s = $parts[0] . '.' . ( isset( $parts[1] ) ? $parts[1] : '' );
			}
		} else {
			$parts = explode( '.', $s );
			if ( count( $parts ) > 2 ) {
				$s = implode( '', $parts );
			} elseif ( count( $parts ) === 2 && strlen( $parts[1] ) === 3 && ctype_digit( $parts[1] ) && ctype_digit( str_replace( '-', '', $parts[0] ) ) ) {
				// 5.566 → binlik
				$s = $parts[0] . $parts[1];
			}
		}
		if ( ! is_numeric( $s ) ) {
			return null;
		}
		$n = (float) $s;
		return is_finite( $n ) ? $n : null;
	}

	/**
	 * Açık alt bağış paneli için tutar doğrulaması.
	 *
	 * @param mixed $raw         Ham tutar (sabit fiyat yoksa).
	 * @param float $min_price   Minimum tutar (0 = yok).
	 * @param float $fixed_price Sabit tutar (>0 ise raw yok sayılır).
	 * @return array{ok:bool,amount:float|null,code:string,message:string}
	 */
	public static function validate_addon_amount( $raw, $min_price = 0.0, $fixed_price = 0.0 ) {
		$fixed = (float) $fixed_price;
		if ( $fixed > 0 ) {
			return array(
				'ok'      => true,
				'amount'  => $fixed,
				'code'    => 'fixed',
				'message' => '',
			);
		}

		$raw_str = is_string( $raw ) ? trim( $raw ) : (string) $raw;
		if ( $raw_str === '' || $raw === null ) {
			return array(
				'ok'      => false,
				'amount'  => null,
				'code'    => 'empty',
				'message' => __( 'Please enter a valid add-on donation amount.', 'woo-donation-popup' ),
			);
		}

		$amount = self::parse_addon_amount( $raw_str );
		if ( null === $amount || $amount <= 0 ) {
			return array(
				'ok'      => false,
				'amount'  => null,
				'code'    => 'invalid',
				'message' => __( 'Please enter a valid add-on donation amount.', 'woo-donation-popup' ),
			);
		}

		$min = (float) $min_price;
		if ( $min > 0 && $amount + 0.0001 < $min ) {
			$formatted = class_exists( 'WDP_Cart' )
				? WDP_Cart::format_amount_for_message( $min, true )
				: (string) $min;
			return array(
				'ok'      => false,
				'amount'  => $amount,
				'code'    => 'below_min',
				'message' => sprintf(
					/* translators: %s: formatted minimum amount with currency */
					__( 'Please enter %s or more for the add-on donation.', 'woo-donation-popup' ),
					$formatted
				),
			);
		}

		return array(
			'ok'      => true,
			'amount'  => $amount,
			'code'    => 'valid',
			'message' => '',
		);
	}

	/**
	 * Log debug message.
	 *
	 * Only logs if WP_DEBUG is enabled. Supports arrays, objects, and strings.
	 *
	 * @since 10.0
	 * @param mixed $message Message to log. Can be string, array, or object.
	 * @return void
	 */
	public static function log( $message ) {
		if ( ! self::$debug_enabled ) {
			return;
		}

		if ( function_exists( 'wdp_debug_log' ) ) {
			wdp_debug_log( $message );
			return;
		}

		if ( is_array( $message ) || is_object( $message ) ) {
			error_log( print_r( $message, true ) );
			return;
		}

		error_log( (string) $message );
	}

	/**
	 * Notice shown only to shop editors in place of a form that cannot be displayed.
	 *
	 * Visitors always get an empty string, so a misconfigured shortcode never shows them an error.
	 *
	 * @param string $message Plain-text message.
	 * @return string Safe HTML (or '').
	 */
	public static function admin_notice_html( $message ) {
		$in_editor = class_exists( 'WDP_Builder_Detect' ) && WDP_Builder_Detect::is_builder_preview();
		$in_admin  = function_exists( 'is_admin' ) && is_admin()
			&& ! ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() );
		if ( ! $in_editor && ! $in_admin ) {
			return '';
		}
		$message = trim( (string) $message );
		if ( $message === '' ) {
			return '';
		}
		self::enqueue_admin_notice_style();
		return '<div class="wdp-admin-notice" role="note">' . esc_html( $message ) . '</div>';
	}

	/**
	 * Tiny stylesheet for .wdp-admin-notice (printed in the footer when content is already rendering).
	 *
	 * @return void
	 */
	private static function enqueue_admin_notice_style() {
		static $done = false;
		if ( $done || ! function_exists( 'wp_register_style' ) || ! function_exists( 'wp_add_inline_style' ) ) {
			return;
		}
		$done = true;
		wp_register_style( 'wdp-admin-notice', false, array(), defined( 'WDP_VERSION' ) ? WDP_VERSION : false );
		wp_enqueue_style( 'wdp-admin-notice' );
		wp_add_inline_style( 'wdp-admin-notice', '.wdp-admin-notice{box-sizing:border-box;margin:12px 0;padding:10px 14px;border:1px solid #f0b849;border-left-width:4px;border-radius:4px;background:#fcf9e8;color:#1e1e1e;font-size:14px;line-height:1.5}' );
	}

	/**
	 * Send JSON error response and terminate execution.
	 *
	 * Handles both string messages and WDP_Exception objects.
	 * Automatically logs exceptions and includes validation errors if available.
	 *
	 * @since 10.0
	 * @param string|WDP_Exception $message Error message or exception object.
	 * @param array                $extra   Extra data to include in response.
	 * @return never
	 * @throws Never Returns, always terminates execution.
	 */
	public static function json_error( $message, array $extra = array() ) {
		$error_message = is_string( $message ) ? $message : '';
		$error_code    = 'error';
		$http_status   = 400;
		$error_data    = array();
		$retry_after   = 0;

		// Handle exception objects
		if ( $message instanceof WDP_Exception ) {
			$error_message = $message->getMessage();
			$raw_code      = (int) $message->getCode();
			$http_status   = ( $raw_code >= 400 && $raw_code < 600 ) ? $raw_code : 500;
			$error_code    = $raw_code > 0 ? $raw_code : 'error';

			$message->log();

			if ( $message instanceof WDP_Security_Exception ) {
				$error_code  = $message->getKind();
				$http_status = ( 'rate_limit' === $error_code ) ? 429 : 403;
				$retry_after = $message->getRetryAfter();
			} elseif ( $message instanceof WDP_Validation_Exception ) {
				$error_data['errors'] = $message->getErrors();
				$error_code           = 'validation_error';
				$http_status          = 400;
			}

			if ( $http_status === 200 ) {
				$http_status = 400;
			}
		} elseif ( is_string( $message ) ) {
			$error_message = $message;
			$error_code    = 400;
			$http_status   = 400;
		}

		if ( isset( $extra['http_status'] ) ) {
			$http_status = (int) $extra['http_status'];
			unset( $extra['http_status'] );
		}

		if ( $http_status < 400 || $http_status > 599 ) {
			$http_status = 400;
		}

		$response = array_merge(
			array(
				'success' => false,
				'message' => $error_message,
				'code'    => $error_code,
			),
			$error_data,
			$extra
		);

		if ( $http_status === 429 && $retry_after > 0 ) {
			$response['retry_after'] = (int) $retry_after;
			if ( ! headers_sent() ) {
				header( 'Retry-After: ' . (int) $retry_after, true );
			}
		}

		wp_send_json( $response, $http_status );
		wp_die();
	}

	/**
	 * Handle exception gracefully.
	 *
	 * Logs the exception and optionally sends a JSON error response.
	 *
	 * @since 10.0
	 * @param Exception $exception      Exception object to handle.
	 * @param bool      $json_response  Whether to send JSON response. Default false.
	 * @return void
	 */
	public static function handle_exception( Exception $exception, $json_response = false ) {
		self::log(
			array(
				'exception' => get_class( $exception ),
				'message'   => $exception->getMessage(),
				'file'      => $exception->getFile(),
				'line'      => $exception->getLine(),
				'trace'     => $exception->getTraceAsString(),
			)
		);

		if ( $json_response ) {
			if ( $exception instanceof WDP_Exception ) {
				self::json_error( $exception );
				return;
			}
			$message = __( 'An error occurred. Please try again.', 'woo-donation-popup' );
			if ( self::$debug_enabled ) {
				$message = $exception->getMessage();
			}
			self::json_error( $message, array( 'http_status' => 500 ) );
		}
	}

	/**
	 * Send JSON success response and terminate execution.
	 *
	 * @since 10.0
	 * @param array $data Data to include in success response.
	 * @return never
	 * @throws Never Returns, always terminates execution.
	 */
	public static function json_success( array $data = array() ) {
		wp_send_json(
			array_merge(
				array(
					'success' => true,
				),
				$data
			)
		);
		wp_die();
	}

	/**
	 * Get total donation amount for a product from paid orders (wdp_progress_paid_statuses).
	 *
	 * ÖNEMLİ: Bu fonksiyon SADECE belirtilen ürün ID'si için yapılan bağışları sayar.
	 * Her ürün için ayrı progress bar olduğundan, ürünler birbirine karışmaz.
	 *
	 * @since 10.2.0
	 * @param int $product_id Product ID. Sadece bu ürün için yapılan bağışlar sayılır.
	 * @return float Total donation amount for this specific product only.
	 */
	public static function get_total_donation_amount( $product_id ) {
		$product_id = absint( $product_id );

		if ( ! $product_id ) {
			return 0.0;
		}

		// Cache key - her ürün için ayrı cache
		$cache_key = 'wdp_total_donation_' . $product_id;

		// Try to get from cache first
		$cached = wp_cache_get( $cache_key, 'wdp_donations' );
		if ( false !== $cached ) {
			return floatval( $cached );
		}

		$meta_total = get_post_meta( $product_id, '_wdp_total_donation_amount', true );
		if ( $meta_total !== '' && is_numeric( $meta_total ) ) {
			$meta_total = max( 0.0, floatval( $meta_total ) );
			wp_cache_set( $cache_key, $meta_total, 'wdp_donations', HOUR_IN_SECONDS );
			return $meta_total;
		}

		// Meta boş: ziyaretçi isteğinde ağır tarama YAPMA; arka planda hesapla, şimdilik 0 göster.
		self::schedule_product_donation_total_recalc( $product_id );
		wp_cache_set( $cache_key, 0.0, 'wdp_donations', MINUTE_IN_SECONDS );

		return 0.0;
	}

	/**
	 * Ürün için tamamlanmış bağışçı sayısı.
	 *
	 * @param int $product_id Product ID.
	 * @return int
	 */
	public static function get_donor_count( $product_id ) {
		$product_id = absint( $product_id );
		if ( ! $product_id ) {
			return 0;
		}
		$cache_key = 'wdp_donor_count_' . $product_id;
		$cached    = wp_cache_get( $cache_key, 'wdp_donations' );
		if ( false !== $cached ) {
			return max( 0, (int) $cached );
		}
		$meta  = get_post_meta( $product_id, '_wdp_donor_count', true );
		$count = ( $meta !== '' && is_numeric( $meta ) ) ? max( 0, (int) $meta ) : 0;
		wp_cache_set( $cache_key, $count, 'wdp_donations', HOUR_IN_SECONDS );
		return $count;
	}

	/**
	 * Bulk progress totals (uses cached _wdp_total_donation_amount; empty meta = 0, no N+1 recalculation).
	 *
	 * @param int[] $product_ids Product IDs.
	 * @return array<int, float>
	 */
	public static function get_totals_for_products( array $product_ids ) {
		$out = array();
		foreach ( $product_ids as $product_id ) {
			$product_id = absint( $product_id );
			if ( $product_id <= 0 ) {
				continue;
			}
			$meta               = get_post_meta( $product_id, '_wdp_total_donation_amount', true );
			$out[ $product_id ] = ( $meta !== '' && is_numeric( $meta ) ) ? max( 0.0, (float) $meta ) : 0.0;
		}
		return $out;
	}


	/**
	 * Arka plan seçeneği düz #hex veya eski gradient dizgesi olabilir; çıktıda yalnızca düz hex kullanılır.
	 *
	 * @param mixed  $value    Kayıtlı veya gönderilmiş değer.
	 * @param string $fallback Geçersizse kullanılacak renk.
	 * @return string
	 */
	public static function coerce_solid_hex_background( $value, $fallback = '#ffffff' ) {
		if ( ! is_string( $value ) || '' === $value ) {
			return $fallback;
		}
		$trim = trim( $value );
		$hex  = sanitize_hex_color( $trim );
		if ( $hex ) {
			return $hex;
		}
		if ( preg_match_all( '/#(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{6})\b/', $trim, $matches ) && ! empty( $matches[0] ) ) {
			foreach ( $matches[0] as $candidate ) {
				$san = sanitize_hex_color( $candidate );
				if ( $san ) {
					return $san;
				}
			}
		}
		return $fallback;
	}

	/**
	 * Progress bar dolgu rengi (tek renk); eski fill_start / fill_mid / fill_end ile uyum.
	 *
	 * @param array $settings wdp_progress_bar_settings.
	 * @return string
	 */
	public static function resolve_progress_bar_fill_color( array $settings ) {
		if ( ! empty( $settings['fill_color'] ) && sanitize_hex_color( $settings['fill_color'] ) ) {
			return sanitize_hex_color( $settings['fill_color'] );
		}
		foreach ( array( 'fill_mid', 'fill_start', 'fill_end' ) as $key ) {
			if ( ! empty( $settings[ $key ] ) && sanitize_hex_color( $settings[ $key ] ) ) {
				return sanitize_hex_color( $settings[ $key ] );
			}
		}
		return '#2563eb';
	}
}

// Note: init() is called by Woo_Donation_Popup::__construct()

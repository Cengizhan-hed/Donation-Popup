<?php
/**
 * Psalm taint stub'ları: WordPress kaçışlama/temizleme fonksiyonları ve $wpdb.
 * Yalnız geliştirme (analyse:security); pakete girmez. WordPress gövdesi yüklenmez.
 *
 * Kural: kaçışlama yalnız ilgili çıktı bağlamını "temizler" (HTML için esc_html, SQL için prepare, ...).
 * Kasıtlı olarak muhafazakâr: sanitize_text_field SQL'i temizlemez (yalnız html).
 *
 * @package WooCommerce\Donation_Popup
 */

/**
 * @param mixed $text
 * @return string
 * @psalm-taint-escape html
 * @psalm-taint-escape has_quotes
 */
function esc_html( $text ) { return ''; }
/** @psalm-taint-escape html
 *  @psalm-taint-escape has_quotes */
function esc_attr( $text ) { return ''; }
/** @psalm-taint-escape html */
function esc_textarea( $text ) { return ''; }
/**
 * @psalm-taint-escape html
 * @psalm-taint-escape has_quotes
 * @psalm-taint-escape ssrf
 * @psalm-taint-escape header
 */
function esc_url( $url, $protocols = null, $_context = 'display' ) { return ''; }
/** @psalm-taint-escape html
 *  @psalm-taint-escape has_quotes */
function esc_url_raw( $url, $protocols = null ) { return ''; }
/** @psalm-taint-escape html
 *  @psalm-taint-escape has_quotes */
function esc_js( $text ) { return ''; }
/** @psalm-taint-escape html
 *  @psalm-taint-escape has_quotes */
function esc_html__( $text, $domain = 'default' ) { return ''; }
/** @psalm-taint-escape html
 *  @psalm-taint-escape has_quotes */
function esc_attr__( $text, $domain = 'default' ) { return ''; }
/** @psalm-taint-escape html
 *  @psalm-taint-escape has_quotes */
function esc_html_x( $text, $context, $domain = 'default' ) { return ''; }
/** @psalm-taint-escape html
 *  @psalm-taint-escape has_quotes */
function esc_attr_x( $text, $context, $domain = 'default' ) { return ''; }
/** @psalm-taint-escape html
 *  @psalm-taint-escape has_quotes */
function esc_html_e( $text, $domain = 'default' ) { echo ''; }
/** @psalm-taint-escape html
 *  @psalm-taint-escape has_quotes */
function esc_attr_e( $text, $domain = 'default' ) { echo ''; }

/** @psalm-taint-escape html */
function wp_kses( $content, $allowed_html, $allowed_protocols = array() ) { return ''; }
/** @psalm-taint-escape html */
function wp_kses_post( $data ) { return ''; }
/** @psalm-taint-escape html */
function wp_kses_data( $data ) { return ''; }
/** @psalm-taint-escape html */
function wp_strip_all_tags( $text, $remove_breaks = false ) { return ''; }

/** @psalm-taint-escape html */
function sanitize_text_field( $str ) { return ''; }
/** @psalm-taint-escape html */
function sanitize_textarea_field( $str ) { return ''; }
/** @psalm-taint-escape html */
function sanitize_email( $email ) { return ''; }
/** @psalm-taint-escape html */
function sanitize_title( $title, $fallback_title = '', $context = 'save' ) { return ''; }
/** @psalm-taint-escape html */
function sanitize_user( $username, $strict = false ) { return ''; }
/** @psalm-taint-escape html */
function wc_clean( $var ) { return ''; }
/**
 * @psalm-taint-escape html
 * @psalm-taint-escape sql
 * @psalm-taint-escape file
 * @psalm-taint-escape has_quotes
 */
function sanitize_key( $key ) { return ''; }
/**
 * @psalm-taint-escape html
 * @psalm-taint-escape sql
 * @psalm-taint-escape file
 * @psalm-taint-escape shell
 */
function sanitize_file_name( $filename ) { return ''; }
/**
 * @psalm-taint-escape html
 * @psalm-taint-escape sql
 * @psalm-taint-escape file
 * @psalm-taint-escape has_quotes
 */
function absint( $maybeint ) { return 0; }
/** @psalm-taint-escape html
 *  @psalm-taint-escape sql */
function wc_format_decimal( $number, $dp = false, $trim_zeros = false ) { return ''; }

/** Geçişli (temizlemez): yalnız değeri döndürür. */
function wp_unslash( $value ) { return $value; }

/**
 * wp_redirect hedefi doğrulamaz (header sink); wp_safe_redirect doğrular.
 *
 * @psalm-taint-sink header $location
 */
function wp_redirect( $location, $status = 302, $x_redirect_by = 'WordPress' ) { return true; }
function wp_safe_redirect( $location, $status = 302, $x_redirect_by = 'WordPress' ) { return true; }

class wpdb {
	/**
	 * @param string $query
	 * @param mixed  ...$args
	 * @return string
	 * @psalm-taint-escape sql
	 * @psalm-taint-escape has_quotes
	 */
	public function prepare( $query, ...$args ) { return ''; }
	/** @psalm-taint-escape sql */
	public function esc_like( $text ) { return ''; }
	/** @psalm-taint-sink sql $query */
	public function query( $query ) { return 0; }
	/** @psalm-taint-sink sql $query */
	public function get_results( $query = null, $output = OBJECT ) { return array(); }
	/** @psalm-taint-sink sql $query */
	public function get_var( $query = null, $x = 0, $y = 0 ) { return null; }
	/** @psalm-taint-sink sql $query */
	public function get_row( $query = null, $output = OBJECT, $y = 0 ) { return null; }
	/** @psalm-taint-sink sql $query */
	public function get_col( $query = null, $x = 0 ) { return array(); }
}

/** REST girdisi: ziyaretçi kontrollü (kaynak). */
class WP_REST_Request {
	/**
	 * @param string $key
	 * @return mixed
	 * @psalm-taint-source input
	 */
	public function get_param( $key ) { return ''; }
	/**
	 * @return array<string, mixed>
	 * @psalm-taint-source input
	 */
	public function get_params() { return array(); }
	/**
	 * @return array<string, mixed>|null
	 * @psalm-taint-source input
	 */
	public function get_json_params() { return array(); }
	/**
	 * @return array<string, mixed>
	 * @psalm-taint-source input
	 */
	public function get_body_params() { return array(); }
	/**
	 * @return array<string, mixed>
	 * @psalm-taint-source input
	 */
	public function get_query_params() { return array(); }
	/**
	 * @return string
	 * @psalm-taint-source input
	 */
	public function get_body() { return ''; }
	/**
	 * @param string $key
	 * @return string|null
	 * @psalm-taint-source input
	 */
	public function get_header( $key ) { return ''; }
}

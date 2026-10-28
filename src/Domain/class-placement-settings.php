<?php
/**
 * "Ürün sayfası ve liste" ayarları (wdp_placement_settings): varsayılanlar, normalleştirme ve okuma.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Placement / scope / loop settings with a single normalizer.
 */
class Placement_Settings {

	const OPTION = 'wdp_placement_settings';

	const POSITIONS    = array( 'replace_cart', 'after_excerpt', 'below_summary' );
	const DISPLAYS     = array( 'inline', 'button_popup', 'button_panel' );
	const LOOP_BUTTONS = array( 'link', 'popup', 'panel', 'off' );
	const SCOPES       = array( 'all', 'categories', 'marked' );

	/** @var array<string, mixed>|null */
	private static $cache = null;

	/**
	 * Defaults of a new install (10.28.1: WooCommerce pages replace Add to cart with Donate).
	 *
	 * @return array<string, mixed>
	 */
	public static function defaults() {
		return array(
			'auto_place'          => 'yes',
			'position'            => 'replace_cart',
			'display'             => 'button_panel',
			'hide_price'          => 'yes',
			'show_form_title'     => 'no',
			'loop_button'         => 'panel',
			'donation_scope'      => 'all',
			'donation_categories' => array(),
		);
	}

	/**
	 * Normalize any stored/posted value; unknown keys are dropped, missing keys get defaults.
	 *
	 * @param mixed $raw Raw settings.
	 * @return array<string, mixed>
	 */
	public static function normalize( $raw ) {
		$raw      = is_array( $raw ) ? $raw : array();
		$defaults = self::defaults();
		$out      = array();

		$out['auto_place']      = self::yes_no( $raw, 'auto_place', $defaults['auto_place'] );
		$out['position']        = self::choice( $raw, 'position', self::POSITIONS, $defaults['position'] );
		$out['display']         = self::choice( $raw, 'display', self::DISPLAYS, $defaults['display'] );
		$out['hide_price']      = self::yes_no( $raw, 'hide_price', $defaults['hide_price'] );
		$out['show_form_title'] = self::yes_no( $raw, 'show_form_title', $defaults['show_form_title'] );
		$out['loop_button']     = self::choice( $raw, 'loop_button', self::LOOP_BUTTONS, $defaults['loop_button'] );
		$out['donation_scope']  = self::choice( $raw, 'donation_scope', self::SCOPES, $defaults['donation_scope'] );

		$categories = isset( $raw['donation_categories'] ) ? $raw['donation_categories'] : array();
		if ( is_string( $categories ) ) {
			$categories = explode( ',', $categories );
		}
		$categories = is_array( $categories ) ? array_values( array_unique( array_filter( array_map( 'absint', $categories ) ) ) ) : array();
		sort( $categories, SORT_NUMERIC );
		$out['donation_categories'] = $categories;

		return $out;
	}

	/**
	 * Applied settings. Before the migration wrote the option, automatic placement stays off
	 * so an upgraded site never gets a second form on its product pages until 10.28.1 runs.
	 *
	 * @return array<string, mixed>
	 */
	public static function get() {
		if ( null !== self::$cache ) {
			return self::$cache;
		}
		$stored = get_option( self::OPTION, false );
		if ( ! is_array( $stored ) ) {
			$stored = array( 'auto_place' => 'no' );
		}
		self::$cache = self::normalize( $stored );
		return self::$cache;
	}

	/**
	 * @param string $key     Setting key.
	 * @param mixed  $default_value Fallback for unknown keys.
	 * @return mixed
	 */
	public static function value( $key, $default_value = null ) {
		$settings = self::get();
		return array_key_exists( $key, $settings ) ? $settings[ $key ] : $default_value;
	}

	/**
	 * @param mixed $raw Raw settings.
	 * @return array<string, mixed> Saved settings.
	 */
	public static function save( $raw ) {
		$clean   = self::normalize( $raw );
		$current = get_option( self::OPTION, false );
		if ( $current === $clean ) {
			self::$cache = $clean;
			return $clean;
		}
		update_option( self::OPTION, $clean, true ); // Her istekte okunur: otomatik yüklenir (ek sorgu yok).
		self::flush();
		do_action( 'donation_panel_totals_changed' );
		return $clean;
	}

	/**
	 * @return void
	 */
	public static function flush() {
		self::$cache = null;
		Donation_Scope::flush();
	}

	/**
	 * @param array<string, mixed>  $raw     Raw settings.
	 * @param string $key     Key.
	 * @param string $default_value yes|no.
	 * @return string
	 */
	private static function yes_no( array $raw, $key, $default_value ) {
		if ( ! array_key_exists( $key, $raw ) ) {
			return $default_value;
		}
		$value = $raw[ $key ];
		if ( is_bool( $value ) ) {
			return $value ? 'yes' : 'no';
		}
		$value = strtolower( trim( (string) ( is_scalar( $value ) ? $value : '' ) ) );
		if ( in_array( $value, array( 'yes', '1', 'true', 'on' ), true ) ) {
			return 'yes';
		}
		if ( in_array( $value, array( 'no', '0', 'false', 'off', '' ), true ) ) {
			return 'no';
		}
		return $default_value;
	}

	/**
	 * @param array<string, mixed>    $raw     Raw settings.
	 * @param string   $key     Key.
	 * @param string[] $allowed Allowed values.
	 * @param string   $default_value Default.
	 * @return string
	 */
	private static function choice( array $raw, $key, array $allowed, $default_value ) {
		$value = isset( $raw[ $key ] ) && is_scalar( $raw[ $key ] ) ? sanitize_key( (string) $raw[ $key ] ) : '';
		return in_array( $value, $allowed, true ) ? $value : $default_value;
	}
}

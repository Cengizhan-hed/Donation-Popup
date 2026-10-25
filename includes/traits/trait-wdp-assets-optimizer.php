<?php
/**
 * SiteGround, WP Rocket, LiteSpeed ve Autoptimize birleştirme dışlamaları.
 *
 * @package WooCommerce\Donation_Popup
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

trait WDP_Assets_Optimizer_Trait {
	private static function register_optimizer_exclusions() {
		// SiteGround Speed Optimizer (handle ile)
		add_filter( 'sgo_css_combine_exclude', array( __CLASS__, 'exclude_css_handle_only' ) );
		add_filter( 'sgo_css_minify_exclude', array( __CLASS__, 'exclude_css_handle_only' ) );

		// WP Rocket (path ile; minify ve combine exclude)
		add_filter( 'pre_get_rocket_option_exclude_css', array( __CLASS__, 'exclude_css_wp_rocket' ) );
		add_filter( 'pre_get_rocket_option_minify_css_exclude', array( __CLASS__, 'exclude_css_wp_rocket' ) );

		// LiteSpeed Cache (path/regex ile)
		add_filter( 'litespeed_optimize_css_excludes', array( __CLASS__, 'exclude_css_litespeed' ) );

		// Autoptimize (URL/handle pattern ile; virgülle ayrılmış string)
		add_filter( 'autoptimize_filter_css_exclude', array( __CLASS__, 'exclude_css_autoptimize' ), 10, 1 );

		// Breeze (path pattern; filter adı eklenti sürümüne göre değişebilir)
		add_filter( 'breeze_filter_css_exclude', array( __CLASS__, 'exclude_css_path_patterns' ) );

		// Diğer eklentiler için genel filter (handle döndürür)
		add_filter( 'wdp_optimizer_css_exclude_handles', array( __CLASS__, 'exclude_css_handle_only' ) );
	}

	/**
	 * style_loader_tag: Link etiketine data-no-optimize ekle; birçok eklenti bunu tanır.
	 */
	public static function style_loader_tag_add_no_optimize( $html, $handle, $href, $media ) {
		$is_wdp_layer = ( strpos( $handle, 'wdp-css-layer-' ) === 0 ) || ( $handle === self::FRONTEND_CSS_HANDLE );
		if ( ! $is_wdp_layer ) {
			return $html;
		}
		$attr = ' data-no-optimize="1" data-noptimize="1" data-skip-optimize="1"';
		if ( strpos( $html, ' data-no-optimize' ) === false ) {
			$html = str_replace( '>', $attr . '>', $html );
		}
		return $html;
	}

	/**
	 * Exclude patterns (path) döndürür; path-based exclude kullanan eklentiler için.
	 *
	 * @return array { 'path' => ..., 'filename' => ..., 'path_slash' => ... }
	 */
	private static function get_frontend_css_exclude_patterns() {
		$plugin_dir     = defined( 'WDP_PLUGIN_DIR' ) ? WDP_PLUGIN_DIR : plugin_dir_path( dirname( __DIR__ ) );
		$path_from_root = str_replace( ABSPATH, '', $plugin_dir );
		$path_from_root = trim( $path_from_root, '/\\' );
		$rel_file       = $path_from_root . '/assets/css/donation-modal.css';
		$rel_src        = $path_from_root . '/assets/css/src';
		return array(
			'filename'   => 'donation-modal.css',
			'path'       => $rel_file,
			'path_slash' => '/' . $rel_file,
			'src_dir'    => $rel_src,
			'src_slash'  => '/' . $rel_src,
		);
	}

	/**
	 * Handle ile exclude (SiteGround vb.).
	 *
	 * @param array $exclude_list
	 * @return array
	 */
	public static function exclude_css_handle_only( $exclude_list ) {
		return self::merge_optimizer_exclude_array( $exclude_list, self::get_optimizer_css_handle_excludes() );
	}

	/**
	 * Path pattern listesi (LiteSpeed, Breeze vb.).
	 *
	 * @param array $exclude_list
	 * @return array
	 */
	public static function exclude_css_path_patterns( $exclude_list ) {
		return self::merge_optimizer_exclude_array( $exclude_list, self::get_optimizer_css_path_excludes() );
	}

	/**
	 * LiteSpeed: path veya regex ile exclude.
	 */
	public static function exclude_css_litespeed( $exclude_list ) {
		return self::exclude_css_path_patterns( is_array( $exclude_list ) ? $exclude_list : array() );
	}

	/**
	 * WP Rocket: exclude_css ve minify_css_exclude option'larına ekle.
	 * Değer string (newline) veya array olabilir.
	 */
	public static function exclude_css_wp_rocket( $value ) {
		$p      = self::get_frontend_css_exclude_patterns();
		$to_add = array( $p['path_slash'], $p['filename'], $p['src_slash'], 'assets/css/src' );
		return self::merge_optimizer_exclude_mixed( $value, $to_add );
	}

	/**
	 * Autoptimize: exclude string'e ekle (virgülle ayrılmış veya array).
	 */
	public static function exclude_css_autoptimize( $exclude ) {
		$p   = self::get_frontend_css_exclude_patterns();
		$add = array_merge(
			array( self::FRONTEND_CSS_HANDLE, $p['filename'], $p['path'], $p['src_dir'], 'wdp-css-layer' ),
			self::get_optimizer_css_handle_excludes()
		);
		return self::merge_optimizer_exclude_mixed( $exclude, $add );
	}

	/**
	 * CSS handle names for optimizer exclude lists.
	 *
	 * @return string[]
	 */
	private static function get_optimizer_css_handle_excludes() {
		$handles = array( self::FRONTEND_CSS_HANDLE );
		for ( $i = 0; $i < 24; $i++ ) {
			$handles[] = 'wdp-css-layer-' . $i;
		}
		return $handles;
	}

	/**
	 * Path patterns for optimizer exclude lists.
	 *
	 * @return string[]
	 */
	private static function get_optimizer_css_path_excludes() {
		$p     = self::get_frontend_css_exclude_patterns();
		$paths = array(
			$p['filename'],
			$p['path'],
			$p['path_slash'],
			'assets/css/src',
			'/assets/css/src',
		);
		if ( ! empty( $p['src_dir'] ) ) {
			$paths[] = $p['src_dir'];
		}
		if ( ! empty( $p['src_slash'] ) ) {
			$paths[] = $p['src_slash'];
		}
		return $paths;
	}

	/**
	 * Merge exclude tokens into an array list.
	 *
	 * @param mixed    $exclude_list Existing list.
	 * @param string[] $to_add       Tokens to append.
	 * @return array
	 */
	private static function merge_optimizer_exclude_array( $exclude_list, array $to_add ) {
		if ( ! is_array( $exclude_list ) ) {
			$exclude_list = array();
		}
		return array_values( array_unique( array_merge( $exclude_list, $to_add ) ) );
	}

	/**
	 * Merge exclude tokens into array or newline/comma string options.
	 *
	 * @param mixed    $value  Existing value.
	 * @param string[] $to_add Tokens to append.
	 * @return mixed
	 */
	private static function merge_optimizer_exclude_mixed( $value, array $to_add ) {
		if ( is_array( $value ) ) {
			return self::merge_optimizer_exclude_array( $value, $to_add );
		}
		if ( is_string( $value ) ) {
			$lines = array_filter( array_map( 'trim', preg_split( '/[\r\n,]+/', $value ) ) );
			return implode( "\n", self::merge_optimizer_exclude_array( $lines, $to_add ) );
		}
		return $value;
	}
}

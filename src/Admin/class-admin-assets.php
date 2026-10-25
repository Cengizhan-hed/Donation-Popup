<?php
/**
 * Yönetici varlıkları: CSS/JS yalnız Donation Panel'in kendi ekranlarında yüklenir (Y6 kuralı).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Admin_Assets.
 */
final class Admin_Assets {

	const HANDLE = 'donation-panel-admin';

	/**
	 * Eklenti kök dizini.
	 *
	 * @var string
	 */
	private $plugin_dir;

	/**
	 * Eklenti kök URL'si.
	 *
	 * @var string
	 */
	private $plugin_url;

	/**
	 * Kendi ekranlarımızın kancaları.
	 *
	 * @var string[]
	 */
	private $hooks = array();

	/**
	 * Kurucu.
	 *
	 * @param string $plugin_dir Kök dizin.
	 * @param string $plugin_url Kök URL.
	 */
	public function __construct( $plugin_dir, $plugin_url ) {
		$this->plugin_dir = rtrim( (string) $plugin_dir, '/\\' ) . '/';
		$this->plugin_url = rtrim( (string) $plugin_url, '/' ) . '/';
	}

	/**
	 * Kendi ekran kancasını kaydeder.
	 *
	 * @param string $hook_suffix add_submenu_page dönüşü.
	 * @return void
	 */
	public function own( $hook_suffix ) {
		if ( is_string( $hook_suffix ) && '' !== $hook_suffix ) {
			$this->hooks[] = $hook_suffix;
		}
	}

	/**
	 * Yalnız kendi ekranımızda kuyruğa alır.
	 *
	 * @param string $hook_suffix Geçerli ekran.
	 * @return void
	 */
	public function enqueue( $hook_suffix ) {
		if ( ! in_array( (string) $hook_suffix, $this->hooks, true ) ) {
			return;
		}
		$css = 'src/Admin/assets/admin.css';
		$js  = 'src/Admin/assets/admin.js';
		$ver = defined( 'WDP_ASSET_VERSION' ) ? (string) WDP_ASSET_VERSION : '1';
		if ( is_readable( $this->plugin_dir . $css ) ) {
			$ver .= '.' . (string) filemtime( $this->plugin_dir . $css );
		}

		wp_enqueue_style( self::HANDLE, $this->plugin_url . $css, array(), $ver );
		wp_enqueue_script( self::HANDLE, $this->plugin_url . $js, array(), $ver, true );
		if ( function_exists( 'wp_script_add_data' ) ) {
			wp_script_add_data( self::HANDLE, 'strategy', 'defer' );
		}
	}
}

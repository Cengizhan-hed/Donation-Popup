<?php
/**
 * Yönetici varlıkları: CSS/JS yalnız Donation Panel'in kendi ekranlarında yüklenir (Y6 kuralı).
 * Derleme çıktısı (`wp-scripts`): `assets/build/admin/index.js|.css` + `index.asset.php`. jQuery kullanılmaz.
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
	const SCRIPT = 'assets/build/admin/index.js';
	const STYLE  = 'assets/build/admin/index.css';

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
	 * @param string|false $hook_suffix add_submenu_page dönüşü.
	 * @return void
	 */
	public function own( $hook_suffix ) {
		if ( is_string( $hook_suffix ) && '' !== $hook_suffix ) {
			$this->hooks[] = $hook_suffix;
		}
	}

	/**
	 * Kendi ekran kancaları.
	 *
	 * @return string[]
	 */
	public function hooks() {
		return $this->hooks;
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
		$js_path = $this->plugin_dir . self::SCRIPT;
		if ( ! is_readable( $js_path ) ) {
			return;
		}
		$asset = array(
			'dependencies' => array(),
			'version'      => (string) filemtime( $js_path ),
		);
		$meta  = $this->plugin_dir . 'assets/build/admin/index.asset.php';
		if ( is_readable( $meta ) ) {
			$loaded = include $meta;
			if ( is_array( $loaded ) ) {
				$asset = array_merge( $asset, $loaded );
			}
		}

		if ( is_readable( $this->plugin_dir . self::STYLE ) ) {
			wp_enqueue_style( self::HANDLE, $this->plugin_url . self::STYLE, array(), $asset['version'] );
			wp_style_add_data( self::HANDLE, 'rtl', 'replace' );
		}
		wp_enqueue_script( self::HANDLE, $this->plugin_url . self::SCRIPT, $asset['dependencies'], $asset['version'], true );
		wp_script_add_data( self::HANDLE, 'strategy', 'defer' );
		wp_add_inline_script(
			self::HANDLE,
			'window.donationPanelAdmin = ' . wp_json_encode(
				array(
					'rest'  => esc_url_raw( rest_url( 'donation-panel/v1/' ) ),
					'nonce' => wp_create_nonce( 'wp_rest' ),
					'i18n'  => array(
						'saved'        => __( 'Saved', 'woo-donation-popup' ),
						'saving'       => __( 'Saving...', 'woo-donation-popup' ),
						'unsaved'      => __( 'You have unsaved changes', 'woo-donation-popup' ),
						'error'        => __( 'Something went wrong. Please try again.', 'woo-donation-popup' ),
						'copied'       => __( 'Copied', 'woo-donation-popup' ),
						'imported'     => __( 'Settings imported. Reloading...', 'woo-donation-popup' ),
						'rcPreviewing' => __( 'Calculating the preview...', 'woo-donation-popup' ),
						'rcApplying'   => __( 'Applying...', 'woo-donation-popup' ),
						'rcApplied'    => __( 'The total was updated.', 'woo-donation-popup' ),
						'rcStale'      => __( 'The numbers changed since the preview. Please preview again.', 'woo-donation-popup' ),
						'rcSame'       => __( 'The stored total already matches. Nothing to change.', 'woo-donation-popup' ),
						'rcNote'       => __( 'Applying replaces the stored total with the calculated total and counts donations from the start date above.', 'woo-donation-popup' ),
						'rcNoRate'     => __( 'Some donations in another currency had no exchange rate and were left out.', 'woo-donation-popup' ),
						'carriedSaved' => __( 'The carried-over amount was saved.', 'woo-donation-popup' ),
						'manualSaved'  => __( 'The amount added by hand was saved.', 'woo-donation-popup' ),
						'badImport'    => __( 'The file does not look like a Donation Panel settings export.', 'woo-donation-popup' ),
					),
				)
			) . ';',
			'before'
		);
	}
}

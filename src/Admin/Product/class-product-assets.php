<?php
/**
 * Ürün düzenleme ekranındaki "Donation" sekmesinin CSS/JS dosyaları: yalnız ürün düzenleme ekranında yüklenir.
 * Derleme çıktısı (`wp-scripts`): `assets/build/admin-products/index.js|.css`. jQuery'ye bağımlı değildir
 * (ek bağış ürünü araması WooCommerce'in kendi `wc-enhanced-select` betiğini kullanır).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin\Product;

defined( 'ABSPATH' ) || exit;

/**
 * Product_Assets.
 */
final class Product_Assets {

	const HANDLE = 'donation-panel-admin-products';
	const SCRIPT = 'assets/build/admin-products/index.js';
	const STYLE  = 'assets/build/admin-products/index.css';

	/**
	 * Kancayı bağlar.
	 *
	 * @return void
	 */
	public static function register() {
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
	}

	/**
	 * Yalnız ürün düzenleme ekranında kuyruğa alır.
	 *
	 * @param string $hook_suffix Geçerli ekran.
	 * @return void
	 */
	public static function enqueue( $hook_suffix ) {
		if ( ! in_array( (string) $hook_suffix, array( 'post.php', 'post-new.php' ), true ) || ! current_user_can( Product_Data_Tab::CAPABILITY ) ) {
			return;
		}
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || 'product' !== $screen->post_type ) {
			return;
		}

		$dir   = defined( 'WDP_PLUGIN_DIR' ) ? WDP_PLUGIN_DIR : '';
		$url   = defined( 'WDP_PLUGIN_URL' ) ? WDP_PLUGIN_URL : '';
		$asset = array(
			'dependencies' => array(),
			'version'      => defined( 'WDP_VERSION' ) ? WDP_VERSION : '1',
		);
		$meta  = $dir . 'assets/build/admin-products/index.asset.php';
		if ( is_readable( $meta ) ) {
			$loaded = include $meta;
			if ( is_array( $loaded ) ) {
				$asset = array_merge( $asset, $loaded );
			}
		}
		if ( ! is_readable( $dir . self::SCRIPT ) ) {
			return;
		}

		// Ek bağış ürünü seçici: WooCommerce'in kendi ürün arama betiği.
		wp_enqueue_script( 'wc-enhanced-select' );
		wp_enqueue_style( 'woocommerce_admin_styles' );

		if ( is_readable( $dir . self::STYLE ) ) {
			wp_enqueue_style( self::HANDLE, $url . self::STYLE, array(), $asset['version'] );
			wp_style_add_data( self::HANDLE, 'rtl', 'replace' );
		}
		wp_enqueue_script( self::HANDLE, $url . self::SCRIPT, $asset['dependencies'], $asset['version'], true );
		wp_script_add_data( self::HANDLE, 'strategy', 'defer' );
		wp_add_inline_script(
			self::HANDLE,
			'window.wdpProductsAdmin = ' . wp_json_encode(
				array(
					'tabKey' => Product_Data_Tab::TAB_KEY,
					'i18n'   => array(
						'copied'     => __( 'Copied', 'woo-donation-popup' ),
						'copyFailed' => __( 'Could not copy; select the text and copy it manually.', 'woo-donation-popup' ),
					),
				)
			) . ';',
			'before'
		);
	}
}

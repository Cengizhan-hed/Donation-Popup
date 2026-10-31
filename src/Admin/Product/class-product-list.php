<?php
/**
 * WooCommerce ürün listesi: "Donation" sütunu ve bağış ürünü toplu işlemleri.
 *
 * Eski ayar ekranındaki ürün tablosu kaldırıldı: tam ürün listesi WooCommerce'in kendi ekranıdır, hedefli kampanyalar
 * Kampanyalar sayfasındadır. Burada yalnız WooCommerce listesinin vermediği iki şey kalır: bağış bayrağını görmek ve
 * seçili ürünlerde toplu değiştirmek.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin\Product;

use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Domain\Donation_Type;
use DonationPanel\Modules\EntryPoints\Donations_List;

defined( 'ABSPATH' ) || exit;

/**
 * Product_List.
 */
final class Product_List {

	const COLUMN     = 'wdp_donation';
	const CAPABILITY = 'manage_woocommerce';

	/**
	 * Toplu işlem adı => ürün bayrağı.
	 */
	const ACTIONS = array(
		'wdp_mark_donation' => 'yes',
		'wdp_mark_normal'   => 'no',
		'wdp_mark_global'   => '',
	);

	/**
	 * Kancaları bağlar.
	 *
	 * @return void
	 */
	public static function register() {
		add_filter( 'manage_edit-product_columns', array( __CLASS__, 'add_column' ), 20 );
		add_action( 'manage_product_posts_custom_column', array( __CLASS__, 'render_column' ), 10, 2 );
		add_filter( 'bulk_actions-edit-product', array( __CLASS__, 'register_actions' ) );
		add_filter( 'handle_bulk_actions-edit-product', array( __CLASS__, 'handle_actions' ), 10, 3 );
		add_action( 'admin_notices', array( __CLASS__, 'notice' ) );
	}

	/**
	 * Sütunu "Fiyat"tan sonra ekler.
	 *
	 * @param array<string, string> $columns Sütunlar.
	 * @return array<string, string>
	 */
	public static function add_column( $columns ) {
		$columns = is_array( $columns ) ? $columns : array();
		if ( ! current_user_can( self::CAPABILITY ) ) {
			return $columns;
		}
		$out = array();
		foreach ( $columns as $key => $label ) {
			$out[ $key ] = $label;
			if ( 'price' === $key ) {
				$out[ self::COLUMN ] = __( 'Donation', 'woo-donation-popup' );
			}
		}
		if ( ! isset( $out[ self::COLUMN ] ) ) {
			$out[ self::COLUMN ] = __( 'Donation', 'woo-donation-popup' );
		}
		return $out;
	}

	/**
	 * Sütun içeriği: bağış türü ya da tire.
	 *
	 * @param string $column  Sütun.
	 * @param int    $post_id Ürün.
	 * @return void
	 */
	public static function render_column( $column, $post_id ) {
		if ( self::COLUMN !== $column ) {
			return;
		}
		$product = wc_get_product( (int) $post_id );
		if ( ! $product || ! Donation_Scope::is_donation_product( $product ) ) {
			echo '<span aria-hidden="true">&ndash;</span><span class="screen-reader-text">' . esc_html__( 'Regular product', 'woo-donation-popup' ) . '</span>';
			return;
		}
		$type = Donation_Type::infer_from_meta(
			array(
				'_allow_custom_price'    => (string) $product->get_meta( '_allow_custom_price' ),
				'_allow_multiple_shares' => (string) $product->get_meta( '_allow_multiple_shares' ),
				'_enable_progress_bar'   => (string) $product->get_meta( '_enable_progress_bar' ),
			)
		);
		echo '<a href="' . esc_url( Product_Data_Tab::get_edit_url( (int) $post_id ) ) . '">' . esc_html( Donation_Type::get_label( $type ) ) . '</a>';
	}

	/**
	 * Toplu işlemleri listeye ekler.
	 *
	 * @param array<string, string> $actions Toplu işlemler.
	 * @return array<string, string>
	 */
	public static function register_actions( $actions ) {
		$actions = is_array( $actions ) ? $actions : array();
		if ( ! current_user_can( self::CAPABILITY ) ) {
			return $actions;
		}
		$actions['wdp_mark_donation'] = __( 'Make donation product', 'woo-donation-popup' );
		$actions['wdp_mark_normal']   = __( 'Make regular product', 'woo-donation-popup' );
		$actions['wdp_mark_global']   = __( 'Revert to the global setting', 'woo-donation-popup' );
		return $actions;
	}

	/**
	 * Toplu işlemi uygular (WordPress toplu işlem nonce'u çekirdekte denetlenir).
	 *
	 * @param string $redirect Yönlendirme adresi.
	 * @param string $action   İşlem.
	 * @param int[]  $ids      Ürün kimlikleri.
	 * @return string
	 */
	public static function handle_actions( $redirect, $action, $ids ) {
		if ( ! isset( self::ACTIONS[ $action ] ) || ! current_user_can( self::CAPABILITY ) ) {
			return $redirect;
		}
		return add_query_arg( 'wdp_bulk_marked', self::apply( (array) $ids, self::ACTIONS[ $action ] ), $redirect );
	}

	/**
	 * Toplu işlem sonucu bildirimi.
	 *
	 * @return void
	 */
	public static function notice() {
		if ( ! isset( $_GET['wdp_bulk_marked'] ) || ! current_user_can( self::CAPABILITY ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- yalnız sayı gösterilir.
			return;
		}
		$count = absint( wp_unslash( $_GET['wdp_bulk_marked'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		echo '<div class="notice notice-success is-dismissible"><p>' . esc_html(
			sprintf(
				/* translators: %d: product count */
				_n( 'Updated the donation flag for %d product.', 'Updated the donation flag for %d products.', $count, 'woo-donation-popup' ),
				$count
			)
		) . '</p></div>';
	}

	/**
	 * Bayrağı seçili ürünlere yazar.
	 *
	 * @param int[]  $ids  Ürün kimlikleri.
	 * @param string $flag ''|yes|no.
	 * @return int Güncellenen ürün sayısı.
	 */
	public static function apply( array $ids, $flag ) {
		$flag    = in_array( $flag, array( 'yes', 'no', '' ), true ) ? $flag : '';
		$updated = 0;
		foreach ( $ids as $id ) {
			$id = absint( $id );
			if ( $id <= 0 || ! current_user_can( 'edit_post', $id ) ) {
				continue;
			}
			$product = wc_get_product( $id );
			if ( ! $product instanceof \WC_Product ) {
				continue;
			}
			$product->update_meta_data( Donation_Scope::META, $flag );
			$product->save();
			Donation_Scope::flush( $id );
			++$updated;
		}
		if ( $updated ) {
			Donations_List::bump_cache();
		}
		return $updated;
	}
}

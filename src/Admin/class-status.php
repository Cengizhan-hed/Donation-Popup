<?php
/**
 * Genel Bakış durum kutusu ve kurulum ilerlemesi hesapları. Yalnız okur; WooCommerce/WordPress ayarlarını DEĞİŞTİRMEZ.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

use DonationPanel\Core\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Status.
 */
final class Status {

	/**
	 * Ayarlar.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Kurucu.
	 *
	 * @param Settings $settings Ayarlar.
	 */
	public function __construct( Settings $settings ) {
		$this->settings = $settings;
	}

	/**
	 * Ödeme sayfası: yok / yayında değil / klasik / blok.
	 *
	 * @return array{ok: bool, kind: string, label: string}
	 */
	public function checkout_page() {
		$id   = function_exists( 'wc_get_page_id' ) ? (int) wc_get_page_id( 'checkout' ) : 0;
		$post = $id > 0 ? get_post( $id ) : null;
		if ( ! $post || 'publish' !== $post->post_status ) {
			return array(
				'ok'    => false,
				'kind'  => 'missing',
				'label' => __( 'Checkout page is missing or not published', 'woo-donation-popup' ),
			);
		}
		$is_block = function_exists( 'has_block' ) && has_block( 'woocommerce/checkout', $post );
		return array(
			'ok'    => true,
			'kind'  => $is_block ? 'blocks' : 'classic',
			'label' => $is_block
				? __( 'Checkout page ready (block checkout)', 'woo-donation-popup' )
				: __( 'Checkout page ready (classic checkout)', 'woo-donation-popup' ),
		);
	}

	/**
	 * Mağaza para birimi (yalnız WooCommerce'in etkin para birimi).
	 *
	 * @return string
	 */
	public function currency_label() {
		if ( ! function_exists( 'get_woocommerce_currency' ) ) {
			return '';
		}
		$code   = (string) get_woocommerce_currency();
		$names  = function_exists( 'get_woocommerce_currencies' ) ? (array) get_woocommerce_currencies() : array();
		$symbol = function_exists( 'get_woocommerce_currency_symbol' ) ? html_entity_decode( (string) get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8' ) : '';
		$name   = isset( $names[ $code ] ) ? (string) $names[ $code ] : $code;
		return trim( $name . ' (' . $symbol . ')' );
	}

	/**
	 * Yayındaki bağış ürünü sayısı.
	 *
	 * @return int
	 */
	public function donation_product_count() {
		if ( class_exists( '\\DonationPanel\\WooCommerce\\Donation_Scope' ) ) {
			return (int) \DonationPanel\WooCommerce\Donation_Scope::count();
		}
		return class_exists( '\\WDP_Donation_Scope' ) ? (int) \WDP_Donation_Scope::count() : 0;
	}

	/**
	 * WordPress gizlilik politikası sayfası atanmış ve yayında mı.
	 *
	 * @return bool
	 */
	public function privacy_page_linked() {
		$id = (int) get_option( 'wp_page_for_privacy_policy', 0 );
		return $id > 0 && 'publish' === get_post_status( $id );
	}

	/**
	 * WooCommerce misafir siparişi (hesapsız ödeme) açık mı.
	 *
	 * @return bool
	 */
	public function guest_checkout_enabled() {
		return 'yes' === get_option( 'woocommerce_enable_guest_checkout', 'yes' );
	}

	/**
	 * Hedefli kampanya ürünü var mı.
	 *
	 * @return bool
	 */
	public function has_campaign() {
		return array() !== $this->campaign_ids( 1 );
	}

	/**
	 * Hedefi tanımlı ürünlerin kimlikleri (yayında ve taslak, çöp hariç).
	 *
	 * @param int $limit En çok kaç.
	 * @return int[]
	 */
	public function campaign_ids( $limit = 50 ) {
		$ids = get_posts(
			array(
				'post_type'      => 'product',
				'post_status'    => array( 'publish', 'draft', 'private', 'pending' ),
				'posts_per_page' => max( 1, (int) $limit ),
				'fields'         => 'ids',
				'orderby'        => 'date',
				'order'          => 'DESC',
				'no_found_rows'  => true,
				'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- yönetici ekranı, sınırlı sorgu.
					array(
						'key'     => '_progress_bar_limit',
						'value'   => 0,
						'type'    => 'NUMERIC',
						'compare' => '>',
					),
				),
			)
		);
		return array_map( 'intval', (array) $ids );
	}

	/**
	 * Durum kutusu öğeleri: [ kimlik, ok, metin, bağlantı, bağlantı metni ].
	 *
	 * @return array<int, array{id: string, ok: bool, text: string, url: string, link: string}>
	 */
	public function items() {
		$checkout = $this->checkout_page();
		$count    = $this->donation_product_count();
		$currency = $this->currency_label();
		$items    = array();

		$items[] = array(
			'id'   => 'checkout',
			'ok'   => $checkout['ok'],
			'text' => $checkout['label'],
			'url'  => admin_url( 'admin.php?page=wc-settings&tab=advanced' ),
			'link' => __( 'Fix', 'woo-donation-popup' ),
		);
		$items[] = array(
			'id'   => 'currency',
			'ok'   => '' !== $currency,
			/* translators: %s: currency name and symbol. */
			'text' => sprintf( __( 'Currency: %s', 'woo-donation-popup' ), $currency ),
			'url'  => admin_url( 'admin.php?page=wc-settings&tab=general' ),
			'link' => __( 'Change in WooCommerce', 'woo-donation-popup' ),
		);
		$items[] = array(
			'id'   => 'products',
			'ok'   => $count > 0,
			/* translators: %d: number of donation products. */
			'text' => sprintf( _n( '%d donation product is live', '%d donation products are live', $count, 'woo-donation-popup' ), $count ),
			'url'  => admin_url( 'edit.php?post_type=product' ),
			'link' => __( 'Products', 'woo-donation-popup' ),
		);
		$privacy = $this->privacy_page_linked();
		$items[] = array(
			'id'   => 'privacy',
			'ok'   => $privacy,
			'text' => $privacy ? __( 'Privacy policy page is set', 'woo-donation-popup' ) : __( 'Privacy policy page is not set', 'woo-donation-popup' ),
			'url'  => admin_url( 'options-privacy.php' ),
			'link' => __( 'Set it', 'woo-donation-popup' ),
		);
		$guest   = $this->guest_checkout_enabled();
		$items[] = array(
			'id'   => 'guest',
			'ok'   => $guest,
			'text' => $guest
				? __( 'Guest checkout is on: donors do not need an account', 'woo-donation-popup' )
				: __( 'Guest checkout is off: donors must create an account to give. Turn on guest checkout in WooCommerce.', 'woo-donation-popup' ),
			'url'  => admin_url( 'admin.php?page=wc-settings&tab=account' ),
			'link' => __( 'Open WooCommerce settings', 'woo-donation-popup' ),
		);
		return $items;
	}

	/**
	 * Kurulum adımları (6): [ kimlik, ok, bekleyen adımın kısa adı ].
	 *
	 * @return array<int, array{id: string, ok: bool, todo: string}>
	 */
	public function steps() {
		$checkout = $this->checkout_page();
		return array(
			array(
				'id'   => 'checkout',
				'ok'   => $checkout['ok'],
				'todo' => __( 'prepare the checkout page', 'woo-donation-popup' ),
			),
			array(
				'id'   => 'products',
				'ok'   => $this->donation_product_count() > 0,
				'todo' => __( 'publish a donation product', 'woo-donation-popup' ),
			),
			array(
				'id'   => 'wizard',
				'ok'   => 'done' === (string) $this->settings->get( 'admin.wizard', '' ),
				'todo' => __( 'finish the quick setup', 'woo-donation-popup' ),
			),
			array(
				'id'   => 'privacy',
				'ok'   => $this->privacy_page_linked(),
				'todo' => __( 'link your privacy page', 'woo-donation-popup' ),
			),
			array(
				'id'   => 'guest',
				'ok'   => $this->guest_checkout_enabled(),
				'todo' => __( 'allow guest checkout', 'woo-donation-popup' ),
			),
			array(
				'id'   => 'campaign',
				'ok'   => $this->has_campaign(),
				'todo' => __( 'create your first campaign', 'woo-donation-popup' ),
			),
		);
	}

	/**
	 * Tamamlanan adım sayısı.
	 *
	 * @return int
	 */
	public function progress() {
		return count( array_filter( array_column( $this->steps(), 'ok' ) ) );
	}

	/**
	 * Kampanya satırı verisi (ürün başına hedef/toplanan/durum). Toplanan = hesaplanan + elle eklenen.
	 *
	 * @param int $product_id Ürün.
	 * @return array{id: int, title: string, goal: float, raised: float, percent: int, status: string, edit: string}
	 */
	public function campaign_row( $product_id ) {
		$product_id = (int) $product_id;
		$goal       = (float) get_post_meta( $product_id, '_progress_bar_limit', true );
		$raised     = (float) get_post_meta( $product_id, '_wdp_total_donation_amount', true ) + (float) get_post_meta( $product_id, '_wdp_manual_total', true );
		$percent    = $goal > 0 ? (int) min( 100, floor( $raised / $goal * 100 ) ) : 0;
		return array(
			'id'      => $product_id,
			'title'   => (string) get_the_title( $product_id ),
			'goal'    => $goal,
			'raised'  => $raised,
			'percent' => $percent,
			'carried' => \DonationPanel\Domain\Campaign_Formula::get_carried( $product_id ),
			'start'   => \DonationPanel\Domain\Campaign_Formula::get_start( $product_id ),
			'status'  => (string) get_post_status( $product_id ),
			'edit'    => (string) get_edit_post_link( $product_id, 'raw' ),
		);
	}
}

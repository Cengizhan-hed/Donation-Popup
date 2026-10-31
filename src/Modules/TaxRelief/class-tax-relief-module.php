<?php
/**
 * Vergi indirimi beyanı modülü (ör. Gift Aid benzeri): isteğe bağlı, VARSAYILAN KAPALI.
 *
 * Form çekirdeğine DOKUNMAZ: `donation_panel_form_steps` ile ek adım ekler, adım içeriğini
 * `donation_panel_form_step_tax_relief` ile basar. Onay kutusu önceden işaretli DEĞİLDİR; kutu işaretlenirse
 * `donation_panel_tax_relief` değeri sepet öğesine, oradan WooCommerce sipariş kalemi ve sipariş meta alanına yazılır
 * (`_wdp_tax_relief_declared`, `_wdp_tax_relief_text_hash`; HPOS API'siyle, klasik ve blok ödemede aynı kanca).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\TaxRelief;

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Interface;
use DonationPanel\Core\Settings;
use DonationPanel\Frontend\Template_Loader;

defined( 'ABSPATH' ) || exit;

/**
 * Tax_Relief_Module.
 */
final class Tax_Relief_Module implements Module_Interface {

	/**
	 * Modül slug'ı.
	 */
	const SLUG = 'tax_relief';

	/**
	 * Sepete ekleme REST yolu.
	 */
	const CART_ROUTE = '/donation-panel/v1/cart/add';

	/**
	 * Bağımlılık kabı.
	 *
	 * @var Container|null
	 */
	private $container;

	/**
	 * Bu istekte onay kutusu işaretli mi (yalnız sepete ekleme isteğinde doludur).
	 *
	 * @var bool
	 */
	private $pending = false;

	/**
	 * Aynı istekteki ek bağış satırı için beyan anı bilgisi (hash + zaman); istek başında sıfırlanır.
	 *
	 * @var array{hash: string, time: int}|null
	 */
	private $snapshot = null;

	/**
	 * Kancaları kaydeder.
	 *
	 * @param Container $container Bağımlılık kabı.
	 * @return void
	 */
	public function register( Container $container ) {
		$this->container = $container;

		add_filter( 'donation_panel_form_steps', array( $this, 'add_step' ), 20, 2 );
		add_action( 'donation_panel_form_step_' . Tax_Relief_Declaration::STEP_ID, array( $this, 'render_step' ) );

		add_filter( 'rest_request_before_callbacks', array( $this, 'capture_request' ), 10, 3 );
		add_filter( 'woocommerce_add_cart_item_data', array( $this, 'add_cart_item_data' ), 20, 1 );
		add_filter( 'woocommerce_get_item_data', array( $this, 'cart_item_display' ), 20, 2 );
		add_action( 'woocommerce_checkout_create_order_line_item', array( $this, 'write_order_meta' ), 20, 4 );
		add_action( 'woocommerce_admin_order_data_after_billing_address', array( $this, 'admin_order_display' ) );
	}

	/**
	 * Geçerli metinler.
	 *
	 * @return array{step_label: string, title: string, text: string, checkbox_label: string}
	 */
	private function texts() {
		$group = $this->container->get( Settings::class )->get( 'tax_relief', array() );
		return Tax_Relief_Declaration::texts( is_array( $group ) ? $group : array() );
	}

	/**
	 * Form adımlarına vergi indirimi adımını ekler.
	 *
	 * @param array<int, array{id: string, label: string}> $steps      Adımlar.
	 * @param int                                          $product_id Ürün.
	 * @return array<int, array{id: string, label: string}>
	 */
	public function add_step( $steps, $product_id = 0 ) {
		unset( $product_id );
		$steps = (array) $steps;
		foreach ( $steps as $step ) {
			if ( is_array( $step ) && isset( $step['id'] ) && Tax_Relief_Declaration::STEP_ID === $step['id'] ) {
				return $steps;
			}
		}
		$texts   = $this->texts();
		$steps[] = array(
			'id'    => Tax_Relief_Declaration::STEP_ID,
			'label' => $texts['step_label'],
		);
		return $steps;
	}

	/**
	 * Adım içeriği: beyan metni + önceden işaretli olmayan onay kutusu.
	 *
	 * @param array<string, mixed> $model Form modeli (kullanılmaz).
	 * @return void
	 */
	public function render_step( $model = array() ) {
		unset( $model );
		$this->container->get( Template_Loader::class )->render(
			'tax-relief/step.php',
			array(
				'texts' => $this->texts(),
				'field' => Tax_Relief_Declaration::FIELD,
			)
		);
	}

	/**
	 * Sepete ekleme isteğinde onay kutusu değerini bellekte tutar (yalnız bu REST yolunda).
	 *
	 * @param mixed $response Yanıt.
	 * @param mixed $handler  İşleyici.
	 * @param mixed $request  İstek.
	 * @return mixed
	 */
	public function capture_request( $response, $handler = null, $request = null ) {
		unset( $handler );
		$this->pending  = false;
		$this->snapshot = null;
		if ( is_object( $request ) && method_exists( $request, 'get_route' ) && self::CART_ROUTE === $request->get_route() ) {
			$this->pending = Tax_Relief_Declaration::is_ticked( $request->get_param( Tax_Relief_Declaration::FIELD ) );
		}
		return $response;
	}

	/**
	 * Onay işaretliyse sepet öğesine bayrak koyar (başka sepet ekleme çağrılarına bulaşmaz).
	 *
	 * @param mixed $cart_item_data Sepet öğesi verisi.
	 * @return mixed
	 */
	public function add_cart_item_data( $cart_item_data ) {
		if ( $this->pending && is_array( $cart_item_data ) ) {
			// Bağışçının beyan anında GÖRDÜĞÜ metnin özeti ve zamanı sepete yazılır (sipariş anındaki metin değil).
			$this->snapshot                                     = array(
				'hash' => Tax_Relief_Declaration::hash( $this->texts()['text'] ),
				'time' => time(),
			);
			$cart_item_data[ Tax_Relief_Declaration::CART_KEY ] = '1';
			$cart_item_data[ Tax_Relief_Declaration::CART_HASH_KEY ] = $this->snapshot['hash'];
			$cart_item_data[ Tax_Relief_Declaration::CART_TIME_KEY ] = $this->snapshot['time'];
		} elseif ( null !== $this->snapshot && is_array( $cart_item_data ) && ! empty( $cart_item_data['wdp_sadaka_donation'] ) ) {
			// Aynı istekte eklenen ek bağış satırı da aynı beyanı taşır.
			$cart_item_data[ Tax_Relief_Declaration::CART_KEY ]      = '1';
			$cart_item_data[ Tax_Relief_Declaration::CART_HASH_KEY ] = $this->snapshot['hash'];
			$cart_item_data[ Tax_Relief_Declaration::CART_TIME_KEY ] = $this->snapshot['time'];
		}
		$this->pending = false;
		return $cart_item_data;
	}

	/**
	 * Bağışçıya gösterilen geçerli beyan metni.
	 *
	 * @return string
	 */
	public function declaration_text() {
		return (string) $this->texts()['text'];
	}

	/**
	 * Sepet/ödeme satırında "beyan verildi" bilgisi (WooCommerce standart öğe verisi).
	 *
	 * @param mixed $item_data Gösterilecek satırlar.
	 * @param mixed $cart_item Sepet öğesi.
	 * @return mixed
	 */
	public function cart_item_display( $item_data, $cart_item = array() ) {
		if ( is_array( $item_data ) && is_array( $cart_item ) && ! empty( $cart_item[ Tax_Relief_Declaration::CART_KEY ] ) ) {
			$item_data[] = array(
				'key'   => __( 'Tax relief declaration', 'woo-donation-popup' ),
				'value' => __( 'Yes', 'woo-donation-popup' ),
			);
		}
		return $item_data;
	}

	/**
	 * Sipariş kalemine ve siparişe beyan meta alanlarını yazar (yalnız WooCommerce nesne API'si; HPOS uyumlu).
	 *
	 * @param object               $item          WC_Order_Item_Product.
	 * @param string               $cart_item_key Sepet öğesi anahtarı.
	 * @param array<string, mixed> $values        Sepet öğesi.
	 * @param object|null          $order         WC_Order.
	 * @return void
	 */
	public function write_order_meta( $item, $cart_item_key = '', $values = array(), $order = null ) {
		unset( $cart_item_key );
		if ( ! is_array( $values ) ) {
			return;
		}
		$meta = Tax_Relief_Declaration::order_meta( $values, $this->texts()['text'] );
		foreach ( $meta as $key => $value ) {
			if ( is_object( $item ) && method_exists( $item, 'update_meta_data' ) ) {
				$item->update_meta_data( $key, $value );
			}
			if ( is_object( $order ) && method_exists( $order, 'update_meta_data' ) ) {
				$order->update_meta_data( $key, $value );
			}
		}
	}

	/**
	 * Sipariş ekranında beyan satırı (yönetici; WooCommerce standart kancası).
	 *
	 * @param object $order WC_Order.
	 * @return void
	 */
	public function admin_order_display( $order ) {
		if ( ! is_object( $order ) || ! method_exists( $order, 'get_meta' ) || 'yes' !== (string) $order->get_meta( Tax_Relief_Declaration::META_DECLARED, true ) ) {
			return;
		}
		echo '<p><strong>' . esc_html__( 'Tax relief declaration', 'woo-donation-popup' ) . ':</strong> ' . esc_html__( 'Yes', 'woo-donation-popup' ) . '</p>';
	}
}

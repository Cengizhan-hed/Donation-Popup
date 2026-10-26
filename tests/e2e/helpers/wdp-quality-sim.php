<?php
/**
 * Yalnız yerel e2e (E8B kalite kapıları): tüm modülleri açar/kapatır, motoru seçer, hız sınırlarını gevşetir, test sayfaları ve
 * sepet/sipariş yardımcı uçları sunar. Yalnız geçici yerel WP işçisine kopyalanır; uzak ortamda KULLANILMAZ. Tema adı yok.
 *
 * Durum dosyası `wp-content/wdp-quality-state.json`: {"engine":"new|legacy","modules":"all|none|default","override":true|false}
 * (her istekte okunur; koşucu kapıdan kapıya değiştirir).
 *
 *   /?dp_q_test=kit&dp_product=ID&dp_campaign=ID   -> her deneyim + kampanya + sosyal kanıt + hesap + yan sepet (kısa kodlar)
 *   /?dp_q_test=shortcode&dp_product=ID           -> yalnız tek satır içi form (yalnız-kısa-kod sayfası)
 *   /?dp_q_add=ID&amount=75&dedication=..         -> sepete bağış ekler (JSON)
 *   /?dp_q_order=ID&amount=40                     -> tamamlanmış bağış siparişi oluşturur (JSON: received_url)
 */
$wdp_q_state_file = WP_CONTENT_DIR . '/wdp-quality-state.json';
$wdp_q_state      = is_readable( $wdp_q_state_file ) ? json_decode( (string) file_get_contents( $wdp_q_state_file ), true ) : array(); // phpcs:ignore
$wdp_q_state      = is_array( $wdp_q_state ) ? $wdp_q_state : array();
$GLOBALS['wdp_q_state'] = $wdp_q_state;

// E8J: "nodefer": true -> ön yüz paketi ertelemesi kapalı (önce/sonra ölçümü için kontrol; varsayılan: gerçek davranış).
if ( ! empty( $wdp_q_state['nodefer'] ) ) {
	add_filter( 'wdp_defer_frontend_assets', '__return_false' );
}

if ( ! array_key_exists( 'override', $wdp_q_state ) || $wdp_q_state['override'] ) {
	add_filter(
		'pre_option_donation_panel_settings',
		static function () {
			$st      = $GLOBALS['wdp_q_state'];
			$legacy  = isset( $st['engine'] ) && 'legacy' === $st['engine'];
			$only    = isset( $st['modules'] ) && is_array( $st['modules'] ) ? $st['modules'] : null; // Tek tek modül listesi (ikili arama için).
			$mods    = isset( $st['modules'] ) && is_string( $st['modules'] ) ? $st['modules'] : 'all';
			$all     = array( 'campaign', 'impact', 'social_proof', 'thanks', 'tax_relief', 'side_cart', 'donor_account' );
			$modules = array();
			if ( 'default' !== $mods || null !== $only ) {
				foreach ( $all as $slug ) {
					$modules[ $slug ] = null !== $only ? in_array( $slug, $only, true ) : ( 'all' === $mods );
				}
			}
			return array(
				'version'     => 1,
				'modules'     => $modules,
				'experiences' => array( 'engine' => $legacy ? 'legacy' : 'new' ),
				'impact'      => array( 'map' => "25={count} food parcel|{count} food parcels\n250={count} water well|{count} water wells" ),
			);
		}
	);
}

// Kontrol ölçümü (Lighthouse): `?dp_q_off=1` isteğinde eklenti etkin değilmiş gibi yüklenir (eklentisiz taban çizgisi).
if ( isset( $_GET['dp_q_off'] ) ) { // phpcs:ignore
	add_filter(
		'option_active_plugins',
		static function ( $plugins ) {
			return array_values( array_diff( (array) $plugins, array( 'woo-donation-popup/woo-donation-popup.php' ) ) );
		}
	);
}

// Teşhis (yalnız yerel ölçüm): `?dp_q_strip=css|js|side` eklentinin ilgili varlıklarını sayfadan çıkarır (hangi varlık maliyetli?).
if ( isset( $_GET['dp_q_strip'] ) ) { // phpcs:ignore
	add_action(
		'wp_enqueue_scripts',
		static function () {
			$what = sanitize_key( (string) $_GET['dp_q_strip'] ); // phpcs:ignore
			global $wp_styles, $wp_scripts;
			foreach ( array( $wp_styles, $wp_scripts ) as $reg ) {
				if ( ! $reg ) {
					continue;
				}
				foreach ( array_keys( $reg->registered ) as $h ) {
					$is_css = $reg === $wp_styles;
					$ours   = 0 === strpos( $h, 'wdp-' ) || 0 === strpos( $h, 'donation-panel' ) || 0 === strpos( $h, 'dp-' );
					if ( ! $ours ) {
						continue;
					}
					if ( ( in_array( $what, array( 'css', 'all' ), true ) && $is_css ) || ( in_array( $what, array( 'js', 'all' ), true ) && ! $is_css ) || ( 'side' === $what && false !== strpos( $h, 'side' ) ) ) {
						wp_dequeue_style( $h );
						wp_dequeue_script( $h );
					}
				}
			}
		},
		99999
	);
}

// Teşhis (E8W, yalnız yerel ölçüm): `?dp_q_html=json|form|css|all` yanıt HTML'inden eklentinin satır içi parçasını çıkarır (HTML yükü maliyeti ölçümü).
if ( isset( $_GET['dp_q_html'] ) ) { // phpcs:ignore
	add_action(
		'template_redirect',
		static function () {
			$what = sanitize_key( (string) $_GET['dp_q_html'] ); // phpcs:ignore
			ob_start(
				static function ( $html ) use ( $what ) {
					if ( in_array( $what, array( 'json', 'all' ), true ) ) {
						$html = preg_replace( '#<script[^>]*>[^<]*var wdp_ajax = .*?</script>#s', '', $html );
					}
					if ( in_array( $what, array( 'form', 'all' ), true ) ) {
						$html = preg_replace( '#<div class="wdp-product-page-entry">.*?</form>\s*</div>\s*</div>#s', '', $html );
					}
					if ( in_array( $what, array( 'css', 'all' ), true ) ) {
						$html = preg_replace( '#<style[^>]*>\s*:root, \.hdf-donation-modal-wrapper.*?</style>#s', '', $html );
					}
					return $html;
				}
			);
		},
		0
	);
}

// Yerel e2e tüm istekleri tek IP'den koşar: hız sınırları gevşetilir (sınırlayıcılar birim testlerle kanıtlı).
add_filter(
	'rest_pre_dispatch',
	static function ( $result, $server, $request ) {
		if ( 0 === strpos( (string) $request->get_route(), '/donation-panel/v1' ) ) {
			global $wpdb;
			$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '%donation\\_panel\\_rl\\_%'" ); // phpcs:ignore
		}
		return $result;
	},
	1,
	3
);
add_filter( 'donation_panel_account_rate_limit', static function () {
	return 5000;
} );
add_filter( 'pre_option_woocommerce_enable_myaccount_registration', static function () {
	return 'yes';
} );
add_filter(
	'pre_wp_mail',
	static function () {
		return true; // Gerçek e-posta yok.
	}
);

/**
 * @param int   $id     Ürün.
 * @param float $amount Tutar.
 * @param array $data   Bağış verisi.
 * @return array<string,mixed> Sepete ekleme sonucu.
 */
function wdp_q_cart_add( $id, $amount, $data = array() ) {
	if ( null === WC()->cart ) {
		wc_load_cart();
	}
	WC()->session->set_customer_session_cookie( true );
	$key = WC()->cart->add_to_cart(
		$id,
		1,
		0,
		array(),
		array(
			'donation_data'       => $data,
			'custom_price'        => $amount,
			'unique_key'          => md5( uniqid( '', true ) ),
			'donation_panel_type' => 'general',
		)
	);
	WC()->cart->set_session();
	return array( 'ok' => (bool) $key, 'count' => count( WC()->cart->get_cart() ) );
}

add_action(
	'template_redirect',
	static function () {
		// phpcs:disable WordPress.Security.NonceVerification
		if ( isset( $_GET['dp_q_add'] ) ) {
			nocache_headers();
			$data = array();
			if ( ! empty( $_GET['dedication'] ) ) {
				$data['dedication'] = sanitize_text_field( wp_unslash( (string) $_GET['dedication'] ) );
			}
			wp_send_json( wdp_q_cart_add( (int) $_GET['dp_q_add'], isset( $_GET['amount'] ) ? (float) $_GET['amount'] : 50.0, $data ) );
		}
		if ( isset( $_GET['dp_q_order'] ) ) {
			nocache_headers();
			$id     = (int) $_GET['dp_q_order'];
			$amount = isset( $_GET['amount'] ) ? (float) $_GET['amount'] : 40.0;
			$order  = wc_create_order();
			$item   = new WC_Order_Item_Product();
			$item->set_product_id( $id );
			$item->set_name( 'Test' );
			$item->set_quantity( 1 );
			$item->set_subtotal( $amount );
			$item->set_total( $amount );
			$order->add_item( $item );
			$order->set_billing_email( 'quality@wdp-e2e.test' );
			$order->set_billing_first_name( 'Çağrı' );
			$order->set_billing_last_name( 'Öztürk' );
			$order->set_payment_method( 'cheque' );
			$order->calculate_totals();
			$order->set_status( 'completed' );
			$order->save();
			wp_send_json( array( 'ok' => true, 'id' => $order->get_id(), 'received_url' => $order->get_checkout_order_received_url() ) );
		}
		if ( ! isset( $_GET['dp_q_test'] ) ) {
			return;
		}
		$kind = sanitize_key( (string) $_GET['dp_q_test'] );
		$id   = isset( $_GET['dp_product'] ) ? (int) $_GET['dp_product'] : 0;
		$cmp  = isset( $_GET['dp_campaign'] ) ? (int) $_GET['dp_campaign'] : $id;
		// phpcs:enable
		nocache_headers();
		echo '<!doctype html><html ' . get_language_attributes() . '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Quality e2e</title>';
		wp_head();
		echo '</head><body><header style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px"><b>Site</b>';
		if ( 'kit' === $kind ) {
			echo do_shortcode( '[donation_panel_account][donation_panel_side_cart]' ); // phpcs:ignore
		}
		echo '</header><main style="padding:16px"><h1>Test</h1>';
		if ( 'kit' === $kind ) {
			echo '<section id="q-triggers">';
			foreach ( array( 'popup', 'side_panel', 'bottom_sheet' ) as $k ) {
				echo '<div id="q-' . esc_attr( $k ) . '">' . do_shortcode( '[donation_panel_experience id="' . $id . '" kind="' . $k . '"]' ) . '</div>'; // phpcs:ignore
			}
			echo '</section>';
			echo '<section id="q-progress">' . do_shortcode( '[donation_panel_progress id="' . $cmp . '"]' ) . '</section>'; // phpcs:ignore
			echo '<section id="q-social">' . do_shortcode( '[donation_panel_social_proof id="' . $cmp . '" variant="counters"]' ) . '</section>'; // phpcs:ignore
		}
		echo '<section id="q-inline">' . do_shortcode( '[donation_panel_experience id="' . $id . '" kind="inline"]' ) . '</section>'; // phpcs:ignore
		echo '</main>';
		wp_footer();
		echo '</body></html>';
		exit;
	}
);

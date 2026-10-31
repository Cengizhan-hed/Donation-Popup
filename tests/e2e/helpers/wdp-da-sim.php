<?php
/**
 * Yalnız yerel e2e (E5 bağışçı hesabı): `donor_account` modülünü açar, WooCommerce kayıt ayarlarını açar, e-postaları yakalar
 * (gerçek gönderim yok), test sayfası + tohum + yardımcı uçlar sunar. Tema/sayfa oluşturucu adı yok.
 *
 *   /?dp_da_test=1                           -> kısa kodlu test sayfası
 *   /?dp_da_seed=1&email=..&pid=ID       -> kullanıcı (parola: dogru-sifre-1) + kendi bağış siparişi + misafir bağış siparişi (JSON)
 *   /?dp_da_mails=1&to=..                    -> yakalanan e-postalar (JSON)
 *   /?dp_da_add=ID&amount=40                 -> sepete bağış ekler (JSON)
 */
add_filter(
	'pre_option_donation_panel_settings',
	static function ( $value ) {
		$value                            = is_array( $value ) ? $value : array( 'version' => 1 );
		$value['modules']                 = isset( $value['modules'] ) && is_array( $value['modules'] ) ? $value['modules'] : array();
		$value['modules']['donor_account'] = true;
		return $value;
	},
	20
);
// Test koşusu aynı IP'den çok giriş yapar: hız sınırı yükseltilir (sınırın kendisi PHPUnit'te sınanır).
add_filter( 'donation_panel_account_rate_limit', static function () {
	return 5000;
} );
add_filter( 'pre_option_woocommerce_enable_myaccount_registration', static function () {
	return 'yes';
} );
add_filter( 'pre_option_woocommerce_registration_generate_password', static function () {
	return 'no';
} );
add_filter( 'pre_option_woocommerce_enable_signup_and_login_from_checkout', static function () {
	return 'yes';
} );
add_filter(
	'pre_wp_mail',
	static function ( $short, $atts ) {
		$list   = get_transient( 'dp_da_mails' );
		$list   = is_array( $list ) ? $list : array();
		$list[] = array(
			'to'      => is_array( $atts['to'] ) ? implode( ',', $atts['to'] ) : (string) $atts['to'],
			'subject' => (string) $atts['subject'],
			'body'    => (string) $atts['message'],
		);
		set_transient( 'dp_da_mails', $list, HOUR_IN_SECONDS );
		return true;
	},
	10,
	2
);

/**
 * Bağış siparişi oluşturur.
 *
 * @param int    $customer Kullanıcı (0 = misafir).
 * @param string $email    Fatura e-postası.
 * @param int    $product  Ürün.
 * @param string $note     İthaf.
 * @return int
 */
function wdp_da_make_order( $customer, $email, $product, $note ) {
	$order = wc_create_order( array( 'customer_id' => $customer ) );
	$order->add_product( wc_get_product( $product ), 1, array( 'subtotal' => 150, 'total' => 150 ) );
	foreach ( $order->get_items() as $item ) {
		$item->add_meta_data( 'wdp_dedication', $note );
		$item->add_meta_data( '_custom_price', 150 );
		$item->save();
	}
	$order->set_billing_email( $email );
	$order->set_billing_first_name( 'Ayşe' );
	$order->set_total( 150 );
	$order->set_status( 'completed' );
	$order->save();
	return (int) $order->get_id();
}

add_action(
	'template_redirect',
	static function () {
		// phpcs:disable WordPress.Security.NonceVerification
		if ( isset( $_GET['dp_da_mails'] ) ) {
			nocache_headers();
			$to   = isset( $_GET['to'] ) ? (string) wp_unslash( $_GET['to'] ) : '';
			$all  = (array) get_transient( 'dp_da_mails' );
			$list = array_values( array_filter( $all, static function ( $m ) use ( $to ) {
				return '' === $to || false !== stripos( (string) $m['to'], $to );
			} ) );
			wp_send_json( $list );
		}
		if ( isset( $_GET['dp_da_seed'] ) ) {
			nocache_headers();
			$email   = sanitize_email( wp_unslash( (string) $_GET['email'] ) );
			$product = (int) ( $_GET['pid'] ?? 0 );
			$uid     = email_exists( $email );
			if ( ! $uid ) {
				$uid = wp_create_user( $email, 'dogru-sifre-1', $email );
				( new WP_User( $uid ) )->set_role( 'customer' );
			}
			$own   = wdp_da_make_order( (int) $uid, $email, $product, 'Anneannem Şükriye İğdır için' );
			$guest = wdp_da_make_order( 0, $email, $product, 'Misafir bağışı Çağlar için' );
			wp_send_json(
				array(
					'user'     => (int) $uid,
					'own'      => $own,
					'guest'    => $guest,
					'donations' => wc_get_endpoint_url( 'my-donations', '', wc_get_page_permalink( 'myaccount' ) ),
					'checkout' => wc_get_checkout_url(),
				)
			);
		}
		if ( isset( $_GET['dp_da_add'] ) ) {
			nocache_headers();
			if ( null === WC()->cart ) {
				wc_load_cart();
			}
			WC()->session->set_customer_session_cookie( true );
			$key = WC()->cart->add_to_cart(
				(int) $_GET['dp_da_add'],
				1,
				0,
				array(),
				array(
					'donation_data' => array(),
					'custom_price'  => (float) ( $_GET['amount'] ?? 40 ),
					'unique_key'    => md5( uniqid( '', true ) ),
				)
			);
			WC()->cart->set_session();
			wp_send_json( array( 'ok' => (bool) $key, 'checkout' => wc_get_checkout_url() ) );
		}
		if ( ! isset( $_GET['dp_da_test'] ) ) {
			return;
		}
		// phpcs:enable
		nocache_headers();
		echo '<!doctype html><html ' . get_language_attributes() . '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Account e2e</title>';
		wp_head();
		echo '</head><body><header style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px"><b>Site</b>';
		echo do_shortcode( '[donation_panel_account]' ); // phpcs:ignore
		echo '</header><main style="padding:16px"><h1>Test</h1><p>Sayfa metni.</p><a href="#" id="after-link">Bağlantı</a></main>';
		wp_footer();
		echo '</body></html>';
		exit;
	}
);

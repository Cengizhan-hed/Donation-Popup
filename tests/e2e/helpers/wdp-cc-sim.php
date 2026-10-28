<?php
/**
 * Yalnız yerel e2e (önbellek sözleşmesi): `side_cart` + `donor_account` modüllerini açar; giriş ucu ve karma test sayfası sunar.
 * `wdp-exp-sim.php` + `wdp-sc-sim.php` ile birlikte yüklenir (sepete ekleme ucu: `/?dp_sc_add=ID&amount=60`).
 *
 *   /?dp_cc_login=1&u=ad -> benzersiz müşteri oluşturur ve oturum çerezini verir (JSON)
 *   /?dp_cc_test=1       -> üstbilgide yan sepet + hesap simgesi, içerikte bağış listesi olan sayfa
 * Tema/sayfa oluşturucu adı yok.
 */
add_filter(
	'pre_option_donation_panel_settings',
	static function ( $value ) {
		$value                            = is_array( $value ) ? $value : array( 'version' => 1 );
		$value['modules']                 = isset( $value['modules'] ) && is_array( $value['modules'] ) ? $value['modules'] : array();
		$value['modules']['side_cart']    = true;
		$value['modules']['donor_account'] = true;
		return $value;
	},
	30
);
// Yönetici çubuğu çekirdeğe aittir; karşılaştırmayı eklenti çıktısına odaklamak için kapalı.
add_filter( 'show_admin_bar', '__return_false' );

add_action(
	'template_redirect',
	static function () {
		// phpcs:disable WordPress.Security.NonceVerification
		if ( isset( $_GET['dp_cc_login'] ) ) {
			nocache_headers();
			$name = 'cc' . substr( md5( uniqid( '', true ) ), 0, 10 );
			$id   = wp_insert_user(
				array(
					'user_login' => $name,
					'user_pass'  => 'dogru-sifre-1',
					'user_email' => $name . '@example.test',
					'role'       => 'customer',
				)
			);
			if ( is_wp_error( $id ) ) {
				wp_send_json( array( 'ok' => false ), 500 );
			}
			wp_set_current_user( (int) $id );
			wp_set_auth_cookie( (int) $id, false );
			wp_send_json( array( 'ok' => true ) );
		}
		if ( ! isset( $_GET['dp_cc_test'] ) ) {
			return;
		}
		nocache_headers();
		echo '<!doctype html><html ' . get_language_attributes() . '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cache e2e</title>';
		wp_head();
		echo '</head><body><header>';
		echo do_shortcode( '[donation_panel_side_cart]' ) . do_shortcode( '[donation_panel_account]' ); // phpcs:ignore
		echo '</header><main><h1>Test</h1>';
		echo do_shortcode( '[wdp_donations]' ); // phpcs:ignore
		echo '</main>';
		wp_footer();
		echo '</body></html>';
		exit;
	}
);

<?php
/**
 * Yalnız yerel e2e (E4 yan sepet): `side_cart` modülünü açar, tetikleyici + içerik sayfası ve test amaçlı ekleme ucu sunar.
 * `wdp-exp-sim.php` ile birlikte yüklenir (motor: `?dp_engine=legacy`). Tema/sayfa oluşturucu adı yok.
 *
 *   /?dp_sc_test=1                 -> kısa kodlu test sayfası
 *   /?dp_sc_add=ID&amount=75&dedication=..&shares=Ad1,Ad2 -> sepete bağış ekler (eski sepet öğesi sözleşmesi), JSON döner
 */
add_filter(
	'pre_option_donation_panel_settings',
	static function ( $value ) {
		$value                         = is_array( $value ) ? $value : array( 'version' => 1 );
		$value['modules']              = isset( $value['modules'] ) && is_array( $value['modules'] ) ? $value['modules'] : array();
		$value['modules']['side_cart'] = true;
		return $value;
	},
	20
);

add_action(
	'template_redirect',
	static function () {
		if ( isset( $_GET['dp_sc_add'] ) ) { // phpcs:ignore
			nocache_headers();
			$id     = (int) $_GET['dp_sc_add']; // phpcs:ignore
			$amount = isset( $_GET['amount'] ) ? (float) $_GET['amount'] : 50.0; // phpcs:ignore
			$data   = array();
			if ( ! empty( $_GET['name'] ) ) { // phpcs:ignore
				$data['full_name'] = sanitize_text_field( wp_unslash( (string) $_GET['name'] ) ); // phpcs:ignore
				$data['phone']     = '+447700900123';
			}
			if ( ! empty( $_GET['dedication'] ) ) { // phpcs:ignore
				$data['dedication'] = sanitize_text_field( wp_unslash( (string) $_GET['dedication'] ) ); // phpcs:ignore
			}
			if ( ! empty( $_GET['shares'] ) ) { // phpcs:ignore
				$names = array_filter( array_map( 'trim', explode( ',', sanitize_text_field( wp_unslash( (string) $_GET['shares'] ) ) ) ) ); // phpcs:ignore
				$data['share_count']  = count( $names );
				$data['shareholders'] = array();
				foreach ( array_values( $names ) as $i => $name ) {
					$data['shareholders'][ $i + 1 ] = array( 'name' => $name );
				}
			}
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
			wp_send_json(
				array(
					'ok'    => (bool) $key,
					'count' => count( WC()->cart->get_cart() ),
				)
			);
		}
		if ( ! isset( $_GET['dp_sc_test'] ) ) { // phpcs:ignore
			return;
		}
		nocache_headers();
		echo '<!doctype html><html ' . get_language_attributes() . '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Side cart e2e</title>';
		wp_head();
		echo '</head><body><header style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px"><b>Site</b>';
		echo do_shortcode( '[donation_panel_side_cart]' ); // phpcs:ignore
		echo '</header><main style="padding:16px"><h1>Test</h1><p>Sayfa metni.</p><a href="#" id="after-link">Bağlantı</a></main>';
		wp_footer();
		echo '</body></html>';
		exit;
	}
);

/**
 * Ek bağış önerisi (yalnız e2e): sepette olmayan ilk yayımlanmış ürün, 50 / 100 tutarlarıyla.
 */
add_filter(
	'donation_panel_side_cart_suggestion',
	static function () {
		$in_cart = array();
		if ( function_exists( 'WC' ) && WC() && WC()->cart ) {
			foreach ( WC()->cart->get_cart() as $item ) {
				$in_cart[] = (int) $item['product_id'];
			}
		}
		$ids = get_posts(
			array(
				'post_type'      => 'product',
				'post_status'    => 'publish',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'post__not_in'   => $in_cart ? $in_cart : array( 0 ),
			)
		);
		return $ids ? array(
			'product_id' => (int) $ids[0],
			'amounts'    => array( 50, 100 ),
			'hint'       => 'Küçük bir katkı, büyük bir dua',
		) : array();
	}
);

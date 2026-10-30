<?php
/**
 * Yalnız yerel e2e (12.3 canlı ilerleme çubuğu): kampanya + yan sepet modüllerini açar, aynı üründe birden çok çubuk
 * (kampanya kartı + sayfa içi form + compact kart + katman düğmesi) gösteren test sayfası ve yerel sipariş ucu sunar.
 * Uzak ortamda KULLANILMAZ. Tema/sayfa oluşturucu adı yok.
 *
 *   /?dp_lp=1&dp_product=ID&dp_raised=400[&dp_off=preview,count,celebrate][&dp_parts=card,inline,compact,popup,loop,list]
 *        [&dp_loop=ID1,ID2]  (loop: WooCommerce ürün döngüsü kartları; list: kartta çubuksuz bağış listesi)
 *   /?dp_lp_order=ID&amount=50   -> yerel, tamamlanmış sipariş (kampanya toplamına sayılır), JSON döner
 */
add_filter(
	'pre_option_donation_panel_settings',
	static function () {
		$off = isset( $_GET['dp_off'] ) ? array_map( 'sanitize_key', explode( ',', (string) $_GET['dp_off'] ) ) : array(); // phpcs:ignore
		return array(
			'version'     => 1,
			'modules'     => array(
				'campaign'  => true,
				'side_cart' => true,
				'impact'    => true,
			),
			'experiences' => array( 'engine' => 'new' ),
			'impact'      => array( 'map' => "25={count} food parcel|{count} food parcels\n250={count} water well|{count} water wells" ),
			'progress'    => array(
				'preview'   => ! in_array( 'preview', $off, true ),
				'count'     => ! in_array( 'count', $off, true ),
				'celebrate' => ! in_array( 'celebrate', $off, true ),
			),
		);
	},
	30
);

add_action(
	'init',
	static function () {
		$id = isset( $_GET['dp_product'] ) ? (int) $_GET['dp_product'] : 0; // phpcs:ignore
		if ( $id < 1 || ! isset( $_GET['dp_lp'] ) ) { // phpcs:ignore
			return;
		}
		update_post_meta( $id, '_enable_progress_bar', 'yes' );
		update_post_meta( $id, '_progress_bar_limit', '1000' );
		if ( isset( $_GET['dp_raised'] ) ) { // phpcs:ignore
			$raised = max( 0, (float) $_GET['dp_raised'] ); // phpcs:ignore
			update_post_meta( $id, '_wdp_total_donation_amount', (string) $raised );
			update_post_meta( $id, '_wdp_donor_count', $raised > 0 ? '12' : '0' );
		}
	},
	50
);

add_action(
	'template_redirect',
	static function () {
		if ( isset( $_GET['dp_lp_order'] ) && function_exists( 'wc_create_order' ) ) { // phpcs:ignore
			nocache_headers();
			$id     = (int) $_GET['dp_lp_order']; // phpcs:ignore
			$amount = isset( $_GET['amount'] ) ? (float) $_GET['amount'] : 50.0; // phpcs:ignore
			$order  = wc_create_order();
			$item   = new WC_Order_Item_Product();
			$item->set_product_id( $id );
			$item->set_name( 'Live progress e2e' );
			$item->set_quantity( 1 );
			$item->set_subtotal( $amount );
			$item->set_total( $amount );
			$order->add_item( $item );
			$order->set_billing_email( 'live-progress@example.test' );
			$order->calculate_totals( false );
			$order->set_status( 'completed' );
			$order->save();
			wp_send_json(
				array(
					'ok'    => true,
					'total' => (float) get_post_meta( $id, '_wdp_total_donation_amount', true ),
				)
			);
		}
		if ( isset( $_GET['dp_lp_add'] ) ) { // phpcs:ignore
			nocache_headers();
			$id     = (int) $_GET['dp_lp_add']; // phpcs:ignore
			$amount = isset( $_GET['amount'] ) ? (float) $_GET['amount'] : 50.0; // phpcs:ignore
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
					'donation_data'       => array(),
					'custom_price'        => $amount,
					'unique_key'          => md5( uniqid( '', true ) ),
					'donation_panel_type' => 'general',
				)
			);
			WC()->cart->set_session();
			WC()->cart->maybe_set_cart_cookies();
			wp_send_json( array( 'ok' => (bool) $key ) );
		}
		if ( ! isset( $_GET['dp_lp'] ) ) { // phpcs:ignore
			return;
		}
		$id    = isset( $_GET['dp_product'] ) ? (int) $_GET['dp_product'] : 0; // phpcs:ignore
		$parts = isset( $_GET['dp_parts'] ) ? array_map( 'sanitize_key', explode( ',', (string) $_GET['dp_parts'] ) ) : array( 'card', 'inline' ); // phpcs:ignore
		nocache_headers();
		echo '<!doctype html><html ' . get_language_attributes() . '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Live progress e2e</title>';
		wp_head();
		echo '</head><body><main style="padding:16px;max-width:640px;margin:0 auto"><h1>Test</h1>';
		foreach ( $parts as $part ) {
			echo '<section id="lp-' . esc_attr( $part ) . '" style="margin-block:16px">';
			if ( 'card' === $part ) {
				echo do_shortcode( '[donation_panel_progress id="' . $id . '"]' ); // phpcs:ignore
			} elseif ( 'compact' === $part ) {
				echo do_shortcode( '[wdp_donation_form id="' . $id . '" layout="compact"]' ); // phpcs:ignore
			} elseif ( 'popup' === $part ) {
				echo do_shortcode( '[donation_panel_experience id="' . $id . '" kind="popup"]' ); // phpcs:ignore
			} elseif ( 'loop' === $part ) {
				// WooCommerce'in standart ürün döngüsü (mağaza/kategori kartı ile aynı süzgeçler): kart düğmesi formu REST ile açar.
				$loop = isset( $_GET['dp_loop'] ) ? preg_replace( '/[^0-9,]/', '', (string) $_GET['dp_loop'] ) : (string) $id; // phpcs:ignore
				echo do_shortcode( '[products ids="' . $loop . '" columns="2" orderby="post__in"]' ); // phpcs:ignore
			} elseif ( 'list' === $part ) {
				// Bağış listesi, kartta çubuk YOK: sayfada çubuk paketi kuyruğa girmez; katmandaki çubuk REST yanıtıyla gelir.
				echo do_shortcode( '[wdp_donations show_progress="no" tabs="no"]' ); // phpcs:ignore
			} elseif ( 'spacer' === $part ) {
				echo '<div style="block-size:1600px">Spacer</div>';
			} else {
				echo do_shortcode( '[donation_panel_experience id="' . $id . '" kind="inline"]' ); // phpcs:ignore
			}
			echo '</section>';
		}
		echo '</main>';
		wp_footer();
		echo '</body></html>';
		exit;
	}
);

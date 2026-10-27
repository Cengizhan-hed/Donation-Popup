<?php
/**
 * Yalnız yerel e2e (12-e kampanya toplamları): kampanya durumu tohumlar ve okur. Yalnız yerel WP işçisine kopyalanır;
 * uzak siteye/üretime ASLA gitmez. Tema/oluşturucu adı yok. Giriş için wdp-admin-sim.php de kopyalanır.
 *
 *   /?dp_cs_seed=1&product=ID -> kampanya + 3 ödenmiş sipariş (biri başlangıçtan önce, biri sayılmamış) tohumlar
 *   /?dp_cs_state=1&product=ID -> saklanan/devreden/başlangıç/günlük uzunluğu + sipariş bayrak sayısı (JSON)
 */
add_action(
	'init',
	static function () {
		// phpcs:disable WordPress.Security.NonceVerification
		if ( isset( $_GET['dp_cs_seed'] ) ) {
			nocache_headers();
			$pid     = isset( $_GET['product'] ) ? absint( $_GET['product'] ) : 0;
			$product = $pid ? wc_get_product( $pid ) : null;
			if ( ! $product ) {
				wp_send_json( array( 'ok' => false ), 400 );
			}
			// Önceki tohum siparişlerini (yalnız bu betiğin oluşturduğu, seçenekte kayıtlı) sil: tohum tekrarlanabilir olsun.
			foreach ( (array) get_option( 'dp_cs_orders', array() ) as $old_id ) {
				$old = wc_get_order( absint( $old_id ) );
				if ( $old ) {
					$old->delete( true );
				}
			}
			$now   = time();
			$start = $now - 7 * DAY_IN_SECONDS;
			update_post_meta( $pid, '_progress_bar_limit', 5000 );
			delete_post_meta( $pid, '_wdp_totals_log' );
			delete_post_meta( $pid, '_wdp_manual_total' );
			update_post_meta( $pid, '_wdp_carried_amount', 1000 );
			update_post_meta( $pid, '_wdp_campaign_start', $start );
			update_post_meta( $pid, '_wdp_total_donation_amount', 1000 );
			$make = static function ( $amount, $paid ) use ( $product ) {
				$order = wc_create_order();
				$item  = $order->add_product( $product, 1, array( 'subtotal' => $amount, 'total' => $amount ) );
				$order->set_date_created( $paid );
				$order->set_date_paid( $paid );
				$order->calculate_totals( false );
				$order->set_status( 'completed' );
				$order->save();
				if ( $item ) {
					wc_add_order_item_meta( $item, '_custom_price', $amount );
				}
				return $order->get_id();
			};
			$ids = array( $make( 600, $now - 10 * DAY_IN_SECONDS ), $make( 120, $now - DAY_IN_SECONDS ), $make( 80, $now - 2 * HOUR_IN_SECONDS ) );
			update_option( 'dp_cs_orders', $ids, false );
			// Kurgu: üçüncü (sayılmamış) sipariş kaçmış; saklanan toplam yalnız ikinciyi içerir.
			update_post_meta( $pid, '_wdp_total_donation_amount', 1120 );
			wp_send_json( array( 'ok' => true, 'orders' => $ids, 'start' => $start ) );
		}
		if ( isset( $_GET['dp_cs_state'] ) ) {
			nocache_headers();
			$pid = isset( $_GET['product'] ) ? absint( $_GET['product'] ) : 0;
			$log = get_post_meta( $pid, '_wdp_totals_log', true );
			wp_send_json(
				array(
					'stored'  => (float) get_post_meta( $pid, '_wdp_total_donation_amount', true ),
					'carried' => (float) get_post_meta( $pid, '_wdp_carried_amount', true ),
					'start'   => (int) get_post_meta( $pid, '_wdp_campaign_start', true ),
					'log'     => is_array( $log ) ? $log : array(),
				)
			);
		}
		// phpcs:enable
	},
	20
);

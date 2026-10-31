<?php
/**
 * Yalnız yerel e2e (12.4 Stripe): bu geçici yerel WP'ye mu-plugin olarak kopyalanır; eklentiye/zip'e GİRMEZ.
 * Eklentimiz Stripe'a özel kod içermez — bu dosya yalnız gözlem (kanca günlüğü) ve test sayfası sunar.
 *
 *   /?dp_stripe=form&dp_product=ID             kampanya kartı (canlı ilerleme) + satır içi bağış formu
 *   /?dp_stripe_state=1&dp_product=ID&dp_since=UNIX   ürün toplamı + bu andan sonra açılan siparişler + kanca günlüğü (JSON)
 *   Çerez dp_direct=1                          doğrudan (sepetsiz) bağış açık
 */

/** Kanca günlüğü (JSONL; yalnız bu geçici WP'nin uploads klasörü). */
function wdp_stripe_e2e_log( array $row ) {
	$dir = wp_upload_dir( null, false );
	$row['t']   = microtime( true );
	$row['via'] = isset( $_GET['wc-api'] ) ? 'webhook' : ( wp_doing_ajax() ? 'ajax' : ( defined( 'REST_REQUEST' ) && REST_REQUEST ? 'rest' : 'page' ) ); // phpcs:ignore
	file_put_contents( trailingslashit( $dir['basedir'] ) . 'wdp-stripe-e2e.jsonl', wp_json_encode( $row ) . "\n", FILE_APPEND | LOCK_EX ); // phpcs:ignore
}

add_filter(
	'pre_option_donation_panel_settings',
	static function () {
		return array(
			'version'     => 1,
			'modules'     => array(
				'thanks'     => true,
				'campaign'   => true,
				'impact'     => true,
				'tax_relief' => false,
			),
			'experiences' => array( 'engine' => 'new' ),
		);
	},
	30
);

if ( isset( $_COOKIE['dp_direct'] ) ) { // phpcs:ignore
	add_filter( 'donation_panel_direct_enabled', '__return_true' );
}

add_action(
	'woocommerce_payment_complete',
	static function ( $order_id ) {
		wdp_stripe_e2e_log( array( 'e' => 'payment_complete', 'o' => (int) $order_id ) );
	}
);
add_action(
	'woocommerce_order_status_changed',
	static function ( $order_id, $from, $to ) {
		wdp_stripe_e2e_log( array( 'e' => 'status', 'o' => (int) $order_id, 'from' => (string) $from, 'to' => (string) $to ) );
	},
	10,
	3
);
add_action(
	'woocommerce_before_thankyou',
	static function ( $order_id ) {
		wdp_stripe_e2e_log( array( 'e' => 'thankyou', 'o' => (int) $order_id ) );
	},
	6
);
add_action(
	'donation_panel_totals_changed',
	static function () {
		wdp_stripe_e2e_log( array( 'e' => 'totals_changed' ) );
	}
);
add_action(
	'woocommerce_api_wc_stripe',
	static function () {
		wdp_stripe_e2e_log( array( 'e' => 'webhook_in' ) );
	},
	1
);

add_action(
	'template_redirect',
	static function () {
		if ( isset( $_GET['dp_stripe_state'] ) ) { // phpcs:ignore
			nocache_headers();
			$product = isset( $_GET['dp_product'] ) ? (int) $_GET['dp_product'] : 0; // phpcs:ignore
			$since   = isset( $_GET['dp_since'] ) ? (int) $_GET['dp_since'] : 0; // phpcs:ignore
			wp_cache_delete( $product, 'post_meta' );
			$orders = array();
			$ids    = array();
			foreach ( wc_get_orders( array( 'limit' => 50, 'orderby' => 'ID', 'order' => 'DESC', 'type' => 'shop_order', 'status' => array_keys( wc_get_order_statuses() ) ) ) as $order ) {
				$created = $order->get_date_created();
				if ( ! $created || $created->getTimestamp() < $since ) {
					continue;
				}
				$items = array();
				foreach ( $order->get_items() as $item ) {
					$items[] = array(
						'product' => (int) $item->get_product_id(),
						'total'   => (float) $item->get_total(),
						'name'    => (string) $item->get_meta( 'wdp_donor_name', true ),
						'phone'   => (string) $item->get_meta( 'wdp_donor_phone', true ),
						'note'    => (string) $item->get_meta( 'wdp_donation_note', true ),
					);
				}
				$ids[]    = $order->get_id();
				$orders[] = array(
					'id'          => $order->get_id(),
					'status'      => $order->get_status(),
					'method'      => $order->get_payment_method(),
					'via'         => $order->get_created_via(),
					'paid'        => null !== $order->get_date_paid(),
					'txn'         => '' !== (string) $order->get_transaction_id(),
					'total'       => (float) $order->get_total(),
					'counted'     => (string) $order->get_meta( '_wdp_progress_counted', true ),
					'first'       => $order->get_billing_first_name(),
					'last'        => $order->get_billing_last_name(),
					'phone'       => $order->get_billing_phone(),
					'email_set'   => '' !== $order->get_billing_email(),
					'items'       => $items,
					// Geçidin sipariş notları (hata nedeni; yalnız yerel test siparişi). Ödeme kimlikleri maskelenir.
					'notes'       => array_map(
						static function ( $note ) {
							return preg_replace( '/\b(pi|pm|ch|seti|src|cus)_[A-Za-z0-9_]+/', '$1_***', wp_strip_all_tags( (string) $note->content ) );
						},
						array_slice( wc_get_order_notes( array( 'order_id' => $order->get_id(), 'limit' => 4 ) ), 0, 4 )
					),
				);
			}
			$log  = array();
			$dir  = wp_upload_dir( null, false );
			$file = trailingslashit( $dir['basedir'] ) . 'wdp-stripe-e2e.jsonl';
			if ( is_readable( $file ) ) {
				foreach ( file( $file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES ) as $line ) {
					$row = json_decode( $line, true );
					if ( is_array( $row ) && ( (float) $row['t'] >= $since ) && ( ! isset( $row['o'] ) || in_array( (int) $row['o'], $ids, true ) ) ) {
						$log[] = $row;
					}
				}
			}
			wp_send_json(
				array(
					'raised' => (float) get_post_meta( $product, '_wdp_total_donation_amount', true ),
					'donors' => (int) get_post_meta( $product, '_wdp_donor_count', true ),
					'orders' => $orders,
					'log'    => $log,
					'now'    => time(),
				)
			);
		}
		if ( ! isset( $_GET['dp_stripe'] ) ) { // phpcs:ignore
			return;
		}
		$id = isset( $_GET['dp_product'] ) ? (int) $_GET['dp_product'] : 0; // phpcs:ignore
		nocache_headers();
		echo '<!doctype html><html ' . get_language_attributes() . '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Stripe e2e</title>'; // phpcs:ignore
		wp_head();
		echo '</head><body><main style="padding:16px;max-width:640px;margin:0 auto"><h1>Test</h1>';
		echo '<section id="sp-card">' . do_shortcode( '[donation_panel_progress id="' . $id . '"]' ) . '</section>'; // phpcs:ignore
		echo '<section id="sp-form">' . do_shortcode( '[donation_panel_experience id="' . $id . '" kind="inline"]' ) . '</section>'; // phpcs:ignore
		echo '</main>';
		wp_footer();
		echo '</body></html>';
		exit;
	}
);

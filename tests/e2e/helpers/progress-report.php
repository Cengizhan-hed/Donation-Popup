<?php
/**
 * Salt okunur kampanya/ilerleme raporu (yalniz sayilar; kisi/e-posta/siparis kimligi yok).
 *
 *   wp eval-file tests/e2e/helpers/progress-report.php
 *
 * Cikti: tek satir JSON (stdout). Snippet kapali/acik iki kosuda karsilastirilir.
 */
if ( ! function_exists( 'get_option' ) ) {
	fwrite( STDERR, "wordpress missing\n" );
	exit( 1 );
}

$report = array(
	'report'          => 'wdp-progress-report',
	'wc_active'       => function_exists( 'wc_get_orders' ),
	'plugin_active'   => class_exists( 'WDP_Progress_Currency' ),
	'convert_filters' => array(
		'wdp_convert_amount'        => (bool) has_filter( 'wdp_convert_amount' ),
		'wdp_order_exchange_rate'   => (bool) has_filter( 'wdp_order_exchange_rate' ),
		'wdp_progress_live_rate'    => (bool) has_filter( 'wdp_progress_live_rate' ),
	),
);

if ( ! $report['wc_active'] || ! $report['plugin_active'] ) {
	echo wp_json_encode( $report ) . "\n";
	return;
}

$report['base_currency'] = WDP_Progress_Currency::get_base_currency();

// Kampanya/ilerleme urunleri: toplam meta anahtari dolu olanlar.
$product_ids = get_posts(
	array(
		'post_type'      => 'product',
		'post_status'    => 'any',
		'fields'         => 'ids',
		'posts_per_page' => -1,
		'meta_query'     => array(
			array(
				'key'     => '_wdp_total_donation_amount',
				'compare' => 'EXISTS',
			),
		),
	)
);
$campaign = array_flip( array_map( 'absint', $product_ids ) );

$report['campaign_products'] = count( $campaign );
$stored_total                = 0.0;
$unconverted_marks           = 0;
foreach ( array_keys( $campaign ) as $pid ) {
	$stored_total += (float) get_post_meta( $pid, '_wdp_total_donation_amount', true );
	$un            = get_post_meta( $pid, '_wdp_progress_unconverted_orders', true );
	$unconverted_marks += is_array( $un ) ? count( $un ) : 0;
}
$report['stored_total_sum']       = round( $stored_total, 2 );
$report['stored_unconverted_ids'] = $unconverted_marks;

$by_currency = array();
$page        = 1;
$orders_seen = 0;
do {
	$orders = wc_get_orders(
		array(
			'limit'    => 100,
			'paged'    => $page,
			'status'   => array( 'wc-processing', 'wc-completed', 'wc-on-hold' ),
			'type'     => 'shop_order',
			'orderby'  => 'ID',
			'order'    => 'ASC',
			'paginate' => false,
		)
	);
	foreach ( $orders as $order ) {
		++$orders_seen;
		$currency     = WDP_Progress_Currency::get_order_currency( $order );
		$order_counts = false;
		foreach ( $order->get_items() as $item ) {
			$pid = absint( $item->get_product_id() );
			if ( ! isset( $campaign[ $pid ] ) ) {
				continue;
			}
			if ( ! isset( $by_currency[ $currency ] ) ) {
				$by_currency[ $currency ] = array(
					'orders'         => 0,
					'lines'          => 0,
					'line_total_sum' => 0.0,
					'ok'             => 0,
					'missing_rate'   => 0,
					'converted_sum'  => 0.0,
				);
			}
			$line = max( 0.0, (float) $item->get_total() );
			++$by_currency[ $currency ]['lines'];
			$by_currency[ $currency ]['line_total_sum'] += $line;
			if ( ! $order_counts ) {
				++$by_currency[ $currency ]['orders'];
				$order_counts = true;
			}
			$conv = WDP_Progress_Currency::convert_to_base( $line, $currency, $order );
			if ( ! empty( $conv['ok'] ) ) {
				++$by_currency[ $currency ]['ok'];
				$by_currency[ $currency ]['converted_sum'] += (float) $conv['amount'];
			} else {
				++$by_currency[ $currency ]['missing_rate'];
			}
		}
	}
	++$page;
} while ( count( $orders ) === 100 );

ksort( $by_currency );
$total_converted = 0.0;
$total_missing   = 0;
foreach ( $by_currency as $cur => $row ) {
	$by_currency[ $cur ]['line_total_sum'] = round( $row['line_total_sum'], 2 );
	$by_currency[ $cur ]['converted_sum']  = round( $row['converted_sum'], 2 );
	$total_converted                      += $row['converted_sum'];
	$total_missing                        += $row['missing_rate'];
}
$report['orders_scanned']       = $orders_seen;
$report['by_order_currency']    = $by_currency;
$report['converted_total_base'] = round( $total_converted, 2 );
$report['missing_rate_total']   = $total_missing;

echo wp_json_encode( $report ) . "\n";

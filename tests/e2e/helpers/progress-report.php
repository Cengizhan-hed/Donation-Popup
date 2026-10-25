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

// Curcy canli kur listesi (yalniz kod -> oran; kisisel veri yok).
$live_list = array(
	'curcy_class'      => class_exists( 'WOOMULTI_CURRENCY_Data' ),
	'woocommerce_currency_option' => (string) get_option( 'woocommerce_currency' ),
	'curcy_default'    => '',
	'rates'            => array(),
);
if ( $live_list['curcy_class'] && method_exists( 'WOOMULTI_CURRENCY_Data', 'get_ins' ) ) {
	$cs = WOOMULTI_CURRENCY_Data::get_ins();
	if ( is_object( $cs ) && method_exists( $cs, 'get_default_currency' ) ) {
		$live_list['curcy_default'] = (string) $cs->get_default_currency();
	}
	if ( is_object( $cs ) && method_exists( $cs, 'get_list_currencies' ) ) {
		$list = $cs->get_list_currencies();
		if ( is_array( $list ) ) {
			foreach ( $list as $code => $row ) {
				$live_list['rates'][ (string) $code ] = is_array( $row ) && isset( $row['rate'] ) ? (string) $row['rate'] : null;
			}
		}
	}
}
$report['curcy_live_list'] = $live_list;

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
		$order_counts       = false;
		$order_counted_meta = false;
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
					'rate_source'    => array(
						'order_stored' => 0,
						'live'         => 0,
						'convert_filter' => 0,
						'none'         => 0,
					),
					'rate_min'       => null,
					'rate_max'       => null,
					'order_meta'     => array(
						'wmc_order_info_present'   => 0,
						'wmc_info_has_currency'    => 0,
						'wmc_info_currency_rate_1' => 0,
						'wmc_info_main_flag_1'     => 0,
					),
				);
			}
			$line = max( 0.0, (float) $item->get_total() );
			++$by_currency[ $currency ]['lines'];
			$by_currency[ $currency ]['line_total_sum'] += $line;
			if ( ! $order_counts ) {
				++$by_currency[ $currency ]['orders'];
				$order_counts = true;
			}
			if ( ! $order_counted_meta ) {
				$order_counted_meta = true;
				$info               = $order->get_meta( 'wmc_order_info', true );
				if ( is_array( $info ) ) {
					++$by_currency[ $currency ]['order_meta']['wmc_order_info_present'];
					if ( isset( $info[ $currency ] ) && is_array( $info[ $currency ] ) ) {
						++$by_currency[ $currency ]['order_meta']['wmc_info_has_currency'];
						if ( isset( $info[ $currency ]['rate'] ) && abs( (float) $info[ $currency ]['rate'] - 1.0 ) < 0.0000001 ) {
							++$by_currency[ $currency ]['order_meta']['wmc_info_currency_rate_1'];
						}
						if ( ! empty( $info[ $currency ]['is_main'] ) ) {
							++$by_currency[ $currency ]['order_meta']['wmc_info_main_flag_1'];
						}
					}
				}
				// Kur kaynagi (siparis basina bir kez).
				$base_cur = $report['base_currency'];
				$stored   = apply_filters( 'wdp_order_exchange_rate', null, $order, $currency, $base_cur );
				$live     = apply_filters( 'wdp_progress_live_rate', null, $currency, $base_cur );
				$rate     = null;
				if ( is_numeric( $stored ) && (float) $stored > 0 ) {
					$rate = (float) $stored;
					++$by_currency[ $currency ]['rate_source']['order_stored'];
				} elseif ( is_numeric( $live ) && (float) $live > 0 ) {
					$rate = (float) $live;
					++$by_currency[ $currency ]['rate_source']['live'];
				} elseif ( abs( (float) apply_filters( 'wdp_convert_amount', 1.0, $currency, $base_cur, array( 'order' => $order ) ) - 1.0 ) > 0.0000001 ) {
					++$by_currency[ $currency ]['rate_source']['convert_filter'];
				} else {
					++$by_currency[ $currency ]['rate_source']['none'];
				}
				if ( null !== $rate ) {
					$cur_min = $by_currency[ $currency ]['rate_min'];
					$cur_max = $by_currency[ $currency ]['rate_max'];
					$by_currency[ $currency ]['rate_min'] = ( null === $cur_min || $rate < $cur_min ) ? $rate : $cur_min;
					$by_currency[ $currency ]['rate_max'] = ( null === $cur_max || $rate > $cur_max ) ? $rate : $cur_max;
				}
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

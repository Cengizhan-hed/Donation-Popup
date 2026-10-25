<?php
/**
 * Salt okunur BEKLENEN toplam: kampanya urunu siparislerini TRY'ye (WC ana para birimi) cevirir.
 * Kur: siparis meta wmc_order_info[para][rate] varsa o, yoksa guncel Curcy kuru.
 * Curcy orani = "1 ana birim kac birim bu para birimi" => ana = tutar / oran.
 * Yalniz sayilar; kisi/e-posta/siparis kimligi yok. Eklentinin gosterdigi toplam: stored_total_sum.
 */
if ( ! function_exists( 'get_option' ) || ! function_exists( 'wc_get_orders' ) ) {
	fwrite( STDERR, "wordpress/woocommerce missing\n" );
	exit( 1 );
}

$base = (string) get_option( 'woocommerce_currency' );
$live = array();
if ( class_exists( 'WOOMULTI_CURRENCY_Data' ) && method_exists( 'WOOMULTI_CURRENCY_Data', 'get_ins' ) ) {
	$cs = WOOMULTI_CURRENCY_Data::get_ins();
	if ( is_object( $cs ) && method_exists( $cs, 'get_list_currencies' ) ) {
		foreach ( (array) $cs->get_list_currencies() as $code => $row ) {
			if ( is_array( $row ) && isset( $row['rate'] ) && (float) $row['rate'] > 0 ) {
				$live[ (string) $code ] = (float) $row['rate'];
			}
		}
	}
}

$ids      = get_posts(
	array(
		'post_type'      => 'product',
		'post_status'    => 'any',
		'fields'         => 'ids',
		'posts_per_page' => -1,
		'meta_query'     => array( array( 'key' => '_wdp_total_donation_amount', 'compare' => 'EXISTS' ) ),
	)
);
$campaign = array_flip( array_map( 'absint', $ids ) );
$shown    = 0.0;
foreach ( array_keys( $campaign ) as $pid ) {
	$shown += (float) get_post_meta( $pid, '_wdp_total_donation_amount', true );
}

$rows     = array();
$expected = 0.0;
$page     = 1;
do {
	$orders = wc_get_orders(
		array(
			'limit'   => 100,
			'paged'   => $page,
			'status'  => array( 'wc-processing', 'wc-completed', 'wc-on-hold' ),
			'type'    => 'shop_order',
			'orderby' => 'ID',
			'order'   => 'ASC',
		)
	);
	foreach ( $orders as $order ) {
		$cur  = (string) $order->get_currency();
		$line = 0.0;
		foreach ( $order->get_items() as $item ) {
			if ( isset( $campaign[ absint( $item->get_product_id() ) ] ) ) {
				$line += max( 0.0, (float) $item->get_total() );
			}
		}
		if ( $line <= 0 ) {
			continue;
		}
		if ( ! isset( $rows[ $cur ] ) ) {
			$rows[ $cur ] = array( 'orders' => 0, 'amount_sum' => 0.0, 'expected_base' => 0.0, 'rate_src' => array( 'order_meta' => 0, 'live' => 0, 'none' => 0 ) );
		}
		++$rows[ $cur ]['orders'];
		$rows[ $cur ]['amount_sum'] += $line;
		$rate = null;
		$src  = 'none';
		if ( $cur === $base ) {
			$rate = 1.0;
			$src  = 'live';
		} else {
			$info = $order->get_meta( 'wmc_order_info', true );
			if ( is_array( $info ) && isset( $info[ $cur ]['rate'] ) && (float) $info[ $cur ]['rate'] > 0 && abs( (float) $info[ $cur ]['rate'] - 1.0 ) > 0.0000001 ) {
				$rate = (float) $info[ $cur ]['rate'];
				$src  = 'order_meta';
			} elseif ( isset( $live[ $cur ] ) ) {
				$rate = $live[ $cur ];
				$src  = 'live';
			}
		}
		++$rows[ $cur ]['rate_src'][ $src ];
		if ( null !== $rate ) {
			$rows[ $cur ]['expected_base'] += $line / $rate;
			$expected                      += $line / $rate;
		}
	}
	++$page;
} while ( count( $orders ) === 100 );

ksort( $rows );
foreach ( $rows as $c => $r ) {
	$rows[ $c ]['amount_sum']    = round( $r['amount_sum'], 2 );
	$rows[ $c ]['expected_base'] = round( $r['expected_base'], 2 );
}
echo wp_json_encode(
	array(
		'report'          => 'wdp-expected-total',
		'base_currency'   => $base,
		'by_currency'     => $rows,
		'expected_total'  => round( $expected, 2 ),
		'plugin_shown'    => round( $shown, 2 ),
		'live_rates_used' => array_keys( $live ),
	)
) . "\n";

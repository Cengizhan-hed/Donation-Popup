<?php
/**
 * staging30 Curcy kur ayari: yedekle / kur gir / geri yukle / durum.
 * `update_option` YALNIZ bu dosyada ve YALNIZ Curcy parametre seceneginde.
 *
 *   WDP_E2E_CURCY_OP=backup|set|restore|status
 *   WDP_E2E_CURCY_RATES="EUR=0.02,USD=0.022"  (yalniz set)
 *   WDP_E2E_CURCY_RESTORE_FILE=<json yolu>     (yalniz restore; {"option_name":..,"value":..})
 *
 * Curcy anlami: currency[] ile currency_rate[] paralel dizilerdir; oran = "1 ANA PARA BIRIMI (TRY)
 * kac birim BU para birimi eder" (ana birimin orani 1). Ornek: TRY tabani, EUR=0.02 => 1 TRY = 0.02 EUR.
 * Cikti: tek satir JSON. Kisisel veri yok; backup disinda deger yazilmaz.
 */
if ( ! function_exists( 'get_option' ) ) {
	fwrite( STDERR, "wordpress missing\n" );
	exit( 1 );
}

/**
 * @param array<string,mixed> $out Cikti.
 * @return void
 */
function wdp_curcy_done( $out ) {
	echo wp_json_encode( $out ) . "\n";
}

/**
 * @param mixed $value Secenek degeri.
 * @return string
 */
function wdp_curcy_hash( $value ) {
	return hash( 'sha256', (string) wp_json_encode( $value ) );
}

$op          = (string) getenv( 'WDP_E2E_CURCY_OP' );
$option_name = 'woo_multi_currency_params';

if ( ! in_array( $op, array( 'backup', 'set', 'restore', 'status' ), true ) ) {
	wdp_curcy_done( array( 'ok' => false, 'error' => 'bad-op' ) );
	exit( 1 );
}

$current = get_option( $option_name, null );
if ( ! is_array( $current ) || ! isset( $current['currency'], $current['currency_rate'] ) || ! is_array( $current['currency'] ) || ! is_array( $current['currency_rate'] ) ) {
	wdp_curcy_done( array( 'ok' => false, 'error' => 'option-not-found-or-shape' ) );
	exit( 1 );
}

$codes = array_values( $current['currency'] );
$rates = array();
foreach ( $codes as $i => $code ) {
	$rates[ (string) $code ] = isset( $current['currency_rate'][ $i ] ) ? (string) $current['currency_rate'][ $i ] : null;
}
$base = array(
	'ok'          => true,
	'op'          => $op,
	'option_name' => $option_name,
	'key_count'   => count( $current ),
	'sha256'      => wdp_curcy_hash( $current ),
	'rates'       => $rates,
);

if ( 'status' === $op ) {
	wdp_curcy_done( $base );
	return;
}

if ( 'backup' === $op ) {
	$base['value'] = $current;
	wdp_curcy_done( $base );
	return;
}

if ( 'set' === $op ) {
	$spec = (string) getenv( 'WDP_E2E_CURCY_RATES' );
	$want = array();
	foreach ( explode( ',', $spec ) as $pair ) {
		if ( ! preg_match( '/^([A-Z]{3})=([0-9]+(?:\.[0-9]+)?)$/', trim( $pair ), $m ) || (float) $m[2] <= 0 ) {
			wdp_curcy_done( array( 'ok' => false, 'error' => 'bad-rates' ) );
			exit( 1 );
		}
		$want[ $m[1] ] = $m[2];
	}
	if ( ! $want ) {
		wdp_curcy_done( array( 'ok' => false, 'error' => 'no-rates' ) );
		exit( 1 );
	}
	$next = $current;
	foreach ( $want as $code => $rate ) {
		$idx = array_search( $code, $codes, true );
		if ( false === $idx ) {
			wdp_curcy_done( array( 'ok' => false, 'error' => 'currency-not-in-list', 'currency' => $code ) );
			exit( 1 );
		}
		$default_code = isset( $current['currency_default'] ) ? (string) $current['currency_default'] : (string) get_option( 'woocommerce_currency' );
		if ( $code === $default_code ) {
			wdp_curcy_done( array( 'ok' => false, 'error' => 'refuse-default-currency', 'currency' => $code ) );
			exit( 1 );
		}
		$next['currency_rate'][ $idx ] = $rate;
	}
	update_option( $option_name, $next );
	$after              = get_option( $option_name );
	$base['sha256']     = wdp_curcy_hash( $after );
	$base['changed']    = array_keys( $want );
	$base['rates_after'] = array_combine( array_map( 'strval', $codes ), array_map( 'strval', $after['currency_rate'] ) );
	unset( $base['rates'] );
	wdp_curcy_done( $base );
	return;
}

// restore.
$file = (string) getenv( 'WDP_E2E_CURCY_RESTORE_FILE' );
$data = '' !== $file && is_readable( $file ) ? json_decode( (string) file_get_contents( $file ), true ) : null; // phpcs:ignore WordPress.WP.AlternativeFunctions
if ( ! is_array( $data ) || ( $data['option_name'] ?? '' ) !== $option_name || ! isset( $data['value'] ) || ! is_array( $data['value'] ) || ! isset( $data['value']['currency'], $data['value']['currency_rate'] ) ) {
	wdp_curcy_done( array( 'ok' => false, 'error' => 'bad-restore-file' ) );
	exit( 1 );
}
update_option( $option_name, $data['value'] );
$after               = get_option( $option_name );
$base['sha256']      = wdp_curcy_hash( $after );
$base['key_count']   = is_array( $after ) ? count( $after ) : 0;
$base['restored_ok'] = wdp_curcy_hash( $data['value'] ) === $base['sha256'];
wdp_curcy_done( $base );

<?php
/**
 * SALT OKUNUR toplam yeniden hesap raporu (kuru calistirma): urun basina eski toplam -> hesaplanan toplam.
 * Eklentinin Totals_Recalculator sinifini YALNIZ dry_run=true ile cagirir; hicbir yazma cagrisi icermez.
 * Cikti: tek satir JSON. Yalniz urun id/baslik, para birimi kodu ve sayilar; kisi/e-posta/siparis kimligi yok.
 *
 *   WDP_RECALC_DIGEST=1  -> ek olarak veritabani ozeti (yalniz sayi + sha256) cikar (yazma-yok kaniti).
 */
if ( ! function_exists( 'get_option' ) || ! function_exists( 'wc_get_orders' ) ) {
	fwrite( STDERR, "wordpress/woocommerce missing\n" );
	exit( 1 );
}

define( 'WDP_DRY_RUN_ONLY', true );

/**
 * Tek giris: yalnizca kuru calistirma. dry_run true degilse reddeder.
 *
 * @param object $calc    Totals_Recalculator.
 * @param int[]  $ids     Urun kimlikleri.
 * @param mixed  $dry_run Kuru calistirma bayragi.
 * @return array<string,mixed>
 */
function wdp_recalc_dry_only( $calc, array $ids, $dry_run ) {
	if ( defined( 'WDP_DRY_RUN_ONLY' ) && true !== $dry_run ) {
		throw new RuntimeException( 'dry-run-only: yazma modu reddedildi' );
	}
	return $calc->run( $ids, true );
}

/**
 * Veritabani ozeti (salt okunur): satir sayilari + sha256.
 *
 * @return array<string,mixed>
 */
function wdp_recalc_digest() {
	global $wpdb;
	$meta   = $wpdb->get_results( "SELECT post_id, meta_key, meta_value FROM {$wpdb->postmeta} WHERE meta_key LIKE '\\_wdp%' ORDER BY post_id, meta_key, meta_id", ARRAY_A ); // phpcs:ignore WordPress.DB
	$opts   = $wpdb->get_results( "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE 'wdp%' OR option_name LIKE '\\_wdp%' ORDER BY option_name", ARRAY_A ); // phpcs:ignore WordPress.DB
	$tables = array();
	foreach ( array( $wpdb->posts, $wpdb->postmeta, $wpdb->options ) as $t ) {
		$tables[ $t ] = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$t}" ); // phpcs:ignore WordPress.DB
	}
	return array(
		'wdp_postmeta_rows' => count( (array) $meta ),
		'wdp_option_rows'   => count( (array) $opts ),
		'table_rows'        => $tables,
		'sha256'            => hash( 'sha256', (string) wp_json_encode( array( $meta, $opts, $tables ) ) ),
	);
}

$out = array( 'ok' => false );
try {
	if ( ! class_exists( '\\DonationPanel\\Cli\\Totals_Recalculator' ) || ! class_exists( '\\WDP_Utils' ) ) {
		throw new RuntimeException( 'Totals_Recalculator yok (eklenti surumu E8A oncesi olabilir)' );
	}
	$digest_on = '1' === (string) getenv( 'WDP_RECALC_DIGEST' );
	$before    = $digest_on ? wdp_recalc_digest() : null;

	$calc   = new \DonationPanel\Cli\Totals_Recalculator();
	$ids    = $calc->all_product_ids();
	$result = $ids ? wdp_recalc_dry_only( $calc, $ids, true ) : array(
		'rows'        => array(),
		'changed'     => 0,
		'written'     => 0,
		'unconverted' => 0,
	);

	$rows     = array();
	$warnings = array();
	foreach ( $result['rows'] as $row ) {
		$rows[] = array(
			'product_id'  => (int) $row['product_id'],
			'title'       => wp_strip_all_tags( (string) get_the_title( $row['product_id'] ) ),
			'old_total'   => $row['old_total'],
			'new_total'   => $row['new_total'],
			'delta'       => null === $row['old_total'] ? null : round( (float) $row['new_total'] - (float) $row['old_total'], 2 ),
			'old_donors'  => $row['old_donors'],
			'new_donors'  => $row['new_donors'],
			'orders'      => $row['orders'],
			'unconverted' => $row['unconverted'],
			'differs'     => (bool) $row['changed'],
			// K2: gocu onerisi (uygulanmaz) + neden ayristirma; yalniz sayi/etiket.
			'diff'              => $row['diff'],
			'manual_existing'   => $row['manual_existing'],
			'suggested_manual'  => $row['suggested_manual'],
			'display_after'     => $row['display_after'],
			'display_increases' => (bool) $row['display_increases'],
			'reason'            => (string) $row['reason'],
			'breakdown'         => $row['breakdown'],
		);
		if ( $row['unconverted'] > 0 ) {
			$warnings[] = array(
				'product_id' => (int) $row['product_id'],
				'warning'    => 'kur-bulunamadi',
				'lines'      => (int) $row['unconverted'],
			);
		}
	}

	$out = array(
		'ok'            => true,
		'dry_run'       => true,
		'written'       => (int) $result['written'],
		'base_currency' => (string) get_option( 'woocommerce_currency' ),
		'products'      => count( $rows ),
		'differs'       => (int) $result['changed'],
		'unconverted'   => (int) $result['unconverted'],
		'warnings'      => $warnings,
		'rows'          => $rows,
	);
	if ( $digest_on ) {
		$out['digest_before'] = $before;
		$out['digest_after']  = wdp_recalc_digest();
		$out['digest_same']   = $before['sha256'] === $out['digest_after']['sha256'];
	}
} catch ( Throwable $e ) {
	$out = array(
		'ok'    => false,
		'error' => substr( $e->getMessage(), 0, 200 ),
	);
}
echo wp_json_encode( $out ) . "\n";
exit( $out['ok'] ? 0 : 1 );

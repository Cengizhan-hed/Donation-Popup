<?php
/**
 * Taint kanaryası: stub'ların çalıştığını kanıtlar (analyse:security her koşuda doğrular).
 * Beklenen: bad_* işlevlerinde Tainted* bulgusu VAR; good_* işlevlerinde YOK. Pakete girmez.
 *
 * @package WooCommerce\Donation_Popup
 */

function canary_bad_html() {
	echo $_GET['x']; // BEKLENEN: TaintedHtml.
}

function canary_good_html() {
	echo esc_html( wp_unslash( $_GET['x'] ) );
	echo wp_kses_post( $_GET['y'] );
	echo sanitize_text_field( wp_unslash( $_POST['z'] ) );
}

function canary_bad_sql() {
	global $wpdb;
	$wpdb->query( 'DELETE FROM t WHERE id = ' . $_POST['id'] ); // BEKLENEN: TaintedSql.
}

function canary_good_sql() {
	global $wpdb;
	$wpdb->query( $wpdb->prepare( 'DELETE FROM t WHERE id = %d', absint( $_POST['id'] ) ) );
}

function canary_bad_rest( WP_REST_Request $request ) {
	echo $request->get_param( 'name' ); // BEKLENEN: TaintedHtml (REST kaynağı).
}

function canary_good_rest( WP_REST_Request $request ) {
	echo esc_html( (string) $request->get_param( 'name' ) );
}

function canary_bad_redirect() {
	wp_redirect( $_GET['to'] ); // BEKLENEN: TaintedHeader (wp_safe_redirect olmalı).
}

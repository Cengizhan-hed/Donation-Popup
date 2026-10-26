<?php
/**
 * Eklentinin KENDI ayarini (yalniz `donation_panel_settings` icindeki ALLOWLIST yollar) guvenle degistirir.
 * `update_option` YALNIZ bu dosyada ve YALNIZ Settings::OPTION_NAME seceneginde. Baska option/post/meta/kullanici yazilmaz.
 *
 *   WDP_E2E_PS_PAYLOAD_FILE=<json yolu>  {"op":"show|set|restore","dry":bool,"values":{"yol":deger},
 *                                         "restore":{"yol":{"present":bool,"value":mixed}}}
 *
 * Bilinmeyen yol, yasak yol ya da sema/sanitize'dan gecmeyen deger -> RED (hicbir sey yazilmaz).
 * Cikti: tek satir JSON (ayar degerleri; kisisel veri yok).
 *
 * @package DonationPanel
 */
if ( ! function_exists( 'get_option' ) ) {
	fwrite( STDERR, "wordpress missing\n" );
	exit( 1 );
}

/**
 * @param array<string,mixed> $out Cikti.
 * @return void
 */
function wdp_ps_done( $out ) {
	echo wp_json_encode( $out ) . "\n";
}

/**
 * @param string $error Hata kodu.
 * @param array<string,mixed> $extra Ek.
 * @return void
 */
function wdp_ps_fail( $error, $extra = array() ) {
	wdp_ps_done( array_merge( array( 'ok' => false, 'error' => $error ), $extra ) );
	exit( 1 );
}

if ( ! class_exists( '\DonationPanel\Core\Settings' ) ) {
	wdp_ps_fail( 'plugin-not-active' );
}

$wdp_ps_option  = \DonationPanel\Core\Settings::OPTION_NAME;
$wdp_ps_modules = array( 'side_cart', 'campaign', 'impact', 'social_proof', 'thanks', 'tax_relief', 'donor_account' );
$wdp_ps_schema  = \DonationPanel\Core\Settings::schema();

// Izinli yollar: yol => tur (bool|enum:<sabit>|string|text). Yalniz Settings semasindan turetilir.
$wdp_ps_allow = array();
foreach ( $wdp_ps_modules as $slug ) {
	$wdp_ps_allow[ 'modules.' . $slug ] = 'bool';
}
$wdp_ps_allow['experiences.engine'] = 'enum:engine';
$wdp_ps_allow['admin.ui']           = 'enum:admin_ui';
foreach ( array( 'thanks', 'tax_relief' ) as $group ) {
	foreach ( $wdp_ps_schema[ $group ] as $key => $spec ) {
		$wdp_ps_allow[ $group . '.' . $key ] = $spec['type'];
	}
}
// Sema ile uyum: schema'da olmayan (modules disi) yol allowlist'te kalamaz.
foreach ( array_keys( $wdp_ps_allow ) as $path ) {
	$parts = explode( '.', $path, 2 );
	if ( 'modules' !== $parts[0] && ! isset( $wdp_ps_schema[ $parts[0] ][ $parts[1] ] ) ) {
		wdp_ps_fail( 'allowlist-schema-mismatch', array( 'path' => $path ) );
	}
}

/**
 * Deger dogrulama. [ ok, cast, hata ].
 *
 * @param string $path  Yol.
 * @param mixed  $value Ham deger.
 * @return array{0:bool,1:mixed,2:string}
 */
function wdp_ps_validate( $path, $value ) {
	global $wdp_ps_allow;
	if ( ! isset( $wdp_ps_allow[ $path ] ) ) {
		return array( false, null, 'path-not-allowed' );
	}
	$type = $wdp_ps_allow[ $path ];
	if ( 'bool' === $type ) {
		if ( is_bool( $value ) ) {
			return array( true, $value, '' );
		}
		if ( in_array( $value, array( 1, '1', 'true', 'on', 'yes' ), true ) ) {
			return array( true, true, '' );
		}
		if ( in_array( $value, array( 0, '0', 'false', 'off', 'no' ), true ) ) {
			return array( true, false, '' );
		}
		return array( false, null, 'bad-bool' );
	}
	if ( 0 === strpos( $type, 'enum:' ) ) {
		$list = 'enum:engine' === $type ? \DonationPanel\Core\Settings::ENGINES : \DonationPanel\Core\Settings::ADMIN_UIS;
		return is_string( $value ) && in_array( $value, $list, true ) ? array( true, $value, '' ) : array( false, null, 'bad-enum' );
	}
	if ( ! is_string( $value ) || strlen( $value ) > 2000 ) {
		return array( false, null, 'bad-string' );
	}
	$parts = explode( '.', $path, 2 );
	$norm  = \DonationPanel\Core\Settings::normalize( array( $parts[0] => array( $parts[1] => $value ) ) );
	if ( $norm[ $parts[0] ][ $parts[1] ] !== $value ) {
		return array( false, null, 'sanitize-changed-value' );
	}
	return array( true, $value, '' );
}

/**
 * Saklı ham diziden yol okuma: [ present, value ].
 *
 * @param mixed  $stored Saklı.
 * @param string $path   Yol.
 * @return array{present:bool,value:mixed}
 */
function wdp_ps_read( $stored, $path ) {
	$parts = explode( '.', $path, 2 );
	if ( is_array( $stored ) && isset( $stored[ $parts[0] ] ) && is_array( $stored[ $parts[0] ] ) && array_key_exists( $parts[1], $stored[ $parts[0] ] ) ) {
		return array( 'present' => true, 'value' => $stored[ $parts[0] ][ $parts[1] ] );
	}
	return array( 'present' => false, 'value' => null );
}

$payload_file = (string) getenv( 'WDP_E2E_PS_PAYLOAD_FILE' );
$payload      = '' !== $payload_file && is_readable( $payload_file ) ? json_decode( (string) file_get_contents( $payload_file ), true ) : null; // phpcs:ignore WordPress.WP.AlternativeFunctions
if ( ! is_array( $payload ) || ! isset( $payload['op'] ) || ! in_array( $payload['op'], array( 'show', 'set', 'restore' ), true ) ) {
	wdp_ps_fail( 'bad-payload' );
}
$op  = (string) $payload['op'];
$dry = ! empty( $payload['dry'] );

$stored = get_option( $wdp_ps_option, null );
if ( null !== $stored && ! is_array( $stored ) ) {
	wdp_ps_fail( 'option-shape' );
}

$before_all = array();
foreach ( array_keys( $wdp_ps_allow ) as $path ) {
	$before_all[ $path ] = wdp_ps_read( $stored, $path );
}

if ( 'show' === $op ) {
	wdp_ps_done( array( 'ok' => true, 'op' => 'show', 'option_exists' => null !== $stored, 'previous' => $before_all ) );
	return;
}

// Hedef degerler: set -> values; restore -> restore (present=false => anahtar silinir).
$targets = array();
if ( 'set' === $op ) {
	if ( empty( $payload['values'] ) || ! is_array( $payload['values'] ) ) {
		wdp_ps_fail( 'no-values' );
	}
	foreach ( $payload['values'] as $path => $value ) {
		list( $ok, $cast, $err ) = wdp_ps_validate( (string) $path, $value );
		if ( ! $ok ) {
			wdp_ps_fail( $err, array( 'path' => (string) $path ) );
		}
		$targets[ (string) $path ] = array( 'present' => true, 'value' => $cast );
	}
} else {
	if ( empty( $payload['restore'] ) || ! is_array( $payload['restore'] ) ) {
		wdp_ps_fail( 'no-restore' );
	}
	foreach ( $payload['restore'] as $path => $entry ) {
		if ( ! is_array( $entry ) || ! array_key_exists( 'present', $entry ) ) {
			wdp_ps_fail( 'bad-restore-entry', array( 'path' => (string) $path ) );
		}
		if ( empty( $entry['present'] ) ) {
			if ( ! isset( $wdp_ps_allow[ (string) $path ] ) ) {
				wdp_ps_fail( 'path-not-allowed', array( 'path' => (string) $path ) );
			}
			$targets[ (string) $path ] = array( 'present' => false, 'value' => null );
			continue;
		}
		list( $ok, $cast, $err ) = wdp_ps_validate( (string) $path, $entry['value'] ?? null );
		if ( ! $ok ) {
			wdp_ps_fail( $err, array( 'path' => (string) $path ) );
		}
		$targets[ (string) $path ] = array( 'present' => true, 'value' => $cast );
	}
}

$next    = is_array( $stored ) ? $stored : array();
$changes = array();
foreach ( $targets as $path => $want ) {
	$parts = explode( '.', $path, 2 );
	$had   = $before_all[ $path ];
	if ( $want['present'] ) {
		if ( ! isset( $next[ $parts[0] ] ) || ! is_array( $next[ $parts[0] ] ) ) {
			$next[ $parts[0] ] = array();
		}
		$next[ $parts[0] ][ $parts[1] ] = $want['value'];
	} elseif ( isset( $next[ $parts[0] ] ) && is_array( $next[ $parts[0] ] ) ) {
		unset( $next[ $parts[0] ][ $parts[1] ] );
	}
	$changes[] = array(
		'path'    => $path,
		'before'  => $had,
		'after'   => $want,
		'changed' => $had['present'] !== $want['present'] || $had['value'] !== $want['value'],
	);
}

$any = false;
foreach ( $changes as $c ) {
	$any = $any || $c['changed'];
}

$written = false;
if ( ! $dry && $any ) {
	update_option( $wdp_ps_option, $next, false );
	$written = true;
	$after   = get_option( $wdp_ps_option, null );
	foreach ( $targets as $path => $want ) {
		$got = wdp_ps_read( $after, $path );
		if ( $got['present'] !== $want['present'] || $got['value'] !== $want['value'] ) {
			wdp_ps_fail( 'verify-failed', array( 'path' => $path ) );
		}
	}
}

wdp_ps_done( array( 'ok' => true, 'op' => $op, 'dry' => $dry, 'written' => $written, 'changes' => $changes ) );

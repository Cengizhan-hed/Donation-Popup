<?php
/**
 * Code Snippets: YALNIZ kendi adiyla isaretli tek kaydi okur/ekler/gunceller/siler.
 * Baska snippet'e dokunmaz (her yazma `name = SABIT AD` kosullu).
 *
 *   WDP_E2E_SNIPPET_OP=status|install|remove
 *   WDP_E2E_SNIPPET_NAME=<ad>  WDP_E2E_SNIPPET_DESC=<aciklama>
 *   WDP_E2E_SNIPPET_CODE_FILE=<yol>  (yalniz install; ilk <?php haric kod)
 *
 * Cikti: tek satir JSON.
 */
if ( ! function_exists( 'get_option' ) ) {
	fwrite( STDERR, "wordpress missing\n" );
	exit( 1 );
}

/**
 * @param array<string,mixed> $out Cikti.
 * @return void
 */
function wdp_snip_done( $out ) {
	echo wp_json_encode( $out ) . "\n";
}

$op   = (string) getenv( 'WDP_E2E_SNIPPET_OP' );
$name = (string) getenv( 'WDP_E2E_SNIPPET_NAME' );
$desc = (string) getenv( 'WDP_E2E_SNIPPET_DESC' );
$file = (string) getenv( 'WDP_E2E_SNIPPET_CODE_FILE' );

if ( ! in_array( $op, array( 'status', 'install', 'remove' ), true ) || '' === $name ) {
	wdp_snip_done( array( 'ok' => false, 'error' => 'bad-args' ) );
	exit( 1 );
}
if ( 0 !== strpos( $name, 'WDP-K8-' ) ) {
	wdp_snip_done( array( 'ok' => false, 'error' => 'name-not-marked' ) );
	exit( 1 );
}

global $wpdb;
$out = array(
	'ok'                  => true,
	'op'                  => $op,
	'code_snippets'       => defined( 'CODE_SNIPPETS_VERSION' ) ? (string) CODE_SNIPPETS_VERSION : '',
	'code_snippets_active' => defined( 'CODE_SNIPPETS_VERSION' ),
);

$table = $wpdb->prefix . 'snippets';
if ( function_exists( 'code_snippets' ) ) {
	$cs = code_snippets();
	if ( is_object( $cs ) && isset( $cs->db ) && is_object( $cs->db ) && method_exists( $cs->db, 'get_table_name' ) ) {
		$tn = (string) $cs->db->get_table_name( false );
		if ( '' !== $tn ) {
			$table = $tn;
		}
	}
}
$out['table'] = $table;
$prev_sup     = $wpdb->suppress_errors( true );
// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
$exists       = ( null !== $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" ) );
$wpdb->suppress_errors( $prev_sup );
if ( ! $exists ) {
	$out['ok']    = false;
	$out['error'] = 'snippets-table-missing';
	wdp_snip_done( $out );
	exit( 1 );
}

/**
 * @param string $table Tablo.
 * @param string $name  Ad.
 * @return array<string,mixed>|null
 */
function wdp_snip_find( $table, $name ) {
	global $wpdb;
	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$row = $wpdb->get_row( $wpdb->prepare( "SELECT id, name, scope, active, priority, code FROM {$table} WHERE name = %s ORDER BY id ASC LIMIT 1", $name ), ARRAY_A );
	return is_array( $row ) ? $row : null;
}

/**
 * @param array<string,mixed>|null $row Satir.
 * @return array<string,mixed>
 */
function wdp_snip_view( $row ) {
	if ( ! $row ) {
		return array( 'exists' => false );
	}
	return array(
		'exists'   => true,
		'id'       => (int) $row['id'],
		'active'   => ( 1 === (int) $row['active'] ),
		'scope'    => (string) $row['scope'],
		'priority' => (int) $row['priority'],
		'code_md5' => md5( (string) $row['code'] ),
	);
}

/**
 * Kod onbellegini temizle (varsa).
 *
 * @param string $table Tablo.
 * @return void
 */
function wdp_snip_clear_cache( $table ) {
	if ( function_exists( '\Code_Snippets\clean_snippets_cache' ) ) {
		\Code_Snippets\clean_snippets_cache( $table );
	} elseif ( function_exists( 'clean_snippets_cache' ) ) {
		clean_snippets_cache( $table );
	}
	if ( function_exists( 'wp_cache_flush_group' ) ) {
		wp_cache_flush_group( 'code_snippets' );
	}
}

$row = wdp_snip_find( $table, $name );

if ( 'status' === $op ) {
	$out['snippet'] = wdp_snip_view( $row );
	wdp_snip_done( $out );
	return;
}

if ( 'remove' === $op ) {
	$out['before'] = wdp_snip_view( $row );
	if ( $row ) {
		$wpdb->delete( $table, array( 'id' => (int) $row['id'], 'name' => $name ), array( '%d', '%s' ) );
		wdp_snip_clear_cache( $table );
	}
	$out['after'] = wdp_snip_view( wdp_snip_find( $table, $name ) );
	$out['ok']    = ! $out['after']['exists'];
	wdp_snip_done( $out );
	exit( $out['ok'] ? 0 : 1 );
}

// install.
if ( '' === $file || ! is_readable( $file ) ) {
	$out['ok']    = false;
	$out['error'] = 'code-file-missing';
	wdp_snip_done( $out );
	exit( 1 );
}
$code = (string) file_get_contents( $file );
$code = preg_replace( '/^\s*<\?php\s*/', '', $code, 1 );
$code = ltrim( (string) $code, "\r\n" );
if ( '' === trim( $code ) ) {
	$out['ok']    = false;
	$out['error'] = 'code-empty';
	wdp_snip_done( $out );
	exit( 1 );
}
try {
	token_get_all( '<?php ' . $code, TOKEN_PARSE );
} catch ( \ParseError $e ) {
	$out['ok']    = false;
	$out['error'] = 'code-parse-error line ' . (int) $e->getLine();
	wdp_snip_done( $out );
	exit( 1 );
}

$data = array(
	'name'        => $name,
	'description' => $desc,
	'code'        => $code,
	'scope'       => 'global',
	'priority'    => 10,
	'active'      => 1,
	'modified'    => gmdate( 'Y-m-d H:i:s' ),
);
$fmt  = array( '%s', '%s', '%s', '%s', '%d', '%d', '%s' );
$out['before'] = wdp_snip_view( $row );
if ( $row ) {
	$wpdb->update( $table, $data, array( 'id' => (int) $row['id'], 'name' => $name ), $fmt, array( '%d', '%s' ) );
	$out['mode'] = 'update';
} else {
	$wpdb->insert( $table, $data, $fmt );
	$out['mode'] = 'insert';
}
wdp_snip_clear_cache( $table );
$after        = wdp_snip_find( $table, $name );
$out['after'] = wdp_snip_view( $after );
$out['ok']    = $after && 1 === (int) $after['active'] && 'global' === $after['scope'] && md5( $code ) === md5( (string) $after['code'] );
$out['id']    = $after ? (int) $after['id'] : 0;
wdp_snip_done( $out );
exit( $out['ok'] ? 0 : 1 );

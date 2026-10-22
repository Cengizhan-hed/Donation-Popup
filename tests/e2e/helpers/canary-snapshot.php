<?php
/**
 * Salt okunur kanarya anlık görüntüsü. Yazma yok.
 *
 *   wp eval-file tests/e2e/helpers/canary-snapshot.php
 */
if (!function_exists('get_option')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}

$types = array(
	'page',
	'post',
	'product',
	'attachment',
	'nav_menu_item',
	'elementor_library',
	'wp_block',
	'wp_template',
	'wp_template_part',
);
$q     = new WP_Query(
	array(
		'post_type'              => $types,
		'post_status'            => array( 'publish', 'draft', 'private', 'pending', 'trash', 'future', 'inherit' ),
		'posts_per_page'         => 4000,
		'orderby'                => 'ID',
		'order'                  => 'ASC',
		'ignore_sticky_posts'    => true,
		'no_found_rows'          => true,
		'update_post_meta_cache' => false,
		'update_post_term_cache' => false,
	)
);
$posts = array();
foreach ((array) $q->posts as $p) {
	$posts[] = array(
		'id'       => (int) $p->ID,
		'type'     => (string) $p->post_type,
		'status'   => (string) $p->post_status,
		'modified' => (string) $p->post_modified_gmt,
		'mark'     => (string) get_post_meta( (int) $p->ID, '_wdp_e2e_test', true ),
	);
}

$option_keys = array(
	'show_on_front',
	'page_on_front',
	'page_for_posts',
	'woocommerce_cart_page_id',
	'woocommerce_checkout_page_id',
	'woocommerce_myaccount_page_id',
	'woocommerce_shop_page_id',
	'woocommerce_terms_page_id',
	'blog_public',
	'woocommerce_coming_soon',
	'woocommerce_store_pages_only',
	'permalink_structure',
);
$options = array();
foreach ($option_keys as $key) {
	$val = get_option( $key );
	if ( is_bool( $val ) ) {
		$options[ $key ] = $val ? '1' : '0';
	} else {
		$options[ $key ] = is_scalar( $val ) ? (string) $val : wp_json_encode( $val );
	}
}

foreach ( array( 'woocommerce_cheque_settings', 'woocommerce_bacs_settings', 'woocommerce_cod_settings' ) as $gk ) {
	$g = get_option( $gk );
	$options[ $gk . '_enabled' ] = ( is_array( $g ) && isset( $g['enabled'] ) && $g['enabled'] === 'yes' ) ? 'yes' : 'no';
}

$success = get_option( 'wdp_success_settings' );
$success_ids = array();
if ( is_array( $success ) ) {
	foreach ( $success as $sk => $sv ) {
		if ( is_int( $sv ) || ( is_string( $sv ) && $sv !== '' && ctype_digit( $sv ) ) ) {
			$success_ids[ (string) $sk ] = (int) $sv;
		}
	}
}
$options['wdp_success_numeric_ids'] = wp_json_encode( $success_ids );

$user_counts = function_exists( 'count_users' ) ? count_users() : array();
$user_total  = isset( $user_counts['total_users'] ) ? (int) $user_counts['total_users'] : 0;

$att_q = new WP_Query(
	array(
		'post_type'              => 'attachment',
		'post_status'            => 'inherit',
		'posts_per_page'         => 1,
		'fields'                 => 'ids',
		'no_found_rows'          => false,
		'update_post_meta_cache' => false,
		'update_post_term_cache' => false,
	)
);

echo wp_json_encode(
	array(
		'siteurl'           => (string) get_option( 'siteurl' ),
		'generated_at'      => gmdate( 'c' ),
		'posts'             => $posts,
		'options'           => $options,
		'user_count'        => $user_total,
		'attachment_count'  => (int) $att_q->found_posts,
		'page_count'        => count( array_filter( $posts, static function ( $p ) { return ( $p['type'] ?? '' ) === 'page'; } ) ),
		'product_count'     => count( array_filter( $posts, static function ( $p ) { return ( $p['type'] ?? '' ) === 'product'; } ) ),
	),
	JSON_UNESCAPED_UNICODE
);

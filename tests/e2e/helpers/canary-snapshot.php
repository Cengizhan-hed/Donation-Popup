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
/*
 * Ürün meta'sı (şema 2): yalnız bağış ayarı ve fiyat meta'larının sha256'sı.
 * Bağış toplamı/sayaç gibi gerçek bağışla değişen anahtarlar dışarıda.
 */
$canary_meta_exact    = array( '_regular_price', '_sale_price', '_virtual', '_tax_status', '_tax_class', '_sold_individually' );
$canary_meta_volatile = array(
	'_wdp_e2e_test',
	'_wdp_total_donation_amount',
	'_wdp_donor_count',
	'_wdp_progress_unconverted_orders',
	'_wdp_progress_counted',
	'_wdp_progress_amounts',
	'_wdp_donation_totals_applied',
	'_wdp_donation_totals_reverted',
	'_wdp_totals_pending',
	'_wdp_totals_log',
);
$canary_meta_tracked = static function ( $key ) use ( $canary_meta_exact, $canary_meta_volatile ) {
	$key = (string) $key;
	if ( in_array( $key, $canary_meta_exact, true ) ) {
		return true;
	}
	if ( in_array( $key, $canary_meta_volatile, true ) ) {
		return false;
	}
	if ( 0 === strpos( $key, '_donation_panel_direct' ) || 0 === strpos( $key, '_wdp_tax_relief_' ) ) {
		return false;
	}
	foreach ( array( '_wdp_', '_donation_panel_', 'wdp_', 'donation_panel_' ) as $prefix ) {
		if ( 0 === strpos( $key, $prefix ) ) {
			return true;
		}
	}
	return false;
};

$posts = array();
foreach ((array) $q->posts as $p) {
	$row = array(
		'id'       => (int) $p->ID,
		'type'     => (string) $p->post_type,
		'status'   => (string) $p->post_status,
		'modified' => (string) $p->post_modified_gmt,
		'mark'     => (string) get_post_meta( (int) $p->ID, '_wdp_e2e_test', true ),
	);
	if ( 'product' === $row['type'] ) {
		$keep = array();
		foreach ( (array) get_post_meta( (int) $p->ID ) as $mk => $mv ) {
			if ( $canary_meta_tracked( $mk ) ) {
				$keep[ (string) $mk ] = $mv;
			}
		}
		ksort( $keep );
		$row['meta']     = hash( 'sha256', (string) wp_json_encode( $keep ) );
		$row['donation'] = true;
		if ( function_exists( 'wc_get_product' ) && class_exists( '\DonationPanel\Domain\Donation_Scope' ) ) {
			$prod = wc_get_product( (int) $p->ID );
			if ( $prod ) {
				$row['donation'] = (bool) \DonationPanel\Domain\Donation_Scope::is_donation_product( $prod );
			}
		}
	}
	$posts[] = $row;
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
$hash_option_keys = array( 'permalink_structure' );
foreach ($option_keys as $key) {
	$val = get_option( $key );
	if ( is_bool( $val ) ) {
		$options[ $key ] = $val ? '1' : '0';
	} else {
		$options[ $key ] = is_scalar( $val ) ? (string) $val : wp_json_encode( $val );
	}
	if ( in_array( $key, $hash_option_keys, true ) ) {
		$options[ $key ] = hash( 'sha256', (string) $options[ $key ] );
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

/*
 * Şema 2: eklentinin ve WooCommerce'in tüm seçenekleri yalnız sha256 olarak (değer yazılmaz).
 * Oynak (sürüm/önbellek/kilit/sayaç) anahtarları karşılaştırmada JS tarafı ayıklar.
 */
global $wpdb;
$canary_rows = $wpdb->get_results(
	$wpdb->prepare(
		"SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s OR option_name LIKE %s",
		$wpdb->esc_like( 'woocommerce_' ) . '%',
		$wpdb->esc_like( 'wdp_' ) . '%',
		$wpdb->esc_like( 'donation_panel_' ) . '%'
	),
	ARRAY_A
);
foreach ( (array) $canary_rows as $canary_row ) {
	$ck = (string) $canary_row['option_name'];
	if ( isset( $options[ $ck ] ) ) {
		continue;
	}
	$options[ $ck ] = 'sha256:' . hash( 'sha256', (string) $canary_row['option_value'] );
}

$active_plugins = get_option( 'active_plugins' );
$active_plugins = is_array( $active_plugins ) ? array_values( array_map( 'strval', $active_plugins ) ) : array();
sort( $active_plugins );
$options['active_plugins'] = (string) wp_json_encode( $active_plugins );
$options['stylesheet']     = (string) get_option( 'stylesheet' );
$options['template']       = (string) get_option( 'template' );

$user_counts = function_exists( 'count_users' ) ? count_users() : array();
$user_total  = isset( $user_counts['total_users'] ) ? (int) $user_counts['total_users'] : 0;
$user_roles  = isset( $user_counts['avail_roles'] ) && is_array( $user_counts['avail_roles'] ) ? $user_counts['avail_roles'] : array();
ksort( $user_roles );
$options['users_by_role'] = (string) wp_json_encode( $user_roles );

$env_files = array();
foreach ( array( 'wp-config.php', '.htaccess', 'index.php', 'wp-load.php' ) as $env_file ) {
	$exists = file_exists( ABSPATH . $env_file );
	if ( ! $exists && 'wp-config.php' === $env_file ) {
		$exists = file_exists( dirname( ABSPATH ) . '/wp-config.php' );
	}
	$env_files[ $env_file ] = $exists;
}

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
		'schema'            => 2,
		'siteurl'           => hash( 'sha256', (string) get_option( 'siteurl' ) ),
		'env_files'         => $env_files,
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

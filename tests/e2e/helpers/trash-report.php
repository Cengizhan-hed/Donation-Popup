<?php
/**
 * Salt okunur çöp + çekirdek sayfa raporu. Yazma / silme / option update YOK.
 *
 *   wp eval-file tests/e2e/helpers/trash-report.php
 */
if (!function_exists('get_option')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}

/**
 * @param int $id
 * @return array<string,mixed>
 */
function wdp_e2e_page_status_row($id) {
	$id = absint($id);
	if ($id <= 0) {
		return array(
			'id'       => 0,
			'status'   => '',
			'title'    => '',
			'type'     => '',
			'modified' => '',
		);
	}
	$p = get_post($id);
	if (!$p) {
		return array(
			'id'       => $id,
			'status'   => 'missing',
			'title'    => '',
			'type'     => '',
			'modified' => '',
		);
	}
	return array(
		'id'       => $id,
		'status'   => (string) $p->post_status,
		'title'    => (string) $p->post_title,
		'type'     => (string) $p->post_type,
		'modified' => (string) $p->post_modified,
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
	$options[ $key ] = get_option($key);
}

$core_keys = array(
	'page_on_front',
	'page_for_posts',
	'woocommerce_cart_page_id',
	'woocommerce_checkout_page_id',
	'woocommerce_myaccount_page_id',
	'woocommerce_shop_page_id',
	'woocommerce_terms_page_id',
);
$core_pages = array();
foreach ($core_keys as $key) {
	$core_pages[ $key ] = wdp_e2e_page_status_row((int) get_option($key));
}
$core_pages['cart_id_291'] = wdp_e2e_page_status_row(291);

$success     = get_option('wdp_success_settings');
$success_ids = array();
if (is_array($success)) {
	foreach ($success as $sk => $sv) {
		if (is_int($sv) || (is_string($sv) && $sv !== '' && ctype_digit($sv))) {
			$success_ids[ (string) $sk ] = (int) $sv;
		}
	}
}

$q = new WP_Query(
	array(
		'post_type'              => 'any',
		'post_status'            => 'trash',
		'posts_per_page'         => 300,
		'orderby'                => 'modified',
		'order'                  => 'DESC',
		'ignore_sticky_posts'    => true,
		'no_found_rows'          => false,
		'update_post_meta_cache' => true,
		'update_post_term_cache' => false,
	)
);
$trashed = array();
foreach ((array) $q->posts as $p) {
	$id = absint($p->ID);
	$author_login = '';
	$u            = get_userdata((int) $p->post_author);
	if ($u) {
		$author_login = (string) $u->user_login;
	}
	$trashed[] = array(
		'ID'                    => $id,
		'post_title'            => (string) $p->post_title,
		'post_type'             => (string) $p->post_type,
		'post_status'           => (string) $p->post_status,
		'post_modified'         => (string) $p->post_modified,
		'post_modified_gmt'     => (string) $p->post_modified_gmt,
		'post_author'           => (int) $p->post_author,
		'author_login'          => $author_login,
		'_wp_trash_meta_time'   => (string) get_post_meta($id, '_wp_trash_meta_time', true),
		'_wp_trash_meta_status' => (string) get_post_meta($id, '_wp_trash_meta_status', true),
		'e2e_mark'              => (string) get_post_meta($id, '_wdp_e2e_test', true),
	);
}

$trash_by_type = array();
global $wpdb;
if (isset($wpdb) && is_object($wpdb)) {
	$rows = $wpdb->get_results("SELECT post_type, COUNT(*) AS n FROM {$wpdb->posts} WHERE post_status='trash' GROUP BY post_type", ARRAY_A);
	if (is_array($rows)) {
		foreach ($rows as $row) {
			$trash_by_type[ (string) $row['post_type'] ] = (int) $row['n'];
		}
	}
}

$named_titles = array(
	'Ana sayfa',
	'Bağış Doğrulama — Donation Success Page',
	'Bağış Doğrulama',
	'Donation Success Page',
	'Sepet',
	'Cart',
);
$named = array();
foreach ($named_titles as $title) {
	$found = get_posts(
		array(
			'post_type'              => 'any',
			'post_status'            => 'any',
			'title'                  => $title,
			'numberposts'            => 10,
			'orderby'                => 'ID',
			'order'                  => 'DESC',
			'suppress_filters'       => true,
			'update_post_meta_cache' => false,
			'update_post_term_cache' => false,
		)
	);
	foreach ((array) $found as $p) {
		$named[] = array(
			'ID'          => (int) $p->ID,
			'post_title'  => (string) $p->post_title,
			'post_type'   => (string) $p->post_type,
			'post_status' => (string) $p->post_status,
			'modified'    => (string) $p->post_modified,
			'author'      => (int) $p->post_author,
			'search'      => $title,
		);
	}
}

$u1            = get_userdata(1);
$user1         = $u1
	? array(
		'exists' => true,
		'login'  => (string) $u1->user_login,
		'roles'  => implode(',', (array) $u1->roles),
	)
	: array(
		'exists' => false,
		'login'  => '',
		'roles'  => '',
	);
$user_counts   = function_exists('count_users') ? count_users() : array();
$user_total    = isset($user_counts['total_users']) ? (int) $user_counts['total_users'] : 0;
$user_roles    = array();
if (isset($user_counts['avail_roles']) && is_array($user_counts['avail_roles'])) {
	foreach ($user_counts['avail_roles'] as $role => $n) {
		$user_roles[ (string) $role ] = (int) $n;
	}
}

$recent_pages = array();
$recent       = get_posts(
	array(
		'post_type'              => array( 'page', 'post', 'product', 'nav_menu_item', 'elementor_library', 'wp_block' ),
		'post_status'            => array( 'publish', 'draft', 'private', 'pending', 'trash', 'future' ),
		'numberposts'            => 40,
		'orderby'                => 'modified',
		'order'                  => 'DESC',
		'suppress_filters'       => true,
		'update_post_meta_cache' => false,
		'update_post_term_cache' => false,
	)
);
foreach ((array) $recent as $p) {
	$recent_pages[] = array(
		'ID'          => (int) $p->ID,
		'post_title'  => (string) $p->post_title,
		'post_type'   => (string) $p->post_type,
		'post_status' => (string) $p->post_status,
		'modified'    => (string) $p->post_modified,
		'author'      => (int) $p->post_author,
	);
}

$e2e_products = 0;
$e2e_users    = 0;
$pq           = new WP_Query(
	array(
		'post_type'              => 'product',
		'post_status'            => 'any',
		'posts_per_page'         => 1,
		'fields'                 => 'ids',
		'meta_key'               => '_wdp_e2e_test',
		'meta_value'             => '1',
		'no_found_rows'          => false,
		'update_post_meta_cache' => false,
		'update_post_term_cache' => false,
	)
);
$e2e_products = (int) $pq->found_posts;
$eu           = get_users(
	array(
		'meta_key'   => '_wdp_e2e_test',
		'meta_value' => '1',
		'fields'     => 'ID',
		'number'     => 1,
		'count_total' => true,
	)
);
$e2e_users = is_object($eu) ? (int) $eu->total : (is_array($eu) ? count($eu) : 0);

$out = array(
	'siteurl'        => (string) get_option('siteurl'),
	'php'            => PHP_VERSION,
	'timezone'       => function_exists('wp_timezone_string') ? (string) wp_timezone_string() : '',
	'generated_at'   => gmdate('c'),
	'options'        => $options,
	'core_pages'     => $core_pages,
	'success_id_keys'=> $success_ids,
	'trash_total'    => array_sum($trash_by_type),
	'trash_listed'   => count($trashed),
	'trash_by_type'  => $trash_by_type,
	'trashed'        => $trashed,
	'named'          => $named,
	'e2e_marked'     => array(
		'products' => $e2e_products,
		'users'    => $e2e_users,
	),
	'user1'          => $user1,
	'user_total'     => $user_total,
	'user_roles'     => $user_roles,
	'recent'         => $recent_pages,
);
echo wp_json_encode($out, JSON_UNESCAPED_UNICODE);

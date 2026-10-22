<?php
/**
 * Yerel WP kanıt senaryoları (Docker yok).
 * 1) Eski wp_delete_user(reassign yok) — sayfa çöp, görsel kalıcı silinir.
 * 2) Yeni temizlik — işaretsiz sayfa/görsel/içerikli kullanıcı durur.
 * 3) Kanarya — çöpe atılan sayfa kırmızı.
 */
$root = dirname(__DIR__, 2);
$wp_dir = $root . '/build/local-wp/wordpress';
if (empty($_SERVER['HTTP_HOST'])) {
	$_SERVER['HTTP_HOST']   = '127.0.0.1';
	$_SERVER['SERVER_NAME'] = '127.0.0.1';
	$_SERVER['REQUEST_URI'] = '/';
}
require $wp_dir . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/image.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/user.php';

if (!defined('WDP_E2E_CLEANUP_LIB_ONLY')) {
	define('WDP_E2E_CLEANUP_LIB_ONLY', true);
}
require_once $root . '/tests/e2e/helpers/cleanup-e2e.php';

$evidence = array();

function wdp_local_make_user($login) {
	$id = wp_create_user($login, 'pass-' . wp_generate_password(12, false), $login . '@wdp-e2e.test');
	if (is_wp_error($id)) {
		throw new Exception('user create: ' . $id->get_error_message());
	}
	return (int) $id;
}

function wdp_local_make_page($author, $title) {
	$id = wp_insert_post(
		array(
			'post_title'  => $title,
			'post_status' => 'publish',
			'post_type'   => 'page',
			'post_author' => $author,
			'post_content'=> 'kanit',
		),
		true
	);
	if (is_wp_error($id)) {
		throw new Exception('page: ' . $id->get_error_message());
	}
	return (int) $id;
}

function wdp_local_make_attachment($author) {
	$upload = wp_upload_dir();
	$dir    = $upload['path'];
	if (!is_dir($dir)) {
		wp_mkdir_p($dir);
	}
	$file = $dir . '/wdp-e2e-pixel-' . wp_generate_password(6, false) . '.txt';
	file_put_contents($file, 'pixel');
	$attachment = array(
		'post_mime_type' => 'text/plain',
		'post_title'     => 'wdp e2e att',
		'post_content'   => '',
		'post_status'    => 'inherit',
		'post_author'    => $author,
	);
	$id = wp_insert_attachment($attachment, $file);
	if (!$id) {
		throw new Exception('attachment create failed');
	}
	return array( (int) $id, $file );
}

// --- 1) Eski davranış ---
$u1 = wdp_local_make_user('e2e_old_' . time());
$p1 = wdp_local_make_page($u1, 'E2E Old Page');
list($a1, $file1) = wdp_local_make_attachment($u1);
$prod1 = wp_insert_post(
	array(
		'post_title'  => 'E2E Old Product',
		'post_status' => 'private',
		'post_type'   => 'post',
		'post_author' => $u1,
	),
	true
);
wp_delete_user($u1); // reassign yok — 2026-10-22 mekanizması
$evidence['reproduce'] = array(
	'user_id'            => $u1,
	'page_id'            => $p1,
	'page_status_after'  => (string) get_post_status($p1),
	'attachment_id'      => $a1,
	'attachment_after'   => get_post($a1) ? 'exists' : 'deleted',
	'file_exists_after'  => is_file($file1) ? 'yes' : 'no',
);
if ((string) get_post_status($p1) !== 'trash') {
	fwrite(STDERR, "reproduce FAIL: sayfa çöpte değil\n");
	echo wp_json_encode($evidence);
	exit(1);
}
if (get_post($a1) || is_file($file1)) {
	fwrite(STDERR, "reproduce FAIL: görsel kalıcı silinmedi\n");
	echo wp_json_encode($evidence);
	exit(1);
}

// --- 2) Yeni temizlik ---
$admin = 1;
$run   = 'run-local-' . gmdate('YmdHis');
$keep_page = wdp_local_make_page($admin, 'E2E Keep Page Unmarked');
list($keep_att, $keep_file) = wdp_local_make_attachment($admin);
$content_user = wdp_local_make_user('e2e_keep_' . time());
update_user_meta($content_user, '_wdp_e2e_test', $run);
$content_page = wdp_local_make_page($content_user, 'Owned by tagged user');
$empty_user = wdp_local_make_user('e2e_empty_' . time());
update_user_meta($empty_user, '_wdp_e2e_test', $run);

$marked_post = wp_insert_post(
	array(
		'post_title'  => 'E2E Marked Post',
		'post_status' => 'private',
		'post_type'   => 'post',
		'post_author' => $admin,
	),
	true
);
update_post_meta($marked_post, '_wdp_e2e_test', $run);

$eval_user = wdp_e2e_evaluate_user_delete(
	array(
		'id'            => $content_user,
		'run_id'        => $run,
		'registry_ids'  => array( $content_user ),
		'email'         => 'e2e_keep@wdp-e2e.test',
		'user_mark'     => $run,
		'owned'         => array( get_post($content_page) ),
		'comment_count' => 0,
	)
);
$eval_page = wdp_e2e_evaluate_delete(
	array(
		'id'            => $keep_page,
		'run_id'        => $run,
		'expected_type' => 'page',
		'registry_ids'  => array( $keep_page ),
		'core_ids'      => array(),
		'type'          => 'page',
		'mark'          => '',
	)
);
$eval_att = wdp_e2e_evaluate_delete(
	array(
		'id'            => $keep_att,
		'run_id'        => $run,
		'expected_type' => 'attachment',
		'registry_ids'  => array( $keep_att ),
		'core_ids'      => array(),
		'type'          => 'attachment',
		'mark'          => '',
	)
);
$eval_marked = wdp_e2e_evaluate_delete(
	array(
		'id'            => $marked_post,
		'run_id'        => $run,
		'expected_type' => 'post',
		'registry_ids'  => array( $marked_post ),
		'core_ids'      => array(),
		'type'          => 'post',
		'mark'          => $run,
	)
);

$evidence['safe_cleanup'] = array(
	'unmarked_page_status' => (string) get_post_status($keep_page),
	'unmarked_file'        => is_file($keep_file) ? 'yes' : 'no',
	'content_user_exists'  => get_userdata($content_user) ? 'yes' : 'no',
	'content_page_status'  => (string) get_post_status($content_page),
	'eval_user_content'    => $eval_user,
	'eval_page'            => $eval_page,
	'eval_attachment'      => $eval_att,
	'eval_marked_post'     => $eval_marked,
);
if ($eval_user['ok'] || $eval_page['ok'] || $eval_att['ok'] || !$eval_marked['ok']) {
	fwrite(STDERR, "safe_cleanup FAIL\n");
	echo wp_json_encode($evidence, JSON_UNESCAPED_UNICODE);
	exit(1);
}
if ((string) get_post_status($keep_page) === 'trash' || !is_file($keep_file)) {
	fwrite(STDERR, "safe_cleanup FAIL: işaretsiz kayıt zarar gördü\n");
	echo wp_json_encode($evidence, JSON_UNESCAPED_UNICODE);
	exit(1);
}

// --- 3) Kanarya ön kontrol ---
$cart = wdp_local_make_page($admin, 'Sepet Kanarya');
wp_trash_post($cart);
$snap = array(
	'posts'   => array(
		array(
			'id'     => $cart,
			'type'   => 'page',
			'status' => (string) get_post_status($cart),
		),
	),
	'options' => array(
		'woocommerce_cart_page_id' => (string) $cart,
		'page_on_front'            => '0',
		'show_on_front'            => 'posts',
	),
);
$evidence['canary_preflight_input'] = $snap;
$evidence['canary_trashed_cart']    = (string) get_post_status($cart);

echo wp_json_encode($evidence, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
echo "\nOK\n";

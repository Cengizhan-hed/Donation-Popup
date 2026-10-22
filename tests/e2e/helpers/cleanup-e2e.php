<?php
/**
 * Yalnız kayıt defterindeki VE bu koşunun run_id'si ile işaretli kayıtlara dokunur.
 * Kara liste (page, attachment, nav_menu_item, wp_template*, elementor_library, Woo sayfaları) asla silinmez.
 * Kullanıcı silme: meta=_wdp_e2e_test=<run_id> + e-posta etiketi + defter ID (üçü) ve içerik yok.
 * wp_delete_user daima açık reassign kararı: içerik varsa ÇAĞRILMAZ.
 *
 *   WDP_E2E_REGISTRY_B64=... WDP_E2E_RUN_ID=... wp eval-file tests/e2e/helpers/cleanup-e2e.php
 * Defter yok/boş veya run_id yok/'1' → hiçbir şey silinmedi.
 *
 * PHPUnit: define('WDP_E2E_CLEANUP_LIB_ONLY', true); require bu dosya.
 */
if (!defined('WDP_E2E_EMAIL_NEEDLE')) {
	define('WDP_E2E_EMAIL_NEEDLE', '@wdp-e2e.test');
}
/** Hem sabit hem değişken — 2026-10-22 $EMAIL_NEEDLE tanımsız hatası tekrarlanmasın. */
$EMAIL_NEEDLE     = WDP_E2E_EMAIL_NEEDLE;
$WDP_E2E_META_KEY = '_wdp_e2e_test';

/**
 * @return string[]
 */
function wdp_e2e_blacklisted_types() {
	return array(
		'page',
		'attachment',
		'nav_menu_item',
		'wp_template',
		'wp_template_part',
		'wp_global_styles',
		'wp_navigation',
		'elementor_library',
		'wp_block',
	);
}

/**
 * @param mixed $registry
 * @param string $type
 * @return int[]
 */
function wdp_e2e_registry_ids($registry, $type) {
	$out = array();
	foreach ((array) $registry as $row) {
		if (!is_array($row)) {
			continue;
		}
		if ((string) ($row['type'] ?? '') !== $type) {
			continue;
		}
		$id = isset($row['id']) ? absint($row['id']) : 0;
		if ($id > 0) {
			$out[] = $id;
		}
	}
	return array_values(array_unique($out));
}

/**
 * @param string $run_id
 * @return bool
 */
function wdp_e2e_run_id_ok($run_id) {
	$run_id = (string) $run_id;
	if ($run_id === '' || $run_id === '1') {
		return false;
	}
	return (bool) preg_match('/^[A-Za-z0-9._:-]{4,80}$/', $run_id);
}

/**
 * @param array $args
 * @return array{ok:bool,reason:string}
 */
function wdp_e2e_evaluate_delete($args) {
	$id       = isset($args['id']) ? absint($args['id']) : 0;
	$run_id   = (string) ($args['run_id'] ?? '');
	$expected = (string) ($args['expected_type'] ?? '');
	$registry = isset($args['registry_ids']) && is_array($args['registry_ids']) ? $args['registry_ids'] : array();
	$core     = isset($args['core_ids']) && is_array($args['core_ids']) ? $args['core_ids'] : array();
	$type     = (string) ($args['type'] ?? '');
	$mark     = (string) ($args['mark'] ?? '');
	if ($id <= 0) {
		return array('ok' => false, 'reason' => 'invalid-id');
	}
	if (!wdp_e2e_run_id_ok($run_id)) {
		return array('ok' => false, 'reason' => 'bad-run-id');
	}
	$registry = array_map('intval', $registry);
	if (!$registry) {
		return array('ok' => false, 'reason' => 'empty-registry');
	}
	if (!in_array($id, $registry, true)) {
		return array('ok' => false, 'reason' => 'not-in-registry');
	}
	$core = array_map('intval', $core);
	if (in_array($id, $core, true)) {
		return array('ok' => false, 'reason' => 'core-blacklist');
	}
	if ($type === '' || in_array($type, wdp_e2e_blacklisted_types(), true)) {
		return array('ok' => false, 'reason' => 'type-blacklist');
	}
	if ($expected !== '' && $type !== $expected) {
		return array('ok' => false, 'reason' => 'type-mismatch');
	}
	if ($mark !== $run_id) {
		return array('ok' => false, 'reason' => 'unmarked');
	}
	$fixtures = isset($args['fixture_ids']) && is_array($args['fixture_ids']) ? array_map('intval', $args['fixture_ids']) : array();
	if ($fixtures && in_array($id, $fixtures, true) && empty($args['allow_fixtures'])) {
		return array('ok' => false, 'reason' => 'fixture-protected');
	}
	return array('ok' => true, 'reason' => '');
}

/**
 * @param array $args
 * @return array{ok:bool,reason:string}
 */
function wdp_e2e_evaluate_user_delete($args) {
	$id       = isset($args['id']) ? absint($args['id']) : 0;
	$run_id   = (string) ($args['run_id'] ?? '');
	$registry = isset($args['registry_ids']) && is_array($args['registry_ids']) ? $args['registry_ids'] : array();
	$email    = strtolower((string) ($args['email'] ?? ''));
	$mark     = (string) ($args['user_mark'] ?? '');
	$owned    = isset($args['owned']) && is_array($args['owned']) ? $args['owned'] : array();
	$comments = (int) ($args['comment_count'] ?? 0);
	$needle   = WDP_E2E_EMAIL_NEEDLE;
	if ($id <= 0) {
		return array('ok' => false, 'reason' => 'invalid-id');
	}
	if (!wdp_e2e_run_id_ok($run_id)) {
		return array('ok' => false, 'reason' => 'bad-run-id');
	}
	$registry = array_map('intval', $registry);
	if (!$registry) {
		return array('ok' => false, 'reason' => 'empty-registry');
	}
	if (!in_array($id, $registry, true)) {
		return array('ok' => false, 'reason' => 'not-in-registry');
	}
	if ($needle === '' || strpos($email, $needle) === false) {
		return array('ok' => false, 'reason' => 'email');
	}
	if ($mark !== $run_id) {
		return array('ok' => false, 'reason' => 'user-unmarked');
	}
	if ($comments > 0) {
		return array('ok' => false, 'reason' => 'user-has-comments');
	}
	if ($owned) {
		return array('ok' => false, 'reason' => 'user-has-content');
	}
	return array('ok' => true, 'reason' => '');
}

if (defined('WDP_E2E_CLEANUP_LIB_ONLY') && WDP_E2E_CLEANUP_LIB_ONLY) {
	return;
}

if (!function_exists('get_option')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}
$has_wc = function_exists('wc_get_orders');

const META_KEY     = '_wdp_e2e_test';
const EMAIL_NEEDLE = '@wdp-e2e.test';

$guard_id = function_exists('absint') ? absint(getenv('WDP_E2E_GUARD_ORDER_ID')) : 0;
$run_id   = (string) getenv('WDP_E2E_RUN_ID');

$registry_json = '';
$b64           = (string) getenv('WDP_E2E_REGISTRY_B64');
if ($b64 !== '') {
	$decoded = base64_decode($b64, true);
	if ($decoded !== false) {
		$registry_json = $decoded;
	}
}
$registry = json_decode($registry_json, true);
if (!is_array($registry)) {
	$registry = array();
}

/**
 * @return int[]
 */
function wdp_e2e_core_page_ids() {
	$ids = array(
		absint(get_option('page_on_front')),
		absint(get_option('page_for_posts')),
		absint(get_option('woocommerce_cart_page_id')),
		absint(get_option('woocommerce_checkout_page_id')),
		absint(get_option('woocommerce_myaccount_page_id')),
		absint(get_option('woocommerce_shop_page_id')),
		absint(get_option('woocommerce_terms_page_id')),
	);
	$success = get_option('wdp_success_settings');
	if (is_array($success)) {
		foreach ($success as $sv) {
			if (is_int($sv) || (is_string($sv) && $sv !== '' && ctype_digit($sv))) {
				$ids[] = absint($sv);
			}
		}
	}
	return array_values(array_unique(array_filter($ids)));
}

$fixture_ids = array();
$fx_raw      = (string) getenv('WDP_E2E_FIXTURE_IDS');
if ($fx_raw !== '') {
	foreach (explode(',', $fx_raw) as $piece) {
		$nid = absint($piece);
		if ($nid > 0) {
			$fixture_ids[] = $nid;
		}
	}
	$fixture_ids = array_values(array_unique($fixture_ids));
}

$order_ids   = wdp_e2e_registry_ids($registry, 'order');
$product_ids = wdp_e2e_registry_ids($registry, 'product');
$user_ids    = wdp_e2e_registry_ids($registry, 'user');
$post_ids    = wdp_e2e_registry_ids($registry, 'post');
$core_ids    = wdp_e2e_core_page_ids();
$failed      = array();

$empty_out = array(
	'orders_deleted'    => 0,
	'customers_deleted' => 0,
	'products_deleted'  => 0,
	'posts_deleted'     => 0,
	'guard_ok'          => true,
	'failed'            => array(),
	'message'           => 'hiçbir şey silinmedi',
);

if (!wdp_e2e_run_id_ok($run_id)) {
	$empty_out['skipped'] = 'bad-run-id';
	echo wp_json_encode($empty_out);
	return;
}

if (!$order_ids && !$product_ids && !$user_ids && !$post_ids) {
	$empty_out['skipped'] = 'empty-registry';
	echo wp_json_encode($empty_out);
	return;
}

$deleted_orders = array();
foreach ($has_wc ? $order_ids : array() as $oid) {
	if ($guard_id && $oid === $guard_id) {
		$failed[] = "guard order matched e2e meta: {$oid}";
		continue;
	}
	$order = wc_get_order($oid);
	if (!$order) {
		$failed[] = "missing order {$oid}";
		continue;
	}
	$mark = (string) $order->get_meta(META_KEY, true);
	if ($mark !== $run_id) {
		$failed[] = "order {$oid} unmarked; skipped";
		continue;
	}
	$email = strtolower((string) $order->get_billing_email());
	if (strpos($email, EMAIL_NEEDLE) === false) {
		$failed[] = "order {$oid} has e2e meta but email is not tagged; skipped";
		continue;
	}
	$ok = $order->delete(true);
	if ($ok === false) {
		$failed[] = "delete failed {$oid}";
		continue;
	}
	$deleted_orders[] = $oid;
}

$deleted_products = array();
foreach ($product_ids as $pid) {
	$post = get_post($pid);
	$type = $post ? (string) $post->post_type : '';
	$mark = (string) get_post_meta($pid, META_KEY, true);
	$g    = wdp_e2e_evaluate_delete(
		array(
			'id'            => $pid,
			'run_id'        => $run_id,
			'expected_type' => 'product',
			'registry_ids'  => $product_ids,
			'core_ids'      => $core_ids,
			'type'          => $type === 'product_variation' ? 'product' : $type,
			'mark'          => $mark,
			'fixture_ids'   => $fixture_ids,
		)
	);
	if (!$g['ok']) {
		$failed[] = "product {$pid} {$g['reason']}; skipped";
		continue;
	}
	if ($type !== 'product' && $type !== 'product_variation') {
		$failed[] = "product {$pid} type {$type}; skipped";
		continue;
	}
	$ok_del = wp_delete_post($pid, true);
	if (!$ok_del) {
		$failed[] = "product delete failed {$pid}";
		continue;
	}
	$deleted_products[] = $pid;
}

$deleted_posts = array();
foreach ($post_ids as $pid) {
	$post = get_post($pid);
	$type = $post ? (string) $post->post_type : '';
	$mark = (string) get_post_meta($pid, META_KEY, true);
	$g    = wdp_e2e_evaluate_delete(
		array(
			'id'            => $pid,
			'run_id'        => $run_id,
			'expected_type' => 'post',
			'registry_ids'  => $post_ids,
			'core_ids'      => $core_ids,
			'type'          => $type,
			'mark'          => $mark,
		)
	);
	if (!$g['ok']) {
		$failed[] = "post {$pid} {$g['reason']}; skipped";
		continue;
	}
	$ok_del = wp_delete_post($pid, true);
	if (!$ok_del) {
		$failed[] = "post delete failed {$pid}";
		continue;
	}
	$deleted_posts[] = $pid;
}

$deleted_customers = array();
foreach ($user_ids as $uid) {
	$u = get_userdata($uid);
	if (!$u) {
		$failed[] = "user {$uid} missing; skipped";
		continue;
	}
	$email = strtolower((string) $u->user_email);
	$mark  = (string) get_user_meta($uid, META_KEY, true);
	$owned = get_posts(
		array(
			'author'                 => $uid,
			'post_type'              => 'any',
			'post_status'            => 'any',
			'numberposts'            => -1,
			'suppress_filters'       => true,
			'update_post_meta_cache' => false,
			'update_post_term_cache' => false,
		)
	);
	$comment_count = (int) get_comments(
		array(
			'user_id' => $uid,
			'count'   => true,
			'status'  => 'all',
		)
	);
	$g = wdp_e2e_evaluate_user_delete(
		array(
			'id'            => $uid,
			'run_id'        => $run_id,
			'registry_ids'  => $user_ids,
			'email'         => $email,
			'user_mark'     => $mark,
			'owned'         => $owned,
			'comment_count' => $comment_count,
		)
	);
	if (!$g['ok']) {
		$failed[] = "user {$uid} {$g['reason']}; skipped";
		continue;
	}
	// Açık reassign kararı: içerik yok (yukarıda doğrulandı). Mevcut gerçek kullanıcıya atama YOK.
	// İkinci argüman null = içerik silinir; içerik zaten 0 olduğu için güvenli.
	$res = wp_delete_user($uid, null);
	if (!$res) {
		$failed[] = "customer delete failed {$uid}";
		continue;
	}
	$deleted_customers[] = $uid;
}

$guard_ok = true;
if ($guard_id && $has_wc) {
	$still    = wc_get_order($guard_id);
	$guard_ok = (bool) $still;
	if (!$guard_ok) {
		$failed[] = "guard order {$guard_id} missing after cleanup";
	}
}

$out = array(
	'orders_deleted'    => count($deleted_orders),
	'customers_deleted' => count($deleted_customers),
	'products_deleted'  => count($deleted_products),
	'posts_deleted'     => count($deleted_posts),
	'guard_ok'          => $guard_ok,
	'failed'            => $failed,
	'run_id'            => $run_id,
);
if (!$deleted_orders && !$deleted_customers && !$deleted_products && !$deleted_posts) {
	$out['message'] = 'hiçbir şey silinmedi';
}
echo wp_json_encode($out);
if (!empty($failed)) {
	exit(1);
}

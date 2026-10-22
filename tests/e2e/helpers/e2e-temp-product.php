<?php
/**
 * Yalnız _wdp_e2e_test=1 işaretli ürünler. Gerçek katalog ürünlerine dokunmaz.
 *
 *   wp eval-file tests/e2e/helpers/e2e-temp-product.php cleanup
 *   wp eval-file tests/e2e/helpers/e2e-temp-product.php create "WDP E2E Empty Price"
 *   wp eval-file tests/e2e/helpers/e2e-temp-product.php delete 123
 */
if (!function_exists('wc_get_product')) {
	fwrite(STDERR, "woocommerce missing\n");
	exit(1);
}

const META_KEY = '_wdp_e2e_test';
$run_id = (string) getenv('WDP_E2E_RUN_ID');
$action = isset($args[0]) ? sanitize_key((string) $args[0]) : 'cleanup';
if ($run_id === '' || $run_id === '1') {
	fwrite(STDERR, "bad-run-id\n");
	exit(1);
}

if ($action === 'create') {
	$title = isset($args[1]) ? sanitize_text_field((string) $args[1]) : 'WDP E2E Empty Price';
	$p     = new WC_Product_Simple();
	$p->set_name($title);
	$p->set_status('private');
	$p->set_catalog_visibility('hidden');
	$p->set_regular_price('');
	$p->set_price('');
	$p->set_virtual(true);
	$p->update_meta_data('_allow_custom_price', 'yes');
	$p->update_meta_data('_min_custom_price', '5');
	$p->update_meta_data(META_KEY, $run_id);
	$p->update_meta_data('_wdp_donation_product', 'yes');
	$id = $p->save();
	if (!$id) {
		fwrite(STDERR, "create-failed\n");
		exit(1);
	}
	echo wp_json_encode(
		array(
			'id'   => (int) $id,
			'url'  => get_permalink($id),
			'slug' => (string) $p->get_slug(),
		)
	);
	return;
}

if ($action === 'delete') {
	$id = isset($args[1]) ? absint($args[1]) : 0;
	if ($id <= 0) {
		fwrite(STDERR, "invalid-id\n");
		exit(1);
	}
	if ((string) get_post_meta($id, META_KEY, true) !== $run_id) {
		fwrite(STDERR, "not-marked\n");
		exit(1);
	}
	$ok = wp_delete_post($id, true);
	if (!$ok) {
		fwrite(STDERR, "delete-failed\n");
		exit(1);
	}
	echo wp_json_encode(array('deleted' => $id));
	return;
}

$b64      = (string) getenv('WDP_E2E_REGISTRY_B64');
$decoded  = $b64 !== '' ? base64_decode($b64, true) : false;
$registry = is_string($decoded) ? json_decode($decoded, true) : array();
$want     = array();
foreach ((array) $registry as $row) {
	if (!is_array($row) || (string) ($row['type'] ?? '') !== 'product') {
		continue;
	}
	$id = absint($row['id'] ?? 0);
	if ($id > 0) {
		$want[] = $id;
	}
}
$want    = array_values(array_unique($want));
$deleted = array();
$failed  = array();
if (!$want) {
	echo wp_json_encode(
		array(
			'products_deleted' => 0,
			'failed'           => array(),
			'message'          => 'hiçbir şey silinmedi',
			'skipped'          => 'empty-registry',
		)
	);
	return;
}
foreach ($want as $pid) {
	if (get_post_type($pid) === 'page') {
		$failed[] = 'page-' . $pid;
		continue;
	}
	if ((string) get_post_meta($pid, META_KEY, true) !== $run_id) {
		$failed[] = 'unmarked-' . $pid;
		continue;
	}
	if (!wp_delete_post($pid, true)) {
		$failed[] = 'del-' . $pid;
		continue;
	}
	$deleted[] = $pid;
}
echo wp_json_encode(
	array(
		'products_deleted' => count($deleted),
		'failed'           => $failed,
	)
);
if (!empty($failed)) {
	exit(1);
}

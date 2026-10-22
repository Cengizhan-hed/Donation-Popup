<?php
/**
 * İşaretli, gizli test ürünleri. Sayfa/menü/kategori/görsel/site ayarı yok.
 *
 *   wp eval-file tests/e2e/helpers/bootstrap-e2e-products.php upsert
 *   wp eval-file tests/e2e/helpers/bootstrap-e2e-products.php remove
 *
 * WDP_E2E_RUN_ID = kayıt defteri run_id (sabit "1" değil).
 */
if (!function_exists('get_option')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}

const META_KEY = '_wdp_e2e_test';
$run_id = (string) getenv('WDP_E2E_RUN_ID');
if ($run_id === '' && isset($args[1])) {
	$run_id = sanitize_text_field((string) $args[1]);
}
$action = isset($args[0]) ? sanitize_key((string) $args[0]) : 'upsert';
if ($run_id === '' || $run_id === '1' || !preg_match('/^[A-Za-z0-9._:-]{4,80}$/', $run_id)) {
	fwrite(STDERR, "bad-run-id\n");
	exit(1);
}

$catalog = array(
	'custom'       => array(
		'WDP E2E Custom',
		array(
			'_allow_custom_price'   => 'yes',
			'_min_custom_price'     => '10',
			'_wdp_donation_product' => 'yes',
			'_regular_price'        => '',
			'_price'                => '',
		),
	),
	'fixed'        => array(
		'WDP E2E Fixed',
		array(
			'_wdp_donation_product' => 'yes',
			'_regular_price'        => '100',
			'_price'                => '100',
		),
	),
	'shares'       => array(
		'WDP E2E Shares',
		array(
			'_wdp_donation_product'   => 'yes',
			'_allow_multiple_shares'  => 'yes',
			'_max_shares'             => '7',
			'_regular_price'          => '1400',
			'_price'                  => '1400',
		),
	),
	'campaign'     => array(
		'WDP E2E Campaign',
		array(
			'_wdp_donation_product'       => 'yes',
			'_enable_progress_bar'        => 'yes',
			'_progress_bar_limit'         => '500',
			'_wdp_total_donation_amount'  => '100',
			'_goal_reached_action'        => 'continue',
			'_regular_price'              => '50',
			'_price'                      => '50',
		),
	),
	'sadaka'       => array(
		'WDP E2E Sadaka',
		array(
			'_wdp_donation_product' => 'yes',
			'_allow_custom_price'   => 'yes',
			'_min_custom_price'     => '10',
			'_regular_price'        => '',
			'_price'                => '',
		),
	),
	'goal-reached' => array(
		'WDP E2E Goal Reached',
		array(
			'_wdp_donation_product'      => 'yes',
			'_enable_progress_bar'       => 'yes',
			'_progress_bar_limit'        => '100',
			'_wdp_total_donation_amount' => '100',
			'_goal_reached_action'       => 'message',
			'_regular_price'             => '25',
			'_price'                     => '25',
		),
	),
	'empty-price'  => array(
		'WDP E2E Empty Price',
		array(
			'_wdp_donation_product' => 'yes',
			'_allow_custom_price'   => 'yes',
			'_min_custom_price'     => '5',
			'_regular_price'        => '',
			'_price'                => '',
		),
	),
);

function wdp_boot_find_product($title, $run_id) {
	$found = get_posts(
		array(
			'post_type'        => post_type_exists('product') ? 'product' : 'post',
			'post_status'      => 'any',
			'title'            => $title,
			'numberposts'      => 5,
			'meta_key'         => META_KEY,
			'meta_value'       => $run_id,
			'suppress_filters' => true,
		)
	);
	return $found ? (int) $found[0]->ID : 0;
}

$roles   = array();
$created = array();
$removed = array();
$skipped = array();

if ($action === 'remove') {
	foreach ($catalog as $role => $row) {
		$id = wdp_boot_find_product($row[0], $run_id);
		if (!$id) {
			$skipped[] = $role;
			continue;
		}
		if ((string) get_post_meta($id, META_KEY, true) !== $run_id) {
			$skipped[] = $role . ':unmarked';
			continue;
		}
		if (get_post_type($id) === 'page') {
			$skipped[] = $role . ':page';
			continue;
		}
		wp_delete_post($id, true);
		$removed[] = array( 'role' => $role, 'id' => $id );
	}
	echo wp_json_encode(
		array(
			'runId'   => $run_id,
			'roles'   => (object) array(),
			'removed' => $removed,
			'skipped' => $skipped,
			'created' => array(),
		)
	);
	return;
}

foreach ($catalog as $role => $row) {
	$title = $row[0];
	$id    = wdp_boot_find_product($title, $run_id);
	if ($id) {
		$skipped[] = $role . ':exists';
	} else {
		if (class_exists('WC_Product_Simple')) {
			$p = new WC_Product_Simple();
			$p->set_name($title);
			$p->set_status('private');
			$p->set_catalog_visibility('hidden');
			$p->set_virtual(true);
			$p->update_meta_data(META_KEY, $run_id);
			$p->update_meta_data('_visibility', 'hidden');
			foreach ($row[1] as $k => $v) {
				if ($k === '_regular_price') {
					$p->set_regular_price($v);
					continue;
				}
				if ($k === '_price') {
					$p->set_price($v);
					continue;
				}
				$p->update_meta_data($k, $v);
			}
			$id = $p->save();
			if (!$id) {
				fwrite(STDERR, "create-failed {$role}\n");
				exit(1);
			}
			$id = (int) $id;
		} else {
			$type = post_type_exists('product') ? 'product' : 'post';
			$id   = wp_insert_post(
				array(
					'post_title'  => $title,
					'post_status' => 'private',
					'post_type'   => $type,
					'post_name'   => sanitize_title($title),
				),
				true
			);
			if (is_wp_error($id) || !$id) {
				fwrite(STDERR, "create-failed {$role}\n");
				exit(1);
			}
			$id = (int) $id;
			update_post_meta($id, META_KEY, $run_id);
			update_post_meta($id, '_visibility', 'hidden');
			foreach ($row[1] as $k => $v) {
				update_post_meta($id, $k, $v);
			}
		}
		$created[] = array( 'role' => $role, 'id' => $id, 'type' => get_post_type($id) ?: 'product' );
	}
	$permalink = get_permalink($id);
	$path      = '';
	if ($permalink) {
		$u    = wp_parse_url($permalink);
		$path = isset($u['path']) ? $u['path'] : '';
	}
	$roles[ $role ] = array(
		'id'   => (int) $id,
		'name' => $title,
		'slug' => get_post_field('post_name', $id),
		'url'  => $permalink,
		'path' => $path,
		'mark' => $run_id,
	);
}

echo wp_json_encode(
	array(
		'runId'   => $run_id,
		'roles'   => $roles,
		'created' => $created,
		'skipped' => $skipped,
		'removed' => array(),
	)
);

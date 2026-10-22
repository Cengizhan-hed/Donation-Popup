<?php
/**
 * Yerel WP fixture ürünleri. Sayfa/menü/ayar/kullanıcı yok.
 *
 *   php tests/local-wp/bootstrap-fixtures.php upsert local fixture
 *   php tests/local-wp/bootstrap-fixtures.php remove local fixture
 */
$root = dirname(__DIR__, 2);
$wp_dir = $root . '/build/local-wp/wordpress';
if (empty($_SERVER['HTTP_HOST'])) {
	$_SERVER['HTTP_HOST']   = '127.0.0.1';
	$_SERVER['SERVER_NAME'] = '127.0.0.1';
	$_SERVER['REQUEST_URI'] = '/';
}
require $wp_dir . '/wp-load.php';

$action = isset($argv[1]) ? $argv[1] : 'upsert';
$env_id = isset($argv[2]) ? $argv[2] : 'local';
$run_id = isset($argv[3]) ? $argv[3] : 'fixture';
$meta   = '_wdp_e2e_test';

$catalog = array(
	'custom'       => array( 'WDP E2E Custom', array( '_allow_custom_price' => 'yes', '_min_custom_price' => '10', '_wdp_donation_product' => 'yes' ) ),
	'fixed'        => array( 'WDP E2E Fixed', array( '_wdp_donation_product' => 'yes', '_regular_price' => '100', '_price' => '100' ) ),
	'shares'       => array( 'WDP E2E Shares', array( '_wdp_donation_product' => 'yes', '_allow_multiple_shares' => 'yes', '_max_shares' => '7' ) ),
	'campaign'     => array( 'WDP E2E Campaign', array( '_wdp_donation_product' => 'yes', '_enable_progress_bar' => 'yes', '_progress_bar_limit' => '500' ) ),
	'sadaka'       => array( 'WDP E2E Sadaka', array( '_allow_custom_price' => 'yes', '_min_custom_price' => '10' ) ),
	'goal-reached' => array( 'WDP E2E Goal Reached', array( '_enable_progress_bar' => 'yes', '_progress_bar_limit' => '100', '_wdp_total_donation_amount' => '100' ) ),
	'empty-price'  => array( 'WDP E2E Empty Price', array( '_allow_custom_price' => 'yes', '_min_custom_price' => '5' ) ),
);

function wdp_local_fixture_post_type() {
	return post_type_exists('product') ? 'product' : 'post';
}

function wdp_local_find_fixture($title, $meta, $run_id) {
	$found = get_posts(
		array(
			'post_type'              => wdp_local_fixture_post_type(),
			'post_status'            => 'any',
			'title'                  => $title,
			'numberposts'            => 5,
			'meta_key'               => $meta,
			'meta_value'             => $run_id,
			'suppress_filters'       => true,
		)
	);
	return $found ? (int) $found[0]->ID : 0;
}

$roles   = array();
$created = array();
$removed = array();
$skipped = array();

if ($action === 'remove') {
	$remove_ids_raw = (string) getenv('WDP_E2E_REMOVE_IDS');
	$remove_by_id   = array();
	if ($remove_ids_raw !== '') {
		foreach (explode(',', $remove_ids_raw) as $piece) {
			$nid = absint($piece);
			if ($nid > 0) {
				$remove_by_id[] = $nid;
			}
		}
		$remove_by_id = array_values(array_unique($remove_by_id));
	}
	if ($remove_by_id) {
		foreach ($remove_by_id as $id) {
			$post = get_post($id);
			if (!$post) {
				$skipped[] = 'id:' . $id . ':missing';
				continue;
			}
			if ((string) get_post_meta($id, $meta, true) !== $run_id) {
				$skipped[] = 'id:' . $id . ':unmarked';
				continue;
			}
			if (get_post_type($id) === 'page') {
				$skipped[] = 'id:' . $id . ':page';
				continue;
			}
			wp_delete_post($id, true);
			$removed[] = array( 'role' => '', 'id' => $id );
		}
	} else {
		foreach ($catalog as $role => $row) {
			$id = wdp_local_find_fixture($row[0], $meta, $run_id);
			if (!$id) {
				$skipped[] = $role;
				continue;
			}
			if ((string) get_post_meta($id, $meta, true) !== $run_id) {
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
	}
	echo wp_json_encode(
		array(
			'env'     => $env_id,
			'runId'   => $run_id,
			'roles'   => (object) array(),
			'removed' => $removed,
			'skipped' => $skipped,
		)
	);
	return;
}

foreach ($catalog as $role => $row) {
	$title = $row[0];
	$id    = wdp_local_find_fixture($title, $meta, $run_id);
	if ($id) {
		$skipped[] = $role . ':exists';
	} else {
		$type = wdp_local_fixture_post_type();
		$id = wp_insert_post(
			array(
				'post_title'  => $title,
				'post_status' => 'private',
				'post_type'   => $type,
				'post_name'   => sanitize_title($title),
			),
			true
		);
		if (is_wp_error($id) || !$id) {
			fwrite(STDERR, "create failed {$role}\n");
			exit(1);
		}
		$id = (int) $id;
		update_post_meta($id, $meta, $run_id);
		update_post_meta($id, '_visibility', 'hidden');
		foreach ($row[1] as $k => $v) {
			update_post_meta($id, $k, $v);
		}
		if ($type === 'product' && function_exists('wc_get_product')) {
			$p = wc_get_product($id);
			if ($p) {
				$p->set_catalog_visibility('hidden');
				$p->set_status('private');
				$p->save();
			}
		}
		$created[] = array( 'role' => $role, 'id' => $id );
	}
	$permalink = get_permalink($id);
	$path      = '';
	if (is_string($permalink) && $permalink !== '') {
		$u     = function_exists('wp_parse_url') ? wp_parse_url($permalink) : parse_url($permalink);
		$ppath = is_array($u) && !empty($u['path']) ? $u['path'] : '/';
		$query = is_array($u) && !empty($u['query']) ? '?' . $u['query'] : '';
		$path  = $ppath . $query;
	}
	if ($path === '' || $path === '/') {
		$path = '/?post_type=product&p=' . (int) $id;
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
		'env'     => $env_id,
		'runId'   => $run_id,
		'roles'   => $roles,
		'created' => $created,
		'skipped' => $skipped,
		'removed' => array(),
	)
);

<?php
/**
 * Yalnız yerel e2e (E8M): görünürlük durumlarına göre işaretli bağış test ürünleri oluşturur / siler.
 *
 *   php tests/local-wp/eval-file.php tests/e2e/helpers/wdp-visibility-states.php create
 *   php tests/local-wp/eval-file.php tests/e2e/helpers/wdp-visibility-states.php delete
 *
 * Yalnız `_wdp_e2e_vis` işaretli kendi kayıtlarını siler.
 */
if (!function_exists('get_posts') || !class_exists('WC_Product_Simple')) {
	fwrite(STDERR, "wordpress/woocommerce missing\n");
	exit(1);
}
$args   = isset($wdp_eval_args) && is_array($wdp_eval_args) ? $wdp_eval_args : array_slice($argv, 2);
$action = isset($args[0]) ? (string) $args[0] : 'create';

$existing = get_posts(
	array(
		'post_type'      => 'product',
		'post_status'    => 'any',
		'meta_key'       => '_wdp_e2e_vis',
		'posts_per_page' => -1,
		'fields'         => 'ids',
	)
);
foreach ($existing as $old) {
	wp_delete_post((int) $old, true);
}
if ('delete' === $action) {
	echo wp_json_encode(array( 'ok' => true, 'deleted' => count($existing) ));
	exit(0);
}

$make = static function (string $label, string $status, string $visibility, string $password = ''): int {
	$p = new WC_Product_Simple();
	$p->set_name('WDP E2E Vis ' . $label);
	$p->set_status($status);
	$p->set_catalog_visibility($visibility);
	$p->set_regular_price('10');
	$id = (int) $p->save();
	update_post_meta($id, '_wdp_e2e_vis', $label);
	update_post_meta($id, '_wdp_e2e_test', '1');
	update_post_meta($id, '_wdp_donation_product', 'yes');
	if ('' !== $password) {
		wp_update_post(array( 'ID' => $id, 'post_password' => $password ));
	}
	return $id;
};

echo wp_json_encode(
	array(
		'ok'       => true,
		'visible'  => $make('visible', 'publish', 'visible'),
		'hidden'   => $make('hidden', 'publish', 'hidden'),
		'draft'    => $make('draft', 'draft', 'visible'),
		'private'  => $make('private', 'private', 'visible'),
		'password' => $make('password', 'publish', 'visible', 'sifre123'),
	)
);

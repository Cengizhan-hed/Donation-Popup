<?php
/**
 * Yalnız yerel e2e (tek kullanımlık işçi WP): gömülü kart formu paketi yetki sızıntısı denetimi.
 * Yönetici oturumunda döngü paketi üretilir (önbelleğe yazılır), sonra anonim çizimde aynı önbellek okunur: gizli
 * (özel/taslak/şifreli) ürünün formu iki çıktıda da YOK, herkese açık ürününki VAR. Ürün durumları sonunda geri alınır.
 *
 *   php tests/local-wp/eval-file.php tests/e2e/helpers/wdp-card-forms-private.php <publicId> <privateId> <draftId> <passwordId>
 */
use DonationPanel\Modules\EntryPoints\Card_Forms;

$args = isset($wdp_eval_args) && is_array($wdp_eval_args) ? array_map('absint', $wdp_eval_args) : array();
list($public, $private, $draft, $locked) = array_pad($args, 4, 0);
$restore = array();
foreach (array($private => 'private', $draft => 'draft', $locked => 'publish') as $id => $status) {
	$post            = get_post($id);
	$restore[ $id ] = array('post_status' => $post->post_status, 'post_password' => $post->post_password);
	wp_update_post(array('ID' => $id, 'post_status' => $status, 'post_password' => $id === $locked ? 'gizli' : ''));
}
$admins = get_users(array('role' => 'administrator', 'number' => 1, 'fields' => 'ID'));
$ids    = array($public, $private, $draft, $locked);
$render = static function () use ($ids) {
	Card_Forms::reset_for_tests();
	foreach ($ids as $id) {
		Card_Forms::add($id, 'side_panel');
	}
	ob_start();
	Card_Forms::print_footer();
	$html = (string) ob_get_clean();
	$out  = array();
	if (preg_match_all('#<script type="application/json" data-dp-forms>(.*?)</script>#s', $html, $m)) {
		foreach ($m[1] as $json) {
			$data = json_decode($json, true);
			$out  = array_merge($out, array_map('intval', array_keys((array) $data['f'])));
		}
	}
	return $out;
};
wp_set_current_user((int) ($admins[0] ?? 1));
$as_admin = $render();
wp_set_current_user(0);
$as_guest = $render();
foreach ($restore as $id => $data) {
	wp_update_post(array_merge(array('ID' => $id), $data));
}
echo wp_json_encode(array('ok' => true, 'admin' => $as_admin, 'guest' => $as_guest, 'admin_is_admin' => !empty($admins)));

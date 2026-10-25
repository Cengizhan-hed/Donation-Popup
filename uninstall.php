<?php
/**
 * Eklenti kaldırma: yalnızca "Eklenti kaldırılınca verileri sil" açıksa ürün ayarları ve eklenti seçenekleri silinir.
 *
 * Siparişlere, sipariş kayıtlarına ve HPOS meta'sına asla dokunulmaz.
 * Gate: option wdp_delete_data_on_uninstall (WDP_Uninstall::cleanup_site).
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

require_once __DIR__ . '/includes/class-uninstall.php';

if ( is_multisite() && function_exists( 'get_sites' ) ) {
	$wdp_site_ids = get_sites(
		array(
			'fields' => 'ids',
			'number' => 0,
		)
	);
	foreach ( $wdp_site_ids as $wdp_site_id ) {
		switch_to_blog( (int) $wdp_site_id );
		WDP_Uninstall::cleanup_site();
		restore_current_blog();
	}
} else {
	WDP_Uninstall::cleanup_site();
}

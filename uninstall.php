<?php
/**
 * Eklenti kaldırma: yalnızca "Eklenti kaldırılınca tüm verilerini sil" açıksa wdp_ ayarlarını, transient'leri ve ürün meta verilerini siler.
 *
 * Siparişlerdeki bağış verilerine (sipariş satırı meta, sipariş meta) asla dokunulmaz.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
	exit;
}

/**
 * Remove plugin data for the current site.
 *
 * @return void
 */
function wdp_uninstall_cleanup_site() {
	global $wpdb;

	if ('1' !== (string) get_option('wdp_delete_data_on_uninstall', '0')) {
		return;
	}

	// Options: wdp_*.
	$wpdb->query(
		$wpdb->prepare(
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
			$wpdb->esc_like('wdp_') . '%'
		)
	);

	// Transients: _transient_wdp_* / _transient_timeout_wdp_*.
	$wpdb->query(
		$wpdb->prepare(
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
			$wpdb->esc_like('_transient_wdp_') . '%',
			$wpdb->esc_like('_transient_timeout_wdp_') . '%'
		)
	);

	// Product meta only (wdp_* and _wdp_*); order posts are excluded by post type.
	$wpdb->query(
		$wpdb->prepare(
			"DELETE pm FROM {$wpdb->postmeta} pm
			INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
			WHERE p.post_type IN ('product', 'product_variation')
			AND (pm.meta_key LIKE %s OR pm.meta_key LIKE %s)",
			$wpdb->esc_like('wdp_') . '%',
			$wpdb->esc_like('_wdp_') . '%'
		)
	);

	wp_cache_delete('alloptions', 'options');
	wp_cache_delete('notoptions', 'options');
	if (function_exists('wp_cache_flush_group')) {
		wp_cache_flush_group('wdp_donations');
		wp_cache_flush_group('wdp_product_info');
		wp_cache_flush_group('wdp_products');
	}
}

if (is_multisite() && function_exists('get_sites')) {
	$wdp_site_ids = get_sites(array('fields' => 'ids', 'number' => 0));
	foreach ($wdp_site_ids as $wdp_site_id) {
		switch_to_blog((int) $wdp_site_id);
		wdp_uninstall_cleanup_site();
		restore_current_blog();
	}
} else {
	wdp_uninstall_cleanup_site();
}

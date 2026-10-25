<?php
/**
 * Yalnız yerel e2e (E7 yönetici deneyimi): yeni yönetici ekranını açar, test amaçlı oturum uç noktaları ve durum okuma sunar.
 * Yalnız yerel WP işçisine kopyalanır; üretime/uzak siteye ASLA gitmez. Tema/oluşturucu adı yok.
 *
 *   /?dp_ad_login=1&role=administrator|subscriber  -> test kullanıcısı olarak oturum açar (JSON)
 *   /?dp_ad_state=1                                 -> Core ayarları + eski `wdp_*` seçeneklerinin özeti + ürün sayısı (JSON)
 *   /?dp_ad_reset=1&ui=new|legacy                   -> Core ayar kaydını sıfırlar (admin.ui verilen değer)
 *   çerez dp_ad_rtl=1                               -> yönetim arayüzü RTL
 */
/**
 * Core ayar kaydını sıfırlar (yalnız yerel test işçisi; sil + ekle).
 *
 * @param string $ui admin.ui değeri.
 * @return void
 */
function wdp_ad_write_settings( $ui ) {
	delete_option( 'donation_panel_settings' );
	add_option( 'donation_panel_settings', array( 'version' => 1, 'admin' => array( 'ui' => $ui ) ), '', false );
}

add_action(
	'init',
	static function () {
		if ( ! empty( $_COOKIE['dp_ad_rtl'] ) ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
			global $wp_locale;
			if ( is_object( $wp_locale ) ) {
				$wp_locale->text_direction = 'rtl';
			}
		}
		if ( false === get_option( 'dp_e7_seeded', false ) ) {
			wdp_ad_write_settings( 'new' );
			add_option( 'dp_e7_seeded', '1' );
		}
	},
	1
);

/**
 * Eski `wdp_*` seçeneklerinin özeti (değer yazmaz; yalnız ad -> hash).
 *
 * @return array<string, string>
 */
function wdp_ad_legacy_hashes() {
	global $wpdb;
	$names = $wpdb->get_col( "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE 'wdp\\_%' AND option_name NOT LIKE 'wdp\\_cache%' ORDER BY option_name" ); // phpcs:ignore
	$out   = array();
	foreach ( (array) $names as $name ) {
		$out[ $name ] = md5( wp_json_encode( get_option( $name ) ) );
	}
	return $out;
}

add_action(
	'init',
	static function () {
		// phpcs:disable WordPress.Security.NonceVerification
		if ( isset( $_GET['dp_ad_login'] ) ) {
			nocache_headers();
			$role = isset( $_GET['role'] ) && 'subscriber' === $_GET['role'] ? 'subscriber' : 'administrator';
			$name = 'dp_e7_' . $role;
			$uid  = username_exists( $name );
			if ( ! $uid ) {
				$uid = wp_create_user( $name, wp_generate_password( 24 ), $name . '@example.test' );
				( new WP_User( $uid ) )->set_role( $role );
			}
			wp_set_current_user( $uid );
			wp_set_auth_cookie( $uid, true );
			wp_send_json( array( 'ok' => true, 'role' => $role ) );
		}
		if ( isset( $_GET['dp_ad_reset'] ) ) {
			nocache_headers();
			$ui = isset( $_GET['ui'] ) && 'legacy' === $_GET['ui'] ? 'legacy' : 'new';
			wdp_ad_write_settings( $ui );
			wp_send_json( array( 'ok' => true, 'ui' => $ui ) );
		}
		if ( isset( $_GET['dp_ad_state'] ) ) {
			nocache_headers();
			$count = wp_count_posts( 'product' );
			wp_send_json(
				array(
					'settings' => get_option( 'donation_panel_settings', array() ),
					'legacy'   => wdp_ad_legacy_hashes(),
					'products' => (int) array_sum( array_map( 'intval', (array) $count ) ),
				)
			);
		}
		// phpcs:enable
	},
	2
);

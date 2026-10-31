<?php
/**
 * Yalnız yerel e2e (E7 yönetici deneyimi): yeni yönetici ekranını açar, test amaçlı oturum uç noktaları ve durum okuma sunar.
 * Yalnız yerel WP işçisine kopyalanır; üretime/uzak siteye ASLA gitmez. Tema/oluşturucu adı yok.
 *
 *   /?dp_ad_login=1&role=administrator|subscriber  -> test kullanıcısı olarak oturum açar (JSON)
 *   /?dp_ad_state=1                                 -> Core ayarları + eski `wdp_*` seçeneklerinin özeti + ürün sayısı (JSON)
 *   /?dp_ad_meta=<ürün>&keys=a,b                    -> bir ürünün `_enable_*`/`_wdp_*` vb. meta değerleri (yalnız okur; JSON)
 *   /?dp_ad_reset=1                                 -> Core ayar kaydını varsayılana sıfırlar
 *   çerez dp_ad_rtl=1                               -> yönetim arayüzü RTL
 */
/**
 * Core ayar kaydını sıfırlar (yalnız yerel test işçisi; sil + ekle).
 *
 * @param string $ui admin.ui değeri.
 * @return void
 */
function wdp_ad_write_settings() {
	delete_option( 'donation_panel_settings' );
	add_option( 'donation_panel_settings', array( 'version' => 1 ), '', false );
}

/**
 * Renk kaynağı senaryosu (yalnız yerel test işçisi): `dp_ad_palette_mode` = none | good ise tema paletini tümüyle
 * değiştirir (none: palet yok; good: iyi kontrastlı iki renk). Seçenek yoksa tema olduğu gibi kalır.
 */
add_filter(
	'wp_theme_json_data_theme',
	static function ( $data ) {
		$mode = get_option( 'dp_ad_palette_mode', '' );
		if ( 'none' === $mode ) {
			return new WP_Theme_JSON_Data( array( 'version' => 2 ), 'theme' );
		}
		if ( 'good' === $mode ) {
			return new WP_Theme_JSON_Data(
				array(
					'version'  => 2,
					'settings' => array(
						'color' => array(
							'palette' => array(
								array( 'slug' => 'primary', 'name' => 'Primary', 'color' => '#1d3557' ),
								array( 'slug' => 'accent', 'name' => 'Accent', 'color' => '#e63946' ),
							),
						),
					),
				),
				'theme'
			);
		}
		// 12.3: palet VAR ama rol adı yok (sayfa oluşturucu temaları gibi; canlı kırmızı bir renk dahil) ya da numaralı
		// "palette-color-N" (bazı temalarda olduğu gibi). İkisinde de tahmin yok: nötr varsayılan + uyarı beklenir.
		$roleless = array(
			'roleless' => array( array( 'color1', 'Color 1', '#ffffff' ), array( 'color2', 'Color 2', '#f9f9fb' ), array( 'color3', 'Color 3', '#e2201c' ), array( 'color4', 'Color 4', '#65bc7b' ), array( 'color8', 'Color 8', '#212934' ) ),
			'numbered' => array( array( 'palette-color-1', 'Palette Color 1', '#2872fa' ), array( 'palette-color-2', 'Palette Color 2', '#1559ed' ), array( 'palette-color-3', 'Palette Color 3', '#3a4f66' ), array( 'palette-color-8', 'Palette Color 8', '#ffffff' ) ),
		);
		if ( isset( $roleless[ $mode ] ) ) {
			$rows = array();
			foreach ( $roleless[ $mode ] as $row ) {
				$rows[] = array(
					'slug'  => $row[0],
					'name'  => $row[1],
					'color' => $row[2],
				);
			}
			return new WP_Theme_JSON_Data(
				array(
					'version'  => 2,
					'settings' => array( 'color' => array( 'palette' => $rows ) ),
				),
				'theme'
			);
		}
		return $data;
	}
);
add_action(
	'after_setup_theme',
	static function () {
		if ( 'none' === get_option( 'dp_ad_palette_mode', '' ) ) {
			remove_theme_support( 'editor-color-palette' );
		}
	},
	99
);

/**
 * Renk değişkeni senaryosu (yalnız yerel test işçisi; 12.2 colorvar): `dp_ad_css_vars` = 1 ise ön yüzde (yönetici
 * ekranında DEĞİL) bir tema/sayfa oluşturucunun yapacağı gibi `:root` üzerinde test renk değişkenlerini tanımlar.
 */
add_action(
	'wp_head',
	static function () {
		if ( '1' === (string) get_option( 'dp_ad_css_vars', '' ) ) {
			echo '<style id="dp-ad-css-vars">:root{--test-brand:#ffd60a;--test-ink:#123456}</style>' . "\n";
		}
	},
	1
);

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
			wdp_ad_write_settings();
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
			wdp_ad_write_settings();
			// E8Q: "yeni ekranı dene" kutusunun kapatma işaretini de sıfırlar (yalnız yerel test işçisi).
			delete_metadata( 'user', 0, 'donation_panel_ui_notice_dismissed', '', true );
			wp_send_json( array( 'ok' => true ) );
		}
		if ( isset( $_GET['dp_ad_opt'] ) ) {
			// Yalnız yerel test işçisi (uzak siteye gitmez): dar bir izin listesindeki yerel örnek seçeneklerini ayarlar/siler.
			nocache_headers();
			$allowed = array( 'woocommerce_enable_guest_checkout', 'woocommerce_enable_myaccount_registration', 'wp_page_for_privacy_policy', 'wdp_button_settings', 'wdp_placement_settings', 'wdp_delete_data_on_uninstall', 'dp_ad_palette_mode', 'dp_ad_css_vars' );
			$name   = sanitize_key( (string) $_GET['dp_ad_opt'] );
			if ( ! in_array( $name, $allowed, true ) ) {
				wp_send_json( array( 'ok' => false ), 400 );
			}
			if ( isset( $_GET['del'] ) ) {
				delete_option( $name );
			} else {
				$raw = isset( $_GET['val'] ) ? wp_unslash( (string) $_GET['val'] ) : '';
				$dec = json_decode( $raw, true );
				update_option( $name, null === $dec ? $raw : $dec );
			}
			wp_send_json( array( 'ok' => true, 'value' => get_option( $name, null ) ) );
		}
		if ( isset( $_GET['dp_ad_meta'] ) ) {
			// Yalnız okur: ürün sekmesinin yazdığı meta anahtarları (kayıt doğrulaması için).
			nocache_headers();
			$pid  = absint( $_GET['dp_ad_meta'] );
			$keys = isset( $_GET['keys'] ) ? array_filter( array_map( 'trim', explode( ',', wp_unslash( (string) $_GET['keys'] ) ) ) ) : array();
			$out  = array();
			foreach ( $keys as $key ) {
				if ( preg_match( '/^_(wdp_|enable_|allow_|min_|max_|progress_|goal_|amount_|cover_|dedication_|addon_|theme_|trust_|layout_)[a-z_]*$/', $key ) ) {
					$out[ $key ] = get_post_meta( $pid, $key, true );
				}
			}
			wp_send_json( $out );
		}
		if ( isset( $_GET['dp_ad_state'] ) ) {
			nocache_headers();
			$count = wp_count_posts( 'product' );
			wp_send_json(
				array(
					'settings' => get_option( 'donation_panel_settings', array() ),
					'options'  => array(
						'button'    => get_option( 'wdp_button_settings', null ),
						'placement' => get_option( 'wdp_placement_settings', null ),
						'delete'    => get_option( 'wdp_delete_data_on_uninstall', null ),
					),
					'legacy'   => wdp_ad_legacy_hashes(),
					'products' => (int) array_sum( array_map( 'intval', (array) $count ) ),
				)
			);
		}
		// phpcs:enable
	},
	2
);

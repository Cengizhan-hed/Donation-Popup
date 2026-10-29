<?php
/**
 * Yalnız yerel ölçüm (tek kullanımlık işçi veritabanı): sayfa içi form, compact kart, popup / sağ panel / alttan panel sayfaları.
 * Girdi: wp-content/wdp-perf-pages.json {"product_id": N}. Çıktı: wp-content/wdp-perf-pages-urls.json.
 * Kısa kod dışa açık sözleşmedir (`[wdp_donation_form id layout]`); `layout="compact"` desteklenmiyorsa bugünkü form çizilir.
 * Tema/sayfa oluşturucu adı yok.
 */
add_action(
	'wp_loaded',
	static function () {
		$out = WP_CONTENT_DIR . '/wdp-perf-pages-urls.json';
		$in  = json_decode( (string) @file_get_contents( WP_CONTENT_DIR . '/wdp-perf-pages.json' ), true );
		if ( file_exists( $out ) || ! is_array( $in ) || empty( $in['product_id'] ) ) {
			return;
		}
		$id    = (int) $in['product_id'];
		$path  = static function ( $url ) {
			$p = wp_parse_url( (string) $url );
			return ( isset( $p['path'] ) ? $p['path'] : '/' ) . ( isset( $p['query'] ) ? '?' . $p['query'] : '' );
		};
		$pages = array(
			'form'    => '[wdp_donation_form id="' . $id . '"]',
			'compact' => '[wdp_donation_form id="' . $id . '" layout="compact"]',
			'popup'   => '[donation_panel_experience id="' . $id . '" kind="popup"]',
			'panel'   => '[donation_panel_experience id="' . $id . '" kind="side_panel"]',
			'sheet'   => '[donation_panel_experience id="' . $id . '" kind="bottom_sheet"]',
		);
		$urls  = array();
		foreach ( $pages as $key => $content ) {
			$post_id      = wp_insert_post( array( 'post_title' => 'Perf ' . $key, 'post_content' => $content, 'post_status' => 'publish', 'post_type' => 'page' ) );
			$urls[ $key ] = $path( get_permalink( $post_id ) );
		}
		file_put_contents( $out, wp_json_encode( $urls ) );
	},
	100
);

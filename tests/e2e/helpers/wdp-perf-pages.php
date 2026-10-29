<?php
/**
 * Yalnız yerel ölçüm (tek kullanımlık işçi veritabanı): sayfa içi form ve compact kart sayfaları.
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
		$id      = (int) $in['product_id'];
		$path    = static function ( $url ) {
			$p = wp_parse_url( (string) $url );
			return ( isset( $p['path'] ) ? $p['path'] : '/' ) . ( isset( $p['query'] ) ? '?' . $p['query'] : '' );
		};
		$form    = wp_insert_post( array( 'post_title' => 'Perf form', 'post_content' => '[wdp_donation_form id="' . $id . '"]', 'post_status' => 'publish', 'post_type' => 'page' ) );
		$compact = wp_insert_post( array( 'post_title' => 'Perf compact', 'post_content' => '[wdp_donation_form id="' . $id . '" layout="compact"]', 'post_status' => 'publish', 'post_type' => 'page' ) );
		file_put_contents(
			$out,
			wp_json_encode(
				array(
					'form'    => $path( get_permalink( $form ) ),
					'compact' => $path( get_permalink( $compact ) ),
				)
			)
		);
	},
	100
);

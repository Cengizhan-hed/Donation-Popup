<?php
/**
 * Yalnız yerel e2e (tek kullanımlık işçi veritabanı): yük ölçümü yoklaması.
 * Durum: wp-content/wdp-load-probe.json
 *   plugin_off=1     eklentiyi bu istekte etkin listeden çıkarır (karşılaştırma tabanı)
 *   modules_all=1    tüm modülleri açar (yan sepet, hesap, sosyal kanıt, teşekkür, vergi indirimi)
 *   disable=1        DONATION_PANEL_DISABLE sabitini tanımlar
 *   none_donation=1  hiçbir ürün bağış kapsamında değil
 * Çıktı: HTML sonuna <!--wdp-probe {...}--> yorumu (sorgu sayısı, eklentiye ait seçenekler, autoload bayt).
 * Tema/oluşturucu adı yok.
 */
$wdp_probe_state = json_decode( (string) @file_get_contents( WP_CONTENT_DIR . '/wdp-load-probe.json' ), true );
$wdp_probe_state = is_array( $wdp_probe_state ) ? $wdp_probe_state : array();
if ( ! defined( 'SAVEQUERIES' ) ) {
	define( 'SAVEQUERIES', true );
}
if ( ! empty( $wdp_probe_state['disable'] ) && ! defined( 'DONATION_PANEL_DISABLE' ) ) {
	define( 'DONATION_PANEL_DISABLE', true );
}
if ( ! empty( $wdp_probe_state['plugin_off'] ) ) {
	add_filter(
		'option_active_plugins',
		static function ( $plugins ) {
			return array_values(
				array_filter(
					(array) $plugins,
					static function ( $p ) {
						return false === strpos( (string) $p, 'woo-donation-popup' );
					}
				)
			);
		}
	);
}
if ( ! empty( $wdp_probe_state['modules_all'] ) ) {
	add_filter( 'donation_panel_module_enabled', '__return_true', 99 );
}
if ( ! empty( $wdp_probe_state['direct'] ) ) {
	add_filter( 'donation_panel_direct_enabled', '__return_true', 99 );
}
if ( ! empty( $wdp_probe_state['none_donation'] ) ) {
	add_filter( 'wdp_is_donation_product', '__return_false', 99 );
}
$wdp_probe_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '';
if ( '' === $wdp_probe_uri || false !== strpos( $wdp_probe_uri, '/wp-json/' ) || false !== strpos( $wdp_probe_uri, 'rest_route' ) ) {
	return;
}
ob_start(
	static function ( $html ) {
		global $wpdb;
		if ( false === stripos( $html, '</html>' ) ) {
			return $html;
		}
		$queries = array();
		foreach ( (array) $wpdb->queries as $q ) {
			$frames    = isset( $q[2] ) ? array_reverse( array_map( 'trim', explode( ',', (string) $q[2] ) ) ) : array();
			$frames    = array_values(
				array_filter(
					$frames,
					static function ( $f ) {
						return ! preg_match( '/^(WP_SQLite_DB|wpdb|WC_Data|get_option|get_post_meta|update_option|get_metadata|WC_Data_Store)/', $f );
					}
				)
			);
			$caller    = implode( ' < ', array_slice( $frames, 0, 4 ) );
			$queries[] = substr( (string) preg_replace( '/\s+/', ' ', (string) $q[0] ), 0, 120 ) . ' @@ ' . substr( $caller, 0, 240 );
		}
		$autoload = 0;
		$owned    = array();
		foreach ( (array) wp_load_alloptions() as $name => $value ) {
			if ( 0 === strpos( $name, 'wdp_' ) || 0 === strpos( $name, 'donation_panel' ) ) {
				$autoload      += strlen( (string) $value ) + strlen( $name );
				$owned[ $name ] = strlen( (string) $value );
			}
		}
		$data = array(
			'queries'  => (int) $wpdb->num_queries,
			'sql'      => $queries,
			'autoload' => $autoload,
			'owned'    => $owned,
		);
		return $html . "\n<!--wdp-probe " . str_replace( '--', '- -', (string) wp_json_encode( $data ) ) . '-->';
	}
);

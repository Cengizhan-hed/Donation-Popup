<?php
/**
 * Yalnız yerel e2e (mu-plugin; eklentiye/zip'e GİRMEZ): mail testi seçenekleri `wp-content/wdp-mail-opts.json` dosyasından.
 *
 * Alanlar: locale (site dili), thanksEmail (bool), message (teşekkür metni), campaignProduct (kampanya hedefi verilecek ürün).
 * Yalnız 127.0.0.1/localhost ana makinesinde çalışır; yalnız bu geçici yerel WP'nin ayarlarını değiştirir.
 */
$wdp_opts_host = wp_parse_url( (string) get_option( 'home' ), PHP_URL_HOST ); // phpcs:ignore
if ( ! in_array( (string) $wdp_opts_host, array( '127.0.0.1', 'localhost', '::1', '[::1]' ), true ) ) {
	return;
}
$wdp_opts_file = WP_CONTENT_DIR . '/wdp-mail-opts.json';
$wdp_opts      = is_readable( $wdp_opts_file ) ? json_decode( (string) file_get_contents( $wdp_opts_file ), true ) : array(); // phpcs:ignore
if ( ! is_array( $wdp_opts ) ) {
	return;
}
if ( ! empty( $wdp_opts['locale'] ) ) {
	add_filter(
		'locale',
		static function () use ( $wdp_opts ) {
			return (string) $wdp_opts['locale'];
		},
		PHP_INT_MAX
	);
}
$wdp_opts_settings = static function ( $value ) use ( $wdp_opts ) {
		$value = is_array( $value ) ? $value : array();
		if ( ! isset( $value['thanks'] ) || ! is_array( $value['thanks'] ) ) {
			$value['thanks'] = array();
		}
		if ( array_key_exists( 'thanksEmail', $wdp_opts ) ) {
			$value['thanks']['email'] = (bool) $wdp_opts['thanksEmail'];
		}
		if ( ! empty( $wdp_opts['message'] ) ) {
			$value['thanks']['message'] = (string) $wdp_opts['message'];
		}
		return $value;
};
// Kayıt yoksa `default_option_*`, varsa `option_*` süzgeci çalışır.
add_filter( 'option_donation_panel_settings', $wdp_opts_settings );
add_filter( 'default_option_donation_panel_settings', $wdp_opts_settings );
// `wdp-e6-sim.php` ayarı `pre_option_*` ile verir (modüller açık): onun çıktısına sonradan eklenir.
add_filter(
	'pre_option_donation_panel_settings',
	static function ( $pre ) use ( $wdp_opts_settings ) {
		return is_array( $pre ) ? $wdp_opts_settings( $pre ) : $pre;
	},
	20
);
// Çevrimdışı ödeme yöntemi siparişi "işleniyor" yapar (müşteriye "işleniyor" e-postası gider; gerçek ödeme akışını taklit eder).
foreach ( array( 'cheque', 'bacs', 'cod' ) as $wdp_opts_gw ) {
	add_filter( 'woocommerce_' . $wdp_opts_gw . '_process_payment_order_status', static fn() => 'processing' );
}
if ( ! empty( $wdp_opts['campaignProduct'] ) ) {
	add_action(
		'init',
		static function () use ( $wdp_opts ) {
			$pid = (int) $wdp_opts['campaignProduct'];
			if ( 'yes' !== get_post_meta( $pid, '_enable_progress_bar', true ) ) {
				update_post_meta( $pid, '_enable_progress_bar', 'yes' );
				update_post_meta( $pid, '_progress_bar_limit', '5000' );
			}
		},
		20
	);
}

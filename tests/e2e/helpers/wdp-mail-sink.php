<?php
/**
 * Yalnız yerel e2e (mu-plugin; eklentiye/zip'e GİRMEZ): WordPress e-postalarını yerel Mailpit'e (SMTP) yönlendirir.
 *
 * Güvence: yalnız ana makine 127.0.0.1/localhost/::1 iken çalışır; başka ana makinede hiçbir şey yapmaz.
 * Port: ortam değişkeni WDP_MAILPIT_SMTP_PORT (varsayılan 1025). Tema/eklenti adı yok; yalnız standart `phpmailer_init`.
 */
$wdp_mail_host = wp_parse_url( (string) get_option( 'home' ), PHP_URL_HOST ); // phpcs:ignore
if ( ! in_array( (string) $wdp_mail_host, array( '127.0.0.1', 'localhost', '::1', '[::1]' ), true ) ) {
	return;
}
add_action(
	'phpmailer_init',
	static function ( $phpmailer ) {
		$port = (int) ( getenv( 'WDP_MAILPIT_SMTP_PORT' ) ?: 1025 );
		$phpmailer->isSMTP();
		$phpmailer->Host        = '127.0.0.1';
		$phpmailer->Port        = $port;
		$phpmailer->SMTPAuth    = false;
		$phpmailer->SMTPSecure  = '';
		$phpmailer->SMTPAutoTLS = false;
		$phpmailer->Timeout     = 10;
	},
	PHP_INT_MAX
);

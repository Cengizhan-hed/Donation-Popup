<?php
/**
 * 12.4 Stripe (YALNIZ yerel geçici WP; eval-file ile): resmi "WooCommerce Stripe Payment Gateway" eklentisini etkinleştirir,
 * TEST modunu ve anahtarları ORTAM DEĞİŞKENLERİNDEN yazar (yerel sqlite; git dışı), kampanya ürününü hazırlar.
 * Çıktı JSON: anahtar DEĞERİ İÇERMEZ (yalnız var/yok).
 *
 *   WDP_STRIPE_PK / WDP_STRIPE_SK / WDP_STRIPE_WHSEC  (yalnız bu süreç)
 *   args: <ürün kimliği> <ilerleme hedefi>
 */
$wdp_args  = isset($wdp_eval_args) && is_array($wdp_eval_args) ? $wdp_eval_args : array();
$product   = isset($wdp_args[0]) ? (int) $wdp_args[0] : 0;
$goal      = isset($wdp_args[1]) ? (string) (int) $wdp_args[1] : '100000';
$out       = array( 'ok' => false );
$pk        = (string) getenv('WDP_STRIPE_PK');
$sk        = (string) getenv('WDP_STRIPE_SK');
$whsec     = (string) getenv('WDP_STRIPE_WHSEC');
$host      = wp_parse_url(home_url('/'), PHP_URL_HOST);

if (!in_array($host, array( '127.0.0.1', 'localhost' ), true)) {
	$out['error'] = 'yalnız yerel WP';
	echo wp_json_encode($out);
	return;
}
if (0 !== strpos($sk, 'sk_test_') || 0 !== strpos($pk, 'pk_test_')) {
	$out['error'] = 'test anahtarı değil (sk_test_/pk_test_) — hiçbir şey yazılmadı';
	echo wp_json_encode($out);
	return;
}

require_once ABSPATH . 'wp-admin/includes/plugin.php';
$slug = 'woocommerce-gateway-stripe/woocommerce-gateway-stripe.php';
if (!is_plugin_active($slug)) {
	$r = activate_plugin($slug, '', false, true);
	if (is_wp_error($r)) {
		$out['error'] = 'etkinleştirme: ' . $r->get_error_message();
		echo wp_json_encode($out);
		return;
	}
}

$settings = (array) get_option('woocommerce_stripe_settings', array());
$settings = array_merge(
	$settings,
	array(
		'enabled'                                   => 'yes',
		'title'                                     => 'Kart (Stripe test)',
		'testmode'                                  => 'yes',
		'test_publishable_key'                      => $pk,
		'test_secret_key'                           => $sk,
		'test_webhook_secret'                       => $whsec,
		'publishable_key'                           => '',
		'secret_key'                                => '',
		'webhook_secret'                            => '',
		'capture'                                   => 'yes',
		'saved_cards'                               => 'no',
		'express_checkout'                          => 'no',
		'payment_request'                           => 'no',
		'logging'                                   => 'no',
		'pmc_enabled'                               => 'no',
		'optimized_checkout_element'                => 'no',
		'upe_checkout_experience_enabled'           => 'yes',
		'upe_checkout_experience_accepted_payments' => array( 'card' ),
	)
);
update_option('woocommerce_stripe_settings', $settings);
// Kart dışındaki yöntem ağ geçitleri kapalı (yalnız kart test edilir).
update_option('woocommerce_stripe_card_settings', array_merge((array) get_option('woocommerce_stripe_card_settings', array()), array( 'enabled' => 'yes' )));

// Çevrimdışı yöntemler kapalı: ödeme adımında yalnız Stripe (yöntem seçimi gerekmez).
foreach (array( 'bacs', 'cheque', 'cod' ) as $gw) {
	$opt = (array) get_option("woocommerce_{$gw}_settings", array());
	if (!empty($opt)) {
		$opt['enabled'] = 'no';
		update_option("woocommerce_{$gw}_settings", $opt);
	}
}

if ($product > 0) {
	update_post_meta($product, '_enable_progress_bar', 'yes');
	update_post_meta($product, '_progress_bar_limit', $goal);
}

$version = '';
if (function_exists('get_plugin_data')) {
	$data    = get_plugin_data(WP_PLUGIN_DIR . '/' . $slug, false, false);
	$version = (string) ($data['Version'] ?? '');
}
$out = array(
	'ok'        => true,
	'version'   => $version,
	'currency'  => get_woocommerce_currency(),
	'keys'      => array(
		'publishable' => '' !== $pk,
		'secret'      => '' !== $sk,
		'webhook'     => 0 === strpos($whsec, 'whsec_'),
	),
	'product'   => $product,
	'testmode'  => 'yes' === $settings['testmode'],
);
echo wp_json_encode($out);

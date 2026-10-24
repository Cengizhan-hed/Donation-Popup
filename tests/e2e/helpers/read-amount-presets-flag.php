<?php
/**
 * Genel hızlı tutar ayarı: yalnız açık/kapalı. Option değeri yazılmaz.
 *
 *   php tests/local-wp/eval-file.php tests/e2e/helpers/read-amount-presets-flag.php
 *   wp eval-file tests/e2e/helpers/read-amount-presets-flag.php
 */
if (!function_exists('get_option')) {
	echo '{"ok":false,"on":false}';
	return;
}

$btn = get_option('wdp_button_settings', array());
$raw = is_array($btn) && array_key_exists('enable_amount_presets', $btn)
	? $btn['enable_amount_presets']
	: null;
$on  = $raw === '1' || $raw === 1 || $raw === true || $raw === 'yes';

echo wp_json_encode(array('ok' => true, 'on' => (bool) $on));

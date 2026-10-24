<?php
/**
 * Yerel WP locale kilidi — dil paketi indirmez.
 *
 *   php tests/local-wp/eval-file.php tests/local-wp/i18n-locale.php tr_TR
 */
if (!function_exists('update_option')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}

$locale = isset($wdp_eval_args[0]) && $wdp_eval_args[0] !== ''
	? (string) $wdp_eval_args[0]
	: 'tr_TR';
if (!preg_match('/^[a-z]{2}(?:_[A-Z]{2})?$/', $locale)) {
	echo wp_json_encode(array('ok' => false, 'error' => 'locale')) . "\n";
	return;
}

update_option('WPLANG', $locale);
if (function_exists('switch_to_locale')) {
	switch_to_locale($locale);
}

$mu_dir = (defined('WPMU_PLUGIN_DIR') ? WPMU_PLUGIN_DIR : WP_CONTENT_DIR . '/mu-plugins');
if (!is_dir($mu_dir)) {
	wp_mkdir_p($mu_dir);
}
$mu = $mu_dir . '/wdp-i18n-locale.php';
$php = "<?php\n"
	. "/** WDP i18n test locale lock — no language pack. */\n"
	. "add_filter('locale', static function () { return '" . $locale . "'; }, 99);\n"
	. "add_filter('determine_locale', static function () { return '" . $locale . "'; }, 99);\n"
	. "add_filter('plugin_locale', static function (\$loc, \$domain) { unset(\$loc); unset(\$domain); return '" . $locale . "'; }, 99, 2);\n";
file_put_contents($mu, $php);

echo wp_json_encode(
	array(
		'ok'       => true,
		'locale'   => $locale,
		'WPLANG'   => get_option('WPLANG'),
		'get'      => function_exists('get_locale') ? get_locale() : '',
		'mu'       => $mu,
	)
) . "\n";

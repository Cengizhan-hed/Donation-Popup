<?php
/**
 * Yerel WP locale kilidi — dil paketi indirmez.
 *
 *   php tests/local-wp/eval-file.php tests/local-wp/i18n-locale.php tr_TR
 *   php tests/local-wp/eval-file.php tests/local-wp/i18n-locale.php ar
 *
 * RTL locale (ar, he_IL, fa_IR, ur): $wp_locale->text_direction + is_rtl().
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

/**
 * Dil paketi olmadan RTL locale tanı.
 *
 * @param string $loc
 * @return bool
 */
function wdp_i18n_locale_is_rtl($loc) {
	$loc  = (string) $loc;
	$base = strpos($loc, '_') !== false ? substr($loc, 0, strpos($loc, '_')) : $loc;
	return in_array($base, array('ar', 'he', 'fa', 'ur'), true);
}

$force_rtl = wdp_i18n_locale_is_rtl($locale);

update_option('WPLANG', $locale);
if (function_exists('switch_to_locale')) {
	switch_to_locale($locale);
}

$mu_dir = (defined('WPMU_PLUGIN_DIR') ? WPMU_PLUGIN_DIR : WP_CONTENT_DIR . '/mu-plugins');
if (!is_dir($mu_dir)) {
	wp_mkdir_p($mu_dir);
}
$mu  = $mu_dir . '/wdp-i18n-locale.php';
$php = "<?php\n"
	. "/** WDP i18n test locale lock — no language pack. */\n"
	. "add_filter('locale', static function () { return '" . $locale . "'; }, 99);\n"
	. "add_filter('determine_locale', static function () { return '" . $locale . "'; }, 99);\n"
	. "add_filter('plugin_locale', static function (\$loc, \$domain) { unset(\$loc); unset(\$domain); return '" . $locale . "'; }, 99, 2);\n";

if ($force_rtl) {
	$php .= "function wdp_i18n_force_rtl() {\n"
		. "\tglobal \$wp_locale;\n"
		. "\tif (isset(\$wp_locale) && is_object(\$wp_locale)) {\n"
		. "\t\t\$wp_locale->text_direction = 'rtl';\n"
		. "\t}\n"
		. "}\n"
		. "add_action('init', 'wdp_i18n_force_rtl', 0);\n"
		. "add_action('admin_init', 'wdp_i18n_force_rtl', 0);\n"
		. "add_action('wp_loaded', 'wdp_i18n_force_rtl', 0);\n"
		. "wdp_i18n_force_rtl();\n";
}

file_put_contents($mu, $php);

if ($force_rtl && isset($GLOBALS['wp_locale']) && is_object($GLOBALS['wp_locale'])) {
	$GLOBALS['wp_locale']->text_direction = 'rtl';
}

echo wp_json_encode(
	array(
		'ok'       => true,
		'locale'   => $locale,
		'rtl'      => $force_rtl,
		'is_rtl'   => function_exists('is_rtl') ? (bool) is_rtl() : $force_rtl,
		'WPLANG'   => get_option('WPLANG'),
		'get'      => function_exists('get_locale') ? get_locale() : '',
		'mu'       => $mu,
	)
) . "\n";

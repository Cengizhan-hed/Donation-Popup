<?php
/**
 * wdp_* seçeneklerini JSON yedekten geri yazar. Yabancı anahtar yok sayılır.
 * $args[0] = yedek dosya.
 */
if (!defined('ABSPATH')) {
	fwrite(STDERR, "ship-restore: WP yok\n");
	exit(1);
}
$path = isset($args[0]) ? (string) $args[0] : '';
if ($path === '' || strpos($path, '..') !== false || !is_readable($path)) {
	fwrite(STDERR, "ship-restore: yedek yok\n");
	exit(1);
}
$raw  = file_get_contents($path);
$data = json_decode($raw, true);
if (!is_array($data)) {
	fwrite(STDERR, "ship-restore: json bozuk\n");
	exit(1);
}
$n = 0;
foreach ($data as $k => $v) {
	$key = (string) $k;
	if (strpos($key, 'wdp_') !== 0) {
		continue;
	}
	update_option($key, $v, false);
	$n++;
}
echo wp_json_encode(
	array(
		'ok'    => 1,
		'count' => $n,
	)
);

<?php
/**
 * Yalnız wdp_* seçeneklerini uzak JSON yedeğine yazar.
 * $args[0] = hedef dosya (izinli kök / wdp-backups).
 */
if (!defined('ABSPATH')) {
	fwrite(STDERR, "ship-backup: WP yok\n");
	exit(1);
}
$path = isset($args[0]) ? (string) $args[0] : '';
if ($path === '' || strpos($path, '..') !== false) {
	fwrite(STDERR, "ship-backup: yol yok\n");
	exit(1);
}
$out = array();
$all = wp_load_alloptions();
foreach ($all as $k => $v) {
	if (strpos((string) $k, 'wdp_') === 0) {
		$out[ (string) $k ] = maybe_unserialize($v);
	}
}
$json = wp_json_encode($out);
if (!is_string($json)) {
	fwrite(STDERR, "ship-backup: json yok\n");
	exit(1);
}
$n = file_put_contents($path, $json);
echo wp_json_encode(
	array(
		'ok'    => $n !== false ? 1 : 0,
		'count' => count($out),
	)
);

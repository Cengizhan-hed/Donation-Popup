<?php
/**
 * Salt okunur WP-Cron durumu. Yazma / olay çalıştırma / loopback HTTP YOK.
 * Çıktı yalnız sayı, boolean ve kısa durum (anahtar=değer satırları).
 *
 *   wp eval-file tests/e2e/helpers/cron-status.php
 */
if (!function_exists('get_option')) {
	fwrite(STDERR, "wordpress missing\n");
	exit(1);
}

/**
 * @param string $name
 * @return string true|false|undefined
 */
function wdp_cron_const_state($name) {
	if (!defined($name)) {
		return 'undefined';
	}
	return constant($name) ? 'true' : 'false';
}

$now     = time();
$crons   = function_exists('_get_cron_array') ? _get_cron_array() : array();
$crons   = is_array($crons) ? $crons : array();
$total   = 0;
$overdue = 0;
$oldest  = 0;
foreach ($crons as $timestamp => $hooks) {
	if (!is_array($hooks)) {
		continue;
	}
	$count = 0;
	foreach ($hooks as $events) {
		$count += is_array($events) ? count($events) : 0;
	}
	$total += $count;
	if ((int) $timestamp < $now) {
		$overdue += $count;
		$oldest   = max($oldest, $now - (int) $timestamp);
	}
}

$schedules = function_exists('wp_get_schedules') ? array_keys((array) wp_get_schedules()) : array();
sort($schedules);

echo 'DISABLE_WP_CRON=', wdp_cron_const_state('DISABLE_WP_CRON'), "\n";
echo 'ALTERNATE_WP_CRON=', wdp_cron_const_state('ALTERNATE_WP_CRON'), "\n";
echo 'events_total=', (int) $total, "\n";
echo 'events_overdue=', (int) $overdue, "\n";
echo 'oldest_overdue_seconds=', (int) $oldest, "\n";
echo 'schedules=', implode(',', array_map('sanitize_key', $schedules)), "\n";

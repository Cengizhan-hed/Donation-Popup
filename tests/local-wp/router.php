<?php
/**
 * PHP yerleşik sunucu yönlendiricisi (yalnız yerel matris).
 */
$root = $_SERVER['DOCUMENT_ROOT'] ?? __DIR__;
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = is_string($path) ? urldecode($path) : '/';
$file = $root . $path;
if ($path !== '/' && is_file($file)) {
	return false;
}
require $root . '/index.php';

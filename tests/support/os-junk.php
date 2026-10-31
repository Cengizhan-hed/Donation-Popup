<?php
/**
 * "Klasör yok / boş" denetimleri için ortak yardımcı: macOS/Windows artıklarını yok sayar.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

if (!function_exists('wdp_test_is_os_junk')) {
	/** `.DS_Store`, `Thumbs.db` ve `._*` (AppleDouble) dosya adları işletim sistemi artığıdır. */
	function wdp_test_is_os_junk(string $name): bool {
		return '.DS_Store' === $name || 'Thumbs.db' === $name || 0 === strpos($name, '._');
	}
}

if (!function_exists('wdp_test_dir_absent_or_only_os_junk')) {
	/**
	 * Klasör hiç yoksa ya da (alt klasörler dahil) yalnız OS artıkları içeriyorsa true.
	 * Başka herhangi bir dosya varsa false.
	 */
	function wdp_test_dir_absent_or_only_os_junk(string $dir): bool {
		if (!is_dir($dir)) {
			return !file_exists($dir);
		}
		foreach (scandir($dir) ?: array() as $entry) {
			if ('.' === $entry || '..' === $entry) {
				continue;
			}
			$path = $dir . '/' . $entry;
			if (is_dir($path) && !is_link($path)) {
				if (!wdp_test_dir_absent_or_only_os_junk($path)) {
					return false;
				}
				continue;
			}
			if (!wdp_test_is_os_junk($entry)) {
				return false;
			}
		}
		return true;
	}
}

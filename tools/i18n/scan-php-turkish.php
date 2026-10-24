<?php
/**
 * PHP kaynağında gettext'e SARILMAMIŞ Türkçe dizgileri bulur (tokenizer; yorumlar hariç).
 *
 * Kullanım: php tools/i18n/scan-php-turkish.php [root] [--json]
 * Çıkış kodu 1: bulundu. İzin listesi: tools/i18n/scan-php-allowlist.json ({"dosya:satır-anahtarı":"gerekçe"} yerine
 * {"allow":[{"file":"...","contains":"metin parçası","reason":"..."}]}).
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

$root = dirname(__DIR__, 2);
$json = false;
foreach (array_slice($argv, 1) as $a) {
	if ($a === '--json') {
		$json = true;
	} elseif ($a !== '' && $a[0] !== '-') {
		$root = rtrim($a, '/');
	}
}

$gettext = array('__', '_e', 'esc_html__', 'esc_attr__', 'esc_html_e', 'esc_attr_e', '_x', 'esc_html_x', 'esc_attr_x', '_n', '_nx');
$letters = '/[çğıöşüÇĞİÖŞÜ]/u';
$words   = '/(?<![\p{L}])(bağış|sepet|sepete|ödeme|tutar|ürün|ayar|lütfen|geçersiz|kaydet|hissedar|hisse|kampanya|ithaf|varsayılan|yalnızca|için|veya|olarak|kullanılır|boşsa|oluştu|kategori|sayfa|başlık|buton|düğme|renk|metin|alan|göster)(?![\p{L}])/iu';

$allow = array();
$allow_file = $root . '/tools/i18n/scan-php-allowlist.json';
if (is_readable($allow_file)) {
	$j     = json_decode((string) file_get_contents($allow_file), true);
	$allow = isset($j['allow']) && is_array($j['allow']) ? $j['allow'] : array();
}

$dirs = array('includes', 'templates', 'blocks');
$files = array($root . '/woo-donation-popup.php', $root . '/uninstall.php');
foreach ($dirs as $d) {
	$base = $root . '/' . $d;
	if (!is_dir($base)) {
		continue;
	}
	$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS));
	foreach ($it as $f) {
		if ($f->isFile() && substr($f->getFilename(), -4) === '.php') {
			$files[] = $f->getPathname();
		}
	}
}
sort($files);

$hits = array();
foreach ($files as $file) {
	if (!is_readable($file)) {
		continue;
	}
	$rel    = ltrim(str_replace($root, '', $file), '/');
	$tokens = token_get_all((string) file_get_contents($file));
	$n      = count($tokens);
	// Gettext çağrı parantezi derinliği: içindeki dizgiler (msgid) zaten kapsanmış sayılır.
	$stack = array();
	$depth = 0;
	$last_ident = '';
	for ($i = 0; $i < $n; $i++) {
		$t = $tokens[ $i ];
		if (is_array($t)) {
			if ($t[0] === T_STRING) {
				$last_ident = $t[1];
			} elseif ($t[0] === T_WHITESPACE || $t[0] === T_COMMENT || $t[0] === T_DOC_COMMENT) {
				continue;
			}
			if ($t[0] === T_CONSTANT_ENCAPSED_STRING || $t[0] === T_ENCAPSED_AND_WHITESPACE || $t[0] === T_INLINE_HTML) {
				$in_gettext = false;
				foreach ($stack as $frame) {
					if ($frame) {
						$in_gettext = true;
						break;
					}
				}
				$text = $t[1];
				if (!$in_gettext && (preg_match($letters, $text) || preg_match($words, $text))) {
					$skip = false;
					foreach ($allow as $rule) {
						if (isset($rule['file'], $rule['contains']) && $rule['file'] === $rel && false !== strpos($text, (string) $rule['contains'])) {
							$skip = true;
							break;
						}
					}
					if (!$skip) {
						$hits[] = array('file' => $rel, 'line' => $t[2], 'text' => mb_substr(trim($text, "'\""), 0, 90));
					}
				}
			}
			if ($t[0] !== T_STRING && $t[0] !== T_NS_SEPARATOR) {
				// anahtar sözcük sonrası
			}
		} else {
			if ($t === '(') {
				$stack[] = in_array($last_ident, $gettext, true);
				$last_ident = '';
			} elseif ($t === ')') {
				array_pop($stack);
			} else {
				$last_ident = '';
			}
		}
	}
}

if ($json) {
	echo json_encode(array('count' => count($hits), 'hits' => $hits), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
} else {
	echo 'scan-php-turkish: ' . count($hits) . " gettext dışı Türkçe dizgi\n";
	foreach (array_slice($hits, 0, 200) as $h) {
		echo "  {$h['file']}:{$h['line']} «{$h['text']}»\n";
	}
}
exit($hits ? 1 : 0);

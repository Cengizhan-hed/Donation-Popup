<?php
/**
 * PHP tokenizer scan of gettext calls. Regex is not used for call discovery.
 *
 * Usage: php tools/i18n/token-scan.php [root]
 * Stdout: JSON { calls: [], text_as_key: [] }
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

$root = isset($argv[1]) && $argv[1] !== '' ? $argv[1] : dirname(__DIR__, 2);

$functions = array(
	'__'           => array('msgid' => 0, 'domain' => 1),
	'_e'           => array('msgid' => 0, 'domain' => 1),
	'esc_html__'   => array('msgid' => 0, 'domain' => 1),
	'esc_attr__'   => array('msgid' => 0, 'domain' => 1),
	'esc_html_e'   => array('msgid' => 0, 'domain' => 1),
	'esc_attr_e'   => array('msgid' => 0, 'domain' => 1),
	'_x'           => array('msgid' => 0, 'context' => 1, 'domain' => 2),
	'esc_html_x'   => array('msgid' => 0, 'context' => 1, 'domain' => 2),
	'esc_attr_x'   => array('msgid' => 0, 'context' => 1, 'domain' => 2),
	'_n'           => array('msgid' => 0, 'plural' => 1, 'domain' => 3),
	'_nx'          => array('msgid' => 0, 'plural' => 1, 'context' => 3, 'domain' => 4),
);

/**
 * @param string $dir
 * @param string $ext
 * @return string[]
 */
function wdp_i18n_walk($dir, $ext) {
	$out = array();
	if (!is_dir($dir)) {
		return $out;
	}
	$it = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)
	);
	foreach ($it as $file) {
		if (!$file->isFile()) {
			continue;
		}
		$name = $file->getFilename();
		if (substr($name, -strlen($ext)) !== $ext) {
			continue;
		}
		$out[] = $file->getPathname();
	}
	sort($out);
	return $out;
}

/**
 * @param mixed $tok
 * @return bool
 */
function wdp_i18n_is_ignorable($tok) {
	if (!is_array($tok)) {
		return false;
	}
	return in_array($tok[0], array(T_WHITESPACE, T_COMMENT, T_DOC_COMMENT), true);
}

/**
 * @param array $tokens
 * @param int   $i
 * @param int   $dir  -1 or +1
 * @return int
 */
function wdp_i18n_skip($tokens, $i, $dir) {
	$n = count($tokens);
	$j = $i + $dir;
	while ($j >= 0 && $j < $n && wdp_i18n_is_ignorable($tokens[ $j ])) {
		$j += $dir;
	}
	return $j;
}

/**
 * @param mixed $tok
 * @return string
 */
function wdp_i18n_text($tok) {
	return is_array($tok) ? (string) $tok[1] : (string) $tok;
}

/**
 * @param string $quoted
 * @return string
 */
function wdp_i18n_unquote($quoted) {
	if ($quoted === '' || ($quoted[0] !== "'" && $quoted[0] !== '"')) {
		return $quoted;
	}
	$q    = $quoted[0];
	$inner = substr($quoted, 1, -1);
	if ($q === "'") {
		return str_replace(array('\\\'', '\\\\'), array("'", '\\'), $inner);
	}
	return stripcslashes($inner);
}

/**
 * Flatten a top-level argument to a string when it is only literals / concat.
 *
 * @param array $arg_tokens
 * @return string|null
 */
function wdp_i18n_arg_string(array $arg_tokens) {
	$buf = '';
	$saw = false;
	foreach ($arg_tokens as $tok) {
		if (wdp_i18n_is_ignorable($tok)) {
			continue;
		}
		if (is_array($tok) && $tok[0] === T_CONSTANT_ENCAPSED_STRING) {
			$buf .= wdp_i18n_unquote($tok[1]);
			$saw   = true;
			continue;
		}
		if (is_array($tok) && $tok[0] === T_ENCAPSED_AND_WHITESPACE) {
			return null;
		}
		if ($tok === '.') {
			continue;
		}
		return null;
	}
	return $saw ? $buf : null;
}

/**
 * @param string $text
 * @return string[]
 */
function wdp_i18n_placeholders($text) {
	if (!is_string($text) || $text === '') {
		return array();
	}
	if (!preg_match_all('/%(?:\d+\$)?[sd]/', $text, $m)) {
		return array();
	}
	return array_values($m[0]);
}

/**
 * @param array $tokens
 * @param int   $open_idx index of '('
 * @return array{args: array<int, array>, end: int}
 */
function wdp_i18n_parse_args(array $tokens, $open_idx) {
	$n        = count($tokens);
	$depth    = 0;
	$args     = array();
	$current  = array();
	$i        = $open_idx;
	for (; $i < $n; $i++) {
		$tok = $tokens[ $i ];
		$ch  = is_array($tok) ? '' : $tok;
		if ($ch === '(' || $ch === '[' || $ch === '{') {
			$depth++;
			if ($depth > 1) {
				$current[] = $tok;
			}
			continue;
		}
		if ($ch === ')' || $ch === ']' || $ch === '}') {
			$depth--;
			if ($depth === 0 && $ch === ')') {
				if ($current) {
					$args[] = $current;
				}
				return array('args' => $args, 'end' => $i);
			}
			$current[] = $tok;
			continue;
		}
		if ($ch === ',' && $depth === 1) {
			$args[]  = $current;
			$current = array();
			continue;
		}
		if ($depth >= 1) {
			$current[] = $tok;
		}
	}
	return array('args' => $args, 'end' => $n - 1);
}

/**
 * @param mixed $tok
 * @return bool
 */
function wdp_i18n_is_equal_op($tok) {
	if (!is_array($tok)) {
		return $tok === '==' || $tok === '===';
	}
	return in_array($tok[0], array(T_IS_EQUAL, T_IS_IDENTICAL, T_IS_NOT_EQUAL, T_IS_NOT_IDENTICAL), true);
}

/**
 * @param array  $tokens
 * @param int    $start
 * @param int    $end
 * @return array{kind:string,note:string}|null
 */
function wdp_i18n_text_as_key(array $tokens, $start, $end) {
	$prev = wdp_i18n_skip($tokens, $start, -1);
	$next = wdp_i18n_skip($tokens, $end, 1);
	$prev_t = ($prev >= 0) ? $tokens[ $prev ] : null;
	$next_t = ($next < count($tokens)) ? $tokens[ $next ] : null;

	if ($prev_t === '[') {
		return array('kind' => 'array-key', 'note' => 'gettext sonucu dizi anahtarı ($arr[__(...)])');
	}
	if ($next_t === '=>') {
		return array('kind' => 'array-key', 'note' => 'gettext sonucu dizi anahtarı (__(...) => )');
	}
	if ($prev_t !== null && wdp_i18n_is_equal_op($prev_t)) {
		return array('kind' => 'compare', 'note' => 'çevrilmiş metin eşitlik karşılaştırması');
	}
	if ($next_t !== null && wdp_i18n_is_equal_op($next_t)) {
		return array('kind' => 'compare', 'note' => 'çevrilmiş metin eşitlik karşılaştırması');
	}
	if (is_array($prev_t) && $prev_t[0] === T_CASE) {
		return array('kind' => 'switch', 'note' => 'case __(…) — çevrilmiş metin dal seçici');
	}

	if ($prev_t === '(') {
		$fn_i = wdp_i18n_skip($tokens, $prev, -1);
		$fn   = ($fn_i >= 0) ? $tokens[ $fn_i ] : null;
		$name = is_array($fn) && $fn[0] === T_STRING ? $fn[1] : '';
		if ($name === 'in_array') {
			return array('kind' => 'in_array', 'note' => 'in_array(__(…), …) — çevrilmiş metin aranıyor');
		}
		if ($name === 'switch') {
			return array('kind' => 'switch', 'note' => 'switch (__(…)) — çevrilmiş metin dal seçici');
		}
	}

	return null;
}

/**
 * @param string $file
 * @param string $root
 * @param array  $functions
 * @return array{calls: array, text_as_key: array}
 */
function wdp_i18n_scan_file($file, $root, array $functions) {
	$src    = (string) file_get_contents($file);
	$tokens = token_get_all($src);
	$rel    = ltrim(str_replace('\\', '/', substr($file, strlen($root))), '/');
	$calls  = array();
	$traps  = array();
	$n      = count($tokens);

	for ($i = 0; $i < $n; $i++) {
		$tok = $tokens[ $i ];
		if (!is_array($tok) || $tok[0] !== T_STRING) {
			continue;
		}
		$fn = $tok[1];
		if (!isset($functions[ $fn ])) {
			continue;
		}
		$prev = wdp_i18n_skip($tokens, $i, -1);
		if ($prev >= 0) {
			$pt = $tokens[ $prev ];
			if ($pt === '->' || $pt === '::' || (is_array($pt) && in_array($pt[0], array(T_OBJECT_OPERATOR, T_DOUBLE_COLON, T_NS_SEPARATOR), true))) {
				continue;
			}
		}
		$next = wdp_i18n_skip($tokens, $i, 1);
		if ($next >= $n || $tokens[ $next ] !== '(') {
			continue;
		}
		$parsed = wdp_i18n_parse_args($tokens, $next);
		$map    = $functions[ $fn ];
		$args   = $parsed['args'];
		$msgid  = isset($map['msgid'], $args[ $map['msgid'] ]) ? wdp_i18n_arg_string($args[ $map['msgid'] ]) : null;
		$plural = isset($map['plural'], $args[ $map['plural'] ]) ? wdp_i18n_arg_string($args[ $map['plural'] ]) : null;
		$ctx    = isset($map['context'], $args[ $map['context'] ]) ? wdp_i18n_arg_string($args[ $map['context'] ]) : null;
		$domain = isset($map['domain'], $args[ $map['domain'] ]) ? wdp_i18n_arg_string($args[ $map['domain'] ]) : null;
		$line   = (int) $tok[2];
		$ph     = array_values(
			array_unique(
				array_merge(
					wdp_i18n_placeholders((string) $msgid),
					wdp_i18n_placeholders((string) $plural)
				)
			)
		);
		$call   = array(
			'function'     => $fn,
			'msgid'        => $msgid,
			'plural'       => $plural,
			'context'      => $ctx,
			'domain'       => $domain,
			'file'         => $rel,
			'line'         => $line,
			'arg_count'    => count($args),
			'placeholders' => $ph,
		);
		$calls[] = $call;
		$trap    = wdp_i18n_text_as_key($tokens, $i, $parsed['end']);
		if ($trap) {
			$traps[] = array(
				'file'     => $rel,
				'line'     => $line,
				'function' => $fn,
				'msgid'    => $msgid,
				'kind'     => $trap['kind'],
				'note'     => $trap['note'],
			);
		}
	}

	return array('calls' => $calls, 'text_as_key' => $traps);
}

$files = array();
$main  = $root . '/woo-donation-popup.php';
if (is_file($main)) {
	$files[] = $main;
}
foreach (array('includes', 'templates', 'blocks') as $dir) {
	$files = array_merge($files, wdp_i18n_walk($root . '/' . $dir, '.php'));
}

$all_calls = array();
$all_traps = array();
foreach ($files as $file) {
	$scan       = wdp_i18n_scan_file($file, $root, $functions);
	$all_calls  = array_merge($all_calls, $scan['calls']);
	$all_traps  = array_merge($all_traps, $scan['text_as_key']);
}

$out = array(
	'generated_at' => gmdate('c'),
	'root'         => $root,
	'file_count'   => count($files),
	'call_count'   => count($all_calls),
	'calls'        => $all_calls,
	'text_as_key'  => $all_traps,
);

$flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
echo json_encode($out, $flags) . "\n";

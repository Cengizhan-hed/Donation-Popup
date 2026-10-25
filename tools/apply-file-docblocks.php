<?php
/**
 * Kaynak dosyalara tools/file-descriptions.json içindeki Türkçe dosya başlıklarını uygular.
 *
 * Kullanım: php tools/apply-file-docblocks.php
 *
 * @package WooCommerce\Donation_Popup
 */

$root = dirname(__DIR__);
$manifestPath = $root . '/tools/file-descriptions.json';

if (!is_readable($manifestPath)) {
	fwrite(STDERR, "Manifest bulunamadı: {$manifestPath}\n");
	exit(1);
}

/** @var array<string, string> $descriptions */
$descriptions = json_decode(file_get_contents($manifestPath), true);
if (!is_array($descriptions)) {
	fwrite(STDERR, "Geçersiz JSON manifest.\n");
	exit(1);
}

$jsApi = array(
	'assets/js/src/core/constants.js' => 'WDPApp.constants',
	'assets/js/src/core/utils.js' => 'WDPApp.utils',
	'assets/js/src/core/state.js' => 'WDPApp.state',
	'assets/js/src/core/dom.js' => 'WDPApp.dom',
	'assets/js/src/phone-input.js' => 'WDPApp.phoneInput',
	'assets/js/src/product.js' => 'WDPApp.product',
	'assets/js/src/cart/ui.js' => 'WDPApp.cartUi',
	'assets/js/src/cart/woo.js' => 'WDPApp.cartWoo',
	'assets/js/src/cart/actions.js' => 'WDPApp.cartActions',
	'assets/js/src/cart.js' => 'WDPApp.cart',
	'assets/js/src/form/messages.js' => 'WDPApp.formMessages',
	'assets/js/src/form/pricing.js' => 'WDPApp.formPricing',
	'assets/js/src/form/feedback.js' => 'WDPApp.formFeedback',
	'assets/js/src/form/addon.js' => 'WDPApp.formAddon',
	'assets/js/src/form/ajax.js' => 'WDPApp.formAjax',
	'assets/js/src/form.js' => 'WDPApp.form',
	'assets/js/src/shareholder/layout.js' => 'WDPApp.shareholderLayout',
	'assets/js/src/shareholder/list.js' => 'WDPApp.shareholderList',
	'assets/js/src/shareholder/scroll.js' => 'WDPApp.shareholderScroll',
	'assets/js/src/shareholder/guidance.js' => 'WDPApp.shareholderGuidance',
	'assets/js/src/shareholder/render.js' => 'WDPApp.shareholderRender',
	'assets/js/src/shareholder/quantity.js' => 'WDPApp.shareholderQuantity',
	'assets/js/src/shareholder/forms-sync.js' => 'WDPApp.shareholderFormsSync',
	'assets/js/src/shareholder/setup.js' => 'WDPApp.shareholderSetup',
	'assets/js/src/shareholder.js' => 'WDPApp.shareholder',
	'assets/js/src/progress-bar.js' => 'WDPApp.progressBar',
	'assets/js/src/modal.js' => 'WDPApp.modal',
	'assets/js/src/bootstrap/form-initializer.js' => 'WDPApp.formInitializer',
	'assets/js/src/bootstrap/event-manager.js' => 'WDPApp.eventManager',
	'assets/js/src/bootstrap/module-loader.js' => 'WDPApp.moduleLoader',
	'assets/js/src/bootstrap/init.js' => 'WDPApp.init',
);

/**
 * @param string $description
 * @param string $package
 */
function wdp_build_php_docblock($description, $package) {
	return "/**\n * {$description}\n *\n * @package {$package}\n */";
}

/**
 * @param string $basename
 * @param string $description
 * @param string $api
 */
function wdp_build_js_css_docblock($basename, $description, $api = '') {
	$lines = array(
		" * @file {$basename}",
		" * {$description}",
	);
	if ($api !== '') {
		$lines[] = " * Dış API: {$api}";
	}
	return "/**\n" . implode("\n", $lines) . "\n */";
}

/**
 * @param string $content
 * @param string $newBlock
 */
function wdp_replace_leading_docblock($content, $newBlock) {
	if (preg_match('/^\/\*\*.*?\*\//s', $content)) {
		return preg_replace('/^\/\*\*.*?\*\//s', $newBlock, $content, 1);
	}
	return $newBlock . "\n\n" . $content;
}

/**
 * @param string $path
 * @param string $description
 */
function wdp_apply_php_header($path, $description) {
	$content = file_get_contents($path);
	if ($content === false) {
		return false;
	}

	if (strpos($content, 'Plugin Name:') !== false) {
		if (strpos($content, '* Dosya:') === false) {
			$line = " * \n * Dosya: {$description}\n";
			$updated = preg_replace('/(\* Text Domain:.*\R)/', '$1' . $line, $content, 1);
			if ($updated !== null && $updated !== $content) {
				file_put_contents($path, $updated);
			}
		}
		return true;
	}

	$package = 'WooCommerce\\Donation_Popup';
	if (preg_match('/@package\s+(\S+)/', $content, $matches)) {
		$package = $matches[1];
	}

	$newBlock = wdp_build_php_docblock($description, $package);

	if (preg_match('/^<\?php\s*\R\/\*\*.*?\*\//s', $content)) {
		$updated = preg_replace('/^<\?php\s*\R\/\*\*.*?\*\//s', "<?php\n{$newBlock}", $content, 1);
	} elseif (preg_match('/^<\?php/', $content)) {
		$updated = preg_replace('/^<\?php\s*/', "<?php\n{$newBlock}\n\n", $content, 1);
	} else {
		$updated = "<?php\n{$newBlock}\n\n" . $content;
	}

	if ($updated === null || $updated === $content) {
		return false;
	}

	return file_put_contents($path, $updated) !== false;
}

/**
 * @param string $path
 * @param string $description
 * @param string $api
 */
function wdp_apply_js_css_header($path, $description, $api = '') {
	$content = file_get_contents($path);
	if ($content === false) {
		return false;
	}

	$basename = basename($path);
	$newBlock = wdp_build_js_css_docblock($basename, $description, $api);
	$updated = wdp_replace_leading_docblock($content, $newBlock);

	if ($updated === $content) {
		return false;
	}

	return file_put_contents($path, $updated) !== false;
}

$updated = 0;
$skipped = 0;

foreach ($descriptions as $relativePath => $description) {
	$path = $root . '/' . $relativePath;
	if (!is_file($path)) {
		fwrite(STDERR, "Atlandı (yok): {$relativePath}\n");
		++$skipped;
		continue;
	}

	$ext = pathinfo($path, PATHINFO_EXTENSION);
	$ok = false;

	if ($ext === 'php') {
		$ok = wdp_apply_php_header($path, $description);
	} elseif ($ext === 'js' || $ext === 'css') {
		$api = isset($jsApi[$relativePath]) ? $jsApi[$relativePath] : '';
		$ok = wdp_apply_js_css_header($path, $description, $api);
	}

	if ($ok) {
		++$updated;
		echo "Güncellendi: {$relativePath}\n";
	} else {
		++$skipped;
	}
}

echo "\nToplam güncellenen: {$updated}, atlanan: {$skipped}\n";

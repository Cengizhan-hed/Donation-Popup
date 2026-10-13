<?php
/**
 * Generate static HTML fixtures for visual regression (4 types × shells).
 * Usage: php tools/visual/generate-fixtures.php
 */
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$out  = $root . '/tools/visual/fixtures';
if (!is_dir($out)) {
	mkdir($out, 0775, true);
}

$manifest = json_decode((string) file_get_contents($root . '/assets/css/build/manifest.json'), true);
$cssRel   = is_array($manifest) && !empty($manifest['file']) ? $manifest['file'] : 'build/donation-modal.css';
$jsManifest = json_decode((string) file_get_contents($root . '/assets/js/build/manifest.json'), true);
$jsRel = is_array($jsManifest) && !empty($jsManifest['file']) ? $jsManifest['file'] : 'build/donation-modal.js';

$cssHref = '../../../assets/css/' . $cssRel;
$jsHref  = '../../../assets/js/' . $jsRel;

$types = array(
	'fixed' => array('label' => 'Sabit tutar', 'body' => fixed_body(1), 'expect' => '6000'),
	'fixed-qty3' => array('label' => 'Sabit ×3', 'body' => fixed_body(3), 'expect' => '18000'),
	'custom' => array('label' => 'Bağışçı belirler', 'body' => custom_body(), 'expect' => '—'),
	'shares-1' => array('label' => '1 hisse', 'body' => shares_body(1), 'expect' => '6000'),
	'shares-3' => array('label' => '3 hisse', 'body' => shares_body(3), 'expect' => '18000'),
	'campaign-40' => array('label' => 'Kampanya %40', 'body' => campaign_body(40), 'expect' => '—'),
	'campaign-148' => array('label' => 'Kampanya %148', 'body' => campaign_body(148), 'expect' => '—'),
	'success' => array('label' => 'Başarı', 'body' => success_body(), 'expect' => '—'),
	'error' => array('label' => 'Hata', 'body' => error_body(), 'expect' => '6000'),
);

$shells = array('modal', 'panel', 'sheet', 'inline');

function fixed_body($qty) {
	return '<div class="wdp-fixed-price-counter-row">'
		. '<div class="wdp-line-total-display wdp-fixed-amount-summary"><span class="wdp-line-total-label">Bağış tutarı</span><span class="wdp-line-total-value">₺6.000</span></div>'
		. '<div class="wdp-quantity-counter"><span class="wdp-qty-label">Adet</span>'
		. '<button type="button" class="wdp-product-quantity-btn wdp-product-quantity-decrease" aria-label="Azalt">−</button>'
		. '<input type="number" name="quantity" value="' . (int) $qty . '" min="1" max="99" readonly>'
		. '<button type="button" class="wdp-product-quantity-btn wdp-product-quantity-increase" aria-label="Arttır">+</button></div></div>';
}

function custom_body() {
	return '<div class="wdp-custom-price-row"><span class="wdp-custom-price-row__label">Bağış tutarı</span>'
		. '<div class="wdp-custom-price-shell"><span class="wdp-custom-price-currency">₺</span>'
		. '<input class="wdp-custom-price-input" name="custom_price" inputmode="decimal" placeholder="0"></div>'
		. '<p class="wdp-field__help">En az ₺100</p>'
		. '<div class="wdp-amount-presets"><button type="button" class="wdp-amount-preset" data-amount="100">100</button>'
		. '<button type="button" class="wdp-amount-preset" data-amount="250">250</button>'
		. '<button type="button" class="wdp-amount-preset" data-amount="500">500</button>'
		. '<button type="button" class="wdp-amount-preset" data-amount="1000">1000</button></div></div>';
}

function shares_body($n) {
	$cards = '';
	for ($i = 1; $i <= $n; $i++) {
		$cards .= '<div class="wdp-shareholder-form' . ($i === 1 ? '' : ' is-collapsed') . '">'
			. '<button type="button" class="wdp-shareholder-form__header"><span class="wdp-shareholder-index">' . $i . '</span> ' . $i . '. Hisse <span class="wdp-shareholder-form__price">₺6.000</span></button>'
			. '<div class="wdp-shareholder-form__body"><label class="wdp-field__label">Ad Soyad</label><input class="wdp-field-stack__input" name="shareholder_name[]"></div></div>';
	}
	return '<div class="wdp-shares-section"><div class="wdp-shares-header"><label>Hisse adedi</label>'
		. '<div class="wdp-share-counter"><button type="button" class="wdp-share-btn" aria-label="Azalt">−</button>'
		. '<input name="share_count" value="' . (int) $n . '" readonly>'
		. '<button type="button" class="wdp-share-btn" aria-label="Arttır">+</button></div></div>'
		. '<div class="wdp-shareholders-area">' . $cards . '</div></div>';
}

function campaign_body($pct) {
	$width = min(100, (int) $pct);
	$label = $pct > 100 ? ('Hedef aşıldı · %' . (int) $pct) : ('%' . (int) $pct);
	return '<div class="wdp-progress-bar-container"><div class="wdp-progress-bar-header">'
		. '<div><span class="wdp-progress-bar-amount">₺40.000</span><span class="wdp-progress-raised-label">toplandı</span></div>'
		. '<span class="wdp-progress-bar-percentage">' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</span></div>'
		. '<div class="wdp-progress-bar-wrapper"><div class="wdp-progress-bar-fill" style="width:' . $width . '%"></div></div>'
		. '<div class="wdp-progress-bar-goal">Hedef ₺100.000 · 27 bağışçı</div></div>' . custom_body();
}

function success_body() {
	return '<div class="wdp-success-screen"><div class="wdp-success-screen__icon" aria-hidden="true">✓</div>'
		. '<h2 class="wdp-success-screen__title">Teşekkürler</h2><p class="wdp-success-screen__text">Bağışınız sepete eklendi.</p>'
		. '<div class="wdp-success-screen__actions"><button type="button" class="wdp-btn-primary">Ödemeye Git</button>'
		. '<button type="button" class="wdp-btn-secondary">Sepete Git</button></div></div>';
}

function error_body() {
	return fixed_body(1) . '<div class="wdp-field__error" id="err">Bu alan zorunludur</div>';
}

foreach ($types as $type => $meta) {
	foreach ($shells as $shell) {
		$is_modal = $shell === 'modal' || $shell === 'sheet';
		$is_panel = $shell === 'panel';
		$is_inline = $shell === 'inline';
		$classes = 'wdp-root hdf-donation-modal-wrapper';
		if ($is_inline) {
			$classes .= ' wdp-donation-form';
		} else {
			$classes .= ' wdp-modal show';
			if ($is_panel) {
				$classes .= ' wdp-side-panel';
			}
			if ($shell === 'sheet') {
				$classes .= '" data-wdp-shell="sheet';
				// fix below
			}
		}
		$shell_attr = $shell === 'sheet' ? ' data-wdp-shell="sheet"' : '';
		$classes = 'wdp-root hdf-donation-modal-wrapper';
		if ($is_inline) {
			$classes .= ' wdp-donation-form';
		} else {
			$classes .= ' wdp-modal show' . ($is_panel ? ' wdp-side-panel' : '');
		}
		$expect = $meta['expect'];
		$total = ($expect === '—') ? '—' : ('₺' . number_format((float) $expect, 0, ',', '.'));
		$html = '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
			. '<title>' . htmlspecialchars($meta['label'] . ' / ' . $shell, ENT_QUOTES, 'UTF-8') . '</title>'
			. '<link rel="stylesheet" href="' . htmlspecialchars($cssHref, ENT_QUOTES, 'UTF-8') . '">'
			. '<style>.wdp-root{--wdp-primary:#1d5fa8;--wdp-primary-hover:#1a5697;--wdp-on-primary:#fff}</style></head><body>'
			. '<div id="wdp-modal-demo" class="' . htmlspecialchars($classes, ENT_QUOTES, 'UTF-8') . '"' . $shell_attr . ' data-wdp-unit-price="6000" data-wdp-expect-total="' . htmlspecialchars($expect, ENT_QUOTES, 'UTF-8') . '">'
			. '<div class="wdp-modal-content' . ($is_panel ? ' wdp-side-panel-content' : '') . '">'
			. ($is_inline ? '' : '<button type="button" class="wdp-modal-close" aria-label="Kapat">×</button>')
			. '<div class="wdp-modal-header"><div class="wdp-modal-title-wrapper"><span class="wdp-modal-title" id="wdp-modal-demo-title">' . htmlspecialchars($meta['label'], ENT_QUOTES, 'UTF-8') . '</span></div></div>'
			. '<form class="wdp-donation-form-fields' . ($is_panel ? ' wdp-side-panel-form' : '') . ($type === 'shares-1' || $type === 'shares-3' ? ' wdp-has-shareholders' : '') . '" novalidate>'
			. ($is_panel ? '<div class="wdp-side-panel-main">' : '')
			. $meta['body']
			. ($is_panel ? '</div>' : '')
			. '<div class="' . ($is_panel ? 'wdp-side-panel-footer-zone' : 'wdp-form-cta-zone') . '">'
			. '<div class="wdp-footer-total" data-wdp-footer-total><span class="wdp-footer-total__label">Toplam</span><span class="wdp-footer-total__value">' . htmlspecialchars($total, ENT_QUOTES, 'UTF-8') . '</span></div>'
			. '<div class="wdp-button-group"><button type="submit" class="wdp-btn-secondary" name="donation_add_to_cart"><span class="wdp-btn__inner"><span class="wdp-btn__label">Sepete Ekle</span></span></button>'
			. '<button type="submit" class="wdp-btn-primary" name="donation_go_checkout"><span class="wdp-btn__inner"><span class="wdp-btn__label">Ödemeye Git</span></span></button></div></div>'
			. '</form></div></div>'
			. '<script src="' . htmlspecialchars($jsHref, ENT_QUOTES, 'UTF-8') . '"></script></body></html>';
		$file = $out . '/' . $type . '-' . $shell . '.html';
		file_put_contents($file, $html);
		echo "Wrote {$file}\n";
	}
}

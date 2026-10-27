/**
 * Ürün düzenleme ekranı "Donation" sekmesi: bağış türüne göre alanları gösterme, kısa kod kopyalama, sekmeyi
 * adresten açma, geçersiz alanda sekmeyi/bölümü açma. jQuery kullanılmaz.
 */
import './products.css';

const cfg = window.wdpProductsAdmin || {};
const i18n = cfg.i18n || {};

function announce(message) {
  const region = document.querySelector('[data-wdp-products-status]');
  if (!region || !message) return;
  region.textContent = '';
  window.setTimeout(() => {
    region.textContent = message;
  }, 40);
}

function legacyCopy(text) {
  const temp = document.createElement('textarea');
  temp.value = text;
  temp.setAttribute('readonly', '');
  temp.style.position = 'fixed';
  temp.style.opacity = '0';
  document.body.appendChild(temp);
  temp.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (error) {
    ok = false;
  }
  temp.remove();
  return ok;
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => legacyCopy(text)
    );
  }
  return Promise.resolve(legacyCopy(text));
}

function onCopyClick(button) {
  const target = document.querySelector(button.getAttribute('data-wdp-copy-target') || '');
  const text = target ? target.value || target.textContent || '' : '';
  if (!text) return;
  copyText(text).then((ok) => {
    if (!ok) {
      announce(i18n.copyFailed || '');
      return;
    }
    const original = button.textContent;
    button.textContent = i18n.copied || 'Copied';
    announce((i18n.copied || 'Copied') + ': ' + text);
    window.setTimeout(() => {
      button.textContent = original;
    }, 1600);
  });
}

function applyType(panel, type) {
  panel.querySelectorAll('[data-wdp-type-card]').forEach((card) => {
    const input = card.querySelector('[data-wdp-type-input]');
    card.classList.toggle('is-selected', !!input && input.checked);
  });
  panel.querySelectorAll('[data-wdp-type-scope]').forEach((scope) => {
    const types = (scope.getAttribute('data-wdp-type-scope') || '').split(/\s+/);
    scope.hidden = types.indexOf(type) === -1;
  });
}

function activateTab() {
  const key = cfg.tabKey || 'wdp_donation';
  const link = document.querySelector('#woocommerce-product-data .' + key + '_options > a');
  if (!link) return false;
  link.click();
  return true;
}

function openFromHash() {
  const key = cfg.tabKey || 'wdp_donation';
  if (window.location.hash !== '#' + key) return;
  if (activateTab()) {
    const box = document.getElementById('woocommerce-product-data');
    if (box) box.scrollIntoView({ block: 'start' });
  }
}

function revealInvalid(event) {
  const control = event.target;
  if (!control || !control.closest) return;
  const panel = control.closest('[data-wdp-product-panel]');
  if (!panel) return;
  if (panel.offsetParent === null) activateTab();
  let scope = control.closest('[data-wdp-type-scope]');
  if (scope && scope.hidden) {
    // Gizli bir alanın geçersiz değeri ürün formunu sessizce engellemesin.
    control.value = control.defaultValue;
    return;
  }
  let details = control.closest('details');
  while (details) {
    details.open = true;
    details = details.parentElement ? details.parentElement.closest('details') : null;
  }
}

function initPanel(panel) {
  panel.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('[data-wdp-type-input]')) {
      applyType(panel, target.value);
    } else if (target.matches('[data-wdp-shortcode-select]')) {
      const output = panel.querySelector('[data-wdp-shortcode-output]');
      if (output) output.value = target.value;
    }
  });
  const output = panel.querySelector('[data-wdp-shortcode-output]');
  if (output) output.addEventListener('focus', () => output.select());
  const form = panel.closest('form');
  if (form) form.addEventListener('invalid', revealInvalid, true);
  const checked = panel.querySelector('[data-wdp-type-input]:checked');
  if (checked) applyType(panel, checked.value);
}

function init() {
  document.addEventListener('click', (event) => {
    const copy = event.target.closest('[data-wdp-copy-target]');
    if (copy) {
      event.preventDefault();
      onCopyClick(copy);
    }
  });
  const panels = document.querySelectorAll('[data-wdp-product-panel]');
  panels.forEach(initPanel);
  if (panels.length) {
    // WooCommerce sekme kancalarını sayfa hazır olunca bağlar; ondan sonra çalıştır.
    window.setTimeout(openFromHash, 0);
    window.addEventListener('hashchange', openFromHash);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

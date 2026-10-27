/**
 * Donation Panel — Experiences giriş noktası (yalnız form görünen sayfada yüklenir).
 */
import './base.css';
import { createForm } from './form.mjs';
import { createLayer } from './layer.mjs';

/**
 * @param {HTMLElement} root Kök.
 */
function mount(root) {
  if (root.dataset.dpMounted === '1') {
    return;
  }
  root.dataset.dpMounted = '1';
  createForm(root);
  if (root.dataset.dpKind !== 'inline') {
    const layer = createLayer(root);
    // "Sepete ekle, başka bağış seç": katman kapanır, bağışçı sayfada kalır.
    root.addEventListener('dp:added', () => layer && layer.close());
  } else {
    root.dataset.dpPresented = 'inline';
  }
}

function init() {
  document.querySelectorAll('[data-dp-exp]').forEach(mount);
}

// Sonradan eklenen formlar (ör. bağış listesi kartı) `dp:scan` olayıyla bağlanır.
document.addEventListener('dp:scan', init);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

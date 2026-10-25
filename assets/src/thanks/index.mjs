/**
 * Donation Panel — teşekkür ekranı: kutlama (sade konfeti) ve paylaşım. Yalnız ilgili öğe olan sayfada yüklenir.
 */
import '../campaign/base.css';
import './thanks.css';
import { prefersReducedMotion, confettiSpec, shareOrCopy } from './logic.mjs';

const CONFETTI_MS = 4500;

/**
 * Konfeti katmanını çizer (azaltılmış harekette çizmez).
 *
 * @param {Document} doc Belge.
 */
function celebrate(doc) {
  if (prefersReducedMotion(doc.defaultView)) {
    return;
  }
  const layer = doc.createElement('div');
  layer.className = 'dp dp-thanks-confetti';
  layer.setAttribute('aria-hidden', 'true');
  confettiSpec(26, Math.random).forEach((spec) => {
    const piece = doc.createElement('i');
    piece.style.setProperty('--x', `${spec.drift}px`);
    piece.style.setProperty('--r', `${spec.rotate}deg`);
    piece.style.setProperty('--w', `${spec.size}px`);
    piece.style.setProperty('--h', `${spec.size * spec.ratio}px`);
    piece.style.setProperty('--left', `${spec.left}%`);
    piece.style.setProperty('--dur', `${spec.duration}s`);
    piece.style.setProperty('--delay', `${spec.delay}s`);
    piece.dataset.dpTone = String(spec.tone);
    piece.dataset.dpRound = spec.round ? '1' : '0';
    layer.appendChild(piece);
  });
  doc.body.appendChild(layer);
  doc.defaultView.setTimeout(() => layer.remove(), CONFETTI_MS);
}

/**
 * Paylaşım düğmesini bağlar (Web Share API, yoksa bağlantıyı kopyalar).
 *
 * @param {HTMLElement} root Bölüm.
 */
function wireShare(root) {
  const button = root.querySelector('[data-dp-share]');
  const toast = root.querySelector('[data-dp-thanks-toast]');
  if (!button) {
    return;
  }
  button.hidden = false;
  button.addEventListener('click', async () => {
    const outcome = await shareOrCopy(window.navigator, {
      title: button.dataset.title || '',
      text: button.dataset.text || '',
      url: button.dataset.url || '',
    });
    if (toast && outcome !== 'shared' && outcome !== 'cancelled') {
      toast.textContent = outcome === 'copied' ? button.dataset.copied || '' : button.dataset.failed || '';
      toast.classList.remove('dp-sr');
      window.setTimeout(() => {
        toast.textContent = '';
        toast.classList.add('dp-sr');
      }, 3000);
    }
  });
}

function init() {
  document.querySelectorAll('[data-dp-thanks]').forEach((root) => {
    wireShare(root);
    if (root.dataset.celebrate === '1') {
      celebrate(document);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/**
 * Donation Panel — Experiences giriş noktası (yalnız form görünen sayfada yüklenir).
 */
import '../ui2-shared/controls.css';
import './base.css';
import { createForm } from './form.mjs';
import { createLayer } from './layer.mjs';

// Ana stil render engellemeyen yüklenmiş olabilir (media="print" + data-dp-defer): betik açılınca etkinleşir.
document.querySelectorAll('link[data-dp-defer]').forEach((link) => {
  link.media = 'all';
  link.removeAttribute('data-dp-defer');
});

/**
 * @param {HTMLElement} root Kök.
 */
function mount(root) {
  if (root.dataset.dpMounted === '1') {
    return;
  }
  root.dataset.dpMounted = '1';
  if (root.dataset.dpKind !== 'inline') {
    // Katman formu ihtiyaçta (yaklaşma/dokunma/ilk açılış) oluşturulur; form o anda bağlanır.
    const layer = createLayer(root, { onBuild: (built) => createForm(built) });
    // "Sepete ekle, başka bağış seç": katman kapanır, bağışçı sayfada kalır.
    root.addEventListener('dp:added', () => layer && layer.close());
  } else {
    createForm(root);
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

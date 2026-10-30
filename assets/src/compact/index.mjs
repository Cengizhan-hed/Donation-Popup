/**
 * Donation Panel — compact bağış kartı giriş noktası (yalnız kart çizilen sayfada yüklenir; stil satır içi gelir).
 * Canlı kampanya çubuğu ayrı `progress` paketindedir (kampanyalı kart çizilirken kuyruğa alınır).
 */
import './compact.css';
import { createCompact } from './card.mjs';

function init() {
  document.querySelectorAll('[data-dp-compact]').forEach((root) => {
    if (root.dataset.dpMounted === '1') {
      return;
    }
    root.dataset.dpMounted = '1';
    createCompact(root);
  });
}

// Sonradan eklenen kartlar (AJAX, kaydırıcı klonları) `dp:scan` olayıyla bağlanır.
document.addEventListener('dp:scan', init);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

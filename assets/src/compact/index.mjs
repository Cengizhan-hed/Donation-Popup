/**
 * Donation Panel — compact bağış kartı giriş noktası (yalnız kart çizilen sayfada yüklenir; stil satır içi gelir).
 */
import './compact.css';
// Canlı kampanya çubuğu: stil + betik `progress` paketinde (kampanyalı kart çizilirken kuyruğa alınır).
import { ensureLiveProgress } from '../ui2-shared/live-loader.mjs';
import { createCompact } from './card.mjs';

function init() {
  document.querySelectorAll('[data-dp-compact]').forEach((root) => {
    if (root.dataset.dpMounted === '1') {
      return;
    }
    root.dataset.dpMounted = '1';
    createCompact(root);
  });
  ensureLiveProgress();
}

// Sonradan eklenen kartlar (AJAX, kaydırıcı klonları) `dp:scan` olayıyla bağlanır.
document.addEventListener('dp:scan', init);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

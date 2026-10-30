/**
 * Donation Panel — Experiences giriş noktası (yalnız form görünen sayfada yüklenir).
 */
import '../ui2-shared/controls.css';
import './base.css';
import '../ui2-shared/states.css';
import { createForm } from './form.mjs';
import { createLayer } from './layer.mjs';
import { colorSyncNeeded, syncColors } from '../ui2-shared/color-sync.mjs';

/**
 * Renk eşitleme `getComputedStyle` okur (zorunlu stil hesabı; ağır tema CSS'inde pahalı). Dinamik renk işareti
 * işaretlemede yoksa hiç çalışmaz (iş kuyruğa da alınmaz); varsa ilk boyamadan sonra boşta çalışır. O ana dek sunucunun
 * yazdığı güvenli (kontrastlı) yedek yazı rengi görünür.
 *
 * @param {ParentNode} [scope] Kapsam.
 */
function syncColorsWhenIdle(scope) {
  if (!colorSyncNeeded(document)) {
    return;
  }
  const run = () => syncColors(scope);
  window.requestAnimationFrame(() => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 300 });
    } else {
      window.setTimeout(run, 0);
    }
  });
}

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
    const layer = createLayer(root, {
      onBuild: (built) => {
        createForm(built);
        syncColorsWhenIdle(built);
      },
    });
    // "Sepete ekle, başka bağış seç": katman kapanır, bağışçı sayfada kalır.
    root.addEventListener('dp:added', () => layer && layer.close());
  } else {
    createForm(root);
    root.dataset.dpPresented = 'inline';
  }
}

function init() {
  // Özel renk CSS değişkeniyle verildiyse düğme yazı rengi çözülen renge göre (yalnız gerekirse; boşta) ayarlanır.
  syncColorsWhenIdle();
  document.querySelectorAll('[data-dp-exp]').forEach(mount);
}

// Sonradan eklenen formlar (ör. bağış listesi kartı) `dp:scan` olayıyla bağlanır.
document.addEventListener('dp:scan', init);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

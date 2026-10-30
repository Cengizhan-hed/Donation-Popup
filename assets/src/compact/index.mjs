/**
 * Donation Panel — compact bağış kartı giriş noktası (yalnız kart çizilen sayfada yüklenir; stil satır içi gelir).
 * Canlı kampanya çubuğu ayrı `progress` paketindedir (kampanyalı kart çizilirken kuyruğa alınır).
 *
 * Tembel kurulum (12.3): kartın ilk durumu sunucuda eksiksiz çizilir (tutar seçili değil, pasif düğme, adım 1), betik
 * yüklemede yalnız kartları "hazır" işaretler. Denetleyici (dinleyiciler, kaydırıcı yalıtımı) kartın İLK etkileşiminde,
 * belge düzeyinde tek yakalama dinleyicisiyle kurulur: aynı olay kurulumdan sonra kart köküne ulaşır (yalıtım ve
 * radyo/alan dinleyicileri ilk olaydan itibaren çalışır). Yüklemede kart başına iş yok (6 kartlı slider dahil).
 */
import './compact.css';
import { createCompact } from './card.mjs';
import { installFocusModality } from '../ui2-shared/focus-modality.mjs';

installFocusModality();

/** Kurulumu tetikleyen ilk etkileşim olayları (dokunma, fare, klavye odağı, tekerlek). */
const TRIGGERS = ['pointerdown', 'mousedown', 'touchstart', 'focusin', 'keydown', 'wheel'];

/**
 * @param {Element} root Kart kökü.
 */
function mount(root) {
  if (root.dataset.dpMounted === '1') {
    return;
  }
  root.dataset.dpMounted = '1';
  createCompact(root);
}

/** Sayfadaki (ve sonradan eklenen) kartları hazır işaretler; denetleyici ilk etkileşimde kurulur. */
function arm() {
  document.querySelectorAll('[data-dp-compact]:not([data-dp-ready])').forEach((root) => {
    root.dataset.dpReady = '1';
  });
}

TRIGGERS.forEach((type) => {
  document.addEventListener(
    type,
    (event) => {
      const root = event.target instanceof Element ? event.target.closest('[data-dp-compact]') : null;
      if (root) {
        mount(root);
      }
    },
    { capture: true, passive: true }
  );
});

// Sonradan eklenen kartlar (AJAX, kaydırıcı klonları) `dp:scan` olayıyla hazır işaretlenir.
document.addEventListener('dp:scan', arm);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arm);
} else {
  arm();
}

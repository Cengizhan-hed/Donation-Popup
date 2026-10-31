/**
 * Donation Panel — Experiences giriş noktası (yalnız form görünen sayfada yüklenir).
 */
// Ortak çekirdek (ui-core), form denetimleri (ui-controls) ve alan parçaları + durum yalıtımı (ui-fields; compact kartla
// ortak) ayrı parça: Assets bu paketten önce bir kez basar.
import './base.css';
// Canlı kampanya çubuğu: stil + betik ayrı `progress` paketinde; yalnız kampanyalı form/kart sayfada çizilirken kuyruğa
// girer (kampanyasız sayfada bayt yok). Katmanda sonradan kurulan çubuğu paket `dp:open` olayıyla bağlar.
import { createForm } from './form.mjs';
import { createLayer } from './layer.mjs';
import { colorSyncNeeded, syncColors } from '../ui2-shared/color-sync.mjs';
import { installFocusModality } from '../ui2-shared/focus-modality.mjs';

// Belirgin odak halkası yalnız klavyede (metin alanlarında fare/dokunuşta yalnız ince kenarlık rengi).
installFocusModality();

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

/** Formu gerçekten bağlanmış (createForm çalışmış) sayfa içi kökler. Öznitelik değil: kopyalanan düğüm (ör. kaydırıcının
 * çoğalttığı slayt) özniteliği taşır ama dinleyicileri taşımaz; kopya ilk etkileşimde ayrıca bağlanır. */
const started = new WeakSet();
/** Bağlanmış (katman ya da tembel sayfa içi) kökler. */
const mounted = new WeakSet();
/** Görünür alana yaklaşınca (≈200 px) bağlama; görünmeyen slayt formları (yatayda kayan, kırpılmış) beklemede kalır. */
let observer = null;

/**
 * Sayfa içi formu şimdi bağlar (bir kez). Sunucu çıktısı betiğin ilk çizimiyle aynıdır; bağlama görsel bir şey değiştirmez.
 *
 * @param {HTMLElement} root Kök.
 */
function start(root) {
  if (started.has(root)) {
    return;
  }
  started.add(root);
  if (observer) {
    observer.unobserve(root);
  }
  createForm(root);
  root.dataset.dpReady = '1';
}

/** Kendi etkileşimini başlatan olaylar: form, olay hedefine ulaşmadan (yakalama evresinde) eşzamanlı bağlanır; olay
 * yeniden uygulanmaz, aynı olay yeni dinleyicilere doğal olarak ulaşır (DOM: hedefin dinleyici listesi hedefe varınca okunur). */
const WAKE_EVENTS = ['pointerdown', 'touchstart', 'mousedown', 'focusin', 'keydown', 'click', 'input', 'change', 'submit'];

/**
 * @param {Event} event Olay.
 */
function wakeFromEvent(event) {
  const target = event.target;
  const root = target && target.closest ? target.closest('[data-dp-exp][data-dp-kind="inline"]') : null;
  if (root && !started.has(root)) {
    mounted.add(root);
    start(root);
  }
}

/**
 * @param {HTMLElement} el Öğe.
 * @return {boolean} Gerçekten görünür mü (visibility/opacity; üst üste duran solma slaytları).
 */
function shown(el) {
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
  }
  return true;
}

/**
 * @param {HTMLElement} root Sayfa içi kök.
 */
function startWhenNear(root) {
  if (typeof window.IntersectionObserver !== 'function') {
    // Eski tarayıcı: ilk boyamadan sonra boşta bağlanır (etkileşim yine anında bağlar).
    const idle = window.requestIdleCallback || ((fn) => window.setTimeout(fn, 1));
    idle(() => start(root));
    return;
  }
  if (!observer) {
    observer = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Alanı sıfır kesişim (kırpan kabın kenarına bitişik sonraki slayt) sayılmaz.
          const area = entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0;
          if (entry.isIntersecting && area && shown(entry.target)) {
            start(entry.target);
          }
        });
      },
      // İkinci eşik: kenara bitişik (oran 0, "kesişiyor") slayt görünür alana girince geri çağrı yeniden gelsin.
      { rootMargin: '200px', threshold: [0, 0.01] }
    );
  }
  observer.observe(root);
}

/**
 * @param {HTMLElement} root Kök.
 */
function mount(root) {
  if (mounted.has(root)) {
    return;
  }
  mounted.add(root);
  // Öznitelik "bağlandı / etkileşime hazır" demektir (sayfa içi formda etkileşim formu eşzamanlı bağlar).
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
    // Dışarıdan dokunma niyeti (ör. liste/mağaza kartı): katman DOM'u + form şimdi kurulur, tıklamada yalnız gösterilir.
    root.addEventListener('dp:warm', () => layer && layer.warm());
  } else {
    root.dataset.dpPresented = 'inline';
    startWhenNear(root);
  }
}

function init() {
  // Özel renk CSS değişkeniyle verildiyse düğme yazı rengi çözülen renge göre (yalnız gerekirse; boşta) ayarlanır.
  syncColorsWhenIdle();
  document.querySelectorAll('[data-dp-exp]').forEach(mount);
}

// Paket sayfada bir kez çalışır: liste/mağaza kartı sayfasında betik ihtiyaçta (REST yanıtındaki doğrulanmış adresle)
// sonradan eklenir; sayfada zaten varsa ikinci kopya hiçbir dinleyici kurmaz.
if (!window.__dpExperiences) {
  window.__dpExperiences = true;
  // Tembel sayfa içi formlar: belge düzeyinde tek yakalama dinleyicisi (form başına dinleyici yok; kopyalanan slaytlar da kapsanır).
  WAKE_EVENTS.forEach((type) => document.addEventListener(type, wakeFromEvent, { capture: true, passive: true }));
  // Sonradan eklenen formlar (ör. bağış listesi kartı) `dp:scan` olayıyla bağlanır.
  document.addEventListener('dp:scan', init);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

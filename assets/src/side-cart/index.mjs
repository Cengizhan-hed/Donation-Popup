/**
 * Donation Panel — Yan sepet BAŞLATICISI (sayfa yüklemesinde gelen tek parça; küçük). Çekmecenin etkileşim kodu
 * (`side-cart-drawer`) sayfa yüklemesinde yok: ilk gerektiğinde sunucu gövde yanıtıyla (GET donation-panel/v1/side-cart)
 * birlikte gelen, doğrulanmış adresten bir kez eklenir (DOM özniteliğinden adres okunmaz):
 *  - sepet doluyken sayfa yüklendikten sonra boşta (sayaç/gövde tazelenir; eskisi gibi),
 *  - açma niyetinde (sepet düğmesine basma/üstüne gelme/odak) ve bağış formu açıldığında (sepete ekleme olası),
 *  - sepete eklenince (wc-blocks_added_to_cart, added_to_cart (jQuery varsa), donation-panel:cart-added).
 * Sepet boşken ve etkileşim yokken hiçbir istek yapılmaz. Tema/oluşturucuya özel kod yok.
 */
// Ortak çekirdek (ui-core) ve yüzey belirteçleri (ui-dpx) ayrı parça; Assets bu paketten önce bir kez basar.
import './side-cart.css';
import { itemsInCart, trustedDrawerUrl } from './logic.mjs';

const OPENERS = '[data-dp-sc-open], [data-dp-sc-fab]';

/** Çekmece denetleyicisi sözü (bir kez); başarısızsa düşer, sonraki niyette yeniden denenir. */
let pending = null;

/**
 * Gövde yanıtını alır, çekmece paketini (bir kez) yükler ve bağlar.
 *
 * @param {HTMLElement} root Çekmece kökü.
 * @return {Promise<{open: function(HTMLElement=): void, onAdded: function(): Promise<void>}>} Denetleyici.
 */
function ensureDrawer(root) {
  if (!pending) {
    const url = new URL(root.dataset.dpScRest || '', window.location.href);
    url.searchParams.set('_', String(Date.now()));
    pending = window
      .fetch(url.toString(), { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then(
        (data) =>
          new Promise((resolve, reject) => {
            const ready = () => {
              const controller = window.__dpScDrawer && window.__dpScDrawer.mount(root, data);
              return controller ? resolve(controller) : reject(new Error('drawer'));
            };
            if (window.__dpScDrawer) {
              ready();
              return;
            }
            const src = trustedDrawerUrl(data && data.drawer, window.location.href);
            if (!src) {
              reject(new Error('drawer'));
              return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = ready;
            script.onerror = () => reject(new Error('drawer'));
            document.head.appendChild(script);
          })
      );
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}

/**
 * Sayfa yüklendikten ve tarayıcı boşa çıktıktan sonra çalıştırır.
 *
 * @param {function(): void} task Görev.
 */
function whenIdle(task) {
  const run = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(task, { timeout: 4000 });
    } else {
      window.setTimeout(task, 1500);
    }
  };
  if (document.readyState === 'complete') {
    run();
  } else {
    window.addEventListener('load', run, { once: true });
  }
}

/**
 * @param {HTMLElement} root Çekmece kökü.
 */
function mount(root) {
  if (root.dataset.dpScMounted === '1') {
    return;
  }
  root.dataset.dpScMounted = '1';
  const warm = () => {
    ensureDrawer(root).catch(() => {});
  };

  document.addEventListener('click', (event) => {
    const el = event.target instanceof Element ? event.target : null;
    const opener = el ? el.closest(OPENERS) : null;
    if (!opener) {
      return;
    }
    event.preventDefault();
    ensureDrawer(root).then(
      (drawer) => drawer.open(opener),
      () => {
        // Çekmece kurulamadı (ağ): bağlantıysa varsayılan hedefine gidilir.
        if (opener.getAttribute('href')) {
          window.location.assign(opener.getAttribute('href'));
        }
      }
    );
  });
  // Açma niyeti: paket ve gövde tıklamadan önce hazır olsun.
  ['pointerdown', 'pointerover', 'focusin'].forEach((type) =>
    document.addEventListener(
      type,
      (event) => {
        if (!pending && event.target instanceof Element && event.target.closest(OPENERS)) {
          warm();
        }
      },
      { capture: true, passive: true }
    )
  );
  // Bağış formu açıldı: sepete ekleme olası, çekmece eklemeden önce hazır olsun.
  document.addEventListener('dp:open', warm);

  // WooCommerce standart olayları / form: sepete eklenince güncelle ve aç.
  const onAdded = () => {
    // Paket şimdi (eklemeden sonra) alınıyorsa gelen gövde zaten günceldir: ikinci istek yok.
    const cold = !pending;
    ensureDrawer(root).then(
      (drawer) => (cold ? drawer.open() : drawer.onAdded()),
      () => {}
    );
  };
  document.addEventListener('wc-blocks_added_to_cart', onAdded);
  document.addEventListener('donation-panel:cart-added', onAdded);
  const jq = window.jQuery;
  if (jq && jq.fn && typeof jq.fn.on === 'function') {
    jq(document.body).on('added_to_cart', onAdded);
  }

  // Yüzen düğme yalnız sepette bağış varken görünür (boşken gizli, istek yok). Sayfa önbelleğe alınmış olabilir: sepet
  // doluysa taze sayaç/gövde sayfa yüklendikten sonra boşta alınır (ilk boyamayı/LCP'yi geciktirmez).
  if (itemsInCart(document.cookie) > 0) {
    const fab = root.querySelector('[data-dp-sc-fab]');
    if (fab && fab.hidden) {
      fab.hidden = false;
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        fab.classList.add('is-entering');
        window.setTimeout(() => fab.classList.remove('is-entering'), 600);
      }
    }
    whenIdle(warm);
  }
}

function init() {
  document.querySelectorAll('[data-dp-sc]').forEach(mount);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

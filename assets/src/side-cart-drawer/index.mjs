/**
 * Donation Panel — Yan sepet çekmecesi (etkileşim parçası). Alt panel: dar ekran; yan panel: geniş ekran.
 * Sayfa yüklemesinde YOK: `side-cart` başlatıcısı ilk gerektiğinde (sepet doluyken boşta, açma niyeti, sepete ekleme)
 * sunucu yanıtındaki doğrulanmış adresten bir kez ekler ve `mount(root, data)` ile ilk gövdeyi verir.
 * Veri: WooCommerce Store API (kaldır/miktar) + sunucuda çizilen gövde (GET donation-panel/v1/side-cart). jQuery yok.
 * Tema/oluşturucuya özel kod yok.
 */
import { isTopmost, lockPage, unlockPage } from '../ui2-shared/scroll-lock.mjs';
import { syncColors } from '../ui2-shared/color-sync.mjs';
import { itemsInCart, nextFocusIndex, nextQuantity, readNonce, shouldDismissOnDrag, toCount } from '../side-cart/logic.mjs';
import { installFocusModality } from '../ui2-shared/focus-modality.mjs';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * @param {HTMLElement} root    Çekmece kökü.
 * @param {object|null} initial Başlatıcının aldığı ilk gövde yanıtı (GET side-cart).
 * @return {{open: function(HTMLElement=): void, onAdded: function(): Promise<void>}|null} Denetleyici.
 */
function mount(root, initial) {
  const overlay = root.querySelector('[data-dp-sc-overlay]');
  const surface = root.querySelector('[data-dp-sc-surface]');
  const body = root.querySelector('[data-dp-sc-body]');
  if (!overlay || !surface || !body) {
    return null;
  }
  const restUrl = root.dataset.dpScRest || '';
  const storeUrl = root.dataset.dpScStore || '';
  const failedMessage = root.dataset.dpScFailed || '';
  const addUrl = root.dataset.dpScAdd || '';
  const nonceUrl = root.dataset.dpScNonce || '';
  const sub = root.querySelector('[data-dp-sc-sub]');
  let nonce = '';
  let opened = false;
  let lastFocus = null;
  let busy = false;
  let refreshSeq = 0;
  // Önbellek sözleşmesi: sunucu kabuğu tüm ziyaretçiler için boş iskelettir; içerik yalnız REST ile gelir.
  let lastRefresh = 0;

  const triggers = () => Array.from(document.querySelectorAll('[data-dp-sc-open], [data-dp-sc-fab]'));

  const visibleFocusables = () =>
    Array.from(surface.querySelectorAll(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);

  const fab = root.querySelector('[data-dp-sc-fab]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /**
   * Yüzen düğme: yalnız sepette bağış varken görünür (boşken gizli, istek yok); animasyonla belirir.
   *
   * @param {boolean} visible Görünsün mü.
   */
  const showFab = (visible) => {
    if (!fab) {
      return;
    }
    if (visible && fab.hidden) {
      fab.hidden = false;
      if (!reduced.matches) {
        fab.classList.add('is-entering');
        window.setTimeout(() => fab.classList.remove('is-entering'), 600);
      }
    } else if (!visible) {
      fab.hidden = true;
    }
  };

  /** "Başka bağış ekle": düğme kısa süre vurgulanır. */
  const pulseFab = () => {
    if (!fab || fab.hidden || reduced.matches) {
      return;
    }
    fab.classList.remove('is-pulse');
    void fab.offsetWidth;
    fab.classList.add('is-pulse');
    window.setTimeout(() => fab.classList.remove('is-pulse'), 1400);
  };

  const setCount = (count) => {
    const n = toCount(count);
    document.querySelectorAll('[data-dp-sc-count]').forEach((badge) => {
      badge.textContent = String(n);
      badge.hidden = n === 0;
    });
    showFab(n > 0);
  };

  const showError = () => {
    if (!failedMessage) {
      return;
    }
    let alert = body.querySelector('[data-dp-sc-error]');
    if (!alert) {
      alert = document.createElement('p');
      alert.className = 'donation-panel-sc__error';
      alert.setAttribute('role', 'alert');
      alert.setAttribute('data-dp-sc-error', '');
      body.prepend(alert);
    }
    alert.textContent = failedMessage;
  };

  /**
   * Sunucu gövde yanıtını çekmeceye uygular.
   *
   * @param {any} data Yanıt (GET side-cart).
   * @return {boolean} Uygulandı mı.
   */
  function apply(data) {
    if (!data || typeof data.html !== 'string') {
      return false;
    }
    body.innerHTML = data.html;
    if (sub && typeof data.sub === 'string') {
      sub.textContent = data.sub;
    }
    setCount(data.count);
    lastRefresh = Date.now();
    document.dispatchEvent(new CustomEvent('donation-panel:cart-updated', { detail: { count: toCount(data.count) } }));
    return true;
  }

  /**
   * Gövdeyi sunucudan yeniden çizer.
   *
   * @return {Promise<boolean>} Başarılı mı.
   */
  async function refresh() {
    if (!restUrl) {
      return false;
    }
    refreshSeq += 1;
    const mine = refreshSeq;
    try {
      const url = new URL(restUrl, window.location.href);
      url.searchParams.set('_', String(Date.now()));
      const response = await window.fetch(url.toString(), { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      if (mine !== refreshSeq) {
        // Daha yeni bir yenileme başladı: eski yanıt gövdeyi ezmesin (yarış).
        return true;
      }
      if (apply(data)) {
        return true;
      }
    } catch {
      return false;
    } finally {
      if (mine === refreshSeq) {
        body.removeAttribute('aria-busy');
      }
    }
    return false;
  }

  /**
   * Store API nonce'ı (ilk istekte ya da 403 sonrası taze).
   *
   * @param {boolean} force Yeniden al.
   * @return {Promise<string>} Nonce.
   */
  async function getNonce(force) {
    if (nonce && !force) {
      return nonce;
    }
    const response = await window.fetch(`${storeUrl}cart`, { credentials: 'same-origin', cache: 'no-store' });
    nonce = readNonce(response.headers);
    return nonce;
  }

  /**
   * Store API yazma isteği (403'te bir kez nonce tazeler).
   *
   * @param {string} path Uç (ör. cart/remove-item).
   * @param {Object} payload Gövde.
   * @return {Promise<boolean>} Başarılı mı.
   */
  async function storePost(path, payload) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await getNonce(attempt > 0);
      const response = await window.fetch(`${storeUrl}${path}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Nonce: token },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        // Store API yanıtı güncel sepettir: sayfadaki kampanya çubukları ek istek olmadan güncellenir.
        response
          .json()
          .then((cart) => document.dispatchEvent(new CustomEvent('donation-panel:cart-data', { detail: { cart } })))
          .catch((error) => window.console.debug('donation-panel: sepet yanıtı okunamadı', error));
        return true;
      }
      if (response.status !== 403) {
        return false;
      }
    }
    return false;
  }

  /**
   * Bir satırda işlem yapar (kaldır / miktar), sonra yeniden çizer.
   *
   * @param {HTMLElement} control Tıklanan düğme.
   * @param {string} path Store API ucu.
   * @param {Object} payload Gövde.
   */
  async function mutate(control, path, payload) {
    if (busy) {
      return;
    }
    busy = true;
    const row = control.closest('[data-dp-sc-line]');
    if (row) {
      row.setAttribute('aria-busy', 'true');
      row.querySelectorAll('button').forEach((b) => {
        b.disabled = true;
      });
    }
    body.setAttribute('aria-busy', 'true');
    const ok = await storePost(path, payload).catch(() => false);
    const redrawn = ok ? await refresh() : false;
    busy = false;
    body.removeAttribute('aria-busy');
    if (!ok || !redrawn) {
      if (row && row.isConnected) {
        row.removeAttribute('aria-busy');
        row.querySelectorAll('button').forEach((b) => {
          b.disabled = false;
        });
      }
      showError();
      return;
    }
    const target = body.querySelector('[data-dp-sc-remove],[data-dp-sc-close]') || surface;
    target.focus();
  }

  /**
   * Ek bağış önerisini sepete ekler (formun kullandığı sunucu ucu: cart/add; sunucuda doğrulanır).
   *
   * @param {HTMLElement} control Tıklanan tutar düğmesi.
   */
  async function addSuggestion(control) {
    if (busy || !addUrl) {
      return;
    }
    busy = true;
    control.disabled = true;
    body.setAttribute('aria-busy', 'true');
    let ok;
    try {
      let wpNonce = '';
      if (nonceUrl) {
        const fresh = await window.fetch(nonceUrl, { credentials: 'same-origin', cache: 'no-store' });
        wpNonce = fresh.ok ? (await fresh.json()).nonce || '' : '';
      }
      const response = await window.fetch(addUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(wpNonce ? { 'X-WP-Nonce': wpNonce } : {}) },
        body: JSON.stringify({ amount: control.dataset.amount || '' }),
      });
      ok = response.ok;
    } catch {
      ok = false;
    }
    const redrawn = ok ? await refresh() : false;
    busy = false;
    body.removeAttribute('aria-busy');
    if (!ok || !redrawn) {
      control.disabled = false;
      showError();
    }
  }

  let pushed = false;
  let closeTimer = 0;
  const onPop = () => {
    if (opened && pushed && !(window.history.state && window.history.state.dpScDrawer)) {
      pushed = false;
      close();
    }
  };

  function open(opener) {
    if (opened) {
      return;
    }
    window.clearTimeout(closeTimer);
    opened = true;
    // WebKit düğmeye tıklayınca odak vermez: odak dönüşü için tıklanan öğe açıkça saklanır.
    lastFocus = opener || document.activeElement;
    // Kilit (ve kaydırma çubuğu ölçümü) gösterimden ÖNCE: açılış karesinde ikinci düzen hesabı ve yana kayma olmasın.
    // Yerel kipli diyalogda arka plan inert'i tarayıcıdadır (native).
    lockPage('side-cart', root, 'donation-panel-sc-lock', { native: typeof overlay.showModal === 'function' });
    // <dialog> üst katmanı: başka eklentilerin yüzen öğeleri çekmecenin üstüne çıkamaz.
    if (typeof overlay.showModal === 'function') {
      if (!overlay.open) {
        overlay.showModal();
      }
    } else {
      overlay.setAttribute('open', '');
    }
    void overlay.offsetWidth;
    overlay.classList.add('is-open');
    triggers().forEach((t) => t.setAttribute('aria-expanded', 'true'));
    const first = visibleFocusables()[0];
    (first || surface).focus();
    window.addEventListener('popstate', onPop);
    try {
      window.history.pushState({ ...(window.history.state || {}), dpScDrawer: true }, '');
      pushed = true;
    } catch {
      pushed = false;
    }
    // Sepeti dolu ziyaretçide ilk içerik gelene kadar boş durum iskeleti gizli kalır (yanlış "sepet boş" yok).
    if (!lastRefresh && itemsInCart(document.cookie) > 0) {
      body.setAttribute('aria-busy', 'true');
    }
    // Az önce yenilendiyse (ekleme olayı) ikinci istek yapılmaz.
    if (Date.now() - lastRefresh > 1500) {
      refresh();
    }
  }

  function close() {
    if (!opened) {
      return;
    }
    opened = false;
    overlay.classList.remove('is-open');
    unlockPage('side-cart');
    triggers().forEach((t) => t.setAttribute('aria-expanded', 'false'));
    surface.style.removeProperty('--dp-sc-drag');
    window.removeEventListener('popstate', onPop);
    if (pushed) {
      pushed = false;
      if (window.history.state && window.history.state.dpScDrawer) {
        window.history.back();
      }
    }
    const returnTo = lastFocus;
    lastFocus = null;
    closeTimer = window.setTimeout(
      () => {
        if (overlay.open) {
          overlay.close();
        }
        overlay.removeAttribute('open');
        // Odak dönüşü dialog kapandıktan sonra (modal açıkken arka plan inert; WebKit odağı kabul etmez).
        if (!opened && returnTo && typeof returnTo.focus === 'function' && returnTo.isConnected && !returnTo.hidden) {
          returnTo.focus();
        }
      },
      reduced.matches ? 0 : 260
    );
  }

  // Esc: yerel kapatma yerine kendi akışımız (animasyon, odak dönüşü, geri tuşu).
  overlay.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });

  document.addEventListener('keydown', (event) => {
    if (!opened || !isTopmost('side-cart')) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const items = visibleFocusables();
    event.preventDefault();
    const index = nextFocusIndex(items.length, items.indexOf(document.activeElement), event.shiftKey);
    (index < 0 ? surface : items[index]).focus();
  });

  document.addEventListener('click', (event) => {
    const el = event.target instanceof Element ? event.target : null;
    if (!el) {
      return;
    }
    // Açma düğmeleri başlatıcıda (side-cart) yakalanır.
    if (!root.contains(el)) {
      return;
    }
    if (el === overlay || el.closest('[data-dp-sc-close]')) {
      const another = Boolean(el.closest('[data-dp-sc-close]')) && Boolean(el.closest('.donation-panel-sc__bar'));
      close();
      if (another) {
        pulseFab();
      }
      return;
    }
    const suggest = el.closest('[data-dp-sc-suggest]');
    if (suggest) {
      addSuggestion(suggest);
      return;
    }
    const remove = el.closest('[data-dp-sc-remove]');
    if (remove) {
      mutate(remove, 'cart/remove-item', { key: remove.dataset.dpScKey });
      return;
    }
    const qty = el.closest('[data-dp-sc-qty]');
    if (qty) {
      const row = qty.closest('[data-dp-sc-line]');
      const next = nextQuantity(row ? row.dataset.qty : 1, qty.dataset.dpScQty);
      mutate(qty, 'cart/update-item', { key: qty.dataset.dpScKey, quantity: next });
    }
  });

  // Alttan panel: tutamaç/başlıktan aşağı sürükleyerek kapatma.
  const grip = root.querySelector('.donation-panel-sc__handle');
  const head = root.querySelector('.donation-panel-sc__head');
  [grip, head].forEach((zone) => {
    if (!zone) {
      return;
    }
    let startY = null;
    zone.addEventListener('pointerdown', (event) => {
      if (event.target instanceof Element && event.target.closest('button')) {
        return;
      }
      if (!window.matchMedia('(max-width: 639.98px)').matches) {
        return;
      }
      startY = event.clientY;
      surface.classList.add('is-dragging');
      zone.setPointerCapture(event.pointerId);
    });
    zone.addEventListener('pointermove', (event) => {
      if (startY === null) {
        return;
      }
      surface.style.setProperty('--dp-sc-drag', `${Math.max(0, event.clientY - startY)}px`);
    });
    const end = (event) => {
      if (startY === null) {
        return;
      }
      const distance = event.clientY - startY;
      startY = null;
      surface.classList.remove('is-dragging');
      if (shouldDismissOnDrag(distance)) {
        close();
      } else {
        surface.style.removeProperty('--dp-sc-drag');
      }
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  });

  // Başlatıcının aldığı ilk gövde: ikinci istek yok (açılışta 1,5 sn içinde yeniden alınmaz).
  apply(initial);
  // Özel renk CSS değişkeniyle verildiyse düğme yazı rengi (yalnız gerekirse; sepet simgesi kökün dışında olabilir).
  syncColors();

  return {
    open,
    // WooCommerce standart olayları / form: sepete eklenince güncelle ve aç.
    onAdded: async () => {
      await refresh();
      open();
    },
  };
}

// Başlatıcıya tek giriş noktası (paket sayfada bir kez).
if (!window.__dpScDrawer) {
  installFocusModality();
  window.__dpScDrawer = { mount };
}

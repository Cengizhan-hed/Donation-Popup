/**
 * Donation Panel — bağış listesi: kategori süzgeci (sekmeler) ve kart düğmesiyle formu açma.
 *
 * Form sayfa HTML'ine basılmaz (sayfa önbelleğe uygun, nonce yok). Kart görünür alana yaklaşınca, sayfa yüklendikten
 * sonra boşta, aynı REST kökü + kap türündeki kartların formları TEK istekte (`GET donation-panel/v1/experiences?ids=…`,
 * en çok 12) önceden alınır; dokunma niyetinde (üstüne gelme/basma/odak) eksikse hemen alınır ve katman DOM'u kurulur.
 * Dokunuşta form hazırsa ağ isteği yoktur. Veri tasarrufu/2G'de yalnız niyetle alınır. JS yoksa düğme ürün sayfasına gider.
 */
import './list.css';
import {
  buildBatchUrl,
  buildExperienceUrl,
  chunk,
  hostKey,
  matchesCategory,
  parseHashSlug,
  shouldHandleClick,
  shouldPrefetchAhead,
  uniqueIds,
} from './logic.mjs';

const MOUNT_WAIT_MS = 5000;

/**
 * @param {HTMLElement} wrap Liste kökü.
 * @return {HTMLElement[]} Sekmeler.
 */
function tabsOf(wrap) {
  return Array.from(wrap.querySelectorAll('[data-wdp-tab]'));
}

/**
 * Sekmeyi etkinleştirir, kartları süzer.
 *
 * @param {HTMLElement} wrap    Liste kökü.
 * @param {HTMLElement} tab     Sekme.
 * @param {boolean}     fromUrl Adres çubuğundan mı (adres yeniden yazılmaz).
 */
function setTab(wrap, tab, fromUrl) {
  const slug = tab.getAttribute('data-wdp-tab') || 'all';
  tabsOf(wrap).forEach((item) => {
    const on = item === tab;
    item.classList.toggle('is-active', on);
    if (on) {
      item.setAttribute('aria-current', 'true');
    } else {
      item.removeAttribute('aria-current');
    }
  });
  const list = wrap.querySelector('.wdp-list');
  if (list && tab.id) {
    list.setAttribute('aria-labelledby', tab.id);
  }
  wrap.querySelectorAll('.wdp-list__item').forEach((item) => {
    item.hidden = !matchesCategory(item.getAttribute('data-wdp-cats') || '', slug);
  });
  if (!fromUrl && window.history && typeof window.history.replaceState === 'function') {
    const hash = tab.getAttribute('data-wdp-hash');
    const base = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', hash ? `${base}#${hash}` : base);
  }
}

/**
 * @param {HTMLElement} wrap Liste kökü.
 */
function bindTabs(wrap) {
  const nav = wrap.querySelector('[data-wdp-tabs]');
  if (!nav) {
    return;
  }
  nav.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-wdp-tab]');
    if (tab && nav.contains(tab)) {
      event.preventDefault();
      setTab(wrap, tab, false);
    }
  });
  const slug = parseHashSlug(window.location.hash);
  if (slug) {
    const tab = tabsOf(wrap).find((item) => item.getAttribute('data-wdp-tab') === slug);
    if (tab) {
      setTab(wrap, tab, true);
    }
  }
}

/**
 * Form kökü bağlanana kadar bekler (zaten bağlıysa beklemeden).
 *
 * @param {HTMLElement} host Kap sarmalayıcısı.
 * @return {Promise<HTMLElement|null>} Bağlanmış kök ya da zaman aşımında null.
 */
function whenMounted(host) {
  const ready = () => host.querySelector('[data-dp-exp][data-dp-mounted="1"]');
  if (!ready()) {
    document.dispatchEvent(new CustomEvent('dp:scan'));
  }
  const now = ready();
  if (now) {
    return Promise.resolve(now);
  }
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      const root = ready();
      if (root) {
        resolve(root);
      } else if (Date.now() - started > MOUNT_WAIT_MS) {
        resolve(null);
      } else {
        window.setTimeout(check, 40);
      }
    };
    check();
  });
}

/**
 * Sayfa genelinde iki önbellek; anahtar = REST kökü + ürün + kap türü (liste ve mağaza kartı paylaşır; aynı ürün bir
 * kez alınır, bir kez kurulur):
 *  - `sources`: sunucudan gelen form HTML'i (metin). Ön alma YALNIZ bunu doldurur: boşta ağ + JSON, DOM işi yok.
 *  - `hosts`: DOM'a eklenmiş kap; dokunma niyetinde (üstüne gelme/basma/odak) ya da dokunuşta kurulur.
 *
 * @type {Map<string, Promise<{html: function(): (string|Promise<string>)}>>}
 */
const sources = new Map();
/** @type {Map<string, Promise<HTMLElement>>} */
const hosts = new Map();
/** Sunucu toplu ön almayı kapattıysa (`prefetch:false`, filtre) sayfa boyunca yalnız niyetle alınır. */
let aheadDisabled = false;

/**
 * Form hazır (dokunuşta ağ isteği olmayacak): kartın düğmelerine `data-wdp-ready="1"` (testler/ölçüm bunu bekler).
 *
 * @param {string} id Ürün kimliği.
 */
function markReady(id) {
  document.querySelectorAll(`[data-wdp-form="${String(id).replace(/[^0-9]/g, '')}"]`).forEach((cta) => {
    if (cta.dataset.wdpReady !== '1') {
      cta.dataset.wdpReady = '1';
    }
  });
}

/**
 * @param {string} url Adres.
 * @return {Promise<any>} JSON gövde.
 */
async function getJson(url) {
  const response = await window.fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(String(response.status));
  }
  return response.json();
}

/**
 * Söz önbelleğe girer; başarısız olursa düşer (dokunuşta tek istekle yeniden denenir).
 *
 * @param {Map<string, Promise<any>>} map Önbellek.
 * @param {string} key Anahtar.
 * @param {Promise<any>} pending Söz.
 * @return {Promise<any>} Aynı söz.
 */
function remember(map, key, pending) {
  map.set(key, pending);
  pending.catch(() => {
    if (map.get(key) === pending) {
      map.delete(key);
    }
  });
  return pending;
}

/**
 * Formun HTML'i: ön alındıysa önbellekten, değilse şimdi tek istekle.
 *
 * @param {string} rest Kök REST adresi.
 * @param {string} id   Ürün kimliği.
 * @param {string} kind Kap türü.
 * @return {Promise<{html: function(): (string|Promise<string>)}>} HTML'i (gerekirse ertelenmiş çözümle) veren nesne.
 */
function ensureSource(rest, id, kind) {
  const key = hostKey(rest, id, kind);
  return (
    sources.get(key) ||
    remember(
      sources,
      key,
      getJson(buildExperienceUrl(rest, id, kind)).then((data) => {
        if (!data || typeof data.html !== 'string' || data.html === '') {
          throw new Error('empty');
        }
        markReady(id);
        return { html: () => data.html };
      })
    )
  );
}

/**
 * HTML: önbellekteki kaynak çözülemezse (toplu yanıtta yoksa) bir kez tek istekle yeniden alınır.
 *
 * @param {string} rest Kök REST adresi.
 * @param {string} id   Ürün kimliği.
 * @param {string} kind Kap türü.
 * @return {Promise<string>} HTML.
 */
async function sourceHtml(rest, id, kind) {
  try {
    return await (await ensureSource(rest, id, kind)).html();
  } catch {
    sources.delete(hostKey(rest, id, kind));
    return (await ensureSource(rest, id, kind)).html();
  }
}

/**
 * Gizli kap (katman `<dialog>` kapalı: yerleşmez, boyanmaz); form deneyimi `dp:scan` ile bağlanır (yalnız dinleyiciler).
 *
 * @param {string} rest Kök REST adresi.
 * @param {string} id   Ürün kimliği.
 * @param {string} kind Kap türü.
 * @return {Promise<HTMLElement>} Kap.
 */
function ensureHost(rest, id, kind) {
  const key = hostKey(rest, id, kind);
  return (
    hosts.get(key) ||
    remember(
      hosts,
      key,
      sourceHtml(rest, id, kind).then((html) => {
        const host = document.createElement('div');
        host.className = 'wdp-form-host';
        const template = document.createElement('template');
        template.innerHTML = html;
        host.appendChild(template.content);
        document.body.appendChild(host);
        host.addEventListener('dp:closed', () => {
          if (host.wdpCta && host.wdpCta.isConnected) {
            host.wdpCta.focus({ preventScroll: true });
          }
        });
        return host;
      })
    )
  );
}

/**
 * Bir REST kökü + kap türü için birden çok ürünün form HTML'ini tek istekte (en çok 12) önceden alır; önbellekte
 * olanlar istenmez. DOM'a dokunmaz (boşta yalnız ağ + JSON çözme; ana iş parçacığı yükü yok denecek kadar az).
 *
 * @param {string}   rest Kök REST adresi.
 * @param {string}   kind Kap türü.
 * @param {string[]} ids  Ürünler.
 */
function prefetchBatch(rest, kind, ids) {
  const todo = uniqueIds(ids).filter((id) => !sources.has(hostKey(rest, id, kind)));
  chunk(todo).forEach((part) => {
    // Gövde Blob olarak saklanır (JS yığınına alınmaz, metin çözümü yok); metin + JSON çözümü ilk dokunma niyetinde
    // (boşta ana iş parçacığı yükü yok denecek kadar az).
    const request = window
      .fetch(buildBatchUrl(rest, part, kind), { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) {
          throw new Error(String(response.status));
        }
        return response.blob();
      });
    let parsed = null;
    const items = (blob) => {
      if (!parsed) {
        parsed = blob.text().then((text) => {
          const data = JSON.parse(text);
          if (data && data.prefetch === false) {
            aheadDisabled = true;
          }
          return (data && data.items) || {};
        });
      }
      return parsed;
    };
    part.forEach((id) => {
      const key = hostKey(rest, id, kind);
      const lazy = request.then(async (blob) => {
        // Kısa yanıt (ön alma kapalı / ürün yok) hemen çözülür: hazır işareti yalnız gerçekten gelen forma.
        if (blob.size < 512 && typeof (await items(blob))[id] !== 'string') {
          throw new Error('missing');
        }
        markReady(id);
        // Çözümü erteleyen nesne: kap ilk kez kurulurken çözülür.
        return {
          html: async () => {
            const html = (await items(blob))[id];
            if (typeof html !== 'string' || html === '') {
              throw new Error('missing');
            }
            return html;
          },
        };
      });
      remember(sources, key, lazy).catch(() => {}); // Hata dokunuşta ele alınır (tek istekle yeniden denenir).
    });
  });
}

/**
 * Kart düğmesinin özellikleri (düğmenin kendisinden ya da liste kökünden).
 *
 * @param {HTMLElement} cta Düğme.
 * @return {{rest: string, kind: string, id: string}|null} Özellikler.
 */
function ctaInfo(cta) {
  const source = cta.getAttribute('data-wdp-rest') ? cta : cta.closest('.wdp-list-wrap[data-wdp-rest]');
  const id = cta.getAttribute('data-wdp-form');
  if (!source || !id) {
    return null;
  }
  return { rest: source.getAttribute('data-wdp-rest') || '', kind: source.getAttribute('data-wdp-kind') || 'popup', id };
}

/**
 * Dokunma niyeti (üstüne gelme, basma, odak): form henüz yoksa hemen alınır; hazırsa katman DOM'u kurulur
 * (`dp:warm`), böylece tıklamada yalnız gösterilir.
 *
 * @param {HTMLElement} cta Düğme.
 */
function warmCta(cta) {
  const info = ctaInfo(cta);
  if (!info) {
    return;
  }
  ensureHost(info.rest, info.id, info.kind).then(
    (host) => whenMounted(host).then((root) => root && root.dispatchEvent(new CustomEvent('dp:warm'))),
    () => {} // Hata dokunuşta ele alınır (tek istekle yeniden denenir; olmazsa ürün sayfasına gidilir).
  );
}

/**
 * Ürün formunu (önbellekten ya da şimdi) alır ve katmanı açar. Önceden alındıysa ağ isteği yoktur.
 *
 * @param {HTMLElement} cta Tıklanan düğme.
 */
async function openForm(cta) {
  const info = ctaInfo(cta);
  const waiting = !sources.has(hostKey(info.rest, info.id, info.kind));
  if (waiting) {
    cta.classList.add('is-loading');
    cta.setAttribute('aria-busy', 'true');
  }
  let host;
  try {
    host = await ensureHost(info.rest, info.id, info.kind);
  } catch {
    window.location.assign(cta.href);
    return;
  } finally {
    if (waiting) {
      cta.classList.remove('is-loading');
      cta.removeAttribute('aria-busy');
    }
  }
  host.wdpCta = cta;
  const root = await whenMounted(host);
  const trigger = root && root.querySelector('[data-dp-open]');
  if (!trigger) {
    window.location.assign(cta.href);
    return;
  }
  trigger.click();
}

/** Görünür alana yaklaşan kart düğmeleri: REST kökü + kap türüne göre gruplanır, yükleme bitince boşta toplu alınır. */
const queued = new Map();
let flushScheduled = false;
let observer = null;

function flushQueued() {
  flushScheduled = false;
  if (!aheadDisabled) {
    queued.forEach((ids, group) => {
      const [rest, kind] = JSON.parse(group);
      prefetchBatch(rest, kind, Array.from(ids));
    });
  }
  queued.clear();
}

function scheduleFlush() {
  if (flushScheduled) {
    return;
  }
  flushScheduled = true;
  const run = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(flushQueued, { timeout: 2000 });
    } else {
      window.setTimeout(flushQueued, 200);
    }
  };
  // Sayfanın kendi yüklemesiyle yarışmaz: yükleme bittikten sonra boşta.
  if (document.readyState === 'complete') {
    run();
  } else {
    window.addEventListener('load', run, { once: true });
  }
}

/**
 * @param {HTMLElement} cta Düğme.
 */
function queueCta(cta) {
  const info = ctaInfo(cta);
  if (!info || aheadDisabled || sources.has(hostKey(info.rest, info.id, info.kind))) {
    return;
  }
  const group = JSON.stringify([info.rest, info.kind]);
  if (!queued.has(group)) {
    queued.set(group, new Set());
  }
  queued.get(group).add(info.id);
  scheduleFlush();
}

function startObserver() {
  if (observer || typeof window.IntersectionObserver !== 'function' || !document.querySelector('[data-wdp-form]')) {
    return;
  }
  if (!shouldPrefetchAhead(window.navigator.connection)) {
    return;
  }
  observer = new window.IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          queueCta(entry.target);
        }
      });
    },
    { rootMargin: '300px' }
  );
}

/** Dokunma niyeti olayları: belge düzeyinde tek yakalama dinleyicisi (kart başına dinleyici yok). */
const INTENT_EVENTS = ['pointerover', 'pointerdown', 'touchstart', 'focusin'];
/** Isınmış / izlemeye alınmış düğmeler (öznitelik değil: yükleme sırasında DOM'a yazılmaz). */
const warmed = new WeakSet();
const watched = new WeakSet();

/**
 * @param {Event} event Olay.
 */
function onIntent(event) {
  const cta = event.target && event.target.closest ? event.target.closest('[data-wdp-form]') : null;
  if (!cta || warmed.has(cta) || !ctaInfo(cta)) {
    return;
  }
  warmed.add(cta);
  warmCta(cta);
}

/**
 * Tıklama: liste kartı ve mağaza/arşiv döngü kartı (`a.wdp-loop-donate[data-wdp-form]`) aynı yoldan açılır.
 *
 * @param {MouseEvent} event Olay.
 */
function onClick(event) {
  const cta = event.target && event.target.closest ? event.target.closest('[data-wdp-form]') : null;
  if (!cta || !shouldHandleClick(event) || !ctaInfo(cta)) {
    return;
  }
  event.preventDefault();
  openForm(cta);
}

function bindDocument() {
  // Bayrak pencere üzerinde: kök öğeye öznitelik yazmak tüm belgenin stilini yeniden hesaplatır (ağır temada pahalı).
  if (window.__dpListBound) {
    return;
  }
  window.__dpListBound = true;
  document.addEventListener('click', onClick);
  INTENT_EVENTS.forEach((type) => document.addEventListener(type, onIntent, { capture: true, passive: true }));
}

function init() {
  bindDocument();
  startObserver();
  document.querySelectorAll('.wdp-list-wrap').forEach((wrap) => {
    if (wrap.dataset.wdpBound === '1') {
      return;
    }
    wrap.dataset.wdpBound = '1';
    bindTabs(wrap);
  });
  document.querySelectorAll('[data-wdp-form]').forEach((cta) => {
    if (watched.has(cta) || !ctaInfo(cta)) {
      return;
    }
    watched.add(cta);
    if (!cta.hasAttribute('aria-haspopup')) {
      cta.setAttribute('aria-haspopup', 'dialog');
    }
    if (observer) {
      observer.observe(cta);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

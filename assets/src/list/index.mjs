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
  lazyAsset,
  matchesCategory,
  parseHashSlug,
  shouldHandleClick,
  parsePrefetchHref,
  shouldPrefetchAhead,
  trustedRestRoot,
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
 *  - `sources`: sunucudan gelen form HTML'i (metin) + isteğe bağlı paket bilgisi (kampanya çubuğu). Ön alma YALNIZ bunu
 *    doldurur: boşta ağ + JSON, DOM işi yok.
 *  - `hosts`: DOM'a eklenmiş kap; dokunma niyetinde (üstüne gelme/basma/odak) ya da dokunuşta kurulur.
 *
 * @type {Map<string, Promise<{entry: function(): (FormEntry|Promise<FormEntry>)}>>}
 */
const sources = new Map();
/** @type {Map<string, Promise<HTMLElement>>} */
const hosts = new Map();
/** Sunucu toplu ön almayı kapattıysa (`prefetch:false`, filtre) sayfa boyunca yalnız niyetle alınır. */
let aheadDisabled = false;

/**
 * @typedef {{html: string, progress: ({ids: string[], script: string, style: string}|null)}} FormEntry
 */

/**
 * Yanıttan bir ürünün form girdisi: HTML + (yalnız bu ürün kampanyalıysa) çubuk paketi bilgisi.
 *
 * @param {any}    data Ayrıştırılmış yanıt.
 * @param {string} html Formun HTML'i.
 * @param {string} id   Ürün.
 * @return {FormEntry} Girdi.
 */
function entryOf(data, html, id) {
  const progress = lazyAsset(data, 'progress', window.location.href);
  return { html, progress: progress && progress.ids.includes(String(id)) ? progress : null };
}

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
  return (await fetchTrusted(url)).json();
}

/**
 * Yalnız aynı kökene istek; yönlendirme sonrası yanıt da aynı kökenden olmalı (yanıt HTML'i sayfaya basılır).
 *
 * @param {string} url Adres (trustedRestRoot ile doğrulanmış kökten türetilir).
 * @return {Promise<Response>} Yanıt.
 */
async function fetchTrusted(url) {
  const response = await window.fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (!response.ok || (response.url && new URL(response.url).origin !== window.location.origin)) {
    throw new Error(String(response.status));
  }
  return response;
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
 * @return {Promise<{entry: function(): (FormEntry|Promise<FormEntry>)}>} Girdiyi (gerekirse ertelenmiş çözümle) veren nesne.
 */
function ensureSource(rest, id, kind) {
  const key = hostKey(rest, id, kind);
  const cached = sources.get(key);
  if (cached) {
    return cached;
  }
  // Sunucunun bastığı ön alma bağlantısı bu kartı kapsıyorsa AYNI adres istenir: tarayıcı önbelleğinden gelir (ağ yok).
  const link = prefetchFor(id, kind);
  if (link) {
    return remember(
      sources,
      key,
      linkData(link).then((data) => {
        const items = (data && data.items) || {};
        if (typeof items[id] !== 'string' || items[id] === '') {
          throw new Error('missing'); // sourceEntry bir kez tek istekle yeniden dener
        }
        return { entry: () => entryOf(data, items[id], id) };
      })
    );
  }
  return remember(
    sources,
    key,
    getJson(buildExperienceUrl(rest, id, kind)).then((data) => {
      if (!data || typeof data.html !== 'string' || data.html === '') {
        throw new Error('empty');
      }
      markReady(id);
      return { entry: () => entryOf(data, data.html, id) };
    })
  );
}

/** Ön alma bağlantısı adresi => çözülmüş yanıt sözü (bağlantı başına bir kez). */
const linkBatches = new Map();

/**
 * @param {string} href Doğrulanmış toplu uç adresi.
 * @return {Promise<any>} Yanıt (`items`: ürün => HTML; `assets`: isteğe bağlı paketler).
 */
function linkData(href) {
  if (!linkBatches.has(href)) {
    remember(
      linkBatches,
      href,
      getJson(href).then((data) => data || {})
    );
  }
  return linkBatches.get(href);
}

/**
 * Bu kartı kapsayan geçerli ön alma bağlantısı (yalnız ihtiyaçta, dokunma niyetinde okunur: yüklemede iş yok).
 *
 * @param {string} id   Ürün.
 * @param {string}  kind        Kap türü.
 * @param {boolean} requireDone Yalnız indirmesi bitmiş bağlantı (dokunuş yolu); false = kapsıyor mu (kuyruk).
 * @return {string} Adres ya da ''.
 */
function prefetchFor(id, kind, requireDone = true) {
  if (!nativePrefetch()) {
    return ''; // bağlantı hiç alınmadı: aynı adresi istemek 12 formu dokunuşta indirirdi
  }
  for (const link of document.querySelectorAll('link[rel="prefetch"][data-dp-prefetch]')) {
    const info = parsePrefetchHref(link.getAttribute('href'), window.location.href);
    // Yalnız tarayıcı indirmeyi BİTİRDİYSE (önbellekte): sürerken aynı adresi istemek 12 formu ikinci kez indirebilirdi.
    const done = info && (!requireDone || performance.getEntriesByName(link.href).some((r) => r.responseEnd > 0));
    if (info && done && info.kind === kind && info.ids.includes(String(id))) {
      return info.href;
    }
  }
  return '';
}

/**
 * Tarayıcı `<link rel="prefetch">` destekliyor mu (Safari desteklemez: orada istemci boşta kendisi alır).
 *
 * @return {boolean} Destek.
 */
function nativePrefetch() {
  if (nativeSupport === null) {
    const link = document.createElement('link');
    nativeSupport = Boolean(link.relList && typeof link.relList.supports === 'function' && link.relList.supports('prefetch'));
  }
  return nativeSupport;
}
let nativeSupport = null;

/**
 * Form girdisi: önbellekteki kaynak çözülemezse (toplu yanıtta yoksa) bir kez tek istekle yeniden alınır.
 *
 * @param {string} rest Kök REST adresi.
 * @param {string} id   Ürün kimliği.
 * @param {string} kind Kap türü.
 * @return {Promise<FormEntry>} Girdi.
 */
async function sourceEntry(rest, id, kind) {
  try {
    return await (await ensureSource(rest, id, kind)).entry();
  } catch {
    sources.delete(hostKey(rest, id, kind));
    return (await ensureSource(rest, id, kind)).entry();
  }
}

/** Kampanya çubuğu paketi bu sayfada istendi mi (bir kez). */
let progressRequested = false;

/**
 * Kampanyalı ürünün katmanı kurulurken canlı çubuk paketi (bir kez): stil kap DOM'a girmeden ÖNCE satır içi eklenir
 * (katman hiçbir karede stilsiz değil), betik eşzamansız yüklenir ve kendi `scan`'iyle katmandaki çubuğu bağlar.
 * Adres yalnız sunucu yanıtından gelir ve `lazyAsset` ile doğrulanmıştır; sayfada paket zaten varsa hiçbir şey yapmaz.
 *
 * @param {{script: string, style: string}|null} info Paket bilgisi.
 */
function loadProgress(info) {
  if (!info || progressRequested) {
    return;
  }
  progressRequested = true;
  if (info.style && !document.getElementById('donation-panel-inline-progress')) {
    const style = document.createElement('style');
    style.id = 'donation-panel-inline-progress';
    style.textContent = info.style;
    document.body.appendChild(style);
  }
  if (window.__donationPanelLiveProgress || document.getElementById('donation-panel-progress-js')) {
    return;
  }
  const script = document.createElement('script');
  script.id = 'donation-panel-progress-js';
  script.src = info.script;
  script.async = true;
  document.head.appendChild(script);
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
      sourceEntry(rest, id, kind).then(({ html, progress }) => {
        loadProgress(progress);
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
    const request = fetchTrusted(buildBatchUrl(rest, part, kind)).then((response) => response.blob());
    let parsed = null;
    const read = (blob) => {
      if (!parsed) {
        parsed = blob.text().then((text) => {
          const data = JSON.parse(text) || {};
          if (data.prefetch === false) {
            aheadDisabled = true;
          }
          return data;
        });
      }
      return parsed;
    };
    const items = async (blob) => (await read(blob)).items || {};
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
          entry: async () => {
            const data = await read(blob);
            const html = (data.items || {})[id];
            if (typeof html !== 'string' || html === '') {
              throw new Error('missing');
            }
            return entryOf(data, html, id);
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
  // Yalnız eklentinin kendi çizdiği düğmeler: liste kartı düğmesi (REST kökü liste kökünde) ya da mağaza/arşiv döngü
  // düğmesi (`a.wdp-loop-donate`, kök düğmede). Kök aynı köken + eklenti ad alanı olmalı; kimlik yalnız rakam.
  let source = null;
  if (cta.matches('a.wdp-loop-donate[data-wdp-rest]')) {
    source = cta;
  } else if (cta.matches('.wdp-card__cta')) {
    source = cta.closest('.wdp-list-wrap[data-wdp-rest]');
  }
  const id = cta.getAttribute('data-wdp-form') || '';
  const rest = source ? trustedRestRoot(source.getAttribute('data-wdp-rest'), window.location.href) : '';
  if (!rest || !/^[1-9]\d*$/.test(id)) {
    return null;
  }
  const kind = source.getAttribute('data-wdp-kind');
  return { rest, kind: ['popup', 'side_panel', 'bottom_sheet'].includes(kind) ? kind : 'popup', id };
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
  if (!info || aheadDisabled || sources.has(hostKey(info.rest, info.id, info.kind)) || prefetchFor(info.id, info.kind, false)) {
    return; // zaten alındı ya da tarayıcının ön alma bağlantısı kapsıyor
  }
  const group = JSON.stringify([info.rest, info.kind]);
  if (!queued.has(group)) {
    queued.set(group, new Set());
  }
  queued.get(group).add(info.id);
  scheduleFlush();
}

function startObserver() {
  if (observer || typeof window.IntersectionObserver !== 'function') {
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

/** Görünür alana yaklaşan (bağlantıyla önceden alınmamış) kartları izlemeye başlar (bir kez). */
function watchCards() {
  startObserver();
  if (!observer) {
    return;
  }
  document.querySelectorAll('[data-wdp-form]').forEach((cta) => {
    if (!watched.has(cta)) {
      watched.add(cta);
      observer.observe(cta);
    }
  });
}

function init() {
  bindDocument();
  document.querySelectorAll('.wdp-list-wrap').forEach((wrap) => {
    if (wrap.dataset.wdpBound === '1') {
      return;
    }
    wrap.dataset.wdpBound = '1';
    bindTabs(wrap);
    wrap.querySelectorAll('.wdp-card__cta[data-wdp-form]:not([aria-haspopup])').forEach((cta) => cta.setAttribute('aria-haspopup', 'dialog'));
  });
  // Ön alma ziyaretçinin İLK etkileşiminde (kaydırma, fare hareketi, dokunma, tuş) başlar: yüklemede eklenti betiği
  // yalnız dinleyici kaydeder (ana iş süresi tabanla aynı) ve hiç etkileşmeyen ziyaretçi (bot, hemen çıkan) sunucuya ek
  // istek göndermez. Tarayıcı `<link rel="prefetch">` destekliyorsa ilk kartları TARAYICI alır; kalan/desteklemeyen
  // (Safari) kartlar görünür alana yaklaşınca istemcide boşta toplu alınır. Karta ilk etkileşim doğrudan dokunuşsa form o
  // an tek istekle alınır.
  if (!firstScheduled) {
    firstScheduled = true;
    FIRST_INTERACTION.forEach((type) => window.addEventListener(type, onFirstInteraction, { capture: true, passive: true }));
  }
}
let firstScheduled = false;
const FIRST_INTERACTION = ['scroll', 'pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel'];

function onFirstInteraction() {
  FIRST_INTERACTION.forEach((type) => window.removeEventListener(type, onFirstInteraction, { capture: true }));
  if (nativePrefetch()) {
    activatePrefetchLinks();
  }
  watchCards();
}

/**
 * Sunucunun etkisiz `<template data-dp-prefetch-links>` içinde bastığı ön alma bağlantılarını sayfa yüklendikten sonra
 * `<head>`'e taşır: tarayıcı toplu ucu en düşük öncelikle alır (ilk yükte bayt/bant yok; betik `fetch()` başlatmaz).
 * Yalnız doğrulanan (aynı köken + eklenti toplu ucu) bağlantılar taşınır.
 */
function activatePrefetchLinks() {
  document.querySelectorAll('template[data-dp-prefetch-links]').forEach((tpl) => {
    tpl.content.querySelectorAll('link[rel="prefetch"][data-dp-prefetch]').forEach((link) => {
      if (parsePrefetchHref(link.getAttribute('href'), window.location.href)) {
        document.head.appendChild(document.importNode(link, false));
      }
    });
    tpl.remove();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/**
 * Donation Panel — bağış listesi: kategori süzgeci (sekmeler) ve kart düğmesiyle formu açma.
 *
 * 12.4: kart formları sayfa HTML'ine GÖMÜLÜ gelir (sayfa sonunda `<script type="application/json" data-dp-forms>`,
 * sunucu `Card_Forms` + `Form_Pack`: ortak şablon + ürün başına fark). Sayfa önbelleğiyle gelir; ek istek yok, dokunuşta
 * ağ yok, çerez/HTTP önbelleği davranışından bağımsız. Paket ilk etkileşimde ya da yüklemeden 1 sn sonra boşta okunur
 * (JSON çözümü; DOM işi yok), form deneyimi betiği (sayfa yüklemesinde yok) aynı anda paketteki doğrulanmış adresten
 * yüklenir; dokunma niyetinde (üstüne gelme/basma/odak) katman DOM'u kurulur. Pakette olmayan kart (sonradan başka
 * kaynaktan gelen kart, bütçe dışı, süzgeçle dışlanan) formu niyette tek REST isteğiyle alır. Sayfa HTML'inde nonce yok:
 * form ilk gönderimde taze nonce alır. JS yoksa düğme ürün sayfasına gider.
 */
import './list.css';
import { buildExperienceUrl, hostKey, lazyAsset, matchesCategory, parseHashSlug, shouldHandleClick, shouldPrefetchAhead, trustedRestRoot } from './logic.mjs';
import { openPack, restoreTokens } from './pack.mjs';

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
 * kez kurulur):
 *  - `sources`: formun HTML'i + isteğe bağlı paket bilgisi (gömülü paketten ya da yedek REST isteğinden).
 *  - `hosts`: DOM'a eklenmiş kap; dokunma niyetinde ya da dokunuşta kurulur.
 *
 * @type {Map<string, Promise<FormEntry>>}
 */
const sources = new Map();
/** @type {Map<string, Promise<HTMLElement>>} */
const hosts = new Map();

/**
 * @typedef {{html: string, progress: ({ids: string[], script: string, style: string}|null), exp: ({script: string}|null)}} FormEntry
 */

/**
 * Yanıttan/paketten bir ürünün form girdisi: HTML + (yalnız bu ürün kampanyalıysa) çubuk paketi bilgisi.
 *
 * @param {any}    data Ayrıştırılmış yanıt ya da gömülü paket.
 * @param {string} html Formun HTML'i.
 * @param {string} id   Ürün.
 * @return {FormEntry} Girdi.
 */
function entryOf(data, html, id) {
  const progress = lazyAsset(data, 'progress', window.location.href);
  return { html, progress: progress && progress.ids.includes(String(id)) ? progress : null, exp: lazyAsset(data, 'experiences', window.location.href) };
}

/**
 * Gömülü paketler (sayfa sonundaki `script[data-dp-forms]`), bir kez okunur.
 *
 * @type {Array<{kind: string, data: any, reader: {ids: string[], form: function(string): (string|null)}}>|null}
 */
let packs = null;

/** @return {Array<{kind: string, data: any, reader: {ids: string[], form: function(string): (string|null)}}>} Paketler. */
function embeddedPacks() {
  if (!packs) {
    packs = [];
    document.querySelectorAll('script[type="application/json"][data-dp-forms]').forEach((el) => {
      try {
        const data = JSON.parse(el.textContent || '');
        const reader = openPack(data);
        if (reader && ['popup', 'side_panel', 'bottom_sheet'].includes(data.kind)) {
          packs.push({ kind: data.kind, data, reader });
        }
      } catch {
        // Bozuk paket yok sayılır: kartlar niyette tek istekle alınır.
      }
    });
  }
  return packs;
}

let keySeq = 0;

/**
 * Gömülü formun girdisi (yoksa null). Sayfa kimliği her kurulumda benzersiz üretilir.
 *
 * @param {string} id   Ürün.
 * @param {string} kind Kap türü.
 * @return {FormEntry|null} Girdi.
 */
function embeddedEntry(id, kind) {
  for (const pack of embeddedPacks()) {
    if (pack.kind === kind && pack.reader.ids.includes(String(id))) {
      const html = pack.reader.form(String(id));
      if (html) {
        keySeq += 1;
        return entryOf(pack.data, restoreTokens(html, id, `dp-${id}-${kind}-e${keySeq}`), id);
      }
    }
  }
  return null;
}

/** Form deneyimi paketi (bir kez) yüklendi sözü. */
let experiencesLoad = null;

/**
 * Form deneyimi betiği: liste/mağaza kartı sayfasında sayfa yüklemesinde YOK (ilk yük baytı yok); yalnız gömülü paketteki
 * ya da sunucu yanıtındaki doğrulanmış adresten (`lazyAsset`) bir kez eklenir. Sayfada zaten varsa hiçbir şey yapmaz.
 *
 * @param {{script: string}|null} info Paket bilgisi.
 * @return {Promise<void>} Betik yüklendi (ya da gerekmiyor / yüklenemedi).
 */
function loadExperiences(info) {
  if (window.__dpExperiences || document.getElementById('donation-panel-experiences-js') || !info) {
    return experiencesLoad || Promise.resolve();
  }
  if (!experiencesLoad) {
    experiencesLoad = new Promise((resolve) => {
      const script = document.createElement('script');
      script.id = 'donation-panel-experiences-js';
      script.src = info.script;
      script.async = true;
      script.onload = script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }
  return experiencesLoad;
}

/** Formu hazır ürünler (sonradan DOM'a gelen/yeniden çizilen kart düğmeleri de işaretlenir). */
const readyIds = new Set();

/**
 * Form hazır (dokunuşta ağ isteği olmayacak): kartın düğmelerine `data-wdp-ready="1"` (testler/ölçüm bunu bekler).
 *
 * @param {string} id Ürün kimliği.
 */
function markReady(id) {
  readyIds.add(String(id));
  document.querySelectorAll(`[data-wdp-form="${String(id).replace(/[^0-9]/g, '')}"]`).forEach((cta) => {
    if (cta.dataset.wdpReady !== '1') {
      cta.dataset.wdpReady = '1';
    }
  });
}

/**
 * Yedek: tek formu REST'ten alır. Yalnız aynı kökene; yönlendirme sonrası yanıt da aynı kökenden olmalı (yanıt HTML'i
 * sayfaya basılır).
 *
 * @param {string} url Adres (trustedRestRoot ile doğrulanmış kökten türetilir).
 * @return {Promise<any>} JSON gövde.
 */
async function getJson(url) {
  const response = await window.fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (!response.ok || (response.url && new URL(response.url).origin !== window.location.origin)) {
    throw new Error(String(response.status));
  }
  return response.json();
}

/**
 * Söz önbelleğe girer; başarısız olursa düşer (dokunuşta yeniden denenir).
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
 * Formun girdisi: gömülü paketten (ağ yok) ya da yedek olarak şimdi tek istekle.
 *
 * @param {string} rest Kök REST adresi.
 * @param {string} id   Ürün kimliği.
 * @param {string} kind Kap türü.
 * @return {Promise<FormEntry>} Girdi.
 */
function ensureSource(rest, id, kind) {
  const key = hostKey(rest, id, kind);
  const cached = sources.get(key);
  if (cached) {
    return cached;
  }
  const embedded = embeddedEntry(id, kind);
  if (embedded) {
    return remember(sources, key, Promise.resolve(embedded));
  }
  return remember(
    sources,
    key,
    getJson(buildExperienceUrl(rest, id, kind)).then((data) => {
      if (!data || typeof data.html !== 'string' || data.html === '') {
        throw new Error('empty');
      }
      const entry = entryOf(data, data.html, id);
      return loadExperiences(entry.exp).then(() => {
        markReady(id);
        return entry;
      });
    })
  );
}

/** Kampanya çubuğu paketi bu sayfada istendi mi (bir kez). */
let progressRequested = false;

/**
 * Kampanyalı ürünün katmanı kurulurken canlı çubuk paketi (bir kez): stil kap DOM'a girmeden ÖNCE satır içi eklenir
 * (katman hiçbir karede stilsiz değil), betik eşzamansız yüklenir ve kendi `scan`'iyle katmandaki çubuğu bağlar.
 * Adres yalnız sunucunun paketinden/yanıtından gelir ve `lazyAsset` ile doğrulanmıştır; sayfada paket zaten varsa hiçbir
 * şey yapmaz.
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
      ensureSource(rest, id, kind).then(({ html, progress, exp }) => {
        loadProgress(progress);
        loadExperiences(exp);
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
 * Dokunma niyeti (üstüne gelme, basma, odak): katman DOM'u kurulur (`dp:warm`), böylece tıklamada yalnız gösterilir.
 * Form gömülü değilse şimdi tek istekle alınır.
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
    () => {} // Hata dokunuşta ele alınır (yeniden denenir; olmazsa ürün sayfasına gidilir).
  );
}

/**
 * Ürün formunu (paketten ya da şimdi) alır ve katmanı açar. Gömülüyse ağ isteği yoktur.
 *
 * @param {HTMLElement} cta Tıklanan düğme.
 */
async function openForm(cta) {
  const info = ctaInfo(cta);
  const key = hostKey(info.rest, info.id, info.kind);
  const waiting = !sources.has(key) && !embeddedPacks().some((pack) => pack.kind === info.kind && pack.reader.ids.includes(info.id));
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

/** Dokunma niyeti olayları: belge düzeyinde tek yakalama dinleyicisi (kart başına dinleyici yok). */
const INTENT_EVENTS = ['pointerover', 'pointerdown', 'touchstart', 'focusin'];
/** Isınmış / işaretlenmiş düğmeler (öznitelik değil: yükleme sırasında DOM'a yazılmaz). */
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

/**
 * Hazır ürünlerin yeni (sonradan DOM'a gelen ya da sayfa oluşturucunun yeniden çizdiği) düğmelerini işaretler.
 */
function markCards() {
  document.querySelectorAll('[data-wdp-form]').forEach((cta) => {
    if (watched.has(cta)) {
      return;
    }
    watched.add(cta);
    if (readyIds.has(cta.getAttribute('data-wdp-form') || '')) {
      cta.dataset.wdpReady = '1';
    }
  });
}

/**
 * Boşta çalıştırır (yoksa kısa gecikmeyle).
 *
 * @param {function(): void} task İş.
 */
function idle(task) {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(task, { timeout: 1500 });
  } else {
    window.setTimeout(task, 50);
  }
}

let rescanPending = false;

/** DOM değişti: kart düğmeleri boşta, tek seferde yeniden işaretlenir (değişiklik başına iş yok). */
function scheduleRescan() {
  if (!rescanPending) {
    rescanPending = true;
    idle(() => {
      rescanPending = false;
      markCards();
    });
  }
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
  // Hazırlık, ziyaretçinin İLK etkileşiminde (kaydırma, fare hareketi, dokunma, tuş) ya da sayfa yüklendikten
  // IDLE_START_MS sonra boşta — hangisi önce — başlar. Yükleme sırasında eklenti betiği yalnız dinleyici kaydeder.
  if (!firstScheduled) {
    firstScheduled = true;
    FIRST_INTERACTION.forEach((type) => window.addEventListener(type, activate, { capture: true, passive: true }));
    const later = () => window.setTimeout(() => idle(activate), IDLE_START_MS);
    if (document.readyState === 'complete') {
      later();
    } else {
      window.addEventListener('load', later, { once: true });
    }
  }
}
let firstScheduled = false;
const FIRST_INTERACTION = ['scroll', 'pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel'];
/** Etkileşim yoksa hazırlığın başladığı an (yüklemeden sonra, ms): sayfanın kendi işi bitmiş olur. */
const IDLE_START_MS = 1000;
let active = false;

/**
 * Hazırlık (bir kez): gömülü paket okunur (ağ yok), form deneyimi betiği paketteki doğrulanmış adresten yüklenir
 * (veri tasarrufu / 2G'de yalnız niyetle), gömülü kartların düğmeleri hazır işaretlenir. Sonradan eklenen/yeniden
 * çizilen kart düğmeleri DOM değişikliğinde boşta yeniden işaretlenir.
 */
function activate() {
  if (active) {
    return;
  }
  active = true;
  FIRST_INTERACTION.forEach((type) => window.removeEventListener(type, activate, { capture: true }));
  const list = embeddedPacks();
  if (list.length && shouldPrefetchAhead(window.navigator.connection)) {
    loadExperiences(lazyAsset(list[0].data, 'experiences', window.location.href)).then(() => {
      list.forEach((pack) => pack.reader.ids.forEach(markReady));
    });
  }
  markCards();
  if (typeof window.MutationObserver === 'function' && document.body) {
    new window.MutationObserver(scheduleRescan).observe(document.body, { childList: true, subtree: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

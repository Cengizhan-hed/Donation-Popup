/**
 * Donation Panel — canlı kampanya çubuğu (tüm yüzeylerin ortak bileşeni: kampanya kartı, form, compact kart).
 *
 * Gerçek toplam yalnız sunucudan gelir (ödenmiş siparişler). Bu modül yalnız o tarayıcıda görünen kişisel önizleme
 * ekler: seçilen tutar (`donation-panel:amount`) + sepetteki tutar (Woo sepet çerezi varken Store API sepet verisi).
 * Animasyon yalnız transform/opacity; sayım requestAnimationFrame; ekrana girince başlar; azaltılmış harekette anlık.
 *
 * Birden çok paket (experiences, compact, campaign) aynı sayfada yüklenebilir: yalnız ilk yüklenen çalışır (tekil).
 */
import { cartAmounts, clamp, donorsText, easeOut, formatPercent, formatWooMoney, noteText, percentOf, projection } from './live-progress-logic.mjs';

const KEY = '__donationPanelLiveProgress';
const COUNT_MS = 850;
const PREVIEW_MS = 420;

const reduced = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Çubuk durumu: kök → { cfg, el, shown, raf } */
const bars = new Map();
/** Seçilen (henüz sepete eklenmemiş) tutarlar: kaynak öğe → { id, amount } */
const pending = new Map();
/** Sepetteki tutarlar (Store API) ve iyimser eklemeler. */
let cart = new Map();
let optimistic = new Map();
/** Ödenmiş ama gerçek toplama henüz yansımamış tutar (ürün → tutar); gerçek toplam artınca silinir. */
const paid = new Map();
let cartStamp = 0;
let cartRequest = null;
const refreshing = new Set();
let observer = null;

/**
 * @param {HTMLElement} root Çubuk kökü.
 * @return {object|null} Yapılandırma.
 */
function readConfig(root) {
  try {
    const cfg = JSON.parse(root.getAttribute('data-dp-live') || '{}');
    return cfg && Number(cfg.id) > 0 && Number(cfg.goal) > 0 ? cfg : null;
  } catch {
    return null;
  }
}

function restBase() {
  const link = document.querySelector('link[rel="https://api.w.org/"]');
  return link ? link.href : `${window.location.origin}/wp-json/`;
}

/**
 * @param {string} route Yol.
 * @param {string} [query] Sorgu (ör. `_=123`).
 * @return {string} Adres.
 */
function restUrl(route, query = '') {
  const base = restBase();
  if (base.includes('rest_route=')) {
    return `${base.replace(/\/+$/, '')}/${route}${query ? `&${query}` : ''}`;
  }
  return `${base.replace(/\/+$/, '')}/${route}${query ? `?${query}` : ''}`;
}

const hasCartCookie = () => /(?:^|;\s*)woocommerce_items_in_cart=/.test(document.cookie || '');

/**
 * @param {HTMLElement} root Kök.
 * @param {string} name `data-dp-live-*` adı.
 * @return {HTMLElement|null} Öğe.
 */
const part = (root, name) => root.querySelector(`[data-dp-live-${name}]`);

/**
 * Sayıyı sayarak yazar (rAF; azaltılmış harekette/kapalıyken doğrudan).
 *
 * @param {object} state Çubuk durumu.
 * @param {string} slot  Animasyon yuvası.
 * @param {HTMLElement|null} node Metin düğümü.
 * @param {number} from Başlangıç.
 * @param {number} to   Bitiş.
 * @param {number} ms   Süre.
 * @param {(n:number, done:boolean)=>string} format Biçimleyici.
 */
function tween(state, slot, node, from, to, ms, format) {
  if (!node) {
    return;
  }
  window.cancelAnimationFrame(state.raf[slot] || 0);
  if (!state.cfg.o.c || reduced() || from === to || ms <= 0) {
    node.textContent = format(to, true);
    return;
  }
  const start = window.performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    node.textContent = format(from + (to - from) * easeOut(t), t >= 1);
    if (t < 1) {
      state.raf[slot] = window.requestAnimationFrame(step);
    }
  };
  state.raf[slot] = window.requestAnimationFrame(step);
}

/**
 * Bir ürünün kişisel tutarları.
 *
 * @param {number} id Ürün.
 * @return {{cart:number, pending:number}} Tutarlar.
 */
function personalFor(id) {
  let chosen = 0;
  pending.forEach((entry) => {
    if (entry.id === id) {
      chosen = entry.amount;
    }
  });
  return { cart: Math.max(cart.get(id) || 0, optimistic.get(id) || 0), pending: chosen + (paid.get(id) || 0) };
}


/**
 * Dolum ve önizleme katmanı. Önizleme katmanı ilk kez gerekiyorsa oluşturulur ve bir sonraki karede genişler.
 *
 * @param {HTMLElement} root    Kök.
 * @param {object}      state   Durum.
 * @param {object}      view    projection() sonucu.
 * @param {boolean}     preview Önizleme var mı.
 * @return {boolean} Çizim bir sonraki kareye ertelendi mi.
 */
function paintBar(root, state, view, preview) {
  const fill = part(root, 'fill');
  if (fill) {
    fill.style.setProperty('--p', String(view.real));
  }
  if (preview && !state.pv && fill) {
    const pv = document.createElement('i');
    pv.className = 'donation-panel-live__pv';
    pv.setAttribute('aria-hidden', 'true');
    pv.style.setProperty('--p', String(view.real));
    fill.before(pv);
    state.pv = pv;
    // İlk karede gerçek dolumun ucundan başlar, sonra genişler.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => paint(root)));
    return true;
  }
  if (state.pv) {
    state.pv.style.setProperty('--p', String(preview ? view.projected : view.real));
  }
  root.classList.toggle('is-preview', preview);
  root.classList.toggle('is-in-cart', preview && view.inCartOnly);
  return false;
}

/**
 * Sayılar: yüzde (önizlemede yeni yüzde) ve toplanan tutar (gerçek); giriş sayımı ya da kısa geçiş.
 *
 * @param {HTMLElement} root  Kök.
 * @param {object}      state Durum.
 * @param {number}      shown Gösterilecek yüzde.
 * @param {{count?:number, ms?:number}} opts Giriş sayımı.
 */
function paintNumbers(root, state, shown, opts) {
  const { cfg } = state;
  const cur = cfg.cur || {};
  const entry = typeof opts.count === 'number';
  tween(state, 'pct', part(root, 'pct'), entry ? shown * opts.count : state.pct, shown, entry ? opts.ms : PREVIEW_MS, (n) =>
    formatPercent(n, cfg.t.pct, cur.ds, cfg.pd)
  );
  state.pct = shown;
  const raised = part(root, 'raised');
  const target = Number(cfg.raised);
  if (raised && (entry || state.raised !== target)) {
    const from = entry ? target * opts.count : state.raised;
    tween(state, 'raised', raised, from, target, entry ? opts.ms : COUNT_MS, (n, done) => formatWooMoney(done ? n : Math.round(n), cur));
    state.raised = target;
  }
}

/**
 * Önizleme satırı (bilgi satırının üstünde, görünür) + kısa, seyrek ekran okuyucu duyurusu.
 *
 * @param {HTMLElement} root  Kök.
 * @param {object}      state Durum.
 * @param {string}      text  Satır ('' = önizleme yok).
 */
function paintNote(root, state, text) {
  const meta = part(root, 'meta');
  if (!meta || (!state.note && !text)) {
    return;
  }
  if (!state.note) {
    state.note = document.createElement('span');
    state.note.className = 'donation-panel-live__note';
    state.note.setAttribute('aria-hidden', 'true');
    state.sr = document.createElement('span');
    state.sr.className = 'donation-panel-sr';
    state.sr.setAttribute('role', 'status');
    meta.append(state.note, state.sr);
  }
  if (text) {
    state.note.textContent = text;
  }
  meta.classList.toggle('is-preview', Boolean(text));
  window.clearTimeout(state.srTimer);
  state.srTimer = window.setTimeout(() => {
    if (state.sr.textContent !== text) {
      state.sr.textContent = text;
    }
  }, 900);
}

/**
 * Çubuğu çizer (gerçek dolum + önizleme + metinler). Görünmeden önce yalnız durumu saklar.
 *
 * @param {HTMLElement} root Kök.
 * @param {{count?:number, ms?:number}} [opts] Giriş sayımı: başlangıç oranı (0–1) ve kalan süre.
 */
function paint(root, opts = {}) {
  const state = bars.get(root);
  if (!state || !state.shown) {
    return;
  }
  const { cfg } = state;
  const personal = cfg.o.p ? personalFor(Number(cfg.id)) : { cart: 0, pending: 0 };
  const view = projection({ raised: Number(cfg.raised), goal: Number(cfg.goal), ...personal });
  const preview = view.personal > 0 && view.real < 100;
  if (paintBar(root, state, view, preview)) {
    return;
  }
  paintNumbers(root, state, preview ? view.projected : view.real, opts);
  paintNote(root, state, preview ? noteText(view, cfg.t, (n) => formatWooMoney(n, cfg.cur || {})) : '');
  if (view.real >= 100 && cfg.o.k && !state.celebrated && cfg.reached) {
    celebrate(root, state, typeof opts.count === 'number' ? opts.ms : 0);
  }
}

/**
 * Hedefe ulaşıldı: küçük, zarif kutlama (bir kez; azaltılmış harekette yok).
 *
 * @param {HTMLElement} root  Kök.
 * @param {object}      state Durum.
 * @param {number}      delay Dolum bitene kadar bekleme.
 */
function celebrate(root, state, delay) {
  state.celebrated = true;
  const bar = part(root, 'bar');
  if (reduced() || !bar) {
    return;
  }
  window.setTimeout(() => {
    const shine = document.createElement('i');
    shine.className = 'donation-panel-live__shine';
    shine.setAttribute('aria-hidden', 'true');
    (part(root, 'fill') || bar).after(shine);
    root.classList.add('is-celebrate');
    window.setTimeout(() => {
      shine.remove();
      root.classList.remove('is-celebrate');
    }, 1300);
  }, delay);
}

/**
 * Sıfır durumu ve bağışçı sayısı metinleri.
 *
 * @param {HTMLElement} root Kök.
 * @param {object}      cfg  Yapılandırma.
 */
function applyTexts(root, cfg) {
  const zero = !(cfg.raised > 0);
  if (root.hasAttribute('data-zero')) {
    root.setAttribute('data-zero', zero ? '1' : '0');
  }
  root.querySelectorAll('[data-dp-live-zero]').forEach((el) => {
    el.hidden = el.getAttribute('data-dp-live-zero') === 'show' ? !zero : zero;
  });
  const donors = part(root, 'donors');
  if (donors && donors.dataset.one) {
    const text = donorsText(cfg.donors, donors.dataset.one, donors.dataset.many || donors.dataset.one, (cfg.cur || {}).ts);
    donors.textContent = text;
    donors.hidden = text === '';
  }
}

/**
 * Erişilebilir değer, ara hedefler ve "hedefe ulaşıldı" rozeti (gerçek toplam).
 *
 * @param {HTMLElement} root Kök.
 * @param {object}      cfg  Yapılandırma.
 */
function applyStatus(root, cfg) {
  const real = percentOf(cfg.raised, cfg.goal);
  const cur = cfg.cur || {};
  const bar = root.querySelector('[role="progressbar"]');
  if (bar) {
    bar.setAttribute('aria-valuenow', String(Math.floor(real)));
    if (cfg.t.vt) {
      const goal = cfg.t.vt.split('%s').join(formatWooMoney(cfg.goal, cur));
      bar.setAttribute('aria-valuetext', `${formatPercent(real, cfg.t.pct, cur.ds, cfg.pd)} · ${formatWooMoney(cfg.raised, cur)} ${goal}`);
    }
  }
  root.querySelectorAll('[data-dp-ms]').forEach((el) => {
    el.classList.toggle('is-hit', real + 0.00001 >= Number(el.dataset.dpMs));
  });
  root.classList.toggle('is-complete', cfg.reached);
  const badge = root.querySelector('[data-dp-reached]');
  if (badge) {
    badge.hidden = !cfg.reached;
  }
}

/**
 * Sunucu verisini (progress/{id}) çubuğa uygular.
 *
 * @param {HTMLElement} root Kök.
 * @param {object} data Yanıt.
 */
function applyData(root, data) {
  const state = bars.get(root);
  if (!state || !data) {
    return;
  }
  const { cfg } = state;
  cfg.raised = Number(data.raised) || 0;
  cfg.goal = Number(data.goal) || cfg.goal;
  cfg.donors = Number(data.donors) || 0;
  cfg.reached = Boolean(data.reached);
  applyTexts(root, cfg);
  applyStatus(root, cfg);
  paint(root);
}

/**
 * Ürünün güncel gerçek toplamını tek istekle alıp sayfadaki tüm çubuklarına uygular.
 *
 * @param {number}  id   Ürün.
 * @param {boolean} bust Tarayıcı/CDN önbelleğini atla (ödeme sonrası).
 * @param {(data:object)=>void} [before] Uygulamadan hemen önce (aynı karede).
 * @return {Promise<object|null>} Yanıt.
 */
async function refreshProduct(id, bust, before) {
  if (refreshing.has(id)) {
    return null;
  }
  refreshing.add(id);
  try {
    const response = await window.fetch(restUrl(`donation-panel/v1/progress/${id}`, bust ? `_=${Date.now()}` : ''), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    const data = response.ok ? await response.json() : null;
    if (data) {
      if (before) {
        before(data);
      }
      bars.forEach((state, root) => {
        if (Number(state.cfg.id) === id) {
          applyData(root, data);
        }
      });
    }
    return data;
  } catch (error) {
    window.console.debug('donation-panel: ilerleme alınamadı', error);
    return null;
  } finally {
    refreshing.delete(id);
  }
}

/**
 * Ödeme sonrası: gerçek toplam artana dek (en çok 3 deneme) önizleme durur, sonra gerçek dolumla birleşir.
 *
 * @param {number} id     Ürün.
 * @param {number} amount Ödenen tutar.
 */
async function afterPayment(id, amount) {
  const before = Math.max(0, ...Array.from(bars.values()).filter((s) => Number(s.cfg.id) === id).map((s) => Number(s.cfg.raised) || 0));
  if (amount > 0) {
    paid.set(id, amount);
    repaint(id);
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000 * attempt));
    }
    // Gerçek toplam arttıysa önizleme aynı karede düşer: dolum önizlemenin yerine büyür (birleşme).
    const data = await refreshProduct(id, true, (fresh) => Number(fresh.raised) > before && paid.delete(id));
    if (data && Number(data.raised) > before) {
      break;
    }
  }
  if (paid.delete(id)) {
    repaint(id);
  }
}

/**
 * Sepet verisini uygular (Store API yanıtı).
 *
 * @param {object} data Sepet.
 */
function setCart(data) {
  cart = cartAmounts(data);
  optimistic = new Map();
  cartStamp = Date.now();
  repaint();
}

/**
 * Sepeti bir kez okur (yalnız Woo sepet çerezi varken ve önizleme açık bir çubuk varken).
 *
 * @param {boolean} force Taze oku.
 * @return {Promise<void>|null} İstek.
 */
function loadCart(force = false) {
  const wanted = Array.from(bars.values()).some((s) => s.cfg.o.p);
  if (!wanted || !hasCartCookie()) {
    if (!hasCartCookie() && (cart.size || optimistic.size)) {
      cart = new Map();
      optimistic = new Map();
      repaint();
    }
    return null;
  }
  if (cartRequest && !force) {
    return cartRequest;
  }
  cartStamp = Date.now();
  cartRequest = window
    .fetch(restUrl('wc/store/v1/cart'), { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (data) {
        setCart(data);
      }
    })
    .catch((error) => window.console.debug('donation-panel: sepet okunamadı', error));
  return cartRequest;
}

/**
 * @param {number} [id] Yalnız bu ürünün çubukları.
 */
function repaint(id) {
  bars.forEach((state, root) => {
    if (!id || Number(state.cfg.id) === id) {
      paint(root);
    }
  });
}

/**
 * Çubuk görünür oldu: dolum (CSS) + sayım; kart için taze veri.
 *
 * @param {HTMLElement} root Kök.
 */
function show(root) {
  const state = bars.get(root);
  if (!state || state.shown) {
    return;
  }
  state.shown = true;
  const opts = {};
  if (state.cfg.o.c && !reduced()) {
    if (state.waiting) {
      // Ekran dışındayken sıfırda bekledi: şimdi dolsun, sayım baştan.
      window.requestAnimationFrame(() => root.classList.remove('is-wait'));
      opts.count = 0;
      opts.ms = COUNT_MS;
    } else {
      // İlk karede görünürdü: CSS dolumu zaten başladı; sayım kalan süreye eşlenir (metin geri sıçramaz).
      const fill = part(root, 'fill');
      const running = fill && typeof fill.getAnimations === 'function' ? fill.getAnimations().find((a) => a.playState === 'running') : null;
      const elapsed = running ? Number(running.currentTime) || 0 : COUNT_MS;
      if (elapsed < COUNT_MS - 60) {
        opts.count = easeOut(elapsed / COUNT_MS);
        opts.ms = COUNT_MS - elapsed;
      }
    }
  }
  paint(root, opts);
  if (state.cfg.fresh) {
    refreshProduct(Number(state.cfg.id), false);
  }
  loadCart();
}

/**
 * Bir çubuğu bağlar (bir kez).
 *
 * @param {HTMLElement} root Kök.
 */
function mount(root) {
  if (bars.has(root)) {
    return;
  }
  const cfg = readConfig(root);
  if (!cfg) {
    return;
  }
  cfg.o = cfg.o || {};
  cfg.t = cfg.t || {};
  const real = percentOf(Number(cfg.raised), Number(cfg.goal));
  bars.set(root, { cfg, shown: false, waiting: false, raf: {}, pct: real, raised: Number(cfg.raised), pv: null, note: null, sr: null });
  if (!('IntersectionObserver' in window)) {
    show(root);
    return;
  }
  if (!observer) {
    observer = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const state = bars.get(entry.target);
        if (!state) {
          return;
        }
        if (entry.isIntersecting && entry.intersectionRect.width > 0) {
          observer.unobserve(entry.target);
          show(entry.target);
        } else if (!state.shown && !state.waiting && state.cfg.o.c && !reduced()) {
          // Ekran dışında: dolum sıfırda bekler (görünür değil; düzen değişmez), görünce dolar.
          state.waiting = true;
          entry.target.classList.add('is-wait');
        }
      });
    });
  }
  observer.observe(root);
}

/** Sayfadaki (ya da yeni eklenen) çubukları bulur. */
function scan() {
  document.querySelectorAll('[data-dp-live]').forEach(mount);
}

/**
 * @param {number} id Ürün.
 * @return {boolean} Sayfada bu ürünün çubuğu var mı.
 */
function hasBar(id) {
  for (const state of bars.values()) {
    if (Number(state.cfg.id) === id) {
      return true;
    }
  }
  return false;
}

function start() {
  scan();
  // Seçilen tutar (form, compact kart): yalnız bu tarayıcıda, yalnız aynı ürünün çubuklarında.
  document.addEventListener('donation-panel:amount', (event) => {
    const detail = event.detail || {};
    const id = Number(detail.productId);
    const source = event.target && event.target.nodeType === 1 ? event.target : document;
    const amount = Number(detail.amount);
    if (!(id > 0)) {
      return;
    }
    scan();
    if (amount > 0) {
      pending.set(source, { id, amount });
    } else {
      pending.delete(source);
    }
    repaint(id);
  });
  // Katman kapandı: içindeki formun seçimi önizlemeden düşer.
  document.addEventListener('dp:closed', (event) => {
    let changed = false;
    pending.forEach((entry, source) => {
      if (event.target && event.target.contains && event.target.contains(source)) {
        pending.delete(source);
        changed = true;
      }
    });
    if (changed) {
      repaint();
    }
  });
  document.addEventListener('dp:open', scan);
  document.addEventListener('dp:scan', scan);
  // Sepete eklendi: seçilen tutar "sepetinizde" olarak kalır (iyimser), sonra Store API ile doğrulanır.
  document.addEventListener('donation-panel:cart-added', (event) => {
    const id = Number(event.detail && event.detail.productId);
    if (id > 0 && hasBar(id)) {
      const chosen = Number(event.detail.amount) || personalFor(id).pending;
      if (chosen > 0) {
        optimistic.set(id, (cart.get(id) || 0) + chosen);
        repaint(id);
      }
    }
    loadCart(true);
  });
  // Yan sepet Store API yanıtını paylaşır (ek istek yok).
  document.addEventListener('donation-panel:cart-data', (event) => {
    if (event.detail && event.detail.cart && bars.size) {
      setCart(event.detail.cart);
    }
  });
  const reload = () => {
    if (bars.size && Date.now() - cartStamp > 1500) {
      loadCart(true);
    }
  };
  document.addEventListener('donation-panel:cart-updated', reload);
  document.addEventListener('wc-blocks_added_to_cart', reload);
  if (window.jQuery) {
    window.jQuery(document.body).on('added_to_cart removed_from_cart', reload);
  }
  // Ödeme tamamlandı (compact kart teşekkür adımı): tek hafif istek, önizleme gerçek dolumla birleşir.
  document.addEventListener('donation-panel:progress-refresh', (event) => {
    const id = Number(event.detail && event.detail.productId);
    if (id > 0 && hasBar(id)) {
      afterPayment(id, Number(event.detail.amount) || 0);
    }
  });
  // Betik sonradan yüklendiyse (live-loader) o ana dek seçilen tutarları uygula.
  const queued = window.__donationPanelLiveQueue || [];
  window.__donationPanelLiveQueue = [];
  queued.forEach((event) => (event.target || document).dispatchEvent(new CustomEvent(event.type, { bubbles: true, detail: event.detail })));
}

if (!window[KEY]) {
  window[KEY] = { scan, clamp };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}

/**
 * Çakışma denetimi: konsol / betik / alan / CSS sızıntısı / önbellek.
 * Saf (Playwright yok). Koşucu: tests/e2e/run-conflicts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env-root.mjs';
import { DEVICE_ORDER, parseDeviceList } from './devices.mjs';

export const PLUGIN_SLUG = 'woo-donation-popup';
export const PLUGIN_URL_RE = /\/wp-content\/plugins\/woo-donation-popup(?:\/|$)/i;
export const MIN_TOUCH_PX = 24;
export const CONFLICTS_OUT_DIR = path.join(ROOT, 'build/e2e/conflicts');
export const CHECK_IDS = Object.freeze(['console', 'scripts', 'fields', 'css', 'cache']);
export const PAGE_IDS = Object.freeze(['product', 'shop', 'panel', 'cart', 'checkout']);
export const VERDICT = Object.freeze({
  pass: 'geçti',
  warn: 'uyarı',
  red: 'kırmızı',
  skip: 'atlandı',
});

/** Bilinen eklenti global adları (başka kodun üzerine yazması çakışma). */
export const OWN_WDP_GLOBALS = Object.freeze([
  'wdp_ajax',
  'WDPApp',
  'WDP',
  'WDPMetaTracking',
  'wdpAdminActivateTab',
  'wdpActivateTab',
  'wdp_admin',
  'wdpProductsAdmin',
  'wdpElementor',
  'wdpMetaPurchase',
]);

export const WATCHED_LIBRARIES = Object.freeze([
  { id: 'intl-tel-input', re: /intl-tel-input|intlTelInput|\/iti(?:\.min)?\.js/i },
  { id: 'select2', re: /select2|selectWoo/i },
  { id: 'jquery', re: /(?:^|\/)jquery(?:-\d+(?:\.\d+)*)?(?:\.min)?\.js(?:\?|$)/i },
  { id: 'swiper', re: /(?:^|\/)swiper(?:\.min)?(?:-\d+(?:\.\d+)*)?\.js(?:\?|$)|\/swiper\//i },
]);

const JQUERY_MIGRATE_RE = /jquery-migrate/i;
const PLUGIN_FILE_RE = /woo-donation-popup|donation-modal\.(?:js|css)|wdp-[a-z0-9_-]+\.js/i;

/**
 * @param {string} raw
 */
export function stripQuery(raw) {
  const s = String(raw || '');
  const i = s.indexOf('?');
  return i >= 0 ? s.slice(0, i) : s;
}

/**
 * /wp-content/plugins/<slug>/ veya /wp-content/themes/<slug>/
 * @param {string} url
 * @returns {{ kind: string, slug: string }}
 */
export function classifyConflictSource(url) {
  const u = String(url || '');
  const low = u.toLowerCase();
  if (!low) return { kind: 'unknown', slug: '' };
  if (/favicon|apple-touch-icon|\.ico(\?|$)/.test(low)) return { kind: 'favicon', slug: 'favicon' };
  const plug = u.match(/\/wp-content\/plugins\/([^/?#]+)/i);
  if (plug) {
    const slug = decodeURIComponent(plug[1]);
    if (slug === PLUGIN_SLUG) return { kind: 'plugin', slug };
    return { kind: 'other-plugin', slug };
  }
  const theme = u.match(/\/wp-content\/themes\/([^/?#]+)/i);
  if (theme) return { kind: 'theme', slug: decodeURIComponent(theme[1]) };
  if (/\/wp-content\/uploads\//i.test(low)) return { kind: 'upload', slug: 'uploads' };
  if (/\/wp-includes\//i.test(low)) return { kind: 'core', slug: 'wp-includes' };
  return { kind: 'page', slug: '' };
}

/**
 * @param {string} url
 */
export function isPluginCssUrl(url) {
  const u = String(url || '');
  if (!PLUGIN_URL_RE.test(u)) return false;
  return /\.css(?:\?|$)/i.test(u) || /donation-modal|wdp-.*\.css/i.test(u);
}

/**
 * @param {string} url
 */
export function isPluginJsUrl(url) {
  const u = String(url || '');
  return PLUGIN_URL_RE.test(u) && /\.js(?:\?|$)/i.test(u);
}

/**
 * Hata yığınında eklentimizin dosyası var mı?
 * @param {string} stack
 * @param {string} [url]
 */
export function stackMentionsPlugin(stack, url = '') {
  const hay = `${stack || ''}\n${url || ''}`;
  return PLUGIN_URL_RE.test(hay) || PLUGIN_FILE_RE.test(hay);
}

/**
 * @param {{ text?: string, url?: string, stack?: string, kindHint?: string }} ev
 * @returns {{
 *   source: string,
 *   slug: string,
 *   red: boolean,
 *   warn: boolean,
 *   loc: string,
 *   reason: string
 * }}
 */
export function classifyConsoleEvent(ev = {}) {
  const text = String(ev.text || '');
  const url = String(ev.url || '');
  const stack = String(ev.stack || '');
  const fromUrl = classifyConflictSource(url);
  const fromStack = classifyConflictSource(stack);
  const ours = stackMentionsPlugin(stack, url) || fromUrl.kind === 'plugin' || fromStack.kind === 'plugin';
  let source = fromUrl.kind !== 'unknown' && fromUrl.kind !== 'page' ? fromUrl.kind : fromStack.kind;
  let slug = fromUrl.slug || fromStack.slug;
  if (ours) {
    source = 'plugin';
    slug = PLUGIN_SLUG;
  } else if (source === 'unknown' || source === 'page') {
    const any = `${text}\n${stack}`.match(/\/wp-content\/plugins\/([^/?#]+)/i);
    if (any) {
      slug = decodeURIComponent(any[1]);
      source = slug === PLUGIN_SLUG ? 'plugin' : 'other-plugin';
    } else {
      const th = `${text}\n${stack}`.match(/\/wp-content\/themes\/([^/?#]+)/i);
      if (th) {
        slug = decodeURIComponent(th[1]);
        source = 'theme';
      }
    }
  }
  const loc =
    slug && source === 'other-plugin'
      ? `plugin:${slug}`
      : slug && source === 'theme'
        ? `theme:${slug}`
        : ours
          ? pluginLocFromStack(stack, url)
          : url
            ? stripQuery(url).slice(-80)
            : '';
  if (ours) {
    return { source: 'plugin', slug: PLUGIN_SLUG, red: true, warn: false, loc, reason: 'eklenti yığını/URL' };
  }
  if (source === 'other-plugin') {
    return { source, slug, red: false, warn: true, loc, reason: `başka eklenti (${slug})` };
  }
  if (source === 'theme' || source === 'upload' || source === 'favicon') {
    return { source, slug, red: false, warn: false, loc, reason: source };
  }
  if (source === 'core') {
    return { source, slug, red: false, warn: true, loc, reason: 'wp-includes' };
  }
  return { source: source || 'page', slug, red: false, warn: true, loc, reason: 'sınıflanamayan sayfa hatası' };
}

/**
 * @param {string} stack
 * @param {string} url
 */
export function pluginLocFromStack(stack, url = '') {
  const hay = `${stack || ''}\n${url || ''}`;
  const m =
    hay.match(/woo-donation-popup\/([^:\s)]+\.(?:js|css)):(\d+)/i) ||
    hay.match(/(\/?assets\/[^:\s)]+\.(?:js|css)):(\d+)/i);
  if (m) return `${PLUGIN_SLUG}/${m[1]}:${m[2]}`;
  if (PLUGIN_URL_RE.test(hay)) {
    const pathM = hay.match(/\/wp-content\/plugins\/woo-donation-popup\/([^?\s)]+)/i);
    return pathM ? `${PLUGIN_SLUG}/${pathM[1]}` : PLUGIN_SLUG;
  }
  return PLUGIN_SLUG;
}

/**
 * @param {ReturnType<typeof classifyConsoleEvent>[]} classified
 */
export function consoleVerdict(classified) {
  const list = Array.isArray(classified) ? classified : [];
  const red = list.filter((c) => c.red);
  if (red.length) {
    return {
      verdict: VERDICT.red,
      finding: red[0].loc || red[0].slug || PLUGIN_SLUG,
      extras: list.filter((c) => !c.red && c.warn),
    };
  }
  const warns = list.filter((c) => c.warn);
  if (warns.length) {
    return {
      verdict: VERDICT.warn,
      finding: warns[0].loc || warns[0].reason,
      extras: warns.slice(1),
    };
  }
  return { verdict: VERDICT.pass, finding: '', extras: [] };
}

/**
 * jquery-migrate jquery kopyası sayılmaz; aynı kütüphane farklı URL = kopya.
 * @param {string[]} scriptSrcs
 * @returns {{ copies: Array<{ id: string, urls: string[] }>, oursInCopies: boolean }}
 */
export function detectLibraryCopies(scriptSrcs) {
  /** @type {Record<string, string[]>} */
  const byId = {};
  for (const raw of scriptSrcs || []) {
    const src = stripQuery(raw);
    if (!src) continue;
    if (JQUERY_MIGRATE_RE.test(src)) continue;
    for (const lib of WATCHED_LIBRARIES) {
      if (lib.re.test(src)) {
        if (!byId[lib.id]) byId[lib.id] = [];
        if (!byId[lib.id].includes(src)) byId[lib.id].push(src);
        break;
      }
    }
  }
  const copies = Object.entries(byId)
    .filter(([, urls]) => urls.length > 1)
    .map(([id, urls]) => ({ id, urls }));
  const oursInCopies = copies.some((c) => c.urls.some((u) => PLUGIN_URL_RE.test(u)));
  return { copies, oursInCopies };
}

/**
 * @param {{ copies: Array<{ id: string, urls: string[] }>, oursInCopies: boolean }} det
 */
export function scriptsCopiesVerdict(det) {
  const copies = det?.copies || [];
  if (!copies.length) return { verdict: VERDICT.pass, finding: '' };
  const first = copies[0];
  const finding = `${first.id}×${first.urls.length}`;
  if (det.oursInCopies) return { verdict: VERDICT.red, finding: `${finding} (eklenti kopyası)` };
  return { verdict: VERDICT.warn, finding };
}

/**
 * @param {string[]} keys window keys
 * @param {{ wdpAjaxType?: string, wdpAjaxHasUrl?: boolean }} [snap]
 */
export function evaluateWdpGlobals(keys, snap = {}) {
  const list = (keys || []).filter((k) => /^wdp/i.test(String(k || '')));
  const extra = list.filter((k) => !OWN_WDP_GLOBALS.includes(k));
  const ajaxBroken =
    snap.wdpAjaxType != null &&
    snap.wdpAjaxType !== 'undefined' &&
    (snap.wdpAjaxType !== 'object' || snap.wdpAjaxHasUrl === false);
  return { keys: list, extra, ajaxBroken };
}

/**
 * @param {ReturnType<typeof evaluateWdpGlobals>} g
 */
export function wdpGlobalsVerdict(g) {
  if (g.ajaxBroken) return { verdict: VERDICT.red, finding: 'window.wdp_ajax bozuk' };
  if (g.extra.length) return { verdict: VERDICT.warn, finding: `window.${g.extra[0]}` };
  return { verdict: VERDICT.pass, finding: '' };
}

/**
 * @param {{ hasJQuery?: boolean, jqueryVersion?: string, dollarIsJQuery?: boolean, dollarType?: string }} p
 */
export function evaluateJqueryDollar(p = {}) {
  if (!p.hasJQuery) return { conflict: false, reason: 'jquery yok' };
  if (p.dollarType && p.dollarType !== 'undefined' && p.dollarType !== 'function' && p.dollarIsJQuery !== true) {
    return { conflict: true, reason: `$ tipi ${p.dollarType}` };
  }
  if (p.dollarType === 'function' && p.dollarIsJQuery === false) {
    return { conflict: true, reason: '$ jQuery değil' };
  }
  return { conflict: false, reason: '' };
}

/**
 * @param {ReturnType<typeof detectLibraryCopies>} copies
 * @param {ReturnType<typeof evaluateWdpGlobals>} globals
 * @param {ReturnType<typeof evaluateJqueryDollar>} dollar
 */
export function scriptsVerdict(copies, globals, dollar) {
  const a = scriptsCopiesVerdict(copies);
  const b = wdpGlobalsVerdict(globals);
  const c = dollar?.conflict
    ? { verdict: VERDICT.warn, finding: dollar.reason }
    : { verdict: VERDICT.pass, finding: '' };
  return worstVerdict([a, b, c]);
}

/**
 * @param {{
 *   wdpPhoneCount?: number,
 *   flagCount?: number,
 *   countryBtnCount?: number,
 *   itiOnWdp?: number,
 *   wcipiOnWdp?: number,
 *   itiGlobalOnWdp?: boolean
 * }} p
 */
export function evaluatePhoneIntegrity(p = {}) {
  const flags = Number(p.flagCount || 0);
  const btns = Number(p.countryBtnCount || 0);
  const iti = Number(p.itiOnWdp || 0);
  const wcipi = Number(p.wcipiOnWdp || 0);
  const double = iti > 0 || wcipi > 0 || p.itiGlobalOnWdp === true || flags > 1 || btns > 1;
  return {
    double,
    flags,
    btns,
    iti,
    wcipi,
    hasField: Number(p.wdpPhoneCount || 0) > 0,
  };
}

/**
 * @param {ReturnType<typeof evaluatePhoneIntegrity>} phone
 */
export function phoneVerdict(phone) {
  if (!phone.hasField) return { verdict: VERDICT.pass, finding: 'telefon alanı yok' };
  if (phone.double) {
    const why =
      phone.iti || phone.wcipi
        ? `wcipi/iti bağlandı iti=${phone.iti} wcipi=${phone.wcipi}`
        : `bayrak/seçici ${phone.flags}/${phone.btns}`;
    return { verdict: VERDICT.red, finding: why };
  }
  return { verdict: VERDICT.pass, finding: '' };
}

/**
 * @param {{
 *   billingPhoneVisible?: number,
 *   billingPhoneTotal?: number,
 *   cfeFieldsVisible?: number,
 *   checkoutForm?: boolean
 * }} p
 */
export function evaluateCheckoutFields(p = {}) {
  if (!p.checkoutForm) return { ok: true, skip: true, reason: 'ödeme formu yok' };
  const vis = Number(p.billingPhoneVisible || 0);
  const total = Number(p.billingPhoneTotal || 0);
  if (total > 1) return { ok: false, skip: false, reason: `Woo telefon ${total} kopya` };
  if (vis < 1 && total < 1) return { ok: true, skip: false, reason: 'Woo telefon yok (blok ödeme olabilir)' };
  return { ok: true, skip: false, reason: '' };
}

/**
 * @param {{
 *   curcyCount?: number,
 *   overlapsForm?: boolean,
 *   formVisible?: boolean
 * }} p
 */
export function evaluateCurcy(p = {}) {
  if (p.overlapsForm) return { ok: false, reason: 'Curcy seçici formu örtüyor' };
  if (p.formVisible === false && Number(p.curcyCount || 0) > 0) {
    return { ok: false, reason: 'form görünmez (Curcy sonrası)' };
  }
  return { ok: true, reason: Number(p.curcyCount || 0) ? `curcy×${p.curcyCount}` : '' };
}

/**
 * @param {ReturnType<typeof phoneVerdict>} phone
 * @param {ReturnType<typeof evaluateCheckoutFields>} checkout
 * @param {ReturnType<typeof evaluateCurcy>} curcy
 * @param {{ pageId?: string }} [opts]
 */
export function fieldsVerdict(phone, checkout, curcy, opts = {}) {
  const parts = [phone];
  if (opts.pageId === 'checkout' && checkout && !checkout.skip && !checkout.ok) {
    parts.push({ verdict: VERDICT.red, finding: checkout.reason });
  } else if (opts.pageId === 'checkout' && checkout && !checkout.ok) {
    parts.push({ verdict: VERDICT.red, finding: checkout.reason });
  }
  if (curcy && !curcy.ok) parts.push({ verdict: VERDICT.red, finding: curcy.reason });
  return worstVerdict(parts);
}

const PLUGIN_EL_RE = /\.wdp-|wdp-modal|hdf-donation|woo-donation/i;

/**
 * @param {string} sel
 */
export function isPluginChromeSelector(sel) {
  return PLUGIN_EL_RE.test(String(sel || ''));
}

/**
 * @param {Record<string, object|null>} withCss
 * @param {Record<string, object|null>} withoutCss
 * @returns {{ leaked: string[], finding: string }}
 */
export function diffChromeStyles(withCss, withoutCss) {
  const a = withCss && typeof withCss === 'object' ? withCss : {};
  const b = withoutCss && typeof withoutCss === 'object' ? withoutCss : {};
  const leaked = [];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (isPluginChromeSelector(k)) continue;
    if (JSON.stringify(a[k] || null) !== JSON.stringify(b[k] || null)) leaked.push(k);
  }
  return {
    leaked,
    finding: leaked.length ? leaked[0] : '',
  };
}

/**
 * @param {{ leaked: string[] }} diff
 * @param {{ overflow?: boolean, clipped?: boolean, badTouch?: Array<{name?: string, w?: number, h?: number}>, formVisible?: boolean }} form
 */
export function cssVerdict(diff, form = {}) {
  if (form.formVisible === false) {
    return { verdict: VERDICT.red, finding: 'form görünmez' };
  }
  if (form.formVisible === true) {
    if (form.overflow) return { verdict: VERDICT.red, finding: 'yatay kaydırma' };
    if (form.clipped) return { verdict: VERDICT.red, finding: 'form taşıyor' };
    if (Array.isArray(form.badTouch) && form.badTouch.length) {
      const s = form.badTouch[0];
      return {
        verdict: VERDICT.red,
        finding: `dokunma <${MIN_TOUCH_PX}px ${(s.name || s.tag || '').toString().slice(0, 40)} ${s.w}x${s.h}`,
      };
    }
  }
  if (diff.leaked && diff.leaked.length) {
    return { verdict: VERDICT.red, finding: `CSS sızıntısı ${diff.leaked[0]}` };
  }
  return { verdict: VERDICT.pass, finding: '' };
}

/**
 * @param {{ ok?: boolean, status?: number, success?: boolean, noncePresent?: boolean, skipped?: boolean, reason?: string }} ajax
 */
export function cacheVerdict(ajax = {}) {
  if (ajax.skipped) return { verdict: VERDICT.skip, finding: ajax.reason || 'atlandı' };
  if (!ajax.noncePresent) return { verdict: VERDICT.red, finding: 'nonce yok (önbellek)' };
  if (ajax.ok === false) {
    return {
      verdict: VERDICT.red,
      finding: `AJAX status=${ajax.status ?? '?'} success=${ajax.success === false ? 'false' : 'yok'}`,
    };
  }
  if (ajax.addToCart && ajax.addToCart.nonceFail) {
    return { verdict: VERDICT.red, finding: 'sepete ekle nonce' };
  }
  return { verdict: VERDICT.pass, finding: '' };
}

const RANK = { kırmızı: 3, uyarı: 2, atlandı: 0, geçti: 1 };

/**
 * @param {Array<{ verdict: string, finding?: string }>} parts
 */
export function worstVerdict(parts) {
  let best = { verdict: VERDICT.pass, finding: '' };
  let rank = -1;
  for (const p of parts || []) {
    if (!p) continue;
    const v = p.verdict || VERDICT.pass;
    const r = RANK[v] ?? 0;
    if (r > rank) {
      rank = r;
      best = { verdict: v, finding: p.finding || '' };
    } else if (r === rank && !best.finding && p.finding) {
      best.finding = p.finding;
    }
  }
  return best;
}

/**
 * @param {string[]} argv
 */
export function parseConflictsArgs(argv = process.argv.slice(2)) {
  const a = argv.filter((x) => x !== '--');
  let envRaw = '';
  let device = 'all';
  let simRemote = null;
  let help = false;
  let themes = null;
  let pages = null;
  let port = 8911;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--help' || x === '-h') help = true;
    else if (x === '--env') envRaw = String(a[++i] || envRaw);
    else if (x.startsWith('--env=')) envRaw = x.slice('--env='.length);
    else if (x === '--device') device = String(a[++i] || device);
    else if (x.startsWith('--device=')) device = x.slice('--device='.length);
    else if (x === '--sim-remote') simRemote = true;
    else if (x === '--no-sim-remote') simRemote = false;
    else if (x === '--themes') themes = String(a[++i] || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    else if (x.startsWith('--themes='))
      themes = x
        .slice('--themes='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (x === '--pages')
      pages = String(a[++i] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (x.startsWith('--pages='))
      pages = x
        .slice('--pages='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (x === '--port') port = Number.parseInt(String(a[++i] || port), 10) || port;
    else if (x.startsWith('--port=')) port = Number.parseInt(x.slice('--port='.length), 10) || port;
  }
  const devices = parseDeviceList(device);
  return {
    envRaw: envRaw || 'local',
    device,
    devices: devices.length ? devices : [...DEVICE_ORDER],
    simRemote,
    help,
    themes,
    pages: pages && pages.length ? pages : [...PAGE_IDS],
    port,
  };
}

/**
 * canonicalEnv benzeri; local kabul.
 * @param {string} raw
 */
export function canonicalConflictsEnv(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (['staging', 'hedef', 'staging-hedef'].includes(s)) return 'staging';
  if (['ikram', 'ikram-aid', 'ikramaid'].includes(s)) return 'ikram';
  if (['local', 'local-wp', ''].includes(s)) return 'local';
  throw new Error('Kullanım: npm run e2e:conflicts -- --env staging|ikram [--device iphone|android|desktop|all]');
}

/**
 * @param {string} envName
 */
export function conflictsDirFor(envName) {
  const id = canonicalConflictsEnv(envName);
  return path.join(CONFLICTS_OUT_DIR, id);
}

/**
 * Uzak benzetim: staging/Ikram eklenti kopyaları (ağ yok; URL sınıflama).
 */
export function simRemoteScriptUrls() {
  return [
    'https://shop.example/wp-includes/js/jquery/jquery.min.js',
    'https://shop.example/wp-content/plugins/legacy-lib/js/jquery-1.12.4.min.js',
    'https://shop.example/wp-content/plugins/wcipi-plugin/assets/js/intlTelInput.min.js',
    'https://shop.example/wp-content/plugins/woocommerce/assets/js/selectWoo/selectWoo.full.min.js',
    'https://shop.example/wp-content/plugins/woo-checkout-field-editor-pro/assets/js/select2.min.js',
    'https://shop.example/wp-content/themes/blocksy/static/bundle/swiper.min.js',
    'https://shop.example/wp-content/plugins/elementor/assets/lib/swiper/v8/swiper.min.js',
    'https://shop.example/wp-content/plugins/woocommerce-multi-currency/assets/js/woocommerce-multi-currency.min.js',
  ];
}

export function simRemotePhoneProbe() {
  return {
    wdpPhoneCount: 1,
    flagCount: 2,
    countryBtnCount: 2,
    itiOnWdp: 1,
    wcipiOnWdp: 1,
    itiGlobalOnWdp: true,
  };
}

export function simRemoteCheckoutProbe() {
  return {
    checkoutForm: true,
    billingPhoneVisible: 2,
    billingPhoneTotal: 2,
    cfeFieldsVisible: 3,
  };
}

export function simRemoteCurcyProbe() {
  return { curcyCount: 1, overlapsForm: true, formVisible: false };
}

export function simRemoteConsoleEvents() {
  return [
    {
      text: 'Uncaught TypeError: x is not a function',
      url: 'https://shop.example/wp-content/plugins/give/assets/dist/js/give.js',
      stack: 'at give.js:12',
    },
    {
      text: 'WDPApp.init failed',
      url: 'https://shop.example/wp-content/plugins/woo-donation-popup/assets/js/donation-modal.js',
      stack: 'woo-donation-popup/assets/js/donation-modal.js:88',
    },
    {
      text: 'Avada fusion error',
      url: 'https://shop.example/wp-content/themes/Avada/assets/min/js/general/avada-general.js',
      stack: '',
    },
  ];
}

/**
 * @param {object} opts
 */
export function formatConflictsSummary(opts) {
  const envName = opts.envName || 'local';
  const devices = opts.devices || [];
  const rows = Array.isArray(opts.rows) ? opts.rows : [];
  const startedAt = opts.startedAt || '';
  const durationMs = Number(opts.durationMs) || 0;
  const sim = Array.isArray(opts.sim) ? opts.sim : [];
  const lines = [
    '# e2e:conflicts özet',
    '',
    `Ortam: ${envName}`,
    `Cihazlar: ${devices.join(', ')}`,
    `Başlangıç: ${startedAt}`,
    `Süre: ${(durationMs / 1000).toFixed(1)}s`,
    '',
    '## Sonuçlar (sayfa × cihaz × denetim)',
    '',
    '| sayfa | cihaz | tema | konsol | betik | alan | css | önbellek | ilk bulgu | ekran |',
    '|-------|-------|------|--------|-------|------|-----|----------|-----------|-------|',
  ];
  for (const r of rows) {
    const shot = r.shot ? `\`${r.shot}\`` : '';
    const finding = String(r.finding || '').replace(/\|/g, '\\|');
    lines.push(
      `| ${r.page} | ${r.device} | ${r.theme || '—'} | ${r.console} | ${r.scripts} | ${r.fields} | ${r.css} | ${r.cache} | ${finding} | ${shot} |`
    );
  }
  if (sim.length) {
    lines.push('', '## Uzak benzetim (yerel)', '');
    lines.push('| senaryo | beklenen | sonuç | bulgu |');
    lines.push('|---------|----------|-------|-------|');
    for (const s of sim) {
      lines.push(
        `| ${s.id} | ${s.expected} | ${s.actual} | ${String(s.finding || '').replace(/\|/g, '\\|')} |`
      );
    }
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * @param {string} file
 * @param {string} body
 */
export function writeConflictsSummary(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body.endsWith('\n') ? body : `${body}\n`, 'utf8');
  return file;
}

/**
 * @param {object} row
 */
export function rowHasFinding(row) {
  const vs = [row.console, row.scripts, row.fields, row.css, row.cache];
  return vs.some((v) => v === VERDICT.red || v === VERDICT.warn);
}

/**
 * @param {object[]} rows
 */
export function countReds(rows) {
  let n = 0;
  for (const r of rows || []) {
    for (const k of CHECK_IDS) {
      if (r[k] === VERDICT.red) n += 1;
    }
  }
  return n;
}
